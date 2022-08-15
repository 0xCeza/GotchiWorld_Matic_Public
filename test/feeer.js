const { expect } = require("chai");
const { ethers } = require("hardhat");

/* global vars */
let accounts = [];
let feeer, wmatic;
const wmaticDonorAddress = "0x0AFF6665bB45bF349489B20E225A6c5D78E2280F";
const maticDonorAddress = "0x7Ba7f4773fa7890BaD57879F0a1Faa0eDffB3520";
const gotchiDonorAddress = "0xae79077D8d922d071797a7F8849430Fed488c005";
const petterAddress = "0x290000C417a1DE505eb08b7E32b3e8dA878D194E";

const impersonateAddress = async (address) => {
  const hre = require("hardhat");
  await hre.network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [address],
  });
  const signer = await ethers.provider.getSigner(address);
  signer.address = signer._address;
  return signer;
};

function eth(amount) {
  amount = amount.toString();
  return ethers.utils.parseEther(amount);
}

/**
 *
 * @param {*} user user signer (not address)
 * @param {*} amountGotchis amount of gotchis to give
 * @returns true if gave gotchi, false if not
 */
async function giveGotchis(user, amountGotchis) {
  if (amountGotchis == 0) return false;
  const gotchiDonor = await impersonateAddress(gotchiDonorAddress);
  let tokenIds = await diamond.tokenIdsOfOwner(gotchiDonorAddress);
  let tokensToTransfer = [];
  for (let i = 0; i < amountGotchis; i++) {
    let tokenId = tokenIds[i];
    tokensToTransfer.push(Number(tokenId));
  }

  await diamond
    .connect(gotchiDonor)
    .safeBatchTransferFrom(
      gotchiDonorAddress,
      user.address,
      tokensToTransfer,
      "0x"
    );

  return true;
}

async function generateUser(amountGotchis) {
  // Create random usert
  const wallet = ethers.Wallet.createRandom();
  let userAddress = wallet.address;

  // impersonate users
  const user = await impersonateAddress(userAddress);
  const wmaticDonor = await impersonateAddress(wmaticDonorAddress);
  const maticDonor = await impersonateAddress(maticDonorAddress);

  // Transfer WMATIC
  await wmatic.connect(wmaticDonor).transfer(user.address, eth(100));

  // Transfer matic
  await maticDonor.sendTransaction({
    to: user.address,
    value: ethers.utils.parseEther("10.0"),
  });

  // User approve wmatic for feeer
  await wmatic.connect(user).approve(feeer.address, eth(100));

  // Give him gotchis (First get IDs then transfer)
  await giveGotchis(user, amountGotchis);

  accounts.push(user);

  return user;
}

async function passDays(amount) {
  let days = amount * 86400;
  await network.provider.send("evm_increaseTime", [days]);
  await network.provider.send("evm_mine");
}

describe("Deployement => SignUp => Leaving", function () {
  let owner, u1, u2, u3, u4, u5, u6;

  const erc20abi = require("./erc20abi.json");
  const diamondabi = require("./diamondabi.json");

  before(async function () {
    [owner] = await ethers.getSigners();

    // Deploy the feeer contract
    const feeerFactory = await ethers.getContractFactory("Feeer");
    feeer = await feeerFactory.deploy();

    // Wmatic contract
    wmatic = new ethers.Contract(
      "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      erc20abi,
      owner
    );

    // Diamond contract
    diamond = new ethers.Contract(
      "0x86935F11C86623deC8a25696E1C19a8659CbF95d",
      diamondabi,
      owner
    );

    // Generate new users
    u1 = await generateUser(1);
    u2 = await generateUser(5);
    u3 = await generateUser(6);
    u4 = await generateUser(10);
    u5 = await generateUser(14);
    u6 = await generateUser(0);

    // All users setPetOperatorForAll
    accounts.forEach(async (u) => {
      await diamond.connect(u).setPetOperatorForAll(petterAddress, true);
    });
  });

  beforeEach(async function () {
    // At each test, check if index of user array is still correct
    const users = await feeer.getUsers();
    let success = true;
    for (let i = 0; i < users.length; i++) {
      u = users[i];
      index = await feeer.getUsersToIndex(u);
      //   console.log(`u=${u} index=${index} i=${i}`);
      if (index != i) {
        // console.log(`u=${index} i=${i}`);
        success = false;
        break;
      }
    }
    // console.log("*** " + success);
    expect(success).to.be.true;
  });

  it("U1 to U5 can sign up", async function () {
    await feeer.connect(u1).signUp();
    await feeer.connect(u2).signUp();
    await feeer.connect(u3).signUp();
    await feeer.connect(u4).signUp();
    await feeer.connect(u5).signUp();
  });

  it("U6 can't sign up because no gotchi", async function () {
    await expect(feeer.connect(u6).signUp()).to.be.reverted;
  });

  it("U1 to U5 shouldn't be able to signUp twice", async function () {
    await expect(feeer.connect(u1).signUp()).to.be.reverted;
    await expect(feeer.connect(u2).signUp()).to.be.reverted;
    await expect(feeer.connect(u3).signUp()).to.be.reverted;
    await expect(feeer.connect(u4).signUp()).to.be.reverted;
    await expect(feeer.connect(u5).signUp()).to.be.reverted;
  });

  it("Users have expected amount of gotchis", async function () {
    expect(await diamond.balanceOf(u1.address)).to.equal(1);
    expect(await diamond.balanceOf(u2.address)).to.equal(5);
    expect(await diamond.balanceOf(u3.address)).to.equal(6);
    expect(await diamond.balanceOf(u4.address)).to.equal(10);
    expect(await diamond.balanceOf(u5.address)).to.equal(14);
  });

  it("U1 to U5 should be signedUp", async function () {
    expect(await feeer.getIsSignedUp(u1.address)).to.be.true;
    expect(await feeer.getIsSignedUp(u2.address)).to.be.true;
    expect(await feeer.getIsSignedUp(u3.address)).to.be.true;
    expect(await feeer.getIsSignedUp(u4.address)).to.be.true;
    expect(await feeer.getIsSignedUp(u5.address)).to.be.true;
  });

  it("U1 to U5 shouldn't be removable", async function () {
    expect(await feeer.getNeedRemoveUser(u1.address)).to.be.false;
    expect(await feeer.getNeedRemoveUser(u2.address)).to.be.false;
    expect(await feeer.getNeedRemoveUser(u3.address)).to.be.false;
    expect(await feeer.getNeedRemoveUser(u4.address)).to.be.false;
    expect(await feeer.getNeedRemoveUser(u5.address)).to.be.false;
  });

  it("U1 to U5 can't be removed", async function () {
    await expect(feeer.removeUser(u1.address)).to.be.reverted;
    await expect(feeer.removeUser(u2.address)).to.be.reverted;
    await expect(feeer.removeUser(u3.address)).to.be.reverted;
    await expect(feeer.removeUser(u4.address)).to.be.reverted;
    await expect(feeer.removeUser(u5.address)).to.be.reverted;
  });

  it("U1 to U5 shouldn't be regulatable", async function () {
    expect(await feeer.getWmaticRegPerUser(u1.address)).to.equal(0);
    expect(await feeer.getWmaticRegPerUser(u2.address)).to.equal(0);
    expect(await feeer.getWmaticRegPerUser(u3.address)).to.equal(0);
    expect(await feeer.getWmaticRegPerUser(u4.address)).to.equal(0);
    expect(await feeer.getWmaticRegPerUser(u5.address)).to.equal(0);
  });

  it("U1 to U5 shouldn't be chargeale", async function () {
    expect(await feeer.getIsTimeToPay(u1.address)).to.be.false;
    expect(await feeer.getIsTimeToPay(u2.address)).to.be.false;
    expect(await feeer.getIsTimeToPay(u3.address)).to.be.false;
    expect(await feeer.getIsTimeToPay(u4.address)).to.be.false;
    expect(await feeer.getIsTimeToPay(u5.address)).to.be.false;
  });

  it("Users have expected amount of Wmatic left", async function () {
    expect(await wmatic.balanceOf(u1.address)).to.equal(eth(99));
    expect(await wmatic.balanceOf(u2.address)).to.equal(eth(98));
    expect(await wmatic.balanceOf(u3.address)).to.equal(eth(98));
    expect(await wmatic.balanceOf(u4.address)).to.equal(eth(97));
    expect(await wmatic.balanceOf(u5.address)).to.equal(eth(97));
  });

  it("U3 should be able to leave and users.length should be 4 (user(0) = diamond)", async function () {
    await feeer.connect(u3).leave();
    const allUsers = await feeer.getUsers();
    expect(allUsers.length).to.equal(5); // 4 user 1 diamond
  });

  it("After leaving, U3 should have index == 0", async function () {
    expect(await feeer.getUsersToIndex(u3.address)).to.equal(0);
  });

  it("After 16 days, pay() should revert", async function () {
    await passDays(16);
    await expect(feeer.connect(owner).pay(u1.address)).to.be.reverted;
    await expect(feeer.connect(owner).pay(u2.address)).to.be.reverted;
    await expect(feeer.connect(owner).pay(u3.address)).to.be.reverted;
    await expect(feeer.connect(owner).pay(u4.address)).to.be.reverted;
    await expect(feeer.connect(owner).pay(u5.address)).to.be.reverted;
  });

  it("regulate() should revert as no one added gotchis", async function () {
    await expect(feeer.connect(owner).regulate(u1.address)).to.be.reverted;
    await expect(feeer.connect(owner).regulate(u2.address)).to.be.reverted;
    await expect(feeer.connect(owner).regulate(u3.address)).to.be.reverted;
    await expect(feeer.connect(owner).regulate(u4.address)).to.be.reverted;
    await expect(feeer.connect(owner).regulate(u5.address)).to.be.reverted;
  });

  it("U1 to U5 shouldn't be removable", async function () {
    expect(await feeer.getNeedRemoveUser(u1.address)).to.be.false;
    expect(await feeer.getNeedRemoveUser(u2.address)).to.be.false;
    expect(await feeer.getNeedRemoveUser(u3.address)).to.be.false;
    expect(await feeer.getNeedRemoveUser(u4.address)).to.be.false;
    expect(await feeer.getNeedRemoveUser(u5.address)).to.be.false;
  });

  it("U1 to U5 can't be removed", async function () {
    await expect(feeer.removeUser(u1.address)).to.be.reverted;
    await expect(feeer.removeUser(u2.address)).to.be.reverted;
    await expect(feeer.removeUser(u3.address)).to.be.reverted;
    await expect(feeer.removeUser(u4.address)).to.be.reverted;
    await expect(feeer.removeUser(u5.address)).to.be.reverted;
  });

  it("u5 can be regulated for acquiring 1 more gotchi", async function () {
    await giveGotchis(u5, 1);
    await feeer.connect(owner).regulate(u5.address);
    expect(await wmatic.balanceOf(u5.address)).to.not.equal(eth(97));
  });

  it("u5 can't be regulated twice", async function () {
    await passDays(1);
    await expect(feeer.connect(owner).regulate(u5.address)).to.be.reverted;
  });

  it("u1 add 3 Gotchis but shouldn't be regulated", async function () {
    await giveGotchis(u1, 3);
    await expect(feeer.connect(owner).regulate(u1.address)).to.be.reverted;
  });

  it("After 16 more days, pay() should work", async function () {
    await passDays(16);
    await feeer.connect(owner).pay(u1.address);
    await feeer.connect(owner).pay(u2.address);
    let balanceU5 = await wmatic.balanceOf(u5.address);
    await feeer.connect(owner).pay(u5.address);
    balanceU5 = await wmatic.balanceOf(u5.address);
    expect(await wmatic.balanceOf(u1.address)).to.equal(eth(98));
    expect(await wmatic.balanceOf(u2.address)).to.equal(eth(96));
  });

  it("pay() should revert for U3 (left)", async function () {
    await expect(feeer.connect(owner).pay(u3.address)).to.be.reverted;
  });

  it("u4 can't be regulated after 30 days, even with more gotchis", async function () {
    await passDays(31);
    await giveGotchis(u4, 5);
    await expect(feeer.connect(owner).regulate(u4.address)).to.be.reverted;
  });

  it("u1 removed petOperator can be removed", async function () {
    await diamond.connect(u1).setPetOperatorForAll(petterAddress, false);
    expect(await feeer.getNeedRemoveUser(u1.address)).to.be.true;
    await feeer.removeUser(u1.address);
    expect(await feeer.getUsersToIndex(u1.address)).to.equal(0);
  });

  // User doesn't have enough matic but its not time to pay => not removable
  it("u2 is poor but its not time to pay, can't be removed", async function () {
    await feeer.pay(u2.address);
    let balance = await wmatic.balanceOf(u2.address);
    await wmatic.connect(u2).transfer(u1.address, balance);
    expect(await wmatic.balanceOf(u2.address)).to.equal(eth(0));
    expect(await feeer.getNeedRemoveUser(u2.address)).to.be.false;
    await expect(feeer.removeUser(u2.address)).to.be.reverted;
  });

  // same but it's time to pay => removable
  it("u2 is poor and it's time2pay", async function () {
    passDays(31);
    let balance = await wmatic.balanceOf(u2.address);
    console.log(balance);
    expect(await feeer.getNeedRemoveUser(u2.address)).to.be.true;
    await feeer.removeUser(u2.address);
    expect(await feeer.getUsersToIndex(u2.address)).to.equal(0);
  });

  // It's over time to regulate, can't regulate
  it("u4 has passed regulation time, can't be regulated", async function () {
    await giveGotchis(u4, 5);
    expect(await feeer.getWmaticRegPerUser(u4.address)).to.equal(0);
    expect(await feeer.getNeedRemoveUser(u4.address)).to.be.false;
    await expect(feeer.removeUser(u4.address)).to.be.reverted;
  });

  // user doesn't have enough matic and it's time to regulate (added more gotchis)
  it("u4 got new gotchis the 29th day, not worth regulating", async function () {
    await feeer.pay(u4.address);
    await giveGotchis(u4, 5);
    await passDays(29);
    expect(await feeer.getWmaticRegPerUser(u4.address)).to.equal(0);
    expect(await feeer.getNeedRemoveUser(u4.address)).to.be.false;
    await expect(feeer.removeUser(u4.address)).to.be.reverted;
  });

  // user doesn't have enough matic and it's time to regulate (added more gotchis)
  it("u4 is poor and its time2regulate, removed", async function () {
    await passDays(2);
    await feeer.pay(u4.address);
    let balance = await wmatic.balanceOf(u4.address);
    console.log(balance);
    await wmatic.connect(u4).transfer(u1.address, balance);
    expect(await wmatic.balanceOf(u4.address)).to.equal(eth(0));
    await giveGotchis(u4, 5);
    expect(await feeer.getNeedRemoveUser(u4.address)).to.be.true;
    await feeer.removeUser(u4.address);
    expect(await feeer.getUsersToIndex(u4.address)).to.equal(0);
  });
});

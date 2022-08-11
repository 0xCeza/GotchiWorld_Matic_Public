const { expect } = require("chai");
const { ethers } = require("hardhat");

/* global vars */
let accounts = [];
let feeing, wmatic;
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

async function generateUser(amountGotchis) {
  // Create random usert
  const wallet = ethers.Wallet.createRandom();
  let userAddress = wallet.address;

  // impersonate users
  const user = await impersonateAddress(userAddress);
  const wmaticDonor = await impersonateAddress(wmaticDonorAddress);
  const maticDonor = await impersonateAddress(maticDonorAddress);
  const gotchiDonor = await impersonateAddress(gotchiDonorAddress);

  // Transfer WMATIC
  await wmatic.connect(wmaticDonor).transfer(user.address, eth(100));

  // Transfer matic
  await maticDonor.sendTransaction({
    to: user.address,
    value: ethers.utils.parseEther("10.0"),
  });

  // User approve GHST for feeing
  await wmatic.connect(user).approve(feeing.address, eth(100));

  // Give him gotchis (First get IDs then transfer)
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

  accounts.push(user);

  return user;
}

async function passDays(amount) {
  let days = amount * 86400;
  await network.provider.send("evm_increaseTime", [days]);
  await network.provider.send("evm_mine");
}

/** TODO
 * Test Pay
 * Test Regulate
 * Adv time
 * Test user can't make another user leave
 */

describe("Deployement => SignUp => Leaving", function () {
  let owner, u1, u2, u3, u4, u5, u6;

  const erc20abi = require("./erc20abi.json");
  const diamondabi = require("./diamondabi.json");

  before(async function () {
    [owner] = await ethers.getSigners();

    // Deploy the feeing contract
    const feeingFactory = await ethers.getContractFactory("Feeer");
    feeing = await feeingFactory.deploy();

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
    // u2 = await generateUser(5);
    // u3 = await generateUser(16);
    // u4 = await generateUser(23);
    // u5 = await generateUser(42);
    u6 = await generateUser(0);

    u2 = await generateUser(5);
    u3 = await generateUser(6);
    u4 = await generateUser(10);
    u5 = await generateUser(14);

    // All users setPetOperatorForAll
    accounts.forEach(async (u) => {
      await diamond.connect(u).setPetOperatorForAll(petterAddress, true);
    });
  });

  beforeEach(async function () {
    // At each test, check if index of user array is still correct
    const users = await feeing.getUsers();
    let success = true;
    for (let i = 0; i < users.length; i++) {
      u = users[i];
      index = await feeing.getUsersToIndex(u);
      console.log(`u=${u} index=${index} i=${i}`);
      if (index != i) {
        console.log(`u=${index} i=${i}`);
        success = false;
        break;
      }
    }
    console.log("*** " + success);
    expect(success).to.be.true;
  });

  it("Owner should be approved", async function () {
    expect(await feeing.getIsApproved(owner.address)).to.be.true;
  });

  it("U1 to U5 can sign up", async function () {
    await feeing.connect(u1).signUp();
    await feeing.connect(u2).signUp();
    await feeing.connect(u3).signUp();
    await feeing.connect(u4).signUp();
    await feeing.connect(u5).signUp();
  });

  it("U6 can't sign up because no gotchi", async function () {
    await expect(feeing.connect(u6).signUp()).to.be.reverted;
  });

  it("U1 to U5 shouldn't be able to signUp twice", async function () {
    await expect(feeing.connect(u1).signUp()).to.be.reverted;
    await expect(feeing.connect(u2).signUp()).to.be.reverted;
    await expect(feeing.connect(u3).signUp()).to.be.reverted;
    await expect(feeing.connect(u4).signUp()).to.be.reverted;
    await expect(feeing.connect(u5).signUp()).to.be.reverted;
  });

  it("Users have expected amount of gotchis", async function () {
    // expect(await diamond.balanceOf(u1.address)).to.equal(1);
    // expect(await diamond.balanceOf(u2.address)).to.equal(5);
    // expect(await diamond.balanceOf(u3.address)).to.equal(16);
    // expect(await diamond.balanceOf(u4.address)).to.equal(23);
    // expect(await diamond.balanceOf(u5.address)).to.equal(42);
    expect(await diamond.balanceOf(u1.address)).to.equal(1);
    expect(await diamond.balanceOf(u2.address)).to.equal(5);
    expect(await diamond.balanceOf(u3.address)).to.equal(6);
    expect(await diamond.balanceOf(u4.address)).to.equal(10);
    expect(await diamond.balanceOf(u5.address)).to.equal(14);
  });

  it("U1 to U5 should be signedUp", async function () {
    expect(await feeing.getIsSignedUp(u1.address)).to.be.true;
    expect(await feeing.getIsSignedUp(u2.address)).to.be.true;
    expect(await feeing.getIsSignedUp(u3.address)).to.be.true;
    expect(await feeing.getIsSignedUp(u4.address)).to.be.true;
    expect(await feeing.getIsSignedUp(u5.address)).to.be.true;
  });

  it("Users have expected amount of Wmatic left", async function () {
    expect(await wmatic.balanceOf(u1.address)).to.equal(eth(99));
    expect(await wmatic.balanceOf(u2.address)).to.equal(eth(98));
    expect(await wmatic.balanceOf(u3.address)).to.equal(eth(98));
    expect(await wmatic.balanceOf(u4.address)).to.equal(eth(97));
    expect(await wmatic.balanceOf(u5.address)).to.equal(eth(97));
  });

  it("After leaving, U1 should have index == 0", async function () {
    await feeing.connect(u1).leave(u1.address);
    expect(await feeing.getUsersToIndex(u1.address)).to.equal(0);
  });

  it("U3 should be able to leave and users.length should be 4 (user(0) = diamond)", async function () {
    await feeing.connect(u3).leave(u3.address);
    const allUsers = await feeing.getUsers();
    expect(allUsers.length).to.equal(4);
  });

  it("After leaving, U3 should have index == 0", async function () {
    expect(await feeing.getUsersToIndex(u3.address)).to.equal(0);
  });
});

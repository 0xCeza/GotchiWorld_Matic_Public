// Command to deploy :
// npx hardhat run scripts/deploy.js --network <your-network>
// Command to verify :
// npx hardhat verify --network <your-network> CONTRACT_ADDRESS "Constructor argument 1"

async function main() {
  // We get the contract to deploy
  const Feeer = await ethers.getContractFactory("Feeer");
  const feeer = await Feeer.deploy();

  await feeer.deployed();

  console.log("Feeer deployed to:", feeer.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

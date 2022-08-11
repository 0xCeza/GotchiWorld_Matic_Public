async function main() {
  // We get the contract to deploy
  const Feeing = await ethers.getContractFactory("Feeing");
  const feeing = await Feeing.deploy();

  await feeing.deployed();

  console.log("Feeing deployed to:", feeing.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

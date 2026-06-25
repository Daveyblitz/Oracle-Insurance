import { network } from "hardhat";

async function main() {
  const connection = await network.connect();

  const InsuranceFactory =
    await connection.ethers.getContractFactory("OracleInsurance");

  const insurance = await InsuranceFactory.deploy();

  await insurance.waitForDeployment();

  console.log("Contract deployed:", insurance.target);

  // Buy policy
  await insurance.buyPolicy(2000, 500);

  console.log("Policy purchased");

  // Scenario 1
  await insurance.updatePrice(2500);

  await insurance.checkAndPayout();

  let currentPrice = await insurance.currentPrice();

  console.log("\nAfter price = 2500");
  console.log("Current Price:", currentPrice.toString());

  // Scenario 2
  await insurance.updatePrice(1800);

  await insurance.checkAndPayout();

  currentPrice = await insurance.currentPrice();

  console.log("\nAfter price = 1800");
  console.log("Current Price:", currentPrice.toString());

  console.log("\nInsurance flow executed successfully");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
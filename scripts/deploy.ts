import { network } from "hardhat";

async function main() {
  const connection = await network.connect();

  const InsuranceFactory =
    await connection.ethers.getContractFactory("OracleInsurance");

  const insurance = await InsuranceFactory.deploy();

  await insurance.waitForDeployment();

  console.log("Contract deployed to:", insurance.target);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
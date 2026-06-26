import { network } from "hardhat";

const ORACLE_INSURANCE_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const NEW_PRICE = 1800;

async function main() {
  const connection = await network.connect();
  const insurance = await connection.ethers.getContractAt(
    "OracleInsurance",
    ORACLE_INSURANCE_ADDRESS
  );

  console.log("Updating oracle price to:", NEW_PRICE);
  const tx = await insurance.updatePrice(NEW_PRICE);
  await tx.wait();
  console.log("Oracle price updated successfully. Current price is now:", (await insurance.currentPrice()).toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

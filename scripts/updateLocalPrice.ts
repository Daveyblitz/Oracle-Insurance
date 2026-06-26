import { network } from "hardhat";

const ORACLE_INSURANCE_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
const NEXT_PRICE = 2500;

async function main() {
  const connection = await network.connect();

  const insurance = await connection.ethers.getContractAt(
    "OracleInsurance",
    ORACLE_INSURANCE_ADDRESS,
  );

  await insurance.updatePrice(NEXT_PRICE);

  console.log("Oracle price updated to:", NEXT_PRICE);
  console.log("Current price:", (await insurance.currentPrice()).toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

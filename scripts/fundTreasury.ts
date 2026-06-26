import { network } from "hardhat";

const ORACLE_INSURANCE_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

async function main() {
  const connection = await network.connect();
  const [owner] = await connection.ethers.getSigners();

  console.log("Funding contract at:", ORACLE_INSURANCE_ADDRESS);
  const tx = await owner.sendTransaction({
    to: ORACLE_INSURANCE_ADDRESS,
    value: connection.ethers.parseEther("1.0")
  });
  await tx.wait();

  const balance = await connection.ethers.provider.getBalance(ORACLE_INSURANCE_ADDRESS);
  console.log("Contract treasury balance funded. New balance:", connection.ethers.formatEther(balance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

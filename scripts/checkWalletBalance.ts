import { network } from "hardhat";

const WALLET_ADDRESS = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";

async function main() {
  const connection = await network.connect();
  const balance = await connection.ethers.provider.getBalance(WALLET_ADDRESS);
  console.log("Wallet Address:", WALLET_ADDRESS);
  console.log("Actual On-chain Balance:", connection.ethers.formatEther(balance), "ETH");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

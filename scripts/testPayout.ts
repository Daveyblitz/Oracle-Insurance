import { network } from "hardhat";

async function main() {
  const connection = await network.connect();

  const InsuranceFactory =
    await connection.ethers.getContractFactory("OracleInsurance");

  const insurance = await InsuranceFactory.deploy();

  await insurance.waitForDeployment();

  console.log("Contract:", insurance.target);

  // Fund contract treasury with 1 ETH
  const [owner] = await connection.ethers.getSigners();

await owner.sendTransaction({
  to: insurance.target,
  value: connection.ethers.parseEther("1")
});

  // Buy policy
  await insurance.buyPolicy(
    2000,
    connection.ethers.parseEther("0.1")
  );

  console.log("Policy purchased");

  // Oracle updates price
  await insurance.updatePrice(1800);

  console.log("Oracle price updated");

  // Trigger payout
  await insurance.checkAndPayout();

  console.log("Payout executed");

  console.log(
    "Contract Balance After:",
    connection.ethers.formatEther(
      await insurance.contractBalance()
    ),
    "ETH"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
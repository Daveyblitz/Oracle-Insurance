import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers";
import "./styles.css";

const ORACLE_INSURANCE_ABI = [
  "function buyPolicy(uint256 _triggerPrice, uint256 _payoutAmount) public",
  "function checkAndPayout() public",
  "function updatePrice(uint256 _price) public",
] as const;

type EthereumProvider = {
  request: <T = unknown>(args: {
    method: string;
    params?: unknown[];
  }) => Promise<T>;
  on?: (event: "accountsChanged", listener: (accounts: string[]) => void) => void;
  removeListener?: (
    event: "accountsChanged",
    listener: (accounts: string[]) => void,
  ) => void;
};

const CURRENT_PRICE_SELECTOR = "0x9d1b464a";
const POLICIES_SELECTOR = "0x20e98698";
const CONTRACT_BALANCE_SELECTOR = "0x8b7afe2e";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function decodeUint256(hexValue: string) {
  return BigInt(hexValue).toString();
}

function encodeAddressParam(address: string) {
  return address.toLowerCase().replace(/^0x/, "").padStart(64, "0");
}

function decodePolicy(hexValue: string) {
  const data = hexValue.replace(/^0x/, "");
  const words = data.match(/.{1,64}/g) ?? [];

  return {
    triggerPrice: BigInt(`0x${words[0] ?? "0"}`).toString(),
    payoutAmount: BigInt(`0x${words[1] ?? "0"}`).toString(),
    active: BigInt(`0x${words[2] ?? "0"}`) === 1n,
    paid: BigInt(`0x${words[3] ?? "0"}`) === 1n,
  };
}

function getErrorMessage(error: any) {
  if (!error) return "Unknown error";

  // Check for MetaMask/Ethers user rejection
  if (
    error.code === "ACTION_REJECTED" || 
    error.code === 4001 ||
    (error.message && (error.message.includes("User denied") || error.message.includes("rejected")))
  ) {
    return "Transaction was cancelled or rejected in MetaMask.";
  }

  // Check for insufficient funds
  if (error.code === "INSUFFICIENT_FUNDS" || (error.message && error.message.includes("insufficient funds"))) {
    return "Insufficient funds in your wallet to cover the transaction or gas fees.";
  }

  // Handle standard error structures
  if (error.message && typeof error.message === "string") {
    // If the transaction reverted with a specific error message, extract it
    const revertMatch = error.message.match(/reverted with reason '([^']+)'/);
    if (revertMatch) {
      return `Transaction reverted: ${revertMatch[1]}`;
    }
    // Truncate extremely long raw errors to keep UI tidy
    if (error.message.length > 120) {
      return error.message.slice(0, 120) + "...";
    }
    return error.message;
  }

  if (error.reason && typeof error.reason === "string") {
    return error.reason;
  }

  return "An unexpected error occurred.";
}

function App() {
  const [account, setAccount] = React.useState("");
  const [status, setStatus] = React.useState("Wallet not connected");
  const [isConnecting, setIsConnecting] = React.useState(false);
  const [contractAddress, setContractAddress] = React.useState("");
  const [currentPrice, setCurrentPrice] = React.useState("");
  const [contractStatus, setContractStatus] = React.useState(
    "Enter a contract address to read the oracle price.",
  );
  const [isLoadingPrice, setIsLoadingPrice] = React.useState(false);
  const [treasuryBalance, setTreasuryBalance] = React.useState("");
  const [treasuryStatus, setTreasuryStatus] = React.useState(
    "Load the contract treasury balance.",
  );
  const [isLoadingTreasury, setIsLoadingTreasury] = React.useState(false);
  const [policy, setPolicy] = React.useState<ReturnType<typeof decodePolicy> | null>(
    null,
  );
  const [policyStatus, setPolicyStatus] = React.useState(
    "Connect a wallet and load your policy.",
  );
  const [isLoadingPolicy, setIsLoadingPolicy] = React.useState(false);
  const [triggerPriceInput, setTriggerPriceInput] = React.useState("");
  const [payoutAmountInput, setPayoutAmountInput] = React.useState("");
  const [buyStatus, setBuyStatus] = React.useState(
    "Enter policy details and click Buy Policy.",
  );
  const [isBuyingPolicy, setIsBuyingPolicy] = React.useState(false);
  const [payoutStatus, setPayoutStatus] = React.useState(
    "Check whether your policy qualifies for a payout.",
  );
  const [isTriggeringPayout, setIsTriggeringPayout] = React.useState(false);
  const [adminPriceInput, setAdminPriceInput] = React.useState("");
  const [adminStatus, setAdminStatus] = React.useState(
    "Enter a new price to update the oracle value.",
  );
  const [isAdminUpdating, setIsAdminUpdating] = React.useState(false);

  React.useEffect(() => {
    const provider = window.ethereum;

    if (!provider?.on) {
      return;
    }

    const handleAccountsChanged = (accounts: string[]) => {
      const nextAccount = accounts[0] ?? "";
      setAccount(nextAccount);
      setStatus(nextAccount ? "Wallet connected" : "Wallet not connected");
    };

    provider.on("accountsChanged", handleAccountsChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("MetaMask is not installed");
      return;
    }

    setIsConnecting(true);
    setStatus("Connecting wallet...");

    try {
      const accounts = await window.ethereum.request<string[]>({
        method: "eth_requestAccounts",
      });
      const selectedAccount = accounts[0] ?? "";

      setAccount(selectedAccount);
      setStatus(selectedAccount ? "Wallet connected" : "Wallet not connected");
    } catch {
      setStatus("Wallet connection rejected");
    } finally {
      setIsConnecting(false);
    }
  }

  async function loadTreasuryBalance() {
    if (!contractAddress.trim()) {
      setTreasuryStatus("Enter the deployed contract address first");
      return;
    }

    setIsLoadingTreasury(true);
    setTreasuryStatus("Reading treasury balance...");

    try {
      const response = await fetch(LOCAL_RPC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: contractAddress.trim(),
              data: CONTRACT_BALANCE_SELECTOR,
            },
            "latest",
          ],
          id: 3,
        }),
      });
      const data = (await response.json()) as {
        result?: string;
        error?: { message?: string };
      };

      if (data.error) {
        throw new Error(data.error.message ?? "RPC call failed");
      }

      if (!data.result || data.result === "0x") {
        throw new Error("No treasury response from local RPC");
      }

      setTreasuryBalance(formatEther(decodeUint256(data.result)));
      setTreasuryStatus("Treasury balance loaded from local Hardhat node");
    } catch (error) {
      setTreasuryBalance("");
      setTreasuryStatus(`Read failed: ${getErrorMessage(error)}`);
    } finally {
      setIsLoadingTreasury(false);
    }
  }

  async function loadCurrentPrice() {
    if (!contractAddress.trim()) {
      setContractStatus("Enter the deployed contract address first");
      return;
    }

    setIsLoadingPrice(true);
    setContractStatus("Reading current price...");

    try {
      const response = await fetch(LOCAL_RPC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: contractAddress.trim(),
              data: CURRENT_PRICE_SELECTOR,
            },
            "latest",
          ],
          id: 1,
        }),
      });
      const data = (await response.json()) as {
        result?: string;
        error?: { message?: string };
      };

      if (data.error) {
        throw new Error(data.error.message ?? "RPC call failed");
      }

      if (!data.result || data.result === "0x") {
        throw new Error("No contract response from local RPC");
      }

      setCurrentPrice(decodeUint256(data.result));
      setContractStatus("Current price loaded from local Hardhat node");
    } catch (error) {
      setCurrentPrice("");
      setContractStatus(`Read failed: ${getErrorMessage(error)}`);
    } finally {
      setIsLoadingPrice(false);
    }
  }

  async function buyPolicy() {
    if (!window.ethereum) {
      setBuyStatus("MetaMask is not installed");
      return;
    }

    if (!account) {
      setBuyStatus("Connect your wallet first");
      return;
    }

    if (!contractAddress.trim()) {
      setBuyStatus("Enter the deployed contract address first");
      return;
    }

    const triggerPrice = triggerPriceInput.trim();
    const payoutAmount = payoutAmountInput.trim();

    if (!triggerPrice) {
      setBuyStatus("Enter a trigger price");
      return;
    }

    if (!/^\d+$/.test(triggerPrice)) {
      setBuyStatus("Trigger price must be a whole number");
      return;
    }

    if (!payoutAmount) {
      setBuyStatus("Enter a payout amount");
      return;
    }

    if (Number(payoutAmount) <= 0) {
      setBuyStatus("Payout amount must be greater than zero");
      return;
    }

    setIsBuyingPolicy(true);
    setBuyStatus("Waiting for MetaMask confirmation...");

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(
        contractAddress.trim(),
        ORACLE_INSURANCE_ABI,
        signer,
      );

      const transaction = await contract.buyPolicy(
        BigInt(triggerPrice),
        parseEther(payoutAmount),
      );

      setBuyStatus("Transaction submitted. Waiting for confirmation...");
      await transaction.wait();

      setBuyStatus("Policy purchased. Reloading policy...");
      await loadMyPolicy();
      setBuyStatus("Policy purchased successfully");
    } catch (error) {
      setBuyStatus(`Purchase failed: ${getErrorMessage(error)}`);
    } finally {
      setIsBuyingPolicy(false);
    }
  }

  async function loadMyPolicy(): Promise<ReturnType<typeof decodePolicy> | null> {
    if (!account) {
      setPolicyStatus("Connect your wallet first");
      return null;
    }

    if (!contractAddress.trim()) {
      setPolicyStatus("Enter the deployed contract address first");
      return null;
    }

    setIsLoadingPolicy(true);
    setPolicyStatus("Reading policy...");

    try {
      const response = await fetch(LOCAL_RPC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: contractAddress.trim(),
              data: `${POLICIES_SELECTOR}${encodeAddressParam(account)}`,
            },
            "latest",
          ],
          id: 2,
        }),
      });
      const data = (await response.json()) as {
        result?: string;
        error?: { message?: string };
      };

      if (data.error) {
        throw new Error(data.error.message ?? "RPC call failed");
      }

      if (!data.result || data.result === "0x") {
        throw new Error("No policy response from local RPC");
      }

      const nextPolicy = decodePolicy(data.result);

      setPolicy(nextPolicy);
      setPolicyStatus(
        nextPolicy.active || nextPolicy.paid
          ? "Policy loaded"
          : "No policy found for this wallet",
      );
      return nextPolicy;
    } catch (error) {
      setPolicy(null);
      setPolicyStatus(`Read failed: ${getErrorMessage(error)}`);
      return null;
    } finally {
      setIsLoadingPolicy(false);
    }
  }

  async function triggerPayout() {
    if (!window.ethereum) {
      setPayoutStatus("MetaMask is not installed");
      return;
    }

    if (!account) {
      setPayoutStatus("Connect your wallet first");
      return;
    }

    if (!contractAddress.trim()) {
      setPayoutStatus("Enter the deployed contract address first");
      return;
    }

    setIsTriggeringPayout(true);
    setPayoutStatus("Waiting for MetaMask confirmation...");

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(
        contractAddress.trim(),
        ORACLE_INSURANCE_ABI,
        signer,
      );

      const transaction = await contract.checkAndPayout();

      setPayoutStatus("Transaction submitted. Waiting for confirmation...");
      await transaction.wait();

      const updatedPolicy = await loadMyPolicy();
      await loadTreasuryBalance();

      if (updatedPolicy?.paid) {
        setPayoutStatus("Payout triggered successfully");
      } else {
        setPayoutStatus(
          "Transaction confirmed, but payout condition not met. Oracle price is still at or above your trigger.",
        );
      }
    } catch (error) {
      setPayoutStatus(`Payout failed: ${getErrorMessage(error)}`);
    } finally {
      setIsTriggeringPayout(false);
    }
  }

  async function updatePriceFromUI() {
    if (!window.ethereum) {
      setAdminStatus("MetaMask is not installed");
      return;
    }

    if (!account) {
      setAdminStatus("Connect your wallet first");
      return;
    }

    if (!contractAddress.trim()) {
      setAdminStatus("Enter the deployed contract address first");
      return;
    }

    const newPrice = adminPriceInput.trim();

    if (!newPrice) {
      setAdminStatus("Enter a price value");
      return;
    }

    if (!/^\d+$/.test(newPrice)) {
      setAdminStatus("Price must be a whole number");
      return;
    }

    setIsAdminUpdating(true);
    setAdminStatus("Waiting for MetaMask confirmation...");

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(
        contractAddress.trim(),
        ORACLE_INSURANCE_ABI,
        signer,
      );

      const transaction = await contract.updatePrice(BigInt(newPrice));

      setAdminStatus("Transaction submitted. Waiting for confirmation...");
      await transaction.wait();

      setAdminStatus("Price updated successfully!");
      setAdminPriceInput("");
      await loadCurrentPrice();
    } catch (error) {
      setAdminStatus(`Update failed: ${getErrorMessage(error)}`);
    } finally {
      setIsAdminUpdating(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="wallet-panel" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Oracle-Fed Parametric Insurance</p>
          <h1 id="app-title">Insurance Dashboard</h1>
          <p className="summary">
            Connect your wallet to start viewing and managing your insurance
            policy.
          </p>
        </div>

        <div className="connection-box">
          <span className="status-label">Wallet</span>
          <strong>{account ? shortenAddress(account) : "Not connected"}</strong>
          <p>{status}</p>
        </div>

        <button
          type="button"
          onClick={connectWallet}
          disabled={isConnecting}
          className="connect-button"
        >
          {isConnecting ? "Connecting..." : account ? "Reconnect Wallet" : "Connect Wallet"}
        </button>

        <div className="contract-panel">
          <label htmlFor="contract-address">Contract address</label>
          <input
            id="contract-address"
            type="text"
            value={contractAddress}
            onChange={(event) => setContractAddress(event.target.value)}
            placeholder="0x..."
          />

          <button
            type="button"
            onClick={loadCurrentPrice}
            disabled={isLoadingPrice}
            className="secondary-button"
          >
            {isLoadingPrice ? "Loading..." : "Load Current Price"}
          </button>

          <div className="connection-box">
            <span className="status-label">Oracle Price</span>
            <strong>{currentPrice || "Not loaded"}</strong>
            <p>{contractStatus}</p>
          </div>

          <button
            type="button"
            onClick={loadTreasuryBalance}
            disabled={isLoadingTreasury}
            className="secondary-button"
          >
            {isLoadingTreasury ? "Loading..." : "Load Treasury Balance"}
          </button>

          <div className="connection-box">
            <span className="status-label">Treasury Balance</span>
            <strong>{treasuryBalance ? `${treasuryBalance} ETH` : "Not loaded"}</strong>
            <p>{treasuryStatus}</p>
          </div>

          <button
            type="button"
            onClick={loadMyPolicy}
            disabled={isLoadingPolicy}
            className="secondary-button"
          >
            {isLoadingPolicy ? "Loading..." : "Load My Policy"}
          </button>

          <div className="buy-policy-panel">
            <p className="section-label">Buy Policy</p>

            <label htmlFor="trigger-price">Trigger price</label>
            <input
              id="trigger-price"
              type="text"
              inputMode="numeric"
              value={triggerPriceInput}
              onChange={(event) => setTriggerPriceInput(event.target.value)}
              placeholder="e.g. 2000"
            />

            <label htmlFor="payout-amount">Payout amount (ETH)</label>
            <input
              id="payout-amount"
              type="text"
              inputMode="decimal"
              value={payoutAmountInput}
              onChange={(event) => setPayoutAmountInput(event.target.value)}
              placeholder="e.g. 0.1"
            />

            <button
              type="button"
              onClick={buyPolicy}
              disabled={isBuyingPolicy}
              className="connect-button"
            >
              {isBuyingPolicy ? "Purchasing..." : "Buy Policy"}
            </button>

            <p className="helper-text">{buyStatus}</p>
          </div>

          <div className="policy-grid">
            <div>
              <span className="status-label">Trigger Price</span>
              <strong>{policy?.triggerPrice ?? "-"}</strong>
            </div>
            <div>
              <span className="status-label">Payout Amount</span>
              <strong>
                {policy
                  ? policy.payoutAmount === "0"
                    ? "0 ETH"
                    : `${formatEther(policy.payoutAmount)} ETH`
                  : "-"}
              </strong>
            </div>
            <div>
              <span className="status-label">Active</span>
              <strong>{policy ? String(policy.active) : "-"}</strong>
            </div>
            <div>
              <span className="status-label">Paid</span>
              <strong>{policy ? String(policy.paid) : "-"}</strong>
            </div>
          </div>

          <p className="helper-text">{policyStatus}</p>

          <div className="buy-policy-panel">
            <p className="section-label">Trigger Payout</p>
            <p className="helper-text">
              Prototype only: calls checkAndPayout() when the stored oracle price
              is below your trigger.
            </p>

            <button
              type="button"
              onClick={triggerPayout}
              disabled={isTriggeringPayout}
              className="secondary-button"
            >
              {isTriggeringPayout ? "Checking..." : "Trigger Payout"}
            </button>

            <p className="helper-text">{payoutStatus}</p>
          </div>

          <div className="buy-policy-panel">
            <p className="section-label">Oracle Admin Panel</p>
            <p className="helper-text">
              Only the contract owner/deployer wallet can update the oracle price.
            </p>

            <label htmlFor="admin-price">New oracle price</label>
            <input
              id="admin-price"
              type="text"
              inputMode="numeric"
              value={adminPriceInput}
              onChange={(event) => setAdminPriceInput(event.target.value)}
              placeholder="e.g. 1800"
            />

            <button
              type="button"
              onClick={updatePriceFromUI}
              disabled={isAdminUpdating}
              className="connect-button"
            >
              {isAdminUpdating ? "Updating..." : "Update Oracle Price"}
            </button>

            <p className="helper-text">{adminStatus}</p>
          </div>
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

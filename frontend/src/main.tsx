import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

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

  async function loadCurrentPrice() {
    if (!window.ethereum) {
      setContractStatus("MetaMask is not installed");
      return;
    }

    if (!contractAddress.trim()) {
      setContractStatus("Enter the deployed contract address first");
      return;
    }

    setIsLoadingPrice(true);
    setContractStatus("Reading current price...");

    try {
      const result = await window.ethereum.request<string>({
        method: "eth_call",
        params: [
          {
            to: contractAddress.trim(),
            data: CURRENT_PRICE_SELECTOR,
          },
          "latest",
        ],
      });

      setCurrentPrice(decodeUint256(result));
      setContractStatus("Current price loaded");
    } catch {
      setCurrentPrice("");
      setContractStatus("Could not read currentPrice from this address");
    } finally {
      setIsLoadingPrice(false);
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

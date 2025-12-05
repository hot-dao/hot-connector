import { Wallet } from "@wallet-standard/base";
import { runInAction } from "mobx";

import { ConnectorType, OmniConnector, OmniConnectorOptions, WC_ICON } from "../OmniConnector";
import { HotConnector } from "../HotConnector";
import { OmniWallet } from "../OmniWallet";
import { isInjected } from "../hot-wallet/hot";
import { WalletType } from "../omni/config";

import SolanaProtocolWallet from "./protocol";
import { getWallets } from "./wallets";
import SolanaWallet from "./wallet";

const wallets = getWallets();

class SolanaConnector extends OmniConnector<SolanaWallet, { wallet: Wallet }> {
  type = ConnectorType.WALLET;
  walletTypes = [WalletType.SOLANA, WalletType.OMNI];

  icon = "https://storage.herewallet.app/upload/8700f33153ad813e133e5bf9b791b5ecbeea66edca6b8d17aeccb8048eb29ef7.png";
  name = "Solana Wallet";
  id = "solana";

  constructor(wibe3: HotConnector, readonly args?: OmniConnectorOptions) {
    super(wibe3, args);

    wallets.get().forEach((t) => {
      if (this.options.find((w) => w.name === t.name)) return;
      this.options.push({ type: "extension", wallet: t, name: t.name, icon: t.icon, id: t.name, download: t.url });
    });

    this.getConnectedWallet().then(async ({ id }) => {
      try {
        const wallet = this.options.find((w) => w.id === id);
        if (!wallet) return;
        const protocolWallet = await SolanaProtocolWallet.connect(wallet.wallet, { silent: true });
        this.setWallet(new SolanaWallet(this, protocolWallet));
      } catch {
        this.removeStorage();
      }
    });

    wallets.on("register", async (wallet: Wallet & { url?: string }) => {
      if (this.options.find((w) => w.id === wallet.name)) return;
      runInAction(() => {
        this.options.push({
          wallet: wallet,
          name: wallet.name,
          icon: wallet.icon,
          id: wallet.name,
          download: wallet.url,
          type: "extension",
        });
      });

      try {
        const connected = await this.getConnectedWallet();
        if (connected !== wallet.name) return;
        const protocolWallet = await SolanaProtocolWallet.connect(wallet, { silent: true });
        this.setWallet(new SolanaWallet(this, protocolWallet));
      } catch {
        this.removeStorage();
      }
    });

    wallets.on("unregister", (wallet) => {
      this.options = this.options.filter((w) => w.id !== wallet.name);
    });

    this.initWalletConnect().then(async (wc) => {
      this.options.unshift({ type: "external", download: "https://www.walletconnect.com/get", wallet: {} as Wallet, name: "WalletConnect", id: "walletconnect", icon: WC_ICON });
      const selected = await this.getConnectedWallet();
      if (selected.id !== "walletconnect") return;
      this.setupWalletConnect();
    });
  }

  async setupWalletConnect(): Promise<SolanaWallet> {
    const wc = await this.wc;
    if (!wc) {
      this.disconnectWalletConnect();
      throw new Error("WalletConnect not found");
    }

    const account = wc.session?.namespaces.solana.accounts[0];
    if (!account) {
      this.disconnectWalletConnect();
      throw new Error("Account not found");
    }

    this.setStorage({ type: "walletconnect" });
    return this.setWallet(
      new SolanaWallet(this, {
        address: account,
        sendTransaction: async (transaction: unknown, _: unknown, options?: unknown) => new Promise((resolve) => resolve("")),
        signMessage: async (message: string) => new Uint8Array(),
        disconnect: async () => {},
      })
    );
  }

  async createWallet(address: string): Promise<OmniWallet> {
    return new SolanaWallet(this, { address });
  }

  async getConnectedWallet() {
    if (isInjected()) return { type: "wallet", id: "HOT Wallet" };
    return this.getStorage();
  }

  async connect(id: string) {
    if (id === "walletconnect") {
      return await this.connectWalletConnect({
        onConnect: () => this.setupWalletConnect(),
        namespaces: {
          solana: {
            methods: ["solana_sendTransaction", "solana_signTransaction", "solana_sign", "solana_signMessage"],
            events: ["chainChanged", "accountsChanged"],
            chains: ["solana"],
            rpcMap: {},
          },
        },
      });
    }

    this.disconnectWalletConnect();
    const wallet = this.options.find((t) => t.id === id);
    if (!wallet) throw new Error("Wallet not found");

    try {
      this.setStorage({ type: "wallet", id });
      const protocolWallet = await SolanaProtocolWallet.connect(wallet.wallet, { silent: false });
      return this.setWallet(new SolanaWallet(this, protocolWallet));
    } catch (e) {
      this.removeStorage();
      throw e;
    }
  }
}

export default SolanaConnector;

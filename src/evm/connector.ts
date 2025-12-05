import MetaMaskSDK from "@metamask/sdk";
import { runInAction } from "mobx";

import { ConnectorType, OmniConnector, OmniConnectorOptions, WC_ICON } from "../OmniConnector";
import { WalletType } from "../omni/config";
import { isInjected } from "../hot-wallet/hot";
import { HotConnector } from "../HotConnector";
import EvmWallet, { EvmProvider } from "./wallet";

const chains = [1, 10, 56, 137, 8453, 42161, 421613, 80001];

export interface EvmConnectorOptions extends OmniConnectorOptions {
  chains?: number[];
}

class EvmConnector extends OmniConnector<EvmWallet, { provider: EvmProvider }> {
  icon = "https://storage.herewallet.app/upload/06b43b164683c2cbfe9a9c0699f0953fd56f1f802035e7701ea10501d9e091c6.png";
  walletTypes = [WalletType.EVM, WalletType.OMNI];
  type = ConnectorType.WALLET;
  name = "EVM Wallet";
  chains = chains;
  id = "evm";

  MMSDK = new MetaMaskSDK({
    dappMetadata: {
      name: "Wibe3",
      url: window.location.href,
      // iconUrl: "https://mydapp.com/icon.png" // Optional
    },
  });

  constructor(wibe3: HotConnector, readonly settings: EvmConnectorOptions = {}) {
    super(wibe3, settings);

    if (settings.chains) this.chains.push(...settings.chains);

    window.addEventListener<any>("eip6963:announceProvider", async (provider) => {
      if (this.options.find((t) => t.name === provider.detail.info.name || t.id === provider.detail.info.uuid)) return;

      runInAction(() => {
        const info = provider.detail.info;
        const wallet = {
          download: `https://${info.rdns.split(".").reverse().join(".")}`,
          provider: provider.detail.provider,
          type: "extension" as const,
          name: info.name,
          icon: info.icon,
          id: info.rdns,
        };

        if (info.rdns === "org.hot-labs") this.options.unshift(wallet);
        else this.options.push(wallet);
      });

      const connected = await this.getConnectedWallet();
      if (connected.type === "wallet" && connected.id === provider.detail.info.rdns) {
        this.connectWallet(provider.detail.info.rdns, provider.detail.provider);
      }
    });

    window.dispatchEvent(new Event("eip6963:requestProvider"));

    this.initWalletConnect().then((wc) => {
      this.options.unshift({
        id: "walletconnect",
        name: "WalletConnect",
        icon: WC_ICON,
        provider: {} as any,
        type: "external",
      });
    });

    this.wc?.then(async (wc) => {
      const selected = await this.getConnectedWallet();
      if (selected.id !== "walletconnect") return;
      this.setupWalletConnect();
    });
  }

  async setupWalletConnect(): Promise<EvmWallet> {
    const wc = await this.wc;
    if (!wc) {
      this.disconnectWalletConnect();
      throw new Error("WalletConnect not found");
    }

    const address = wc.session?.namespaces.eip155.accounts[0]?.split(":")[2];
    if (!address) {
      this.disconnectWalletConnect();
      throw new Error("Account not found");
    }

    this.setStorage({ type: "walletconnect" });
    return this.setWallet(new EvmWallet(this, address, wc));
  }

  async connectWallet(id: string, provider: EvmProvider) {
    try {
      if (this.wallets.length > 0) this.removeWallet();

      const [address] = await provider.request({ method: "eth_requestAccounts" });
      if (!address) throw "No address found";
      this.setStorage({ type: "wallet", id });

      const handler = async (data: string[]) => {
        provider.off?.("accountsChanged", handler as any);
        if (data.length > 0) this.connectWallet(id, provider);
        else this.disconnect();
      };

      provider.on?.("accountsChanged", handler);
      return this.setWallet(new EvmWallet(this, address, provider));
    } catch (e) {
      this.disconnect();
      throw e;
    }
  }

  async getConnectedWallet() {
    if (isInjected()) return { type: "wallet", id: "org.hot-labs" };
    return await this.getStorage();
  }

  async connect(id: string) {
    if (id === "walletconnect") {
      return await this.connectWalletConnect({
        onConnect: () => this.setupWalletConnect(),
        namespaces: {
          eip155: {
            methods: ["eth_sendTransaction", "eth_signTransaction", "eth_sign", "personal_sign", "eth_signTypedData"],
            chains: chains.map((chain) => `eip155:${chain}`),
            events: ["chainChanged", "accountsChanged"],
            rpcMap: {},
          },
        },
      });
    }

    this.disconnectWalletConnect();
    const wallet = this.options.find((t) => t.id === id);
    if (!wallet) throw new Error("Wallet not found");

    return await this.connectWallet(id, wallet.provider);
  }
}

export default EvmConnector;

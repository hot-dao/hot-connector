import UniversalProvider from "@walletconnect/universal-provider";
import { runInAction } from "mobx";

import { WalletConnectPopup } from "../ui/connect/WCPopup";
import { ConnectorType, OmniConnector } from "../OmniConnector";
import { WalletType } from "../omni/config";
import { isInjected } from "../hot-wallet/hot";
import { HotConnector } from "../HotConnector";
import EvmWallet, { EvmProvider } from "./wallet";

export interface EvmConnectorOptions {
  projectId?: string;
  chains?: number[];
  metadata?: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}

const chains = [1, 10, 56, 137, 8453, 42161, 421613, 80001];

class EvmConnector extends OmniConnector<EvmWallet, { provider: EvmProvider; name: string; icon: string; id: string; download?: string }> {
  name = "EVM Wallet";
  icon = "https://storage.herewallet.app/upload/06b43b164683c2cbfe9a9c0699f0953fd56f1f802035e7701ea10501d9e091c6.png";
  type = ConnectorType.WALLET;
  walletTypes = [WalletType.EVM, WalletType.OMNI];
  id = "evm";

  chains = [1, 10, 56, 137, 8453, 42161, 421613, 80001];
  _walletconnectPopup: WalletConnectPopup | null = null;
  walletConnectProvider?: Promise<UniversalProvider>;

  constructor(wibe3: HotConnector, options: EvmConnectorOptions = {}) {
    super(wibe3);

    if (options.chains) this.chains.push(...options.chains);

    if (options.projectId) {
      this.walletConnectProvider = UniversalProvider.init({
        projectId: options.projectId,
        metadata: options.metadata,
        relayUrl: "wss://relay.walletconnect.org",
      });

      this.walletConnectProvider.then(async (provider) => {
        provider.on("display_uri", (uri: string) => {
          this._walletconnectPopup?.update({ uri });
        });

        const connected = await this.getConnectedWallet();
        if (connected.type === "walletconnect") {
          const address = provider.session?.namespaces.eip155?.accounts?.[0]?.split(":")[2];
          if (address) this.setWallet(new EvmWallet(this, address, provider as unknown as EvmProvider));
        }
      });
    }

    window.addEventListener<any>("eip6963:announceProvider", async (provider) => {
      if (this.options.find((t) => t.name === provider.detail.info.name || t.id === provider.detail.info.uuid)) return;

      runInAction(() => {
        const info = provider.detail.info;
        const wallet = { provider: provider.detail.provider, name: info.name, icon: info.icon, id: info.rdns, download: `https://${info.rdns.split(".").reverse().join(".")}` };
        if (info.rdns === "org.hot-labs") this.options.unshift(wallet);
        else this.options.push(wallet);
      });

      const connected = await this.getConnectedWallet();
      if (connected.type === "wallet" && connected.id === provider.detail.info.rdns) {
        this.connectWallet(provider.detail.info.rdns, provider.detail.provider);
      }
    });

    window.dispatchEvent(new Event("eip6963:requestProvider"));
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

  async connectWalletConnect() {
    this._walletconnectPopup = new WalletConnectPopup({
      uri: "LOADING",
      onReject: async () => {
        const provider = await this.walletConnectProvider;
        provider?.cleanupPendingPairings();
        this._walletconnectPopup?.destroy();
        this._walletconnectPopup = null;
      },
    });

    this._walletconnectPopup.create();
    const provider = await this.walletConnectProvider;
    if (!provider) throw new Error("No provider found");

    const session = await provider
      ?.connect({
        namespaces: {
          eip155: {
            methods: ["eth_sendTransaction", "eth_signTransaction", "eth_sign", "personal_sign", "eth_signTypedData"],
            chains: chains.map((chain) => `eip155:${chain}`),
            events: ["chainChanged", "accountsChanged"],
            rpcMap: {},
          },
        },
      })
      .catch(() => null);

    this._walletconnectPopup?.destroy();
    this._walletconnectPopup = null;

    const address = session?.namespaces.eip155?.accounts?.[0]?.split(":")[2];
    if (!address) throw new Error("No address found");

    this.setWallet(new EvmWallet(this, address, provider as unknown as EvmProvider));
    this.setStorage({ type: "walletconnect" });
  }

  async connect(id: string) {
    const walletConnectProvider = await this.walletConnectProvider;
    if (walletConnectProvider?.session) await walletConnectProvider.disconnect();

    walletConnectProvider?.cleanupPendingPairings();
    const wallet = this.options.find((t) => t.id === id);
    if (!wallet) throw new Error("Wallet not found");

    return await this.connectWallet(id, wallet.provider);
  }

  async disconnect() {
    super.disconnect();
    const provider = await this.walletConnectProvider;
    provider?.disconnect().catch(() => {});
  }
}

export default EvmConnector;

import { Keplr } from "@keplr-wallet/provider-extension";
import { hex } from "@scure/base";

import { ConnectorType, OmniConnector } from "../omni/OmniConnector";
import CosmosWallet from "./wallet";

export default class CosmosConnector extends OmniConnector<CosmosWallet> {
  type = ConnectorType.WALLET;
  name = "Cosmos Wallet";
  icon = "https://legacy.cosmos.network/presskit/cosmos-brandmark-dynamic-dark.svg";
  id = "cosmos";
  isSupported = true;

  chains = ["cosmoshub-4", "gonka-mainnet", "juno-1"];

  constructor() {
    super();

    this.options = [{ name: "Keplr", icon: this.icon, id: "keplr" }];
    this.getStorage().then(({ type, address, publicKey }) => {
      if (!address || !publicKey) return;
      if (type === "keplr") this.setKeplrWallet(address, publicKey);
    });
  }

  async setKeplrWallet(address: string, publicKey: string): Promise<void> {
    const keplr = await Keplr.getKeplr();
    if (!keplr) throw new Error("Keplr not found");

    this.setWallet(
      new CosmosWallet(this, {
        address: address,
        publicKey: publicKey,
        disconnect: () => keplr.disable(),
        sendTransaction: async (chain: string, signDoc: any) => {
          await keplr.enable(this.chains);
          const signOptions = { preferNoSetFee: true };
          const result = await keplr.signDirect(chain, address, signDoc, signOptions);
          return result.signature.signature;
        },
      })
    );
  }

  async connect() {
    const keplr = await Keplr.getKeplr();
    if (!keplr) throw new Error("Keplr not found");

    await keplr.enable(this.chains);
    const account = await keplr.getKey(this.chains[0]);

    await this.setStorage({ type: "keplr", address: account.bech32Address, publicKey: hex.encode(account.pubKey) });
    this.setKeplrWallet(account.bech32Address, hex.encode(account.pubKey));
  }

  async silentDisconnect(): Promise<void> {
    this.removeStorage();
  }

  connectWebWallet(address: string, publicKey?: string): void {
    throw new Error("Method not implemented.");
  }
}

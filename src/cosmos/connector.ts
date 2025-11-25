import { Keplr } from "@keplr-wallet/provider-extension";
import { TxRaw } from "@keplr-wallet/proto-types/cosmos/tx/v1beta1/tx";
import { StargateClient } from "@cosmjs/stargate";
import { hex } from "@scure/base";

import { ConnectorType, OmniConnector } from "../omni/OmniConnector";
import CosmosWallet from "./wallet";

export interface CosmosConnectorOptions {
  rpcs: Record<string, string>;
  chains: string[];
}

export default class CosmosConnector extends OmniConnector<CosmosWallet> {
  type = ConnectorType.WALLET;
  name = "Cosmos Wallet";
  icon = "https://legacy.cosmos.network/presskit/cosmos-brandmark-dynamic-dark.svg";
  id = "cosmos";
  isSupported = true;

  chains: string[];
  rpcs: Record<string, string>;

  constructor(options?: CosmosConnectorOptions) {
    super();

    this.rpcs = options?.rpcs || { "juno-1": "https://juno-rpc.publicnode.com" };
    this.chains = options?.chains || ["cosmoshub-4", "gonka-mainnet", "juno-1"];
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
        sendTransaction: async (signDoc: any, opts = { preferNoSetFee: true }) => {
          await keplr.enable(this.chains);

          const account = await keplr.getKey(signDoc.chainId);
          const protoSignResponse = await keplr.signDirect(signDoc.chainId, account.bech32Address, signDoc, opts);
          const client = await StargateClient.connect(this.rpcs[signDoc.chainId]);

          // Build a TxRaw and serialize it for broadcasting
          const protobufTx = TxRaw.encode({
            bodyBytes: protoSignResponse.signed.bodyBytes,
            authInfoBytes: protoSignResponse.signed.authInfoBytes,
            signatures: [Buffer.from(protoSignResponse.signature.signature, "base64")],
          }).finish();

          const result = await client.broadcastTx(protobufTx);
          if (result.code !== 0) throw "Transaction failed";
          return result.transactionHash;
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

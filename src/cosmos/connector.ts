import { Keplr } from "@keplr-wallet/provider-extension";
import { TxRaw } from "@keplr-wallet/proto-types/cosmos/tx/v1beta1/tx";
import { StargateClient } from "@cosmjs/stargate";
import { hex } from "@scure/base";

import { WalletType } from "../omni/config";
import { HotConnector } from "../HotConnector";
import { ConnectorType, OmniConnector, OmniConnectorOptions, WC_ICON } from "../OmniConnector";
import CosmosWallet from "./wallet";

export interface CosmosConnectorOptions extends OmniConnectorOptions {
  cosmosChains?: Record<string, { chain: string; rpc: string; denom: string; prefix: string }>;
}

export default class CosmosConnector extends OmniConnector<CosmosWallet> {
  cosmosChains: Record<string, { chain: string; rpc: string; denom: string; prefix: string }>;

  type = ConnectorType.WALLET;
  walletTypes = [WalletType.COSMOS];
  icon = "https://legacy.cosmos.network/presskit/cosmos-brandmark-dynamic-dark.svg";
  name = "Cosmos Wallet";
  isSupported = true;
  id = "cosmos";

  constructor(wibe3: HotConnector, options?: CosmosConnectorOptions) {
    super(wibe3, options);

    this.options = [
      {
        name: "keplr" in window ? "Keplr" : "Keplr Wallet",
        download: "https://www.keplr.app/get",
        icon: "https://cdn.prod.website-files.com/667dc891bc7b863b5397495b/68a4ca95f93a9ab64dc67ab4_keplr-symbol.svg",
        type: "keplr" in window ? "extension" : "external",
        id: "keplr",
      },
    ];

    this.cosmosChains = {
      "juno-1": { chain: "juno-1", rpc: "https://juno-rpc.publicnode.com", denom: "ujuno", prefix: "juno" },
      "gonka-mainnet": { chain: "gonka-mainnet", rpc: "https://dev.herewallet.app/api/v1/evm/rpc/4444119", denom: "ngonka", prefix: "gonka" },
      "cosmoshub-4": { chain: "cosmoshub-4", rpc: "https://rpc.cosmoshub.certus.one", denom: "uatom", prefix: "cosmos" },
      ...options?.cosmosChains,
    };

    this.getStorage().then(({ type, address, publicKey }) => {
      if (!address || !publicKey) return;
      if (type === "keplr") this.setKeplrWallet(address, publicKey);
    });

    this.initWalletConnect().then(async (wc) => {
      this.options.unshift({
        download: "https://www.walletconnect.com/get",
        name: "WalletConnect",
        id: "walletconnect",
        type: "external",
        icon: WC_ICON,
      });

      const selected = await this.getStorage();
      if (selected.type !== "walletconnect") return;
      this.setupWalletConnect();
    });
  }

  getConfig(chain: string) {
    return this.cosmosChains[chain];
  }

  async setupWalletConnect(): Promise<CosmosWallet> {
    const wc = await this.wc;
    if (!wc) throw new Error("WalletConnect not found");

    const address = wc.session?.namespaces.cosmos.accounts[0]?.split(":")[2];
    if (!address) throw new Error("Account not found");

    const properties = JSON.parse(wc.session?.sessionProperties?.keys || "{}");
    if (!properties.length) throw new Error("Public key not found");

    const publicKey = Buffer.from(properties[0].pubKey, "base64").toString("hex");
    if (!publicKey) throw new Error("Public key not found");

    this.setStorage({ type: "walletconnect" });
    return this.setWallet(
      new CosmosWallet(this, {
        address: address,
        publicKeyHex: publicKey,
        disconnect: () => this.disconnectWalletConnect(),
        sendTransaction: async (signDoc: any) => {
          const chain = `cosmos:${signDoc.chainId}`;
          const account = await wc.request<any[]>({ method: "cosmos_getAccounts", params: {} }, chain);
          if (!account.length) throw new Error("Account not found");

          const payload = {
            method: "cosmos_signDirect",
            params: {
              signerAddress: account[0].address,
              signDoc: {
                chainId: signDoc.chainId,
                accountNumber: signDoc.accountNumber?.toString(),
                bodyBytes: signDoc.bodyBytes ? Buffer.from(signDoc.bodyBytes).toString("base64") : null,
                authInfoBytes: signDoc.authInfoBytes ? Buffer.from(signDoc.authInfoBytes).toString("base64") : null,
              },
            },
          };

          const { signed, signature } = await wc.request<{ signed: any; signature: any }>(payload, chain);
          const client = await StargateClient.connect(this.getConfig(signDoc.chainId)?.rpc || "");
          const protobufTx = TxRaw.encode({
            bodyBytes: signed.bodyBytes,
            authInfoBytes: signed.authInfoBytes,
            signatures: [Buffer.from(signature.signature, "base64")],
          }).finish();

          const result = await client.broadcastTx(protobufTx);
          if (result.code !== 0) throw "Transaction failed";
          return result.transactionHash;
        },
      })
    );
  }

  async setKeplrWallet(address: string, publicKey: string) {
    const keplr = await Keplr.getKeplr();
    if (!keplr) throw new Error("Keplr not found");

    return this.setWallet(
      new CosmosWallet(this, {
        address: address,
        publicKeyHex: publicKey,
        disconnect: () => keplr.disable(),
        sendTransaction: async (signDoc: any, opts = { preferNoSetFee: true }) => {
          await keplr.enable(Object.keys(this.cosmosChains));

          const account = await keplr.getKey(signDoc.chainId);
          const protoSignResponse = await keplr.signDirect(signDoc.chainId, account.bech32Address, signDoc, opts);
          const client = await StargateClient.connect(this.getConfig(signDoc.chainId)?.rpc || "");

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

  async connect(id: string) {
    if (id === "walletconnect") {
      return await this.connectWalletConnect({
        onConnect: () => this.setupWalletConnect(),
        namespaces: {
          cosmos: {
            methods: ["cosmos_getAccounts", "cosmos_signDirect"],
            events: ["chainChanged", "accountsChanged"],
            chains: ["cosmos:cosmoshub-4", "cosmos:juno-1", "cosmos:gonka-mainnet"],
            rpcMap: {},
          },
        },
      });
    }

    const keplr = await Keplr.getKeplr();
    if (!keplr) {
      return await this.connectWalletConnect({
        onConnect: () => this.setupWalletConnect(),
        deeplink: `keplrwallet://wcV2?`,
        namespaces: {
          cosmos: {
            methods: ["cosmos_getAccounts", "cosmos_signDirect"],
            events: ["chainChanged", "accountsChanged"],
            chains: ["cosmos:cosmoshub-4", "cosmos:juno-1", "cosmos:gonka-mainnet"],
            rpcMap: {},
          },
        },
      });
    }

    await keplr.experimentalSuggestChain({
      bech32Config: { bech32PrefixAccAddr: "gonka", bech32PrefixAccPub: "gonka", bech32PrefixValAddr: "gonka", bech32PrefixValPub: "gonka", bech32PrefixConsAddr: "gonka", bech32PrefixConsPub: "gonka" },
      feeCurrencies: [{ coinDenom: "GNK", coinMinimalDenom: "ngonka", coinDecimals: 9, coinGeckoId: "gonka", gasPriceStep: { low: 0, average: 0, high: 0 } }],
      stakeCurrency: { coinDenom: "GNK", coinMinimalDenom: "ngonka", coinDecimals: 9, coinGeckoId: "gonka" },
      currencies: [{ coinDenom: "GNK", coinMinimalDenom: "ngonka", coinDecimals: 9, coinGeckoId: "gonka" }],
      rpc: "https://gonka04.6block.com:8443/chain-rpc",
      rest: "https://gonka04.6block.com:8443/chain-api",
      bip44: { coinType: 1200 },
      chainId: "gonka-mainnet",
      chainName: "Gonka",
    });

    await keplr.enable(Object.keys(this.cosmosChains));
    const account = await keplr.getKey("gonka-mainnet");

    await this.setStorage({ type: "keplr", address: account.bech32Address, publicKey: hex.encode(account.pubKey) });
    return this.setKeplrWallet(account.bech32Address, hex.encode(account.pubKey));
  }
}

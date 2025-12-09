import { HotBridge, Network, ReviewFee } from "@hot-labs/omni-sdk";
import { Intents } from "./Intents";

export { ReviewFee };

export const bridge = new HotBridge({
  api: ["https://dev.herewallet.app"],
  solanaRpc: ["https://api0.herewallet.app/api/v1/solana/rpc/1001"],
  mpcApi: ["https://apt-hebdomadally-ariana.ngrok-free.dev"],

  publishIntents: async (signed: Record<string, any>[], hashes: string[] = []) => {
    const hash = await Intents.publishSignedIntents(signed, hashes);
    return { sender: "intents.near", hash };
  },

  evmRpc: {
    [Network.ADI]: ["https://dev.herewallet.app/api/v1/evm/rpc/36900"],
  },

  logger: console,
  cosmos: {
    [Network.Juno]: {
      contract: "juno1va9q7gma6l62aqq988gghv4r7u4hnlgm85ssmsdf9ypw77qfwa0qaz7ea4",
      rpc: "https://juno-rpc.publicnode.com",
      gasLimit: 200000n,
      nativeToken: "ujuno",
      chainId: "juno-1",
      prefix: "juno",
    },
    [Network.Gonka]: {
      contract: "gonka15wng2302rhq5w8ddy3l3jslrhfcpufzfs6wc3zc6cxt8cpwrfp4qqgenkc",
      rpc: "https://dev.herewallet.app/api/v1/evm/rpc/4444119",
      gasLimit: 200000n,
      nativeToken: "ngonka",
      chainId: "gonka-mainnet",
      prefix: "gonka",
    },
  },
});

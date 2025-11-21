import { AbstractProvider, ethers, FeeData, JsonRpcProvider, Network, parseUnits, PerformActionRequest, TransactionRequest } from "ethers";

import { Chains } from "../omni/chains";
import { GlobalSettings } from "../settings";

const methods = new Set([
  "getBlock",
  "getBlockNumber",
  "getCode",
  "getGasPrice",
  "getLogs",
  "getPriorityFee",
  "getStorage",
  "getTransaction",
  "getTransactionCount",
  "getTransactionReceipt",
  "getTransactionResult",
]);

const validErrors = new Set([
  "BUFFER_OVERRUN",
  "NUMERIC_FAULT",
  "INVALID_ARGUMENT",
  "MISSING_ARGUMENT",
  "UNEXPECTED_ARGUMENT",
  "CALL_EXCEPTION",
  "INSUFFICIENT_FUNDS",
  "NONCE_EXPIRED",
  "OFFCHAIN_FAULT",
  "REPLACEMENT_UNDERPRICED",
  "TRANSACTION_REPLACED",
  "UNCONFIGURED_NAME",
  "ACTION_REJECTED",
]);

const paidMethods = new Set([
  "getTransactionReceipt", //
  "broadcastTransaction",
  "estimateGas",
  "getBlockNumber",
  "getBlock",
  "getGasPrice",
  "getPriorityFee",
]);

export class FeeDataWithOptions extends FeeData {
  constructor(readonly chain: number, readonly feeDatas: FeeData[]) {
    super(feeDatas[0].gasPrice, feeDatas[0].maxFeePerGas, feeDatas[0].maxPriorityFeePerGas);
  }
}

class Provider extends AbstractProvider {
  constructor(readonly chain: number, readonly address?: string, readonly nonPaid = false) {
    super(chain);
  }

  async getNetwork(): Promise<Network> {
    return Network.from(this.chain);
  }

  private shuffle<T>(array: T[]): T[] {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  async send(method: string, params: any[]) {
    let lastError: any;
    const rpcList = this.getPriorityProviders(this.chain);
    rpcList.push(...this.shuffle(this.getPublicProviders(this.chain)));

    for (const rpc of rpcList) {
      try {
        return await rpc.send(method, params);
      } catch (error: any) {
        if (validErrors.has(error.code || "")) throw error;
        lastError = error;
      }
    }

    throw lastError;
  }

  estimateGas(_tx: TransactionRequest): Promise<bigint> {
    if (_tx.from == null) _tx.from = this.address;
    return super.estimateGas(_tx);
  }

  async getBlocknativeFee(endpoint = `https://api.blocknative.com/gasprices/blockprices?chainid=${this.chain}`) {
    const t = await fetch(endpoint).then((res) => res.json());

    const extraFee = Chains.extraFee[this.chain];
    const multiplierPriority = extraFee?.priorityFeeMultiplier ?? 100;
    const multiplierBase = extraFee?.baseFeeMultiplier ?? 100;
    const multiplierGasPrice = extraFee?.gasPriceMultiplier ?? 100;

    const baseFee = (BigInt(parseUnits(t.blockPrices[0].baseFeePerGas.toFixed(9), t.unit)) * BigInt(multiplierBase)) / 100n;

    const options = t.blockPrices[0].estimatedPrices.map((price: any) => {
      if (price.maxPriorityFeePerGas != null) {
        const maxPriorityFeePerGas = (BigInt(parseUnits(price.maxPriorityFeePerGas.toFixed(9), t.unit)) * BigInt(multiplierPriority)) / 100n;
        return new FeeData(null, baseFee + maxPriorityFeePerGas, maxPriorityFeePerGas);
      }

      const gasPrice = BigInt(parseUnits(price.price.toFixed(9), t.unit));
      return new FeeData((gasPrice * BigInt(multiplierGasPrice)) / 100n);
    });

    return new FeeDataWithOptions(this.chain, options.slice(0, 3).reverse());
  }

  async getFeeData(): Promise<FeeDataWithOptions> {
    const extraFee = Chains.extraFee[this.chain];
    if (extraFee != null && (extraFee.baseFeeConstant != null || extraFee.priorityFeeConstant != null || extraFee.gasPriceConstant != null)) {
      const baseFee = extraFee.baseFeeConstant ? BigInt(extraFee.baseFeeConstant) : null;
      const priorityFee = extraFee.priorityFeeConstant ? BigInt(extraFee.priorityFeeConstant) : null;
      const gasPrice = extraFee.gasPriceConstant ? BigInt(extraFee.gasPriceConstant) : null;
      const fee = new FeeData(gasPrice, (baseFee ?? 0n) + (priorityFee ?? 0n), priorityFee ?? 0n);
      return new FeeDataWithOptions(this.chain, [fee]);
    }

    try {
      return await this.getBlocknativeFee();
    } catch {
      try {
        return await this.getBlocknativeFee(`https://api0.herewallet.app/api/v1/evm/blocknative/gasprices?chain_id=${this.chain}`);
      } catch {
        const fee = await super.getFeeData();
        return new FeeDataWithOptions(this.chain, [fee]);
      }
    }
  }

  createEvmProvider = (chain: number, rpc: string, maxBatchCount?: number) => {
    const rpcBatchCount = { blockpi: 5, drpc: 3, ankr: 1, meowrpc: 1 };
    const r = new ethers.FetchRequest(rpc);
    r.retryFunc = async () => false;
    r.timeout = 30_000;

    return new ethers.JsonRpcProvider(r, chain, {
      batchMaxCount: maxBatchCount || Object.entries(rpcBatchCount).find(([match]) => rpc.includes(match))?.[1] || 10,
      batchStallTime: 500,
      staticNetwork: true,
    });
  };

  private _providers: Record<number, ethers.JsonRpcProvider[]> = {};
  getPublicProviders = (chain: number) => {
    if (this._providers[chain]) return this._providers[chain];

    const n = Chains.get(chain);
    this._providers[chain] = n.rpc
      .map((rpc) => this.createEvmProvider(chain, rpc)) //
      .sort((a, b) => (b._getOption("batchMaxCount") as number) - (a._getOption("batchMaxCount") as number));

    return [...(this._providers[chain] || [])];
  };

  private getPriorityProviders = (chain: number) => {
    return (GlobalSettings.rpcs[chain] || []).map((t) => {
      return new JsonRpcProvider(t, chain, { staticNetwork: true });
    });
  };

  getProviders(req: PerformActionRequest) {
    const rpcList = this.getPriorityProviders(this.chain);

    if (paidMethods.has(req.method) && !this.nonPaid) {
      const endpoint = "https://api0.herewallet.app";
      const submitterRpc = `${endpoint}/api/v1/evm/rpc/${this.chain}`;
      const provider = new JsonRpcProvider(submitterRpc, this.chain, { staticNetwork: true });
      rpcList.push(provider);
    }

    rpcList.push(...this.shuffle(this.getPublicProviders(this.chain)));
    return rpcList;
  }

  async _perform<T = any>(req: PerformActionRequest): Promise<T> {
    let lastError: any;
    let currentProviderIndex = -1;

    if (req.method === "chainId") {
      return this.chain as T;
    }

    const rpcList = this.getProviders(req);
    for (const rpc of rpcList) {
      currentProviderIndex += 1;
      if (methods.has(req.method)) {
        const result = await rpc._perform(req).catch(() => null);
        if (result == null && rpcList[currentProviderIndex + 1] != null) continue;
        return result;
      }

      try {
        const result = await rpc._perform(req);
        return result;
      } catch (error: any) {
        if (validErrors.has(error.code || "")) throw error;
        lastError = error;
      }
    }

    throw lastError;
  }
}

export default Provider;

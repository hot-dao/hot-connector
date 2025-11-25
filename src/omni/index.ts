import { GetExecutionStatusResponse, OneClickService, OpenAPI, QuoteRequest, QuoteResponse } from "@defuse-protocol/one-click-sdk-typescript";
import { Asset, Networks } from "@stellar/stellar-sdk";
import { HotBridge, utils } from "@hot-labs/omni-sdk";
import { makeObservable, observable } from "mobx";

import CosmosWallet from "../cosmos/wallet";
import { defaultTokens } from "./list";
import { OmniWallet } from "./OmniWallet";
import { Network } from "./chains";
import { ReviewFee } from "./fee";
import { Token } from "./token";

OpenAPI.BASE = "https://1click.chaindefuser.com";
OpenAPI.TOKEN = "";

export const bridge = new HotBridge({
  api: ["https://dev.herewallet.app"],
  solanaRpc: ["https://api0.herewallet.app/api/v1/solana/rpc/1001"],
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
  },
});

export class UnsupportedDexError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class ReadableDexError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type BridgeReview = {
  from: Token;
  to: Token;
  amountIn: bigint;
  amountOut: bigint;
  slippage: number;
  receiver: string;
  fee: ReviewFee;
  qoute: QuoteResponse["quote"];
  status: "pending" | "success" | "failed";
  statusMessage: string | null;
};

class Omni {
  public tokens = defaultTokens.map((t: any) => new Token(t));

  constructor() {
    makeObservable(this, {
      tokens: observable,
    });
  }

  token(chain: number, address: string): Token | null {
    return this.tokens.find((t) => t.chain === chain && t.address === address) ?? null;
  }

  bySymbol(token: string, chain?: number): Token {
    return this.tokens.find((t) => t.symbol === token && (chain == null || t.chain === chain))!;
  }

  juno(chain?: number): Token {
    return this.bySymbol("JUNO", chain);
  }

  usdt(chain?: number): Token {
    return this.bySymbol("USDT", chain);
  }

  usdc(chain?: number): Token {
    return this.bySymbol("USDC", chain);
  }

  eth(chain?: number): Token {
    return this.bySymbol("ETH", chain);
  }

  near(chain?: number): Token {
    return this.bySymbol("BTC", chain);
  }

  sol(chain?: number): Token {
    return this.bySymbol("SOL", chain);
  }

  async getToken(chain: number, address: string): Promise<string | null> {
    if (chain === Network.Hot) return address;
    const tokens = await this.getTokens();

    const token = tokens.find((t) => {
      if (t.chain !== chain) return false;

      if (chain === Network.Stellar) {
        const issued = t.address === "native" ? Asset.native() : new Asset(t.symbol, t.address);
        return issued.contractId(Networks.PUBLIC) === address;
      }

      if (t.address?.toLowerCase() === address.toLowerCase()) return true;
      if (address === "native" && t.address == "native") return true;
      if (address === "native" && t.address == "wrap.near") return true;
      return false;
    });

    return token?.omniAddress || null;
  }

  async deposit(args: { sender: OmniWallet; token: Token; amount: bigint; receiver: string; onMessage: (message: string) => void }) {
    const { sender, token, amount, receiver, onMessage } = args;
    onMessage("Sending deposit transaction");

    if (utils.isCosmos(token.chain) && sender instanceof CosmosWallet) {
      const cosmosBridge = await bridge.cosmos();
      const hash = await cosmosBridge.deposit({
        sendTransaction: async (tx: any) => sender.sendTransaction(tx),
        senderPublicKey: sender.publicKey!,
        intentAccount: receiver,
        sender: sender.address,
        token: token.address,
        chain: token.chain,
        amount: amount,
      });

      onMessage("Waiting for deposit");
      const deposit = await bridge.waitPendingDeposit(token.chain, hash, receiver);
      onMessage("Finishing deposit");
      await bridge.finishDeposit(deposit);
      onMessage("Deposit finished");
    }
  }

  async withdraw(args: { sender: OmniWallet; relayer?: OmniWallet; token: Token; amount: bigint; receiver: string; onMessage: (message: string) => void }) {
    const { relayer, sender, token, amount, receiver, onMessage } = args;

    onMessage("Signing withdrawal");
    const result = await bridge.withdrawToken({
      signIntents: async (intents: any) => sender.signIntents(intents),
      intentAccount: sender.omniAddress,
      receiver: receiver,
      token: token.address,
      chain: token.chain,
      gasless: false,
      amount: amount,
    });

    if (result?.nonce) {
      onMessage("Waiting for withdrawal");
      const pending = await bridge.getPendingWithdrawal(result.nonce);

      if (utils.isCosmos(pending.chain)) {
        if (!(relayer instanceof CosmosWallet)) throw new Error("Relayer must be a Cosmos wallet");
        const cosmosBridge = await bridge.cosmos();
        onMessage("Sending withdrawal transaction");
        await cosmosBridge.withdraw({
          sendTransaction: async (tx: any) => relayer.sendTransaction(tx),
          sender: relayer.address,
          ...pending,
        });
      }
    }
  }

  async getTokens(): Promise<Token[]> {
    if (this.tokens.length > 0) return this.tokens;
    const list = await OneClickService.getTokens();
    this.tokens = list.map((t) => new Token(t));
    return this.tokens;
  }

  async reviewSwap(request: { sender: OmniWallet; from: Token; to: Token; amount: bigint; receiver: string; slippage: number; type?: "exactIn" | "exactOut" }): Promise<BridgeReview> {
    const intentFrom = await this.getToken(request.from.chain, request.from.address);
    const intentTo = await this.getToken(request.to.chain, request.to.address);

    if (!intentFrom) throw new Error("Unsupported token");
    if (!intentTo) throw new Error("Unsupported token");

    const deadlineTime = 20 * 60 * 1000;
    const deadline = new Date(Date.now() + deadlineTime).toISOString();

    const noFee = request.from.symbol === request.to.symbol;

    const qoute = await OneClickService.getQuote({
      originAsset: intentFrom,
      destinationAsset: intentTo,
      slippageTolerance: Math.round(request.slippage * 10_000),
      swapType: request.type === "exactIn" ? QuoteRequest.swapType.EXACT_INPUT : QuoteRequest.swapType.EXACT_OUTPUT,
      depositType: request.from.chain === Network.Hot ? QuoteRequest.depositType.INTENTS : QuoteRequest.depositType.ORIGIN_CHAIN,
      depositMode: request.from.chain === Network.Stellar ? QuoteRequest.depositMode.MEMO : QuoteRequest.depositMode.SIMPLE,
      recipientType: request.to.chain === Network.Hot ? QuoteRequest.recipientType.INTENTS : QuoteRequest.recipientType.DESTINATION_CHAIN,
      refundType: QuoteRequest.refundType.ORIGIN_CHAIN, // : QuoteRequest.refundType.INTENTS,
      refundTo: request.sender.address,
      appFees: noFee ? [] : [{ recipient: "intents.tg", fee: 25 }],
      amount: request.amount.toString(),
      referral: "intents.tg",
      recipient: request.receiver,
      deadline: deadline,
      dry: false,
    });

    let fee = new ReviewFee({ baseFee: 0n, gasLimit: 0n, chain: -4 });
    if (request.from.chain !== Network.Hot) {
      const amount = BigInt(qoute.quote.amountIn);
      const depositAddress = qoute.quote.depositAddress!;
      fee = await request.sender.transferFee(request.from, depositAddress, amount);
    }

    return {
      from: request.from,
      to: request.to,
      amountIn: BigInt(qoute.quote.amountIn),
      amountOut: BigInt(qoute.quote.amountOut),
      slippage: request.slippage,
      receiver: request.receiver,
      statusMessage: null,
      qoute: qoute.quote,
      status: "pending",
      fee: fee,
    };
  }

  async makeSwap(sender: OmniWallet, review: BridgeReview, pending: { log: (message: string) => void }) {
    const depositAddress = review.qoute.depositAddress!;
    const hash = await sender.transfer({
      receiver: depositAddress,
      amount: review.amountIn,
      comment: review.qoute.depositMemo,
      token: review.from,
      gasFee: review.fee,
    });

    pending.log("Submitting tx");
    await OneClickService.submitDepositTx({ txHash: hash, depositAddress }).catch(() => {});

    pending.log("Checking status");
    return await this.processing(review);
  }

  getMessage(status: GetExecutionStatusResponse.status): string | null {
    if (status === GetExecutionStatusResponse.status.PENDING_DEPOSIT) return "Waiting for deposit";
    if (status === GetExecutionStatusResponse.status.INCOMPLETE_DEPOSIT) return "Incomplete deposit";
    if (status === GetExecutionStatusResponse.status.KNOWN_DEPOSIT_TX) return "Known deposit tx";
    if (status === GetExecutionStatusResponse.status.PROCESSING) return "Processing swap";
    if (status === GetExecutionStatusResponse.status.SUCCESS) return "Swap successful";
    if (status === GetExecutionStatusResponse.status.FAILED) return "Swap failed";
    if (status === GetExecutionStatusResponse.status.REFUNDED) return "Swap refunded";
    return null;
  }

  async checkStatus(review: BridgeReview) {
    const status = await OneClickService.getExecutionStatus(review.qoute.depositAddress!, review.qoute.depositMemo);
    const message = this.getMessage(status.status);

    let state: "pending" | "success" | "failed" = "pending";
    if (status.status === GetExecutionStatusResponse.status.SUCCESS) state = "success";
    if (status.status === GetExecutionStatusResponse.status.FAILED) state = "failed";
    if (status.status === GetExecutionStatusResponse.status.REFUNDED) state = "failed";

    if (status.swapDetails.amountOut) review.amountOut = BigInt(status.swapDetails.amountOut);
    review.statusMessage = message;
    review.status = state;
    return review;
  }

  async processing(review: BridgeReview, interval = 3000) {
    while (true) {
      await this.checkStatus(review);
      if (review.statusMessage) console.log(review.statusMessage);
      if (review.status === "success") return review;
      if (review.status === "failed") throw review.statusMessage || "Bridge failed";
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}

export const omni = new Omni();

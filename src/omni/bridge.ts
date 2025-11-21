import { GetExecutionStatusResponse, OneClickService, OpenAPI, QuoteRequest, QuoteResponse } from "@defuse-protocol/one-click-sdk-typescript";
import { Asset, Networks } from "@stellar/stellar-sdk";
import { ReviewFee } from "@hot-labs/omni-sdk";

import { Network } from "./chains";
import { Token } from "./token";
import { OmniWallet } from "./OmniWallet";

OpenAPI.BASE = "https://1click.chaindefuser.com";
OpenAPI.TOKEN = "";

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

class OneClick {
  private _tokens: Token[] = [];

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

  async getTokens(): Promise<Token[]> {
    if (this._tokens.length > 0) return this._tokens;
    const list = await OneClickService.getTokens();
    return list.map((t) => new Token(t));
  }

  async reviewSwap(request: {
    sender: OmniWallet;
    from: Token;
    to: Token;
    amount: bigint;
    receiver: string;
    slippage: number;
    type?: "exactIn" | "exactOut";
  }): Promise<BridgeReview> {
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

export const bridge = new OneClick();

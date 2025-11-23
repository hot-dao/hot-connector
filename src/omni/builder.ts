import { TGAS } from "./fee";
import { Intents } from "./Intents";
import { OmniWallet } from "./OmniWallet";
import { Token } from "./token";

export interface TransferIntent {
  intent: "transfer";
  tokens: Record<string, string>;
  receiver_id: string;
}

export interface TokenDiffIntent {
  intent: "token_diff";
  token_diff: Record<string, string>;
}

export interface AuthCallIntent {
  min_gas: string;
  attached_deposit: string;
  contract_id: string;
  msg: string;
  intent: "auth_call";
}

class IntentsBuilder {
  hashes: string[] = [];
  intents: (TransferIntent | TokenDiffIntent | AuthCallIntent)[] = [];
  nonce?: Uint8Array;
  deadline?: Date;
  signer?: OmniWallet;

  authCall(args: { contractId: string; msg: string; attachNear: bigint; tgas: number }) {
    this.intents.push({
      intent: "auth_call",
      min_gas: (BigInt(args.tgas) * TGAS).toString(),
      attached_deposit: args.attachNear.toString(),
      contract_id: args.contractId,
      msg: args.msg,
    });

    return this;
  }

  transfer(args: { recipient: string; token: Token; amount: number | bigint }) {
    const amount = (typeof args.amount === "number" ? args.token.int(args.amount) : args.amount).toString();
    const intent: TransferIntent = {
      tokens: { [args.token.omniAddress]: amount },
      receiver_id: args.recipient.toLowerCase(),
      intent: "transfer",
    };

    this.intents.push(intent);
    return this;
  }

  tokenDiff(args: { from: Token; to: Token; fromAmount: number | bigint; toAmount: number | bigint }) {
    const fromAmount = (typeof args.fromAmount === "number" ? args.from.int(args.fromAmount) : args.fromAmount).toString();
    const toAmount = (typeof args.toAmount === "number" ? args.to.int(args.toAmount) : args.toAmount).toString();

    const intent: TokenDiffIntent = {
      token_diff: { [args.from.omniAddress]: fromAmount, [args.to.omniAddress]: toAmount },
      intent: "token_diff",
    };

    this.intents.push(intent);
    return this;
  }

  attachHashes(hashes: string[]) {
    this.hashes.push(...hashes);
    return this;
  }

  attachWallet(wallet: OmniWallet) {
    this.signer = wallet;
    return this;
  }

  attachDeadline(deadline: Date) {
    this.deadline = deadline;
    return this;
  }

  attachNonce(nonce: Uint8Array) {
    this.nonce = nonce;
    return this;
  }

  async execute() {
    if (!this.signer) throw new Error("No signer attached");
    const signed = await this.signer.signIntents(this.intents, { nonce: this.nonce, deadline: this.deadline ? +this.deadline : undefined });
    return await Intents.publishSignedIntents([signed], this.hashes);
  }
}

export default IntentsBuilder;

import { base58, base64, hex } from "@scure/base";
import { sign as signSecp256k1, getPublicKey as getPublicKeySecp256k1 } from "@noble/secp256k1";
import { sha512 } from "@noble/hashes/sha2.js";
import * as ed from "@noble/ed25519";
import crypto from "crypto";

ed.utils.sha512Sync = sha512;

import { Commitment } from "./types";
import { WalletType } from "./chains";
import { OmniWallet } from "../OmniWallet";
import { ReviewFee } from "@hot-labs/omni-sdk";
import { Token } from "./token";

export class Secp256k1Wallet extends OmniWallet {
  readonly address: string;
  readonly publicKey: string;
  readonly omniAddress: string;

  readonly type = WalletType.EVM;
  readonly icon = "";

  constructor(readonly privateKey: Buffer) {
    super();
    this.publicKey = hex.encode(Buffer.from(getPublicKeySecp256k1(privateKey)));
    this.omniAddress = this.publicKey.toLowerCase();
    this.address = this.omniAddress;
  }

  transferFee(token: Token, receiver: string, amount: bigint): Promise<ReviewFee> {
    throw new Error("Method not implemented.");
  }
  transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string> {
    throw new Error("Method not implemented.");
  }
  fetchBalance(chain: number, address: string): Promise<bigint> {
    throw new Error("Method not implemented.");
  }
  fetchBalances(chain?: number, whitelist?: string[]): Promise<Record<string, bigint>> {
    throw new Error("Method not implemented.");
  }

  async signIntents(intents: Record<string, any>[], options?: { deadline?: number; nonce?: Uint8Array }): Promise<Commitment> {
    const nonce = new Uint8Array(options?.nonce || crypto.randomBytes(32));

    const message = JSON.stringify({
      deadline: options?.deadline ? new Date(options.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      verifying_contract: "intents.near",
      signer_id: this.omniAddress,
      nonce: base64.encode(nonce),
      intents: intents,
    });

    const messageBytes = hex.encode(Buffer.from(message, "utf8"));
    const signature = await signSecp256k1(messageBytes, this.privateKey);
    return {
      signature: `secp256k1:${base58.encode(signature)}`,
      standard: "raw_secp256k1",
      payload: message,
    };
  }
}

export class Ed25519Wallet extends OmniWallet {
  readonly privateKey: Buffer;
  readonly omniAddress: string;
  readonly publicKey: string;
  readonly address: string;
  readonly type = WalletType.EVM;
  readonly icon = "";

  constructor(privateKey: Buffer, signerId?: string) {
    super();

    this.privateKey = privateKey.slice(0, 32);
    const publicKey = Buffer.from(ed.sync.getPublicKey(this.privateKey));
    this.omniAddress = signerId || hex.encode(publicKey);
    this.publicKey = base58.encode(publicKey);
    this.address = this.publicKey;
  }

  transferFee(token: Token, receiver: string, amount: bigint): Promise<ReviewFee> {
    throw new Error("Method not implemented.");
  }
  transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string> {
    throw new Error("Method not implemented.");
  }
  fetchBalance(chain: number, address: string): Promise<bigint> {
    throw new Error("Method not implemented.");
  }
  fetchBalances(chain?: number, whitelist?: string[]): Promise<Record<string, bigint>> {
    throw new Error("Method not implemented.");
  }

  async signIntents(intents: Record<string, any>[], options?: { deadline?: number; nonce?: Uint8Array }): Promise<Commitment> {
    const nonce = new Uint8Array(options?.nonce || crypto.randomBytes(32));

    const message = JSON.stringify({
      deadline: options?.deadline ? new Date(options.deadline).toISOString() : "2100-01-01T00:00:00.000Z",
      nonce: base64.encode(nonce),
      verifying_contract: "intents.near",
      signer_id: this.omniAddress,
      intents: intents,
    });

    const messageBytes = hex.encode(Buffer.from(message, "utf8"));
    const signature = ed.sync.sign(messageBytes, this.privateKey);

    return {
      signature: `ed25519:${base58.encode(signature)}`,
      public_key: `ed25519:${this.omniAddress}`,
      standard: "raw_ed25519",
      payload: message,
    };
  }
}

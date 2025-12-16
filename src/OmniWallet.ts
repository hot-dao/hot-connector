import { hex } from "@scure/base";

import { openAuthPopup } from "./ui/connect/AuthPopup";
import { WalletType } from "./core/chains";
import { Intents } from "./core/Intents";
import { ReviewFee } from "./core/bridge";
import { Token } from "./core/token";
import { Commitment } from "./core";
import { api } from "./core/api";

export abstract class OmniWallet {
  abstract address: string;
  abstract publicKey?: string;
  abstract omniAddress: string;
  abstract type: WalletType;
  abstract icon: string;

  async depositNfts(nftIds: string[], receiver: string) {
    // TODO
  }

  async withdrawNfts(nftIds: string[], receiver: string) {
    // TODO
  }

  async getDepositNftsFee(nfts: string[]) {
    return new ReviewFee({ chain: -4 });
  }

  async transferNft(nftId: string, receiver: string) {
    // TODO
  }

  async getTranferNftFee(nftId: string, receiver: string) {
    return new ReviewFee({ chain: -4 });
  }

  async getNfts(onLoad: (nfts: string[]) => void) {
    // TODO
  }

  abstract transferFee(token: Token, receiver: string, amount: bigint): Promise<ReviewFee>;
  abstract transfer(args: { token: Token; receiver: string; amount: bigint; comment?: string; gasFee?: ReviewFee }): Promise<string>;

  abstract fetchBalance(chain: number, address: string): Promise<bigint>;
  abstract fetchBalances(chain?: number, whitelist?: string[]): Promise<Record<string, bigint>>;

  abstract signIntents(intents: Record<string, any>[], options?: { nonce?: Uint8Array; deadline?: number }): Promise<Commitment>;

  async auth(intents?: Record<string, any>[]): Promise<string> {
    return openAuthPopup(this, async () => {
      const seed = hex.encode(new Uint8Array(window.crypto.getRandomValues(new Uint8Array(32))));
      const msgBuffer = new TextEncoder().encode(`${window.location.origin}_${seed}`);
      const nonce = await window.crypto.subtle.digest("SHA-256", new Uint8Array(msgBuffer));
      const signed = await this.signIntents(intents || [], { nonce: new Uint8Array(nonce) });
      return await api.auth(signed, seed);
    });
  }

  async waitUntilBalance(need: Record<string, bigint>, receiver: string, attempts = 0) {
    if (attempts > 120) throw "Balance is not enough";
    const assets = Object.keys(need) as string[];
    const balances = await Intents.getIntentsBalances(assets, receiver);
    if (assets.every((asset) => (balances[asset] || 0n) >= (need[asset] || 0n))) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.waitUntilBalance(need, receiver, attempts + 1);
  }

  async getIntentsBalance(asset: string, receiver: string): Promise<bigint> {
    const balances = await Intents.getIntentsBalances([asset], receiver);
    return balances[asset] || 0n;
  }

  async getAssets() {
    if (!this.omniAddress) return {};
    const assets = await Intents.getIntentsAssets(this.omniAddress);
    const balances = await Intents.getIntentsBalances(assets, this.omniAddress);
    return balances;
  }
}

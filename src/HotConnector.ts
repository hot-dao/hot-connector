import { computed, makeObservable, observable, runInAction } from "mobx";

import { openBridge, openConnector, openPayment, openProfile } from "./ui/router";
import { EventEmitter } from "./events";
import { OmniWallet } from "./omni/OmniWallet";
import { OmniConnector } from "./omni/OmniConnector";

import NearConnector from "./near/connector";
import EvmConnector, { EvmConnectorOptions } from "./evm/connector";
import SolanaConnector, { SolanaConnectorOptions } from "./solana/connector";
import StellarConnector from "./stellar/connector";
import CosmosConnector from "./cosmos/connector";
import TonConnector from "./ton/connector";
import GoogleConnector from "./google";

import { omni } from "./omni";
import { Token } from "./omni/token";
import { GlobalSettings } from "./settings";
import { defaultTokens } from "./omni/list";

export const near = () => new NearConnector();
export const evm = (options?: EvmConnectorOptions) => new EvmConnector(options);
export const solana = (options?: SolanaConnectorOptions) => new SolanaConnector(options);
export const stellar = () => new StellarConnector();
export const cosmos = () => new CosmosConnector();
export const ton = () => new TonConnector();
export const google = () => new GoogleConnector();
interface HotConnectorOptions extends EvmConnectorOptions, SolanaConnectorOptions {
  webWallet?: string;
  connectors?: OmniConnector[];
  tonApi?: string;
}

export class HotConnector {
  public connectors: OmniConnector[] = [];
  public tokens = defaultTokens.map((t: any) => new Token(t));

  private events = new EventEmitter<{
    connect: { wallet: OmniWallet };
    disconnect: { wallet: OmniWallet };
    tokensUpdate: { tokens: Token[] };
  }>();

  constructor(options?: HotConnectorOptions) {
    makeObservable(this, {
      tokens: observable,
      wallets: computed,
    });

    this.connectors = [google(), near(), evm(options), solana(options), stellar(), ton(), cosmos()];
    GlobalSettings.webWallet = options?.webWallet ?? GlobalSettings.webWallet;
    GlobalSettings.tonApi = options?.tonApi ?? GlobalSettings.tonApi;

    this.connectors.forEach((t) => {
      t.onConnect((payload) => this.events.emit("connect", payload));
      t.onDisconnect((payload) => this.events.emit("disconnect", payload));
    });

    this.onConnect((payload) => this.fetchTokens(payload.wallet));
    this.onDisconnect(({ wallet }) => {
      if (!wallet) return;
      runInAction(() => this.tokens.forEach((t) => t.type === wallet.type && (t.amount = 0n)));
    });

    this.updateRates();
  }

  get wallets(): OmniWallet[] {
    return this.connectors.flatMap((t) => t.wallets);
  }

  async updateRates() {
    const map = new Map<string, Token>();
    this.tokens.forEach((t) => map.set(t.id, t));
    const tokens = await omni.getTokens();
    tokens.forEach((t: any) => {
      if (map.has(t.id)) map.get(t.id)!.usd = t.usd;
      else this.tokens.push(t);
    });
  }

  async fetchTokens(wallet: OmniWallet) {
    if (!this.tokens.length) {
      const tokens = await omni.getTokens();
      runInAction(() => (this.tokens = tokens));
    }

    this.tokens.forEach(async (token) => {
      if (token.type !== wallet.type) return;
      const balance = await wallet.fetchBalance(token.chain, token.address);
      runInAction(() => (token.amount = balance));
    });
  }

  async payment(token: Token, amount: number, receiver: string) {
    if (!token) throw new Error("Token not found");
    await openPayment(this, token, token.int(amount), receiver);
  }

  onConnect(handler: (payload: { wallet: OmniWallet }) => void) {
    this.events.on("connect", handler);
    return () => this.events.off("connect", handler);
  }

  onDisconnect(handler: (payload: { wallet: OmniWallet }) => void) {
    this.events.on("disconnect", handler);
    return () => this.events.off("disconnect", handler);
  }

  async openBridge() {
    await openBridge(this);
  }

  async connect(type?: string) {
    if (this.wallets.length > 0) return openProfile(this);
    const connector = this.connectors.find((t) => t.id === type);
    await openConnector(this, connector);
  }
}

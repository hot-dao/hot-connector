import { computed, makeObservable, observable, runInAction } from "mobx";

import { openBridge, openConnector, openPayment, openProfile, openDeposit, openWithdraw } from "./ui/router";
import { OmniWallet, WalletType } from "./omni/OmniWallet";
import { OmniConnector } from "./omni/OmniConnector";

import NearConnector from "./near/connector";
import EvmConnector, { EvmConnectorOptions } from "./evm/connector";
import SolanaConnector, { SolanaConnectorOptions } from "./solana/connector";
import CosmosConnector, { CosmosConnectorOptions } from "./cosmos/connector";
import TonConnector, { TonConnectorOptions } from "./ton/connector";
import StellarConnector from "./stellar/connector";
import GoogleConnector from "./google";

import { bridge, omni } from "./omni";
import { Token } from "./omni/token";
import { GlobalSettings } from "./settings";
import { defaultTokens } from "./omni/list";
import { EventEmitter } from "./events";

import NearWallet from "./near/wallet";
import EvmWallet from "./evm/wallet";
import SolanaWallet from "./solana/wallet";
import StellarWallet from "./stellar/wallet";
import TonWallet from "./ton/wallet";
import CosmosWallet from "./cosmos/wallet";

export const near = () => new NearConnector();
export const evm = (options?: EvmConnectorOptions) => new EvmConnector(options);
export const solana = (options?: SolanaConnectorOptions) => new SolanaConnector(options);
export const stellar = () => new StellarConnector();
export const cosmos = (options?: CosmosConnectorOptions) => new CosmosConnector(options);
export const ton = (options?: TonConnectorOptions) => new TonConnector(options);
export const google = () => new GoogleConnector();
interface HotConnectorOptions extends EvmConnectorOptions, SolanaConnectorOptions, TonConnectorOptions {
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
      near: computed,
      evm: computed,
      solana: computed,
      stellar: computed,
      ton: computed,
      cosmos: computed,
    });

    this.connectors = [google(), near(), evm(options), solana(options), stellar(), ton(options), cosmos()];
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

  get near(): NearWallet | null {
    return this.wallets.find((w) => w.type === WalletType.NEAR) as NearWallet | null;
  }

  get evm(): EvmWallet | null {
    return this.wallets.find((w) => w.type === WalletType.EVM) as EvmWallet | null;
  }

  get solana(): SolanaWallet | null {
    return this.wallets.find((w) => w.type === WalletType.SOLANA) as SolanaWallet | null;
  }

  get stellar(): StellarWallet | null {
    return this.wallets.find((w) => w.type === WalletType.STELLAR) as StellarWallet | null;
  }

  get ton(): TonWallet | null {
    return this.wallets.find((w) => w.type === WalletType.TON) as TonWallet | null;
  }

  get cosmos(): CosmosWallet | null {
    return this.wallets.find((w) => w.type === WalletType.COSMOS) as CosmosWallet | null;
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

  async deposit(token: Token, amount: number) {
    await openDeposit(this, token, amount);
  }

  async withdraw(token: Token, amount: number) {
    await openWithdraw(this, token, amount);
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

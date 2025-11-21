import { MultichainPopup } from "./ui/popups/MultichainPopup";
import { openPayment } from "./ui/Payment";

import { EventEmitter } from "./events";
import { requestWebWallet } from "./hot-wallet/wallet";
import { OmniWallet, WalletType } from "./omni/OmniWallet";
import { OmniConnector } from "./omni/OmniConnector";

import NearConnector from "./near/connector";
import PasskeyConnector from "./passkey/connector";
import EvmConnector, { EvmConnectorOptions } from "./evm/connector";
import SolanaConnector, { SolanaConnectorOptions } from "./solana/connector";
import StellarConnector from "./stellar/connector";
import TonConnector from "./ton/connector";
import { bridge } from "./omni/bridge";
import { OmniToken, Token } from "./omni/token";
import { GlobalSettings } from "./settings";

export const near = () => new NearConnector();
export const evm = (options?: EvmConnectorOptions) => new EvmConnector(options);
export const solana = (options?: SolanaConnectorOptions) => new SolanaConnector(options);
export const stellar = () => new StellarConnector();
export const ton = () => new TonConnector();
export const passkey = () => new PasskeyConnector();

interface HotConnectorOptions extends EvmConnectorOptions, SolanaConnectorOptions {
  webWallet?: string;
  enableGoogle?: boolean;
  connectors?: OmniConnector[];
  tonApi?: string;
}

export class HotConnector {
  public enableGoogle: boolean = false;
  public connectors: OmniConnector[] = [];
  private events = new EventEmitter<{ connect: { wallet: OmniWallet }; disconnect: { wallet: OmniWallet } }>();

  tokens: Record<string, Token> = {};

  constructor(options?: HotConnectorOptions) {
    this.enableGoogle = options?.enableGoogle ?? false;
    this.connectors = options?.connectors || [near(), evm(options), solana(options), stellar(), ton()];

    GlobalSettings.webWallet = options?.webWallet ?? GlobalSettings.webWallet;
    GlobalSettings.tonApi = options?.tonApi ?? GlobalSettings.tonApi;

    this.connectors.forEach((t) => {
      t.onConnect((payload) => this.events.emit("connect", payload));
      t.onDisconnect((payload) => this.events.emit("disconnect", payload));
    });

    this.onConnect((payload) => this.fetchTokens(payload.wallet));
    this.onDisconnect((payload) => {
      Object.keys(this.tokens).forEach((key) => {
        if (this.tokens[key].type !== payload.wallet.type) return;
        delete this.tokens[key];
      });
    });
  }

  get wallets(): OmniWallet[] {
    return this.connectors.map((t) => t.wallet).filter((t) => t != null);
  }

  async fetchTokens(wallet: OmniWallet) {
    const tokens = await bridge.getTokens();
    tokens.forEach(async (token) => {
      const balance = await wallet.fetchBalance(token.chain, token.address);
      this.tokens[token.id] = token.setAmount(balance);
    });
  }

  token(chain: number, address: string) {
    return this.tokens[`${chain}:${address}`];
  }

  async payment(id: OmniToken, amount: number, receiver: string) {
    const tokens = await bridge.getTokens();
    const ftToken = tokens.find((t) => t.omniAddress === id);
    if (!ftToken) throw new Error("Token not found");
    await openPayment(this, ftToken, ftToken.int(amount), receiver);
  }

  onConnect(handler: (payload: { wallet: OmniWallet }) => void) {
    this.events.on("connect", handler);
    return () => this.events.off("connect", handler);
  }

  onDisconnect(handler: (payload: { wallet: OmniWallet }) => void) {
    this.events.on("disconnect", handler);
    return () => this.events.off("disconnect", handler);
  }

  async connectGoogle() {
    const accounts = await requestWebWallet()("connect:google", {});
    accounts.forEach((account: { type: number; address: string; publicKey: string }) => {
      const connector = this.connectors.find((t) => t.type === account.type);
      if (connector) connector.connectWebWallet(account.address, account.publicKey);
    });
  }

  async connect(type?: WalletType | string) {
    if (type) return this.connectors.find((t) => t.type === type || t.id === type)?.connect();

    return new Promise<void>(async (resolve, reject) => {
      const list = () => this.connectors.map((t) => ({ address: t.wallet?.address, name: t.name, icon: t.icon, id: t.id }));

      const connectGoogle = async () => {
        await this.connectGoogle();
        popup.destroy();
        resolve();
      };

      const popup = new MultichainPopup({
        wallets: list(),
        onGoogleConnect: this.enableGoogle ? connectGoogle : undefined,

        onConnect: (type) => {
          this.connect(type);
          popup.destroy();
          resolve();
        },

        onDisconnect: (type) => {
          this.connectors.find((t) => t.id === type)?.disconnect();
          popup.destroy();
          resolve();
        },

        onReject: () => {
          reject(new Error("User rejected"));
          popup.destroy();
        },
      });

      popup.create();
    });
  }
}

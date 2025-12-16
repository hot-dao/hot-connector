import { Commitment } from "./types";

export class ApiError extends Error {
  name = "ApiError";
  constructor(readonly status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface TokenType {
  icon: string;
  symbol: string;
  asset: string;
  type: number;
  links: Record<string, string>;
  decimal: number;
  contract_id: string;
  chain_id: number;
  amount: string;
  amount_float: number;
  usd_rate: number;
}

export class Api {
  public baseUrl = "https://dev.herewallet.app";
  public apiKey = "";

  async request(url: string, options: RequestInit) {
    options.headers = {
      "Content-Type": "application/json",
      "Api-Key": this.apiKey,
      ...options.headers,
    };

    const response = await fetch(`${this.baseUrl}${url}`, options);
    if (!response.ok) throw new ApiError(response.status, await response.text());
    return await response.json();
  }

  getRpcUrl(chain: number) {
    return `${this.baseUrl}/api/v1/evm/rpc/${chain}`;
  }

  getOneClickApiUrl() {
    return `${this.baseUrl}/api/v1/wibe3/1click`;
  }

  async auth(commitment: Commitment, seed: string): Promise<string> {
    return await this.request(`/api/v1/wibe3/auth`, {
      body: JSON.stringify({ commitment, seed }),
      method: "POST",
    });
  }

  async validateAuth(jwt: string) {
    return await this.request(`/api/v1/wibe3/validate-auth`, {
      body: JSON.stringify({ jwt }),
      method: "POST",
    });
  }

  async getPortfolio(chain: number, address: string): Promise<TokenType[]> {
    const result = await this.request(`/api/v1/wibe3/portfolio`, {
      body: JSON.stringify({ accounts: { [chain]: address } }),
      method: "POST",
    });

    return result.balances?.[chain] || [];
  }

  async pendingPayment(commitment: Commitment, depositAddress: string) {
    return await this.request(`/api/v1/wibe3/yield_intent_call`, {
      body: JSON.stringify({ commitment, deposit_address: depositAddress }),
      method: "POST",
    });
  }

  async publishIntents(signed: Record<string, any>[], hashes: string[]) {
    const result = await this.request(`/api/v1/wibe3/solver-bus`, {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({
        params: [{ signed_datas: signed, quote_hashes: hashes }],
        method: "publish_intents",
        id: "dontcare",
        jsonrpc: "2.0",
      }),
    });

    return result.result;
  }

  async getIntentsStatus(intentHash: string) {
    const result = await this.request(`/api/v1/wibe3/solver-bus`, {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({
        params: [{ intent_hash: intentHash }],
        method: "get_status",
        id: "dontcare",
        jsonrpc: "2.0",
      }),
    });

    return result.result;
  }
}

export const api = new Api();

import { NearConnector } from "@hot-labs/near-connect";
import { runInAction } from "mobx";

import { ConnectorType, OmniConnector } from "../omni/OmniConnector";
import NearWallet from "./wallet";

class Connector extends OmniConnector<NearWallet> {
  connector: NearConnector;
  type = ConnectorType.WALLET;
  icon = "https://storage.herewallet.app/upload/73a44e583769f11112b0eff1f2dd2a560c05eed5f6d92f0c03484fa047c31668.png";
  name = "NEAR Wallet";
  id = "near";

  constructor(connector?: NearConnector) {
    super();

    this.connector = connector || new NearConnector({ network: "mainnet" });
    this.connector.on("wallet:signOut", () => this.removeWallet());
    this.connector.on("wallet:signIn", async ({ wallet }) => {
      const [account] = await wallet.getAccounts();
      if (account) this.setWallet(new NearWallet(this, account.accountId, account.publicKey, wallet));
    });

    this.connector.getConnectedWallet().then(async ({ wallet }) => {
      const [account] = await wallet.getAccounts();
      if (account) this.setWallet(new NearWallet(this, account.accountId, account.publicKey, wallet));
    });

    this.connector.whenManifestLoaded.then(() => {
      runInAction(() => {
        this.options = this.connector.wallets.map((w) => ({
          name: w.manifest.name,
          icon: w.manifest.icon,
          id: w.manifest.id,
        }));
      });
    });
  }

  async connect(id: string) {
    await this.connector.connect(id);
  }

  async silentDisconnect() {
    this.removeStorage();
    this.connector.disconnect();
  }
}

export default Connector;

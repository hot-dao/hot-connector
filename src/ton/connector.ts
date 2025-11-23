import { TonConnect } from "@tonconnect/sdk";
import { runInAction } from "mobx";

import { ConnectorType, OmniConnector } from "../omni/OmniConnector";
import { isInjected } from "../hot-wallet/hot";
import TonWallet from "./wallet";

class TonConnector extends OmniConnector<TonWallet> {
  private tonConnect!: TonConnect;

  type = ConnectorType.WALLET;
  icon = "https://storage.herewallet.app/upload/3ffa61e237f8e38d390abd60200db8edff3ec2b20aad0cc0a8c7a8ba9c318124.png";
  name = "TON Wallet";
  id = "ton";

  constructor(tonConnect?: TonConnect) {
    super();

    if (typeof window !== "undefined") {
      this.tonConnect = tonConnect || new TonConnect();
      this.tonConnect.onStatusChange(async (wallet) => {
        if (!wallet) return this.removeWallet();
        this.setWallet(
          new TonWallet(this, {
            sendTransaction: (params: any) => this.tonConnect.sendTransaction(params),
            signData: (params: any) => this.tonConnect.signData(params),
            account: wallet.account,
          })
        );
      });

      this.tonConnect.restoreConnection();
      this.tonConnect.getWallets().then((wallets) => {
        runInAction(() => {
          this.options = wallets.map((w) => ({ name: w.name, icon: w.imageUrl, id: w.appName }));
        });
      });

      if (isInjected()) {
        this.tonConnect.getWallets().then((wallets) => {
          const wallet = wallets.find((w) => w.appName === "hot");
          if (wallet) this.tonConnect.connect(wallet, { tonProof: "wibe3" });
        });
      }
    }
  }

  async connect(id: string) {
    const wallets = await this.tonConnect.getWallets();
    const wallet = wallets.find((w) => w.appName === id);
    if (wallet) this.tonConnect.connect(wallet, { tonProof: "wibe3" });
  }

  async silentDisconnect() {
    this.tonConnect.disconnect();
    this.removeStorage();
  }
}

export default TonConnector;

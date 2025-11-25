import { observer } from "mobx-react-lite";
import { useState } from "react";

import { HotConnector } from "../HotConnector";
import { WalletType } from "../omni/OmniWallet";
import { Token } from "../omni/token";
import { omni } from "../omni";
import Popup from "./Popup";

interface DepositProps {
  hot: HotConnector;
  token: Token;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
}

const Deposit = ({ hot, token, amount, onClose, onSuccess }: DepositProps) => {
  const [isDepositing, setIsDepositing] = useState(false);
  const [depositMessage, setDepositMessage] = useState<string | null>(null);

  const handleDeposit = async () => {
    setIsDepositing(true);
    const wallet = hot.wallets.find((w) => w.type === token.type);
    if (!wallet) throw new Error("Wallet not found");

    const intentAccount = hot.wallets.find((w) => w.type !== WalletType.COSMOS);
    if (!intentAccount) throw new Error("Intent account not found");

    await omni.deposit({
      onMessage: (message) => setDepositMessage(message),
      receiver: intentAccount.address,
      amount: token.int(amount),
      sender: wallet,
      token,
    });

    setIsDepositing(false);
    onSuccess();
  };

  return (
    <Popup
      header={
        <p>
          Deposit {token.readable(amount)} {token.symbol}
        </p>
      }
      onClose={onClose}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
        <div style={{ display: "flex", flexDirection: "row", gap: 4, width: "100%" }}>
          <img src={token.icon} width={18} height={18} style={{ borderRadius: "50%" }} />
          <p style={{ marginRight: "auto" }}>{token.symbol}</p>
        </div>
      </div>

      <button onClick={handleDeposit} disabled={isDepositing}>
        {isDepositing ? depositMessage : "Deposit"}
      </button>
    </Popup>
  );
};

export default observer(Deposit);

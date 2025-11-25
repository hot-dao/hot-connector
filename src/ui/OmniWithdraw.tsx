import { observer } from "mobx-react-lite";
import { useState } from "react";

import { HotConnector } from "../HotConnector";
import { WalletType } from "../omni/OmniWallet";
import { Token } from "../omni/token";
import { omni } from "../omni";
import Popup from "./Popup";

interface WithdrawProps {
  hot: HotConnector;
  token: Token;
  amount: number;
  onClose: () => void;
  onSuccess: () => void;
}

const Withdraw = ({ hot, token, amount, onClose, onSuccess }: WithdrawProps) => {
  const [withdrawMessage, setWithdrawMessage] = useState<string | null>(null);
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  const handleWithdraw = async () => {
    const intentAccount = hot.wallets.find((w) => w.type !== WalletType.COSMOS);
    if (!intentAccount) throw new Error("Intent account not found");

    const relayer = hot.wallets.find((w) => w.type === token.type);
    if (!relayer) throw new Error("Wallet not found");

    setIsWithdrawing(true);
    await omni.withdraw({
      onMessage: (message) => setWithdrawMessage(message),
      receiver: relayer.address,
      amount: token.int(amount),
      relayer: relayer,
      sender: intentAccount,
      token,
    });

    setIsWithdrawing(false);
    onSuccess();
  };

  return (
    <Popup
      header={
        <p>
          Withdraw {token.readable(amount)} {token.symbol}
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

      <button onClick={handleWithdraw} disabled={isWithdrawing}>
        {isWithdrawing ? withdrawMessage : "Withdraw"}
      </button>
    </Popup>
  );
};

export default observer(Withdraw);

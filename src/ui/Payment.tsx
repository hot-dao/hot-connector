import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { bridge, BridgeReview } from "../omni/bridge";
import { HotConnector } from "../HotConnector";
import { formatter, Token } from "../omni/token";
import Popup from "./Popup";
import { Chains } from "../omni/chains";

export const openPayment = (connector: HotConnector, token: Token, amount: bigint, receiver: string) => {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  const promise = new Promise<BridgeReview>((resolve, reject) => {
    root.render(
      <Payment //
        onReject={reject}
        onSuccess={resolve}
        connector={connector}
        token={token}
        amount={amount}
        receiver={receiver}
      />
    );
  });

  return promise
    .then((review) => {
      root.unmount();
      return review;
    })
    .catch((e) => {
      root.unmount();
      throw e;
    });
};

interface PaymentProps {
  connector: HotConnector;
  token: Token;
  amount: bigint;
  receiver: string;
  onReject: (e: any) => void;
  onSuccess: (review: BridgeReview) => void | null;
}

const Payment = ({ connector, token, amount, receiver, onReject, onSuccess }: PaymentProps) => {
  const [selected, setSelected] = useState<Token | null>(null);
  const [qoute, setQoute] = useState<BridgeReview | null>(null);
  const [isQoute, setIsQoute] = useState(false);
  const [isPaying, setIsPaying] = useState(false);

  useEffect(() => {
    if (selected == null) return;
    const sender = connector.wallets.find((w) => w.type === selected.type);
    if (!sender) return;

    setIsQoute(false);
    bridge
      .reviewSwap({ sender, from: selected, to: token, amount: (amount * 1005n) / 1000n, receiver: receiver, slippage: 0.005, type: "exactOut" })
      .then(setQoute)
      .catch((e) => console.error(e))
      .finally(() => setIsQoute(false));
  }, [selected]);

  const handlePay = () => {
    if (selected == null) return;
    const sender = connector.wallets.find((w) => w.type === selected.type);
    if (!sender) return;

    setIsPaying(true);
    bridge
      .makeSwap(sender, qoute!, { log: (message) => console.log(message) })
      .then(onSuccess)
      .catch((e) => console.error(e))
      .finally(() => setIsPaying(false));
  };

  const need = token.usd * token.float(amount);
  const tokens = Object.values(connector.tokens).filter((t) => {
    if (t.float(t.amount) * t.usd > need) return true;
    return false;
  });

  if (selected == null) {
    return (
      <Popup header={<p>Pay ${token.readable(amount, token.usd)}</p>} onClose={() => onReject(new Error("User rejected"))}>
        {tokens.map((token) => (
          <div key={token.id} onClick={() => setSelected(token)} className="connect-item">
            <div style={{ position: "relative" }}>
              <img src={token.icon} alt={token.symbol} style={{ borderRadius: "50%" }} />
              <img src={Chains.get(token.chain).icon} alt={token.symbol} style={{ width: 14, height: 14, position: "absolute", bottom: 0, right: 0 }} />
            </div>

            <div className="connect-item-info">
              <span>{token.symbol}</span>
              <span>${formatter.amount(token.usd)}</span>
            </div>

            <div className="connect-item-info" style={{ alignItems: "flex-end" }}>
              <span>{token.readable(token.amount)}</span>
              <span>${token.readable(token.amount, token.usd)}</span>
            </div>
          </div>
        ))}
      </Popup>
    );
  }

  return (
    <Popup header={<p>Pay ${token.readable(amount, token.usd)}</p>} onClose={() => onReject(new Error("User rejected"))}>
      {qoute != null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "row", gap: 4, width: "100%" }}>
            <img src={selected.icon} width={18} height={18} style={{ borderRadius: "50%" }} />
            <p style={{ marginRight: "auto" }}>{selected.symbol}</p>

            <p>
              {selected.readable(qoute.amountIn)} {selected.symbol} • ${selected.readable(qoute.amountIn, selected.usd)}
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "row", gap: 4, width: "100%" }}>
            <img src={Chains.get(selected.chain).icon} width={18} height={18} style={{ borderRadius: "50%" }} />
            <p style={{ marginRight: "auto" }}>Network Fee</p>

            <p>
              {selected.readable(qoute.fee.gasPrice)} {selected.symbol} • ${selected.readable(qoute.fee.gasPrice, selected.usd)}
            </p>
          </div>
        </div>
      )}

      <button onClick={handlePay} disabled={isPaying || qoute == null}>
        {isPaying ? "Paying..." : qoute == null ? "Quoting..." : `Pay`}
      </button>
    </Popup>
  );
};

export default Payment;

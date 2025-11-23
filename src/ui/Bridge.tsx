import { useEffect, useState } from "react";

import { formatter, Token } from "../omni/token";
import { BridgeReview, omni } from "../omni";
import { HotConnector } from "../HotConnector";
import { TokenCard } from "./TokenCard";
import { Chains } from "../omni/chains";

import { openSelectTokenPopup } from "./router";
import Popup from "./Popup";

export const SelectTokenPopup = ({ hot, initialChain, onClose, onSelect }: { hot: HotConnector; initialChain?: number; onClose: () => void; onSelect: (token: Token) => void }) => {
  const [chain, setChain] = useState<number | null>(initialChain || null);

  if (chain == null) {
    const chains = [...new Set(hot.tokens.map((token) => token.chain))];
    return (
      <Popup onClose={onClose} header={<p>Select chain</p>}>
        {chains.map(
          (chain) =>
            !!Chains.get(chain).name && (
              <div key={chain} className="connect-item" onClick={() => setChain(chain)}>
                <img src={Chains.get(chain).icon} alt={Chains.get(chain).name} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: "50%" }} />
                <p style={{ fontSize: 24, fontWeight: "bold" }}>{Chains.get(chain).name}</p>
              </div>
            )
        )}
      </Popup>
    );
  }

  return (
    <Popup onClose={onClose} header={<p>Select token</p>}>
      {hot.tokens
        .filter((token) => token.chain === chain)
        .map((token) => (
          <TokenCard key={token.id} token={token} onSelect={onSelect} />
        ))}
    </Popup>
  );
};

const Bridge = ({ hot, onClose }: { hot: HotConnector; onClose: () => void }) => {
  const [value, setValue] = useState<string>("");
  const [isFiat, setIsFiat] = useState(false);
  const [from, setFrom] = useState<Token>(hot.tokens[0]);
  const [to, setTo] = useState<Token>(hot.tokens[1]);
  const [review, setReview] = useState<BridgeReview | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isError, setIsError] = useState<string | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [processingResult, setProcessingResult] = useState<BridgeReview | null>(null);

  const sender = hot.wallets.find((w) => w.type === from?.type);
  const receipient = hot.wallets.find((w) => w.type === to?.type);
  const fromAmount = formatter.fromInput(value);

  useEffect(() => {
    let isInvalid = false;
    let debounceTimer: NodeJS.Timeout;

    if (+fromAmount <= 0) return;
    if (receipient == null) return setIsError("Please select a recipient");
    if (sender == null) return setIsError("Please select a sender");

    setIsReviewing(true);
    debounceTimer = setTimeout(async () => {
      try {
        if (isInvalid) return;
        const amount = from.int(isFiat ? +fromAmount / from.usd : fromAmount);
        const review = await omni.reviewSwap({ sender, amount, receiver: receipient.address, slippage: 0.005, type: "exactIn", from, to });
        if (isInvalid) return;
        setIsError(null);
        setReview(review);
      } catch (e) {
        if (isInvalid) return;
        setIsError("Failed to review swap");
        console.error(e);
      } finally {
        if (isInvalid) return;
        setIsReviewing(false);
      }
    }, 500);

    return () => {
      isInvalid = true;
      clearTimeout(debounceTimer);
    };
  }, [fromAmount, from, to, isFiat]);

  const handleConfirm = () => {
    if (review == null) return;
    setIsProcessing(true);
    omni
      .makeSwap(sender!, review, { log: setProcessingMessage })
      .then(onClose)
      .catch((e) => console.error(e))
      .finally(() => setIsProcessing(false));
  };

  if (isProcessing) {
    return (
      <Popup onClose={onClose}>
        <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <p>{processingMessage || "Signing transaction"}</p>
        </div>
      </Popup>
    );
  }

  if (processingResult != null) {
    return (
      <Popup onClose={onClose}>
        <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
          <p>Swap successful</p>
        </div>
      </Popup>
    );
  }

  return (
    <Popup onClose={onClose}>
      <style>{styles}</style>

      <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p>From</p>
              <div className="small-button">{formatter.truncateAddress(sender?.address ?? "Connect wallet")}</div>
            </div>
            <div className="small-button" onClick={() => setIsFiat(!isFiat)}>
              USD
            </div>
          </div>
          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <TokenPreview token={from} onSelect={() => openSelectTokenPopup({ hot, onSelect: (token) => setFrom(token) })} />
            <input className="input" value={isFiat ? `$${fromAmount}` : fromAmount} onChange={(e) => setValue(e.target.value)} placeholder="0" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            {isFiat ? (
              <p>Available: ${from.readable(from.float(from.amount), from.usd)}</p>
            ) : (
              <p>
                Available: {from.readable(from.float(from.amount))} {from.symbol}
              </p>
            )}

            {isFiat ? (
              <p>
                {from.readable(+fromAmount / from.usd)} {from.symbol}
              </p>
            ) : (
              <p>${from.readable(+fromAmount, from.usd)}</p>
            )}
          </div>
        </div>

        <div style={{ width: "100%", height: 1, backgroundColor: "#2d2d2d", marginTop: 16, marginBottom: 16 }} />

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p>To</p>
              <div className="small-button">{formatter.truncateAddress(receipient?.address ?? "Connect wallet")}</div>
            </div>
            <p>${to.readable(review?.amountOut ?? 0, to.usd)}</p>
          </div>
          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <TokenPreview token={to} onSelect={() => openSelectTokenPopup({ hot, onSelect: (token) => setTo(token) })} />
            <h2 style={{ fontSize: 32, lineHeight: "40px", fontWeight: "bold" }}>{to.readable(review?.amountOut ?? 0)}</h2>
          </div>
        </div>
      </div>

      {from.float(from.amount) < +fromAmount ? (
        <button disabled>Insufficient balance</button>
      ) : (
        <button disabled={isReviewing || isError != null} onClick={handleConfirm}>
          {isReviewing ? "Quoting..." : isError != null ? isError : "Confirm"}
        </button>
      )}
    </Popup>
  );
};

const TokenPreview = ({ token, onSelect }: { token: Token; onSelect: (token: Token) => void }) => {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0, cursor: "pointer" }} onClick={() => onSelect(token)}>
      <div style={{ position: "relative" }}>
        <img src={token.icon} alt={token.symbol} style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
        <img src={Chains.get(token.chain).icon} alt={token.symbol} style={{ borderRadius: "50%", width: 14, height: 14, position: "absolute", bottom: 0, right: -4 }} />
      </div>
      <p style={{ fontSize: 24, fontWeight: "bold" }}>{token.symbol}</p>
    </div>
  );
};

const styles = /* css */ `
.card {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    text-align: left;
    align-items: flex-start;
    justify-content: center;
    border-radius: 12px;
}

.card .input {
    outline: none;
    border: none;
    background: none;
    color: #fff;
    font-size: 32px;
    font-weight: bold;
    width: 100%;
    line-height: 40px;
    text-align: left;
    align-items: flex-start;
    justify-content: center;
    background: transparent;
    text-align: right;
    border: none;
    padding: 0;
    margin: 0;
}

.small-button {
    font-size: 12px;
    font-weight: 500;
    color: #fff;
    background: #282c30;
    padding: 4px 8px;
    border-radius: 16px;
    cursor: pointer;
}
`;

export default Bridge;

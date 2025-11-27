import { useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import styled, { keyframes } from "styled-components";
import QRCodeStyling from "qr-code-styling";

import { OmniWallet } from "../../omni/OmniWallet";
import { formatter, Token } from "../../omni/token";
import { BridgeReview, omni } from "../../omni/exchange";
import { HotConnector } from "../../HotConnector";

import Popup from "../Popup";
import { PopupButton } from "../styles";
import { openSelectTokenPopup, openSelectWallet } from "../router";
import { TokenIcon } from "./TokenCard";

export interface BridgeProps {
  hot: HotConnector;
  widget?: boolean;
  onClose: () => void;
  onProcess: (task: Promise<BridgeReview>) => void;
  setup?: {
    title?: string;
    readonlyAmount?: boolean;
    readonlyTo?: boolean;
    readonlyFrom?: boolean;
    type?: "exactIn" | "exactOut";
    sender?: OmniWallet;
    receipient?: OmniWallet;
    amount?: number;
    from?: Token;
    to?: Token;
  };
}

const DepositQR = ({ review, onConfirm, onCancel }: { review: BridgeReview; onConfirm: () => void; onCancel: () => void }) => {
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [qrCode] = useState<QRCodeStyling | null>(() => {
    if (review.qoute === "deposit" || review.qoute === "withdraw") return null;
    return new QRCodeStyling({
      data: review.qoute.depositAddress,
      dotsOptions: { color: "#eeeeee", type: "rounded" },
      backgroundOptions: { color: "transparent" },
      shape: "circle",
      width: 180,
      height: 180,
      type: "svg",
    });
  });

  useEffect(() => {
    if (!qrCodeRef.current) return;
    if (review.qoute === "deposit" || review.qoute === "withdraw") return;
    qrCode?.append(qrCodeRef.current);
  }, [qrCode]);

  if (review.qoute === "deposit" || review.qoute === "withdraw") return null;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1 }}>
      <div
        ref={qrCodeRef}
        style={{
          marginTop: "auto",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 8,
          paddingTop: 10,
          paddingLeft: 10,
          border: "1px solid #2d2d2d",
          background: "#1c1c1c",
        }}
      ></div>

      <p style={{ marginTop: 24 }}>
        Send{" "}
        <b>
          {review.qoute.amountInFormatted} {review.from.symbol}
        </b>{" "}
        on <b>{review.from.chainName}</b> to
      </p>

      <div style={{ width: "100%", marginTop: 8, padding: 12, marginBottom: 24, border: "1px solid #2d2d2d", borderRadius: 12, background: "#1c1c1c" }}>
        <p style={{ wordBreak: "break-all" }}>{review.qoute.depositAddress}</p>
      </div>

      <PopupButton style={{ marginTop: "auto" }} onClick={onConfirm}>
        I sent the funds
      </PopupButton>
    </div>
  );
};

const Bridge = ({ hot, widget, setup, onClose, onProcess }: BridgeProps) => {
  const [isFiat, setIsFiat] = useState(false);
  const [type, setType] = useState<"exactIn" | "exactOut">(setup?.type || "exactIn");
  const [value, setValue] = useState<string>(setup?.amount?.toString() ?? "");
  const [from, setFrom] = useState<Token>(setup?.from || hot.tokens.find((t) => t.id === localStorage.getItem("bridge:from")) || hot.tokens.find((t) => t.symbol === "NEAR")!);
  const [to, setTo] = useState<Token>(setup?.to || hot.tokens.find((t) => t.id === localStorage.getItem("bridge:to")) || hot.tokens.find((t) => t.symbol === "USDT")!);

  const [review, setReview] = useState<BridgeReview | null>(null);
  const [isError, setIsError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const [processing, setProcessing] = useState<{
    status: "qr" | "processing" | "success" | "error";
    message: string;
    review: BridgeReview;
  } | null>(null);

  const [sender, setSender] = useState<OmniWallet | "qr" | undefined>(setup?.sender || hot.wallets.find((w) => w.type === from.type));
  const [receipient, setReceipient] = useState<OmniWallet | undefined>(setup?.receipient || hot.wallets.find((w) => w.type === to.type));

  const valueInTokens = isFiat ? +formatter.fromInput(value) / (type === "exactIn" ? from.usd : to.usd) : +formatter.fromInput(value);
  const amountFrom = type === "exactOut" ? to.float(review?.amountIn ?? 0) : valueInTokens;
  const amountTo = type === "exactIn" ? to.float(review?.amountOut ?? 0) : valueInTokens;

  const showAmountFrom = type === "exactOut" ? +from.float(review?.amountIn ?? 0).toFixed(6) : formatter.fromInput(value);
  const showAmountTo = type === "exactIn" ? +to.float(review?.amountOut ?? 0).toFixed(6) : formatter.fromInput(value);

  useEffect(() => {
    localStorage.setItem("bridge:from", from.id);
    localStorage.setItem("bridge:to", to.id);
  }, [from, to]);

  useEffect(() => {
    let isInvalid = false;
    let debounceTimer: NodeJS.Timeout;

    if (valueInTokens <= 0) return;
    if (sender == null) return;
    if (receipient == null) return;

    setIsReviewing(true);
    debounceTimer = setTimeout(async () => {
      try {
        if (isInvalid) return;
        console.log("reviewing");
        const refund = sender !== "qr" ? sender : hot.priorityWallet;
        if (!refund) {
          setIsError("Connect any wallet");
          setIsReviewing(false);
          return;
        }

        const amount = type === "exactIn" ? from.int(valueInTokens) : to.int(valueInTokens);
        const review = await omni.reviewSwap({ sender, refund, amount, receiver: receipient.address, slippage: 0.005, type, from, to });
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
  }, [valueInTokens, type, from, to, isFiat, sender, receipient]);

  const handleConfirm = async () => {
    if (sender == "qr") {
      setProcessing({ status: "qr", message: "Scan QR code to sign transaction", review: review! });
      return;
    }

    let qouta = review!;
    try {
      setProcessing({ status: "processing", message: "Signing transaction", review: review! });
      const result = await omni.makeSwap(sender!, qouta, { log: (message) => setProcessing({ status: "processing", message, review: qouta }) });
      setProcessing({ status: "success", message: "Transaction signed", review: result });
      return result;
    } catch (e) {
      setProcessing({ status: "error", message: "Failed to sign transaction", review: qouta });
      console.error(e);
      throw e;
    }
  };

  const handleMax = () => {
    if (sender === "qr") return;
    if (isFiat) {
      const max = from.float(hot.balance(sender, from)) * from.usd;
      setValue(String(+max.toFixed(6)));
    } else {
      const max = from.float(hot.balance(sender, from));
      setValue(String(+max.toFixed(6)));
    }
  };

  if (processing?.status === "qr") {
    return (
      <Popup widget={widget} onClose={onClose} header={setup?.title ? <p>{setup?.title}</p> : null}>
        <DepositQR review={processing.review} onConfirm={() => setProcessing(null)} onCancel={() => setProcessing(null)} />
      </Popup>
    );
  }

  if (processing?.status === "processing") {
    return (
      <Popup widget={widget} onClose={onClose} header={setup?.title ? <p>{setup?.title}</p> : null}>
        <div style={{ width: "100%", height: 400, display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          {/* @ts-ignore */}
          <dotlottie-wc src="/loading.json" speed="1" style={{ width: 300, height: 300 }} mode="forward" loop autoplay></dotlottie-wc>
          <p style={{ marginTop: -32, fontSize: 16 }}>{processing.message}</p>
        </div>
      </Popup>
    );
  }

  if (processing?.status === "success") {
    return (
      <Popup widget={widget} onClose={onClose} header={setup?.title ? <p>{setup?.title}</p> : null}>
        <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          <p style={{ marginTop: "auto", fontSize: 24, fontWeight: "bold" }}>Swap successful</p>
          <PopupButton style={{ marginTop: "auto" }} onClick={() => setProcessing(null)}>
            Continue
          </PopupButton>
        </div>
      </Popup>
    );
  }

  if (processing?.status === "error") {
    return (
      <Popup widget={widget} onClose={onClose} header={setup?.title ? <p>{setup?.title}</p> : null}>
        <div style={{ width: "100%", height: "100%", display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
          <p style={{ marginTop: "auto", fontSize: 24, fontWeight: "bold" }}>Swap failed</p>
          <p style={{ marginTop: 8, fontSize: 14 }}>{processing.message}</p>
          <PopupButton style={{ marginTop: "auto" }} onClick={() => setProcessing(null)}>
            Continue
          </PopupButton>
        </div>
      </Popup>
    );
  }

  const button = () => {
    if (sender == null) return <PopupButton disabled>Set sender</PopupButton>;
    if (receipient == null) return <PopupButton disabled>Set recipient</PopupButton>;
    if (sender !== "qr" && from.float(hot.balance(sender, from)) < amountFrom) return <PopupButton disabled>Insufficient balance</PopupButton>;
    return (
      <PopupButton disabled={isReviewing || isError != null} onClick={() => onProcess(handleConfirm())}>
        {isReviewing ? "Quoting..." : isError != null ? isError : "Confirm"}
      </PopupButton>
    );
  };

  return (
    <Popup widget={widget} onClose={onClose} header={setup?.title ? <p>{setup?.title}</p> : null}>
      <div style={{ display: "flex", flexDirection: "column", gap: 32, width: "100%", height: "100%" }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontWeight: "bold" }}>{from.chain === -4 ? "Withdraw omni from:" : "Send from:"}</p>
              <BadgeButton onClick={() => openSelectWallet({ hot, current: sender, isRecipient: false, type: from.type, onSelect: (wallet) => setSender(wallet) })}>
                <p>{formatter.truncateAddress(sender === "qr" ? "QR code" : sender?.address ?? "Connect wallet")}</p>
              </BadgeButton>
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <TokenPreview //
              token={from}
              style={{ pointerEvents: setup?.readonlyFrom ? "none" : "all" }}
              onSelect={() => openSelectTokenPopup({ hot, onSelect: (token, wallet) => (setFrom(token), setSender(wallet)) })}
            />

            {isReviewing && type === "exactOut" ? (
              <SkeletonShine />
            ) : (
              <input //
                name="from"
                type="text"
                className="input"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                readOnly={setup?.readonlyAmount}
                value={isFiat ? `$${showAmountFrom}` : showAmountFrom}
                onChange={(e) => (setType("exactIn"), setValue(e.target.value))}
                placeholder="0"
              />
            )}
          </div>

          {isFiat && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              {sender !== "qr" && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <p>Available: ${from.readable(hot.balance(sender, from), from.usd)}</p>
                  <RefreshButton onClick={() => sender && hot.fetchToken(from, [sender])} />
                </div>
              )}

              {sender === "qr" && <div />}

              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {from.usd !== 0 && <p style={{ marginRight: 8 }}>{`${from.readable(amountFrom / from.usd)} ${from.symbol}`}</p>}
                {from.usd !== 0 && (
                  <BadgeButton style={{ border: `1px solid #fff` }} onClick={() => setIsFiat(!isFiat)}>
                    USD
                  </BadgeButton>
                )}
                {sender !== "qr" && <BadgeButton onClick={handleMax}>MAX</BadgeButton>}
              </div>
            </div>
          )}

          {!isFiat && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
              {sender !== "qr" && (
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <p>Available: {`${from.readable(hot.balance(sender, from))} ${from.symbol}`}</p>
                  <RefreshButton onClick={() => sender && hot.fetchToken(from, [sender])} />
                </div>
              )}
              {sender === "qr" && <div />}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {from.usd !== 0 && <p style={{ marginRight: 8 }}>${from.readable(amountFrom, from.usd)}</p>}
                {from.usd !== 0 && <BadgeButton onClick={() => setIsFiat(!isFiat)}>USD</BadgeButton>}
                {sender !== "qr" && <BadgeButton onClick={handleMax}>MAX</BadgeButton>}
              </div>
            </div>
          )}
        </Card>

        <div style={{ position: "relative" }}>
          <div style={{ width: "100%", height: 1, backgroundColor: "#2d2d2d" }} />
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: -18,
              transform: "translate(-50%, 0)",
              background: "#232323",
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 2,
              cursor: "pointer",
              border: "2px solid #181818",
              boxShadow: "0 2px 8px 0 #18181870",
            }}
            onClick={() => {
              setFrom(to);
              setTo(from);
              setSender(receipient);
              setReceipient(sender === "qr" ? undefined : sender);
              setType(type === "exactIn" ? "exactOut" : "exactIn");
              setValue("");
            }}
          >
            {/* Swap Icon SVG */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M16 18v-9a4 4 0 0 0-4-4H6m0 0l2.293 2.293M6 5l2.293-2.293" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 6v9a4 4 0 0 0 4 4h6m0 0-2.293-2.293M18 19.999l-2.293 2.293" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <p style={{ fontWeight: "bold" }}>{to.chain !== -4 ? "To:" : "Deposit omni to:"}</p>
              <BadgeButton onClick={() => openSelectWallet({ hot, current: receipient, isRecipient: true, type: to.type, onSelect: (wallet) => setReceipient(wallet as OmniWallet) })}>
                <p>{formatter.truncateAddress(receipient?.address ?? "Connect wallet")}</p>
              </BadgeButton>
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
            <TokenPreview //
              token={to}
              style={{ pointerEvents: setup?.readonlyTo ? "none" : "all" }}
              onSelect={() => openSelectTokenPopup({ hot, onSelect: (token, wallet) => (setTo(token), setReceipient(wallet)) })}
            />

            {isReviewing && type === "exactIn" ? (
              <SkeletonShine />
            ) : (
              <input //
                name="to"
                type="text"
                className="input"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                readOnly={setup?.readonlyAmount}
                value={isFiat ? `$${+showAmountTo * to.usd}` : showAmountTo}
                onChange={(e) => (setType("exactOut"), setValue(e.target.value))}
                placeholder="0"
              />
            )}
          </div>

          <div style={{ width: "100%", display: "flex", justifyContent: "flex-end", marginTop: -8 }}>
            {isFiat && <p>Receive: ${`${to.readable(amountTo ?? 0)} ${to.symbol}`}</p>}
            {!isFiat && <p>Receive: ${to.readable(amountTo ?? 0, to.usd)}</p>}
          </div>
        </Card>

        <div style={{ marginTop: "auto" }}>{button()}</div>
      </div>
    </Popup>
  );
};

const TokenPreview = ({ style, token, onSelect }: { style?: any; token: Token; onSelect: (token: Token) => void }) => {
  return (
    <SelectTokenButton style={style} onClick={() => onSelect(token)}>
      <TokenIcon token={token} />
      <p style={{ fontSize: 24, fontWeight: "bold" }}>{token.symbol}</p>
    </SelectTokenButton>
  );
};

const BadgeButton = styled.button`
  font-size: 12px;
  font-weight: 500;
  color: #fff;
  background: #282c30;
  padding: 4px 8px;
  border-radius: 16px;
  cursor: pointer;
  outline: none;
  border: none;
  border: 1px solid transparent;
  transition: 0.2s border-color;

  &:hover {
    border-color: #4e4e4e;
  }

  * {
    font-size: 14px;
    font-weight: bold;
  }
`;

const SelectTokenButton = styled.button`
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
  cursor: pointer;
  outline: none;
  border: none;
  background: transparent;
  border-radius: 32px;
  padding: 8px;
  padding-right: 16px;
  margin: -8px;

  &:hover {
    background: rgba(255, 255, 255, 0.2);
  }
`;

const Card = styled.div`
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  text-align: left;
  align-items: flex-start;
  justify-content: center;
  border-radius: 12px;

  input {
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
`;

const shine = keyframes`
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: calc(200px + 100%) 0;
  }
`;

export const SkeletonShine = styled.div`
  display: inline-block;
  width: 100px;
  height: 40px;
  border-radius: 8px;
  background: #2e2e2e;
  position: relative;
  overflow: hidden;

  &:after {
    content: "";
    display: block;
    height: 100%;
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    background: linear-gradient(90deg, rgba(34, 34, 34, 0) 0%, rgba(255, 255, 255, 0.06) 40%, rgba(255, 255, 255, 0.12) 50%, rgba(255, 255, 255, 0.06) 60%, rgba(34, 34, 34, 0) 100%);
    background-size: 200px 100%;
    animation: ${shine} 1.4s infinite linear;
  }
`;

const RefreshButton = ({ onClick }: { onClick: () => void }) => {
  return (
    <svg
      onClick={onClick}
      style={{ width: 18, height: 18, verticalAlign: "middle", marginLeft: 8, cursor: "pointer", opacity: 0.7, transition: "opacity 0.2s" }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      onMouseOver={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseOut={(e) => (e.currentTarget.style.opacity = "0.7")}
    >
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.13-3.36L23 10" />
      <path d="M20.49 15a9 9 0 01-14.13 3.36L1 14" />
    </svg>
  );
};

export default observer(Bridge);

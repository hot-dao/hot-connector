import { observer } from "mobx-react-lite";
import { useEffect, useState } from "react";
import styled from "styled-components";

import { chains } from "../../core/chains";
import { formatter } from "../../core/utils";
import { Token } from "../../core/token";

import { HotConnector } from "../../HotConnector";
import { OmniWallet } from "../../OmniWallet";

const images = {
  cached: new Map<string, Promise<void>>(),
  cache(url: string): Promise<void> {
    if (this.cached.has(url)) return this.cached.get(url)!;
    const promise = new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = url;
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
    });

    this.cached.set(url, promise);
    return promise;
  },
};

enum ImageState {
  Loading = "loading",
  Loaded = "loaded",
  Error = "error",
}

export const ImageView = ({ src, size = 40, alt, style }: { src: string; size?: number; alt: string; style?: React.CSSProperties }) => {
  const [icon, setIcon] = useState<ImageState>(ImageState.Loading);

  useEffect(() => {
    setIcon(ImageState.Loading);
    images
      .cache(src)
      .then(() => setIcon(ImageState.Loaded))
      .catch(() => setIcon(ImageState.Error));
  }, [src]);

  if (icon === ImageState.Loaded) {
    return <img src={src} alt={alt} style={{ objectFit: "contain", width: size, height: size, borderRadius: "50%", ...style }} />;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: size, height: size, borderRadius: "50%", backgroundColor: "#0e0e0e", ...style }}>
      <p style={{ fontWeight: "bold", fontSize: size / 2, color: "#ffffff" }}>{alt.charAt(0)?.toUpperCase()}</p>
    </div>
  );
};

export const TokenIcon = observer(({ token, wallet, withoutChain }: { token: Token; wallet?: OmniWallet; withoutChain?: boolean }) => {
  return (
    <div style={{ position: "relative", width: 40, height: 40, flexShrink: 0 }}>
      <ImageView src={token.icon} alt={token.symbol} size={40} />
      {!withoutChain && <ImageView src={token.chainIcon} alt={token.symbol} size={14} style={{ position: "absolute", bottom: 0, right: 0 }} />}
      {token.chain === -4 && wallet?.type && <ImageView src={wallet.icon} alt={chains.getByType(wallet.type)?.[0]?.name || ""} size={14} style={{ position: "absolute", bottom: 0, left: 0 }} />}
    </div>
  );
});

export const TokenCard = observer(
  ({ token, onSelect, amount, hot, wallet, rightControl }: { rightControl?: React.ReactNode; token: Token; onSelect?: (token: Token, wallet?: OmniWallet) => void; amount?: bigint; hot: HotConnector; wallet?: OmniWallet }) => {
    const balance = amount || hot.balance(wallet, token);
    const symbol = token.chain === -4 && !token.isMainOmni ? `${token.symbol} (${token.originalChainSymbol})` : token.symbol;

    return (
      <Card key={token.id} onClick={() => onSelect?.(token, wallet)}>
        <TokenIcon token={token} wallet={wallet} />

        <TokenWrap>
          <Text style={{ textAlign: "left" }}>{symbol}</Text>
          <PSmall style={{ textAlign: "left" }}>${formatter.amount(token.usd)}</PSmall>
        </TokenWrap>

        {rightControl || (
          <TokenWrap style={{ textAlign: "right", paddingRight: 4, marginLeft: "auto", alignItems: "flex-end" }}>
            <Text>{token.readable(balance)}</Text>
            <PSmall>${token.readable(balance, token.usd)}</PSmall>
          </TokenWrap>
        )}
      </Card>
    );
  }
);

const Card = styled.div`
  display: flex;
  padding: 12px;
  padding-bottom: 10px;
  gap: 10px;
  border-radius: 16px;
  border: 1px solid #323232;
  background: #272727;
  cursor: pointer;
  transition: background 0.2s ease-in-out;

  &:hover {
    background: rgba(255, 255, 255, 0.04);
  }
`;

const PSmall = styled.p`
  color: #bfbfbf;
  font-family: "Golos Text";
  font-size: 12px;
  font-style: normal;
  line-height: 16px;
  letter-spacing: -0.12px;
  text-align: left;
  font-weight: bold;
`;

const Text = styled.p`
  color: #fff;
  text-align: right;
  font-family: "Golos Text";
  font-size: 16px;
  font-style: normal;
  line-height: 22px;
  letter-spacing: -0.16px;
  font-weight: bold;
`;

const TokenWrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: -1px;

  &,
  p {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

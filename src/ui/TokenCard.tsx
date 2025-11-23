import { Chains } from "../omni/chains";
import { formatter, Token } from "../omni/token";

export const TokenCard = ({ token, onSelect }: { token: Token; onSelect: (token: Token) => void }) => {
  return (
    <div key={token.id} onClick={() => onSelect(token)} className="connect-item">
      <div style={{ position: "relative" }}>
        <img src={token.icon} alt={token.symbol} style={{ borderRadius: "50%" }} />
        <img src={Chains.get(token.chain).icon} alt={token.symbol} style={{ width: 14, height: 14, position: "absolute", bottom: 0, right: 0 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, textAlign: "left" }}>
        <span>{token.symbol}</span>
        <span>${formatter.amount(token.usd)}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginLeft: "auto", alignItems: "flex-end" }}>
        <span>{token.readable(token.amount)}</span>
        <span>${token.readable(token.amount, token.usd)}</span>
      </div>
    </div>
  );
};

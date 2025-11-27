import { useState } from "react";
import { observer } from "mobx-react-lite";

import { formatter, Token } from "../../omni/token";
import { HotConnector } from "../../HotConnector";
import { OmniWallet } from "../../omni/OmniWallet";
import { OmniToken } from "../../omni/config";
import { omni } from "../../omni/exchange";
import { PopupOption } from "../styles";
import TokenCard from "./TokenCard";
import Popup from "../Popup";

interface SelectTokenPopupProps {
  hot: HotConnector;
  initialChain?: number;
  onClose: () => void;
  onSelect: (token: Token, wallet?: OmniWallet) => void;
}

export const SelectTokenPopup = ({ hot, initialChain, onClose, onSelect }: SelectTokenPopupProps) => {
  const [chain, setChain] = useState<number | null>(initialChain || null);
  console.log({ chain });

  if (chain == null) {
    const chains = [...new Set(hot.tokens.map((token) => token.chain))];
    return (
      <Popup onClose={onClose} header={<p>Select chain</p>}>
        {chains.map((chain) => {
          const ft = hot.tokens.find((t) => t.chain === chain);
          if (!ft) return;

          return (
            <PopupOption onClick={() => setChain(chain)}>
              <img src={ft.chainIcon} alt={ft.chainName} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: "50%" }} />
              <p style={{ fontSize: 24, fontWeight: "bold" }}>{ft.chainName}</p>
            </PopupOption>
          );
        })}
      </Popup>
    );
  }

  if (chain !== -4) {
    return (
      <Popup onClose={onClose} header={<p>Select token</p>}>
        {hot.tokens
          .filter((token) => token.chain === chain)
          .map((token) => {
            const wallet = hot.wallets.find((w) => w.type === token.type);
            return <TokenCard key={token.id} token={token} onSelect={onSelect} hot={hot} wallet={wallet} />;
          })}
      </Popup>
    );
  }

  const omniWallets = hot.wallets.filter((t) => !!t.omniAddress);
  return (
    <Popup onClose={onClose} header={<p>Select token</p>}>
      {omniWallets.map((wallet, i) => (
        <div key={wallet.address} style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8, marginTop: i > 0 ? 16 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 32 }}>
            <img src={wallet.icon} alt={wallet.icon} style={{ width: 24, height: 24, objectFit: "cover", borderRadius: "50%" }} />
            <p style={{ marginTop: -4, fontSize: 20, fontWeight: "bold", color: "#c6c6c6" }}>{formatter.truncateAddress(wallet.address, 24)}</p>
          </div>

          {Object.values(OmniToken).map((token) => (
            <TokenCard key={token} token={omni.omni(token)} onSelect={onSelect} hot={hot} wallet={wallet} />
          ))}
        </div>
      ))}

      {omniWallets.length === 0 && (
        <>
          {Object.values(OmniToken).map((token) => (
            <TokenCard key={token} token={omni.omni(token)} onSelect={onSelect} hot={hot} />
          ))}
        </>
      )}
    </Popup>
  );
};

export default observer(SelectTokenPopup);

import { observer } from "mobx-react-lite";
import React, { useState } from "react";

import { HotConnector } from "../HotConnector";
import { ConnectorType, OmniConnector, OmniConnectorOption } from "../omni/OmniConnector";
import { formatter } from "../omni/token";

import { LogoutIcon } from "./icons/logout";
import Popup from "./Popup";

interface MultichainPopupProps {
  connector?: OmniConnector;
  hot: HotConnector;
  onClose: () => void;
}

const Connector: React.FC<MultichainPopupProps> = ({ hot, onClose, connector: initialConnector }) => {
  const [connector, setConnector] = useState<OmniConnector | null>(initialConnector ?? null);
  const [wallet, setWallet] = useState<OmniConnectorOption | null>(null);

  const selectConnector = async (t: OmniConnector) => {
    if (t.wallets[0]) return t.disconnect();
    if (t.options.length > 0) return setConnector(t);
    await t.connect().finally(() => onClose());
  };

  if (wallet != null) {
    return (
      <Popup header={<p>Connecting</p>} onClose={onClose}>
        <div style={{ width: "100%", height: 300, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 16 }}>
          <img src={wallet.icon} alt={wallet.name} style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 16, background: "#000" }} />
          <h3 style={{ textAlign: "center" }}>{wallet.name}</h3>
        </div>
      </Popup>
    );
  }

  if (connector != null) {
    return (
      <Popup header={<p>Select wallet</p>} onClose={onClose}>
        {connector.options.map((wallet) => (
          <div
            key={wallet.id}
            className="connect-item"
            onClick={async () => {
              setWallet(wallet);
              await connector.connect(wallet.id);
              onClose();
            }}
          >
            <img src={wallet.icon} style={{ background: "#000" }} />
            <div className="connect-item-info">
              <span>{wallet.name}</span>
            </div>
          </div>
        ))}
      </Popup>
    );
  }

  const onechain = hot.connectors.filter((t) => t.type === ConnectorType.WALLET);
  const social = hot.connectors.filter((t) => t.type === ConnectorType.SOCIAL);

  return (
    <Popup header={<p>Select network</p>} onClose={onClose}>
      {onechain.map((t) => (
        <div key={t.id} className="connect-item" onClick={() => selectConnector(t)}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000" }}>
            <img src={t.icon} alt={t.name} />
          </div>
          <div className="connect-item-info">
            <span>{t.name}</span>
            {t.wallets[0]?.address && <span className="wallet-address">{formatter.truncateAddress(t.wallets[0].address)}</span>}
          </div>
          {t.wallets[0]?.address && <LogoutIcon />}
        </div>
      ))}

      {social.length > 0 && (
        <>
          <div style={{ margin: "4px 0", display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.1)" }}></div>
            <div>or</div>
            <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.1)" }}></div>
          </div>

          {social.map((t) => (
            <div key={t.id} className="connect-item" onClick={() => selectConnector(t)}>
              <img src={t.icon} alt={t.name} />
              <div className="connect-item-info">
                <span>{t.name}</span>
                {t.wallets[0]?.address && <span className="wallet-address">Multichain connected</span>}
              </div>
              {t.wallets[0]?.address && <LogoutIcon />}
            </div>
          ))}
        </>
      )}
    </Popup>
  );
};

export default observer(Connector);

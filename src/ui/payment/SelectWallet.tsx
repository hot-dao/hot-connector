import { observer } from "mobx-react-lite";
import styled from "styled-components";
import { useState } from "react";

import { PopupOption, PopupOptionInfo } from "../styles";
import { HotConnector } from "../../HotConnector";
import { ConnectorType } from "../../omni/OmniConnector";
import { OmniWallet } from "../../omni/OmniWallet";
import { WalletType } from "../../omni/config";
import { openWalletPicker } from "../router";
import { formatter } from "../../omni/token";
import Popup from "../Popup";

const SelectWallet = ({
  current,
  isRecipient,
  hot,
  type,
  onSelect,
  onClose,
}: {
  current?: OmniWallet | "qr";
  isRecipient: boolean;
  type: WalletType;
  onSelect: (wallet?: OmniWallet | "qr") => void;
  hot: HotConnector;
  onClose: () => void;
}) => {
  const connectors = hot.connectors.filter((t) => t.walletTypes.includes(type) && t.type !== ConnectorType.SOCIAL);
  const [customAddress, setCustomAddress] = useState<string>(current instanceof OmniWallet ? current.address : "");
  const noExternal = type === WalletType.OMNI || type === WalletType.COSMOS;

  const selectCustom = async () => {
    const wallet = await connectors[0].createWallet(customAddress);
    onSelect(wallet);
    onClose();
  };

  return (
    <Popup header={isRecipient ? <p>Select recipient</p> : <p>Select sender</p>} onClose={onClose}>
      {!noExternal && isRecipient && (
        <div style={{ width: "100%", marginBottom: 24 }}>
          <p style={{ fontSize: 16, textAlign: "left" }}>Enter recipient address, avoid CEX</p>
          <CustomRecipient>
            <input //
              type="text"
              placeholder="Enter wallet address"
              onChange={(e) => setCustomAddress(e.target.value)}
              value={customAddress}
            />
            <button onClick={selectCustom} disabled={customAddress.length === 0}>
              Select
            </button>
          </CustomRecipient>
        </div>
      )}

      {!noExternal && !isRecipient && (
        <PopupOption onClick={() => (onSelect("qr"), onClose())}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000" }}></div>
          <PopupOptionInfo>
            <p style={{ fontSize: 20, fontWeight: "bold" }}>Send via QR code</p>
            <span className="wallet-address">From CEX or external wallet</span>
          </PopupOptionInfo>
        </PopupOption>
      )}

      {connectors.map((t) => (
        <PopupOption key={t.id} onClick={() => (t.wallets[0] ? (onSelect(t.wallets[0]), onClose()) : openWalletPicker(t))}>
          <div style={{ width: 44, height: 44, borderRadius: 16, background: "#000" }}>
            <img src={t.icon} alt={t.name} />
          </div>
          <PopupOptionInfo>
            <p style={{ fontSize: 20, fontWeight: "bold" }}>{t.name}</p>
            {t.wallets[0]?.address && <span className="wallet-address">{formatter.truncateAddress(t.wallets[0].address)}</span>}
          </PopupOptionInfo>
          {!t.wallets[0]?.address ? <p>Connect</p> : <p>Select</p>}
        </PopupOption>
      ))}
    </Popup>
  );
};

const CustomRecipient = styled.div`
  display: flex;
  align-items: center;
  border: 1px solid #2d2d2d;
  border-radius: 12px;
  overflow: hidden;
  margin-top: 8px;
  height: 50px;

  input {
    width: 100%;
    padding: 12px;
    background: #161616;
    color: #fff;
    outline: none;
    font-size: 16px;
    font-weight: bold;
    text-align: left;
    outline: none;
    border: none;
    height: 100%;
    flex: 1;
  }

  button {
    width: 100px;
    color: #fff;
    background: #000000;
    border-radius: 0px;
    margin: 0px;
    outline: none;
    border: none;
    height: 100%;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
  }
`;

export default observer(SelectWallet);

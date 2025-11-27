import React from "react";

import Popup from "../Popup";
import { OmniConnector } from "../../omni/OmniConnector";
import { PopupButton } from "../styles";

interface LogoutPopupProps {
  connector: OmniConnector;
  onApprove: () => void;
  onReject: () => void;
}

const LogoutPopup: React.FC<LogoutPopupProps> = ({ connector, onApprove, onReject }) => {
  return (
    <Popup header={<p>Disconnect {connector.name}</p>} onClose={onReject}>
      <p style={{ textAlign: "center", color: "#fff" }}>Your local session will be cleared, see you there!</p>
      <PopupButton onClick={onApprove}>Bye-bye</PopupButton>
    </Popup>
  );
};

export default LogoutPopup;

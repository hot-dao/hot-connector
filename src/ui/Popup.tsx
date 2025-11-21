import { createPortal } from "react-dom";
import React from "react";
import { css } from "./popups/styles";

const Popup = ({ children, header, onClose }: { children: React.ReactNode; header: React.ReactNode; onClose: () => void }) => {
  return createPortal(
    <div className="wibe3-popup">
      <style>{css(".wibe3-popup")}</style>
      <div className="modal-container" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">{header}</div>
          <div className="modal-body">{children}</div>
          <div className="footer">
            <img src="https://tgapp.herewallet.app/images/hot/hot-icon.png" alt="HOT Connector" />
            <p>HOT Connector</p>
            <p className="get-wallet-link">Don't have a wallet?</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Popup;

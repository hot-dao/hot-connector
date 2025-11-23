import { createRoot } from "react-dom/client";
import React, { useEffect, useRef } from "react";

import { css } from "./styles";

export const present = <T,>(render: (resolve: (value: T) => void, reject: (reason?: any) => void) => React.ReactNode): Promise<T> => {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  const promise = new Promise<T>((resolve, reject) => {
    root.render(render(resolve, reject));
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

const Popup = ({ children, header, onClose }: { children: React.ReactNode; header?: React.ReactNode; onClose: () => void }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTimeout(() => {
      const modalContainer = ref.current?.querySelector(".modal-container");
      if (modalContainer instanceof HTMLElement) {
        modalContainer.style.opacity = "1";
        modalContainer.style.transform = "translateY(0)";
      }

      const modalContent = ref.current?.querySelector(".modal-content");
      if (modalContent instanceof HTMLElement) {
        modalContent.style.opacity = "1";
        modalContent.style.transform = "translateY(0)";
      }
    }, 100);
  }, []);

  return (
    <div className="wibe3-popup" ref={ref}>
      <style>{css(".wibe3-popup")}</style>
      <div className="modal-container" onClick={onClose} style={{ opacity: 0, transition: "all 0.2s ease-in-out" }}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ opacity: 0, transform: "translateY(20px)", transition: "all 0.2s ease-in-out" }}>
          {header && <div className="modal-header">{header}</div>}
          <div className="modal-body" style={{ overflowX: "hidden" }}>
            {children}
          </div>
          <div className="footer">
            <img src="https://tgapp.herewallet.app/images/hot/hot-icon.png" alt="HOT Connector" />
            <p>HOT Connector</p>
            <p className="get-wallet-link">Don't have a wallet?</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Popup;

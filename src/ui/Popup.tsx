import { createRoot } from "react-dom/client";
import React, { useEffect, useRef } from "react";
import { PopupRoot, ModalContainer, ModalContent, ModalHeader, ModalBody, Footer, GetWalletLink } from "./styles";

export const present = (render: (close: () => void) => React.ReactNode) => {
  const div = document.createElement("div");
  div.className = "wibe3-popup";
  document.body.appendChild(div);
  const root = createRoot(div);

  root.render(
    render(() => {
      root.unmount();
      div.remove();
    })
  );
};

const Popup = ({ widget, children, header, onClose }: { widget?: boolean; children: React.ReactNode; header?: React.ReactNode; onClose: () => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (widget) return;
    setTimeout(() => {
      if (containerRef.current) {
        containerRef.current.style.opacity = "1";
        containerRef.current.style.transform = "translateY(0)";
      }

      if (contentRef.current) {
        contentRef.current.style.opacity = "1";
        contentRef.current.style.transform = "translateY(0)";
      }
    }, 100);
  }, []);

  if (widget) {
    return <PopupRoot>{children}</PopupRoot>;
  }

  return (
    <PopupRoot>
      <ModalContainer ref={containerRef} onClick={onClose} style={{ opacity: 0, transition: "all 0.2s ease-in-out" }}>
        <ModalContent ref={contentRef} onClick={(e) => e.stopPropagation()} style={{ opacity: 0, transform: "translateY(20px)", transition: "all 0.2s ease-in-out" }}>
          {header && <ModalHeader>{header}</ModalHeader>}
          <ModalBody style={{ overflowX: "hidden" }}>{children}</ModalBody>
          <Footer>
            <img src="https://tgapp.herewallet.app/images/hot/hot-icon.png" alt="HOT Connector" />
            <p>HOT Connector</p>
            <GetWalletLink>Don't have a wallet?</GetWalletLink>
          </Footer>
        </ModalContent>
      </ModalContainer>
    </PopupRoot>
  );
};

export default Popup;

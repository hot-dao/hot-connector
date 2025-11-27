import { HotConnector } from "../HotConnector";
import { OmniConnector } from "../omni/OmniConnector";
import { BridgeReview } from "../omni/exchange";
import { Token } from "../omni/token";
import { OmniWallet } from "../omni/OmniWallet";
import { WalletType } from "../omni/config";

import { present } from "./Popup";
import Payment from "./payment/Payment";
import LogoutPopup from "./connect/LogoutPopup";
import Bridge from "./payment/Bridge";
import Connector from "./connect/ConnectWallet";
import Profile from "./payment/Profile";
import SelectTokenPopup from "./payment/SelectToken";
import WalletPicker from "./connect/WalletPicker";
import SelectWallet from "./payment/SelectWallet";
import { BridgeProps } from "./payment/Bridge";

export const openPayment = (connector: HotConnector, token: Token, amount: bigint, receiver: string) => {
  return new Promise<Promise<BridgeReview>>((resolve, reject) => {
    present((close) => (
      <Payment //
        onReject={() => (close(), reject())}
        onProcess={resolve}
        connector={connector}
        token={token}
        amount={amount}
        receiver={receiver}
      />
    ));
  });
};

export const openLogoutPopup = (connector: OmniConnector) => {
  return new Promise<void>((resolve, reject) => {
    present((close) => {
      return (
        <LogoutPopup //
          connector={connector}
          onApprove={() => (close(), resolve())}
          onReject={() => (close(), reject(new Error("User rejected")))}
        />
      );
    });
  });
};

export const openBridge = (hot: HotConnector, setup?: BridgeProps["setup"]) => {
  return new Promise<BridgeReview>((resolve, reject) => {
    present((close) => (
      <Bridge //
        hot={hot}
        setup={setup}
        onProcess={resolve}
        onClose={() => (close(), reject(new Error("User rejected")))}
      />
    ));
  });
};

export const openConnector = (hot: HotConnector, connector?: OmniConnector) => {
  present((close) => <Connector hot={hot} onClose={close} />);
};

export const openProfile = (hot: HotConnector) => {
  present((close) => <Profile hot={hot} onClose={close} />);
};

export const openSelectTokenPopup = ({ hot, initialChain, onSelect }: { hot: HotConnector; initialChain?: number; onSelect: (token: Token, wallet?: OmniWallet) => void }) => {
  present((close) => <SelectTokenPopup hot={hot} initialChain={initialChain} onClose={close} onSelect={(t, w) => (onSelect(t, w), close())} />);
};

export const openWalletPicker = (connector: OmniConnector) => {
  present((close) => <WalletPicker initialConnector={connector} onClose={close} />);
};

export const openSelectWallet = (props: { hot: HotConnector; current?: OmniWallet | "qr"; isRecipient: boolean; type: WalletType; onSelect: (wallet?: OmniWallet | "qr") => void }) => {
  present((close) => <SelectWallet {...props} onClose={close} />);
};

import { HotConnector } from "../HotConnector";
import { OmniConnector } from "../omni/OmniConnector";
import { BridgeReview } from "../omni";
import { Token } from "../omni/token";

import { present } from "./Popup";
import Payment from "./Payment";
import LogoutPopup from "./LogoutPopup";
import Bridge, { SelectTokenPopup } from "./Bridge";
import Connector from "./ConnectWallet";
import Deposit from "./OmniDeposit";
import Withdraw from "./OmniWithdraw";
import Profile from "./Profile";

export const openPayment = (connector: HotConnector, token: Token, amount: bigint, receiver: string) => {
  return present<BridgeReview>((resolve, reject) => {
    return <Payment onReject={reject} onSuccess={resolve} connector={connector} token={token} amount={amount} receiver={receiver} />;
  });
};

export const openLogoutPopup = (connector: OmniConnector): Promise<void> => {
  return present<void>((resolve, reject) => {
    return <LogoutPopup connector={connector} onApprove={() => resolve()} onReject={() => reject(new Error("User rejected"))} />;
  });
};

export const openBridge = (hot: HotConnector) => {
  return present<BridgeReview>((resolve, reject) => {
    return <Bridge onClose={reject} hot={hot} />;
  });
};

export const openConnector = (hot: HotConnector, connector?: OmniConnector) => {
  return present<void>((resolve, reject) => {
    return <Connector hot={hot} connector={connector} onClose={() => reject(new Error("User rejected"))} />;
  });
};

export const openProfile = (hot: HotConnector) => {
  return present<void>((resolve, reject) => {
    return <Profile hot={hot} onClose={() => resolve()} />;
  });
};

export const openSelectTokenPopup = ({ hot, initialChain, onSelect }: { hot: HotConnector; initialChain?: number; onSelect: (token: Token) => void }) => {
  return present<Token | null>((resolve, reject) => {
    return <SelectTokenPopup hot={hot} initialChain={initialChain} onClose={reject} onSelect={(t) => (onSelect(t), reject())} />;
  });
};

export const openDeposit = (hot: HotConnector, token: Token, amount: number) => {
  return present<void>((resolve, reject) => {
    return <Deposit onClose={reject} onSuccess={resolve} hot={hot} token={token} amount={amount} />;
  });
};

export const openWithdraw = (hot: HotConnector, token: Token, amount: number) => {
  return present<void>((resolve, reject) => {
    return <Withdraw onClose={reject} onSuccess={resolve} hot={hot} token={token} amount={amount} />;
  });
};

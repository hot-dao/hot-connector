import { useState, useCallback, useEffect } from "react";

import { HotConnector } from "./HotConnector";
import { OmniWallet } from "./omni/OmniWallet";

export const useWibe3 = (hot: HotConnector) => {
  const [wallet, setWallet] = useState<OmniWallet | null>(hot.wallets[0]);

  useEffect(() => {
    const offConnect = hot.onConnect(async ({ wallet }) => setWallet(wallet));
    const offDisconnect = hot.onDisconnect(() => setWallet(null));
    return () => (offConnect(), offDisconnect());
  }, [hot]);

  const connect = useCallback(async () => {
    await hot.connect();
  }, [hot]);

  return { wallet, connect };
};

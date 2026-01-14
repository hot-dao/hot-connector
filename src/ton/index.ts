import type { TonConnectorOptions } from "./connector";
import TonConnector from "./connector";
import TonWallet from "./wallet";
import "./injected";

import { HotConnector } from "../HotConnector";

export default (options?: TonConnectorOptions) => async (wibe3: HotConnector) => new TonConnector(wibe3, options);

export { TonConnector, TonConnectorOptions, TonWallet };

import { HotConnector } from "../HotConnector";
import TronConnector from "./connector";
import TronWallet from "./wallet";

export { TronConnector, TronWallet };

export default () => async (wibe3: HotConnector) => new TronConnector(wibe3);

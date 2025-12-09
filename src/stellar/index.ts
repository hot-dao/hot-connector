import StellarConnector from "./connector";
import StellarWallet from "./wallet";
import { HotConnector } from "../HotConnector";

export { StellarConnector, StellarWallet };

export default () => async (wibe3: HotConnector) => new StellarConnector(wibe3);

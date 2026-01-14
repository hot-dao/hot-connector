import EvmConnector from "./connector";
import { HotConnector } from "../HotConnector";

export { default as EvmConnector } from "./connector";
export { default as EvmWallet } from "./wallet";
import "./injected";

export default () => async (wibe3: HotConnector) => new EvmConnector(wibe3);

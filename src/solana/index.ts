import { HotConnector } from "../HotConnector";
import SolanaConnector from "./connector";
import SolanaWallet from "./wallet";

export { SolanaConnector, SolanaWallet };

export default () => async (wibe3: HotConnector) => new SolanaConnector(wibe3);

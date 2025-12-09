import GoogleConnector, { GoogleConnectorOptions } from "./google";
import { HotConnector } from "../HotConnector";

export { GoogleConnector, GoogleConnectorOptions };

export default (options?: GoogleConnectorOptions) => async (wibe3: HotConnector) => new GoogleConnector(wibe3, options);

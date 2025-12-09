import type { CosmosConnectorOptions } from "./connector";
import CosmosConnector from "./connector";
import CosmosWallet from "./wallet";

import { HotConnector } from "../HotConnector";

export { CosmosConnector, CosmosConnectorOptions, CosmosWallet };

export default (options?: CosmosConnectorOptions) => async (wibe3: HotConnector) => new CosmosConnector(wibe3, options);

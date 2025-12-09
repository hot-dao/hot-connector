import near from "./near";
import stellar from "./stellar";
import ton from "./ton";
import solana from "./solana";
import evm from "./evm";

export const defaultConnectors = [near(), evm(), solana(), ton(), stellar()];

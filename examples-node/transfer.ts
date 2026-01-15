import "dotenv/config";
import { base58 } from "@scure/base";
import { Intents, Recipient, WalletType, tokens, Ed25519Wallet } from "../src/core";
import { OmniToken } from "../src/core";

if (!process.env.ED25519_PRIVATE_KEY_BASE58) {
  throw new Error("ED25519_PRIVATE_KEY_BASE58 is not set in .env file");
}

if (!process.env.ED25519_SIGNER_ID) {
  throw new Error("ED25519_SIGNER_ID is not set in .env file");
}

const PRIVATE_KEY = base58.decode(process.env.ED25519_PRIVATE_KEY_BASE58);
const SIGNER_ID = process.env.ED25519_SIGNER_ID;

const main = async () => {
  const wallet = new Ed25519Wallet(Buffer.from(PRIVATE_KEY), SIGNER_ID);

  const token = tokens.get(OmniToken.NEAR);
  const assets = await wallet.getAssets();
  console.log("NEAR balance:", token.float(assets[token.omniAddress]));

  const recipient = await Recipient.fromAddress(WalletType.NEAR, SIGNER_ID);
  const hash = await Intents.builder(wallet)
    .transfer({
      recipient: recipient.omniAddress,
      token: OmniToken.NEAR,
      amount: 0.1,
    })
    .execute();

  console.log("Hash:", hash);
};

main();

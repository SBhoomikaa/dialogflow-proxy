// test-env.js
import dotenv from "dotenv";
dotenv.config();

const decoded = JSON.parse(
  Buffer.from(process.env.DIALOGFLOW_SERVICE_ACCOUNT_BASE64, "base64").toString("utf8")
);
console.log(decoded);

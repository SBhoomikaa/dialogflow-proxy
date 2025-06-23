import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleAuth } from "google-auth-library";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Load and decode base64-encoded service account JSON
const base64Key = process.env.DIALOGFLOW_KEY_BASE64;

if (!base64Key) {
  console.error("❌ Missing DIALOGFLOW_KEY_BASE64 env variable");
  process.exit(1);
}

let serviceAccount;

try {
  const jsonString = Buffer.from(base64Key, "base64").toString("utf8");
  serviceAccount = JSON.parse(jsonString);
} catch (err) {
  console.error("❌ Failed to decode or parse service account JSON:", err);
  process.exit(1);
}

const projectId = serviceAccount.project_id;

console.log("📌 ENV DEBUG:");
console.log("▶️  projectId:", projectId);
console.log("▶️  clientEmail:", serviceAccount.client_email);
console.log("▶️  privateKey starts with:", serviceAccount.private_key.slice(0, 30));
console.log("▶️  privateKey ends with:", serviceAccount.private_key.slice(-30));
console.log("▶️  privateKey length:", serviceAccount.private_key.length);

// ✅ Use GoogleAuth with credentials directly
const auth = new GoogleAuth({
  credentials: serviceAccount,
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

async function getAccessToken() {
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

app.post("/detect-intent", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Missing text input" });

  try {
    const token = await getAccessToken();
    const sessionId = Math.random().toString(36).substring(7);

    const response = await fetch(
      `https://dialogflow.googleapis.com/v2/projects/${projectId}/agent/sessions/${sessionId}:detectIntent`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          queryInput: {
            text: {
              text,
              languageCode: "en",
            },
          },
        }),
      }
    );

    const data = await response.json();

    res.json(data.queryResult);
  } catch (err) {
    console.error("🔥 Error in /detect-intent:", err);
    res.status(500).json({ error: "Dialogflow proxy failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Proxy running on port ${PORT}`));

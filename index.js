import express from "express";
import cors from "cors";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const base64Key = process.env.DIALOGFLOW_KEY_BASE64;

if (!base64Key) {
  console.error("❌ Missing DIALOGFLOW_KEY_BASE64 env variable");
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(base64Key, "base64").toString("utf8")
);

const projectId = serviceAccount.project_id;
const clientEmail = serviceAccount.client_email;
const privateKey = serviceAccount.private_key;

console.log("📌 ENV DEBUG:");
console.log("▶️  projectId:", projectId);
console.log("▶️  clientEmail:", clientEmail);
console.log("▶️  privateKey starts with:", privateKey.slice(0, 30));
console.log("▶️  privateKey ends with:", privateKey.slice(-30));

async function getAccessToken() {
  const jwtClient = new google.auth.JWT(
    clientEmail,
    null,
    privateKey,
    ["https://www.googleapis.com/auth/cloud-platform"]
  );
  await jwtClient.authorize();
  return jwtClient.credentials.access_token;
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

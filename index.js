import express from "express";
import cors from "cors";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const base64Key = process.env.DIALOGFLOW_SERVICE_ACCOUNT_BASE64;

if (!base64Key) {
  console.error("❌ Missing base64 key in env");
  process.exit(1);
}

const decoded = JSON.parse(Buffer.from(base64Key, "base64").toString("utf8"));
const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = decoded;

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

    const dialogflowRes = await fetch(
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

    const data = await dialogflowRes.json();
    res.json(data.queryResult);
  } catch (err) {
    console.error("🔥 Error in /detect-intent:", err.message);
    res.status(500).json({ error: "Dialogflow proxy failed" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Proxy running on port ${PORT}`));

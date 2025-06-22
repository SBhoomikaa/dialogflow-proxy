import express from "express";
import cors from "cors";
import { google } from "googleapis";
import dotenv from "dotenv";
import fetch from "node-fetch"; // ✅ Required for Node.js < v18

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Step 1: Load and decode service account key
const base64Key = process.env.DIALOGFLOW_SERVICE_ACCOUNT_BASE64;

if (!base64Key) {
  console.error("❌ DIALOGFLOW_SERVICE_ACCOUNT_BASE64 not found in environment variables!");
  process.exit(1);
}

let serviceAccount;
try {
  const decoded = Buffer.from(base64Key, "base64").toString("utf8");
  serviceAccount = JSON.parse(decoded);
  console.log("✅ Service account decoded:", {
    client_email: serviceAccount.client_email,
    project_id: serviceAccount.project_id,
  });
} catch (err) {
  console.error("❌ Failed to decode service account key:", err);
  process.exit(1);
}

// ✅ Step 2: Extract key details
const { project_id: projectId, client_email: clientEmail, private_key: privateKey } = serviceAccount;

// ✅ Step 3: Create Google Auth client
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

// ✅ Step 4: Handle Dialogflow requests
app.post("/detect-intent", async (req, res) => {
  const { text } = req.body;

  if (!text) return res.status(400).json({ error: "Missing text input" });

  try {
    const token = await getAccessToken();
    const sessionId = Math.random().toString(36).substring(7); // Random short session ID

    const url = `https://dialogflow.googleapis.com/v2/projects/${projectId}/agent/sessions/${sessionId}:detectIntent`;

    const dialogflowRes = await fetch(url, {
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
    });

    const data = await dialogflowRes.json();

    if (!dialogflowRes.ok) {
      console.error("❌ Dialogflow error:", data);
      return res.status(500).json({ error: "Dialogflow API error", detail: data });
    }

    console.log("🎯 Dialogflow response:", data.queryResult);
    res.json(data.queryResult);
  } catch (err) {
    console.error("🔥 Error in /detect-intent:", err);
    res.status(500).json({ error: "Dialogflow proxy failed", message: err.message });
  }
});

// ✅ Step 5: Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Dialogflow proxy running on port ${PORT}`);
});

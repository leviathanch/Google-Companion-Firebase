import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";
import axios from "axios";

admin.initializeApp();
const db = admin.firestore();
db.settings({ databaseId: 'companion' });
const app = express();

// 1. JSON Body Parser (Critical for POST requests)
app.use(express.json());

// 2. CORS
app.use(cors({ origin: true }));

// 3. Auth Middleware
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).send("Unauthorized: No token provided");
    return;
  }

  const accessToken = authHeader.split("Bearer ")[1];

  try {
    const response = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    (req as any).user = response.data;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(403).send("Unauthorized: Invalid token");
  }
};

app.use(authenticate);

// --- MEMORIES ENDPOINTS ---

app.get("/memories", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const snapshot = await db.collection(`users/${userId}/memories`).orderBy("timestamp", "desc").get();
    const memories = snapshot.docs.map(doc => doc.data());
    res.json(memories);
  } catch (e: any) {
    console.error("GET /memories Error:", e);
    res.status(500).send(e.message);
  }
});

app.post("/memories", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const memory = req.body;
    if (!memory || !memory.id) throw new Error("Invalid memory object: Missing ID");
    
    console.log(`Saving memory for user ${userId}:`, memory.id);
    await db.doc(`users/${userId}/memories/${memory.id}`).set(memory);
    res.json({ success: true });
  } catch (e: any) {
    console.error("POST /memories Error:", e);
    res.status(500).send(e.message);
  }
});

app.delete("/memories/:id", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const memoryId = req.params.id;
    await db.doc(`users/${userId}/memories/${memoryId}`).delete();
    res.json({ success: true });
  } catch (e: any) {
    console.error("DELETE /memories Error:", e);
    res.status(500).send(e.message);
  }
});

// --- SEARCH HISTORY ENDPOINTS ---

app.get("/search_history", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const snapshot = await db.collection(`users/${userId}/search_history`).orderBy("timestamp", "desc").limit(50).get();
    const history = snapshot.docs.map(doc => doc.data());
    res.json(history);
  } catch (e: any) {
    console.error("GET /search_history Error:", e);
    res.status(500).send(e.message);
  }
});

app.post("/search_history", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const item = req.body;
    if (!item || !item.id) throw new Error("Invalid search item: Missing ID");

    await db.doc(`users/${userId}/search_history/${item.id}`).set(item);
    res.json({ success: true });
  } catch (e: any) {
    console.error("POST /search_history Error:", e);
    res.status(500).send(e.message);
  }
});

app.delete("/search_history", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const batch = db.batch();
    const snapshot = await db.collection(`users/${userId}/search_history`).get();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) {
    console.error("DELETE /search_history Error:", e);
    res.status(500).send(e.message);
  }
});

// --- SETTINGS ENDPOINTS ---

app.get("/settings", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const doc = await db.doc(`users/${userId}/settings/config`).get();
    res.json(doc.exists ? doc.data() : {});
  } catch (e: any) {
    console.error("GET /settings Error:", e);
    res.status(500).send(e.message);
  }
});

app.post("/settings", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const config = req.body;
    await db.doc(`users/${userId}/settings/config`).set(config);
    res.json({ success: true });
  } catch (e: any) {
    console.error("POST /settings Error:", e);
    res.status(500).send(e.message);
  }
});

export const api = onRequest(app);

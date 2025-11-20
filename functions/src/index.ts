import { onRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express from "express";
import cors from "cors";
import axios from "axios";

admin.initializeApp();
const db = admin.firestore();
const app = express();

// Allow CORS from any origin
app.use(cors({ origin: true }));

// Middleware: Authenticate User via Google Access Token
const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).send("Unauthorized: No token provided");
    return;
  }

  const accessToken = authHeader.split("Bearer ")[1];

  try {
    // Verify the token with Google
    const response = await axios.get(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Attach user info to request
    // 'sub' is the unique Google User ID
    (req as any).user = response.data;
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    res.status(403).send("Unauthorized: Invalid token");
  }
};

app.use(authenticate);

// --- MEMORIES ENDPOINTS ---

// GET Memories
app.get("/memories", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const snapshot = await db.collection(`users/${userId}/memories`).orderBy("timestamp", "desc").get();
    const memories = snapshot.docs.map(doc => doc.data());
    res.json(memories);
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

// POST Memory
app.post("/memories", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const memory = req.body; // { id, text, timestamp }
    await db.doc(`users/${userId}/memories/${memory.id}`).set(memory);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

// DELETE Memory
app.delete("/memories/:id", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const memoryId = req.params.id;
    await db.doc(`users/${userId}/memories/${memoryId}`).delete();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

// --- SEARCH HISTORY ENDPOINTS ---

// GET Search History
app.get("/search_history", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const snapshot = await db.collection(`users/${userId}/search_history`).orderBy("timestamp", "desc").limit(50).get();
    const history = snapshot.docs.map(doc => doc.data());
    res.json(history);
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

// POST Search History
app.post("/search_history", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const item = req.body;
    await db.doc(`users/${userId}/search_history/${item.id}`).set(item);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

// DELETE Search History (Clear All)
app.delete("/search_history", async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const batch = db.batch();
    const snapshot = await db.collection(`users/${userId}/search_history`).get();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).send(e.message);
  }
});

export const api = onRequest(app);

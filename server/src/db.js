import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dataDir, "db.json");

const defaultDb = {
  users: [],
  chats: [],
  otps: []
};

function normalizeDb(db) {
  return {
    users: Array.isArray(db.users) ? db.users : [],
    chats: Array.isArray(db.chats) ? db.chats : [],
    otps: Array.isArray(db.otps) ? db.otps : []
  };
}

async function ensureDb() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dbPath);
  } catch {
    await fs.writeFile(dbPath, JSON.stringify(defaultDb, null, 2));
  }
}

export async function readDb() {
  await ensureDb();
  const raw = await fs.readFile(dbPath, "utf8");
  return normalizeDb(JSON.parse(raw || JSON.stringify(defaultDb)));
}

export async function writeDb(db) {
  await ensureDb();
  await fs.writeFile(dbPath, JSON.stringify(normalizeDb(db), null, 2));
}

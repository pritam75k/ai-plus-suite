import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import OpenAI from "openai";
import nodemailer from "nodemailer";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import multer from "multer";
import { readDb, writeDb } from "./db.js";

const app = express();
const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";
const AI_PROVIDER = String(process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "demo")).toLowerCase();
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || OPENAI_MODEL;
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || "gpt-4o-transcribe";
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1";
const IMAGE_PROVIDER = String(process.env.IMAGE_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "pollinations")).toLowerCase();
const OTP_EXPIRES_MINUTES = Number(process.env.OTP_EXPIRES_MINUTES || 10);
const openai =
  AI_PROVIDER === "openai" && process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    : null;

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
const groq =
  AI_PROVIDER === "groq" && process.env.GROQ_API_KEY
    ? new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1"
      })
    : null;

const GENERATED_DIR = path.resolve("generated");
const UPLOAD_DIR = path.resolve("uploads");
fs.mkdirSync(GENERATED_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 25 * 1024 * 1024 } });

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  if (CLIENT_ORIGIN === "*") return callback(null, true);
  const allowed = CLIENT_ORIGIN.split(",").map((item) => item.trim()).filter(Boolean);
  return callback(null, allowed.includes(origin));
}

app.use(cors({ origin: corsOrigin, credentials: CLIENT_ORIGIN !== "*" }));
app.use(express.json({ limit: "5mb" }));
app.use("/generated", express.static(GENERATED_DIR));

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    plan: user.plan || "Plus",
    hasPassword: Boolean(user.passwordHash),
    createdAt: user.createdAt
  };
}

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function createTransporter() {
  if (!hasSmtpConfig()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

async function sendOtpEmail({ to, otp, purpose }) {
  const title = purpose === "register" ? "Verify your new account" : "Verify your login";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0b1020;color:#f8fbff;border-radius:20px">
      <h2 style="margin:0 0 10px">AI Plus OTP</h2>
      <p style="color:#aab4c7">${title}. Your one-time password is:</p>
      <div style="font-size:34px;letter-spacing:8px;font-weight:800;background:rgba(255,255,255,.08);padding:18px 20px;border-radius:16px;text-align:center">${otp}</div>
      <p style="color:#aab4c7">This OTP expires in ${OTP_EXPIRES_MINUTES} minutes. Do not share it with anyone.</p>
    </div>`;

  const transporter = createTransporter();
  if (!transporter) {
    console.log(`\n[AI Plus OTP] ${purpose.toUpperCase()} OTP for ${to}: ${otp}\n`);
    return { deliveryMode: "console" };
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `AI Plus <${process.env.SMTP_USER}>`,
    to,
    subject: `AI Plus OTP: ${otp}`,
    text: `Your AI Plus OTP is ${otp}. It expires in ${OTP_EXPIRES_MINUTES} minutes.`,
    html
  });
  return { deliveryMode: "email" };
}

async function issueOtp(db, { email, purpose, pendingUser }) {
  const otp = generateOtp();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRES_MINUTES * 60 * 1000).toISOString();

  db.otps = db.otps.filter((item) => !(item.email === email && item.purpose === purpose));
  db.otps.push({
    id: nanoid(),
    email,
    purpose,
    otpHash: await bcrypt.hash(otp, 10),
    pendingUser: pendingUser || null,
    attempts: 0,
    createdAt: now.toISOString(),
    expiresAt
  });
  await writeDb(db);

  try {
    return await sendOtpEmail({ to: email, otp, purpose });
  } catch (error) {
    console.error("OTP email failed:", error);
    const freshDb = await readDb();
    freshDb.otps = freshDb.otps.filter((item) => !(item.email === email && item.purpose === purpose));
    await writeDb(freshDb);
    throw new Error("OTP email send failed. Check SMTP settings in server/.env");
  }
}

async function verifyOtpRecord(db, { email, purpose, otp }) {
  const record = db.otps.find((item) => item.email === email && item.purpose === purpose);
  if (!record) return { ok: false, status: 400, error: "OTP not found. Please request a new OTP." };
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    db.otps = db.otps.filter((item) => item.id !== record.id);
    await writeDb(db);
    return { ok: false, status: 400, error: "OTP expired. Please request a new OTP." };
  }
  if ((record.attempts || 0) >= 5) {
    db.otps = db.otps.filter((item) => item.id !== record.id);
    await writeDb(db);
    return { ok: false, status: 429, error: "Too many wrong attempts. Please request a new OTP." };
  }

  const valid = await bcrypt.compare(String(otp || "").trim(), record.otpHash);
  if (!valid) {
    record.attempts = (record.attempts || 0) + 1;
    await writeDb(db);
    return { ok: false, status: 401, error: "Wrong OTP" };
  }

  return { ok: true, record };
}

async function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Login required" });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = await readDb();
    const user = db.users.find((u) => u.id === payload.id);
    if (!user) return res.status(401).json({ error: "Invalid token" });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

function currentAiMode() {
  if (AI_PROVIDER === "groq" && groq) return "groq";
  if (AI_PROVIDER === "ollama") return "ollama";
  if (openai) return "openai";
  return "demo";
}

app.get("/api/health", (_, res) => {
  res.json({
    ok: true,
    aiMode: currentAiMode(),
    ollamaUrl: AI_PROVIDER === "ollama" ? OLLAMA_URL : undefined,
    ollamaModel: AI_PROVIDER === "ollama" ? OLLAMA_MODEL : undefined,
    groqModel: AI_PROVIDER === "groq" ? GROQ_MODEL : undefined,
    imageMode: openai && IMAGE_PROVIDER === "openai" ? "openai" : IMAGE_PROVIDER === "pollinations" ? "pollinations" : "demo",
    voiceMode: openai ? "openai" : "browser_only",
    otpMode: hasSmtpConfig() ? "email" : "console"
  });
});

// Registration: name + email + password, then OTP verification.
// Password is saved only after OTP verification succeeds.
app.post("/api/auth/register/start", async (req, res) => {
  const { name, email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const cleanPassword = String(password || "");

  if (!name || !normalizedEmail || !cleanPassword) {
    return res.status(400).json({ error: "Name, email and password are required" });
  }
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: "Enter a valid email address" });
  }
  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const db = await readDb();
  if (db.users.some((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: "Email already exists. Please login instead." });
  }

  const pendingUser = {
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: await bcrypt.hash(cleanPassword, 10),
    plan: "Plus"
  };

  const delivery = await issueOtp(db, { email: normalizedEmail, purpose: "register", pendingUser });
  res.json({
    requiresOtp: true,
    email: normalizedEmail,
    ...delivery,
    message: delivery.deliveryMode === "email" ? "OTP sent to your email. Verify to create account and save password." : "SMTP not configured. OTP printed in server terminal. Verify to create account and save password."
  });
});

app.post("/api/auth/register/verify", async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  const otp = req.body?.otp;
  const db = await readDb();
  const result = await verifyOtpRecord(db, { email: normalizedEmail, purpose: "register", otp });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  if (db.users.some((u) => u.email === normalizedEmail)) {
    db.otps = db.otps.filter((item) => item.id !== result.record.id);
    await writeDb(db);
    return res.status(409).json({ error: "Email already exists" });
  }
  if (!result.record.pendingUser) {
    db.otps = db.otps.filter((item) => item.id !== result.record.id);
    await writeDb(db);
    return res.status(400).json({ error: "Registration session invalid. Please register again." });
  }

  const user = {
    id: nanoid(),
    ...result.record.pendingUser,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  db.otps = db.otps.filter((item) => item.id !== result.record.id);
  await writeDb(db);
  res.status(201).json({ user: publicUser(user), token: signToken(user) });
});

// Login option 1: password only. No OTP needed.
app.post("/api/auth/login/password", async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = normalizeEmail(email);
  const db = await readDb();
  const user = db.users.find((u) => u.email === normalizedEmail);
  if (!user) return res.status(401).json({ error: "Account not found" });
  if (!user.passwordHash) return res.status(401).json({ error: "Password is not set for this account. Use Forgot Password to create a new password." });
  if (!(await bcrypt.compare(password || "", user.passwordHash))) {
    return res.status(401).json({ error: "Wrong password" });
  }
  res.json({ user: publicUser(user), token: signToken(user) });
});

// Login option 2: email OTP only. No password needed.
async function startLoginOtp(req, res) {
  const normalizedEmail = normalizeEmail(req.body?.email);
  if (!isValidEmail(normalizedEmail)) return res.status(400).json({ error: "Enter a valid email address" });

  const db = await readDb();
  const user = db.users.find((u) => u.email === normalizedEmail);
  if (!user) return res.status(404).json({ error: "Account not found. Please register first." });

  const delivery = await issueOtp(db, { email: normalizedEmail, purpose: "login" });
  res.json({
    requiresOtp: true,
    email: normalizedEmail,
    ...delivery,
    message: delivery.deliveryMode === "email" ? "OTP sent to your email" : "SMTP not configured. OTP printed in server terminal."
  });
}

async function verifyLoginOtp(req, res) {
  const normalizedEmail = normalizeEmail(req.body?.email);
  const otp = req.body?.otp;
  const db = await readDb();
  const result = await verifyOtpRecord(db, { email: normalizedEmail, purpose: "login", otp });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  const user = db.users.find((u) => u.email === normalizedEmail);
  if (!user) {
    db.otps = db.otps.filter((item) => item.id !== result.record.id);
    await writeDb(db);
    return res.status(404).json({ error: "Account not found" });
  }

  db.otps = db.otps.filter((item) => item.id !== result.record.id);
  await writeDb(db);
  res.json({ user: publicUser(user), token: signToken(user) });
}

app.post("/api/auth/login/otp/start", startLoginOtp);
app.post("/api/auth/login/otp/verify", verifyLoginOtp);

// Backward-compatible aliases for old frontend/mobile builds.
app.post("/api/auth/login/start", startLoginOtp);
app.post("/api/auth/login/verify", verifyLoginOtp);

app.post("/api/auth/password/forgot/start", async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  if (!isValidEmail(normalizedEmail)) return res.status(400).json({ error: "Enter a valid email address" });

  const db = await readDb();
  const user = db.users.find((u) => u.email === normalizedEmail);
  if (!user) return res.status(404).json({ error: "Account not found. Please register first." });

  const delivery = await issueOtp(db, { email: normalizedEmail, purpose: "reset" });
  res.json({
    requiresOtp: true,
    email: normalizedEmail,
    ...delivery,
    message: delivery.deliveryMode === "email" ? "Password reset OTP sent to your email" : "SMTP not configured. Password reset OTP printed in server terminal."
  });
});

app.post("/api/auth/password/forgot/verify", async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  const otp = req.body?.otp;
  const password = String(req.body?.password || "");
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

  const db = await readDb();
  const result = await verifyOtpRecord(db, { email: normalizedEmail, purpose: "reset", otp });
  if (!result.ok) return res.status(result.status).json({ error: result.error });

  const user = db.users.find((u) => u.email === normalizedEmail);
  if (!user) {
    db.otps = db.otps.filter((item) => item.id !== result.record.id);
    await writeDb(db);
    return res.status(404).json({ error: "Account not found" });
  }

  user.passwordHash = await bcrypt.hash(password, 10);
  db.otps = db.otps.filter((item) => item.id !== result.record.id);
  await writeDb(db);
  res.json({ user: publicUser(user), token: signToken(user), message: "New password saved. You are logged in." });
});

app.post("/api/auth/password/set", auth, async (req, res) => {
  const password = String(req.body?.password || "");
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  const db = await readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  user.passwordHash = await bcrypt.hash(password, 10);
  await writeDb(db);
  res.json({ user: publicUser(user), message: "Password saved. Next time you can login with password." });
});

app.get("/api/me", auth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post("/api/plan/upgrade-demo", auth, async (req, res) => {
  const db = await readDb();
  const user = db.users.find((u) => u.id === req.user.id);
  user.plan = user.plan === "Plus" ? "Free" : "Plus";
  await writeDb(db);
  res.json({ user: publicUser(user) });
});

app.get("/api/chats", auth, async (req, res) => {
  const db = await readDb();
  const chats = db.chats
    .filter((c) => c.userId === req.user.id)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(({ messages, ...chat }) => ({ ...chat, messageCount: messages.length }));
  res.json({ chats });
});

app.post("/api/chats", auth, async (req, res) => {
  const db = await readDb();
  const chat = {
    id: nanoid(),
    userId: req.user.id,
    title: req.body?.title || "New chat",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.chats.push(chat);
  await writeDb(db);
  res.status(201).json({ chat });
});

app.get("/api/chats/:id", auth, async (req, res) => {
  const db = await readDb();
  const chat = db.chats.find((c) => c.id === req.params.id && c.userId === req.user.id);
  if (!chat) return res.status(404).json({ error: "Chat not found" });
  res.json({ chat });
});

app.delete("/api/chats/:id", auth, async (req, res) => {
  const db = await readDb();
  const before = db.chats.length;
  db.chats = db.chats.filter((c) => !(c.id === req.params.id && c.userId === req.user.id));
  if (db.chats.length === before) return res.status(404).json({ error: "Chat not found" });
  await writeDb(db);
  res.json({ ok: true });
});

function makeTitle(text) {
  const cleaned = String(text || "New chat").replace(/\s+/g, " ").trim();
  return cleaned.length > 34 ? `${cleaned.slice(0, 34)}...` : cleaned || "New chat";
}

function demoReply(message, user) {
  return `Demo AI: ${user.name}, aapne poocha: "${message}"

Free real AI ke liye Ollama install karo, phir server/.env me AI_PROVIDER=ollama aur OLLAMA_MODEL set karo. Paid cloud AI ke liye OPENAI_API_KEY add karo.`;
}

function normalizeRoleForOllama(role) {
  return role === "assistant" ? "assistant" : "user";
}

async function generateOllamaReply(chat) {
  const messages = chat.messages
    .slice(-20)
    .filter((m) => !m.type || m.type === "text")
    .map((m) => ({ role: normalizeRoleForOllama(m.role), content: String(m.content || "") }));

  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: "You are Premium AI, a helpful multilingual assistant inside an original AI chat product. IMPORTANT LANGUAGE RULE: Always reply in the same language and script as the user's latest message. If the user writes Hinglish/Roman Hindi, reply in Hinglish. If the user writes Hindi/Marathi in Devanagari, reply in Devanagari. If the user writes English, reply in English. Answer directly, do not translate the question unless asked, and do not apologize unless there is a real problem. Do not claim to be the official ChatGPT app." },
        ...messages
      ],
      stream: false
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    throw new Error(`Ollama request failed (${response.status}). Check Ollama is running and model is pulled. ${details}`);
  }

  const data = await response.json();
  return data?.message?.content || data?.response || "Ollama se reply nahi mila.";
}

async function generateGroqReply(chat) {
  if (!groq) {
    throw new Error("GROQ_API_KEY missing. Add it in server/.env");
  }

  const messages = chat.messages
    .slice(-20)
    .filter((m) => !m.type || m.type === "text")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "")
    }));

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are Premium AI, a helpful multilingual assistant inside an original AI chat product. IMPORTANT LANGUAGE RULE: Always reply in the same language and script as the user's latest message. If the user writes Hinglish/Roman Hindi, reply in Hinglish. If the user writes Hindi/Marathi in Devanagari, reply in Devanagari. If the user writes English, reply in English. Answer directly, do not translate the question unless asked, and do not apologize unless there is a real problem. Do not claim to be the official ChatGPT app."
      },
      ...messages
    ],
    temperature: 0.7
  });

  return completion.choices?.[0]?.message?.content || "Groq se reply nahi mila.";
}

async function generateAiReply(chat, userMessage, user) {
  if (AI_PROVIDER === "groq") return generateGroqReply(chat);
  if (AI_PROVIDER === "ollama") return generateOllamaReply(chat);
  if (!openai) return demoReply(userMessage, user);

  const input = chat.messages
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions:
      "You are Premium AI, a helpful multilingual assistant inside an original AI chat product. Always reply in the same language and script as the user's latest message. If the user writes Hinglish/Roman Hindi, reply in Hinglish. If Hindi/Marathi in Devanagari, reply in Devanagari. If English, reply in English. Do not claim to be the official ChatGPT app.",
    input
  });

  return response.output_text || "I could not generate a reply.";
}

app.post("/api/chat/message", auth, async (req, res) => {
  const { chatId, message } = req.body || {};
  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  const db = await readDb();
  let chat = chatId ? db.chats.find((c) => c.id === chatId && c.userId === req.user.id) : null;

  if (!chat) {
    chat = {
      id: nanoid(),
      userId: req.user.id,
      title: makeTitle(message),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.chats.push(chat);
  }

  const userMsg = {
    id: nanoid(),
    role: "user",
    content: String(message).trim(),
    createdAt: new Date().toISOString()
  };
  chat.messages.push(userMsg);
  chat.updatedAt = new Date().toISOString();

  try {
    const aiText = await generateAiReply(chat, userMsg.content, req.user);
    const assistantMsg = {
      id: nanoid(),
      role: "assistant",
      content: aiText,
      createdAt: new Date().toISOString()
    };
    chat.messages.push(assistantMsg);
    chat.updatedAt = new Date().toISOString();
    await writeDb(db);
    res.json({ chat, message: assistantMsg });
  } catch (error) {
    console.error(error);
    await writeDb(db);
    res.status(500).json({
      error: "AI request failed. Check GROQ_API_KEY/GROQ_MODEL or OPENAI settings and server logs."
    });
  }
});


function requireOpenAI(res) {
  if (openai) return true;
  res.status(400).json({ error: "Image/server voice ke liye OPENAI_API_KEY chahiye. Free Ollama mode sirf chat ke liye hai." });
  return false;
}

function publicFileUrl(req, relativePath) {
  return `${req.protocol}://${req.get("host")}${relativePath}`;
}

function escapeXml(value) {
  return String(value || "").replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;"
  }[char]));
}

function wrapText(text, maxChars = 36, maxLines = 4) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
    if (lines.length >= maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines.length ? lines : ["AI image preview"];
}

function generateDemoImageFile(req, prompt) {
  const safePrompt = escapeXml(prompt);
  const lines = wrapText(prompt);
  const textLines = lines.map((line, index) => `<text x="80" y="${380 + index * 40}" fill="#f8fbff" font-size="28" font-family="Arial, sans-serif" font-weight="700">${escapeXml(line)}</text>`).join("\n");
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#070b18"/>
      <stop offset="0.5" stop-color="#1c1440"/>
      <stop offset="1" stop-color="#0f2b3f"/>
    </linearGradient>
    <radialGradient id="glowA" cx="20%" cy="20%" r="60%">
      <stop offset="0" stop-color="#8be9d4" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#8be9d4" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="82%" cy="38%" r="60%">
      <stop offset="0" stop-color="#a78bfa" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#a78bfa" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect width="1280" height="720" fill="url(#glowA)"/>
  <rect width="1280" height="720" fill="url(#glowB)"/>
  <g opacity="0.5" filter="url(#blur)">
    <circle cx="270" cy="190" r="115" fill="#8be9d4"/>
    <circle cx="1010" cy="230" r="155" fill="#a78bfa"/>
    <circle cx="720" cy="565" r="130" fill="#6ee7f9"/>
  </g>
  <g opacity="0.42">
    <path d="M0 560 C170 500 270 630 430 565 S720 450 900 530 S1130 640 1280 555" fill="none" stroke="#8be9d4" stroke-width="4"/>
    <path d="M0 605 C190 545 310 665 500 610 S760 520 970 590 S1160 680 1280 615" fill="none" stroke="#a78bfa" stroke-width="4"/>
  </g>
  <g opacity="0.78">
    <rect x="80" y="110" width="1120" height="500" rx="42" fill="#0b1020" fill-opacity="0.56" stroke="#ffffff" stroke-opacity="0.22"/>
    <text x="80" y="85" fill="#8be9d4" font-size="26" font-family="Arial, sans-serif" font-weight="800">AI Plus Demo Image</text>
    <text x="80" y="320" fill="#c8d2ee" font-size="20" font-family="Arial, sans-serif">Local preview generated without paid image API</text>
    <text x="80" y="350" fill="#8be9d4" font-size="18" font-family="Arial, sans-serif">Prompt:</text>
    ${textLines}
    <text x="80" y="560" fill="#aab4c7" font-size="18" font-family="Arial, sans-serif">For real AI images, add OPENAI_API_KEY or connect a local image model.</text>
  </g>
</svg>`.trim();
  const filename = `${nanoid()}.svg`;
  fs.writeFileSync(path.join(GENERATED_DIR, filename), svg);
  return publicFileUrl(req, `/generated/${filename}`);
}


function imageSizeFromPrompt(prompt) {
  const text = String(prompt || "").toLowerCase();
  if (text.includes("9:16")) return { width: 768, height: 1365 };
  if (text.includes("1:1")) return { width: 1024, height: 1024 };
  if (text.includes("4:3")) return { width: 1024, height: 768 };
  return { width: 1280, height: 720 };
}

function pollinationsImageUrl(prompt) {
  const { width, height } = imageSizeFromPrompt(prompt);
  const seed = crypto.randomInt(1, 2147483647);
  const cleanPrompt = String(prompt || "AI image")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 900);
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model: "flux",
    seed: String(seed),
    enhance: "true"
  });
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?${params.toString()}`;
}

async function generatePollinationsImageFile(req, prompt) {
  const imageUrl = pollinationsImageUrl(prompt);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);
  let response;
  try {
    // Fetch server-side so the user's browser cookies/login state are never sent to Pollinations.
    response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AI-Plus-Local-Image-Proxy/1.0",
        "Accept": "image/png,image/jpeg,image/webp,image/*,*/*;q=0.8"
      }
    });
  } finally {
    clearTimeout(timeout);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.startsWith("image/")) {
    const body = await response.text().catch(() => "");
    throw new Error(`Pollinations image failed (${response.status}). ${body.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = contentType.includes("jpeg") || contentType.includes("jpg") ? "jpg" : contentType.includes("webp") ? "webp" : "png";
  const filename = `${nanoid()}.${extension}`;
  fs.writeFileSync(path.join(GENERATED_DIR, filename), buffer);
  return publicFileUrl(req, `/generated/${filename}`);
}

async function generateImageFile(req, prompt) {
  if (IMAGE_PROVIDER === "pollinations") return generatePollinationsImageFile(req, prompt);
  if (!openai) return generateDemoImageFile(req, prompt);

  const response = await openai.responses.create({
    model: OPENAI_IMAGE_MODEL,
    input: String(prompt).trim(),
    tools: [{ type: "image_generation" }]
  });

  const imageBase64 = response.output
    ?.filter((item) => item.type === "image_generation_call")
    ?.map((item) => item.result)
    ?.find(Boolean);

  if (!imageBase64) throw new Error("Image generate nahi hui. Prompt change karke try karo.");

  const filename = `${nanoid()}.png`;
  fs.writeFileSync(path.join(GENERATED_DIR, filename), Buffer.from(imageBase64, "base64"));
  return publicFileUrl(req, `/generated/${filename}`);
}

app.post("/api/chat/image", auth, async (req, res) => {
  const prompt = String(req.body?.prompt || "").trim();
  const chatId = req.body?.chatId;
  if (!prompt) return res.status(400).json({ error: "Image prompt required" });

  const db = await readDb();
  let chat = chatId ? db.chats.find((c) => c.id === chatId && c.userId === req.user.id) : null;
  if (!chat) {
    chat = {
      id: nanoid(),
      userId: req.user.id,
      title: makeTitle(`Image: ${prompt}`),
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.chats.push(chat);
  }

  const userMsg = {
    id: nanoid(),
    role: "user",
    type: "text",
    content: `Generate image: ${prompt}`,
    createdAt: new Date().toISOString()
  };
  chat.messages.push(userMsg);
  chat.updatedAt = new Date().toISOString();

  try {
    const imageUrl = await generateImageFile(req, prompt);
    const assistantMsg = {
      id: nanoid(),
      role: "assistant",
      type: "image",
      content: IMAGE_PROVIDER === "pollinations" ? `Generated AI image for: ${prompt}` : openai ? `Generated image for: ${prompt}` : `Demo image preview for: ${prompt}`,
      imageUrl,
      createdAt: new Date().toISOString()
    };
    chat.messages.push(assistantMsg);
    chat.updatedAt = new Date().toISOString();
    await writeDb(db);
    res.json({ chat, message: assistantMsg });
  } catch (error) {
    console.error("Image generation failed:", error);
    await writeDb(db);
    res.status(500).json({ error: "Image generation failed. Server logs check karo." });
  }
});

app.post("/api/voice/speak", auth, async (req, res) => {
  if (!requireOpenAI(res)) return;
  const input = String(req.body?.text || "").trim().slice(0, 4000);
  const voice = String(req.body?.voice || "coral").trim();
  if (!input) return res.status(400).json({ error: "Text required" });

  try {
    const audio = await openai.audio.speech.create({
      model: OPENAI_TTS_MODEL,
      voice,
      input,
      instructions: "Speak naturally as an AI assistant. Clear disclosure: this is AI-generated voice."
    });
    const buffer = Buffer.from(await audio.arrayBuffer());
    res.json({ audio: `data:audio/mpeg;base64,${buffer.toString("base64")}` });
  } catch (error) {
    console.error("TTS failed:", error);
    res.status(500).json({ error: "Voice generate nahi hui. OPENAI_API_KEY/model billing check karo." });
  }
});

app.post("/api/voice/transcribe", auth, upload.single("audio"), async (req, res) => {
  if (!requireOpenAI(res)) return;
  if (!req.file) return res.status(400).json({ error: "Audio file required" });

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(req.file.path),
      model: OPENAI_STT_MODEL,
      response_format: "text"
    });
    const text = typeof transcription === "string" ? transcription : transcription?.text || "";
    res.json({ text: String(text).trim() });
  } catch (error) {
    console.error("Transcription failed:", error);
    res.status(500).json({ error: "Voice samajh nahi aayi. Mic/audio permission aur API key check karo." });
  } finally {
    fs.promises.unlink(req.file.path).catch(() => {});
  }
});

const WEB_DIST = path.resolve("../web/dist");
if (fs.existsSync(WEB_DIST)) {
  app.use(express.static(WEB_DIST));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/generated")) return next();
    res.sendFile(path.join(WEB_DIST, "index.html"));
  });
}

app.use((_, res) => res.status(404).json({ error: "Route not found" }));

app.listen(PORT, () => {
  console.log(`AI Plus server running on http://localhost:${PORT}`);
  console.log(`AI mode: ${AI_PROVIDER === "groq" && groq ? `Groq ${GROQ_MODEL}` : AI_PROVIDER === "ollama" ? `Ollama ${OLLAMA_MODEL} at ${OLLAMA_URL}` : openai ? `OpenAI model ${OPENAI_MODEL}` : "demo replies"}`);
  console.log(`Image mode: ${openai && IMAGE_PROVIDER === "openai" ? `OpenAI model ${OPENAI_IMAGE_MODEL}` : IMAGE_PROVIDER === "pollinations" ? "Pollinations image API" : "demo preview (no paid image API)"}`);
  console.log(`Voice mode: ${openai ? `${OPENAI_STT_MODEL} + ${OPENAI_TTS_MODEL}` : "browser speech only / needs OPENAI_API_KEY for server voice"}`);
  console.log(`OTP mode: ${hasSmtpConfig() ? "email SMTP" : "console fallback"}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

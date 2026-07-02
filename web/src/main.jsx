import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bot,
  Crown,
  Image as ImageIcon,
  KeyRound,
  LogOut,
  Menu,
  Mic,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  User,
  Volume2,
  Copy,
  Download,
  ThumbsDown,
  ThumbsUp,
  Settings
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "/api";

async function api(path, options = {}) {
  const token = localStorage.getItem("nova_token");
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error("Server connect nahi ho raha. Pehle server folder me npm run dev chalao, phir http://localhost:8080/api/health open karke check karo.");
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function apiForm(path, formData) {
  const token = localStorage.getItem("nova_token");
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData
    });
  } catch {
    throw new Error("Server connect nahi ho raha. Server npm run dev se start rakho.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}


function exampleSvgDataUri(title, subtitle, start, end) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="560" viewBox="0 0 900 560">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="8" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="900" height="560" fill="#090d1f"/>
    <rect x="0" y="0" width="900" height="560" fill="url(#g)" opacity=".72"/>
    <circle cx="730" cy="90" r="125" fill="#ffffff" opacity=".08"/>
    <circle cx="190" cy="430" r="165" fill="#ffffff" opacity=".07"/>
    <path d="M70 410 C220 300 330 445 470 330 C610 220 690 310 830 205" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity=".25" filter="url(#glow)"/>
    <g opacity=".88">
      <rect x="105" y="220" width="70" height="210" rx="12" fill="#0b1024" opacity=".74"/>
      <rect x="205" y="145" width="86" height="285" rx="14" fill="#0b1024" opacity=".68"/>
      <rect x="325" y="260" width="72" height="170" rx="12" fill="#0b1024" opacity=".72"/>
      <rect x="650" y="175" width="95" height="255" rx="14" fill="#0b1024" opacity=".68"/>
    </g>
    <text x="56" y="82" fill="#ffffff" font-size="48" font-family="Inter,Arial" font-weight="800">${title}</text>
    <text x="58" y="124" fill="#dce6ff" font-size="24" font-family="Inter,Arial" font-weight="600" opacity=".85">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const EXAMPLE_IMAGES = [
  { id: "ex-city", title: "Cyberpunk City", prompt: "A futuristic Indian city at night with orange neon lights, flying cars, rain wet roads, cinematic cyberpunk style", imageUrl: exampleSvgDataUri("Cyberpunk City", "Neon night • 16:9", "#14b8a6", "#7c3aed") },
  { id: "ex-logo", title: "AI Logo", prompt: "Premium AI chat app logo, mint and purple gradient, clean 3D icon, dark background", imageUrl: exampleSvgDataUri("AI Logo", "Mint purple brand mark", "#8be9d4", "#a78bfa") },
  { id: "ex-avatar", title: "AI Avatar", prompt: "Friendly futuristic AI assistant avatar, glowing face, cinematic dark background", imageUrl: exampleSvgDataUri("AI Avatar", "Friendly assistant", "#0ea5e9", "#8b5cf6") },
  { id: "ex-dashboard", title: "Dashboard UI", prompt: "Dark premium AI dashboard interface with glass cards and glowing accents", imageUrl: exampleSvgDataUri("Dashboard UI", "Premium SaaS concept", "#1d4ed8", "#9333ea") }
];

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [form, setForm] = useState({ name: "", email: "", password: "", otp: "" });
  const [otpStep, setOtpStep] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const title = otpStep
    ? mode === "forgot" ? "Reset password" : "Verify OTP"
    : mode === "login" ? "Welcome back" : mode === "register" ? "Create account" : "Forgot password";

  const subtitle = otpStep
    ? mode === "forgot"
      ? `OTP ${form.email} ke liye server PowerShell/email me dekho, phir new password set karo.`
      : `OTP ${form.email} ke liye server PowerShell/email me dekho. Verify hone ke baad password save ho jayega.`
    : mode === "login"
      ? "Pehle password se login karo. Password bhool gaye ho to reset karo."
      : mode === "register"
        ? "Name, email aur password daalo. OTP verify hone ke baad account banega."
        : "Email daalo. OTP verify karke naya password bana sakte ho.";

  async function passwordLogin(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const data = await api("/auth/login/password", {
        method: "POST",
        body: JSON.stringify({ email: form.email, password: form.password })
      });
      localStorage.setItem("nova_token", data.token);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startRegister(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const data = await api("/auth/register/start", {
        method: "POST",
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password })
      });
      setOtpStep(true);
      setNotice(data.message || `OTP sent to ${form.email}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startForgot(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const data = await api("/auth/password/forgot/start", {
        method: "POST",
        body: JSON.stringify({ email: form.email })
      });
      setOtpStep(true);
      setForm((old) => ({ ...old, password: "", otp: "" }));
      setNotice(data.message || `OTP sent to ${form.email}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyRegister(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api("/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({ email: form.email, otp: form.otp })
      });
      localStorage.setItem("nova_token", data.token);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyForgot(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api("/auth/password/forgot/verify", {
        method: "POST",
        body: JSON.stringify({ email: form.email, otp: form.otp, password: form.password })
      });
      localStorage.setItem("nova_token", data.token);
      onAuth(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function submit(e) {
    if (mode === "login") return passwordLogin(e);
    if (mode === "register") return otpStep ? verifyRegister(e) : startRegister(e);
    if (mode === "forgot") return otpStep ? verifyForgot(e) : startForgot(e);
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setOtpStep(false);
    setError("");
    setNotice("");
    setForm({ name: "", email: "", password: "", otp: "" });
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="brand-badge"><img src="/logo.svg" alt="Premium AI" className="brand-mini-logo" /> Premium AI</div>
        <h1>Chat, voice and image studio.</h1>
        <p>Dark premium AI workspace with password login, OTP-verified registration, local Ollama chat, voice controls, and image generator panel.</p>
        <div className="feature-grid">
          <span>Password login</span><span>OTP verified signup</span><span>Image studio</span><span>Local AI chat</span>
        </div>
      </div>

      <form className="auth-card" onSubmit={submit}>
        <h2>{title}</h2>
        <p>{subtitle}</p>

        {!otpStep && mode === "register" && (
          <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        )}

        {!otpStep && (
          <>
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {(mode === "login" || mode === "register") && (
              <input placeholder={mode === "register" ? "Create password" : "Password"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            )}
          </>
        )}

        {otpStep && (
          <div className="otp-panel">
            <input className="otp-input" placeholder="6 digit OTP" inputMode="numeric" maxLength={6} value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, "").slice(0, 6) })} />
            {mode === "forgot" && (
              <input placeholder="New password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            )}
            <button type="button" className="ghost small" onClick={mode === "forgot" ? startForgot : startRegister} disabled={loading}>Resend OTP</button>
          </div>
        )}

        {notice && <div className="notice">{notice}</div>}
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={loading}>
          {loading
            ? "Please wait..."
            : mode === "login" ? "Login with password"
              : mode === "register" ? (otpStep ? "Verify OTP & create account" : "Send register OTP")
              : otpStep ? "Verify OTP & save new password" : "Send reset OTP"}
        </button>

        <div className="auth-links">
          {mode !== "login" && <button type="button" onClick={() => switchMode("login")}>Back to Login</button>}
          {mode === "login" && <button type="button" onClick={() => switchMode("forgot")}>Forgot password?</button>}
          {mode === "login" && <button type="button" onClick={() => switchMode("register")}>New user? Register</button>}
          {mode === "register" && <button type="button" onClick={() => switchMode("login")}>Already have account? Login</button>}
        </div>
      </form>
    </div>
  );
}

function getInitials(name = "AI") {
  return String(name).trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "AI";
}

function ChatBubble({ message, onSpeak, speakingId }) {
  const isUser = message.role === "user";
  const isSpeaking = speakingId === message.id;
  return (
    <div className={`bubble-row ${isUser ? "right" : "left"}`}>
      {!isUser && <div className="avatar assistant-avatar"><Sparkles size={16} /></div>}
      <div className={`bubble ${message.type === "image" ? "image-bubble" : ""}`}>
        {message.type === "image" ? (
          <>
            <p>{message.content}</p>
            <img src={message.imageUrl} alt={message.content || "Generated AI image"} className="generated-image" />
            <div className="bubble-actions">
              <button type="button"><ThumbsUp size={15} /></button>
              <button type="button"><ThumbsDown size={15} /></button>
              <button type="button" onClick={() => navigator.clipboard?.writeText(message.imageUrl || "")}><Copy size={15} /></button>
              <a href={message.imageUrl} download><Download size={15} /></a>
            </div>
          </>
        ) : (
          String(message.content || "").split("\n").map((line, i) => <p key={i}>{line}</p>)
        )}
        {!isUser && message.type !== "image" && (
          <button className="listen-btn" onClick={() => onSpeak(message.id, message.content)}>
            {isSpeaking ? <Square size={15} /> : <Volume2 size={15} />}
            {isSpeaking ? "Stop" : "Listen"}
          </button>
        )}
      </div>
    </div>
  );
}

function RecentImageCard({ src, label, onClick }) {
  return (
    <button type="button" className="recent-image-card" onClick={onClick}>
      {src ? <img src={src} alt={label || "Recent generation"} /> : <span>{label}</span>}
    </button>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [text, setText] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [imageStyle, setImageStyle] = useState("Cyberpunk");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [booting, setBooting] = useState(true);
  const [sidebar, setSidebar] = useState(true);
  const [recording, setRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [speakingId, setSpeakingId] = useState(null);
  const [activeSection, setActiveSection] = useState("chat");
  const [studioTab, setStudioTab] = useState("studio");
  const [allImages, setAllImages] = useState([]);
  const [panelNotice, setPanelNotice] = useState("");
  const [appSettings, setAppSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("premium_ai_settings") || "{}");
    } catch {
      return {};
    }
  });
  const endRef = useRef(null);
  const imageInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const activeChatRef = useRef(activeChat);

  const isPlus = user?.plan === "Plus";
  const recentImages = (allImages.length ? allImages : (activeChat?.messages || []).filter((msg) => msg.type === "image")).slice(-4).reverse();
  const totalMessages = chats.reduce((sum, chat) => sum + (chat.messageCount || 0), 0);
  const voiceLang = appSettings.voiceLang || "hi-IN";
  const languageMode = appSettings.languageMode || "same";

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  useEffect(() => {
    async function boot() {
      try {
        const token = localStorage.getItem("nova_token");
        if (!token) return;
        const me = await api("/me");
        setUser(me.user);
      } catch {
        localStorage.removeItem("nova_token");
      } finally {
        setBooting(false);
      }
    }
    boot();
  }, []);

  useEffect(() => {
    if (user) loadChats();
  }, [user]);

  useEffect(() => {
    if (user && activeSection === "images") loadAllImages();
  }, [user, activeSection, chats.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat?.messages, loading, imageLoading]);

  async function loadChats() {
    const data = await api("/chats");
    setChats(data.chats);
    if (!activeChatRef.current && data.chats[0]) loadChat(data.chats[0].id);
  }

  async function loadAllImages() {
    const images = [];
    for (const chat of chats) {
      try {
        const data = await api(`/chats/${chat.id}`);
        (data.chat?.messages || []).forEach((msg) => {
          if (msg.type === "image" && msg.imageUrl) {
            images.push({ ...msg, chatId: chat.id, chatTitle: data.chat.title });
          }
        });
      } catch {
        // Skip deleted or unavailable chats.
      }
    }
    images.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    setAllImages(images);
    return images;
  }

  function openSection(section) {
    setActiveSection(section);
    setPanelNotice("");
    if (section === "images") loadAllImages();
    if (window.innerWidth < 900) setSidebar(false);
  }

  function saveSetting(key, value) {
    const next = { ...appSettings, [key]: value };
    setAppSettings(next);
    localStorage.setItem("premium_ai_settings", JSON.stringify(next));
    setPanelNotice("Setting saved.");
  }

  async function clearAllChats() {
    if (!window.confirm("Saare chats aur image history delete karni hai?")) return;
    for (const chat of chats) {
      try { await api(`/chats/${chat.id}`, { method: "DELETE" }); } catch {}
    }
    setChats([]);
    setActiveChat(null);
    setAllImages([]);
    setPanelNotice("All chats cleared.");
    setActiveSection("history");
  }

  function exportData() {
    const payload = { user, chats, images: allImages, settings: appSettings, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "premium-ai-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function loadChat(id) {
    const data = await api(`/chats/${id}`);
    setActiveChat(data.chat);
    setActiveSection("chat");
    if (window.innerWidth < 900) setSidebar(false);
  }

  function newChat() {
    setActiveChat({ id: null, title: "New Chat", messages: [] });
    setActiveSection("chat");
    if (window.innerWidth < 900) setSidebar(false);
  }

  async function deleteChat(id) {
    await api(`/chats/${id}`, { method: "DELETE" });
    setChats((items) => items.filter((c) => c.id !== id));
    if (activeChat?.id === id) setActiveChat(null);
  }

  async function sendText(message) {
    if (!message || loading) return;
    setLoading(true);
    const currentChat = activeChatRef.current;
    const optimistic = {
      ...(currentChat || { id: null, title: "New Chat", messages: [] }),
      messages: [...(currentChat?.messages || []), { id: `temp-${Date.now()}`, role: "user", type: "text", content: message }]
    };
    setActiveChat(optimistic);

    try {
      const data = await api("/chat/message", {
        method: "POST",
        body: JSON.stringify({ chatId: currentChat?.id, message })
      });
      setActiveChat(data.chat);
      await loadChats();
      if (activeSection === "images") await loadAllImages();
    } catch (err) {
      setActiveChat((chat) => ({
        ...(chat || { id: null, title: "New Chat", messages: [] }),
        messages: [...(chat?.messages || []), { id: `err-${Date.now()}`, role: "assistant", type: "text", content: `Error: ${err.message}` }]
      }));
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(e) {
    e.preventDefault();
    const message = text.trim();
    if (!message) return;
    setText("");
    await sendText(message);
  }

  async function generateImage(e) {
    e?.preventDefault();
    const prompt = imagePrompt.trim();
    if (!prompt || imageLoading) return;
    setImageLoading(true);
    const currentChat = activeChatRef.current;
    const finalPrompt = `${prompt}. Style: ${imageStyle}. Aspect ratio: ${aspectRatio}.`;
    const optimistic = {
      ...(currentChat || { id: null, title: "Image Studio", messages: [] }),
      messages: [...(currentChat?.messages || []), { id: `img-user-${Date.now()}`, role: "user", type: "text", content: `Create image: ${prompt}` }]
    };
    setActiveChat(optimistic);

    try {
      const data = await api("/chat/image", {
        method: "POST",
        body: JSON.stringify({ chatId: currentChat?.id, prompt: finalPrompt })
      });
      setActiveChat(data.chat);
      await loadChats();
      await loadAllImages();
    } catch (err) {
      setActiveChat((chat) => ({
        ...(chat || { id: null, title: "Image Studio", messages: [] }),
        messages: [...(chat?.messages || []), { id: `img-err-${Date.now()}`, role: "assistant", type: "text", content: `Image error: ${err.message}` }]
      }));
    } finally {
      setImageLoading(false);
    }
  }

  function speak(messageId, textToSpeak) {
    if (speakingId === messageId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(String(textToSpeak || ""));
    utterance.lang = voiceLang || "hi-IN";
    utterance.rate = 1;
    utterance.pitch = 1;

    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);

    setSpeakingId(messageId);
    window.speechSynthesis.speak(utterance);
  }

  async function startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = voiceLang;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        mediaRecorderRef.current = recognition;
        recognition.onresult = (event) => {
          const spoken = event.results?.[0]?.[0]?.transcript || "";
          setText(spoken);
          setVoiceStatus(spoken ? "Voice text me aa gaya. Send dabao." : "Voice clear nahi thi, dobara try karo.");
        };
        recognition.onerror = () => {
          setVoiceStatus("Browser voice samajh nahi paya. Dobara try karo.");
          setRecording(false);
        };
        recognition.onend = () => setRecording(false);
        recognition.start();
        setRecording(true);
        setVoiceStatus("Recording... boliye.");
        return;
      } catch {
        setVoiceStatus("Browser voice start nahi hua. Mic permission check karo.");
        setRecording(false);
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) audioChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setVoiceStatus("Voice ko text me convert kar raha hoon...");
        try {
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const formData = new FormData();
          formData.append("audio", blob, "voice.webm");
          const data = await apiForm("/voice/transcribe", formData);
          setText(data.text || "");
          setVoiceStatus(data.text ? "Voice text me aa gaya. Send dabao." : "Voice clear nahi thi, dobara try karo.");
        } catch (err) {
          setVoiceStatus(err.message);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setVoiceStatus("Recording... boliye, phir Stop dabao.");
    } catch {
      setVoiceStatus("Mic permission nahi mili ya browser support nahi karta.");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.stop) mediaRecorderRef.current.stop();
    setRecording(false);
  }

  async function togglePlan() {
    const data = await api("/plan/upgrade-demo", { method: "POST" });
    setUser(data.user);
  }

  async function setPassword() {
    const password = window.prompt("New password likho, minimum 6 characters:");
    if (!password) return;
    try {
      const data = await api("/auth/password/set", { method: "POST", body: JSON.stringify({ password }) });
      setUser(data.user);
      alert(data.message || "Password saved");
    } catch (err) {
      alert(err.message);
    }
  }

  function logout() {
    localStorage.removeItem("nova_token");
    setUser(null);
    setChats([]);
    setActiveChat(null);
  }

  if (booting) return <div className="loading-screen">Loading Premium AI...</div>;
  if (!user) return <AuthScreen onAuth={setUser} />;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebar ? "show" : ""}`}>
        <div className="brand-card">
          <img src="/logo.svg" alt="Premium AI" className="app-logo-img" />
          <div>
            <div className="logo">Premium AI</div>
            <p>Smart. Fast. Limitless.</p>
          </div>
        </div>

        <button className="new-chat" onClick={newChat}><Plus size={19} /> New Chat</button>

        <nav className="side-menu">
          <button className={activeSection === "history" ? "active" : ""} onClick={() => openSection("history")}><Bot size={19} /> History</button>
          <button className={activeSection === "images" ? "active" : ""} onClick={() => openSection("images")}><ImageIcon size={19} /> Images</button>
          <button className={activeSection === "settings" ? "active" : ""} onClick={() => openSection("settings")}><Settings size={19} /> Settings</button>
          <button className={activeSection === "profile" ? "active" : ""} onClick={() => openSection("profile")}><User size={19} /> Profile</button>
        </nav>

        <div className="recent-chats-title">Recent chats</div>
        <div className="chat-list">
          {chats.map((chat) => (
            <button key={chat.id} className={`chat-item ${activeChat?.id === chat.id ? "active" : ""}`} onClick={() => loadChat(chat.id)}>
              <span>{chat.title}</span>
              <Trash2 size={15} onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }} />
            </button>
          ))}
          {!chats.length && <div className="empty-list">No saved chats yet.</div>}
        </div>

        <div className="upgrade-card">
          <div><Sparkles size={20} /></div>
          <strong>Upgrade to Pro</strong>
          <p>Cloud images and advanced server voice need API key.</p>
          <button onClick={togglePlan}>{isPlus ? "Switch Free" : "Upgrade Now"}</button>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">{getInitials(user.name).slice(0, 1)}</div>
          <div className="profile-meta"><strong>{user.name}</strong><small>{user.email}</small></div>
          <button className="password-mini" onClick={setPassword}><KeyRound size={13} /> {user.hasPassword ? "Change" : "Set"}</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setSidebar(!sidebar)}><Menu size={20} /></button>
          <div>
            <h1>{activeSection === "chat" ? (activeChat?.title || "New Chat") : activeSection === "history" ? "History" : activeSection === "images" ? "Image Gallery" : activeSection === "settings" ? "Advanced Settings" : "Profile"}</h1>
            <p>{activeSection === "chat" ? "Free local multilingual chat powered by Ollama" : activeSection === "history" ? "Aapke saved chats aur recent conversations" : activeSection === "images" ? "Aapki generated image history" : activeSection === "settings" ? "AI, voice, language aur data controls" : "Account, plan aur security options"}</p>
          </div>
          <div className="top-actions">
            <div className="model-pill"><Sparkles size={16} /><span>AI Model<br /><strong>Ollama</strong></span></div>
            <button className="icon-btn" onClick={logout}><LogOut size={19} /></button>
          </div>
        </header>

        {activeSection === "chat" ? (
          <>
            <section className="chat-stage">
              {(!activeChat || activeChat.messages.length === 0) && (
                <div className="intro-stack">
                  <div className="intro-card">
                    <div className="avatar assistant-avatar"><Sparkles size={16} /></div>
                    <div>
                      <h3>Hello, {user.name}! 👋</h3>
                      <p>I am your multilingual AI assistant. Ask in Hindi, English, Marathi, Hinglish — and generate images.</p>
                    </div>
                  </div>
                  <div className="sample-row">
                    <button onClick={() => setText("Mere business ke liye Instagram bio likho")}>Instagram bio likho</button>
                    <button onClick={() => { setImagePrompt("Futuristic city at night with flying cars, neon lights and rain"); imageInputRef.current?.focus(); }}>Image idea set karo</button>
                    <button onClick={() => setText("Mujhe Hindi me business plan banao")}>Business plan</button>
                  </div>
                </div>
              )}
              {activeChat?.messages?.map((msg) => <ChatBubble key={msg.id} message={msg} onSpeak={speak} speakingId={speakingId} />)}
              {loading && <div className="typing">AI Plus is thinking...</div>}
              {imageLoading && <div className="typing">AI image generate kar raha hai...</div>}
              <div ref={endRef} />
            </section>

            <form className="composer" onSubmit={sendMessage}>
              <div className="composer-input-wrap">
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Message AI..." rows={1} onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) sendMessage(e);
                }} />
                <div className="composer-toolbar">
                  <button type="button" className="image-pill" onClick={() => imageInputRef.current?.focus()} title="Open Image Generator">
                    <ImageIcon size={17} /> Image
                  </button>
                  <button type="button" className={`mic-btn ${recording ? "recording" : ""}`} onClick={recording ? stopRecording : startRecording} title="Speak to AI">
                    {recording ? <Square size={17} /> : <Mic size={18} />}
                  </button>
                </div>
              </div>
              <button className="send-btn" disabled={!text.trim() || loading}><Send size={21} /></button>
            </form>
            <div className="voice-status">{voiceStatus || "Image logo chat input ke side me hai. Mic se bolne ke liye mic button dabao."}</div>
          </>
        ) : (
          <section className="workspace-stage">
            {panelNotice && <div className="notice workspace-notice">{panelNotice}</div>}

            {activeSection === "history" && (
              <div className="workspace-page">
                <div className="workspace-head">
                  <div><h2>Chat History</h2><p>Yahan sab saved conversations dikhenge. Kisi bhi chat ko open ya delete kar sakte ho.</p></div>
                  <button className="primary mini-primary" onClick={newChat}><Plus size={16} /> New Chat</button>
                </div>
                <div className="stat-grid">
                  <div><strong>{chats.length}</strong><span>Total chats</span></div>
                  <div><strong>{totalMessages}</strong><span>Total messages</span></div>
                  <div><strong>{allImages.length || recentImages.length}</strong><span>Images</span></div>
                </div>
                <div className="history-cards">
                  {chats.map((chat) => (
                    <article key={chat.id} className="history-card">
                      <div>
                        <h3>{chat.title}</h3>
                        <p>{chat.messageCount || 0} messages • Updated {new Date(chat.updatedAt).toLocaleString()}</p>
                      </div>
                      <div className="card-actions">
                        <button onClick={() => loadChat(chat.id)}>Open</button>
                        <button className="danger-btn" onClick={() => deleteChat(chat.id)}>Delete</button>
                      </div>
                    </article>
                  ))}
                  {!chats.length && <div className="empty-state">Abhi koi history nahi hai. New Chat se start karo.</div>}
                </div>
              </div>
            )}

            {activeSection === "images" && (
              <div className="workspace-page">
                <div className="workspace-head">
                  <div><h2>Image History</h2><p>Generated images yahan save rahengi. Image open, copy, ya chat khol sakte ho.</p></div>
                  <button className="primary mini-primary" onClick={loadAllImages}><ImageIcon size={16} /> Refresh</button>
                </div>
                <div className="gallery-grid">
                  {allImages.map((img) => (
                    <article key={`${img.chatId}-${img.id}`} className="gallery-card">
                      <img src={img.imageUrl} alt={img.content || "Generated image"} />
                      <div className="gallery-info">
                        <strong>{img.chatTitle || "Image Chat"}</strong>
                        <p>{img.content}</p>
                        <div className="card-actions">
                          <button onClick={() => window.open(img.imageUrl, "_blank")}>Open</button>
                          <button onClick={() => navigator.clipboard?.writeText(img.imageUrl)}>Copy URL</button>
                          <button onClick={() => loadChat(img.chatId)}>Chat</button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {!allImages.length && EXAMPLE_IMAGES.map((img) => (
                    <article key={img.id} className="gallery-card example-gallery-card">
                      <img src={img.imageUrl} alt={img.title} />
                      <div className="gallery-info">
                        <strong>{img.title}</strong>
                        <p>{img.prompt}</p>
                        <div className="card-actions">
                          <button onClick={() => { setActiveSection("chat"); setImagePrompt(img.prompt); imageInputRef.current?.focus(); }}>Use prompt</button>
                          <button onClick={() => window.open(img.imageUrl, "_blank")}>Open example</button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "settings" && (
              <div className="workspace-page">
                <div className="workspace-head"><div><h2>Advanced Settings</h2><p>Language, voice, AI model aur data control options.</p></div></div>
                <div className="settings-grid">
                  <div className="setting-card"><Sparkles size={20} /><h3>AI Provider</h3><p>Free local AI: Ollama. Current model server .env se control hota hai.</p><code>qwen2.5:1.5b / tinyllama</code></div>
                  <div className="setting-card"><Volume2 size={20} /><h3>Voice Language</h3><p>Listen aur mic recognition ki language select karo.</p><select value={voiceLang} onChange={(e) => saveSetting("voiceLang", e.target.value)}><option value="hi-IN">Hindi / Hinglish</option><option value="mr-IN">Marathi</option><option value="en-US">English</option></select></div>
                  <div className="setting-card"><Bot size={20} /><h3>Reply Language</h3><p>AI ko user ki language me reply karne ka instruction active hai.</p><select value={languageMode} onChange={(e) => saveSetting("languageMode", e.target.value)}><option value="same">Same as user message</option><option value="hindi">Prefer Hindi</option><option value="english">Prefer English</option></select></div>
                  <div className="setting-card"><ImageIcon size={20} /><h3>Image Studio</h3><p>Provider: Pollinations. Internet ON hoga to image generate hogi.</p><code>IMAGE_PROVIDER=pollinations</code></div>
                  <div className="setting-card"><Settings size={20} /><h3>Data Control</h3><p>Apni local app data export kar sakte ho ya chats clear kar sakte ho.</p><div className="card-actions"><button onClick={exportData}>Export JSON</button><button className="danger-btn" onClick={clearAllChats}>Clear chats</button></div></div>
                  <div className="setting-card"><KeyRound size={20} /><h3>Login Security</h3><p>Abhi OTP console fallback par hai. Final/live version me Gmail App Password lagana.</p><button onClick={setPassword}>{user.hasPassword ? "Change Password" : "Set Password"}</button></div>
                </div>
              </div>
            )}

            {activeSection === "profile" && (
              <div className="workspace-page">
                <div className="profile-hero">
                  <div className="profile-avatar large">{getInitials(user.name).slice(0, 1)}</div>
                  <div><h2>{user.name}</h2><p>{user.email}</p><span>{user.plan || "Free"} Plan • {user.hasPassword ? "Password enabled" : "OTP login only"}</span></div>
                </div>
                <div className="stat-grid">
                  <div><strong>{chats.length}</strong><span>Chats</span></div>
                  <div><strong>{totalMessages}</strong><span>Messages</span></div>
                  <div><strong>{allImages.length || recentImages.length}</strong><span>Images</span></div>
                </div>
                <div className="settings-grid two-col">
                  <div className="setting-card"><Crown size={20} /><h3>Plan</h3><p>Demo plan switch for UI testing.</p><button onClick={togglePlan}>{isPlus ? "Switch to Free" : "Upgrade demo Plus"}</button></div>
                  <div className="setting-card"><KeyRound size={20} /><h3>Password</h3><p>Password login ke liye password set/change karo.</p><button onClick={setPassword}>{user.hasPassword ? "Change Password" : "Set Password"}</button></div>
                  <div className="setting-card"><ImageIcon size={20} /><h3>Generated Images</h3><p>Images tab me saari image history dikhegi.</p><button onClick={() => openSection("images")}>Open Images</button></div>
                  <div className="setting-card"><LogOut size={20} /><h3>Session</h3><p>Is device se logout karo.</p><button className="danger-btn" onClick={logout}>Logout</button></div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>

      <aside className="image-studio">
        <div className="studio-tabs">
          <button type="button" className={studioTab === "studio" ? "active" : ""} onClick={() => setStudioTab("studio")}><Sparkles size={15} /> Image Studio</button>
          <button type="button" className={studioTab === "gallery" ? "active" : ""} onClick={() => setStudioTab("gallery")}>Gallery</button>
        </div>

        {studioTab === "studio" ? (
        <form className="studio-form" onSubmit={generateImage}>
          <label>Describe the image you want to create</label>
          <textarea ref={imageInputRef} value={imagePrompt} onChange={(e) => setImagePrompt(e.target.value.slice(0, 500))} placeholder="A futuristic cityscape at night with flying cars, neon lights, and rain." maxLength={500} />
          <div className="counter">{imagePrompt.length}/500</div>

          <label>Style</label>
          <select value={imageStyle} onChange={(e) => setImageStyle(e.target.value)}>
            <option>Cyberpunk</option>
            <option>Anime</option>
            <option>Realistic</option>
            <option>3D render</option>
            <option>Logo design</option>
          </select>

          <label>Aspect Ratio</label>
          <div className="ratio-grid">
            {["1:1", "16:9", "9:16", "4:3"].map((ratio) => (
              <button key={ratio} type="button" className={aspectRatio === ratio ? "active" : ""} onClick={() => setAspectRatio(ratio)}>{ratio}</button>
            ))}
          </div>

          <button className="generate-btn" disabled={!imagePrompt.trim() || imageLoading}>
            <Sparkles size={17} /> {imageLoading ? "Generating..." : "Generate Image"}
          </button>
        </form>
        ) : (
          <div className="studio-gallery">
            <p>Example gallery: prompt choose karo aur Image Studio me generate karo.</p>
            {EXAMPLE_IMAGES.map((img) => (
              <button key={img.id} type="button" className="studio-example-card" onClick={() => { setStudioTab("studio"); setImagePrompt(img.prompt); }}>
                <img src={img.imageUrl} alt={img.title} />
                <span>{img.title}</span>
              </button>
            ))}
          </div>
        )}

        <div className="recent-head"><strong>Recent Generations</strong><button type="button" onClick={() => setStudioTab("gallery")}>View all</button></div>
        <div className="recent-grid">
          {recentImages.length ? recentImages.map((img) => (
            <RecentImageCard key={img.id} src={img.imageUrl} label={img.content} onClick={() => window.open(img.imageUrl, "_blank")} />
          )) : (
            EXAMPLE_IMAGES.map((img) => (
              <RecentImageCard key={img.id} src={img.imageUrl} label={img.title} onClick={() => { setStudioTab("studio"); setImagePrompt(img.prompt); }} />
            ))
          )}
        </div>
        <p className="studio-note">Free image generation internet-based image API se hoti hai. Agar image load na ho to internet check karo ya prompt change karke try karo.</p>
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);

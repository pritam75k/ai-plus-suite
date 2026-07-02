import React, { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8080/api";

async function request(path, options = {}) {
  const token = await AsyncStorage.getItem("nova_token");
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
    throw new Error("Server connect nahi ho raha. Server PC par npm run dev chalao. Real phone par EXPO_PUBLIC_API_URL me PC ka IP use karo.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}


async function requestForm(path, formData) {
  const token = await AsyncStorage.getItem("nova_token");
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

function Auth({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [loginMethod, setLoginMethod] = useState("otp");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function startOtp() {
    setLoading(true);
    setNotice("");
    try {
      const route = mode === "login" ? "/auth/login/otp/start" : "/auth/register/start";
      const body = mode === "login" ? { email } : { name, email };
      const data = await request(route, { method: "POST", body: JSON.stringify(body) });
      setOtpStep(true);
      setNotice(data.message || `OTP sent to ${email}`);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function passwordLogin() {
    setLoading(true);
    setNotice("");
    try {
      const data = await request("/auth/login/password", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      await AsyncStorage.setItem("nova_token", data.token);
      onAuth(data.user);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setLoading(true);
    try {
      const route = mode === "login" ? "/auth/login/otp/verify" : "/auth/register/verify";
      const data = await request(route, { method: "POST", body: JSON.stringify({ email, otp }) });
      await AsyncStorage.setItem("nova_token", data.token);
      onAuth(data.user);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  function submit() {
    if (otpStep) return verifyOtp();
    if (mode === "login" && loginMethod === "password") return passwordLogin();
    return startOtp();
  }

  function switchMode() {
    setMode(mode === "login" ? "register" : "login");
    setName("");
    setEmail("");
    setPassword("");
    setOtp("");
    setOtpStep(false);
    setNotice("");
  }

  function chooseMethod(method) {
    setLoginMethod(method);
    setOtpStep(false);
    setOtp("");
    setNotice("");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.authWrap}>
        <Text style={styles.badge}>✦ AI Plus</Text>
        <Text style={styles.heroTitle}>Premium AI chat app.</Text>
        <Text style={styles.heroText}>Register sirf OTP se. Login password ya OTP, dono me se kisi ek se.</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{otpStep ? "Enter OTP" : mode === "login" ? "Login" : "Register"}</Text>
          {mode === "login" && !otpStep && (
            <View style={styles.segmented}>
              <Pressable style={[styles.segmentBtn, loginMethod === "otp" && styles.segmentActive]} onPress={() => chooseMethod("otp")}><Text style={styles.segmentText}>OTP</Text></Pressable>
              <Pressable style={[styles.segmentBtn, loginMethod === "password" && styles.segmentActive]} onPress={() => chooseMethod("password")}><Text style={styles.segmentText}>Password</Text></Pressable>
            </View>
          )}
          {!otpStep ? (
            <>
              {mode === "register" && <TextInput style={styles.input} placeholder="Name" placeholderTextColor="#8791a7" value={name} onChangeText={setName} />}
              <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#8791a7" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
              {mode === "login" && loginMethod === "password" && <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#8791a7" secureTextEntry value={password} onChangeText={setPassword} />}
            </>
          ) : (
            <>
              <Text style={styles.notice}>{notice || `OTP sent to ${email}`}</Text>
              <TextInput style={[styles.input, styles.otpInput]} placeholder="6 digit OTP" placeholderTextColor="#8791a7" keyboardType="number-pad" maxLength={6} value={otp} onChangeText={(text) => setOtp(text.replace(/\D/g, "").slice(0, 6))} />
              <Pressable onPress={startOtp} disabled={loading}><Text style={styles.switchText}>Resend OTP</Text></Pressable>
            </>
          )}
          <Pressable style={styles.primary} onPress={submit} disabled={loading}>
            {loading ? <ActivityIndicator /> : <Text style={styles.primaryText}>{otpStep ? "Verify OTP" : mode === "register" ? "Send register OTP" : loginMethod === "password" ? "Login with password" : "Send login OTP"}</Text>}
          </Pressable>
          {otpStep && <Pressable onPress={() => { setOtpStep(false); setOtp(""); }}><Text style={styles.switchText}>Change email</Text></Pressable>}
          <Pressable onPress={switchMode}>
            <Text style={styles.switchText}>{mode === "login" ? "New user? Register" : "Already have account? Login"}</Text>
          </Pressable>
        </View>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

function ChatMessage({ item, onSpeak }) {
  const user = item.role === "user";
  return (
    <View style={[styles.msgRow, user && styles.msgRowUser]}>
      <View style={[styles.msg, user && styles.msgUser]}>
        <Text style={styles.msgRole}>{user ? "You" : "AI Plus"}</Text>
        <Text style={styles.msgText}>{item.content}</Text>
        {item.type === "image" && item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.generatedImage} /> : null}
        {!user && item.type !== "image" ? (
          <Pressable style={styles.listenMini} onPress={() => onSpeak(item.content)}>
            <Text style={styles.listenText}>🔊 Listen</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [active, setActive] = useState(null);
  const [message, setMessage] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [voiceStatus, setVoiceStatus] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("nova_token");
        if (token) {
          const data = await request("/me");
          setUser(data.user);
        }
      } catch {
        await AsyncStorage.removeItem("nova_token");
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  useEffect(() => { if (user) loadChats(); }, [user]);
  useEffect(() => { setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 120); }, [active?.messages, loading]);

  async function loadChats() {
    try {
      const data = await request("/chats");
      setChats(data.chats);
      if (data.chats[0]) openChat(data.chats[0].id);
    } catch (err) {
      Alert.alert("Error", err.message);
    }
  }

  async function openChat(id) {
    const data = await request(`/chats/${id}`);
    setActive(data.chat);
  }

  async function send() {
    const text = message.trim();
    if (!text || loading) return;
    setMessage("");
    setLoading(true);
    setActive((chat) => ({
      ...(chat || { id: null, title: "New chat", messages: [] }),
      messages: [...(chat?.messages || []), { id: `tmp-${Date.now()}`, role: "user", content: text }]
    }));
    try {
      const data = await request("/chat/message", {
        method: "POST",
        body: JSON.stringify({ chatId: active?.id, message: text })
      });
      setActive(data.chat);
      const all = await request("/chats");
      setChats(all.chats);
    } catch (err) {
      Alert.alert("Error", err.message);
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setVoiceStatus("Mic permission nahi mili.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setVoiceStatus("Recording... boliye, phir Stop dabao.");
    } catch (err) {
      setVoiceStatus("Recording start nahi hua.");
    }
  }

  async function stopRecording() {
    try {
      if (!recording) return;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setVoiceStatus("Voice ko text me convert kar raha hai...");
      const form = new FormData();
      form.append("audio", { uri, name: "voice.m4a", type: "audio/m4a" });
      const data = await requestForm("/voice/transcribe", form);
      setMessage(data.text || "");
      setVoiceStatus(data.text ? "Voice text me aa gaya. Send dabao." : "Voice clear nahi thi.");
    } catch (err) {
      setRecording(null);
      setVoiceStatus(err.message);
    }
  }

  async function generateImage() {
    const prompt = imagePrompt.trim();
    if (!prompt || imageLoading) return;
    setImagePrompt("");
    setImageLoading(true);
    try {
      const data = await request("/chat/image", {
        method: "POST",
        body: JSON.stringify({ chatId: active?.id, prompt })
      });
      setActive(data.chat);
      const all = await request("/chats");
      setChats(all.chats);
    } catch (err) {
      Alert.alert("Image error", err.message);
    } finally {
      setImageLoading(false);
    }
  }

  async function speak(text) {
    try {
      const data = await request("/voice/speak", { method: "POST", body: JSON.stringify({ text, voice: "coral" }) });
      const { sound } = await Audio.Sound.createAsync({ uri: data.audio });
      await sound.playAsync();
    } catch (err) {
      Alert.alert("Voice error", err.message);
    }
  }

  async function togglePlan() {
    const data = await request("/plan/upgrade-demo", { method: "POST" });
    setUser(data.user);
  }

  async function logout() {
    await AsyncStorage.removeItem("nova_token");
    setUser(null);
    setChats([]);
    setActive(null);
  }

  if (booting) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" /></SafeAreaView>;
  if (!user) return <Auth onAuth={setUser} />;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.app} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View>
            <Text style={styles.logo}>✦ AI Plus</Text>
            <Text style={styles.sub}>{user.name} • {user.plan}</Text>
          </View>
          <View style={styles.headerBtns}>
            <Pressable style={styles.smallBtn} onPress={() => setActive({ id: null, title: "New chat", messages: [] })}><Text style={styles.smallBtnText}>New</Text></Pressable>
            <Pressable style={styles.smallBtn} onPress={togglePlan}><Text style={styles.smallBtnText}>Plan</Text></Pressable>
            <Pressable style={styles.smallBtn} onPress={logout}><Text style={styles.smallBtnText}>Exit</Text></Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chatTabs} contentContainerStyle={{ gap: 8 }}>
          {chats.map((c) => (
            <Pressable key={c.id} style={[styles.tab, active?.id === c.id && styles.tabActive]} onPress={() => openChat(c.id)}>
              <Text numberOfLines={1} style={styles.tabText}>{c.title}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <FlatList
          ref={listRef}
          data={active?.messages || []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatMessage item={item} onSpeak={speak} />}
          contentContainerStyle={styles.messages}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Ask anything</Text><Text style={styles.emptyText}>Type below to start a new chat.</Text></View>}
          ListFooterComponent={(loading || imageLoading) ? <Text style={styles.thinking}>{imageLoading ? "AI Plus image bana raha hai..." : "AI Plus is thinking..."}</Text> : null}
        />

        <View style={styles.imageComposer}>
          <TextInput style={styles.imageInput} placeholder="Image prompt..." placeholderTextColor="#8791a7" value={imagePrompt} onChangeText={setImagePrompt} />
          <Pressable style={styles.imageBtn} onPress={generateImage}><Text style={styles.imageBtnText}>Image</Text></Pressable>
        </View>

        <Text style={styles.voiceStatus}>{voiceStatus || "Mic se bolne ke liye Record dabao. AI reply par Listen dabao."}</Text>

        <View style={styles.composer}>
          <Pressable style={[styles.voiceBtn, recording && styles.voiceBtnActive]} onPress={recording ? stopRecording : startRecording}><Text style={styles.voiceBtnText}>{recording ? "Stop" : "Mic"}</Text></Pressable>
          <TextInput
            style={styles.composerInput}
            placeholder="Message AI Plus..."
            placeholderTextColor="#8791a7"
            value={message}
            onChangeText={setMessage}
            multiline
          />
          <Pressable style={styles.sendBtn} onPress={send}><Text style={styles.sendText}>➤</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0c1020" },
  center: { flex: 1, backgroundColor: "#0c1020", alignItems: "center", justifyContent: "center" },
  app: { flex: 1 },
  authWrap: { flex: 1, padding: 24, justifyContent: "center" },
  badge: { color: "#8be9d4", fontWeight: "800", marginBottom: 18 },
  heroTitle: { color: "#f8fbff", fontSize: 42, fontWeight: "900", letterSpacing: -1, lineHeight: 46 },
  heroText: { color: "#aab4c7", marginTop: 12, fontSize: 16, lineHeight: 24 },
  card: { marginTop: 30, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", borderRadius: 28, padding: 18, backgroundColor: "rgba(255,255,255,.07)" },
  cardTitle: { color: "#fff", fontSize: 24, fontWeight: "800", marginBottom: 14 },
  input: { color: "#fff", backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.12)", borderRadius: 16, padding: 14, marginBottom: 12 },
  primary: { backgroundColor: "#8be9d4", borderRadius: 16, alignItems: "center", padding: 15, marginTop: 4 },
  primaryText: { color: "#061019", fontWeight: "900" },
  switchText: { color: "#aab4c7", textAlign: "center", marginTop: 16 },
  notice: { color: "#8be9d4", backgroundColor: "rgba(139,233,212,.12)", borderWidth: 1, borderColor: "rgba(139,233,212,.25)", borderRadius: 14, padding: 12, marginBottom: 12 },
  otpInput: { textAlign: "center", letterSpacing: 8, fontSize: 22, fontWeight: "900" },
  segmented: { flexDirection: "row", gap: 8, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", backgroundColor: "rgba(255,255,255,.05)", borderRadius: 16, padding: 6, marginBottom: 12 },
  segmentBtn: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center" },
  segmentActive: { backgroundColor: "#8be9d4" },
  segmentText: { color: "#fff", fontWeight: "900" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.1)" },
  logo: { color: "#fff", fontSize: 24, fontWeight: "900" },
  sub: { color: "#aab4c7", marginTop: 3 },
  headerBtns: { flexDirection: "row", gap: 8 },
  smallBtn: { backgroundColor: "rgba(255,255,255,.1)", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12 },
  smallBtnText: { color: "#fff", fontWeight: "700" },
  chatTabs: { maxHeight: 54, paddingHorizontal: 12, paddingVertical: 10 },
  tab: { width: 140, borderWidth: 1, borderColor: "rgba(255,255,255,.12)", borderRadius: 999, paddingVertical: 9, paddingHorizontal: 12, backgroundColor: "rgba(255,255,255,.06)" },
  tabActive: { borderColor: "#8be9d4" },
  tabText: { color: "#dbe7ff" },
  messages: { padding: 16, gap: 12, flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 120 },
  emptyTitle: { color: "#fff", fontSize: 30, fontWeight: "900" },
  emptyText: { color: "#aab4c7", marginTop: 8 },
  msgRow: { alignItems: "flex-start" },
  msgRowUser: { alignItems: "flex-end" },
  msg: { maxWidth: "86%", borderRadius: 22, padding: 14, backgroundColor: "rgba(255,255,255,.08)", borderWidth: 1, borderColor: "rgba(255,255,255,.1)" },
  msgUser: { backgroundColor: "rgba(139,233,212,.16)" },
  msgRole: { color: "#8be9d4", fontSize: 12, fontWeight: "900", marginBottom: 5 },
  msgText: { color: "#f8fbff", lineHeight: 22 },
  thinking: { color: "#aab4c7", padding: 12 },
  composer: { flexDirection: "row", gap: 10, alignItems: "flex-end", padding: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.1)" },
  composerInput: { flex: 1, minHeight: 48, maxHeight: 120, color: "#fff", backgroundColor: "rgba(255,255,255,.08)", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  sendBtn: { width: 48, height: 48, borderRadius: 18, backgroundColor: "#8be9d4", alignItems: "center", justifyContent: "center" },
  sendText: { color: "#061019", fontSize: 20, fontWeight: "900" },
  imageComposer: { flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingTop: 8 },
  imageInput: { flex: 1, color: "#fff", backgroundColor: "rgba(255,255,255,.08)", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  imageBtn: { backgroundColor: "rgba(139,233,212,.18)", borderWidth: 1, borderColor: "rgba(139,233,212,.35)", borderRadius: 16, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  imageBtnText: { color: "#8be9d4", fontWeight: "900" },
  generatedImage: { width: 250, height: 250, borderRadius: 18, marginTop: 10, backgroundColor: "rgba(255,255,255,.06)" },
  listenMini: { alignSelf: "flex-start", marginTop: 10, borderWidth: 1, borderColor: "rgba(139,233,212,.35)", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 10 },
  listenText: { color: "#8be9d4", fontWeight: "800" },
  voiceStatus: { color: "#8791a7", fontSize: 12, paddingHorizontal: 14, paddingTop: 8 },
  voiceBtn: { width: 48, height: 48, borderRadius: 18, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,.12)" },
  voiceBtnActive: { backgroundColor: "rgba(255,123,123,.16)", borderColor: "rgba(255,123,123,.35)" },
  voiceBtnText: { color: "#8be9d4", fontWeight: "900", fontSize: 12 }
});

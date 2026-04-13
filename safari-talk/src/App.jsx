import { useState, useEffect, useRef, useCallback } from "react";

// ─── Config ───────────────────────────────────────────────────────────────
const DURATION = 60;
const API_KEY = import.meta.env.VITE_GROQ_KEY;
const MODEL = "llama3-8b-8192";

// ─── Safari scenes ────────────────────────────────────────────────────────
const SCENES = [
  {
    url: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200&q=85",
    title: "The Golden Savanna",
    description: "vast golden grasslands with elephants, giraffes, zebras and colourful birds under a bright African sky",
  },
  {
    url: "https://images.unsplash.com/photo-1534476478164-b15bbd7ca1ab?w=1200&q=85",
    title: "Lion Kingdom",
    description: "a majestic lion resting on a rock in the African savanna at golden hour",
  },
  {
    url: "https://images.unsplash.com/photo-1551009175-8a68da93d5f9?w=1200&q=85",
    title: "Elephant Family",
    description: "a family of elephants walking through the African bush with baby elephants",
  },
];

function fmt(s) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function parseToolCall(text) {
  const h = text.match(/\[HIGHLIGHT:([^:]+):([^:]+):([^\]]+)\]/);
  const f = text.match(/\[FACT:([^:]+):([^\]]+)\]/);
  const clean = text.replace(/\[HIGHLIGHT:[^\]]+\]/g, "").replace(/\[FACT:[^\]]+\]/g, "").trim();
  let tool = null;
  if (h) tool = { type: "highlight", animal: h[1], emoji: h[2], message: h[3] };
  else if (f) tool = { type: "fact", emoji: f[1], fact: f[2] };
  return { clean, tool };
}

// ─── Main Component ───────────────────────────────────────────────────────
export default function App() {
  const [scene] = useState(SCENES[0]);
  const [phase, setPhase] = useState("idle"); // idle | active | ended
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [highlight, setHighlight] = useState(null);
  const [funFact, setFunFact] = useState(null);
  const [subtitle, setSubtitle] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [zaraMood, setZaraMood] = useState("happy"); // happy | excited | thinking

  const timerRef = useRef(null);
  const recogRef = useRef(null);
  const endedRef = useRef(false);
  const speakingRef = useRef(false);
  const historyRef = useRef([]);

  // Keep historyRef in sync
  useEffect(() => { historyRef.current = history; }, [history]);

  // ── Tool overlays ──────────────────────────────────────────────────────
  const showHighlight = useCallback((data) => {
    setHighlight(data);
    setTimeout(() => setHighlight(null), 4500);
  }, []);

  const showFact = useCallback((data) => {
    setFunFact(data);
    setTimeout(() => setFunFact(null), 6000);
  }, []);

  // ── Browser TTS ───────────────────────────────────────────────────────
  const speak = useCallback((text, onDone) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92;
    utter.pitch = 1.25;
    utter.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.name.includes("Samantha")) ||
      voices.find(v => v.name.includes("Google UK English Female")) ||
      voices.find(v => v.name.includes("Microsoft Zira")) ||
      voices.find(v => v.lang === "en-US") || voices[0];
    if (v) utter.voice = v;
    utter.onstart = () => { setSpeaking(true); speakingRef.current = true; setZaraMood("excited"); };
    utter.onend = () => { setSpeaking(false); speakingRef.current = false; setZaraMood("happy"); if (onDone) onDone(); };
    utter.onerror = () => { setSpeaking(false); speakingRef.current = false; if (onDone) onDone(); };
    window.speechSynthesis.speak(utter);
  }, []);

  // ── Gemini API ────────────────────────────────────────────────────────
  const askGemini = useCallback(async (userMsg) => {
    const systemPrompt = `You are Zara, the most fun and friendly AI safari guide for young children aged 4-8.
You are looking at: ${scene.description}.
Rules:
- VERY short responses — max 2 sentences only
- Always end with a simple fun question
- Use excitement: "Wow!", "Oh amazing!", "Yes!", "Great job!"
- Embed tool commands naturally:
  [HIGHLIGHT:objectname:emoji:short fun message] — use when talking about something in the image
  [FACT:emoji:one amazing fact under 12 words] — use once or twice
- Examples: "Wow, I can see a jeep! [HIGHLIGHT:jeep:🚙:A safari jeep for adventures!] Can you pretend to drive?"
- Be warm, silly, encouraging. Children love you!`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...historyRef.current.map(h => ({
        role: h.role === "model" ? "assistant" : "user",
        content: h.parts[0].text
      })),
      { role: "user", content: userMsg }
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 100, temperature: 1.0 }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || "API error"); }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Wow, what do you see?";
  }, [scene]);

  // ── Speech recognition ────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (endedRef.current || speakingRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Please use Google Chrome for voice!"); return; }

    const r = new SR();
    recogRef.current = r;
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = true;

    r.onstart = () => { setListening(true); setZaraMood("thinking"); };
    r.onend = () => setListening(false);

    r.onresult = async (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
      setSubtitle("You: " + transcript);

      if (e.results[e.results.length - 1].isFinal) {
        r.stop();
        if (endedRef.current) return;
        try {
          const newHistory = [...historyRef.current,
            { role: "user", parts: [{ text: transcript }] }];
          const reply = await askGemini(transcript);
          const { clean, tool } = parseToolCall(reply);

          if (tool?.type === "highlight") showHighlight(tool);
          if (tool?.type === "fact") showFact(tool);

          setSubtitle("Zara: " + clean);
          const updated = [...newHistory, { role: "model", parts: [{ text: clean }] }];
          setHistory(updated);
          historyRef.current = updated;

          speak(clean, () => {
            if (!endedRef.current) setTimeout(() => startListening(), 600);
          });
        } catch (err) { setError(err.message); }
      }
    };

    r.onerror = (e) => {
      setListening(false);
      if (e.error !== "no-speech" && e.error !== "aborted" && !endedRef.current && !speakingRef.current) {
        setTimeout(() => startListening(), 1200);
      }
    };
    r.start();
  }, [askGemini, speak, showHighlight, showFact]);

  // ── End session ───────────────────────────────────────────────────────
  const endSession = useCallback(() => {
    endedRef.current = true;
    clearInterval(timerRef.current);
    window.speechSynthesis.cancel();
    recogRef.current?.stop();
    setPhase("ended");
    setSpeaking(false);
    setListening(false);
  }, []);

  // ── Start session ─────────────────────────────────────────────────────
  const startSession = useCallback(async () => {
    setError("");
    endedRef.current = false;
    setHistory([]);
    historyRef.current = [];
    setPhase("active");
    setTimeLeft(DURATION);
    setHighlight(null);
    setFunFact(null);
    setSubtitle("");

    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endSession(); return 0; } return t - 1; });
    }, 1000);

    try {
      const opening = await askGemini("Start! Greet the child super enthusiastically and ask what they see in the image. Use a HIGHLIGHT tool call right away.");
      const { clean, tool } = parseToolCall(opening);
      if (tool?.type === "highlight") showHighlight(tool);
      if (tool?.type === "fact") showFact(tool);
      setSubtitle("Zara: " + clean);
      const h = [{ role: "model", parts: [{ text: clean }] }];
      setHistory(h); historyRef.current = h;
      speak(clean, () => { if (!endedRef.current) startListening(); });
    } catch (err) {
      setError(err.message);
      setPhase("idle");
      clearInterval(timerRef.current);
    }
  }, [askGemini, speak, startListening, endSession, showHighlight, showFact]);

  const reset = () => {
    endedRef.current = false;
    setPhase("idle"); setTimeLeft(DURATION);
    setHighlight(null); setFunFact(null);
    setSubtitle(""); setError(""); setHistory([]);
    historyRef.current = [];
  };

  useEffect(() => {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    return () => { clearInterval(timerRef.current); window.speechSynthesis.cancel(); recogRef.current?.stop(); };
  }, []);

  const pct = (timeLeft / DURATION) * 100;
  const timerColor = timeLeft > 30 ? "#4ade80" : timeLeft > 10 ? "#fbbf24" : "#f87171";
  const zaraEmoji = zaraMood === "excited" ? "🤩" : zaraMood === "thinking" ? "🤔" : "😊";

  return (
    <div className="app">
      {/* ── Decorative blobs ── */}
      <div className="blob blob-1" />
      <div className="blob blob-2" />
      <div className="blob blob-3" />

      {/* ── Header ── */}
      <header className="header">
        <div className="logo-wrap">
          <span className="logo-icon">🦁</span>
          <div>
            <span className="logo-text">Safari Talk</span>
            <span className="logo-sub">AI Adventure for Kids</span>
          </div>
        </div>

        <div className="header-right">
          {phase === "active" && listening && (
            <div className="listen-pill">
              <span className="listen-dot" />
              Listening…
            </div>
          )}
          {phase === "active" && (
            <div className="timer-wrap">
              <svg viewBox="0 0 56 56" className="timer-svg">
                <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5" />
                <circle cx="28" cy="28" r="24" fill="none"
                  stroke={timerColor} strokeWidth="5"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - pct / 100)}`}
                  strokeLinecap="round" transform="rotate(-90 28 28)"
                  style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
                />
              </svg>
              <span className="timer-num" style={{ color: timerColor }}>{fmt(timeLeft)}</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main">

        {/* ── Zara avatar ── */}
        <div className={`zara-avatar ${speaking ? "zara-speaking" : ""} ${listening ? "zara-listening" : ""}`}>
          <div className="zara-face">{zaraEmoji}</div>
          <div className="zara-name">Zara</div>
          {speaking && (
            <div className="sound-waves">
              {[...Array(4)].map((_, i) => <span key={i} className="wave" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          )}
        </div>

        {/* ── Scene image ── */}
        <div className="scene-wrap">
          <div className="scene-label">{scene.title}</div>
          <img src={scene.url} alt={scene.title} className="scene-img" />

          {/* Highlight overlay */}
          {highlight && (
            <div className="hl-overlay">
              <div className="hl-card">
                <div className="hl-emoji">{highlight.emoji}</div>
                <div className="hl-msg">{highlight.message}</div>
                <div className="hl-name">✨ {highlight.animal} ✨</div>
              </div>
            </div>
          )}

          {/* Fun fact */}
          {funFact && (
            <div className="fact-card">
              <span className="fact-emoji">{funFact.emoji}</span>
              <span className="fact-text">{funFact.fact}</span>
            </div>
          )}

        </div>

        {/* ── Subtitle BELOW image ── */}
        <div className={`subtitle-box ${subtitle.startsWith("You:") ? "subtitle-user" : subtitle ? "subtitle-zara" : "subtitle-idle"}`}>
          <span className="subtitle-avatar">{subtitle.startsWith("You:") ? "🧒" : "🦁"}</span>
          <span className="subtitle-text">{subtitle || "Zara will start talking when you press the button!"}</span>
        </div>

        {/* ── Controls ── */}
        <div className="controls">
          {phase === "idle" && (
            <button className="btn-start" onClick={startSession}>
              <span className="btn-icon">🎙️</span>
              <span>Start Safari Adventure!</span>
            </button>
          )}
          {phase === "active" && (
            <button className="btn-end" onClick={endSession}>
              <span className="btn-icon">⏹</span>
              <span>End Adventure</span>
            </button>
          )}
          {phase === "ended" && (
            <div className="ended-wrap">
              <div className="ended-stars">⭐⭐⭐</div>
              <p className="ended-title">Amazing Explorer!</p>
              <p className="ended-sub">You chatted with Zara about the safari! 🦁</p>
              <button className="btn-start" onClick={reset}>🔄 Play Again!</button>
            </div>
          )}
          {error && <div className="error-box">⚠️ {error}</div>}
        </div>

        {/* ── Idle hint ── */}
        {phase === "idle" && (
          <div className="hint-row">
            <div className="hint-chip">🎙️ Speak freely</div>
            <div className="hint-chip">🦒 Ask about animals</div>
            <div className="hint-chip">⏱️ 60 seconds</div>
            <div className="hint-chip">🌟 Fun surprises!</div>
          </div>
        )}

      </main>
    </div>
  );
}

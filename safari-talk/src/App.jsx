import { useState, useEffect, useRef, useCallback } from "react";

const DURATION = 60;
const API_KEY = import.meta.env.VITE_GROQ_KEY;
const MODEL = "llama-3.3-70b-versatile";

const ANIMALS = [
  {
    name: "Giraffe",
    emoji: "🦒",
    image: "https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=1200&q=85",
    thumb: "https://images.unsplash.com/photo-1547721064-da6cfb341d50?w=160&q=80",
    fact: "Giraffes are the tallest animals on Earth — their necks alone are 6 feet long!",
    description: "two giraffes standing tall in the golden African savanna with acacia trees and mountains under a beautiful sky",
  },
  {
    name: "Elephant",
    emoji: "🐘",
    image: "https://images.unsplash.com/photo-1564760055775-d63b17a55c44?w=1200&q=85",
    thumb: "https://images.unsplash.com/photo-1564760055775-d63b17a55c44?w=160&q=80",
    fact: "Elephants are the largest land animals and never forget their friends!",
    description: "a mother elephant and baby elephant walking together through tall green African grass under a bright sky",
  },
  {
    name: "Lion",
    emoji: "🦁",
    image: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=1200&q=85",
    thumb: "https://images.unsplash.com/photo-1546182990-dffeafbe841d?w=160&q=80",
    fact: "Lions can roar so loud you can hear them from 8 kilometres away!",
    description: "a majestic male lion with a big golden mane standing proudly in tall golden African grass",
  },
  {
    name: "Zebra",
    emoji: "🦓",
    image: "https://images.unsplash.com/photo-1551009175-15bdf9dcb580?w=1200&q=85",
    thumb: "https://images.unsplash.com/photo-1551009175-15bdf9dcb580?w=160&q=80",
    fact: "Every zebra has unique stripes — no two zebras look the same, just like fingerprints!",
    description: "a zebra with beautiful black and white stripes standing in dry golden African grasslands with acacia trees",
  },
  {
    name: "Wildebeest",
    emoji: "🐃",
    image: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=1200&q=85",
    thumb: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=160&q=80",
    fact: "Millions of wildebeest run together in the Great Migration — the biggest animal journey on Earth!",
    description: "a huge herd of wildebeest running across the African savanna during the great migration with safari jeeps watching",
  },
];

function fmt(s) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function parseToolCall(text) {
  const f = text.match(/\[FACT:([^\]]+)\]/);
  const clean = text.replace(/\[FACT:[^\]]+\]/g, "").trim();
  return { clean, fact: f ? f[1] : null };
}

function pickAnimal(prevName) {
  const pool = ANIMALS.filter(a => a.name !== prevName);
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function App() {
  const [animal, setAnimal] = useState(() => ANIMALS[Math.floor(Math.random() * ANIMALS.length)]);
  const [phase, setPhase] = useState("idle");
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [currentFact, setCurrentFact] = useState(null);
  const [subtitle, setSubtitle] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [zaraMood, setZaraMood] = useState("happy");
  const [sessionFacts, setSessionFacts] = useState([]);

  const timerRef = useRef(null);
  const recogRef = useRef(null);
  const endedRef = useRef(false);
  const speakingRef = useRef(false);
  const historyRef = useRef([]);
  const animalRef = useRef(animal);

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { animalRef.current = animal; }, [animal]);

  const showFact = useCallback((factText) => {
    setCurrentFact(factText);
    setSessionFacts(prev => prev.includes(factText) ? prev : [...prev, factText]);
  }, []);

  const speak = useCallback((text, onDone) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.92; utter.pitch = 1.2; utter.volume = 1;
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

  const askAI = useCallback(async (userMsg) => {
    const a = animalRef.current;
    const systemPrompt = `You are Zara, a super fun friendly AI safari guide for children aged 4-8.
You are showing an image of: ${a.description}.
The animal is: ${a.name} ${a.emoji}

CRITICAL RULES:
- Max 2 short sentences per response
- Always end with a simple fun question
- Use excitement: "Wow!", "Amazing!", "Yes!", "Great job!", "Oh cool!"
- When child says short things like "yes", "ok", "yeah", "no", "hmm", "good" — say something like "Cool! Did you know..." and move naturally to a new fun fact about the ${a.name}
- NEVER ask the child to say more or speak in full sentences
- Share facts using: [FACT:short fact under 12 words]
- Example response: "Wow yes! [FACT:Giraffes sleep only 30 minutes a day!] Can you try sleeping for just 30 minutes tonight?"
- Use FACT command 2-3 times total during the whole conversation
- Be warm, silly, encouraging!`;

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
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 120, temperature: 0.9 }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || "API error"); }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Wow, what do you think about this animal?";
  }, []);

  const startListening = useCallback(() => {
    if (endedRef.current || speakingRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Please use Google Chrome for voice!"); return; }
    const r = new SR();
    recogRef.current = r;
    r.lang = "en-US"; r.continuous = false; r.interimResults = true;
    r.onstart = () => { setListening(true); setZaraMood("thinking"); };
    r.onend = () => setListening(false);
    r.onresult = async (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join("");
      setSubtitle("You: " + transcript);
      if (e.results[e.results.length - 1].isFinal) {
        r.stop();
        if (endedRef.current) return;
        try {
          const newHistory = [...historyRef.current, { role: "user", parts: [{ text: transcript }] }];
          const reply = await askAI(transcript);
          const { clean, fact } = parseToolCall(reply);
          if (fact) showFact(fact);
          setSubtitle("Zara: " + clean);
          const updated = [...newHistory, { role: "model", parts: [{ text: clean }] }];
          setHistory(updated); historyRef.current = updated;
          speak(clean, () => { if (!endedRef.current) setTimeout(() => startListening(), 500); });
        } catch (err) { setError(err.message); }
      }
    };
    r.onerror = (e) => {
      setListening(false);
      if (e.error !== "no-speech" && e.error !== "aborted" && !endedRef.current && !speakingRef.current) {
        setTimeout(() => startListening(), 1000);
      }
    };
    r.start();
  }, [askAI, speak, showFact]);

  const endSession = useCallback(() => {
    endedRef.current = true;
    clearInterval(timerRef.current);
    window.speechSynthesis.cancel();
    recogRef.current?.stop();
    setPhase("ended"); setSpeaking(false); setListening(false);
  }, []);

  const startSession = useCallback(async () => {
    setError(""); endedRef.current = false;
    setHistory([]); historyRef.current = [];
    setPhase("active"); setTimeLeft(DURATION);
    setCurrentFact(null); setSubtitle(""); setSessionFacts([]);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endSession(); return 0; } return t - 1; });
    }, 1000);
    try {
      const opening = await askAI(`Start! Greet the child warmly, say you can both see a ${animalRef.current.name} in the picture, share one exciting fact using [FACT:...], and ask a simple fun question.`);
      const { clean, fact } = parseToolCall(opening);
      if (fact) showFact(fact);
      setSubtitle("Zara: " + clean);
      const h = [{ role: "model", parts: [{ text: clean }] }];
      setHistory(h); historyRef.current = h;
      speak(clean, () => { if (!endedRef.current) startListening(); });
    } catch (err) { setError(err.message); setPhase("idle"); clearInterval(timerRef.current); }
  }, [askAI, speak, startListening, endSession, showFact]);

  const reset = () => {
    endedRef.current = false;
    const next = pickAnimal(animal.name);
    setAnimal(next); animalRef.current = next;
    setPhase("idle"); setTimeLeft(DURATION);
    setCurrentFact(null); setSubtitle(""); setError("");
    setHistory([]); historyRef.current = []; setSessionFacts([]);
    setZaraMood("happy");
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
      <div className="bg-glow bg-1" />
      <div className="bg-glow bg-2" />

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
            <div className="listen-pill"><span className="listen-dot" />Listening…</div>
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

      <main className="main">
        <div className={`zara-wrap ${speaking ? "is-speaking" : ""} ${listening ? "is-listening" : ""}`}>
          <div className="zara-face">{zaraEmoji}</div>
          <span className="zara-name">Zara</span>
          {speaking && (
            <div className="sound-waves">
              {[...Array(5)].map((_, i) => <span key={i} className="wave" style={{ animationDelay: `${i * 0.12}s` }} />)}
            </div>
          )}
        </div>

        <div className="scene-wrap">
          <div className="scene-label">{animal.emoji} {animal.name}</div>
          <img src={animal.image} alt={animal.name} className="scene-img" />
        </div>

        <div className={`subtitle-box ${subtitle.startsWith("You:") ? "sub-user" : subtitle ? "sub-zara" : "sub-idle"}`}>
          <span className="sub-icon">{subtitle.startsWith("You:") ? "🧒" : "🦁"}</span>
          <span className="sub-text">{subtitle || `Press Start and talk to Zara about the ${animal.name}!`}</span>
        </div>

        {currentFact && (
          <div className="fact-card">
            <img src={animal.thumb} alt={animal.name} className="fact-thumb" />
            <div className="fact-content">
              <span className="fact-animal">{animal.emoji} {animal.name} Fact</span>
              <span className="fact-text">✨ {currentFact}</span>
            </div>
          </div>
        )}

        {phase === "ended" && sessionFacts.length > 0 && (
          <div className="facts-summary">
            <p className="facts-title">🌟 Facts you learned about {animal.name}s!</p>
            {sessionFacts.map((f, i) => (
              <div key={i} className="facts-item">
                <span>{animal.emoji}</span><span>{f}</span>
              </div>
            ))}
          </div>
        )}

        <div className="controls">
          {phase === "idle" && (
            <button className="btn-start" onClick={startSession}>
              <span>🎙️</span><span>Start Safari Adventure!</span>
            </button>
          )}
          {phase === "active" && (
            <button className="btn-end" onClick={endSession}>
              <span>⏹</span><span>End Adventure</span>
            </button>
          )}
          {phase === "ended" && (
            <div className="ended-wrap">
              <div className="ended-stars">⭐⭐⭐</div>
              <p className="ended-title">Amazing Explorer!</p>
              <p className="ended-sub">Great chat about the {animal.name}! {animal.emoji}</p>
              <button className="btn-start" onClick={reset}>🔄 Next Animal!</button>
            </div>
          )}
          {error && <div className="error-box">⚠️ {error}</div>}
        </div>

        {phase === "idle" && (
          <div className="hint-row">
            <div className="hint-chip">🎙️ Speak freely</div>
            <div className="hint-chip">{animal.emoji} About {animal.name}s</div>
            <div className="hint-chip">⏱️ 60 seconds</div>
            <div className="hint-chip">🌟 Learn fun facts!</div>
          </div>
        )}
      </main>
    </div>
  );
}



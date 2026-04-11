import { useState, useEffect, useRef, useCallback } from "react";

// ── Tool definitions sent to the Realtime API ──────────────────────────────
const TOOLS = [
  {
    type: "function",
    name: "highlight_animal",
    description:
      "Highlight a specific animal or object in the image and show a fun emoji reaction on screen to reward the child.",
    parameters: {
      type: "object",
      properties: {
        animal: {
          type: "string",
          description: "Name of the animal or object to highlight (e.g. 'elephant', 'parrot')",
        },
        emoji: {
          type: "string",
          description: "A fun emoji to display as a reaction (e.g. '🦁', '🌟', '🎉')",
        },
        message: {
          type: "string",
          description: "Short celebratory message to show on screen (max 8 words)",
        },
      },
      required: ["animal", "emoji", "message"],
    },
  },
  {
    type: "function",
    name: "show_fun_fact",
    description: "Display a short fun fact card on screen about an animal or topic from the image.",
    parameters: {
      type: "object",
      properties: {
        fact: {
          type: "string",
          description: "A short, child-friendly fun fact (1-2 sentences max)",
        },
        emoji: { type: "string", description: "Relevant emoji" },
      },
      required: ["fact", "emoji"],
    },
  },
];

// ── Scene image ───────────────────────────────────────────────────────────
const SCENE = {
  url: "https://images.unsplash.com/photo-1516426122078-c23e76319801?w=900&q=80",
  alt: "African savanna with animals",
};

const DURATION = 60;

function fmt(s) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export default function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem("oai_key") || "");
  const [phase, setPhase] = useState("idle");
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [highlight, setHighlight] = useState(null);
  const [funFact, setFunFact] = useState(null);
  const [subtitle, setSubtitle] = useState("");
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const highlightTimer = useRef(null);
  const factTimer = useRef(null);

  const saveKey = (k) => {
    setApiKey(k);
    localStorage.setItem("oai_key", k);
  };

  const handleToolCall = useCallback((name, args) => {
    if (name === "highlight_animal") {
      setHighlight(args);
      clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlight(null), 4000);
    } else if (name === "show_fun_fact") {
      setFunFact(args);
      clearTimeout(factTimer.current);
      factTimer.current = setTimeout(() => setFunFact(null), 6000);
    }
  }, []);

  const handleMessage = useCallback(
    (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === "response.audio_transcript.delta") {
        setSubtitle((p) => (p + (msg.delta || "")).slice(-120));
      }
      if (msg.type === "response.audio_transcript.done") {
        setTimeout(() => setSubtitle(""), 2000);
      }
      if (msg.type === "response.audio.delta") setSpeaking(true);
      if (msg.type === "response.audio.done") setSpeaking(false);

      if (msg.type === "response.function_call_arguments.done") {
        try {
          const args = JSON.parse(msg.arguments);
          handleToolCall(msg.name, args);
          const result = {
            type: "conversation.item.create",
            item: {
              type: "function_call_output",
              call_id: msg.call_id,
              output: JSON.stringify({ success: true }),
            },
          };
          dcRef.current?.send(JSON.stringify(result));
          dcRef.current?.send(JSON.stringify({ type: "response.create" }));
        } catch {}
      }
    },
    [handleToolCall]
  );

  const endSession = useCallback(() => {
    clearInterval(timerRef.current);
    pcRef.current?.close();
    pcRef.current = null;
    dcRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setPhase("ended");
    setSpeaking(false);
  }, []);

  const startSession = useCallback(async () => {
    if (!apiKey) return;
    setError("");
    setPhase("connecting");
    setTimeLeft(DURATION);
    setHighlight(null);
    setFunFact(null);
    setSubtitle("");

    try {
      const tokenRes = await fetch("https://api.openai.com/v1/realtime/sessions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-realtime-preview-2024-12-17",
          voice: "shimmer",
          instructions: `You are Zara, a super-friendly and enthusiastic AI companion talking to a young child (age 4-8). 
You are looking at a beautiful image of an African savanna with elephants, giraffes, zebras, and colourful birds.
START the conversation immediately and warmly — say hello and ask the child what animal they see first.
Keep your sentences SHORT and SIMPLE. Use lots of excitement and encouragement.
Ask easy questions like "Can you spot the giraffe?", "What sound does an elephant make?", "What colour is that bird?".
Use the highlight_animal tool whenever the child mentions or you talk about a specific animal — it creates a fun animation on screen.
Use the show_fun_fact tool once or twice to share a cool fact.
Keep the conversation going for about 1 minute total. Be warm, playful, and encouraging.`,
          tools: TOOLS,
          tool_choice: "auto",
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: {
            type: "server_vad",
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
          },
        }),
      });

      if (!tokenRes.ok) {
        const e = await tokenRes.json();
        throw new Error(e?.error?.message || "Failed to create session");
      }
      const { client_secret } = await tokenRes.json();

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => { audio.srcObject = e.streams[0]; };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("message", handleMessage);
      dc.addEventListener("open", () => {
        dc.send(JSON.stringify({ type: "response.create" }));
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${client_secret.value}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp,
        }
      );
      if (!sdpRes.ok) throw new Error("SDP exchange failed");
      const answer = { type: "answer", sdp: await sdpRes.text() };
      await pc.setRemoteDescription(answer);

      setPhase("active");

      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) { endSession(); return 0; }
          return t - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err.message);
      setPhase("idle");
    }
  }, [apiKey, handleMessage, endSession]);

  const reset = () => {
    setPhase("idle");
    setTimeLeft(DURATION);
    setHighlight(null);
    setFunFact(null);
    setSubtitle("");
  };

  useEffect(() => () => endSession(), []);

  const timerPct = (timeLeft / DURATION) * 100;
  const timerColor = timeLeft > 30 ? "#4ade80" : timeLeft > 10 ? "#fbbf24" : "#f87171";

  return (
    <div className="app">
      {!apiKey && (
        <div className="gate">
          <div className="gate-box">
            <div className="gate-icon">🔑</div>
            <h2>Enter your OpenAI API Key</h2>
            <p>Your key stays in your browser only.</p>
            <input
              type="password"
              placeholder="sk-..."
              onKeyDown={(e) => { if (e.key === "Enter") saveKey(e.target.value.trim()); }}
              className="key-input"
            />
            <button
              className="key-btn"
              onClick={(e) => saveKey(e.target.closest(".gate-box").querySelector("input").value.trim())}
            >
              Let's Go! 🚀
            </button>
          </div>
        </div>
      )}

      {apiKey && (
        <>
          <header className="header">
            <span className="logo">🌍 Safari Talk</span>
            {phase === "active" && (
              <div className="timer-wrap">
                <svg className="timer-svg" viewBox="0 0 44 44">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="#ffffff33" strokeWidth="4" />
                  <circle
                    cx="22" cy="22" r="18" fill="none"
                    stroke={timerColor} strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 18}`}
                    strokeDashoffset={`${2 * Math.PI * 18 * (1 - timerPct / 100)}`}
                    strokeLinecap="round" transform="rotate(-90 22 22)"
                    style={{ transition: "stroke-dashoffset 1s linear, stroke 0.5s" }}
                  />
                </svg>
                <span className="timer-text" style={{ color: timerColor }}>{fmt(timeLeft)}</span>
              </div>
            )}
          </header>

          <main className="main">
            <div className="scene-wrap">
              <img src={SCENE.url} alt={SCENE.alt} className="scene-img" />

              {highlight && (
                <div className="highlight-overlay">
                  <div className="highlight-burst">
                    <span className="h-emoji">{highlight.emoji}</span>
                    <span className="h-msg">{highlight.message}</span>
                    <span className="h-animal">✨ {highlight.animal} ✨</span>
                  </div>
                </div>
              )}

              {funFact && (
                <div className="fact-card">
                  <span className="fact-emoji">{funFact.emoji}</span>
                  <p className="fact-text">{funFact.fact}</p>
                </div>
              )}

              {speaking && (
                <div className="wave-bar">
                  {[...Array(7)].map((_, i) => (
                    <span key={i} className="wave-dot" style={{ animationDelay: `${i * 0.1}s` }} />
                  ))}
                  <span className="wave-label">Zara is talking…</span>
                </div>
              )}

              {subtitle && <div className="subtitle">{subtitle}</div>}
            </div>

            <div className="controls">
              {phase === "idle" && (
                <button className="btn-start" onClick={startSession}>🎙️ Start Safari Chat!</button>
              )}
              {phase === "connecting" && (
                <button className="btn-start loading" disabled>
                  <span className="spin">🌀</span> Connecting…
                </button>
              )}
              {phase === "active" && (
                <button className="btn-end" onClick={endSession}>⏹ End Chat</button>
              )}
              {phase === "ended" && (
                <div className="ended-box">
                  <p className="ended-msg">🎉 Great job exploring the safari! 🦁</p>
                  <button className="btn-start" onClick={reset}>🔄 Play Again!</button>
                </div>
              )}
              {error && <p className="error-msg">⚠️ {error}</p>}
            </div>

            {phase === "idle" && (
              <div className="instructions">
                <span>🦒</span>
                <p>Look at the animals! Press the button and chat with Zara about what you see.</p>
                <span>🐘</span>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}

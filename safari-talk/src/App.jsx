import { useState, useEffect, useRef, useCallback } from "react";

const DURATION = 60;
const API_KEY = import.meta.env.VITE_GROQ_KEY;
const MODEL = "llama-3.3-70b-versatile";

const ANIMALS = [
  {
    name: "Giraffe", emoji: "🦒",
    image: "/animals/giraffe.png",
    description: "two beautiful giraffes standing tall in the golden African savanna with mountains and acacia trees",
    facts: [
      "Giraffes are the tallest animals on Earth — taller than 6 grown-up humans stacked together!",
      "A giraffe's neck alone is about 6 feet long — that's taller than most adults!",
      "Giraffes sleep only 30 minutes a day — they mostly sleep standing up!",
      "A giraffe's tongue is 18 inches long and dark purple in colour!",
      "One kick from a giraffe is so powerful it can break a lion's skull!",
      "There are only about 117,000 giraffes left in the wild on Earth.",
      "Baby giraffes can walk within just one hour of being born!",
    ],
    topics: [
      "Can you see the giraffes? How many can you count?",
      "Would you like to be a giraffe for a day?",
      "Look how tall they are! Can you stretch your arms up as high as you can?",
      "What do you think giraffes eat way up there at the top of trees?",
    ]
  },
  {
    name: "Elephant", emoji: "🐘",
    image: "/animals/elephant.png",
    description: "a mother elephant and baby elephant walking together in tall green African grass",
    facts: [
      "Elephants are the largest land animals on Earth!",
      "An elephant's brain weighs 11 pounds — the biggest brain of any land animal!",
      "Elephants never forget — they remember friends and family for their whole lives.",
      "Baby elephants weigh about 200 pounds at birth!",
      "Elephants use their trunks like we use our hands — to grab, smell, and even hug!",
      "An elephant drinks about 50 gallons of water every single day!",
      "There are about 415,000 elephants living in Africa right now.",
    ],
    topics: [
      "Can you see the baby elephant and the mummy elephant?",
      "Look how big their ears are! Why do you think elephants have such big ears?",
      "Would you like to ride on an elephant one day?",
      "Can you make a trumpet sound like an elephant?",
    ]
  },
  {
    name: "Lion", emoji: "🦁",
    image: "/animals/lion.png",
    description: "a majestic male lion with a big golden mane standing proudly in tall golden African grass",
    facts: [
      "Lions are called the King of the Jungle!",
      "A lion's roar is so loud you can hear it from 8 kilometres away!",
      "Lions sleep for up to 20 hours a day — they love to rest!",
      "A group of lions is called a pride — they live together like a big family!",
      "The male lion's big fluffy mane makes him look strong to other lions!",
      "Lions are the only cats that live in groups — all other cats live alone!",
      "There are only about 20,000 lions left in the wild!",
    ],
    topics: [
      "Can you see the lion's big fluffy mane?",
      "Can you roar like a lion? Let me hear your best lion roar!",
      "Do you think the lion is friendly or scary?",
      "What do you think a lion eats for breakfast?",
    ]
  },
  {
    name: "Wildebeest", emoji: "🐃",
    image: "/animals/wildebeest.png",
    description: "a huge herd of wildebeest running together across the African savanna",
    facts: [
      "Every year about 1.5 million wildebeest run together in the Great Migration!",
      "The Great Migration is the biggest animal journey on the entire planet Earth!",
      "Wildebeest run at speeds of up to 80 kilometres per hour!",
      "Baby wildebeest can run just 6 minutes after they are born!",
      "Wildebeest travel about 800 kilometres every year looking for fresh grass!",
      "About 1.5 million wildebeest live in the Serengeti!",
    ],
    topics: [
      "Wow look at all those animals running! Can you count how many?",
      "They all run together — why do you think animals travel in big groups?",
      "If you could run as fast as a wildebeest where would you run to?",
    ]
  },
  {
    name: "Zebra", emoji: "🦓",
    image: "/animals/zebra.png",
    description: "a zebra with beautiful black and white stripes standing in the dry golden African grasslands",
    facts: [
      "Every zebra has unique stripes — no two zebras look the same, just like fingerprints!",
      "Scientists still don't know if a zebra is white with black stripes or black with white stripes!",
      "Zebras can run up to 65 kilometres per hour to escape from lions!",
      "Baby zebras recognise their mummy just by looking at her stripes!",
      "A group of zebras is called a dazzle — their stripes confuse lions and make them dizzy!",
      "There are about 500,000 zebras living in Africa right now!",
    ],
    topics: [
      "Look at those black and white stripes! How many can you count?",
      "Do you think zebras are more like horses or donkeys?",
      "Why do you think zebras have black and white stripes?",
    ]
  },
];

function fmt(s) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function parseFact(text) {
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
  // Two separate subtitle states to avoid confusion
  const [tejendraSays, setTejendraSays] = useState("");
  const [childSays, setChildSays] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const [mood, setMood] = useState("happy");
  const [sessionFacts, setSessionFacts] = useState([]);

  const timerRef = useRef(null);
  const recogRef = useRef(null);
  const endedRef = useRef(false);
  const speakingRef = useRef(false);
  const historyRef = useRef([]);
  const animalRef = useRef(animal);
  const listeningRef = useRef(false);

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { animalRef.current = animal; }, [animal]);

  const showFact = useCallback((factText) => {
    setCurrentFact(factText);
    setSessionFacts(prev => prev.includes(factText) ? prev : [...prev, factText]);
  }, []);

  // ── MALE INDIAN VOICE ─────────────────────────────────────────────────
  const speak = useCallback((text, onDone) => {
    window.speechSynthesis.cancel();

    const doSpeak = () => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = 0.88;
      utter.pitch = 1.4;
      utter.volume = 1;

      const voices = window.speechSynthesis.getVoices();

      // Try Indian English male voices first, then any male English voice
      const voice =
        voices.find(v => v.lang === "en-IN" && v.name.toLowerCase().includes("male")) ||
        voices.find(v => v.lang === "en-IN") ||
        voices.find(v => v.name === "Google UK English Male") ||
        voices.find(v => v.name.includes("Microsoft David")) ||
        voices.find(v => v.name.includes("David") && v.lang.startsWith("en")) ||
        voices.find(v => v.name.includes("Daniel") && v.lang.startsWith("en")) ||
        voices.find(v => v.name.includes("Rishi")) ||
        voices.find(v => v.name.includes("Mohan")) ||
        voices.find(v => v.name.toLowerCase().includes("male") && v.lang.startsWith("en")) ||
        voices.find(v => v.lang.startsWith("en"));

      if (voice) utter.voice = voice;

      utter.onstart = () => { setSpeaking(true); speakingRef.current = true; setMood("excited"); };
      utter.onend = () => {
        setSpeaking(false); speakingRef.current = false; setMood("happy");
        if (onDone) onDone();
      };
      utter.onerror = () => {
        setSpeaking(false); speakingRef.current = false;
        if (onDone) onDone();
      };
      window.speechSynthesis.speak(utter);
    };

    if (window.speechSynthesis.getVoices().length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => { doSpeak(); };
    }
  }, []);

  const askAI = useCallback(async (userMsg) => {
    const a = animalRef.current;
    const systemPrompt = `You are Tejendra, an excited funny 10-year-old Indian boy who LOVES animals, talking to a younger child aged 4-7.
You are both looking at a picture of: ${a.description}.
The animal is: ${a.name} ${a.emoji}

YOUR STYLE:
- Talk like an excited kid, NOT an adult or teacher
- Use simple words a 5 year old understands
- Very enthusiastic: "Wow!", "Oh my god!", "No way!", "That is SO cool!", "Did you know!"
- Max 2 short sentences per response
- Only ONE question at the end, never two questions
- NEVER say "great answer" or "wonderful" like a teacher

HANDLING SHORT REPLIES:
- If child says "yes", "yeah", "ok", "hmm", "no", "good", "nice", "wow", "cool" — just say "Cool!" or "Wow!" and share next fun fact naturally
- NEVER ask them to speak more or explain
- Just keep the conversation flowing naturally like a real kid

CONVERSATION FLOW:
1. Point out the animal and ask if they can see it
2. Ask if they'd like to BE that animal
3. Share a funny cool fact
4. Compare to something they know (humans, toys, houses)
5. Share a wow number fact
6. Ask a fun imagination question
7. Share another surprising fact

FORMAT for facts: [FACT:short fact under 15 words]
Example: "Oh my god giraffes are SO tall! [FACT:One giraffe equals 6 humans stacked on top!] If you were that tall what would you grab?"

Facts about ${a.name}:
${a.facts.join("\n")}

Topics:
${a.topics.join("\n")}`;

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
      body: JSON.stringify({ model: MODEL, messages, max_tokens: 150, temperature: 1.0 }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || "API error"); }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || "Wow that is so cool! What do you think?";
  }, []);

  const startListening = useCallback(() => {
    if (endedRef.current || speakingRef.current || listeningRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Please use Google Chrome for voice!"); return; }

    const r = new SR();
    recogRef.current = r;
    r.lang = "en-IN"; // Indian English — better for Indian accent
    r.continuous = false;
    r.interimResults = false; // Only fire ONCE when done speaking — no jumping
    r.maxAlternatives = 1;

    r.onstart = () => { setListening(true); listeningRef.current = true; setMood("thinking"); };

    r.onend = () => {
      setListening(false);
      listeningRef.current = false;
      // Restart only if not ended and not speaking
      if (!endedRef.current && !speakingRef.current) {
        setTimeout(() => startListening(), 800);
      }
    };

    r.onresult = async (e) => {
      if (endedRef.current) return;
      const transcript = e.results[0][0].transcript.trim();
      if (!transcript) return;

      setChildSays(transcript); // Show child's words in subtitle
      listeningRef.current = false;

      try {
        const newHistory = [...historyRef.current, { role: "user", parts: [{ text: transcript }] }];
        const reply = await askAI(transcript);
        const { clean, fact } = parseFact(reply);
        if (fact) showFact(fact);
        setTejendraSays(clean); // Show Tejendra's words separately
        setChildSays(""); // Clear child subtitle when Tejendra speaks
        const updated = [...newHistory, { role: "model", parts: [{ text: clean }] }];
        setHistory(updated); historyRef.current = updated;
        speak(clean, () => {
          if (!endedRef.current) setTimeout(() => startListening(), 400);
        });
      } catch (err) { setError(err.message); }
    };

    r.onerror = (e) => {
      setListening(false);
      listeningRef.current = false;
      if (e.error !== "aborted" && !endedRef.current && !speakingRef.current) {
        setTimeout(() => startListening(), 800);
      }
    };

    try { r.start(); } catch (e) {}
  }, [askAI, speak, showFact]);

  const endSession = useCallback(() => {
    endedRef.current = true;
    clearInterval(timerRef.current);
    window.speechSynthesis.cancel();
    listeningRef.current = false;
    try { recogRef.current?.abort(); } catch (e) {}
    setPhase("ended"); setSpeaking(false); setListening(false);
  }, []);

  const startSession = useCallback(async () => {
    setError(""); endedRef.current = false;
    setHistory([]); historyRef.current = [];
    setPhase("active"); setTimeLeft(DURATION);
    setCurrentFact(null);
    setTejendraSays(""); setChildSays("");
    setSessionFacts([]);

    timerRef.current = setInterval(() => {
      setTimeLeft(t => { if (t <= 1) { endSession(); return 0; } return t - 1; });
    }, 1000);

    try {
      const a = animalRef.current;
      const opening = await askAI(`Start! Say hello super excitedly, mention the ${a.name} in the picture, share one wow fact using [FACT:...], and ask ONE simple fun question.`);
      const { clean, fact } = parseFact(opening);
      if (fact) showFact(fact);
      setTejendraSays(clean);
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
    setCurrentFact(null);
    setTejendraSays(""); setChildSays("");
    setError(""); setHistory([]); historyRef.current = [];
    setSessionFacts([]); setMood("happy");
    listeningRef.current = false;
  };

  useEffect(() => {
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      clearInterval(timerRef.current);
      window.speechSynthesis.cancel();
      listeningRef.current = false;
      try { recogRef.current?.abort(); } catch (e) {}
    };
  }, []);

  const pct = (timeLeft / DURATION) * 100;
  const timerColor = timeLeft > 30 ? "#4ade80" : timeLeft > 10 ? "#fbbf24" : "#f87171";
  const moodEmoji = mood === "excited" ? "🤩" : mood === "thinking" ? "🎧" : "😄";

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
        {/* Tejendra avatar */}
        <div className={`zara-wrap ${speaking ? "is-speaking" : ""} ${listening ? "is-listening" : ""}`}>
          <div className="zara-face">{moodEmoji}</div>
          <span className="zara-name">Tejendra</span>
          {speaking && (
            <div className="sound-waves">
              {[...Array(5)].map((_, i) => <span key={i} className="wave" style={{ animationDelay: `${i * 0.12}s` }} />)}
            </div>
          )}
        </div>

        {/* Animal image — fixed height */}
        <div className="scene-wrap">
          <div className="scene-label">{animal.emoji} {animal.name}</div>
          <img src={animal.image} alt={animal.name} className="scene-img" />
        </div>

        {/* Tejendra subtitle — always visible, fixed height */}
        <div className="subtitle-box sub-tejendra">
          <span className="sub-icon">😄</span>
          <span className="sub-text">
            {tejendraSays || `Press Start and chat with Tejendra about the ${animal.name}!`}
          </span>
        </div>

        {/* Child subtitle — only shows when child is speaking */}
        {childSays ? (
          <div className="subtitle-box sub-user">
            <span className="sub-icon">🧒</span>
            <span className="sub-text">{childSays}</span>
          </div>
        ) : (
          /* Empty placeholder to prevent layout jump */
          <div className="subtitle-placeholder" />
        )}

        {/* Fact strip — always reserves space to prevent jumping */}
        <div className={`fact-strip ${currentFact ? "fact-visible" : "fact-hidden"}`}>
          <span className="fact-emoji">{animal.emoji}</span>
          <span className="fact-strip-text">✨ {currentFact || "..."}</span>
        </div>

        {/* End screen facts */}
        {phase === "ended" && sessionFacts.length > 0 && (
          <div className="facts-summary">
            <p className="facts-title">🌟 What you learned about {animal.name}s today!</p>
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
            <div className="hint-chip">{animal.emoji} {animal.name}</div>
            <div className="hint-chip">⏱️ 60 seconds</div>
            <div className="hint-chip">🌟 Fun facts!</div>
          </div>
        )}
      </main>
    </div>
  );
}



import { useState, useEffect, useRef, useCallback } from "react";

const DURATION = 60;
const API_KEY = import.meta.env.VITE_GROQ_KEY;
const MODEL = "llama-3.3-70b-versatile";

// ── Your exact uploaded images served from /public/animals/ ───────────────
const ANIMALS = [
  {
    name: "Giraffe",
    emoji: "🦒",
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
      "Can you see the giraffes in the image? How many can you count?",
      "Would you like to be a giraffe for a day?",
      "Look how tall they are! Can you stretch your arms up as high as you can?",
      "What do you think giraffes eat way up there at the top of trees?",
      "If you were as tall as a giraffe, what would you look at first from up there?",
    ]
  },
  {
    name: "Elephant",
    emoji: "🐘",
    image: "/animals/elephant.png",
    description: "a mother elephant and baby elephant walking together in tall green African grass",
    facts: [
      "Elephants are the largest land animals on Earth — bigger than any other animal that walks!",
      "An elephant's brain weighs 11 pounds — it's the biggest brain of any land animal!",
      "Elephants never forget! They remember friends and family for their whole lives.",
      "Baby elephants are called calves and they weigh about 200 pounds at birth!",
      "Elephants use their trunks like we use our hands — to grab, smell, and even hug!",
      "An elephant drinks about 50 gallons of water every single day!",
      "There are about 415,000 elephants living in Africa right now.",
    ],
    topics: [
      "Can you see the baby elephant and the mummy elephant?",
      "Look how big their ears are! Do you know why elephants have such big ears?",
      "Would you like to ride on an elephant one day?",
      "Can you make a trumpet sound like an elephant?",
      "How do you think the baby elephant feels walking with its mummy?",
    ]
  },
  {
    name: "Lion",
    emoji: "🦁",
    image: "/animals/lion.png",
    description: "a majestic male lion with a big golden mane standing proudly in tall golden African grass",
    facts: [
      "Lions are called the King of the Jungle and they are the second biggest wild cat on Earth!",
      "A lion's roar is so loud you can hear it from 8 kilometres away — that's very far!",
      "Lions sleep for up to 20 hours a day — they love to rest more than anything!",
      "A group of lions is called a pride — they live together like a big family!",
      "The male lion has that big fluffy mane to make him look strong and scary to other lions!",
      "Lions are the only cats that live together in groups — all other cats live alone!",
      "There are only about 20,000 lions left in the wild — that's not very many!",
    ],
    topics: [
      "Wow look at that lion! Can you see his big fluffy mane?",
      "Can you roar like a lion? Let me hear your best lion roar!",
      "Do you think the lion is friendly or scary?",
      "Would you be brave enough to stand near a lion?",
      "What do you think a lion eats for breakfast?",
    ]
  },
  {
    name: "Wildebeest",
    emoji: "🐃",
    image: "/animals/wildebeest.png",
    description: "a huge herd of wildebeest running together across the African savanna during the great migration",
    facts: [
      "Every year, about 1.5 million wildebeest run together in what's called the Great Migration!",
      "The Great Migration is the biggest animal journey on the entire planet Earth!",
      "Wildebeest run at speeds of up to 80 kilometres per hour — that's super fast!",
      "Baby wildebeest can run just 6 minutes after they are born — amazing right?",
      "Wildebeest travel about 800 kilometres every year looking for fresh green grass!",
      "Wildebeest look a bit like a mix between a cow, a horse, and a buffalo!",
      "About 1.5 million wildebeest live in the Serengeti — that's a huge number!",
    ],
    topics: [
      "Wow look at all those animals running! Can you count how many you can see?",
      "They are all running together! Why do you think animals travel in big groups?",
      "Have you ever seen so many animals in one place?",
      "If you could run as fast as a wildebeest, where would you run to?",
      "Can you make the sound of all those animals running with your feet?",
    ]
  },
  {
    name: "Zebra",
    emoji: "🦓",
    image: "/animals/zebra.png",
    description: "a zebra with beautiful black and white stripes standing in the dry golden African grasslands",
    facts: [
      "Every single zebra has completely unique stripes — just like your fingerprints, no two are the same!",
      "Scientists are still not 100 percent sure if a zebra is white with black stripes or black with white stripes!",
      "Zebras can run up to 65 kilometres per hour to escape from lions and cheetahs!",
      "Baby zebras can recognise their mummy just by looking at her stripes — like a name tag!",
      "Zebras sleep standing up just like horses — they rarely lie down!",
      "A group of zebras is called a dazzle — because their stripes confuse lions and make them dizzy!",
      "There are about 500,000 zebras living in Africa right now!",
    ],
    topics: [
      "Look at those amazing black and white stripes! How many stripes can you count?",
      "Do you think zebras are more like horses or more like donkeys?",
      "If you could have any animal's pattern on your clothes, would you pick zebra stripes?",
      "Why do you think zebras have black and white stripes?",
      "Can you draw a zebra stripe pattern in the air with your finger?",
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
  const [subtitle, setSubtitle] = useState("");
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

  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { animalRef.current = animal; }, [animal]);

  const showFact = useCallback((factText) => {
    setCurrentFact(factText);
    setSessionFacts(prev => prev.includes(factText) ? prev : [...prev, factText]);
  }, []);

  // ── Male childish voice ───────────────────────────────────────────────
  const speak = useCallback((text, onDone) => {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.88;
    utter.pitch = 1.4;  // higher pitch = more childish/fun
    utter.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    // Try to find a male voice
    const maleVoice =
      voices.find(v => v.name.includes("Google UK English Male")) ||
      voices.find(v => v.name.includes("Microsoft David")) ||
      voices.find(v => v.name.includes("Daniel") && v.lang.startsWith("en")) ||
      voices.find(v => v.name.toLowerCase().includes("male") && v.lang.startsWith("en")) ||
      voices.find(v => v.lang === "en-US") ||
      voices[0];
    if (maleVoice) utter.voice = maleVoice;

    utter.onstart = () => { setSpeaking(true); speakingRef.current = true; setMood("excited"); };
    utter.onend = () => { setSpeaking(false); speakingRef.current = false; setMood("happy"); if (onDone) onDone(); };
    utter.onerror = () => { setSpeaking(false); speakingRef.current = false; if (onDone) onDone(); };
    window.speechSynthesis.speak(utter);
  }, []);

  const askAI = useCallback(async (userMsg) => {
    const a = animalRef.current;
    const systemPrompt = `You are Tejendra, an excited and funny 10-year-old boy who LOVES animals and is talking to a younger child aged 4-7.
You are both looking at a picture of: ${a.description}.

YOUR PERSONALITY:
- You talk like an excited kid, not an adult or teacher
- Use simple words a 5 year old understands
- Be VERY enthusiastic with lots of "Wow!", "Oh my god!", "Did you know!", "That is SO cool!", "No way!"
- Ask simple fun questions one at a time
- NEVER ask multiple questions at once — only ONE question per response
- Keep each response to 2-3 short sentences maximum

HANDLING SHORT REPLIES:
- If child says "yes", "yeah", "ok", "hmm", "no", "good", "nice" — that is TOTALLY FINE
- Just say something like "Cool! Did you know..." and share a new fun fact
- NEVER ask them to say more or explain more
- Just keep the conversation flowing naturally

CONVERSATION STYLE (follow this pattern):
1. First ask if they can see the animal
2. Ask if they would like to BE that animal
3. Comment on something funny/cool about the animal
4. Share a wow fact
5. Compare it to something the child knows (like humans, toys, houses)
6. Share another crazy fact with a big number
7. Ask a fun imagination question

USE THIS FORMAT when sharing a fact: [FACT:write the short fact here under 15 words]

Example good response: "Oh wow did you know a giraffe is taller than 6 humans?! [FACT:One giraffe equals 6 humans stacked on top of each other!] If you were that tall, what would you grab from the top shelf?"

Animals facts to use for ${a.name}:
${a.facts.join("\n")}

Topics to cover:
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
    return data.choices?.[0]?.message?.content || "Wow that is so cool! What do you think about this animal?";
  }, []);

  const startListening = useCallback(() => {
    if (endedRef.current || speakingRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Please use Google Chrome for voice!"); return; }

    const r = new SR();
    recogRef.current = r;
    r.lang = "en-US";
    r.continuous = false;
    r.interimResults = true;
    // Lower confidence threshold to catch short words
    r.maxAlternatives = 3;

    r.onstart = () => { setListening(true); setMood("thinking"); };
    r.onend = () => {
      setListening(false);
      // If speech ended but we got no result and not ended, restart
      if (!endedRef.current && !speakingRef.current) {
        setTimeout(() => startListening(), 800);
      }
    };

    r.onresult = async (e) => {
      // Get the best transcript including short words
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join("")
        .trim();

      setSubtitle("You: " + transcript);

      if (e.results[e.results.length - 1].isFinal) {
        r.stop();
        if (endedRef.current) return;
        // Accept ALL transcripts — even single words
        if (!transcript) return;
        try {
          const newHistory = [...historyRef.current, { role: "user", parts: [{ text: transcript }] }];
          const reply = await askAI(transcript);
          const { clean, fact } = parseFact(reply);
          if (fact) showFact(fact);
          setSubtitle("Tejendra: " + clean);
          const updated = [...newHistory, { role: "model", parts: [{ text: clean }] }];
          setHistory(updated); historyRef.current = updated;
          speak(clean, () => { if (!endedRef.current) setTimeout(() => startListening(), 300); });
        } catch (err) { setError(err.message); }
      }
    };

    r.onerror = (e) => {
      setListening(false);
      if (e.error === "no-speech" && !endedRef.current && !speakingRef.current) {
        // Restart on silence — keep listening!
        setTimeout(() => startListening(), 500);
      } else if (e.error !== "aborted" && !endedRef.current && !speakingRef.current) {
        setTimeout(() => startListening(), 800);
      }
    };

    try { r.start(); } catch (e) { /* already started */ }
  }, [askAI, speak, showFact]);

  const endSession = useCallback(() => {
    endedRef.current = true;
    clearInterval(timerRef.current);
    window.speechSynthesis.cancel();
    try { recogRef.current?.stop(); } catch (e) {}
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
      const a = animalRef.current;
      const opening = await askAI(`Start the conversation! Say hello to the child in a super excited way, point out the ${a.name} in the picture, share one wow fact using [FACT:...], and ask ONE simple fun question.`);
      const { clean, fact } = parseFact(opening);
      if (fact) showFact(fact);
      setSubtitle("Tejendra: " + clean);
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
    setMood("happy");
  };

  useEffect(() => {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    return () => {
      clearInterval(timerRef.current);
      window.speechSynthesis.cancel();
      try { recogRef.current?.stop(); } catch (e) {}
    };
  }, []);

  const pct = (timeLeft / DURATION) * 100;
  const timerColor = timeLeft > 30 ? "#4ade80" : timeLeft > 10 ? "#fbbf24" : "#f87171";
  const moodEmoji = mood === "excited" ? "🤩" : mood === "thinking" ? "🎧" : "😄";

  return (
    <div className="app">
      <div className="bg-glow bg-1" />
      <div className="bg-glow bg-2" />

      {/* Header */}
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

        {/* Animal image */}
        <div className="scene-wrap">
          <div className="scene-label">{animal.emoji} {animal.name}</div>
          <img src={animal.image} alt={animal.name} className="scene-img" />
        </div>

        {/* Subtitle below image */}
        <div className={`subtitle-box ${subtitle.startsWith("You:") ? "sub-user" : subtitle ? "sub-tejendra" : "sub-idle"}`}>
          <span className="sub-icon">{subtitle.startsWith("You:") ? "🧒" : "😄"}</span>
          <span className="sub-text">{subtitle || `Press Start and chat with Tejendra about the ${animal.name}!`}</span>
        </div>

        {/* Fact card — small rectangle, NO popup on image */}
        {currentFact && (
          <div className="fact-card">
            <img src={animal.image} alt={animal.name} className="fact-thumb" />
            <div className="fact-content">
              <span className="fact-label">{animal.emoji} {animal.name} Fact</span>
              <span className="fact-text">✨ {currentFact}</span>
            </div>
          </div>
        )}

        {/* End screen — show all facts */}
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

        {/* Buttons */}
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



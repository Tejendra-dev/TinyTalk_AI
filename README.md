# 🦁 Safari Talk — Real-Time AI Conversation for Kids

> **A real-time voice AI app where children have a 1-minute conversation with Tejendra, a friendly AI safari guide, based on wildlife images.**

🌐 **Live Demo:** [tiny-talk-ai.vercel.app](https://tiny-talk-ai.vercel.app)

---

## 📸 Preview

| Idle Screen | Active Conversation | End Screen |
|---|---|---|
| Animal shown, ready to start | Tejendra talking with timer | Facts learned summary |

---

## 🎯 Project Overview

Safari Talk is a **real-time AI voice interface** built for young children (ages 4–8). The app displays an engaging African safari animal image, and an AI companion named **Tejendra** initiates and sustains a **60-second voice conversation** with the child about that animal — asking fun questions, sharing wow facts, and keeping the child engaged throughout.

---

## ✅ Requirements Coverage

| Requirement | Implementation |
|---|---|
| **Image on screen** | 5 real African safari animal photos (Giraffe, Elephant, Lion, Zebra, Wildebeest) |
| **AI initiates conversation** | Tejendra speaks first automatically on session start |
| **1-minute voice conversation** | Animated countdown timer, auto-ends at 0 |
| **Tool call → UI action** | AI embeds `[FACT:...]` commands → triggers animated fact strip on screen |
| **React UI** | 100% React 18 + Vite |
| **Child-friendly** | Simple language, excited tone, short replies accepted |

---

## 🚀 Features

- 🎙️ **Real-time voice** — Browser Web Speech API for mic input, Speech Synthesis for AI voice output
- 🦁 **5 random animals** — Different animal every session (Giraffe, Elephant, Lion, Zebra, Wildebeest)
- ⏱️ **60-second timer** — Animated countdown ring in the header
- 🌟 **Live fact strip** — When Tejendra mentions a fact, it appears as a highlighted card below the conversation
- 📋 **Session summary** — After the session ends, all facts learned are displayed on screen
- 🔄 **Next Animal button** — Each new session shows a different animal
- 💬 **Short reply friendly** — Child can say "yes", "ok", "yeah" and Tejendra naturally continues
- 📱 **Mobile responsive** — Works on phone and desktop

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite |
| **AI Brain** | Groq API — `llama-3.3-70b-versatile` (free, ultra-fast) |
| **Voice Input** | Web Speech API — `SpeechRecognition` (browser built-in, free) |
| **Voice Output** | Web Speech Synthesis API (browser built-in, free) |
| **Deployment** | Vercel (auto-deploy from GitHub) |

---

## 🏛️ Architecture

```
Browser (React + Vite)
    │
    ├── SpeechRecognition API  ←── Child's voice (mic)
    │         │
    │         ▼
    ├── Groq API (llama-3.3-70b)  ←── AI response generation
    │         │
    │         ▼
    ├── SpeechSynthesis API  ←── Tejendra speaks back
    │
    └── Tool Call System
              └── [FACT:...] in AI response → Fact strip UI update
```

**No backend required.** Everything runs directly in the browser. The Groq API is called client-side using an environment variable.

---

## 📁 Project Structure

```
safari-talk/
├── public/
│   └── animals/
│       ├── giraffe.png
│       ├── elephant.png
│       ├── lion.png
│       ├── zebra.png
│       └── wildebeest.png
├── src/
│   ├── App.jsx        # Main component — all logic
│   ├── App.css        # All styles + animations
│   └── main.jsx       # React entry point
├── index.html
├── package.json
└── vite.config.js
```

---

## ⚙️ Setup & Run Locally

### Prerequisites
- Node.js 18+
- A free **Groq API key** from [console.groq.com](https://console.groq.com)
- Google Chrome (for Web Speech API)

### Steps

**1. Clone the repo**
```bash
git clone https://github.com/Tejendra-dev/TinyTalk_AI.git
cd TinyTalk_AI/safari-talk
```

**2. Install dependencies**
```bash
npm install
```

**3. Add your Groq API key**

Create a `.env` file in the `safari-talk` folder:
```
VITE_GROQ_KEY=your_groq_api_key_here
```

**4. Start the app**
```bash
npm run dev
```

**5. Open in Chrome**
```
http://localhost:5173
```

> ⚠️ Must use **Google Chrome** — the Web Speech API only works in Chrome.

---

## 🌐 Deploy on Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project
3. Set **Root Directory** to `safari-talk`
4. Add environment variable: `VITE_GROQ_KEY` = your Groq key
5. Deploy!

---

## 🎭 Conversation Flow

```
1. Child opens app → sees random animal image
2. Presses "Start Safari Adventure!"
3. Tejendra greets the child and asks about the animal
4. Child speaks → mic picks up voice
5. Groq AI generates child-friendly response
6. If AI mentions a fact → [FACT:...] → fact strip appears on screen  ← TOOL CALL
7. Tejendra speaks the response via browser TTS
8. Mic automatically re-activates for child's reply
9. Loop continues for 60 seconds
10. Timer ends → session summary shows all facts learned
11. Child clicks "Next Animal!" → different animal loads
```

---

## 🔒 Privacy

- Groq API key stored as Vercel environment variable — never exposed in code
- No user data stored anywhere
- All audio processed locally in the browser via Web Speech API

---

## 👨‍💻 Built By

**Tejendra Ayyappa Reddy Syamala**

*Assignment submission for Real-Time AI Conversation interface*

---

## 📄 License

MIT License — free to use and modify.

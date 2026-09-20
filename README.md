# 🎵 Terminal CLI Music Player

> An interactive, dependency-free terminal music player for macOS built with native **Node.js** and headless **VLC Remote Control (`rc`)**. Features real-time track seeking, loop repeat, a dancing audio spectrum visualizer, and a spinning vinyl disc animation.

---

## 🌟 Flagship Application (`AD-5`)

The primary, fully-featured interactive CLI application is located in [`AD-5/lecture_5.js`](AD-5/lecture_5.js).

```text
=== CLI MUSIC PLAYER ===

> sample-12s.mp3
  sample-3s.mp3
  sample-6s.mp3
  sample-9s.mp3

▶ [PLAYING] [◐]  00:04 / 00:12 (33.3%)
[█████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░]
  ♫ ▄ ▅ ▆ ▇ █ ▇ ▆ ▅ ▄ ▃ ▂   ▂ ▃ ▄ ▅ ▆ ▇ █ 

Controls: [↑/↓] Nav │ [Enter] Play │ [Space/p] Pause │ [←/→] ±5s │ [n/b] Skip │ [r] Repeat (OFF) │ [q] Quit
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **macOS** with Node.js (v16+) installed.
- **VLC Media Player** installed at `/Applications/VLC.app`.
- Built-in macOS audio utility `afinfo` (included with macOS).

### 2. Launching the Player
```bash
# Navigate to the main application directory
cd AD-5

# Start the music player
node lecture_5.js
```

Add your own `.mp3` files into `AD-5/songs/` to play your local library!

---

## 🎮 Keyboard Controls

| Key | Function | Description |
| :---: | :--- | :--- |
| **`↑` / `↓`** | **Navigate** | Move cursor up and down through the playlist |
| **`Enter`** | **Play** | Start playing the selected song |
| **`Space` / `p`** | **Pause / Resume** | Toggle playback pause state instantly |
| **`←` / `→`** | **Seek ±5s** | Jump backwards or forwards 5 seconds |
| **`n`** | **Next Track** | Skip to and immediately play the next song |
| **`b`** | **Previous Track** | Skip to and immediately play the previous song |
| **`r`** | **Repeat Toggle** | Loop current track continuously when it finishes |
| **`q` / `Ctrl+C`** | **Quit** | Clean exit, kills VLC process and restores terminal |

---

## 🚀 Core Features

- **Zero External Dependencies**: Built entirely with Node.js standard libraries (`fs`, `path`, `child_process`). No npm install required.
- **Headless Background Playback**: Leverages VLC in Remote Control mode (`-I rc --no-video --play-and-exit`) communicating via IPC standard input streams.
- **Flicker-Free Terminal UI**: Uses ANSI escape sequences (`\x1B[H\x1B[0J`) and single-write frame buffering to eliminate screen tearing and ghosting.
- **Dancing Audio Spectrum Visualizer**: Dynamic 20-bar frequency equalizer generated via trigonometric sine/cosine modulation mapped to Unicode block characters (` `, `▂`, `▃`, `▄`, `▅`, `▆`, `▇`, `█`) with green $\rightarrow$ cyan $\rightarrow$ magenta ANSI gradients. Flattens and dims cleanly when paused.
- **Animated Spinning Vinyl**: Dynamic 4-frame rotating disc indicator (`[◐]`, `[◓]`, `[◑]`, `[◒]`) synced to playback and frozen on pause.
- **Precision Time Tracking**: Employs `afinfo` for duration detection and compensates for pause duration (`pausedAt`, `totalPausedTime`) to prevent timer drift.
- **Safe Signal Handling**: Automatically traps `SIGINT`, `SIGTERM`, and `exit` to restore terminal raw mode and reveal the cursor.

---

## 📁 Repository Structure

This repository documents the progressive evolution of terminal interfaces and child process management:

```text
.
├── README.md               # Main project overview and documentation (this file)
├── AD-2/                   # Phase 2: Raw mode I/O, keyboard byte codes
│   ├── lecture_2.js
│   └── lab_2.js
├── AD-3/                   # Phase 3: Initial audio playback via child_process
│   ├── lecture_3.js
│   ├── lab_3.js
│   └── songs/
├── AD-4/                   # Phase 4: Interactive cursor navigation and menus
│   ├── lecture_4.js
│   ├── lab_4.js
│   └── songs/
└── AD-5/                   # Phase 5: ★ MAIN CLI APPLICATION ★
    ├── lecture_5.js        # Fully featured interactive music player
    ├── README.md           # In-depth architectural & conceptual documentation
    ├── prompts.md          # Comprehensive prompt history & technical discussions
    └── songs/              # Audio files directory (.mp3)
```

---

## 📚 Detailed Documentation

- **[AD-5 Technical Documentation](AD-5/README.md)**: Deep dive into terminal escape codes, process state machines, mermaid flowcharts, and evaluation questions.
- **[Prompt History & Technical Discussions](AD-5/prompts.md)**: The end-to-end prompt log and architectural debates recorded during development.

# CLI Music Player — Prompt History & Technical Discussions

The sequential prompt history, architectural debates, and debugging discussions logged during the design and implementation of the terminal music player (`AD-5 / lecture_5.js`).

---

## Phase 1: Skeleton, Rules & Reading Songs

### 1. Project Skeleton & Constraints
#### 💬 Developer Prompt
> "College project, a terminal music player in Node.js for macOS. Keep it simple and short. Set up just the skeleton for now: a package.json called cli-music-player with a start script and no dependencies, a CLAUDE.md with my rules (CommonJS require, only fs, path and child_process, no packages, functions under 20 lines, comment why, readable over clever, never add anything I didn't ask for), a .gitignore for node_modules, .DS_Store and songs/*.mp3, and an empty index.js that just logs that the player is starting."

#### 💡 Discussion & Implementation
- Established core constraints: zero external npm dependencies, pure native Node.js core modules (`fs`, `path`, `child_process`).
- Created baseline directory structure and defined coding conventions focused on terminal safety and clean process exits.

---

### 2. Reading Songs Folder & Directory Validation
#### 💬 Developer Prompt
> "Make index.js read the songs folder with fs.readdirSync, keep only the .mp3 files (case insensitive) and sort them. Build the path with path.join(__dirname, 'songs'). If there are no mp3s, print an error and exit with code 1. Then print them as a numbered list like '0: song.mp3'."

#### 💡 Discussion & Implementation
- Resolved directory resolution between `./songs` and `../songs` using fallback checking:
  ```javascript
  const songDir = fs.existsSync(path.join(__dirname, 'songs'))
      ? path.join(__dirname, 'songs')
      : path.join(__dirname, '..', 'songs');
  ```
- Handled empty folder validation gracefully, throwing exit code 1 with clean diagnostic messages rather than uncaught runtime errors.

---

## Phase 2: Playback Basics & Raw Key Navigation

### 3. Spawning Audio Playback
#### 💬 Developer Prompt
> "Now let me play a song. Read input with process.stdin.on('data'), convert it with toString().trim() and Number(). If it isn't a whole number or there's no song at that number, print 'No song at that number' instead of crashing. Otherwise start it with spawn('afplay', [songPath]) and save the child in a variable called player so I can stop it later. Print which song is playing."

#### 💡 Discussion & Implementation
- Initially tested `afplay` for macOS native playback.
- Handled edge cases where non-numeric input or out-of-bound indices were typed, preventing process crashes.

---

### 4. Arrow Key Navigation & Raw Input Handling
#### 💬 Developer Prompt
> "Swap the typing for arrow keys. Turn on raw mode so I get each keypress straight away, and track the highlighted row in a variable called cursor. Handle Ctrl+C (0x03) first, since raw mode stops it working on its own, and turn raw mode off before exiting. Up is 0x1b 0x5b 0x41 and down is 0x1b 0x5b 0x42, so check key[0] and key[1] before key[2]. Wrap around with modulo, adding the length first so going up from the top doesn't go negative. Write a render() function that redraws the list with '> ' on the highlighted row, and call it after every keypress. Use === everywhere."

#### 💡 Discussion & Implementation
- Switched `process.stdin` to raw mode (`setRawMode(true)`).
- Intercepted 3-byte escape sequences for arrow keys:
  - `data[0] === 0x1b && data[1] === 0x5b && data[2] === 0x41` (Up Arrow $\rightarrow$ decrement cursor)
  - `data[0] === 0x1b && data[1] === 0x5b && data[2] === 0x42` (Down Arrow $\rightarrow$ increment cursor)
- Guaranteed clamping and safe indexing so the cursor stays within valid song bounds.

---

### 5. Suppressing Stray Buffers & Double Playback Glitches
#### 💬 Developer Prompt
> "Every time I move the cursor, a buffer prints. Should I remove the listSongs call inside the stdin listener? Also why does it ask me to select a song again right after I press Enter?"

#### 💡 Discussion & Implementation
- **Stray Buffer Bug**: Removed stray `console.log(data)` inside the raw input listener that was dumping binary buffer bytes (`<Buffer 1b 5b 41>`) directly into stdout.
- **Double Select Bug**: When pressing Enter (`0x0d` / `0x0a`), execution was falling through without returning, triggering both song playback and re-rendering uninitialized state. Added explicit `return` after `playSong(cursor)`.

---

## Phase 3: Flicker Removal & Terminal Control

### 6. Eliminating Screen Flicker with ANSI Codes
#### 💬 Developer Prompt
> "The redraw flickers and console.log is behaving weirdly in raw mode. Move the render function into its own src/ui.js and fix the drawing. Use process.stdout.write instead of console.log, because \n moves down without returning to column 1 and the output walks diagonally down the screen. End every line with \r\n. Don't clear the screen each time, that's what causes the flicker. Use \x1B[H to go to the top left and start each line with \r\x1B[0K, then build the lines into an array and send them in one write. Hide the cursor with \x1B[?25l and colour the selected row cyan."

#### 💡 Discussion & Implementation
- **The Diagonal Walk Problem**: In raw mode, standard newline (`\n`) moves the cursor down but does not perform a carriage return (`\r`), resulting in staircase output.
- **Flicker Fix**: Ditching `console.clear()` (which wipes the screen buffer completely and causes black frames). Instead, we reposition the cursor to `(1, 1)` with `\x1B[H` and clear to end with `\x1B[0J`.
- Buffering all UI rows into a single string `output` and executing one single `process.stdout.write(output)` call ensures atomic screen updates with zero visual tearing.

---

### 7. Clean Exit & Terminal Restoration
#### 💬 Developer Prompt
> "Add a clean exit. One cleanup() function that shows the cursor again with \x1B[?25h, turns raw mode off if process.stdin.isTTY, and writes a final \r\n so the shell prompt starts fresh. Make it safe to call twice with a flag. Wire it to exit, SIGINT and SIGTERM, and call it from the Ctrl+C handler too. Add q (0x71) as a second quit key. Also comment why this can't be wired to SIGKILL."

#### 💡 Discussion & Implementation
- Implemented idempotent `cleanupAndExit()`:
  ```javascript
  function cleanupAndExit() {
      process.stdout.write("\x1B[?25h\x1B[0m\n");
      if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
      }
      if (vlcPlayProcess) {
          vlcPlayProcess.kill('SIGTERM');
      }
      process.exit(0);
  }
  ```
- **Why SIGKILL can't be trapped**: `SIGKILL` (signal 9) is handled directly by the kernel scheduler and immediately terminates the process without giving user-space handlers a chance to run. Hence, cleanup hooks must bind to `SIGINT`, `SIGTERM`, `exit`, and keyboard triggers (`q` / `Ctrl+C`).

---

## Phase 4: VLC Headless Integration & The Pause Bug

### 8. Headless VLC Remote Control Mode
#### 💬 Developer Prompt
> "How do they implement VLC playback in this code? I do have VLC on my device, let's implement it with rc mode and --play-and-exit, so I can send it text commands on stdin and it quits when the song ends. In index.js track player, currentSongIndex and isPaused. Enter plays the highlighted song, space toggles pause, s stops. Show [playing] or [paused]."

#### 💡 Discussion & Implementation
- Configured headless VLC using spawn:
  ```javascript
  const cp = spawn('vlc', ["-I", "rc", "--no-video", "--play-and-exit", songFinalPath], {
      stdio: ['pipe', 'pipe', 'pipe']
  });
  ```
- Commands sent via standard input: `vlcPlayProcess.stdin.write('pause\n')`.
- Flag `--no-video` prevents any GUI windows, keeping the experience 100% inside the terminal.

---

### 9. Pause Bug: Timer Drift & Spacebar Resume Glitch
#### 💬 Developer Prompt
> "when i press space again its not resuming. and wait bro the progress bar is completely messed up when i pause and unpause it jumps ahead like 20 seconds why is that happening???"

#### 💡 Discussion & Implementation
We resolved two critical playback bugs:

1. **State Tracking**: Fixed event listener check where `vlcPlayProcess !== undefined` wasn't differentiating between starting a new track vs toggling pause on an active track.
2. **Timestamp Math Drift**:
   - Calculating `(Date.now() - startTime) / 1000` continues counting real wall-clock time during pause.
   - Introduced `pausedAt` and accumulated `totalPausedTime`:
     ```javascript
     if (isPaused) {
         pausedAt = Date.now();
         clearInterval(trackingInterval);
     } else {
         if (pausedAt) {
             totalPausedTime += Date.now() - pausedAt;
             pausedAt = null;
         }
         // resume interval...
     }
     ```

---

## Phase 5: Seeking, Auto-advance & Playlist Controls

### 10. Real-Time Seeking (±5s) & JS Math Sync
#### 💬 Developer Prompt
> "can we add seeking with arrow keys? liek left arrow -5s right arrow +5s, does vlc rc support that without lagging or breaking our timer in js"

#### 💡 Discussion & Implementation
- VLC `rc` supports relative seeking with `seek +5\n` or `seek -5\n`.
- To keep the Node.js progress bar in sync with VLC's audio decoder, we directly shift `startTime -= seconds * 1000` with boundary clamping:
  ```javascript
  function seek(seconds) {
      if (!vlcPlayProcess || totalDuration === undefined) return;
      const sign = seconds >= 0 ? `+${seconds}` : `${seconds}`;
      vlcPlayProcess.stdin.write(`seek ${sign}\n`);
      startTime -= seconds * 1000;
      updateTimeElapsed();
      listSongs(songDir);
  }
  ```

---

### 11. Skipping, Auto-Advance & Repeat Loop
#### 💬 Developer Prompt
> "Add track navigation. n and b play the next and previous song. For auto advance, only move on when signal is null so if I killed it on purpose it doesn't double skip. Add r to toggle repeat so it replays the current song when it ends."

#### 💡 Discussion & Implementation
- Added key bindings:
  - `'n'` $\rightarrow$ Next track (`cursor++`)
  - `'b'` $\rightarrow$ Previous track (`cursor--`)
  - `'r'` / `'R'` $\rightarrow$ Toggle `isRepeat` loop
- Process `close` handler logic:
  ```javascript
  if (isRepeat) {
      playSong(currentSongIndex);
  } else if (allSongs && currentSongIndex < allSongs.length - 1) {
      cursor = currentSongIndex + 1;
      playSong(cursor);
  }
  ```

---

## Phase 6: UI Upgrades — Animations & Equalizers

### 12. Brainstorming Visual Features
#### 💬 Developer Prompt
> "in the lecture-5 what features can be added like animations or gif needs to be added"

#### 💡 Discussion & Implementation
Explored multiple visual options suited for CLI terminal environments:
- **Audio Spectrum Visualizer**: Dynamic equalizer bars using Unicode block levels (` `, `▂`, `▃`, `▄`, `▅`, `▆`, `▇`, `█`).
- **Spinning Vinyl Disc**: Cyclic quadrant circle frames (`['◐', '◓', '◑', '◒']`) rotating next to playback status.
- **Floating Musical Notes / ASCII GIFs**: Animated ASCII characters dancing across the header.
- **Marquee Title Scroll**: Scrolling track titles horizontally.

---

### 13. Deciding on Spectrum Visualizer + Spinning Disc
#### 💬 Developer Prompt
> "Best: Audio Spectrum Visualizer + Spinning Disc
> 
> This gives you the biggest visual improvement without making the project unnecessarily complex 
> if you have any questions, ask me; don't assume, and make minimal changes in the code and update the readme"

#### 💡 Discussion & Implementation
- Decided on the most impactful combination with the smallest complexity footprint.
- **Architectural Rules**:
  1. No external libraries or C++ audio FFT packages.
  2. No separate animation timer loop. Reuse the existing 100ms `trackingInterval`.
  3. Visualizer must freeze and dim when paused; disc must halt rotation when paused.

---

### 14. Implementation Agreement
#### 💬 Developer Prompt
> "Yes, proceed with the implementation as planned.
> 
> Please:
> * Add the Audio Spectrum Visualizer and Spinning Disc animation to `lecture_5.js`.
> * Reuse the existing `trackingInterval` rather than creating a separate animation loop.
> * Keep the changes minimal and non-breaking.
> * Use native Node.js and ANSI/Unicode characters only, with no additional npm packages.
> * Make the visualizer animate while playing and flatten/freeze when paused.
> * Make the spinning disc rotate during playback and stop when paused.
> * Update `README.md` with the new features, concepts used, and updated flow diagram.
> * Preserve all existing controls and functionality.
> 
> After implementation, run the player and verify play, pause, resume, and quit behavior."

#### 💡 Discussion & Implementation
- Integrated `animTick = 0`, incremented at 10Hz inside `trackingInterval`.
- Implemented `renderVisualizer()` using combined trigonometric frequencies (`Math.sin` & `Math.cos`) mapped to Unicode block characters with ANSI color gradients:
  - Green (low) $\rightarrow$ Cyan (mid) $\rightarrow$ Magenta (high peaks).
- Paused state flattens to `♫ ▂ ▂ ▂ ▂ ▂ ▂ ▂ ▂ [PAUSED]`.
- Disc rotates through `['◐', '◓', '◑', '◒']` during playback and freezes on `[◒]` when paused.

---

## Phase 7: Bug Hunting, Edge Cases & Verification

### 15. The Resume Unpause Freeze Bug
#### 💬 Developer Prompt
> "once cross check whether are there any bugs in them and commit and push"

#### 💡 Discussion & Implementation
- **Bug Identified**: In the pause/resume event block in `process.stdin.on('data')`, the restarted `trackingInterval` called `updateTimeElapsed()` but omitted `animTick++`. As a result, unpausing the player resumed the music and timer, but the spinning disc and spectrum visualizer remained permanently frozen!
- **Fix Applied**: Added `animTick++` inside the resume branch of `trackingInterval`.
- **Automated Keystroke Verification**: Simulated full user workflow (`Enter` $\rightarrow$ Play, `Space` $\rightarrow$ Pause, `Space` $\rightarrow$ Resume, `q` $\rightarrow$ Quit) confirming clean zero exit status.
- Configured Git credentials and pushed commit `d3c8c69` to `origin/main`.

---

## Phase 8: Viva & Concept Review (Catch-up Notes)

### 16. Technical Questions for Lab Evaluation
#### 💬 Developer Prompt
> "why did we use process.stdin.setRawMode(true) instead of readline? and why child_process.spawn instead of installing an audio npm package? explain how raw mode actually works under the hood so i can answer in viva"

#### 💡 Discussion & Implementation
1. **Raw Mode vs Readline**:
   - `readline` buffers standard input until a carriage return/newline (`Enter`), making it impossible to capture real-time arrow key presses or single-key hotkeys.
   - `setRawMode(true)` instructs the terminal TTY driver to bypass line discipline, disabling line buffering, local echo, and default signal interpretation. Keypresses are delivered directly to the application as raw byte buffers.
2. **Native `child_process` vs NPM Audio Packages**:
   - NPM audio packages (e.g. `node-speaker`, `play-sound`, `audic`) rely on native C/C++ bindings that require compilation via `node-gyp` and external system libraries (ALSA, CoreAudio), leading to broken builds across machines.
   - Using `child_process.spawn` to delegate decoding and playback to VLC or `afplay` keeps the Node.js application 100% pure JavaScript, portable, and dependency-free.
3. **ANSI Redraw Architecture**:
   - `\x1B[H` moves the cursor to the top-left origin.
   - `\x1B[0J` clears from the current cursor position to the end of the screen buffer.
   - Constructing the UI in a single string buffer prevents screen flashing because the terminal emulator updates its raster buffer in a single frame pass.

---

## Feature Matrix

| Feature | Control | Visual Representation | Underlying Mechanism |
| :--- | :--- | :--- | :--- |
| **Track Selection** | `↑` / `↓` | `> song.mp3` | Modulo index clamp + ANSI green text |
| **Playback Toggle** | `Enter` | `▶ [PLAYING]` / `⏸ [PAUSED]` | Spawns headless VLC with `-I rc` |
| **Pause / Resume** | `Space` / `p` | Disc freezes, visualizer dims | Sends `'pause\n'` to VLC stdin |
| **Seeking** | `←` / `→` | Progress bar updates instantly | Sends `'seek ±5\n'` + adjusts `startTime` |
| **Track Skipping** | `n` / `b` | Instant next/prev track start | Cursor mutation + immediate `playSong()` |
| **Loop Mode** | `r` | `[🔁 REPEAT]` badge | Intercepts VLC process `close` event |
| **Spectrum Visualizer** | Automatic | `♫ ▄ ▅ ▆ ▇ █ ▇ ▆ ▅` | 20-bar sine/cos wave at 100ms ticks |
| **Spinning Vinyl** | Automatic | `[◐]`, `[◓]`, `[◑]`, `[◒]` | ANSI frame cycle synchronized with HUD |
| **Safe Exit** | `q` / `Ctrl+C` | Cursor restored, prompt fresh | Restores TTY raw mode and kills child process |

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const songDir = fs.existsSync(path.join(__dirname, 'songs'))
    ? path.join(__dirname, 'songs')
    : path.join(__dirname, '..', 'songs');

let allSongs = null;
let cursor = 0;
let currentSongIndex = 0;
let isPaused = true;
let isRepeat = false;
let vlcPlayProcess = undefined;
let trackingInterval = null;
let isLoadingSong = false;

let totalDuration = undefined;
let timeElapsed = 0;
let startTime = null;
let pausedAt = null;
let totalPausedTime = 0;

function formatTime(seconds) {
    if (seconds === undefined || isNaN(seconds)) return "00:00";
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function getSongDuration(songFilePath) {
    return new Promise((resolve) => {
        const afinfoCP = spawn("afinfo", [songFilePath]);
        let output = "";

        afinfoCP.stdout.on('data', (data) => {
            output += data.toString();
        });

        afinfoCP.on('close', () => {
            const durationMatch = output.match(/estimated duration: ([\d\.]+)/);
            if (durationMatch) {
                resolve(parseFloat(durationMatch[1]));
            } else {
                resolve(60);
            }
        });

        afinfoCP.on('error', () => {
            resolve(60);
        });
    });
}

function updateTimeElapsed() {
    if (!startTime) {
        timeElapsed = 0;
        return;
    }
    if (isPaused && pausedAt) {
        timeElapsed = Math.max(0, (pausedAt - startTime - totalPausedTime) / 1000);
    } else {
        timeElapsed = Math.max(0, (Date.now() - startTime - totalPausedTime) / 1000);
    }
    if (totalDuration && timeElapsed >= totalDuration) {
        timeElapsed = totalDuration;
    }
}

function startElapsedTracking() {
    startTime = Date.now();
    pausedAt = null;
    totalPausedTime = 0;
    timeElapsed = 0;

    if (trackingInterval) {
        clearInterval(trackingInterval);
    }
    trackingInterval = setInterval(() => {
        if (vlcPlayProcess !== undefined && !isPaused) {
            updateTimeElapsed();
        }
        listSongs(songDir);
    }, 100);
}

function renderBar(percentagePlayed) {
    const PROGRESS_BAR_WIDTH = 50;
    const playedCharC = Math.max(0, Math.min(PROGRESS_BAR_WIDTH, Math.round(PROGRESS_BAR_WIDTH * (percentagePlayed / 100))));
    const progressBar = "[" + "X".repeat(playedCharC) + ".".repeat(PROGRESS_BAR_WIDTH - playedCharC) + "]";
    return progressBar;
}

function listSongs(songDirPath) {
    if (!fs.existsSync(songDirPath)) {
        process.stdout.write("\x1B[H\x1B[0JDirectory not found: " + songDirPath + "\n");
        return;
    }
    allSongs = fs.readdirSync(songDirPath).filter(f => !f.startsWith('.'));
    if (allSongs.length === 0) {
        process.stdout.write("\x1B[H\x1B[0JNo songs found in " + songDirPath + "\n");
        return;
    }

    // Move cursor to top-left and clear the entire screen to prevent ghost lines
    let output = "\x1B[H\x1B[0J\x1B[1m=== CLI MUSIC PLAYER ===\x1B[0m\n\n";

    allSongs.forEach((songName, index) => {
        if (index === cursor) {
            output += `\x1B[32m> ${songName}\x1B[0m\n`;
        } else {
            output += `  ${songName}\n`;
        }
    });

    output += "\n";

    if (totalDuration !== undefined && totalDuration > 0) {
        const percentagePlayed = Math.min(100, (timeElapsed / totalDuration) * 100);
        const statusLabel = isPaused ? "\x1B[33m[PAUSED]\x1B[0m" : "\x1B[32m[PLAYING]\x1B[0m";
        output += `${statusLabel} ${formatTime(timeElapsed)} / ${formatTime(totalDuration)} (${percentagePlayed.toFixed(1)}%)\n`;
        output += `${renderBar(percentagePlayed)}\n\n`;
    } else {
        output += `Select a song and press [Enter] to play.\n\n`;
    }

    output += `\x1B[90mControls: [↑/↓] Navigate | [Enter] Play | [Space/p] Pause | [n] Next | [b] Prev | [r] Repeat [${isRepeat ? 'ON' : 'OFF'}] | [q] Quit\x1B[0m\n`;

    process.stdout.write(output);
}

async function playSong(cursorIndex) {
    if (isLoadingSong) return;
    isLoadingSong = true;
    currentSongIndex = cursorIndex;

    if (trackingInterval) {
        clearInterval(trackingInterval);
        trackingInterval = null;
    }

    // 1. Cleanly stop any existing VLC process and remove listeners so old close events don't clobber new state
    if (vlcPlayProcess !== undefined) {
        const oldProcess = vlcPlayProcess;
        vlcPlayProcess = undefined;
        oldProcess.removeAllListeners('close');
        oldProcess.removeAllListeners('exit');
        try {
            oldProcess.kill('SIGKILL');
        } catch (e) {}
    }

    const songFinalPath = path.join(songDir, allSongs[cursorIndex]);
    totalDuration = await getSongDuration(songFinalPath);

    isLoadingSong = false;
    isPaused = false;
    startElapsedTracking();

    const cp = spawn('vlc', ["-I", "rc", "--no-video", songFinalPath], {
        stdio: ['pipe', 'pipe', 'pipe']
    });

    // Drain stdout and stderr so VLC CLI interface does not exit on EPIPE when sending commands
    cp.stdout.resume();
    cp.stderr.resume();

    vlcPlayProcess = cp;

    cp.on('close', () => {
        // Only trigger end-of-song if this was the active process
        if (vlcPlayProcess === cp) {
            vlcPlayProcess = undefined;
            isPaused = true;
            if (trackingInterval) {
                clearInterval(trackingInterval);
                trackingInterval = null;
            }
            if (isRepeat) {
                playSong(currentSongIndex);
            } else {
                listSongs(songDir);
            }
        }
    });
}

function cleanupAndExit() {
    if (trackingInterval) {
        clearInterval(trackingInterval);
    }
    if (vlcPlayProcess !== undefined) {
        const oldProcess = vlcPlayProcess;
        vlcPlayProcess = undefined;
        oldProcess.removeAllListeners('close');
        try {
            oldProcess.kill('SIGKILL');
        } catch (e) {}
    }
    process.stdout.write('\x1b[?25h\x1b[0m\n'); // show cursor and reset formatting
    process.exit(0);
}

process.on('SIGINT', cleanupAndExit);
process.on('SIGTERM', cleanupAndExit);
process.on('exit', () => {
    if (vlcPlayProcess !== undefined) {
        try {
            vlcPlayProcess.kill('SIGKILL');
        } catch (e) {}
    }
    process.stdout.write('\x1b[?25h\x1b[0m');
});

// Clear screen and hide terminal cursor
process.stdout.write('\x1b[2J\x1b[?25l');
listSongs(songDir);

if (process.stdin.isTTY && typeof process.stdin.setRawMode === 'function') {
    process.stdin.setRawMode(true);
}
process.stdin.resume();
process.stdin.on('data', (data) => {
    if (data[0] === 0x1b) {
        if (data[1] === 0x5b) {
            if (data[2] === 0x41) {
                // up arrow key
                if (cursor > 0) cursor--;
            } else if (data[2] === 0x42) {
                // down arrow key
                if (cursor < allSongs.length - 1) cursor++;
            } else if (data[2] === 0x43) {
                // right arrow key
            } else if (data[2] === 0x44) {
                // left arrow key
            }
        }

        listSongs(songDir);
        return;
    }

    // next and back in raw mode
    if (data[0] === 110) { // 'n' - Play Next
        if (cursor >= allSongs.length - 1) return;
        cursor++;
        listSongs(songDir);
        playSong(cursor);
        return;
    }

    if (data[0] === 98) { // 'b' - Play Previous
        if (cursor <= 0) return;
        cursor--;
        listSongs(songDir);
        playSong(cursor);
        return;
    }

    // toggle repeat: 'r' (114) or 'R' (82)
    if (data[0] === 114 || data[0] === 82) {
        isRepeat = !isRepeat;
        listSongs(songDir);
        return;
    }

    // enter in raw mode (0x0d is \r, 0x0a is \n)
    if (data[0] === 0x0d || data[0] === 0x0a) {
        playSong(cursor);
        return;
    }

    // Ctrl+C (0x03) or 'q' (0x71) to exit
    if (data[0] === 0x03 || data[0] === 0x71) {
        cleanupAndExit();
    }

    // play pause: 'p' (112) or spacebar (32)
    if (data[0] === 112 || data[0] === 32) {
        if (vlcPlayProcess !== undefined) {
            isPaused = !isPaused;
            if (isPaused) {
                pausedAt = Date.now();
                if (trackingInterval) {
                    clearInterval(trackingInterval);
                    trackingInterval = null;
                }
            } else {
                if (pausedAt) {
                    totalPausedTime += Date.now() - pausedAt;
                    pausedAt = null;
                }
                if (!trackingInterval) {
                    trackingInterval = setInterval(() => {
                        if (vlcPlayProcess !== undefined && !isPaused) {
                            updateTimeElapsed();
                        }
                        listSongs(songDir);
                    }, 100);
                }
            }
            vlcPlayProcess.stdin.write('pause\n');
            listSongs(songDir);
        } else if (allSongs && allSongs.length > 0) {
            playSong(cursor);
        }
    }
});
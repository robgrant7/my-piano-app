// Aura Piano - Coordinator and UI Controller

// Initialize Audio Engine and Visualizer
const audio = new AudioEngine();
const canvas = document.getElementById('visualizer');
const visualizer = new PianoVisualizer(canvas, audio);

// Connect Audio Engine and Visualizer callbacks
audio.onNoteOn = (note) => {
  visualizer.triggerNoteOn(note);
  document.getElementById('active-note-display').textContent = note;
  const keyEl = document.querySelector(`.key[data-note="${note}"]`);
  if (keyEl) keyEl.classList.add('active');
};

audio.onNoteOff = (note) => {
  visualizer.triggerNoteOff(note);
  if (document.getElementById('active-note-display').textContent === note) {
    document.getElementById('active-note-display').textContent = '';
  }
  const keyEl = document.querySelector(`.key[data-note="${note}"]`);
  if (keyEl) keyEl.classList.remove('active');
};

audio.onPresetChanged = (preset) => {
  // Sync sliders to preset values
  document.getElementById('slider-attack').value = preset.attack;
  document.getElementById('val-attack').textContent = `${preset.attack.toFixed(2)}s`;
  
  document.getElementById('slider-decay').value = preset.decay;
  document.getElementById('val-decay').textContent = `${preset.decay.toFixed(2)}s`;
  
  document.getElementById('slider-sustain').value = preset.sustain;
  document.getElementById('val-sustain').textContent = preset.sustain.toFixed(2);
  
  document.getElementById('slider-release').value = preset.release;
  document.getElementById('val-release').textContent = `${preset.release.toFixed(2)}s`;
  
  if (audio.filter) {
    document.getElementById('slider-filter').value = preset.filterCutoff;
  }
  
  updateEnvelopeGraphic();
};

// Keyboard mappings and Note data
const NOTE_DETAILS = [
  // White keys
  { note: 'C4', key: 'a', freq: 261.63, type: 'white', midi: 60, whiteIdx: 0 },
  { note: 'D4', key: 's', freq: 293.66, type: 'white', midi: 62, whiteIdx: 1 },
  { note: 'E4', key: 'd', freq: 329.63, type: 'white', midi: 64, whiteIdx: 2 },
  { note: 'F4', key: 'f', freq: 349.23, type: 'white', midi: 65, whiteIdx: 3 },
  { note: 'G4', key: 'g', freq: 392.00, type: 'white', midi: 67, whiteIdx: 4 },
  { note: 'A4', key: 'h', freq: 440.00, type: 'white', midi: 69, whiteIdx: 5 },
  { note: 'B4', key: 'j', freq: 493.88, type: 'white', midi: 71, whiteIdx: 6 },
  { note: 'C5', key: 'k', freq: 523.25, type: 'white', midi: 72, whiteIdx: 7 },
  { note: 'D5', key: 'l', freq: 587.33, type: 'white', midi: 74, whiteIdx: 8 },
  { note: 'E5', key: ';', freq: 659.25, type: 'white', midi: 76, whiteIdx: 9 },
  { note: 'F5', key: "'", freq: 698.46, type: 'white', midi: 77, whiteIdx: 10 },
  { note: 'G5', key: 'z', freq: 783.99, type: 'white', midi: 79, whiteIdx: 11 },
  { note: 'A5', key: 'x', freq: 880.00, type: 'white', midi: 81, whiteIdx: 12 },
  { note: 'B5', key: 'c', freq: 987.77, type: 'white', midi: 83, whiteIdx: 13 },
  { note: 'C6', key: 'v', freq: 1046.50, type: 'white', midi: 84, whiteIdx: 14 },
  
  // Black keys (aligned on white key boundaries)
  { note: 'C#4', key: 'w', freq: 277.18, type: 'black', midi: 61, leftOffset: 1 },
  { note: 'D#4', key: 'e', freq: 311.13, type: 'black', midi: 63, leftOffset: 2 },
  { note: 'F#4', key: 't', freq: 369.99, type: 'black', midi: 66, leftOffset: 4 },
  { note: 'G#4', key: 'y', freq: 415.30, type: 'black', midi: 68, leftOffset: 5 },
  { note: 'A#4', key: 'u', freq: 466.16, type: 'black', midi: 70, leftOffset: 6 },
  { note: 'C#5', key: 'o', freq: 554.37, type: 'black', midi: 73, leftOffset: 8 },
  { note: 'D#5', key: 'p', freq: 622.25, type: 'black', midi: 75, leftOffset: 9 },
  { note: 'F#5', key: '[', freq: 739.99, type: 'black', midi: 78, leftOffset: 11 },
  { note: 'G#5', key: ']', freq: 830.61, type: 'black', midi: 80, leftOffset: 12 },
  { note: 'A#5', key: '\\', freq: 932.33, type: 'black', midi: 82, leftOffset: 13 }
];

// Current octave offset factor
let octaveShift = 0; // -1, 0, +1 octaves

// Songs definitions
const SONGS = [
  {
    name: "Ode to Joy",
    difficulty: "easy",
    notes: [
      { note: "E4", start: 0, duration: 400 },
      { note: "E4", start: 500, duration: 400 },
      { note: "F4", start: 1000, duration: 400 },
      { note: "G4", start: 1500, duration: 400 },
      { note: "G4", start: 2000, duration: 400 },
      { note: "F4", start: 2500, duration: 400 },
      { note: "E4", start: 3000, duration: 400 },
      { note: "D4", start: 3500, duration: 400 },
      { note: "C4", start: 4000, duration: 400 },
      { note: "C4", start: 4500, duration: 400 },
      { note: "D4", start: 5000, duration: 400 },
      { note: "E4", start: 5500, duration: 400 },
      { note: "E4", start: 6000, duration: 600 },
      { note: "D4", start: 6600, duration: 200 },
      { note: "D4", start: 6800, duration: 800 },
      
      { note: "E4", start: 8000, duration: 400 },
      { note: "E4", start: 8500, duration: 400 },
      { note: "F4", start: 9000, duration: 400 },
      { note: "G4", start: 9500, duration: 400 },
      { note: "G4", start: 10000, duration: 400 },
      { note: "F4", start: 10500, duration: 400 },
      { note: "E4", start: 11000, duration: 400 },
      { note: "D4", start: 11500, duration: 400 },
      { note: "C4", start: 12000, duration: 400 },
      { note: "C4", start: 12500, duration: 400 },
      { note: "D4", start: 13000, duration: 400 },
      { note: "E4", start: 13500, duration: 400 },
      { note: "D4", start: 14000, duration: 600 },
      { note: "C4", start: 14600, duration: 200 },
      { note: "C4", start: 14800, duration: 800 }
    ]
  },
  {
    name: "Für Elise",
    difficulty: "medium",
    notes: [
      { note: "E5", start: 0, duration: 250 },
      { note: "D#5", start: 300, duration: 250 },
      { note: "E5", start: 600, duration: 250 },
      { note: "D#5", start: 900, duration: 250 },
      { note: "E5", start: 1200, duration: 250 },
      { note: "B4", start: 1500, duration: 250 },
      { note: "D5", start: 1800, duration: 250 },
      { note: "C5", start: 2100, duration: 250 },
      { note: "A4", start: 2400, duration: 750 },
      
      { note: "C4", start: 3200, duration: 250 },
      { note: "E4", start: 3500, duration: 250 },
      { note: "A4", start: 3800, duration: 250 },
      { note: "B4", start: 4100, duration: 750 },
      
      { note: "E4", start: 4900, duration: 250 },
      { note: "G#4", start: 5200, duration: 250 },
      { note: "B4", start: 5500, duration: 250 },
      { note: "C5", start: 5800, duration: 750 },
      
      { note: "E4", start: 6600, duration: 250 },
      { note: "E5", start: 6900, duration: 250 },
      { note: "D#5", start: 7200, duration: 250 },
      { note: "E5", start: 7500, duration: 250 },
      { note: "D#5", start: 7800, duration: 250 },
      { note: "E5", start: 8100, duration: 250 },
      { note: "B4", start: 8400, duration: 250 },
      { note: "D5", start: 8700, duration: 250 },
      { note: "C5", start: 9000, duration: 250 },
      { note: "A4", start: 9300, duration: 750 }
    ]
  },
  {
    name: "Twinkle Twinkle",
    difficulty: "easy",
    notes: [
      { note: "C4", start: 0, duration: 400 },
      { note: "C4", start: 500, duration: 400 },
      { note: "G4", start: 1000, duration: 400 },
      { note: "G4", start: 1500, duration: 400 },
      { note: "A4", start: 2000, duration: 400 },
      { note: "A4", start: 2500, duration: 400 },
      { note: "G4", start: 3000, duration: 800 },
      
      { note: "F4", start: 4000, duration: 400 },
      { note: "F4", start: 4500, duration: 400 },
      { note: "E4", start: 5000, duration: 400 },
      { note: "E4", start: 5500, duration: 400 },
      { note: "D4", start: 6000, duration: 400 },
      { note: "D4", start: 6500, duration: 400 },
      { note: "C4", start: 7000, duration: 800 }
    ]
  }
];

// Metronome state variables
let metronomeInterval = null;
let isMetronomePlaying = false;
let bpm = 120;
let metronomeBeatCount = 0;

// Recording timer state variables
let recordingDurationInterval = null;
let recordingSeconds = 0;

// Song Practice variables
let songPlayInterval = null;
let activePracticeSong = null;
let songStartRealTime = 0;

// Initialize Keyboard Keys in DOM
function createPianoKeyboard() {
  const container = document.getElementById('piano-keyboard');
  container.innerHTML = ''; // Clear existing
  
  // 1. First add all white keys
  const whiteKeys = NOTE_DETAILS.filter(k => k.type === 'white');
  const numWhiteKeys = whiteKeys.length;
  
  whiteKeys.forEach(k => {
    const keyEl = document.createElement('div');
    keyEl.className = 'key white';
    keyEl.dataset.note = k.note;
    keyEl.dataset.freq = k.freq;
    keyEl.dataset.bind = k.key;
    
    keyEl.innerHTML = `
      <span class="key-note">${k.note}</span>
      <span class="key-bind">${k.key}</span>
    `;
    
    container.appendChild(keyEl);
  });
  
  // 2. Add all black keys absolutely positioned
  const blackKeys = NOTE_DETAILS.filter(k => k.type === 'black');
  
  blackKeys.forEach(k => {
    const keyEl = document.createElement('div');
    keyEl.className = 'key black';
    keyEl.dataset.note = k.note;
    keyEl.dataset.freq = k.freq;
    keyEl.dataset.bind = k.key;
    
    // Position key matching boundary of its leftOffset index
    // The width of a single white key is 100 / numWhiteKeys
    const whiteKeyWidthPercent = 100 / numWhiteKeys;
    const offsetLeftPercent = k.leftOffset * whiteKeyWidthPercent;
    
    keyEl.style.left = `${offsetLeftPercent}%`;
    
    keyEl.innerHTML = `
      <span class="key-note">${k.note}</span>
      <span class="key-bind">${k.key}</span>
    `;
    
    container.appendChild(keyEl);
  });
  
  setupKeyMouseEvents();
}

// Attach event listeners to physical DOM keys
function setupKeyMouseEvents() {
  const keys = document.querySelectorAll('.key');
  
  keys.forEach(key => {
    // Left click/Touch starts note
    const playHandler = (e) => {
      e.preventDefault();
      // Only trigger if left mouse button or touch
      if (e.type === 'mousedown' && e.button !== 0) return;
      
      const noteName = key.dataset.note;
      const freq = parseFloat(key.dataset.freq) * Math.pow(2, octaveShift);
      
      audio.playNote(noteName, freq);
      
      // Setup release listeners
      const stopHandler = () => {
        audio.stopNote(noteName);
        window.removeEventListener('mouseup', stopHandler);
        key.removeEventListener('mouseleave', stopHandler);
      };
      
      window.addEventListener('mouseup', stopHandler);
      key.addEventListener('mouseleave', stopHandler);
    };

    key.addEventListener('mousedown', playHandler);
    key.addEventListener('touchstart', playHandler, { passive: false });
  });
}

// Computer Keyboard bindings
const pressedKeys = new Set();

window.addEventListener('keydown', (e) => {
  // Ignore keydowns in input fields
  if (e.target.tagName === 'INPUT') return;
  
  const key = e.key.toLowerCase();
  
  // Metronome toggle hotkey
  if (e.code === 'Space') {
    e.preventDefault();
    toggleMetronome();
    return;
  }
  
  // Record session hotkey
  if (key === 'r') {
    e.preventDefault();
    toggleRecording();
    return;
  }
  
  // Clear practice song hotkey
  if (e.code === 'Escape') {
    e.preventDefault();
    stopSongPractice();
    return;
  }
  
  if (pressedKeys.has(key)) return; // Prevent repeating notes
  
  const noteInfo = NOTE_DETAILS.find(k => k.key.toLowerCase() === key);
  if (noteInfo) {
    pressedKeys.add(key);
    const freq = noteInfo.freq * Math.pow(2, octaveShift);
    audio.playNote(noteInfo.note, freq);
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (pressedKeys.has(key)) {
    pressedKeys.delete(key);
    const noteInfo = NOTE_DETAILS.find(k => k.key.toLowerCase() === key);
    if (noteInfo) {
      audio.stopNote(noteInfo.note);
    }
  }
});

// Sync UI Sliders with Envelope calculations
function updateEnvelopeGraphic() {
  const attack = parseFloat(document.getElementById('slider-attack').value);
  const decay = parseFloat(document.getElementById('slider-decay').value);
  const sustain = parseFloat(document.getElementById('slider-sustain').value);
  const release = parseFloat(document.getElementById('slider-release').value);
  
  audio.envelope.attack = attack;
  audio.envelope.decay = decay;
  audio.envelope.sustain = sustain;
  audio.envelope.release = release;
  
  // Recalculate envelope visual path inside SVG
  // SVG size is viewBox="0 0 200 60"
  const startX = 10;
  const startY = 50;
  
  // Attack (x-width scales from 0 to 40)
  const attackX = startX + (attack * 40);
  const attackY = 10; // Peak
  
  // Decay (x-width scales from 0 to 45)
  const decayX = attackX + (decay * 25);
  const decayY = startY - (sustain * 40); // Sustain height
  
  // Sustain (horizontal flat line of width 40)
  const sustainX = decayX + 45;
  const sustainY = decayY;
  
  // Release (scales from 0 to 60)
  const releaseX = sustainX + (release * 20);
  const releaseY = startY; // Base line
  
  const pathData = `M ${startX} ${startY} L ${attackX} ${attackY} L ${decayX} ${decayY} L ${sustainX} ${sustainY} L ${releaseX} ${releaseY}`;
  document.getElementById('envelope-curve').setAttribute('d', pathData);
}

// Toast System
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  
  toast.className = `toast ${type === 'success' ? 'toast-success' : 'toast-error'} show`;
  msgEl.textContent = message;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Octave Switcher
function setOctave(shift) {
  octaveShift = shift;
  // Label updates: 0 = C4, -1 = C3, +1 = C5
  const labels = { '-1': 'C3', '0': 'C4', '1': 'C5' };
  document.getElementById('current-octave-label').textContent = labels[shift];
  
  // Highlight keys with octave shifts
  showToast(`Octave shifted to ${labels[shift]} base`);
}

// Metronome Logic
function toggleMetronome() {
  if (isMetronomePlaying) {
    stopMetronome();
  } else {
    startMetronome();
  }
}

function startMetronome() {
  isMetronomePlaying = true;
  document.getElementById('btn-metronome-toggle').innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="6" y="4" width="4" height="16"></rect>
      <rect x="14" y="4" width="4" height="16"></rect>
    </svg>
  `;
  document.getElementById('btn-metronome-toggle').classList.add('active');
  
  metronomeBeatCount = 0;
  playBeat();
}

function playBeat() {
  if (!isMetronomePlaying) return;
  
  const tickSoundEnabled = document.getElementById('metronome-sound').checked;
  const bpmValue = parseInt(document.getElementById('slider-bpm').value);
  const intervalMs = (60 / bpmValue) * 1000;
  
  // Sound click
  const isAccent = (metronomeBeatCount === 0);
  if (tickSoundEnabled) {
    audio.playMetronomeTick(isAccent);
  }
  
  // UI Flash
  const dot = document.getElementById('metronome-light');
  dot.className = `metronome-dot active ${isAccent ? 'accent-beat' : ''}`;
  setTimeout(() => {
    dot.className = 'metronome-dot';
  }, 100);
  
  metronomeBeatCount = (metronomeBeatCount + 1) % 4;
  metronomeInterval = setTimeout(playBeat, intervalMs);
}

function stopMetronome() {
  isMetronomePlaying = false;
  clearTimeout(metronomeInterval);
  document.getElementById('btn-metronome-toggle').innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polygon points="5 3 19 12 5 21 5 3"></polygon>
    </svg>
  `;
  document.getElementById('btn-metronome-toggle').classList.remove('active');
  document.getElementById('metronome-light').className = 'metronome-dot';
}

// Session Recorder UI Bindings
audio.onRecordingStateChange = (state) => {
  const btnRec = document.getElementById('btn-record');
  const btnPlay = document.getElementById('btn-play-recording');
  const btnClear = document.getElementById('btn-clear-recording');
  
  if (state === 'recording') {
    btnRec.classList.add('active');
    btnRec.innerHTML = `<span style="width: 10px; height: 10px; border-radius: 2px; background: white; display: inline-block;"></span> Stop`;
    btnPlay.disabled = true;
    btnClear.disabled = true;
    
    // Start stopwatch
    recordingSeconds = 0;
    document.getElementById('recording-timer').textContent = '00:00';
    recordingDurationInterval = setInterval(() => {
      recordingSeconds++;
      const m = Math.floor(recordingSeconds / 60).toString().padStart(2, '0');
      const s = (recordingSeconds % 60).toString().padStart(2, '0');
      document.getElementById('recording-timer').textContent = `${m}:${s}`;
    }, 1000);
  } else if (state === 'playing') {
    btnPlay.classList.add('active');
    btnPlay.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16"></rect>
        <rect x="14" y="4" width="4" height="16"></rect>
      </svg> Stop
    `;
    btnRec.disabled = true;
  } else {
    // Idle / Stopped
    btnRec.classList.remove('active');
    btnRec.disabled = false;
    btnRec.innerHTML = `<span class="rec-icon" style="width: 10px; height: 10px; border-radius: 50%; background: currentColor; display: inline-block;"></span> Rec`;
    
    btnPlay.classList.remove('active');
    btnPlay.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg> Play
    `;
    
    clearInterval(recordingDurationInterval);
    
    const hasData = audio.recordedEvents.length > 0;
    btnPlay.disabled = !hasData;
    btnClear.disabled = !hasData;
    
    if (state === 'empty') {
      document.getElementById('recording-timer').textContent = '00:00';
      btnPlay.disabled = true;
      btnClear.disabled = true;
    }
  }
};

function toggleRecording() {
  if (audio.isRecording) {
    audio.stopRecording();
    // Prompt to save recording
    setTimeout(() => {
      const trackName = prompt("Melody recorded! Enter a name to save this session:", `Session ${new Date().toLocaleTimeString()}`);
      if (trackName !== null) {
        const newTrack = audio.saveRecording(trackName);
        if (newTrack) {
          showToast(`Track "${newTrack.name}" saved!`);
          renderSavedTracks();
        }
      } else {
        // Kept unsaved in cache
        showToast("Melody loaded into cache. Press Play to listen.");
      }
    }, 100);
  } else {
    audio.startRecording();
    showToast("Recording started... Play your keyboard!", "error");
  }
}

function renderSavedTracks() {
  const listEl = document.getElementById('saved-tracks-list');
  const tracks = audio.getSavedTracks();
  
  if (tracks.length === 0) {
    listEl.innerHTML = `
      <div style="padding: 12px; text-align: center; color: var(--color-text-muted); font-size: 11px;">
        No saved tracks yet
      </div>
    `;
    return;
  }
  
  listEl.innerHTML = '';
  tracks.forEach(track => {
    const trackRow = document.createElement('div');
    trackRow.className = 'track-item';
    
    const durSec = Math.round(track.duration / 1000);
    const m = Math.floor(durSec / 60);
    const s = durSec % 60;
    const durStr = `${m}:${s.toString().padStart(2, '0')}`;
    
    trackRow.innerHTML = `
      <div>
        <span class="track-name">${track.name}</span>
        <div class="track-meta">${track.date} • ${durStr}</div>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-icon play-saved" title="Play Track" style="padding: 4px 8px; font-size: 11px;">Play</button>
        <button class="btn-icon delete-saved" title="Delete Track" style="padding: 4px 8px; font-size: 11px; color: var(--color-danger);">Del</button>
      </div>
    `;
    
    // Play Event
    trackRow.querySelector('.play-saved').addEventListener('click', (e) => {
      e.stopPropagation();
      audio.loadSavedRecording(track.id);
      audio.playRecording();
    });
    
    // Delete Event
    trackRow.querySelector('.delete-saved').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete "${track.name}"?`)) {
        audio.deleteSavedRecording(track.id);
        renderSavedTracks();
        showToast("Track deleted");
        // Reset controls
        audio.clearRecording();
      }
    });
    
    listEl.appendChild(trackRow);
  });
}

// --- SONG PRACTICE MODE ---

function setupSongList() {
  const songsListEl = document.getElementById('songs-list');
  songsListEl.innerHTML = '';
  
  SONGS.forEach((song, idx) => {
    const btn = document.createElement('button');
    btn.className = 'song-btn';
    btn.dataset.index = idx;
    
    btn.innerHTML = `
      <span>${song.name}</span>
      <span class="song-difficulty ${song.difficulty}">${song.difficulty}</span>
    `;
    
    btn.addEventListener('click', () => {
      toggleSongPractice(idx);
    });
    
    songsListEl.appendChild(btn);
  });
}

function toggleSongPractice(songIdx) {
  // If clicking active, stop it
  if (activePracticeSong && SONGS[songIdx].name === activePracticeSong.name) {
    stopSongPractice();
    return;
  }
  
  startSongPractice(songIdx);
}

function startSongPractice(songIdx) {
  stopSongPractice(); // Clean up current song if any
  
  const song = SONGS[songIdx];
  activePracticeSong = song;
  
  // Highlight UI button
  document.querySelectorAll('.song-btn').forEach(b => {
    if (parseInt(b.dataset.index) === songIdx) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
  
  // Configure visualizer for practice
  visualizer.practiceMode = true;
  visualizer.currentSongNotes = song.notes;
  visualizer.songElapsedTime = 0;
  
  // Update header status
  document.getElementById('current-mode').textContent = `Practice: ${song.name}`;
  document.getElementById('current-mode').style.borderColor = 'var(--color-accent)';
  document.getElementById('current-mode').style.color = 'var(--color-accent)';
  document.getElementById('current-mode').style.background = 'rgba(6, 182, 212, 0.15)';
  
  showToast(`Practice mode loaded: "${song.name}". Match the falling blocks!`);
  
  // Start clock
  songStartRealTime = Date.now();
  
  songPlayInterval = setInterval(() => {
    const elapsed = Date.now() - songStartRealTime;
    visualizer.songElapsedTime = elapsed;
    
    // Auto loop back if song finishes (last note ends)
    const lastNote = song.notes[song.notes.length - 1];
    const totalLength = lastNote.start + lastNote.duration;
    
    if (elapsed > totalLength + 2000) { // 2s tail
      songStartRealTime = Date.now(); // Loop
    }
  }, 16); // ~60fps clock update
}

function stopSongPractice() {
  if (!activePracticeSong) return;
  
  clearInterval(songPlayInterval);
  songPlayInterval = null;
  activePracticeSong = null;
  
  // Reset highlights on keys
  document.querySelectorAll('.key.highlight').forEach(k => {
    k.classList.remove('highlight');
  });
  
  // Reset buttons
  document.querySelectorAll('.song-btn').forEach(b => b.classList.remove('active'));
  
  // Visualizer settings reset
  visualizer.practiceMode = false;
  visualizer.currentSongNotes = [];
  visualizer.songElapsedTime = 0;
  
  // Reset header status
  document.getElementById('current-mode').textContent = "Free Play";
  document.getElementById('current-mode').style.borderColor = 'var(--color-primary)';
  document.getElementById('current-mode').style.color = 'var(--color-primary)';
  document.getElementById('current-mode').style.background = 'rgba(99, 102, 241, 0.15)';
  
  showToast("Practice song cleared. Returned to Free Play.");
}

// --- SETUP EVENT LISTENERS & BOOT ---

document.addEventListener('DOMContentLoaded', () => {
  // Build keyboard
  createPianoKeyboard();
  
  // Load saved tracks
  renderSavedTracks();
  
  // Load songs practice menu
  setupSongList();
  
  // Active animation canvas
  visualizer.start();
  
  // Sliders input events
  document.getElementById('slider-attack').addEventListener('input', updateEnvelopeGraphic);
  document.getElementById('slider-decay').addEventListener('input', updateEnvelopeGraphic);
  document.getElementById('slider-sustain').addEventListener('input', updateEnvelopeGraphic);
  document.getElementById('slider-release').addEventListener('input', updateEnvelopeGraphic);
  
  // Preset buttons clicks
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
      const presetName = btn.dataset.preset;
      btn.classList.add('active');
      audio.setPreset(presetName);
      showToast(`Preset: ${btn.textContent.trim()} loaded`);
    });
  });
  
  // Octave shifter buttons
  document.getElementById('btn-octave-down').addEventListener('click', () => {
    if (octaveShift > -1) setOctave(octaveShift - 1);
  });
  
  document.getElementById('btn-octave-up').addEventListener('click', () => {
    if (octaveShift < 1) setOctave(octaveShift + 1);
  });
  
  // Filter & volume sliders
  document.getElementById('slider-filter').addEventListener('input', (e) => {
    audio.setFilterCutoff(parseFloat(e.target.value));
  });
  
  document.getElementById('slider-volume').addEventListener('input', (e) => {
    audio.setVolume(parseFloat(e.target.value));
  });
  
  // Metronome sliders
  document.getElementById('slider-bpm').addEventListener('input', (e) => {
    const val = e.target.value;
    document.getElementById('val-bpm').textContent = val;
  });
  
  document.getElementById('btn-metronome-toggle').addEventListener('click', toggleMetronome);
  
  // Recorder buttons
  document.getElementById('btn-record').addEventListener('click', toggleRecording);
  
  document.getElementById('btn-play-recording').addEventListener('click', () => {
    if (audio.isPlayingRecording) {
      audio.stopPlayback();
    } else {
      audio.playRecording();
    }
  });
  
  document.getElementById('btn-clear-recording').addEventListener('click', () => {
    audio.clearRecording();
    showToast("Recording session cleared");
  });
  
  // Toggle key binds view
  document.getElementById('toggle-binds').addEventListener('change', (e) => {
    const wrapper = document.getElementById('keyboard-wrapper');
    if (e.target.checked) {
      wrapper.classList.remove('hide-binds');
    } else {
      wrapper.classList.add('hide-binds');
    }
  });
  
  // Toggle waveform viz in canvas
  document.getElementById('toggle-waveform').addEventListener('change', (e) => {
    visualizer.showWaveform = e.target.checked;
  });

  // Help modal controls
  const helpOverlay = document.getElementById('help-overlay');
  
  document.getElementById('btn-help').addEventListener('click', () => {
    helpOverlay.style.display = 'flex';
    setTimeout(() => helpOverlay.style.opacity = '1', 10);
  });
  
  const closeHelp = () => {
    helpOverlay.style.opacity = '0';
    setTimeout(() => helpOverlay.style.display = 'none', 300);
    // Trigger audio context initialization on first close help interaction
    audio.init();
  };
  
  document.getElementById('btn-close-help').addEventListener('click', closeHelp);
  helpOverlay.addEventListener('click', (e) => {
    if (e.target === helpOverlay) closeHelp();
  });
  
  // Initial envelope draw
  updateEnvelopeGraphic();
});

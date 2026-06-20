// Aura Piano - Coordinator and UI Controller

// Initialize Audio Engine and Visualizer
const audio = new AudioEngine();
const canvas = document.getElementById('visualizer');
const visualizer = new PianoVisualizer(canvas, audio);

// State variables for learning
let practiceSubMode = 'flow'; // 'flow' or 'learn'
let currentSongNoteIndex = 0;
let practiceSpeedMultiplier = 1.0;

// Mic input note stabilizer
let lastMicDetectedNote = null;
let micDetectedCount = 0;

// Connect Audio Engine and Visualizer callbacks
audio.onNoteOn = (note) => {
  visualizer.triggerNoteOn(note);
  document.getElementById('active-note-display').textContent = note;
  const keyEl = document.querySelector(`.key[data-note="${note}"]`);
  if (keyEl) keyEl.classList.add('active');
  
  // If in Learn Mode, check if the played key matches the required song note
  if (activePracticeSong && practiceSubMode === 'learn') {
    const requiredNote = activePracticeSong.notes[currentSongNoteIndex];
    if (requiredNote && note === requiredNote.note) {
      advanceLearnSong();
    }
  }
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

// Mic level mapping
audio.onMicLevel = (level) => {
  const bar = document.getElementById('mic-level');
  if (bar) {
    const percentage = Math.min(Math.max(level * 300, 0), 100);
    bar.style.width = `${percentage}%`;
  }
};

// Mic state toggle feedback
audio.onMicStateChange = (listening, errorMsg) => {
  const container = document.getElementById('mic-container');
  const text = document.getElementById('mic-status-text');
  
  if (listening) {
    container.classList.add('listening');
    text.textContent = 'Mic: On';
    showToast("Acoustic listening active! Play notes on your real piano.");
  } else {
    container.classList.remove('listening');
    text.textContent = 'Mic: Off';
    if (errorMsg) {
      showToast(`Microphone error: ${errorMsg}`, "error");
    } else {
      showToast("Acoustic listening stopped.");
    }
  }
};

// Pitch tracker callback (listens to acoustic piano)
audio.onPitchDetected = (frequency) => {
  // Convert frequency to MIDI number
  const midi = Math.round(12 * Math.log2(frequency / 440) + 69);
  const noteInfo = NOTE_DETAILS.find(k => k.midi === midi);
  
  if (noteInfo) {
    const detectedNote = noteInfo.note;
    
    // Stabilize transient microphone reads: note must be heard 2 consecutive frames
    if (detectedNote === lastMicDetectedNote) {
      micDetectedCount++;
    } else {
      lastMicDetectedNote = detectedNote;
      micDetectedCount = 1;
    }
    
    if (micDetectedCount >= 2) {
      // Show note on canvas visualizer
      visualizer.triggerNoteOn(detectedNote);
      
      // Flash keyboard key on screen
      const keyEl = document.querySelector(`.key[data-note="${detectedNote}"]`);
      if (keyEl) {
        keyEl.classList.add('active');
        // Clear flash after short delay since it is a transient audio read
        setTimeout(() => {
          keyEl.classList.remove('active');
          visualizer.triggerNoteOff(detectedNote);
        }, 250);
      }
      
      // Check Learn Mode match
      if (activePracticeSong && practiceSubMode === 'learn') {
        const requiredNote = activePracticeSong.notes[currentSongNoteIndex];
        if (requiredNote && detectedNote === requiredNote.note) {
          advanceLearnSong();
        }
      }
    }
  }
};

// Dynamic 88-Key Generator (A0 to C8)
function generate88Keys() {
  const notes = [];
  const pitches = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  let whiteCount = 0;
  
  for (let midi = 21; midi <= 108; midi++) {
    const pitchIdx = (midi - 12) % 12;
    const octave = Math.floor((midi - 12) / 12);
    const pitchName = pitches[pitchIdx];
    const noteName = pitchName + octave;
    const freq = 440 * Math.pow(2, (midi - 69) / 12);
    const isBlack = pitchName.includes('#');
    
    const noteObj = {
      note: noteName,
      freq: freq,
      type: isBlack ? 'black' : 'white',
      midi: midi,
      key: '' // Will be bound dynamically in createPianoKeyboard
    };
    
    if (isBlack) {
      noteObj.leftOffset = whiteCount;
    } else {
      noteObj.whiteIdx = whiteCount;
      whiteCount++;
    }
    
    notes.push(noteObj);
  }
  return notes;
}

const NOTE_DETAILS = generate88Keys();

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
  
  const whiteKeys = NOTE_DETAILS.filter(k => k.type === 'white');
  const numWhiteKeys = whiteKeys.length; // 52
  
  // QWERTY map centered at C4 (MIDI 60)
  const qwertyMap = {
    60: 'a', 61: 'w', 62: 's', 63: 'e', 64: 'd', 65: 'f', 66: 't', 67: 'g', 68: 'y', 
    69: 'h', 70: 'u', 71: 'j', 72: 'k', 73: 'o', 74: 'l', 75: 'p', 76: ';', 77: "'", 
    78: '[', 79: 'z', 80: ']', 81: 'x', 82: '\\', 83: 'c', 84: 'v'
  };
  
  // Shift factor (C4 is 60. Shifted base is 60 + octaveShift * 12)
  const shiftOffset = octaveShift * 12;
  
  // 1. Render White Keys
  whiteKeys.forEach(k => {
    const keyEl = document.createElement('div');
    keyEl.className = 'key white';
    keyEl.dataset.note = k.note;
    keyEl.dataset.freq = k.freq;
    
    // Assign dynamic keybind based on octave shift
    const relativeMidi = k.midi - shiftOffset;
    const bind = qwertyMap[relativeMidi] || '';
    if (bind) {
      keyEl.dataset.bind = bind;
    }
    
    const showLabel = k.note.startsWith('C') || k.note === 'A0' || k.note === 'C8';
    
    keyEl.innerHTML = `
      <span class="key-note" style="display: ${showLabel ? 'block' : 'none'};">${k.note}</span>
      ${bind ? `<span class="key-bind">${bind}</span>` : ''}
    `;
    container.appendChild(keyEl);
  });
  
  // 2. Render Black Keys
  const blackKeys = NOTE_DETAILS.filter(k => k.type === 'black');
  blackKeys.forEach(k => {
    const keyEl = document.createElement('div');
    keyEl.className = 'key black';
    keyEl.dataset.note = k.note;
    keyEl.dataset.freq = k.freq;
    
    const relativeMidi = k.midi - shiftOffset;
    const bind = qwertyMap[relativeMidi] || '';
    if (bind) {
      keyEl.dataset.bind = bind;
    }
    
    const whiteKeyWidthPercent = 100 / 52;
    const offsetLeftPercent = k.leftOffset * whiteKeyWidthPercent;
    keyEl.style.left = `${offsetLeftPercent}%`;
    
    keyEl.innerHTML = `
      ${bind ? `<span class="key-bind">${bind}</span>` : ''}
    `;
    container.appendChild(keyEl);
  });
  
  setupKeyMouseEvents();
}

// Attach event listeners to physical DOM keys
function setupKeyMouseEvents() {
  const keys = document.querySelectorAll('.key');
  
  keys.forEach(key => {
    const playHandler = (e) => {
      e.preventDefault();
      if (e.type === 'mousedown' && e.button !== 0) return;
      
      const noteName = key.dataset.note;
      const freq = parseFloat(key.dataset.freq); // Use absolute exact frequency!
      
      audio.playNote(noteName, freq);
      
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
  if (e.target.tagName === 'INPUT') return;
  
  const key = e.key.toLowerCase();
  
  if (e.code === 'Space') {
    e.preventDefault();
    toggleMetronome();
    return;
  }
  
  if (key === 'r') {
    e.preventDefault();
    toggleRecording();
    return;
  }
  
  if (e.code === 'Escape') {
    e.preventDefault();
    stopSongPractice();
    return;
  }
  
  if (pressedKeys.has(key)) return;
  
  // Find key visually mapped to this keybind currently
  const keyEl = document.querySelector(`.key[data-bind="${key}"]`);
  if (keyEl) {
    pressedKeys.add(key);
    const note = keyEl.dataset.note;
    const freq = parseFloat(keyEl.dataset.freq);
    audio.playNote(note, freq);
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  if (pressedKeys.has(key)) {
    pressedKeys.delete(key);
    const keyEl = document.querySelector(`.key[data-bind="${key}"]`);
    if (keyEl) {
      audio.stopNote(keyEl.dataset.note);
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
  currentSongNoteIndex = 0;
  
  // Reset all note play markers
  song.notes.forEach(n => {
    n.played = false;
    n.stopped = false;
  });
  
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
  
  // Update header status
  let modeLabel = "Practice";
  if (practiceSubMode === 'learn') modeLabel = "Learn";
  if (practiceSubMode === 'demo') modeLabel = "Demo";
  
  const practiceTitle = `${modeLabel}: ${song.name}`;
  document.getElementById('current-mode').textContent = practiceTitle;
  document.getElementById('current-mode').style.borderColor = 'var(--color-accent)';
  document.getElementById('current-mode').style.color = 'var(--color-accent)';
  document.getElementById('current-mode').style.background = 'rgba(6, 182, 212, 0.15)';
  
  if (practiceSubMode === 'learn') {
    // Show required note guidance
    document.getElementById('guidance-card').style.display = 'flex';
    const firstNote = song.notes[0];
    document.getElementById('guidance-note-badge').textContent = firstNote.note;
    
    // Set time to first note
    visualizer.songElapsedTime = firstNote.start;
    showToast(`Learn Mode: Play note "${firstNote.note}" on your acoustic piano to begin!`);
  } else {
    // Demo Mode or Flow Mode
    document.getElementById('guidance-card').style.display = 'none';
    visualizer.songElapsedTime = 0;
    
    if (practiceSubMode === 'demo') {
      showToast(`Demo Mode loaded: Watch and listen to "${song.name}"`);
    } else {
      showToast(`Flow Mode loaded: "${song.name}". Play along in real-time!`);
    }
    
    // Start clock with speed support
    let lastTickRealTime = Date.now();
    songPlayInterval = setInterval(() => {
      const now = Date.now();
      const delta = (now - lastTickRealTime) * practiceSpeedMultiplier;
      lastTickRealTime = now;
      
      visualizer.songElapsedTime += delta;
      const elapsed = visualizer.songElapsedTime;
      
      // Auto-play notes if in Demo Mode
      if (practiceSubMode === 'demo') {
        song.notes.forEach(note => {
          // Play note-on when reached
          if (elapsed >= note.start && !note.played) {
            note.played = true;
            // Get frequency mapping
            const noteInfo = NOTE_DETAILS.find(k => k.note === note.note);
            if (noteInfo) {
              const freq = noteInfo.freq * Math.pow(2, octaveShift);
              audio.playNote(note.note, freq);
            }
          }
          
          // Stop note-off when duration completed
          if (elapsed >= (note.start + note.duration) && !note.stopped) {
            note.stopped = true;
            audio.stopNote(note.note);
          }
        });
      }
      
      // Auto loop back if song finishes
      const lastNote = song.notes[song.notes.length - 1];
      const totalLength = lastNote.start + lastNote.duration;
      
      if (elapsed > totalLength + 1500) {
        // Reset song elapsed time
        visualizer.songElapsedTime = 0;
        audio.allNotesOff();
        
        // Reset note flags
        song.notes.forEach(n => {
          n.played = false;
          n.stopped = false;
        });
        
        // Clear screen keyboard active highlights
        document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
      }
    }, 16); // ~60fps clock update
  }
}

function advanceLearnSong() {
  if (!activePracticeSong || practiceSubMode !== 'learn') return;
  
  currentSongNoteIndex++;
  
  // Clear any existing highlighted keys
  document.querySelectorAll('.key.highlight').forEach(k => k.classList.remove('highlight'));
  
  if (currentSongNoteIndex >= activePracticeSong.notes.length) {
    showToast("🎉 Song completed! Excellent playing!", "success");
    stopSongPractice();
  } else {
    const nextNote = activePracticeSong.notes[currentSongNoteIndex];
    document.getElementById('guidance-note-badge').textContent = nextNote.note;
    
    // Smoothly shift elapsedTime to the next note start
    visualizer.songElapsedTime = nextNote.start;
  }
}

function stopSongPractice() {
  if (!activePracticeSong) return;
  
  clearInterval(songPlayInterval);
  songPlayInterval = null;
  activePracticeSong = null;
  currentSongNoteIndex = 0;
  
  // Hide guidance
  document.getElementById('guidance-card').style.display = 'none';
  
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
  
  // Microphone toggle button click
  document.getElementById('btn-mic-toggle').addEventListener('click', () => {
    if (audio.isListeningMic) {
      audio.stopMicListening();
    } else {
      audio.startMicListening();
    }
  });

  // Flow vs Learn vs Demo tab toggle clicks
  const tabDemo = document.getElementById('tab-practice-demo');
  const tabFlow = document.getElementById('tab-practice-flow');
  const tabLearn = document.getElementById('tab-practice-learn');

  const setPracticeTab = (mode) => {
    practiceSubMode = mode;
    [tabDemo, tabFlow, tabLearn].forEach(t => t.classList.remove('active'));
    
    if (mode === 'demo') tabDemo.classList.add('active');
    if (mode === 'flow') tabFlow.classList.add('active');
    if (mode === 'learn') tabLearn.classList.add('active');
    
    stopSongPractice();
  };

  tabDemo.addEventListener('click', () => setPracticeTab('demo'));
  tabFlow.addEventListener('click', () => setPracticeTab('flow'));
  tabLearn.addEventListener('click', () => setPracticeTab('learn'));

  // Speed slider event listener
  document.getElementById('slider-practice-speed').addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    practiceSpeedMultiplier = val;
    document.getElementById('val-practice-speed').textContent = `${val.toFixed(2)}x`;
  });
  
  // Initial envelope draw
  updateEnvelopeGraphic();
});

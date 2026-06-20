// Aura Piano - Coordinator and UI Controller

// Initialize Audio Engine and Visualizer
const audio = new AudioEngine();
const canvas = document.getElementById('visualizer');
const visualizer = new PianoVisualizer(canvas, audio);

// State variables for learning
let practiceSubMode = 'flow'; // 'flow' or 'learn'
let currentSongNoteIndex = 0;
let practiceSpeedMultiplier = 1.0;
let selectedDifficulty = 'easy'; // 'easy' or 'medium' or 'hard'

// Performance scoring
let notesAttempted = 0;
let notesCorrect = 0;
let currentStreak = 0;
let maxStreak = 0;

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
    if (requiredNote) {
      if (note === requiredNote.note) {
        advanceLearnSong();
      } else {
        // Wrong note pressed. Reset current streak and increment attempted notes
        currentStreak = 0;
        notesAttempted++;
      }
    }
  }
  
  // If in Flow Mode, check if it matches an active song note
  if (activePracticeSong && practiceSubMode === 'flow') {
    const elapsed = visualizer.songElapsedTime;
    const matchingNote = activePracticeSong.notes.find(n => 
      Math.abs(elapsed - n.start) < 400 && 
      n.note === note && 
      !n.isEvaluated
    );
    if (matchingNote) {
      matchingNote.isEvaluated = true;
      matchingNote.isHit = true;
      notesCorrect++;
      notesAttempted++;
      currentStreak++;
      if (currentStreak > maxStreak) {
        maxStreak = currentStreak;
      }
      showToast(`Hit: ${note}! 🔥`, "success");
    } else {
      // Wrong note played in Flow Mode, reset current streak
      currentStreak = 0;
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

      // Check Flow Mode match
      if (activePracticeSong && practiceSubMode === 'flow') {
        const elapsed = visualizer.songElapsedTime;
        const matchingNote = activePracticeSong.notes.find(n => 
          Math.abs(elapsed - n.start) < 400 && 
          n.note === detectedNote && 
          !n.isEvaluated
        );
        if (matchingNote) {
          matchingNote.isEvaluated = true;
          matchingNote.isHit = true;
          notesCorrect++;
          notesAttempted++;
          currentStreak++;
          if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
          }
          showToast(`Hit: ${detectedNote}! 🎙️🔥`, "success");
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

// --- SONG DATABASE, PARSER, PROCEDURAL Melodies & DIFFICULTY TRANSFORMATIONS ---

const SONG_LIBRARY = {
  "jingle bells": "E4 E4 E4 E4 E4 E4 E4 G4 C4 D4 E4 F4 F4 F4 F4 F4 E4 E4 E4 E4 D4 D4 E4 D4 G4",
  "happy birthday": "C4 C4 D4 C4 F4 E4 C4 C4 D4 C4 G4 F4 C4 C4 C5 A4 F4 E4 D4 A#4 A#4 A4 F4 G4 F4",
  "canon in d": "F#5 E5 D5 C#5 B4 A4 B4 C#5 F#4 E4 D4 C#4 B3 A3 B3 C#4",
  "moonlight sonata": "E3 G3 C4 E3 G3 C4 E3 G3 C4 E3 G3 C4 D3 F#3 B3 D3 F#3 B3",
  "baby shark": "D4 E4 G4 G4 G4 G4 G4 G4 G4 D4 E4 G4 G4 G4 G4 G4 G4 G4 D4 E4 G4 G4 G4 G4 G4 G4 G4 G4 G4 F#4",
  "star wars": "D4 D4 D4 G4 D5 C5 B4 A4 G5 D5 C5 B4 A4 G5 D5 C5 B4 C5 A4",
  "ode to joy": "E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4",
  "fur elise": "E5 D#5 E5 D#5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G#4 B4 C5"
};

function normalizeNoteName(name) {
  const flatToSharp = {
    'DB': 'C#', 'EB': 'D#', 'GB': 'F#', 'AB': 'G#', 'BB': 'A#'
  };
  let normalized = name.toUpperCase();
  const matches = normalized.match(/^([A-G]B)(\d)$/i);
  if (matches) {
    const flatNote = matches[1].toUpperCase();
    const octave = matches[2];
    if (flatToSharp[flatNote]) {
      return flatToSharp[flatNote] + octave;
    }
  }
  return normalized;
}

function parseNoteString(str) {
  const tokens = str.trim().split(/\s+/);
  const notes = [];
  let elapsed = 0;
  
  tokens.forEach(token => {
    const matches = token.match(/^([A-G][#B]?\d)(?::(\d+))?$/i);
    if (matches) {
      const noteName = normalizeNoteName(matches[1]);
      const duration = matches[2] ? parseInt(matches[2]) : 400;
      notes.push({
        note: noteName,
        start: elapsed,
        duration: duration
      });
      elapsed += duration + 100; // 100ms silence gap between notes
    }
  });
  
  return notes;
}

function generateProceduralSong(seedText) {
  // Seeded random number generator
  let hash = 0;
  for (let i = 0; i < seedText.length; i++) {
    hash = seedText.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const random = function() {
    const x = Math.sin(hash++) * 10000;
    return x - Math.floor(x);
  };
  
  // C major scale notes in treble range
  const scale = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5'];
  
  const songLength = 16 + Math.floor(random() * 16); // 16 to 32 notes
  const notes = [];
  let elapsed = 0;
  let currentIdx = 4; // Start at G4
  
  for (let i = 0; i < songLength; i++) {
    const r = random();
    let step = 0;
    if (r < 0.35) step = -1;
    else if (r > 0.65) step = 1;
    
    // Leaps
    if (random() < 0.1) {
      step = step * 3;
    }
    
    currentIdx += step;
    if (currentIdx < 0) currentIdx = 1;
    if (currentIdx >= scale.length) currentIdx = scale.length - 2;
    
    const noteName = scale[currentIdx];
    const duration = random() > 0.75 ? 800 : 400;
    
    notes.push({
      note: noteName,
      start: elapsed,
      duration: duration
    });
    
    elapsed += duration + 100;
  }
  
  return notes;
}

function getMidiNumber(noteName) {
  const info = NOTE_DETAILS.find(k => k.note === noteName);
  return info ? info.midi : 60;
}

function getNoteNameFromMidi(midi) {
  const info = NOTE_DETAILS.find(k => k.midi === midi);
  return info ? info.note : "C4";
}

function applyDifficultyToNotes(notes, difficulty) {
  const cloned = notes.map(n => ({
    note: n.note,
    start: n.start,
    duration: n.duration,
    midi: getMidiNumber(n.note)
  }));
  
  if (difficulty === 'easy') {
    // Keep only highest pitch note at any starting point
    const uniqueMap = {};
    cloned.forEach(n => {
      if (!uniqueMap[n.start] || n.midi > uniqueMap[n.start].midi) {
        uniqueMap[n.start] = n;
      }
    });
    
    let simplified = Object.values(uniqueMap).sort((a, b) => a.start - b.start);
    
    // Slow down tempo (1.4x factor)
    simplified.forEach(n => {
      n.start = Math.round(n.start * 1.4);
      n.duration = Math.round(n.duration * 1.4);
    });
    
    return simplified;
    
  } else if (difficulty === 'medium') {
    // Standard speed (1.0x), plus a single bass octave note playing every 1.6s bar
    const withBass = [];
    let lastBassTime = -2000;
    
    cloned.sort((a, b) => a.start - b.start).forEach(n => {
      withBass.push(n);
      
      if (n.start >= lastBassTime + 1600) {
        const bassMidi = n.midi - 24; // 2 octaves down
        if (bassMidi >= 21) {
          withBass.push({
            note: getNoteNameFromMidi(bassMidi),
            start: n.start,
            duration: Math.max(n.duration, 800),
            midi: bassMidi,
            isBass: true
          });
          lastBassTime = n.start;
        }
      }
    });
    
    return withBass.sort((a, b) => a.start - b.start);
    
  } else { // Hard Mode
    // Speed up tempo (0.85x factor), chord harmonies triggered on beat
    const spedUp = cloned.map(n => ({
      note: n.note,
      start: Math.round(n.start * 0.85),
      duration: Math.round(n.duration * 0.85),
      midi: n.midi
    }));
    
    const withChords = [];
    let lastChordTime = -1000;
    
    spedUp.sort((a, b) => a.start - b.start).forEach(n => {
      withChords.push(n);
      
      if (n.start >= lastChordTime + 1000) {
        const fifthMidi = n.midi - 17; // 1 octave + fifth down
        const octMidi = n.midi - 12; // 1 octave down
        
        if (octMidi >= 21) {
          withChords.push({
            note: getNoteNameFromMidi(octMidi),
            start: n.start,
            duration: n.duration,
            midi: octMidi,
            isBass: true
          });
        }
        if (fifthMidi >= 21) {
          withChords.push({
            note: getNoteNameFromMidi(fifthMidi),
            start: n.start,
            duration: n.duration,
            midi: fifthMidi,
            isBass: true
          });
        }
        lastChordTime = n.start;
      }
    });
    
    return withChords.sort((a, b) => a.start - b.start);
  }
}

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
  
  let song;
  if (typeof songIdx === 'object') {
    song = songIdx;
  } else {
    song = SONGS[songIdx];
  }
  
  if (!song || !song.notes) return;
  
  // Transform notes based on selected difficulty
  const transformedNotes = applyDifficultyToNotes(song.notes, selectedDifficulty);
  
  // Setup active practice song state
  activePracticeSong = {
    name: song.name,
    difficulty: selectedDifficulty,
    notes: transformedNotes,
    originalNotes: song.notes
  };
  
  currentSongNoteIndex = 0;
  
  // Reset performance variables
  notesAttempted = 0;
  notesCorrect = 0;
  currentStreak = 0;
  maxStreak = 0;
  
  // Reset all note play markers and scoring flags
  activePracticeSong.notes.forEach(n => {
    n.played = false;
    n.stopped = false;
    n.isEvaluated = false;
    n.isHit = false;
  });
  
  // Highlight UI button
  document.querySelectorAll('.song-btn').forEach(b => {
    if (typeof songIdx === 'number' && parseInt(b.dataset.index) === songIdx) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
  
  // Configure visualizer for practice
  visualizer.practiceMode = true;
  visualizer.currentSongNotes = activePracticeSong.notes;
  
  // Update header status
  let modeLabel = "Practice";
  if (practiceSubMode === 'learn') modeLabel = "Learn";
  if (practiceSubMode === 'demo') modeLabel = "Demo";
  
  const practiceTitle = `${modeLabel}: ${activePracticeSong.name}`;
  document.getElementById('current-mode').textContent = practiceTitle;
  document.getElementById('current-mode').style.borderColor = 'var(--color-accent)';
  document.getElementById('current-mode').style.color = 'var(--color-accent)';
  document.getElementById('current-mode').style.background = 'rgba(6, 182, 212, 0.15)';
  
  if (practiceSubMode === 'learn') {
    // Show required note guidance
    document.getElementById('guidance-card').style.display = 'flex';
    const firstNote = activePracticeSong.notes[0];
    document.getElementById('guidance-note-badge').textContent = firstNote.note;
    
    // Set time to first note
    visualizer.songElapsedTime = firstNote.start;
    showToast(`Learn Mode: Play note "${firstNote.note}" on your acoustic piano to begin!`);
  } else {
    // Demo Mode or Flow Mode
    document.getElementById('guidance-card').style.display = 'none';
    visualizer.songElapsedTime = 0;
    
    if (practiceSubMode === 'demo') {
      showToast(`Demo Mode loaded: Watch and listen to "${activePracticeSong.name}"`);
    } else {
      showToast(`Flow Mode loaded: "${activePracticeSong.name}". Play along in real-time!`);
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
        activePracticeSong.notes.forEach(note => {
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
      
      // Evaluate missed notes in Flow Mode
      if (practiceSubMode === 'flow') {
        activePracticeSong.notes.forEach(note => {
          if (elapsed > note.start + 400 && !note.isEvaluated) {
            note.isEvaluated = true;
            note.isHit = false;
            notesAttempted++;
            currentStreak = 0;
            showToast(`Missed: ${note.note} 🌊`, "warning");
          }
        });
      }
      
      // Auto loop or complete if song finishes
      const lastNote = activePracticeSong.notes[activePracticeSong.notes.length - 1];
      const totalLength = lastNote.start + lastNote.duration;
      
      if (elapsed > totalLength + 1500) {
        if (practiceSubMode === 'flow') {
          finishPracticeSong();
        } else {
          // Reset song elapsed time
          visualizer.songElapsedTime = 0;
          audio.allNotesOff();
          
          // Reset note flags
          activePracticeSong.notes.forEach(n => {
            n.played = false;
            n.stopped = false;
          });
          
          // Clear screen keyboard active highlights
          document.querySelectorAll('.key.active').forEach(k => k.classList.remove('active'));
        }
      }
    }, 16); // ~60fps clock update
  }
}

function advanceLearnSong() {
  if (!activePracticeSong || practiceSubMode !== 'learn') return;
  
  notesCorrect++;
  notesAttempted++;
  currentStreak++;
  if (currentStreak > maxStreak) {
    maxStreak = currentStreak;
  }
  
  currentSongNoteIndex++;
  
  // Clear any existing highlighted keys
  document.querySelectorAll('.key.highlight').forEach(k => k.classList.remove('highlight'));
  
  if (currentSongNoteIndex >= activePracticeSong.notes.length) {
    finishPracticeSong();
  } else {
    const nextNote = activePracticeSong.notes[currentSongNoteIndex];
    document.getElementById('guidance-note-badge').textContent = nextNote.note;
    
    // Smoothly shift elapsedTime to the next note start
    visualizer.songElapsedTime = nextNote.start;
  }
}

function finishPracticeSong() {
  const songName = activePracticeSong ? activePracticeSong.name : "Practice Song";
  const subMode = practiceSubMode;
  
  stopSongPractice();
  
  if (subMode === 'demo') return;
  
  const totalNotes = notesAttempted || 1;
  const accuracy = Math.round((notesCorrect / totalNotes) * 100);
  const hits = notesCorrect;
  const misses = Math.max(0, notesAttempted - notesCorrect);
  const streak = maxStreak;
  
  let rating = "Beachcomber 🏖️";
  if (accuracy >= 95) {
    rating = "Tiki Maestro 🌺";
  } else if (accuracy >= 85) {
    rating = "Surf Virtuoso 🏄‍♂️";
  } else if (accuracy >= 70) {
    rating = "Ocean Breeze Maestro 🌊";
  } else if (accuracy >= 50) {
    rating = "Sandcastle Builder 🏰";
  } else if (accuracy >= 25) {
    rating = "Coconut Jogger 🥥";
  }
  
  document.getElementById('report-song-title').textContent = songName;
  document.getElementById('report-card-accuracy').textContent = `${accuracy}%`;
  document.getElementById('report-card-rating').textContent = rating;
  document.getElementById('report-hits').textContent = hits;
  document.getElementById('report-misses').textContent = misses;
  document.getElementById('report-streak').textContent = streak;
  
  const overlay = document.getElementById('report-card-overlay');
  overlay.style.display = 'flex';
  setTimeout(() => {
    overlay.classList.add('show');
  }, 10);
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

function loadCustomSong() {
  const inputEl = document.getElementById('input-custom-song');
  const query = inputEl.value.trim();
  if (!query) {
    showToast("Type a song name or notes list first!", "warning");
    return;
  }
  
  let notes = [];
  let name = "";
  
  const lowerQuery = query.toLowerCase();
  const libraryKey = Object.keys(SONG_LIBRARY).find(k => k.includes(lowerQuery) || lowerQuery.includes(k));
  
  if (libraryKey) {
    name = libraryKey.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    notes = parseNoteString(SONG_LIBRARY[libraryKey]);
    showToast(`Loaded "${name}" from library! 🎵`);
  } else {
    const tokens = query.split(/\s+/);
    const validNotesCount = tokens.filter(t => t.match(/^([A-G][#B]?\d)(?::\d+)?$/i)).length;
    
    if (validNotesCount >= 2 && validNotesCount >= tokens.length * 0.5) {
      name = "Typed Song";
      notes = parseNoteString(query);
      showToast(`Loaded ${notes.length} typed notes! 🎹`);
    } else {
      name = query.substring(0, 20);
      name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      notes = generateProceduralSong(query);
      showToast(`Generated procedural tune for "${name}"! 🌊🌴`);
    }
  }
  
  if (notes.length === 0) {
    showToast("Could not parse notes. Format should be e.g. C4 D4 E4", "error");
    return;
  }
  
  const customSong = {
    name: name,
    difficulty: selectedDifficulty,
    notes: notes
  };
  
  startSongPractice(customSong);
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

  // Canvas View Toggle tabs (Waterfall vs Sheet Music)
  const tabWaterfall = document.getElementById('view-tab-waterfall');
  const tabSheet = document.getElementById('view-tab-sheet');

  if (tabWaterfall && tabSheet) {
    tabWaterfall.addEventListener('click', () => {
      tabWaterfall.classList.add('active');
      tabSheet.classList.remove('active');
      visualizer.currentView = 'waterfall';
    });

    tabSheet.addEventListener('click', () => {
      tabSheet.classList.add('active');
      tabWaterfall.classList.remove('active');
      visualizer.currentView = 'sheet';
    });
  }

  // Difficulty toggle tabs
  const diffEasy = document.getElementById('diff-tab-easy');
  const diffMedium = document.getElementById('diff-tab-medium');
  const diffHard = document.getElementById('diff-tab-hard');

  const setDifficulty = (diff) => {
    selectedDifficulty = diff;
    [diffEasy, diffMedium, diffHard].forEach(t => {
      if (t) t.classList.remove('active');
    });
    
    if (diff === 'easy' && diffEasy) diffEasy.classList.add('active');
    if (diff === 'medium' && diffMedium) diffMedium.classList.add('active');
    if (diff === 'hard' && diffHard) diffHard.classList.add('active');
    
    showToast(`Difficulty set to ${diff.toUpperCase()}`);
    
    // If a song is currently playing, reload it with the new difficulty
    if (activePracticeSong) {
      const currentName = activePracticeSong.name;
      const songIdx = SONGS.findIndex(s => s.name === currentName);
      
      if (songIdx !== -1) {
        startSongPractice(songIdx);
      } else if (activePracticeSong.originalNotes) {
        const originalSong = {
          name: activePracticeSong.name,
          notes: activePracticeSong.originalNotes
        };
        startSongPractice(originalSong);
      } else {
        stopSongPractice();
      }
    }
  };

  if (diffEasy) diffEasy.addEventListener('click', () => setDifficulty('easy'));
  if (diffMedium) diffMedium.addEventListener('click', () => setDifficulty('medium'));
  if (diffHard) diffHard.addEventListener('click', () => setDifficulty('hard'));

  // Custom song input and load button
  const btnLoadCustom = document.getElementById('btn-load-custom-song');
  const inputCustom = document.getElementById('input-custom-song');

  if (btnLoadCustom) {
    btnLoadCustom.addEventListener('click', loadCustomSong);
  }
  if (inputCustom) {
    inputCustom.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        loadCustomSong();
      }
    });
  }

  // Performance Report Card close button
  const btnCloseReport = document.getElementById('btn-close-report');
  const reportOverlay = document.getElementById('report-card-overlay');
  
  if (btnCloseReport && reportOverlay) {
    const closeReport = () => {
      reportOverlay.classList.remove('show');
      setTimeout(() => {
        reportOverlay.style.display = 'none';
      }, 300);
    };
    
    btnCloseReport.addEventListener('click', closeReport);
    reportOverlay.addEventListener('click', (e) => {
      if (e.target === reportOverlay) closeReport();
    });
  }
  
  // Initial envelope draw
  updateEnvelopeGraphic();
});

// Aura Piano - Web Audio API Engine
class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.masterGain = null;
    this.filter = null;
    this.analyser = null;
    this.delayNode = null;
    this.delayGain = null;
    
    // Polyphony voice tracking
    this.activeVoices = {};
    
    // Synth settings
    this.currentPreset = 'piano';
    this.envelope = {
      attack: 0.05,
      decay: 0.3,
      sustain: 0.6,
      release: 0.5
    };
    
    // Master parameters
    this.masterVolume = 0.8; // 0 to 1
    this.filterCutoff = 8000; // Hz
    
    // Presets configurations
    this.presets = {
      piano: {
        waveforms: ['triangle', 'sine'],
        detune: 5,
        attack: 0.02,
        decay: 1.2,
        sustain: 0.1,
        release: 0.8,
        filterCutoff: 4000
      },
      pad: {
        waveforms: ['sawtooth', 'triangle'],
        detune: 12,
        attack: 0.4,
        decay: 1.5,
        sustain: 0.7,
        release: 1.5,
        filterCutoff: 1200
      },
      retro: {
        waveforms: ['square', 'sawtooth'],
        detune: 8,
        attack: 0.01,
        decay: 0.2,
        sustain: 0.4,
        release: 0.3,
        filterCutoff: 2500
      },
      epiano: {
        waveforms: ['sine', 'sine'], // FM synthesis style simulated by detuning & envelope shapes
        detune: 18,
        attack: 0.005,
        decay: 0.4,
        sustain: 0.3,
        release: 0.6,
        filterCutoff: 6000
      }
    };

    // Recording system
    this.isRecording = false;
    this.recordingStartTime = 0;
    this.recordedEvents = []; // Array of { type: 'on'|'off', note: string, time: ms }
    this.isPlayingRecording = false;
    this.playbackTimeouts = [];
    this.recordingTimerInterval = null;
  }

  // Initialize context on first user interaction
  init() {
    if (this.audioCtx) return;
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    
    // Create Nodes
    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = this.masterVolume;
    
    this.filter = this.audioCtx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = this.filterCutoff;
    this.filter.Q.value = 1.0;
    
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 512;
    
    // Create Feedback Delay effect
    this.delayNode = this.audioCtx.createDelay(2.0); // max delay 2s
    this.delayNode.delayTime.value = 0.35; // 350ms delay
    
    this.delayGain = this.audioCtx.createGain();
    this.delayGain.gain.value = 0.25; // 25% feedback
    
    // Connect nodes:
    // Source -> Filter -> MasterGain -> Analyser -> Destination
    // Delay routing: Filter -> DelayNode -> DelayGain -> Filter (feedback) AND DelayGain -> MasterGain
    
    this.filter.connect(this.masterGain);
    
    // Connect feedback loop
    this.filter.connect(this.delayNode);
    this.delayNode.connect(this.delayGain);
    this.delayGain.connect(this.filter); // feedback
    this.delayGain.connect(this.masterGain); // mix in output
    
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    
    this.setPreset(this.currentPreset);
  }

  setVolume(val) {
    this.masterVolume = val / 100;
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.audioCtx.currentTime);
    }
  }

  setFilterCutoff(val) {
    this.filterCutoff = val;
    if (this.filter) {
      // Exponential ramp for filter frequency sweep
      this.filter.frequency.setTargetAtTime(this.filterCutoff, this.audioCtx.currentTime, 0.05);
    }
  }

  setPreset(name) {
    if (!this.presets[name]) return;
    this.currentPreset = name;
    const p = this.presets[name];
    
    this.envelope.attack = p.attack;
    this.envelope.decay = p.decay;
    this.envelope.sustain = p.sustain;
    this.envelope.release = p.release;
    
    this.setFilterCutoff(p.filterCutoff);
    
    // Trigger envelope UI update event if registered
    if (this.onPresetChanged) {
      this.onPresetChanged(p);
    }
  }

  // Play a note (polyphonic)
  playNote(noteName, frequency) {
    this.init();
    
    // Resume context if suspended (browser security)
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    
    // If the note is already playing, release it first to avoid clicking
    if (this.activeVoices[noteName]) {
      this.stopNote(noteName);
    }
    
    // Setup synthesis based on preset
    const presetCfg = this.presets[this.currentPreset];
    const oscillators = [];
    
    // Envelope Node
    const voiceGain = this.audioCtx.createGain();
    voiceGain.gain.setValueAtTime(0, now);
    // Attack phase
    voiceGain.gain.linearRampToValueAtTime(0.5, now + this.envelope.attack);
    // Decay to sustain phase
    voiceGain.gain.setTargetAtTime(0.5 * this.envelope.sustain, now + this.envelope.attack, this.envelope.decay);

    // Create Oscillators (multiple oscillators for richer sound)
    presetCfg.waveforms.forEach((wave, idx) => {
      const osc = this.audioCtx.createOscillator();
      osc.type = wave;
      
      // Calculate detuned frequency for the second oscillator
      if (idx === 0) {
        osc.frequency.value = frequency;
      } else {
        // Detune secondary oscillator
        osc.frequency.value = frequency;
        osc.detune.value = presetCfg.detune;
        
        // Custom FM bell sound for FM E-Piano preset
        if (this.currentPreset === 'epiano') {
          osc.frequency.value = frequency * 2; // Modulator harmonic
        }
      }
      
      osc.connect(voiceGain);
      osc.start(now);
      oscillators.push(osc);
    });
    
    // Connect Voice Gain to Master Filter
    voiceGain.connect(this.filter);
    
    // Store voice information to trigger Release phase later
    this.activeVoices[noteName] = {
      oscillators: oscillators,
      gainNode: voiceGain,
      startTime: now
    };
    
    // Visual trigger callback
    if (this.onNoteOn) {
      this.onNoteOn(noteName);
    }

    // Record Event
    if (this.isRecording) {
      this.recordedEvents.push({
        type: 'on',
        note: noteName,
        freq: frequency,
        time: Date.now() - this.recordingStartTime
      });
    }
  }

  // Release a note (polyphonic)
  stopNote(noteName) {
    if (!this.activeVoices[noteName]) return;
    
    const now = this.audioCtx.currentTime;
    const voice = this.activeVoices[noteName];
    delete this.activeVoices[noteName];
    
    const releaseTime = this.envelope.release;
    
    // Cancel any scheduled gain ramps and ramp down to 0
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);
    voice.gainNode.gain.setTargetAtTime(0, now, releaseTime);
    
    // Stop oscillators and disconnect them after release phase finishes
    voice.oscillators.forEach(osc => {
      osc.stop(now + (releaseTime * 5)); // 5 time constants is fully decayed
      setTimeout(() => {
        try {
          osc.disconnect();
          voice.gainNode.disconnect();
        } catch (e) {
          // Node might already be disconnected or context closed
        }
      }, (releaseTime * 5) * 1000 + 100);
    });

    if (this.onNoteOff) {
      this.onNoteOff(noteName);
    }

    // Record Event
    if (this.isRecording) {
      this.recordedEvents.push({
        type: 'off',
        note: noteName,
        time: Date.now() - this.recordingStartTime
      });
    }
  }

  // Release all playing notes (e.g. when changing songs or presets)
  allNotesOff() {
    Object.keys(this.activeVoices).forEach(noteName => {
      this.stopNote(noteName);
    });
  }

  // Play a simple woodblock click for metronome
  playMetronomeTick(isAccent) {
    this.init();
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isAccent ? 1200 : 800, now);
    
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // --- RECORDING SYSTEM ---
  
  startRecording() {
    this.init();
    this.allNotesOff();
    this.recordedEvents = [];
    this.isRecording = true;
    this.recordingStartTime = Date.now();
    
    if (this.onRecordingStateChange) {
      this.onRecordingStateChange('recording');
    }
  }
  
  stopRecording() {
    if (!this.isRecording) return;
    this.isRecording = false;
    this.allNotesOff();
    
    if (this.onRecordingStateChange) {
      this.onRecordingStateChange('idle');
    }
  }
  
  clearRecording() {
    this.recordedEvents = [];
    this.allNotesOff();
    if (this.onRecordingStateChange) {
      this.onRecordingStateChange('empty');
    }
  }
  
  playRecording() {
    if (this.recordedEvents.length === 0 || this.isPlayingRecording) return;
    
    this.isPlayingRecording = true;
    this.allNotesOff();
    
    if (this.onRecordingStateChange) {
      this.onRecordingStateChange('playing');
    }
    
    const playbackStart = Date.now();
    
    this.recordedEvents.forEach(evt => {
      const timeoutId = setTimeout(() => {
        if (evt.type === 'on') {
          this.playNote(evt.note, evt.freq);
        } else {
          this.stopNote(evt.note);
        }
      }, evt.time);
      
      this.playbackTimeouts.push(timeoutId);
    });
    
    // Schedule stopping state at the end
    const lastEventTime = this.recordedEvents[this.recordedEvents.length - 1].time;
    const finalTimeoutId = setTimeout(() => {
      this.stopPlayback();
    }, lastEventTime + 1000); // 1s tail
    
    this.playbackTimeouts.push(finalTimeoutId);
  }
  
  stopPlayback() {
    this.isPlayingRecording = false;
    this.playbackTimeouts.forEach(clearTimeout);
    this.playbackTimeouts = [];
    this.allNotesOff();
    
    if (this.onRecordingStateChange) {
      this.onRecordingStateChange('idle');
    }
  }
  
  // Save recorded events to LocalStorage
  saveRecording(trackName) {
    if (this.recordedEvents.length === 0) return false;
    
    const savedTracks = JSON.parse(localStorage.getItem('aura-piano-tracks') || '[]');
    const newTrack = {
      id: 'track_' + Date.now(),
      name: trackName || `Session ${new Date().toLocaleTimeString()}`,
      events: this.recordedEvents,
      date: new Date().toLocaleDateString(),
      duration: this.recordedEvents[this.recordedEvents.length - 1].time
    };
    
    savedTracks.push(newTrack);
    localStorage.setItem('aura-piano-tracks', JSON.stringify(savedTracks));
    return newTrack;
  }
  
  loadSavedRecording(trackId) {
    const savedTracks = JSON.parse(localStorage.getItem('aura-piano-tracks') || '[]');
    const track = savedTracks.find(t => t.id === trackId);
    if (track) {
      this.recordedEvents = track.events;
      return true;
    }
    return false;
  }
  
  deleteSavedRecording(trackId) {
    let savedTracks = JSON.parse(localStorage.getItem('aura-piano-tracks') || '[]');
    savedTracks = savedTracks.filter(t => t.id !== trackId);
    localStorage.setItem('aura-piano-tracks', JSON.stringify(savedTracks));
  }
  
  getSavedTracks() {
    return JSON.parse(localStorage.getItem('aura-piano-tracks') || '[]');
  }
}

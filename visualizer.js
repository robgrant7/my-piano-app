// Aura Piano - Canvas Visualizer & Particle Engine (Beach Themed)
class PianoVisualizer {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.audioEngine = audioEngine;
    
    this.animationFrameId = null;
    this.particles = [];
    this.activeNoteWaves = {}; // Keeps track of waves rising from keys currently held
    
    // Waveform visualization settings
    this.showWaveform = true;
    
    // Song Practice Mode visual variables
    this.practiceMode = false;
    this.currentSongNotes = [];
    this.songElapsedTime = 0;
    this.songSpeed = 1.0;
    this.fallingSpeedFactor = 0.15; // Pixels per ms
    
    // Beach Theme color palettes (RGB strings)
    this.colors = {
      teal: '13, 148, 136',     // Tropical teal
      skyBlue: '2, 132, 199',   // Ocean sky blue
      sandGold: '245, 158, 11',  // Sand gold
      coral: '225, 29, 72',     // Coral red
      white: '255, 255, 255'
    };
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    
    this.width = rect.width;
    this.height = rect.height;
  }

  start() {
    if (this.animationFrameId) return;
    
    const loop = () => {
      this.render();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    
    this.animationFrameId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  // Find X coordinate of a physical piano key in the DOM
  getKeyVisualPosition(noteName) {
    const keyElement = document.querySelector(`.key[data-note="${noteName}"]`);
    if (!keyElement) return null;
    
    const keyRect = keyElement.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();
    
    // Position relative to canvas
    const left = keyRect.left - canvasRect.left;
    const width = keyRect.width;
    const center = left + (width / 2);
    
    return { left, width, center };
  }

  // Triggered when a note is played
  triggerNoteOn(noteName) {
    const keyPos = this.getKeyVisualPosition(noteName);
    if (!keyPos) return;

    // Create a continuous wave anchor for this note
    const isBlack = noteName.includes('#');
    const colorStr = isBlack ? this.colors.sandGold : this.colors.teal;
    
    this.activeNoteWaves[noteName] = {
      x: keyPos.center,
      width: keyPos.width,
      color: colorStr,
      intensity: 1.0
    };

    // Spawn initial particle burst (translucent beach bubbles!)
    const particleCount = 10;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: keyPos.center + (Math.random() - 0.5) * (keyPos.width * 0.7),
        y: this.height - 10,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -Math.random() * 2.5 - 1.0,
        radius: Math.random() * 5 + 3, // Slightly larger bubbles
        color: Math.random() > 0.5 ? this.colors.skyBlue : this.colors.teal,
        alpha: 0.9,
        decay: Math.random() * 0.015 + 0.008
      });
    }
  }

  // Triggered when a note is released
  triggerNoteOff(noteName) {
    if (this.activeNoteWaves[noteName]) {
      this.activeNoteWaves[noteName].decaying = true;
    }
  }

  // Main Render Loop
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // 1. Draw Beach Sky/Seafoam Background Gradient
    const bgGrad = this.ctx.createLinearGradient(0, 0, 0, this.height);
    bgGrad.addColorStop(0, '#e0f2fe'); // Light sky blue
    bgGrad.addColorStop(0.5, '#bae6fd'); // Tropical turquoise
    bgGrad.addColorStop(1, '#fef3c7'); // Warm sand bottom
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // 2. Draw Falling Notes (Practice Mode / Song Tutorial) or Sheet Music
    if (this.currentView === 'sheet') {
      this.drawSheetMusic();
    } else if (this.practiceMode && this.currentSongNotes.length > 0) {
      this.drawFallingNotes();
    }

    // 3. Draw Real-time waveform / frequencies (rolling ocean waves)
    if (this.showWaveform && this.audioEngine.analyser) {
      this.drawWaveform();
    }
    
    // 4. Update and Draw Active Note Waves (water column ripples rising from keys)
    this.drawNoteWaves();

    // 5. Update and Draw Bubbles Particles
    this.drawParticles();
  }

  drawNoteWaves() {
    Object.keys(this.activeNoteWaves).forEach(noteName => {
      const wave = this.activeNoteWaves[noteName];
      
      this.ctx.save();
      
      // Draw glowing gradient wave column rising up from key
      const pillarGrad = this.ctx.createLinearGradient(wave.x, this.height, wave.x, 0);
      pillarGrad.addColorStop(0, `rgba(${wave.color}, ${wave.intensity * 0.4})`);
      pillarGrad.addColorStop(0.4, `rgba(${wave.color}, ${wave.intensity * 0.15})`);
      pillarGrad.addColorStop(1, `rgba(${wave.color}, 0)`);
      
      this.ctx.fillStyle = pillarGrad;
      this.ctx.fillRect(wave.x - wave.width / 2, 0, wave.width, this.height);
      
      // Draw a bright water crest line right at the bottom
      this.ctx.strokeStyle = `rgba(${wave.color}, ${wave.intensity})`;
      this.ctx.lineWidth = 3.5;
      this.ctx.beginPath();
      this.ctx.moveTo(wave.x - wave.width / 2, this.height - 2);
      this.ctx.lineTo(wave.x + wave.width / 2, this.height - 2);
      this.ctx.stroke();
      
      this.ctx.restore();

      // Handle decays
      if (wave.decaying) {
        wave.intensity -= 0.08;
        if (wave.intensity <= 0) {
          delete this.activeNoteWaves[noteName];
        }
      } else {
        wave.intensity = 0.85 + Math.sin(Date.now() * 0.015) * 0.15;
        
        // Occasionally spawn extra floating bubbles while key is held
        if (Math.random() < 0.2) {
          this.particles.push({
            x: wave.x + (Math.random() - 0.5) * (wave.width * 0.6),
            y: this.height - 12,
            vx: (Math.random() - 0.5) * 0.6,
            vy: -Math.random() * 1.5 - 0.8,
            radius: Math.random() * 4 + 2,
            color: wave.color,
            alpha: 0.8,
            decay: Math.random() * 0.02 + 0.01
          });
        }
      }
    });
  }

  drawParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      
      // Floaty bubble sine drift physics
      p.x += p.vx + Math.sin(Date.now() * 0.005 + p.y * 0.02) * 0.5;
      p.y += p.vy;
      p.alpha -= p.decay;
      
      if (p.alpha <= 0 || p.y < 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      
      // Draw hollow sea bubble with stroke and specular highlight reflection
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(${p.color}, ${p.alpha})`;
      this.ctx.lineWidth = 1.8;
      this.ctx.stroke();
      
      // Specular highlight spot (makes it look like shiny beach water glass)
      this.ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.65})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x - p.radius * 0.35, p.y - p.radius * 0.35, p.radius * 0.22, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
    }
  }

  // Draw two overlapping rolling ocean waves
  drawWaveform() {
    const useMic = this.audioEngine.isListeningMic && this.audioEngine.micAnalyser;
    const analyser = useMic ? this.audioEngine.micAnalyser : this.audioEngine.analyser;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);
    
    this.ctx.save();
    
    // Wave 1: Teal Ocean Crest
    this.ctx.beginPath();
    let sliceWidth = this.width / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const phase = Math.sin(Date.now() * 0.003 + i * 0.05) * 6; // Rolling offset
      const y = (this.height - 70) + (v - 1.0) * 40 + phase;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    this.ctx.lineTo(this.width, this.height);
    this.ctx.lineTo(0, this.height);
    this.ctx.fillStyle = 'rgba(13, 148, 136, 0.22)';
    this.ctx.fill();
    
    // Wave 2: Sky Blue Ocean Undercurrent
    this.ctx.beginPath();
    x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const phase = Math.sin(Date.now() * 0.002 + i * 0.04 + Math.PI/2) * 8;
      const y = (this.height - 55) + (v - 1.0) * 35 + phase;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }
    this.ctx.lineTo(this.width, this.height);
    this.ctx.lineTo(0, this.height);
    this.ctx.fillStyle = 'rgba(2, 132, 199, 0.18)';
    this.ctx.fill();
    
    this.ctx.restore();
  }

  // Draw capsule/bubble shape falling notes
  drawFallingNotes() {
    const elapsed = this.songElapsedTime;
    const speed = this.fallingSpeedFactor;
    
    this.ctx.save();
    
    this.currentSongNotes.forEach(note => {
      const timeToStart = note.start - elapsed;
      const duration = note.duration;
      
      const noteHeight = duration * speed;
      const yBottom = this.height - (timeToStart * speed);
      const yTop = yBottom - noteHeight;
      
      if (yBottom < 0 || yTop > this.height) {
        return;
      }
      
      const keyPos = this.getKeyVisualPosition(note.note);
      if (!keyPos) return;
      
      const isBlack = note.note.includes('#');
      const baseColor = isBlack ? this.colors.sandGold : this.colors.teal;
      
      this.ctx.beginPath();
      
      const radius = 6;
      const x = keyPos.left + 3;
      const w = keyPos.width - 6;
      const h = Math.max(noteHeight, 12);
      
      const drawY = Math.max(yTop, 0);
      const drawH = yBottom - drawY;
      
      if (drawH > 0) {
        // Linear gradient representing sunny sea glass
        const barGrad = this.ctx.createLinearGradient(x, drawY, x, drawY + drawH);
        const isActive = elapsed >= note.start && elapsed <= (note.start + note.duration);
        
        if (isActive) {
          // Glow and white hot crest when hitting boundary
          barGrad.addColorStop(0, '#ffffff');
          barGrad.addColorStop(1, `rgba(${baseColor}, 0.9)`);
          
          this.ctx.shadowBlur = 15;
          this.ctx.shadowColor = `rgba(${baseColor}, 0.8)`;
          
          const keyEl = document.querySelector(`.key[data-note="${note.note}"]`);
          if (keyEl && !keyEl.classList.contains('highlight')) {
            keyEl.classList.add('highlight');
          }
        } else {
          // Standard transparent water pill look
          barGrad.addColorStop(0, `rgba(${baseColor}, 0.75)`);
          barGrad.addColorStop(1, `rgba(${this.colors.skyBlue}, 0.4)`);
          this.ctx.shadowBlur = 4;
          this.ctx.shadowColor = `rgba(${baseColor}, 0.25)`;
          
          const keyEl = document.querySelector(`.key[data-note="${note.note}"]`);
          if (keyEl && keyEl.classList.contains('highlight')) {
            keyEl.classList.remove('highlight');
          }
        }
        
        // Draw capsules (rounded rectangle)
        this.ctx.beginPath();
        this.ctx.roundRect(x, drawY, w, drawH, radius);
        this.ctx.fillStyle = barGrad;
        this.ctx.fill();
        this.ctx.strokeStyle = `rgba(${baseColor}, 0.75)`;
        this.ctx.lineWidth = 1.5;
        this.ctx.stroke();
        
        // Specular reflection line along the left edge of the bubble pill
        if (drawH > 10) {
          this.ctx.beginPath();
          this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          this.ctx.lineWidth = 2;
          this.ctx.lineCap = 'round';
          this.ctx.moveTo(x + 3, drawY + 6);
          this.ctx.lineTo(x + 3, drawY + drawH - 6);
          this.ctx.stroke();
        }
      }
    });
    
    this.ctx.restore();
  }

  // --- SHEET MUSIC RENDERING ENGINE ---

  drawStaff(centerY, lineSpacing) {
    this.ctx.save();
    
    // Draw beachy staff background (sea glass panel)
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.roundRect(15, centerY - 65, this.width - 30, 130, 12);
    this.ctx.fill();
    this.ctx.stroke();

    // 5 Staff lines
    this.ctx.strokeStyle = 'rgba(94, 111, 122, 0.35)';
    this.ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) {
      const lineY = centerY + i * lineSpacing;
      this.ctx.beginPath();
      this.ctx.moveTo(30, lineY);
      this.ctx.lineTo(this.width - 30, lineY);
      this.ctx.stroke();
    }
    
    // Draw vertical bar lines at start and end of staff
    this.ctx.strokeStyle = 'rgba(94, 111, 122, 0.5)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(35, centerY - 2 * lineSpacing);
    this.ctx.lineTo(35, centerY + 2 * lineSpacing);
    this.ctx.moveTo(this.width - 35, centerY - 2 * lineSpacing);
    this.ctx.lineTo(this.width - 35, centerY + 2 * lineSpacing);
    this.ctx.stroke();
    
    this.ctx.restore();
  }

  drawTrebleClef(x, y, lineSpacing) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Vertical stem of the clef
    const topY = y - 2.8 * lineSpacing;
    const botY = y + 2.8 * lineSpacing;
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.lineTo(x, botY);
    ctx.stroke();
    
    // Bottom curl/dot of the stem
    ctx.beginPath();
    ctx.arc(x - 3, botY, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(2, 132, 199, 0.95)';
    ctx.fill();
    
    // Upper loop of the G-clef
    ctx.beginPath();
    ctx.moveTo(x, topY);
    ctx.bezierCurveTo(x + 12, topY, x + 16, y - lineSpacing, x, y - 0.5 * lineSpacing);
    // Spiral loop wrapping around the G4 line (second line from bottom)
    ctx.bezierCurveTo(x - 16, y, x - 18, y + 1.5 * lineSpacing, x - 6, y + 1.8 * lineSpacing);
    ctx.bezierCurveTo(x + 4, y + 2.0 * lineSpacing, x + 12, y + 1.2 * lineSpacing, x + 10, y + 0.3 * lineSpacing);
    ctx.bezierCurveTo(x + 8, y - 0.4 * lineSpacing, x, y - 0.4 * lineSpacing, x, y + 0.2 * lineSpacing);
    ctx.bezierCurveTo(x, y + 0.6 * lineSpacing, x + 4, y + 0.6 * lineSpacing, x + 4, y + 0.2 * lineSpacing);
    ctx.stroke();
    
    ctx.restore();
  }

  drawSheetNote(x, y, isSharp, isActive, label, isPast = false) {
    const ctx = this.ctx;
    ctx.save();
    
    let noteColor = 'rgba(2, 132, 199, 0.95)'; // Sky blue
    let stemColor = 'rgba(44, 53, 57, 0.7)';
    
    if (isActive) {
      noteColor = 'rgba(245, 158, 11, 1.0)'; // Sand gold
      stemColor = 'rgba(245, 158, 11, 0.9)';
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(245, 158, 11, 0.8)';
    } else if (isPast) {
      noteColor = 'rgba(94, 111, 122, 0.35)'; // Faded gray
      stemColor = 'rgba(94, 111, 122, 0.25)';
    }
    
    // Draw Accidental (Sharp) if necessary
    if (isSharp) {
      ctx.fillStyle = noteColor;
      ctx.font = 'bold 15px var(--font-sans)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText('♯', x - 9, y);
    }
    
    // Draw Tilted Note Head
    ctx.fillStyle = noteColor;
    ctx.beginPath();
    ctx.ellipse(x, y, 7, 5, -Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw stem (if not too high/low out of bounds)
    ctx.beginPath();
    ctx.strokeStyle = stemColor;
    ctx.lineWidth = 1.8;
    const stemHeight = 28;
    if (y > this.height / 2) {
      // Stem goes UP on right
      ctx.moveTo(x + 6, y - 2);
      ctx.lineTo(x + 6, y - stemHeight);
    } else {
      // Stem goes DOWN on left
      ctx.moveTo(x - 6, y + 2);
      ctx.lineTo(x - 6, y + stemHeight);
    }
    ctx.stroke();
    
    // Draw helper label inside note head
    if (label) {
      ctx.fillStyle = isActive ? '#ffffff' : 'rgba(44, 53, 57, 0.8)';
      if (isPast) ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'bold 8px var(--font-sans)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Strip octave number for simple representation
      ctx.fillText(label.substring(0, label.includes('#') ? 2 : 1), x, y);
    }
    
    ctx.restore();
  }

  drawLedgerLines(x, y, stepOffset, centerY, lineSpacing) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(94, 111, 122, 0.6)';
    ctx.lineWidth = 1.5;
    
    if (stepOffset <= -4) {
      // Below staff (E4 is offset -2). Ledger lines are even offsets: -4, -6, -8...
      for (let s = -4; s >= stepOffset; s -= 2) {
        const lineY = centerY - s * (lineSpacing / 2);
        ctx.beginPath();
        ctx.moveTo(x - 12, lineY);
        ctx.lineTo(x + 12, lineY);
        ctx.stroke();
      }
    } else if (stepOffset >= 8) {
      // Above staff (F5 is offset 6). Ledger lines are even offsets: 8, 10, 12...
      for (let s = 8; s <= stepOffset; s += 2) {
        const lineY = centerY - s * (lineSpacing / 2);
        ctx.beginPath();
        ctx.moveTo(x - 12, lineY);
        ctx.lineTo(x + 12, lineY);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  drawSheetMusic() {
    const centerY = this.height / 2;
    const lineSpacing = 12;
    
    // 1. Draw Staff lines
    this.drawStaff(centerY, lineSpacing);
    
    // 2. Draw Clef
    this.drawTrebleClef(50, centerY, lineSpacing);
    
    // Diatonic step calculation helper
    const scaleSteps = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    const getDiatonicOffset = (midi) => {
      const diatonicStep = Math.floor(midi / 12) * 7 + scaleSteps[midi % 12];
      return diatonicStep - 39; // Offset from G4 (MIDI 67)
    };
    
    const isNoteSharp = (midi) => {
      return [1, 3, 6, 8, 10].includes(midi % 12);
    };
    
    const midiToNoteName = (midi) => {
      const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const octave = Math.floor(midi / 12) - 1;
      return notes[midi % 12] + octave;
    };
    
    // 3. Draw vertical playhead line
    const playheadX = 140;
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(225, 29, 72, 0.45)'; // Coral red
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([4, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(playheadX, centerY - 45);
    this.ctx.lineTo(playheadX, centerY + 45);
    this.ctx.stroke();
    this.ctx.restore();
    
    // 4. Draw Scrolling Notes
    if (this.practiceMode && this.currentSongNotes.length > 0) {
      const elapsed = this.songElapsedTime;
      const speedFactor = 0.15; // pixels per ms
      
      this.currentSongNotes.forEach(note => {
        const noteX = playheadX + (note.start - elapsed) * speedFactor;
        
        // Skip if off screen
        if (noteX < 75 || noteX > this.width - 25) return;
        
        const stepOffset = getDiatonicOffset(note.midi);
        const noteY = centerY - stepOffset * (lineSpacing / 2);
        
        const isSharp = isNoteSharp(note.midi);
        const isActive = elapsed >= note.start && elapsed <= (note.start + note.duration);
        const isPast = elapsed > (note.start + note.duration);
        
        // Draw ledger lines
        this.drawLedgerLines(noteX, noteY, stepOffset, centerY, lineSpacing);
        
        // Draw note head, stem and label
        const noteLabel = midiToNoteName(note.midi);
        this.drawSheetNote(noteX, noteY, isSharp, isActive, noteLabel, isPast);
      });
    } else {
      // Free Play Mode: render the active voices on the staff!
      const activeNotes = Object.keys(this.audioEngine.activeVoices);
      if (activeNotes.length > 0) {
        activeNotes.forEach((noteName, idx) => {
          const noteToMidi = (name) => {
            const map = { 'C':0, 'C#':1, 'D':2, 'D#':3, 'E':4, 'F':5, 'F#':6, 'G':7, 'G#':8, 'A':9, 'A#':10, 'B':11 };
            const matches = name.match(/^([A-G]#?)(\d)$/);
            if (!matches) return 60;
            return map[matches[1]] + (parseInt(matches[2]) + 1) * 12;
          };
          
          const midi = noteToMidi(noteName);
          const stepOffset = getDiatonicOffset(midi);
          const noteY = centerY - stepOffset * (lineSpacing / 2);
          const isSharp = isNoteSharp(midi);
          const noteX = playheadX + idx * 30; // Space out chord notes
          
          this.drawLedgerLines(noteX, noteY, stepOffset, centerY, lineSpacing);
          this.drawSheetNote(noteX, noteY, isSharp, true, noteName, false);
        });
      } else {
        // Display user hint
        this.ctx.fillStyle = 'rgba(94, 111, 122, 0.65)';
        this.ctx.font = 'italic 12px var(--font-sans)';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Play keys to see notes on the staff 🎶', this.width / 2, centerY + 45);
      }
    }
  }
}

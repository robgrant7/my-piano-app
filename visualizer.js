// Aura Piano - Canvas Visualizer & Particle Engine
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
    
    // Colors based on key note frequencies
    this.colors = {
      purple: '168, 85, 247',
      indigo: '99, 102, 241',
      cyan: '6, 182, 212',
      accent: '0, 242, 254'
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
    const colorStr = isBlack ? this.colors.purple : this.colors.cyan;
    
    this.activeNoteWaves[noteName] = {
      x: keyPos.center,
      width: keyPos.width,
      color: colorStr,
      intensity: 1.0
    };

    // Spawn initial particle burst
    const particleCount = 12;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: keyPos.center + (Math.random() - 0.5) * (keyPos.width * 0.7),
        y: this.height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 3 - 1.5,
        radius: Math.random() * 4 + 2,
        color: Math.random() > 0.5 ? this.colors.indigo : colorStr,
        alpha: 1.0,
        decay: Math.random() * 0.015 + 0.01
      });
    }
  }

  // Triggered when a note is released
  triggerNoteOff(noteName) {
    if (this.activeNoteWaves[noteName]) {
      // Allow active note waves to decay instead of instant disappearance
      this.activeNoteWaves[noteName].decaying = true;
    }
  }

  // Main Render Loop
  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // 1. Draw Background Gradient
    const bgGrad = this.ctx.createRadialGradient(
      this.width / 2, this.height / 2, 10,
      this.width / 2, this.height / 2, this.width
    );
    bgGrad.addColorStop(0, '#0a0c14');
    bgGrad.addColorStop(1, '#030406');
    this.ctx.fillStyle = bgGrad;
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // 2. Draw Falling Notes (Practice Mode / Song Tutorial)
    if (this.practiceMode && this.currentSongNotes.length > 0) {
      this.drawFallingNotes();
    }

    // 3. Draw Real-time waveform / frequencies
    if (this.showWaveform && this.audioEngine.analyser) {
      this.drawWaveform();
    }
    
    // 4. Update and Draw Active Note Waves (glowing pillars rising from keys)
    this.drawNoteWaves();

    // 5. Update and Draw Particles
    this.drawParticles();
  }

  drawNoteWaves() {
    Object.keys(this.activeNoteWaves).forEach(noteName => {
      const wave = this.activeNoteWaves[noteName];
      
      this.ctx.save();
      
      // Draw glowing gradient pillar rising up from key
      const pillarGrad = this.ctx.createLinearGradient(wave.x, this.height, wave.x, 0);
      pillarGrad.addColorStop(0, `rgba(${wave.color}, ${wave.intensity * 0.35})`);
      pillarGrad.addColorStop(0.3, `rgba(${wave.color}, ${wave.intensity * 0.15})`);
      pillarGrad.addColorStop(1, `rgba(${wave.color}, 0)`);
      
      this.ctx.fillStyle = pillarGrad;
      this.ctx.fillRect(wave.x - wave.width / 2, 0, wave.width, this.height);
      
      // Draw a bright line right at the bottom
      this.ctx.strokeStyle = `rgba(${wave.color}, ${wave.intensity})`;
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.moveTo(wave.x - wave.width / 2, this.height - 1.5);
      this.ctx.lineTo(wave.x + wave.width / 2, this.height - 1.5);
      this.ctx.stroke();
      
      this.ctx.restore();

      // Handle decays
      if (wave.decaying) {
        wave.intensity -= 0.08;
        if (wave.intensity <= 0) {
          delete this.activeNoteWaves[noteName];
        }
      } else {
        // Subtle ripple / pulse while note is held
        wave.intensity = 0.85 + Math.sin(Date.now() * 0.015) * 0.15;
        
        // Occasionally spawn extra particles while key is held
        if (Math.random() < 0.15) {
          this.particles.push({
            x: wave.x + (Math.random() - 0.5) * (wave.width * 0.6),
            y: this.height - 5,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -Math.random() * 2 - 1,
            radius: Math.random() * 3 + 1,
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
      
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;
      
      if (p.alpha <= 0 || p.y < 0) {
        this.particles.splice(i, 1);
        continue;
      }
      
      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      
      // Glow effect for particles
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = `rgba(${p.color}, ${p.alpha})`;
      
      this.ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      
      this.ctx.restore();
    }
  }

  drawWaveform() {
    const useMic = this.audioEngine.isListeningMic && this.audioEngine.micAnalyser;
    const analyser = useMic ? this.audioEngine.micAnalyser : this.audioEngine.analyser;
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // We can show frequency (bars) or time domain (waveform).
    // Let's draw a beautiful smooth glowing time domain waveform line.
    analyser.getByteTimeDomainData(dataArray);
    
    this.ctx.save();
    this.ctx.strokeStyle = useMic ? 'rgba(6, 182, 212, 0.55)' : 'rgba(99, 102, 241, 0.45)';
    this.ctx.lineWidth = 2.5;
    this.ctx.shadowBlur = 10;
    this.ctx.shadowColor = useMic ? 'rgba(6, 182, 212, 0.6)' : 'rgba(99, 102, 241, 0.6)';
    
    // Create fill gradient under waveform
    const fillGrad = this.ctx.createLinearGradient(0, this.height, 0, this.height - 120);
    if (useMic) {
      fillGrad.addColorStop(0, 'rgba(6, 182, 212, 0)');
      fillGrad.addColorStop(1, 'rgba(6, 182, 212, 0.06)');
    } else {
      fillGrad.addColorStop(0, 'rgba(168, 85, 247, 0)');
      fillGrad.addColorStop(1, 'rgba(99, 102, 241, 0.06)');
    }
    
    this.ctx.beginPath();
    
    const sliceWidth = this.width / bufferLength;
    let x = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0; // 0 to 2
      // Draw centered around the bottom area (e.g. height - 60px)
      const y = (this.height - 60) + (v - 1.0) * 45;
      
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    this.ctx.lineTo(this.width, this.height - 60);
    this.ctx.stroke();
    
    // Close path to draw the translucent fill
    this.ctx.lineTo(this.width, this.height);
    this.ctx.lineTo(0, this.height);
    this.ctx.fillStyle = fillGrad;
    this.ctx.fill();
    
    this.ctx.restore();
  }

  // Practice Mode: Draw blocks falling from top of screen representing piano keys
  drawFallingNotes() {
    const elapsed = this.songElapsedTime;
    const speed = this.fallingSpeedFactor;
    
    this.ctx.save();
    
    this.currentSongNotes.forEach(note => {
      // Calculate Y coordinate based on note.start compared to current elapsed time
      // A note starts falling before its start time
      const timeToStart = note.start - elapsed;
      const duration = note.duration;
      
      // Calculate vertical position
      // Y center or top
      const noteHeight = duration * speed;
      const yBottom = this.height - (timeToStart * speed);
      const yTop = yBottom - noteHeight;
      
      // If it hasn't reached the screen, or has fully passed, skip
      if (yBottom < 0 || yTop > this.height) {
        return;
      }
      
      // Get physical key X position
      const keyPos = this.getKeyVisualPosition(note.note);
      if (!keyPos) return;
      
      const isBlack = note.note.includes('#');
      const baseColor = isBlack ? this.colors.purple : this.colors.cyan;
      
      // Draw falling bar
      this.ctx.beginPath();
      
      // Soft rounded rectangles for notes
      const radius = 5;
      const x = keyPos.left + 2;
      const w = keyPos.width - 4;
      const h = Math.max(noteHeight, 10); // Minimum height so it's visible
      
      // Clip rendering y bounds
      const drawY = Math.max(yTop, 0);
      const drawH = yBottom - drawY;
      
      if (drawH > 0) {
        // Draw card/bar with gradient and glow
        const barGrad = this.ctx.createLinearGradient(x, drawY, x, drawY + drawH);
        
        // Highlight active notes that are currently hitting the bottom key
        const isActive = elapsed >= note.start && elapsed <= (note.start + note.duration);
        
        if (isActive) {
          barGrad.addColorStop(0, `rgba(255, 255, 255, 0.9)`);
          barGrad.addColorStop(1, `rgba(${baseColor}, 0.9)`);
          
          this.ctx.shadowBlur = 15;
          this.ctx.shadowColor = `rgba(${baseColor}, 0.8)`;
          
          // Flash key highlight
          const keyEl = document.querySelector(`.key[data-note="${note.note}"]`);
          if (keyEl && !keyEl.classList.contains('highlight')) {
            keyEl.classList.add('highlight');
          }
        } else {
          barGrad.addColorStop(0, `rgba(${baseColor}, 0.7)`);
          barGrad.addColorStop(1, `rgba(${this.colors.indigo}, 0.4)`);
          this.ctx.shadowBlur = 4;
          this.ctx.shadowColor = `rgba(${baseColor}, 0.3)`;
          
          const keyEl = document.querySelector(`.key[data-note="${note.note}"]`);
          if (keyEl && keyEl.classList.contains('highlight')) {
            keyEl.classList.remove('highlight');
          }
        }
        
        this.ctx.fillStyle = barGrad;
        
        // Rounded rectangle draw
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = radius;
        this.ctx.strokeStyle = barGrad;
        this.ctx.strokeRect(x + radius/2, drawY + radius/2, w - radius, drawH - radius);
        this.ctx.fillRect(x + radius/2, drawY + radius/2, w - radius, drawH - radius);
      }
    });
    
    this.ctx.restore();
  }
}

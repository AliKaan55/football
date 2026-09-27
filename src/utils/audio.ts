/**
 * Audio synthesis engine using Web Audio API
 * Generates thrilling sound effects for the 3-second shuffle and task completions
 * No external audio files required — 100% reliable offline and cross-platform.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Check initial mute state from localStorage
    try {
      const saved = localStorage.getItem('football_task_sound_muted');
      this.isMuted = saved === 'true';
    } catch {
      this.isMuted = false;
    }
  }

  public get muted(): boolean {
    return this.isMuted;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    try {
      localStorage.setItem('football_task_sound_muted', muted ? 'true' : 'false');
    } catch {
      // ignore
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  private getContext(): AudioContext | null {
    if (this.isMuted) return null;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Plays the 3-second thrilling shuffle sound effect:
   * 1. Rapid accelerating spinning ticks
   * 2. Stadium drone swell / bass rumble
   * 3. 5 card slot snap thuds
   * 4. Final referee whistle + triumphant celebration chord
   */
  public playExcitingShuffleSound(): () => void {
    if (this.isMuted) return () => {};
    const ctx = this.getContext();
    if (!ctx) return () => {};

    const now = ctx.currentTime;
    let isCancelled = false;

    // Trigger haptic vibration if supported (mobile)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([40, 60, 40, 60, 50, 100, 200]);
      } catch {
        // ignore
      }
    }

    // 1. Bass drone building tension over 3 seconds
    const droneOsc = ctx.createOscillator();
    const droneGain = ctx.createGain();
    droneOsc.type = 'triangle';
    droneOsc.frequency.setValueAtTime(65, now);
    droneOsc.frequency.exponentialRampToValueAtTime(130, now + 2.8);

    droneGain.gain.setValueAtTime(0.01, now);
    droneGain.gain.linearRampToValueAtTime(0.12, now + 2.0);
    droneGain.gain.linearRampToValueAtTime(0.2, now + 2.8);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 3.1);

    droneOsc.connect(droneGain);
    droneGain.connect(ctx.destination);
    droneOsc.start(now);
    droneOsc.stop(now + 3.2);

    // 2. Accelerating roulette / card flipper clicks
    const totalClicks = 28;
    for (let i = 0; i < totalClicks; i++) {
      // Progressively spaced clicks from 0 to 2.8s
      const progress = i / totalClicks;
      // Exponential pacing curve
      const clickTime = now + 2.7 * Math.pow(progress, 1.25);

      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();

      clickOsc.type = i % 2 === 0 ? 'sine' : 'triangle';
      // Pitch rises from 300Hz to 850Hz as it builds suspense
      const pitch = 350 + progress * 500 + (i % 3) * 40;
      clickOsc.frequency.setValueAtTime(pitch, clickTime);

      clickGain.gain.setValueAtTime(0.08 + progress * 0.08, clickTime);
      clickGain.gain.exponentialRampToValueAtTime(0.001, clickTime + 0.05);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(clickTime);
      clickOsc.stop(clickTime + 0.06);
    }

    // 3. Staggered card lock-in hits for each slot (around 2.2s to 2.8s)
    const lockTimes = [2.1, 2.3, 2.5, 2.7, 2.9];
    lockTimes.forEach((lt, idx) => {
      const lockTime = now + lt;
      const lockOsc = ctx.createOscillator();
      const lockGain = ctx.createGain();

      lockOsc.type = 'sine';
      lockOsc.frequency.setValueAtTime(440 + idx * 80, lockTime);
      lockOsc.frequency.exponentialRampToValueAtTime(220, lockTime + 0.12);

      lockGain.gain.setValueAtTime(0.15, lockTime);
      lockGain.gain.exponentialRampToValueAtTime(0.001, lockTime + 0.12);

      lockOsc.connect(lockGain);
      lockGain.connect(ctx.destination);
      lockOsc.start(lockTime);
      lockOsc.stop(lockTime + 0.13);
    });

    // 4. Climax at ~3.0s: Referee Whistle sound + Triumphant Fanfare chord
    const finaleTime = now + 3.0;

    // Referee Whistle (dual high-frequency trill)
    const whistle1 = ctx.createOscillator();
    const whistle2 = ctx.createOscillator();
    const whistleGain = ctx.createGain();
    whistle1.type = 'sine';
    whistle2.type = 'sine';
    whistle1.frequency.setValueAtTime(2600, finaleTime);
    whistle2.frequency.setValueAtTime(2650, finaleTime);

    // Whistle modulation (flutter)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.setValueAtTime(28, finaleTime);
    lfoGain.gain.setValueAtTime(60, finaleTime);
    lfo.connect(whistle1.frequency);
    lfo.connect(whistle2.frequency);

    whistleGain.gain.setValueAtTime(0.01, finaleTime);
    whistleGain.gain.linearRampToValueAtTime(0.18, finaleTime + 0.04);
    whistleGain.gain.exponentialRampToValueAtTime(0.001, finaleTime + 0.45);

    lfo.start(finaleTime);
    lfo.stop(finaleTime + 0.46);
    whistle1.connect(whistleGain);
    whistle2.connect(whistleGain);
    whistleGain.connect(ctx.destination);
    whistle1.start(finaleTime);
    whistle2.start(finaleTime);
    whistle1.stop(finaleTime + 0.46);
    whistle2.stop(finaleTime + 0.46);

    // Victory fanfare notes: C5, E5, G5, C6
    const chordNotes = [523.25, 659.25, 783.99, 1046.5];
    chordNotes.forEach((freq, idx) => {
      const noteOsc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      noteOsc.type = 'triangle';
      noteOsc.frequency.setValueAtTime(freq, finaleTime + 0.1 + idx * 0.05);

      noteGain.gain.setValueAtTime(0.12, finaleTime + 0.1 + idx * 0.05);
      noteGain.gain.exponentialRampToValueAtTime(0.001, finaleTime + 1.2);

      noteOsc.connect(noteGain);
      noteGain.connect(ctx.destination);
      noteOsc.start(finaleTime + 0.1 + idx * 0.05);
      noteOsc.stop(finaleTime + 1.25);
    });

    // Cleanup callback if user navigates away
    return () => {
      if (!isCancelled) {
        isCancelled = true;
        try {
          droneOsc.stop();
        } catch {
          // ignore
        }
      }
    };
  }

  /**
   * Sound effect when a task is completed (Goal / celebration chime)
   */
  public playTaskCompletedSound() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([40, 30, 80]);
      } catch {
        // ignore
      }
    }

    const now = ctx.currentTime;
    const notes = [587.33, 739.99, 880.0]; // D5, F#5, A5 (Bright major chime)

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);

      gain.gain.setValueAtTime(0.12, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.45);
    });
  }

  /**
   * Subtle click when pressing buttons
   */
  public playClickSound() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Urgent countdown tick for the final 5 seconds
   */
  public playCountdownTick(isFinalWarning: boolean = false) {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isFinalWarning ? 'sawtooth' : 'sine';
    const freq = isFinalWarning ? 880 : 520;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.8, now + 0.08);

    gain.gain.setValueAtTime(isFinalWarning ? 0.12 : 0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Time-out buzzer sound when round timer expires
   */
  public playTimeUpBuzzer() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.linearRampToValueAtTime(110, now + 0.45);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.52);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([150, 80, 150]);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Joker used chime
   */
  public playJokerUsedSound() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [440, 554.37, 659.25, 880]; // A4, C#5, E5, A5
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.08, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.3);
    });
  }
}

export const soundEngine = new SoundEngine();

export class AudioController {
  constructor(model, { volume = 0.35 } = {}) {
    this.context = null;
    this.setVolume(volume);
    this.unsubscribers = [
      model.on("pieceMoved", ({ dy }) => this.beep(dy > 0 ? 280 : 220, 0.025)),
      model.on("hardDropped", () => this.beep(110, 0.075)),
      model.on("pieceRotated", () => this.beep(330, 0.03)),
      model.on("pieceHeld", () => this.beep(440, 0.04)),
      model.on("pieceLocked", () => this.beep(150, 0.04)),
      model.on("linesCleared", ({ count }) => this.beep(300 + count * 100, 0.12)),
      model.on("gameOver", () => this.beep(90, 0.25)),
      model.on("paused", ({ paused }) => this.beep(paused ? 180 : 360, 0.06)),
    ];
  }

  setVolume(value) {
    const numeric = Number(value);
    this.volume = Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : 0;
  }

  ensureContext() {
    if (this.context) return this.context;
    const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      this.context = new AudioContextClass();
    } catch {
      return null;
    }
    return this.context;
  }

  beep(frequency, duration) {
    if (this.volume === 0) return;
    const context = this.ensureContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.frequency.value = frequency;
    oscillator.type = "square";
    gain.gain.setValueAtTime(this.volume * 0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }

  destroy() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.context?.close?.();
  }
}

export const HIGH_SCORE_KEY = "falling-block-mvp.high-score";

export class HighScoreStorage {
  constructor(storage) {
    if (arguments.length > 0) {
      this.storage = storage;
      return;
    }
    try {
      this.storage = globalThis.localStorage ?? null;
    } catch {
      this.storage = null;
    }
  }

  read() {
    if (!this.storage) return 0;
    try {
      const value = Number(this.storage.getItem(HIGH_SCORE_KEY));
      return Number.isFinite(value) && value >= 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  record(score) {
    const current = this.read();
    if (score <= current) return current;
    try {
      this.storage?.setItem(HIGH_SCORE_KEY, String(score));
    } catch {
      return score;
    }
    return score;
  }
}

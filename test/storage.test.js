import assert from "node:assert/strict";
import test from "node:test";
import { HIGH_SCORE_KEY, HighScoreStorage } from "../src/storage.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, String(value));
  }
}

test("high score storage keeps only the highest score and tolerates invalid data", () => {
  const storage = new MemoryStorage();
  const highScore = new HighScoreStorage(storage);
  assert.equal(highScore.read(), 0);
  assert.equal(highScore.record(120), 120);
  assert.equal(storage.getItem(HIGH_SCORE_KEY), "120");
  assert.equal(highScore.record(80), 120);
  storage.setItem(HIGH_SCORE_KEY, "not-a-number");
  assert.equal(highScore.read(), 0);
});

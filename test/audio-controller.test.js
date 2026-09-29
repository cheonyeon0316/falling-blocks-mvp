import assert from "node:assert/strict";
import test from "node:test";
import { AudioController } from "../src/audio-controller.js";
import { GameModel } from "../src/game-model.js";

test("move, soft drop, hard drop, and lock each send one distinct sound event", () => {
  const model = new GameModel({ seed: 401 });
  const audio = new AudioController(model);
  const frequencies = [];
  audio.beep = (frequency) => frequencies.push(frequency);
  assert.equal(model.moveLeft(), true);
  assert.equal(model.softDrop().movedCells, 1);
  model.hardDrop();
  assert.deepEqual(frequencies, [220, 280, 110, 150]);
  audio.setVolume(2);
  assert.equal(audio.volume, 1);
  audio.setVolume(-1);
  assert.equal(audio.volume, 0);
  audio.destroy();
});

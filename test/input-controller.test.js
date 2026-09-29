import assert from "node:assert/strict";
import test from "node:test";
import { GameModel } from "../src/game-model.js";
import { InputController } from "../src/input-controller.js";
import { createPiece } from "../src/pieces.js";

class FakeTarget {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(name, listener) {
    this.listeners.set(name, listener);
  }

  removeEventListener(name) {
    this.listeners.delete(name);
  }

  fire(name, event) {
    this.listeners.get(name)?.(event);
  }
}

function keyEvent(key, { repeat = false, code } = {}) {
  return {
    key,
    code: code ?? "",
    repeat,
    preventDefault() {
      this.prevented = true;
    },
  };
}

test("left/right input moves immediately, uses DAS/ARR, and last direction wins", () => {
  const model = new GameModel({ seed: 21 });
  const target = new FakeTarget();
  const input = new InputController(model, target);
  const startX = model.active.anchorX;

  target.fire("keydown", keyEvent("ArrowLeft"));
  assert.equal(model.active.anchorX, startX - 1);
  target.fire("keydown", keyEvent("ArrowRight"));
  assert.equal(model.active.anchorX, startX);
  target.fire("keydown", keyEvent("ArrowRight", { repeat: true }));
  assert.equal(model.active.anchorX, startX);

  input.update(100);
  assert.equal(model.active.anchorX, startX);
  input.update(50);
  assert.equal(model.active.anchorX, startX + 1);
  input.update(40);
  assert.equal(model.active.anchorX, startX + 2);

  target.fire("keyup", keyEvent("ArrowRight"));
  assert.equal(input.activeHorizontal, "left");
  assert.equal(model.active.anchorX, startX + 1);
  input.destroy();
});

test("soft drop repeats on controller timing and ignores OS key repeat", () => {
  const model = new GameModel({ seed: 22 });
  const target = new FakeTarget();
  const input = new InputController(model, target);
  const startY = model.active.anchorY;

  target.fire("keydown", keyEvent("ArrowDown"));
  assert.equal(model.active.anchorY, startY + 1);
  target.fire("keydown", keyEvent("ArrowDown", { repeat: true }));
  assert.equal(model.active.anchorY, startY + 1);
  input.update(40);
  assert.equal(model.active.anchorY, startY + 2);
  target.fire("keyup", keyEvent("ArrowDown"));
  input.destroy();
});

test("rotation, hold, hard drop, pause, and restart ignore repeated keydown", () => {
  const model = new GameModel({ seed: 23 });
  const target = new FakeTarget();
  const input = new InputController(model, target);

  target.fire("keydown", keyEvent("x"));
  const rotation = model.active.rotation;
  target.fire("keydown", keyEvent("x", { repeat: true }));
  assert.equal(model.active.rotation, rotation);

  target.fire("keydown", keyEvent("c"));
  assert.equal(model.holdUsedThisTurn, true);
  target.fire("keydown", keyEvent("c", { repeat: true }));
  assert.equal(model.holdUsedThisTurn, true);

  target.fire("keydown", keyEvent("p"));
  assert.equal(model.phase, "PAUSED");
  target.fire("keydown", keyEvent("p", { repeat: true }));
  assert.equal(model.phase, "PAUSED");

  target.fire("keydown", keyEvent("r"));
  assert.equal(model.phase, "FALLING");
  assert.equal(model.score, 0);
  input.destroy();
});

test("pause freezes DAS and ignores new movement until resumed", () => {
  const model = new GameModel({ seed: 24 });
  model.loadActiveForTest(createPiece("O", 0, 4, 5));
  const target = new FakeTarget();
  const input = new InputController(model, target);
  target.fire("keydown", keyEvent("ArrowRight"));
  input.update(100);
  const x = model.active.anchorX;
  target.fire("keydown", keyEvent("p"));
  input.update(100);
  target.fire("keydown", keyEvent("ArrowLeft"));
  assert.equal(model.active.anchorX, x);
  assert.equal(input.dasElapsedMs, 100);
  target.fire("keyup", keyEvent("p"));
  target.fire("keydown", keyEvent("p"));
  input.update(49);
  assert.equal(model.active.anchorX, x);
  input.update(1);
  assert.equal(model.active.anchorX, x + 1);
  input.destroy();
});

test("multiple keys for one direction do not cause a stuck or duplicate move", () => {
  const model = new GameModel({ seed: 25 });
  model.loadActiveForTest(createPiece("O", 0, 4, 5));
  const target = new FakeTarget();
  const input = new InputController(model, target);
  target.fire("keydown", keyEvent("a", { code: "KeyA" }));
  const x = model.active.anchorX;
  target.fire("keydown", keyEvent("ArrowLeft"));
  assert.equal(model.active.anchorX, x);
  target.fire("keyup", keyEvent("a", { code: "KeyA" }));
  assert.equal(input.pressed.left, true);
  input.update(100);
  input.update(50);
  assert.equal(model.active.anchorX, x - 1);
  target.fire("keyup", keyEvent("ArrowLeft"));
  input.clearPressed();
  assert.equal(input.activeHorizontal, null);
  input.destroy();
});

test("browser key repeats still have their default action suppressed", () => {
  const model = new GameModel({ seed: 26 });
  const target = new FakeTarget();
  const input = new InputController(model, target);
  const repeated = keyEvent(" ", { repeat: true, code: "Space" });
  target.fire("keydown", repeated);
  assert.equal(repeated.prevented, true);
  input.destroy();
});

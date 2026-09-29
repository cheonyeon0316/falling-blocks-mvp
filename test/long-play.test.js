import assert from "node:assert/strict";
import test from "node:test";
import { BOARD_HEIGHT, BOARD_WIDTH, PIECE_TYPES } from "../src/constants.js";
import { GameModel } from "../src/game-model.js";

test("twenty-minute deterministic play simulation keeps the loop valid", () => {
  const model = new GameModel({ seed: 20260922 });
  let restarts = 0;
  const frames = 20 * 60 * 60;
  for (let frame = 0; frame < frames; frame += 1) {
    if (model.phase === "FALLING") {
      if (frame % 47 === 0) model.hardDrop();
      else if (frame % 19 === 0) model.rotateCW();
      else if (frame % 13 === 0) model.rotateCCW();
      else if (frame % 7 === 0) model.moveLeft();
      else if (frame % 11 === 0) model.moveRight();
      else if (frame % 3 === 0) model.softDrop();
    }
    model.update(1000 / 60);
    if (model.phase === "GAME_OVER") {
      restarts += 1;
      model.restart(20260922 + restarts);
    }

    assert.equal(model.board.length, BOARD_HEIGHT);
    assert.ok(model.board.every((row) => row.length === BOARD_WIDTH));
    assert.ok(model.board.flat().every((cell) => cell === null || PIECE_TYPES.includes(cell)));
    assert.ok(model.queue.length >= 5);
    assert.ok(model.queue.every((type) => PIECE_TYPES.includes(type)));
    assert.ok(Number.isFinite(model.score));
  }
  assert.ok(restarts > 0);
});

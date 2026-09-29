import assert from "node:assert/strict";
import test from "node:test";
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  LOCK_DELAY_MS,
  MAX_LOCK_RESETS,
  PIECE_TYPES,
  gravityIntervalMs,
} from "../src/constants.js";
import { createEmptyBoard, GameModel } from "../src/game-model.js";
import { createPiece, pieceCells } from "../src/pieces.js";
import { SevenBagRandomizer } from "../src/randomizer.js";

function boardWithRows(rows = {}) {
  const board = createEmptyBoard();
  for (const [yString, values] of Object.entries(rows)) {
    const y = Number(yString);
    for (const [xString, value] of Object.entries(values)) board[y][Number(xString)] = value;
  }
  return board;
}

function fillRowExcept(y, missingX, type = "J") {
  const row = Array(BOARD_WIDTH).fill(type);
  row[missingX] = null;
  return row;
}

test("creates a 22x10 board and spawns a valid first piece", () => {
  const model = new GameModel({ seed: 42 });
  assert.equal(model.board.length, BOARD_HEIGHT);
  assert.ok(model.board.every((row) => row.length === BOARD_WIDTH && row.every((cell) => cell === null)));
  assert.equal(model.phase, "FALLING");
  assert.ok(PIECE_TYPES.includes(model.active.type));
  assert.equal(model.queue.length >= 5, true);
});

test("same seed produces the same seven-bag sequence and each bag has every type", () => {
  const first = new SevenBagRandomizer(1234);
  const second = new SevenBagRandomizer(1234);
  const firstSequence = [];
  const secondSequence = [];
  for (let index = 0; index < 21; index += 1) {
    firstSequence.push(first.next());
    secondSequence.push(second.next());
  }
  assert.deepEqual(firstSequence, secondSequence);
  for (let offset = 0; offset < firstSequence.length; offset += 7) {
    assert.deepEqual([...firstSequence.slice(offset, offset + 7)].sort(), [...PIECE_TYPES].sort());
  }
});

test("movement respects walls, floor, locked cells, and ghost does not mutate the board", () => {
  const model = new GameModel({ seed: 1 });
  model.loadActiveForTest(createPiece("O", 0, 0, 20));
  assert.equal(model.moveLeft(), false);
  assert.equal(model.moveRight(), true);
  assert.equal(model.softDrop().movedCells, 0);
  const before = model.getState();
  const ghost = model.ghostPiece();
  assert.equal(ghost.anchorY, 20);
  assert.deepEqual(model.board, before.board);
  model.loadBoardForTest(boardWithRows({ 21: { 4: "T" } }));
  model.loadActiveForTest(createPiece("O", 0, 3, 19));
  assert.equal(model.moveRight(), true);
  assert.equal(model.softDrop().movedCells, 0);
});

test("hard drop locks immediately and awards two points per dropped cell", () => {
  const model = new GameModel({ seed: 2 });
  const startY = model.active.anchorY;
  const initialType = model.active.type;
  const expectedDrop = model.ghostPiece().anchorY - startY;
  const result = model.hardDrop();
  assert.equal(result.locked, true);
  assert.equal(result.droppedCells, expectedDrop);
  assert.equal(model.score, result.droppedCells * 2);
  assert.equal(model.phase, "FALLING");
  assert.equal(model.board.flat().filter((cell) => cell === initialType).length, 4);
});

test("hard drop emits one distinct event even when the piece cannot fall", () => {
  const model = new GameModel({ seed: 200 });
  model.loadActiveForTest(createPiece("O", 0, 4, 20));
  let drops = 0;
  let locks = 0;
  model.on("hardDropped", () => { drops += 1; });
  model.on("pieceLocked", () => { locks += 1; });
  assert.deepEqual(model.hardDrop(), { droppedCells: 0, locked: true });
  assert.equal(drops, 1);
  assert.equal(locks, 1);
});

test("soft drop scores only successful cells and never locks by itself", () => {
  const model = new GameModel({ seed: 3 });
  let moved = 0;
  for (let index = 0; index < 30; index += 1) moved += model.softDrop().movedCells;
  assert.equal(model.score, moved);
  assert.equal(model.phase, "FALLING");
  assert.equal(model.active !== null, true);
});

test("hold can be used once per turn and resets after the next piece locks", () => {
  const model = new GameModel({ seed: 4 });
  const current = model.active.type;
  const next = model.queue[0];
  assert.equal(model.holdPiece(), true);
  assert.equal(model.hold, current);
  assert.equal(model.active.type, next);
  const heldAfterFirstUse = model.hold;
  assert.equal(model.holdPiece(), false);
  model.hardDrop();
  assert.equal(model.holdUsedThisTurn, false);
  assert.equal(model.hold, heldAfterFirstUse);
});

test("rotation failure leaves piece and lock timer unchanged, while O ignores rotation", () => {
  const model = new GameModel({ seed: 5 });
  const blockers = boardWithRows({
    0: { 3: "J", 4: "J", 5: "J", 6: "J", 7: "J" },
    1: { 3: "J", 4: "J", 5: "J", 6: "J", 7: "J" },
    2: { 3: "J", 4: "J", 5: "J", 6: "J", 7: "J" },
  });
  model.loadBoardForTest(blockers);
  model.loadActiveForTest(createPiece("T", 0, 3, 0));
  model.lockElapsedMs = 123;
  const before = model.getState();
  assert.equal(model.rotateCW(), false);
  assert.deepEqual(model.active, before.active);
  assert.equal(model.lockElapsedMs, 123);

  model.loadBoardForTest(createEmptyBoard());
  model.loadActiveForTest(createPiece("O", 0, 4, 0));
  model.lockElapsedMs = 77;
  assert.equal(model.rotateCW(), false);
  assert.deepEqual(model.active, createPiece("O", 0, 4, 0));
  assert.equal(model.lockElapsedMs, 77);
});

test("SRS wall kick moves a J piece using the first valid candidate", () => {
  const model = new GameModel({ seed: 6 });
  model.loadBoardForTest(createEmptyBoard());
  model.loadActiveForTest(createPiece("J", 0, 8, 5));
  assert.equal(model.rotateCW(), true);
  assert.equal(model.active.rotation, 1);
  assert.equal(model.active.anchorX, 7);
  assert.equal(model.active.anchorY, 5);
});

test("I uses its dedicated kick table and O does not move on rotation", () => {
  const model = new GameModel({ seed: 7 });
  model.loadBoardForTest(createEmptyBoard());
  model.loadActiveForTest(createPiece("I", 0, 8, 5));
  assert.equal(model.rotateCW(), true);
  assert.equal(model.active.rotation, 1);
  assert.equal(model.active.anchorX, 6);

  model.loadActiveForTest(createPiece("O", 0, 4, 5));
  assert.equal(model.rotateCCW(), false);
  assert.deepEqual(model.active, createPiece("O", 0, 4, 5));
});

test("one to four complete lines are removed once and rows above preserve order", () => {
  for (let count = 1; count <= 4; count += 1) {
    const model = new GameModel({ seed: 8 });
    const board = createEmptyBoard();
    for (let row = BOARD_HEIGHT - count; row < BOARD_HEIGHT; row += 1) board[row] = Array(BOARD_WIDTH).fill("Z");
    board[BOARD_HEIGHT - count - 1][0] = "T";
    model.loadBoardForTest(board);
    model.loadActiveForTest(createPiece("I", 0, 3, 0));
    model.lockPiece("test");
    assert.equal(model.phase, "LINE_CLEAR");
    model.update(100);
    model.update(50);
    assert.equal(model.lines, count);
    assert.equal(model.board[BOARD_HEIGHT - 1][0], "T");
    assert.equal(model.board.filter((row) => row.every((cell) => cell !== null)).length, 0);
  }
});

test("score, combo, level, and gravity match the specification", () => {
  const model = new GameModel({ seed: 9 });
  const board = createEmptyBoard();
  board[21] = fillRowExcept(21, 3);
  model.loadBoardForTest(board);
  model.loadActiveForTest(createPiece("I", 0, 3, 20));
  model.lockPiece("test");
  model.update(100);
  model.update(50);
  assert.equal(model.score, 100);
  assert.equal(model.lines, 1);
  assert.equal(model.combo, 0);
  assert.equal(model.level, 1);
  assert.equal(gravityIntervalMs(1), 1000);
  assert.equal(gravityIntervalMs(2), 850);
});

test("timer locking is frame-rate independent and capped at fifteen resets", () => {
  const run = (fps) => {
    const model = new GameModel({ seed: 10 });
    model.loadActiveForTest(createPiece("O", 0, 4, 20));
    let locks = 0;
    model.on("pieceLocked", () => { locks += 1; });
    let elapsed = 0;
    const frames = fps / 2;
    for (let frame = 1; frame <= frames; frame += 1) {
      const next = Math.round(frame * LOCK_DELAY_MS / frames);
      model.update(next - elapsed);
      elapsed = next;
      if (frame < frames) assert.equal(locks, 0);
    }
    assert.equal(locks, 1);
  };
  run(30);
  run(60);
  run(120);

  const model = new GameModel({ seed: 11 });
  model.loadActiveForTest(createPiece("O", 0, 4, 20));
  for (let index = 0; index < MAX_LOCK_RESETS; index += 1) {
    assert.equal(index % 2 === 0 ? model.moveLeft() : model.moveRight(), true);
  }
  assert.equal(model.lockResetCount, MAX_LOCK_RESETS);
  model.lockElapsedMs = LOCK_DELAY_MS - 100;
  assert.equal(model.moveRight(), true);
  assert.equal(model.lockResetCount, MAX_LOCK_RESETS);
  assert.equal(model.lockElapsedMs, LOCK_DELAY_MS - 100);
  let locks = 0;
  model.on("pieceLocked", () => { locks += 1; });
  model.update(100);
  assert.equal(locks, 1);
});

test("hidden-row occupancy and spawn collision cause game over", () => {
  const model = new GameModel({ seed: 12 });
  const board = createEmptyBoard();
  board[0][0] = "I";
  model.loadBoardForTest(board);
  model.loadActiveForTest(createPiece("O", 0, 4, 20));
  model.lockPiece("test");
  assert.equal(model.phase, "GAME_OVER");

  const collisionModel = new GameModel({ seed: 13 });
  const collisionBoard = createEmptyBoard();
  for (const cell of pieceCells(collisionModel.active)) collisionBoard[cell.y][cell.x] = "Z";
  collisionModel.loadBoardForTest(collisionBoard);
  assert.equal(collisionModel.spawnPiece("T", true), false);
  assert.equal(collisionModel.phase, "GAME_OVER");
});

test("pause freezes gravity, lock, and input-relevant timers", () => {
  const model = new GameModel({ seed: 14 });
  model.loadActiveForTest(createPiece("O", 0, 4, 20));
  assert.equal(model.togglePause(), true);
  const before = model.getState();
  model.update(1000);
  assert.deepEqual(model.getState(), { ...before });
  assert.equal(model.moveLeft(), false);
  assert.equal(model.togglePause(), true);
  assert.equal(model.moveLeft(), true);
});

test("line-clear phase blocks ordinary input for the 150ms effect", () => {
  const model = new GameModel({ seed: 15 });
  const board = createEmptyBoard();
  board[21] = fillRowExcept(21, 3);
  model.loadBoardForTest(board);
  model.loadActiveForTest(createPiece("I", 0, 3, 20));
  model.lockPiece("test");
  assert.equal(model.phase, "LINE_CLEAR");
  assert.equal(model.moveLeft(), false);
  assert.equal(model.hardDrop().locked, false);
  assert.equal(model.togglePause(), true);
  const pausedLineClearElapsed = model.lineClearElapsedMs;
  model.update(100);
  assert.equal(model.phase, "PAUSED");
  assert.equal(model.lineClearElapsedMs, pausedLineClearElapsed);
  assert.equal(model.togglePause(), true);
  assert.equal(model.phase, "LINE_CLEAR");
  model.update(100);
  assert.equal(model.phase, "LINE_CLEAR");
  model.update(50);
  assert.equal(model.phase, "FALLING");
});

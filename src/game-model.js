import {
  ARR_MS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  HIDDEN_ROWS,
  INITIAL_LEVEL,
  kickCandidates,
  LINE_CLEAR_DURATION_MS,
  LOCK_DELAY_MS,
  MAX_DELTA_MS,
  MAX_LOCK_RESETS,
  PIECE_TYPES,
  gravityIntervalMs,
} from "./constants.js";
import { clonePiece, createPiece, pieceCells, rotatePiece } from "./pieces.js";
import { SevenBagRandomizer } from "./randomizer.js";

const LINE_SCORES = [0, 100, 300, 500, 800];

export function createEmptyBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function clampDelta(deltaMs) {
  return Math.max(0, Math.min(Number(deltaMs) || 0, MAX_DELTA_MS));
}

export class GameModel {
  constructor({ seed = Date.now(), randomizer } = {}) {
    this.listeners = new Map();
    this.randomizer = randomizer ?? new SevenBagRandomizer(seed);
    this.restart(seed);
  }

  on(eventName, listener) {
    if (!this.listeners.has(eventName)) this.listeners.set(eventName, new Set());
    this.listeners.get(eventName).add(listener);
    return () => this.listeners.get(eventName)?.delete(listener);
  }

  emit(eventName, payload) {
    for (const listener of this.listeners.get(eventName) ?? []) listener(payload);
  }

  notify(eventName, payload) {
    this.emit(eventName, payload);
    this.emit("stateChanged", this.getState());
  }

  getState() {
    return {
      board: cloneBoard(this.board),
      active: clonePiece(this.active),
      queue: [...this.queue],
      hold: this.hold,
      holdUsedThisTurn: this.holdUsedThisTurn,
      score: this.score,
      lines: this.lines,
      level: this.level,
      combo: this.combo,
      phase: this.phase,
      gravityElapsedMs: this.gravityElapsedMs,
      lockElapsedMs: this.lockElapsedMs,
      lockResetCount: this.lockResetCount,
      lineClearElapsedMs: this.lineClearElapsedMs,
      lineClearRows: [...this.lineClearRows],
      resumePhase: this.resumePhase,
    };
  }

  restart(seed = Date.now()) {
    this.randomizer.reset(seed);
    this.queue = this.randomizer.queue;
    this.board = createEmptyBoard();
    this.active = null;
    this.hold = null;
    this.holdUsedThisTurn = false;
    this.score = 0;
    this.lines = 0;
    this.level = INITIAL_LEVEL;
    this.combo = -1;
    this.phase = "READY";
    this.gravityElapsedMs = 0;
    this.lockElapsedMs = 0;
    this.lockResetCount = 0;
    this.lineClearElapsedMs = 0;
    this.lineClearRows = [];
    this.resumePhase = null;
    this.notify("restarted", { seed });
    this.spawnNext(true);
  }

  nextPiece() {
    const type = this.randomizer.next();
    this.queue = this.randomizer.queue;
    return type;
  }

  spawnNext(resetHoldUsage = true) {
    return this.spawnPiece(this.nextPiece(), resetHoldUsage);
  }

  spawnPiece(type, resetHoldUsage) {
    const piece = createPiece(type);
    this.phase = "SPAWN";
    this.active = piece;
    if (resetHoldUsage) this.holdUsedThisTurn = false;
    this.notify("spawnPhase", { piece: clonePiece(piece) });

    if (!this.canPlace(piece)) {
      this.active = null;
      this.phase = "GAME_OVER";
      this.notify("gameOver", { reason: "spawn_collision" });
      return false;
    }

    this.phase = "FALLING";
    this.gravityElapsedMs = 0;
    this.lockElapsedMs = 0;
    this.lockResetCount = 0;
    this.notify("pieceSpawned", { piece: clonePiece(piece) });
    return true;
  }

  canPlace(piece, board = this.board) {
    if (!piece) return false;
    for (const { x, y } of pieceCells(piece)) {
      if (x < 0 || x >= BOARD_WIDTH || y < 0 || y >= BOARD_HEIGHT) return false;
      if (board[y][x] !== null) return false;
    }
    return true;
  }

  tryMove(dx, dy) {
    if (!this.active) return false;
    const candidate = { ...this.active, anchorX: this.active.anchorX + dx, anchorY: this.active.anchorY + dy };
    if (!this.canPlace(candidate)) return false;
    this.active = candidate;
    return true;
  }

  isGrounded(piece = this.active) {
    if (!piece) return false;
    return !this.canPlace({ ...piece, anchorY: piece.anchorY + 1 });
  }

  resetLockAfterAction(wasGrounded) {
    const nowGrounded = this.isGrounded();
    if ((wasGrounded || nowGrounded) && this.lockResetCount < MAX_LOCK_RESETS) {
      this.lockElapsedMs = 0;
      this.lockResetCount += 1;
    }
  }

  moveLeft() {
    return this.moveHorizontal(-1);
  }

  moveRight() {
    return this.moveHorizontal(1);
  }

  moveHorizontal(dx) {
    if (this.phase !== "FALLING" || !this.active) return false;
    const wasGrounded = this.isGrounded();
    const moved = this.tryMove(dx, 0);
    if (!moved) return false;
    this.resetLockAfterAction(wasGrounded);
    this.notify("pieceMoved", { dx, dy: 0, piece: clonePiece(this.active) });
    return true;
  }

  softDrop() {
    if (this.phase !== "FALLING" || !this.active) return { movedCells: 0 };
    if (!this.tryMove(0, 1)) return { movedCells: 0 };
    this.score += 1;
    this.notify("pieceMoved", { dx: 0, dy: 1, piece: clonePiece(this.active) });
    this.notify("scoreChanged", { score: this.score });
    return { movedCells: 1 };
  }

  hardDrop() {
    if (this.phase !== "FALLING" || !this.active) return { droppedCells: 0, locked: false };
    let droppedCells = 0;
    while (this.tryMove(0, 1)) droppedCells += 1;
    if (droppedCells > 0) {
      this.score += droppedCells * 2;
      this.notify("scoreChanged", { score: this.score });
    }
    this.notify("hardDropped", { droppedCells, piece: clonePiece(this.active) });
    this.lockPiece("hard_drop");
    return { droppedCells, locked: true };
  }

  rotateCW() {
    return this.rotate("CW");
  }

  rotateCCW() {
    return this.rotate("CCW");
  }

  rotate(direction) {
    if (this.phase !== "FALLING" || !this.active || this.active.type === "O") return false;
    const wasGrounded = this.isGrounded();
    const target = rotatePiece(this.active, direction);
    for (const [dx, dyUp] of kickCandidates(this.active.type, this.active.rotation, target.rotation)) {
      const candidate = {
        ...target,
        anchorX: target.anchorX + dx,
        anchorY: target.anchorY - dyUp,
      };
      if (this.canPlace(candidate)) {
        this.active = candidate;
        this.resetLockAfterAction(wasGrounded);
        this.notify("pieceRotated", { direction, piece: clonePiece(this.active), kick: [dx, dyUp] });
        return true;
      }
    }
    return false;
  }

  holdPiece() {
    if (this.phase !== "FALLING" || !this.active || this.holdUsedThisTurn) return false;
    const currentType = this.active.type;
    this.holdUsedThisTurn = true;
    if (this.hold === null) {
      this.hold = currentType;
      this.spawnNext(false);
    } else {
      const heldType = this.hold;
      this.hold = currentType;
      this.spawnPiece(heldType, false);
    }
    this.notify("pieceHeld", { hold: this.hold });
    return true;
  }

  togglePause() {
    if (this.phase === "FALLING" || this.phase === "LINE_CLEAR") {
      this.resumePhase = this.phase;
      this.phase = "PAUSED";
      this.notify("paused", { paused: true });
      return true;
    }
    if (this.phase === "PAUSED") {
      this.phase = this.resumePhase ?? "FALLING";
      this.resumePhase = null;
      this.notify("paused", { paused: false });
      return true;
    }
    return false;
  }

  update(deltaMs) {
    const dt = clampDelta(deltaMs);
    if (this.phase === "PAUSED" || this.phase === "GAME_OVER" || this.phase === "READY" || this.phase === "SPAWN") return;

    if (this.phase === "LINE_CLEAR") {
      this.lineClearElapsedMs += dt;
      if (this.lineClearElapsedMs >= LINE_CLEAR_DURATION_MS) this.resolveLineClear();
      return;
    }

    if (this.phase !== "FALLING") return;

    this.gravityElapsedMs += dt;
    const interval = gravityIntervalMs(this.level);
    let movedByGravity = false;
    while (this.gravityElapsedMs >= interval) {
      this.gravityElapsedMs -= interval;
      movedByGravity = this.tryMove(0, 1) || movedByGravity;
    }
    if (movedByGravity) this.emit("stateChanged", this.getState());
    if (!this.isGrounded()) {
      this.lockElapsedMs = 0;
      return;
    }
    this.lockElapsedMs += dt;
    if (this.lockElapsedMs >= LOCK_DELAY_MS) this.lockPiece("timer");
  }

  lockPiece(reason = "timer") {
    if (this.phase !== "FALLING" || !this.active) return false;
    const lockedPiece = clonePiece(this.active);
    for (const { x, y } of pieceCells(lockedPiece)) {
      if (y >= 0 && y < BOARD_HEIGHT && x >= 0 && x < BOARD_WIDTH) this.board[y][x] = lockedPiece.type;
    }
    this.active = null;
    const fullRows = [];
    for (let y = 0; y < BOARD_HEIGHT; y += 1) {
      if (this.board[y].every((cell) => cell !== null)) fullRows.push(y);
    }
    this.notify("pieceLocked", { piece: lockedPiece, reason });

    if (fullRows.length === 0) {
      this.combo = -1;
      if (this.hasHiddenCells()) return this.setGameOver("hidden_row_occupied");
      this.spawnNext(true);
      return true;
    }

    this.lineClearRows = fullRows;
    this.lineClearElapsedMs = 0;
    this.phase = "LINE_CLEAR";
    this.notify("linesClearing", { rows: [...fullRows] });
    return true;
  }

  resolveLineClear() {
    if (this.phase !== "LINE_CLEAR") return false;
    const rowsToRemove = new Set(this.lineClearRows);
    const remaining = this.board.filter((_, index) => !rowsToRemove.has(index));
    this.board = [
      ...Array.from({ length: rowsToRemove.size }, () => Array(BOARD_WIDTH).fill(null)),
      ...remaining,
    ];

    const count = rowsToRemove.size;
    const levelAtLock = this.level;
    this.score += LINE_SCORES[count] * levelAtLock;
    this.combo += 1;
    this.score += 50 * this.combo * levelAtLock;
    this.lines += count;
    this.level = 1 + Math.floor(this.lines / 10);
    this.lineClearRows = [];
    this.lineClearElapsedMs = 0;
    this.notify("linesCleared", { count, rows: [...rowsToRemove] });
    this.notify("scoreChanged", { score: this.score });
    this.notify("levelChanged", { level: this.level });

    if (this.hasHiddenCells()) return this.setGameOver("hidden_row_occupied");
    this.spawnNext(true);
    return true;
  }

  hasHiddenCells() {
    return this.board.slice(0, HIDDEN_ROWS).some((row) => row.some((cell) => cell !== null));
  }

  setGameOver(reason) {
    this.active = null;
    this.phase = "GAME_OVER";
    this.notify("gameOver", { reason, score: this.score, lines: this.lines });
    return false;
  }

  ghostPiece() {
    if (!this.active) return null;
    let ghost = { ...this.active };
    while (this.canPlace({ ...ghost, anchorY: ghost.anchorY + 1 })) ghost.anchorY += 1;
    return ghost;
  }

  // Test fixtures use this only to arrange deterministic board states without
  // exposing a mutation API to the renderer or input controller.
  loadBoardForTest(board) {
    if (!Array.isArray(board) || board.length !== BOARD_HEIGHT || board.some((row) => row.length !== BOARD_WIDTH)) {
      throw new Error("Board must be 22x10");
    }
    this.board = cloneBoard(board);
  }

  loadActiveForTest(piece) {
    this.active = clonePiece(piece);
    this.phase = "FALLING";
    this.gravityElapsedMs = 0;
    this.lockElapsedMs = 0;
    this.lockResetCount = 0;
  }
}

export { PIECE_TYPES, ARR_MS };

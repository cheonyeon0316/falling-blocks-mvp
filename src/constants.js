export const PIECE_TYPES = ["I", "J", "L", "O", "S", "T", "Z"];
export const ROTATIONS = [0, 1, 2, 3];

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 22;
export const HIDDEN_ROWS = 2;
export const VISIBLE_ROWS = BOARD_HEIGHT - HIDDEN_ROWS;
export const PREVIEW_COUNT = 5;

export const INITIAL_LEVEL = 1;
export const LOCK_DELAY_MS = 500;
export const MAX_LOCK_RESETS = 15;
export const MAX_DELTA_MS = 100;
export const LINE_CLEAR_DURATION_MS = 150;
export const DAS_MS = 150;
export const ARR_MS = 40;
export const SOFT_DROP_MS = 40;

export const PIECE_COLORS = {
  I: "#22d3ee",
  J: "#3b82f6",
  L: "#f97316",
  O: "#facc15",
  S: "#22c55e",
  T: "#a855f7",
  Z: "#ef4444",
};

export const BASE_SHAPES = {
  I: [
    [0, 1], [1, 1], [2, 1], [3, 1],
  ],
  J: [
    [0, 0], [0, 1], [1, 1], [2, 1],
  ],
  L: [
    [2, 0], [0, 1], [1, 1], [2, 1],
  ],
  O: [
    [0, 0], [1, 0], [0, 1], [1, 1],
  ],
  S: [
    [1, 0], [2, 0], [0, 1], [1, 1],
  ],
  T: [
    [1, 0], [0, 1], [1, 1], [2, 1],
  ],
  Z: [
    [0, 0], [1, 0], [1, 1], [2, 1],
  ],
};

export const SPAWN_ANCHORS = {
  I: { x: 3, y: 0 },
  J: { x: 3, y: 0 },
  L: { x: 3, y: 0 },
  O: { x: 4, y: 0 },
  S: { x: 3, y: 0 },
  T: { x: 3, y: 0 },
  Z: { x: 3, y: 0 },
};

export const GRAVITY_INTERVALS = Object.freeze(
  Array.from({ length: 30 }, (_, index) => Math.max(60, Math.round(1000 * 0.85 ** index))),
);

export function gravityIntervalMs(level) {
  const index = Math.max(0, level - 1);
  return GRAVITY_INTERVALS[index] ?? Math.max(60, Math.round(1000 * 0.85 ** index));
}

// dyUp follows SRS notation. Game coordinates use +y downward, so callers
// convert a kick to anchorY - dyUp.
export const JLSTZ_KICKS = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};

export const I_KICKS = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};

export function kickCandidates(type, from, to) {
  if (type === "O") return [[0, 0]];
  const table = type === "I" ? I_KICKS : JLSTZ_KICKS;
  return table[`${from}>${to}`] ?? [[0, 0]];
}

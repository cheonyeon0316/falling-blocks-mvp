import { BASE_SHAPES, SPAWN_ANCHORS } from "./constants.js";

const rotationCache = new Map();

function boxSize(type) {
  if (type === "I") return 4;
  if (type === "O") return 2;
  return 3;
}

function rotateClockwise(cells, size) {
  return cells.map(([x, y]) => [size - 1 - y, x]);
}

function rotateCounterClockwise(cells, size) {
  return cells.map(([x, y]) => [y, size - 1 - x]);
}

export function localCells(type, rotation = 0) {
  const normalized = ((rotation % 4) + 4) % 4;
  if (type === "O") return BASE_SHAPES[type].map(([x, y]) => [x, y]);

  const key = `${type}:${normalized}`;
  if (rotationCache.has(key)) {
    return rotationCache.get(key).map(([x, y]) => [x, y]);
  }

  const size = boxSize(type);
  let cells = BASE_SHAPES[type].map(([x, y]) => [x, y]);
  for (let index = 0; index < normalized; index += 1) {
    cells = rotateClockwise(cells, size);
  }
  rotationCache.set(key, cells);
  return cells.map(([x, y]) => [x, y]);
}

export function pieceCells(piece) {
  return localCells(piece.type, piece.rotation).map(([x, y]) => ({
    x: piece.anchorX + x,
    y: piece.anchorY + y,
  }));
}

export function createPiece(type, rotation = 0, anchorX, anchorY) {
  const spawn = SPAWN_ANCHORS[type];
  return {
    type,
    rotation: ((rotation % 4) + 4) % 4,
    anchorX: anchorX ?? spawn.x,
    anchorY: anchorY ?? spawn.y,
  };
}

export function rotatePiece(piece, direction) {
  if (piece.type === "O") return { ...piece };
  const step = direction === "CCW" ? 3 : 1;
  return { ...piece, rotation: (piece.rotation + step) % 4 };
}

export function clonePiece(piece) {
  return piece ? { ...piece } : null;
}

export function previewCells(type) {
  const cells = localCells(type, 0);
  const max = type === "I" ? 4 : 3;
  return { cells, size: max };
}

export function clearPieceCacheForTests() {
  rotationCache.clear();
}

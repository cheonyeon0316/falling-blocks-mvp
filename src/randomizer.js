import { PIECE_TYPES } from "./constants.js";

function normalizedSeed(seed) {
  const numeric = Number(seed);
  if (!Number.isFinite(numeric)) return 0x6d2b79f5;
  const value = numeric >>> 0;
  return value === 0 ? 0x6d2b79f5 : value;
}

export class SeededRandom {
  constructor(seed = Date.now()) {
    this.reset(seed);
  }

  reset(seed = Date.now()) {
    this.state = normalizedSeed(seed);
  }

  nextUint32() {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state;
  }

  nextFloat() {
    return this.nextUint32() / 0x100000000;
  }

  nextInt(maxExclusive) {
    return Math.floor(this.nextFloat() * maxExclusive);
  }
}

export class SevenBagRandomizer {
  constructor(seed = Date.now()) {
    this.reset(seed);
  }

  reset(seed = Date.now()) {
    this.seed = seed;
    this.random = new SeededRandom(seed);
    this.queue = [];
    this.fillBag();
    this.fillBag();
  }

  fillBag() {
    const bag = [...PIECE_TYPES];
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const swapIndex = this.random.nextInt(index + 1);
      [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
    }
    this.queue.push(...bag);
  }

  next() {
    if (this.queue.length === 0) this.fillBag();
    const type = this.queue.shift();
    if (this.queue.length <= 7) this.fillBag();
    return type;
  }

  preview(count = 5) {
    while (this.queue.length < count) this.fillBag();
    return this.queue.slice(0, count);
  }
}

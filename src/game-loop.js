export class GameLoop {
  constructor(model, input, target = globalThis) {
    this.model = model;
    this.input = input;
    this.target = target;
    this.running = false;
    this.lastTimestamp = null;
    this.frameId = null;
    this.tick = (timestamp) => {
      if (!this.running) return;
      const delta = this.lastTimestamp === null ? 0 : timestamp - this.lastTimestamp;
      this.lastTimestamp = timestamp;
      this.input.update(delta);
      this.model.update(delta);
      this.frameId = this.target.requestAnimationFrame(this.tick);
    };
  }

  start() {
    if (this.running || typeof this.target.requestAnimationFrame !== "function") return;
    this.running = true;
    this.lastTimestamp = null;
    this.frameId = this.target.requestAnimationFrame(this.tick);
  }

  stop() {
    this.running = false;
    if (this.frameId !== null) this.target.cancelAnimationFrame?.(this.frameId);
    this.frameId = null;
  }
}

import { ARR_MS, DAS_MS, SOFT_DROP_MS } from "./constants.js";

const ACTION_KEYS = new Map([
  ["ArrowLeft", "left"],
  ["a", "left"],
  ["A", "left"],
  ["ArrowRight", "right"],
  ["d", "right"],
  ["D", "right"],
  ["ArrowDown", "softDrop"],
  ["s", "softDrop"],
  ["S", "softDrop"],
  [" ", "hardDrop"],
  ["Spacebar", "hardDrop"],
  ["ArrowUp", "rotateCW"],
  ["x", "rotateCW"],
  ["X", "rotateCW"],
  ["z", "rotateCCW"],
  ["Z", "rotateCCW"],
  ["c", "hold"],
  ["C", "hold"],
  ["Shift", "hold"],
  ["Escape", "pause"],
  ["p", "pause"],
  ["P", "pause"],
  ["r", "restart"],
  ["R", "restart"],
]);

function eventAction(event) {
  if (event.code === "Space") return "hardDrop";
  return ACTION_KEYS.get(event.key);
}

function physicalKey(event) {
  return event.code || (event.key.length === 1 ? event.key.toLowerCase() : event.key);
}

export class InputController {
  constructor(model, target = typeof window === "undefined" ? null : window) {
    this.model = model;
    this.target = target;
    this.heldKeys = new Map();
    this.pressed = { left: false, right: false, softDrop: false };
    this.activeHorizontal = null;
    this.dasElapsedMs = 0;
    this.arrElapsedMs = 0;
    this.softElapsedMs = 0;
    this.boundKeyDown = (event) => this.handleKeyDown(event);
    this.boundKeyUp = (event) => this.handleKeyUp(event);
    this.unsubscribeRestart = model.on("restarted", () => this.clearPressed());
    if (this.target?.addEventListener) {
      this.target.addEventListener("keydown", this.boundKeyDown);
      this.target.addEventListener("keyup", this.boundKeyUp);
    }
  }

  destroy() {
    this.target?.removeEventListener?.("keydown", this.boundKeyDown);
    this.target?.removeEventListener?.("keyup", this.boundKeyUp);
    this.unsubscribeRestart?.();
  }

  clearPressed() {
    this.heldKeys.clear();
    this.pressed = { left: false, right: false, softDrop: false };
    this.resetHorizontal();
    this.softElapsedMs = 0;
  }

  handleKeyDown(event) {
    const action = eventAction(event);
    if (!action) return;
    event.preventDefault?.();
    if (event.repeat || this.heldKeys.has(physicalKey(event))) return;
    if (this.model.phase !== "FALLING" && action !== "pause" && action !== "restart") return;
    this.heldKeys.set(physicalKey(event), action);

    if (action === "left" || action === "right") {
      this.pressed[action] = true;
      if (this.activeHorizontal !== action) this.activateHorizontal(action, true);
      return;
    }
    if (action === "softDrop") {
      if (!this.pressed.softDrop) {
        this.model.softDrop();
        this.softElapsedMs = 0;
      }
      this.pressed.softDrop = true;
      return;
    }
    this.dispatchAction(action);
  }

  handleKeyUp(event) {
    const key = physicalKey(event);
    const action = this.heldKeys.get(key);
    if (!action) return;
    this.heldKeys.delete(key);
    if (action === "left" || action === "right") {
      this.pressed[action] = [...this.heldKeys.values()].includes(action);
      if (this.activeHorizontal === action && !this.pressed[action]) {
        const other = action === "left" ? "right" : "left";
        if (this.pressed[other]) this.activateHorizontal(other, true);
        else this.resetHorizontal();
      }
      event.preventDefault?.();
      return;
    }
    if (action === "softDrop") {
      this.pressed.softDrop = [...this.heldKeys.values()].includes(action);
      if (!this.pressed.softDrop) this.softElapsedMs = 0;
      event.preventDefault?.();
    }
  }

  dispatchAction(action) {
    switch (action) {
      case "hardDrop":
        this.model.hardDrop();
        break;
      case "rotateCW":
        this.model.rotateCW();
        break;
      case "rotateCCW":
        this.model.rotateCCW();
        break;
      case "hold":
        this.model.holdPiece();
        break;
      case "pause":
        this.model.togglePause();
        break;
      case "restart":
        this.model.restart();
        break;
      default:
        break;
    }
  }

  activateHorizontal(direction, immediate) {
    this.activeHorizontal = direction;
    this.dasElapsedMs = 0;
    this.arrElapsedMs = 0;
    if (immediate) this.moveActiveHorizontal();
  }

  resetHorizontal() {
    this.activeHorizontal = null;
    this.dasElapsedMs = 0;
    this.arrElapsedMs = 0;
  }

  moveActiveHorizontal() {
    if (this.activeHorizontal === "left") this.model.moveLeft();
    if (this.activeHorizontal === "right") this.model.moveRight();
  }

  update(deltaMs) {
    if (this.model.phase !== "FALLING") return;
    const dt = Math.max(0, Math.min(Number(deltaMs) || 0, 100));
    if (this.activeHorizontal) {
      if (this.dasElapsedMs < DAS_MS) {
        this.dasElapsedMs += dt;
        if (this.dasElapsedMs >= DAS_MS) {
          this.arrElapsedMs += this.dasElapsedMs - DAS_MS;
          this.moveActiveHorizontal();
        }
      } else {
        this.arrElapsedMs += dt;
      }
      while (this.dasElapsedMs >= DAS_MS && this.arrElapsedMs >= ARR_MS) {
        this.arrElapsedMs -= ARR_MS;
        this.moveActiveHorizontal();
      }
    }

    if (this.pressed.softDrop) {
      this.softElapsedMs += dt;
      while (this.softElapsedMs >= SOFT_DROP_MS) {
        this.softElapsedMs -= SOFT_DROP_MS;
        this.model.softDrop();
      }
    }
  }
}

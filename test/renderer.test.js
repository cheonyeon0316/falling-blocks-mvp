import assert from "node:assert/strict";
import test from "node:test";
import { GameModel } from "../src/game-model.js";
import { createPiece, pieceCells } from "../src/pieces.js";
import { Renderer } from "../src/renderer.js";

class FakeElement {
  constructor() {
    this.children = [];
    this.style = {};
    this.className = "";
    this.dataset = {};
    this.textContent = "";
    this.hidden = false;
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name),
      add: (name) => {
        if (!this.classList.contains(name)) this.className = `${this.className} ${name}`.trim();
      },
      remove: (name) => {
        this.className = this.className.split(/\s+/).filter((part) => part !== name).join(" ");
      },
      toggle: (name, force) => {
        if (force ?? !this.classList.contains(name)) this.classList.add(name);
        else this.classList.remove(name);
      },
    };
  }

  setAttribute() {}

  append(child) {
    child.parentElement = this;
    this.children.push(child);
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    }
  }

  replaceChildren(...children) {
    this.children = children;
  }

  querySelectorAll(selector) {
    const className = selector.slice(1);
    const found = [];
    const visit = (element) => {
      for (const child of element.children) {
        if (child.classList.contains(className)) found.push(child);
        visit(child);
      }
    };
    visit(this);
    return found;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();
    for (const id of [
      "board", "hold-preview", "next-preview", "score", "level", "lines",
      "combo", "high-score", "overlay", "overlay-title", "overlay-detail",
    ]) this.elements.set(`#${id}`, new FakeElement());
    this.elements.get("#overlay").hidden = true;
  }

  querySelector(selector) {
    return this.elements.get(selector) ?? null;
  }

  createElement() {
    return new FakeElement();
  }
}

function previewType(preview) {
  const cells = preview.querySelectorAll(".preview-cell");
  assert.equal(cells.length, 16);
  const painted = cells.filter((cell) => cell.dataset.piece);
  assert.equal(painted.length, 4);
  assert.equal(new Set(painted.map((cell) => cell.dataset.piece)).size, 1);
  return painted[0].dataset.piece;
}

test("Hold and five Next silhouettes stay current after several renders", () => {
  const model = new GameModel({ seed: 301 });
  const documentRef = new FakeDocument();
  const renderer = new Renderer(model, documentRef);
  const next = documentRef.querySelector("#next-preview");
  const previews = next.querySelectorAll(".preview");
  assert.equal(previews.length, 5);
  assert.deepEqual(previews.map(previewType), model.queue.slice(0, 5));

  const firstType = model.active.type;
  assert.equal(model.holdPiece(), true);
  assert.equal(previewType(documentRef.querySelector("#hold-preview").querySelector(".preview")), firstType);
  assert.deepEqual(previews.map(previewType), model.queue.slice(0, 5));

  model.hardDrop();
  assert.deepEqual(previews.map(previewType), model.queue.slice(0, 5));
  assert.equal(documentRef.querySelector("#board").classList.contains("board--hard-drop"), true);
  renderer.destroy();
});

test("gravity updates the visible active cells and game over shows the final result", () => {
  const model = new GameModel({ seed: 302 });
  const documentRef = new FakeDocument();
  const renderer = new Renderer(model, documentRef);
  model.loadActiveForTest(createPiece("O", 0, 4, 5));
  renderer.render(model.getState());
  const before = renderer.boardCells.map((cell, index) => cell.classList.contains("cell--active") ? index : -1).filter((index) => index >= 0);
  for (let frame = 0; frame < 10; frame += 1) model.update(100);
  const after = renderer.boardCells.map((cell, index) => cell.classList.contains("cell--active") ? index : -1).filter((index) => index >= 0);
  assert.notDeepEqual(after, before);
  assert.deepEqual(after, pieceCells(model.active).map(({ x, y }) => (y - 2) * 10 + x).sort((a, b) => a - b));

  model.setGameOver("test");
  assert.equal(documentRef.querySelector("#overlay").hidden, false);
  assert.equal(documentRef.querySelector("#overlay").classList.contains("overlay--game-over"), true);
  assert.match(documentRef.querySelector("#overlay-detail").textContent, /점수 0 · 0줄 삭제/);
  renderer.destroy();
});

test("line clears render one VFX sprite per visible row", () => {
  const model = new GameModel({ seed: 303 });
  const documentRef = new FakeDocument();
  const renderer = new Renderer(model, documentRef);
  model.phase = "LINE_CLEAR";
  model.lineClearRows = [4, 5];
  renderer.render(model.getState());
  const effects = documentRef.querySelector("#board").querySelectorAll(".line-clear-effect");
  assert.equal(effects.length, 2);
  assert.equal(effects[0].style.top, "74px");
  assert.equal(effects[1].style.top, "108px");
  renderer.destroy();
});

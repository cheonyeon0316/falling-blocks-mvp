import {
  BOARD_WIDTH,
  VISIBLE_ROWS,
} from "./constants.js";
import { localCells } from "./pieces.js";

function setPieceClass(element, type, extra = "", baseClass = "cell") {
  element.className = baseClass;
  if (type) {
    element.classList.add("cell--" + type);
    element.dataset.piece = type;
  } else {
    delete element.dataset.piece;
  }
  if (extra) element.classList.add(extra);
}

export class Renderer {
  constructor(model, documentRef = document) {
    this.model = model;
    this.document = documentRef;
    this.boardElement = this.document.querySelector("#board");
    this.holdElement = this.document.querySelector("#hold-preview");
    this.nextElement = this.document.querySelector("#next-preview");
    this.scoreElement = this.document.querySelector("#score");
    this.levelElement = this.document.querySelector("#level");
    this.linesElement = this.document.querySelector("#lines");
    this.comboElement = this.document.querySelector("#combo");
    this.highScoreElement = this.document.querySelector("#high-score");
    this.overlayElement = this.document.querySelector("#overlay");
    this.overlayTitle = this.document.querySelector("#overlay-title");
    this.overlayDetail = this.document.querySelector("#overlay-detail");
    this.boardCells = [];

    this.createBoard();
    this.createPreview(this.holdElement);
    for (let index = 0; index < 5; index += 1) this.createPreview(this.nextElement);
    this.unsubscribe = model.on("stateChanged", (state) => this.render(state));
    this.unsubscribeHardDrop = model.on("hardDropped", () => this.flashHardDrop());
    this.hardDropTimer = null;
    this.render(model.getState());
  }

  createBoard() {
    this.boardElement.replaceChildren();
    for (let index = 0; index < VISIBLE_ROWS * BOARD_WIDTH; index += 1) {
      const cell = this.document.createElement("div");
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      this.boardElement.append(cell);
      this.boardCells.push(cell);
    }
  }

  createPreview(container) {
    const preview = this.document.createElement("div");
    preview.className = "preview";
    preview.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 16; index += 1) {
      const cell = this.document.createElement("div");
      cell.className = "preview-cell";
      preview.append(cell);
    }
    container.append(preview);
  }

  destroy() {
    this.unsubscribe?.();
    this.unsubscribeHardDrop?.();
    if (this.hardDropTimer !== null) clearTimeout(this.hardDropTimer);
  }

  flashHardDrop() {
    if (this.hardDropTimer !== null) clearTimeout(this.hardDropTimer);
    this.boardElement.classList.add("board--hard-drop");
    this.hardDropTimer = setTimeout(() => {
      this.boardElement.classList.remove("board--hard-drop");
      this.hardDropTimer = null;
    }, 80);
  }

  setHighScore(score) {
    if (this.highScoreElement) this.highScoreElement.textContent = String(score).padStart(7, "0");
  }

  render(state) {
    const ghost = this.model.ghostPiece();
    const locked = state.board;
    this.boardElement.classList.toggle("board--danger", locked.slice(2, 6).some((row) => row.some((cell) => cell !== null)));
    for (let y = 0; y < VISIBLE_ROWS; y += 1) {
      for (let x = 0; x < BOARD_WIDTH; x += 1) {
        const index = y * BOARD_WIDTH + x;
        const cell = this.boardCells[index];
        const boardY = y + 2;
        setPieceClass(cell, locked[boardY][x]);
        if (state.phase === "LINE_CLEAR" && state.lineClearRows.includes(boardY)) {
          cell.classList.add("cell--clearing");
        }
      }
    }

    if (ghost) this.paintPiece(ghost, "cell--ghost", true);
    if (state.active) this.paintPiece(state.active, "cell--active", false);

    this.scoreElement.textContent = String(state.score).padStart(7, "0");
    this.levelElement.textContent = String(state.level).padStart(2, "0");
    this.linesElement.textContent = String(state.lines).padStart(3, "0");
    this.comboElement.textContent = state.combo < 0 ? "-" : String(state.combo);
    this.renderHold(state.hold);
    this.renderNext(state.queue.slice(0, 5));
    this.renderOverlay(state);
  }

  paintPiece(piece, extraClass, ghost) {
    for (const local of localCells(piece.type, piece.rotation)) {
      const x = piece.anchorX + local[0];
      const y = piece.anchorY + local[1];
      if (x < 0 || x >= BOARD_WIDTH || y < 2 || y >= 22) continue;
      const cell = this.boardCells[(y - 2) * BOARD_WIDTH + x];
      if (ghost && cell.dataset.piece) continue;
      setPieceClass(cell, piece.type, extraClass);
    }
  }

  paintPreview(preview, type) {
    const cells = preview.querySelectorAll(".preview-cell");
    cells.forEach((cell) => setPieceClass(cell, null, "", "preview-cell"));
    if (!type) return;
    const offset = type === "I" ? 0 : 1;
    for (const local of localCells(type, 0)) {
      const x = local[0] + offset;
      const y = local[1] + 1;
      if (x >= 0 && x < 4 && y >= 0 && y < 4) {
        setPieceClass(cells[y * 4 + x], type, "", "preview-cell");
      }
    }
  }

  renderHold(type) {
    const preview = this.holdElement.querySelector(".preview");
    if (preview) this.paintPreview(preview, type);
  }

  renderNext(queue) {
    const previews = this.nextElement.querySelectorAll(".preview");
    previews.forEach((preview, index) => {
      this.paintPreview(preview, queue[index]);
    });
  }

  renderOverlay(state) {
    if (state.phase === "GAME_OVER") {
      this.overlayElement.hidden = false;
      this.overlayTitle.textContent = "GAME OVER";
      this.overlayDetail.textContent = `점수 ${state.score.toLocaleString()} · ${state.lines}줄 삭제 · R 키로 다시 시작`;
      return;
    }
    if (state.phase === "PAUSED") {
      this.overlayElement.hidden = false;
      this.overlayTitle.textContent = "PAUSED";
      this.overlayDetail.textContent = "P 또는 Esc로 계속";
      return;
    }
    this.overlayElement.hidden = true;
  }
}

import { AudioController } from "./audio-controller.js";
import { GameModel } from "./game-model.js";
import { InputController } from "./input-controller.js";
import { GameLoop } from "./game-loop.js";
import { Renderer } from "./renderer.js";
import { HighScoreStorage } from "./storage.js";

export function boot(documentRef = document, windowRef = window) {
  const model = new GameModel({ seed: Date.now() });
  const titleScreen = documentRef.querySelector("#title-screen");
  const titleStartButton = documentRef.querySelector("#title-start-button");
  const gameShell = documentRef.querySelector(".game-shell");
  const titleScreenActive = Boolean(titleScreen && !titleScreen.hidden);
  if (titleScreenActive) model.togglePause();

  const renderer = new Renderer(model, documentRef);
  const input = new InputController(model, windowRef);
  const audio = new AudioController(model);

  const startGame = () => {
    if (!titleScreen || titleScreen.hidden) return false;
    titleScreen.hidden = true;
    documentRef.body?.classList.remove("title-screen-active");
    gameShell?.removeAttribute("aria-hidden");
    gameShell?.removeAttribute("inert");
    if (model.phase === "PAUSED") model.togglePause();
    input.clearPressed();
    documentRef.querySelector("#board")?.focus?.({ preventScroll: true });
    return true;
  };
  titleStartButton?.addEventListener("click", startGame);
  const onTitleKeyDown = (event) => {
    if (!titleScreen || titleScreen.hidden) return;
    if (event.key === "Enter" || event.key === " " || event.code === "Space") {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
      startGame();
      return;
    }
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", "a", "A", "d", "D", "s", "S", "x", "X", "z", "Z", "c", "C", "Shift", "Escape", "p", "P", "r", "R"].includes(event.key)) {
      event.preventDefault?.();
      event.stopImmediatePropagation?.();
    }
  };
  documentRef.addEventListener("keydown", onTitleKeyDown, true);
  if (titleScreenActive) titleStartButton?.focus?.({ preventScroll: true });

  const volumeInput = documentRef.querySelector("#volume");
  const volumeValue = documentRef.querySelector("#volume-value");
  if (volumeInput) {
    const updateVolume = () => {
      const value = Number(volumeInput.value);
      audio.setVolume(value / 100);
      if (volumeValue) volumeValue.textContent = `${value}%`;
    };
    volumeInput.addEventListener("input", updateVolume);
    updateVolume();
  }
  const storage = new HighScoreStorage();
  renderer.setHighScore(storage.read());
  const loop = new GameLoop(model, input, windowRef);
  model.on("gameOver", ({ score }) => renderer.setHighScore(storage.record(score)));
  windowRef.addEventListener("blur", () => {
    input.clearPressed();
    if (model.phase === "FALLING" || model.phase === "LINE_CLEAR") model.togglePause();
  });
  documentRef.querySelector("#restart-button")?.addEventListener("click", () => model.restart());

  loop.start();
  return { model, renderer, input, audio, storage, loop, startGame };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => boot());
  else boot();
}

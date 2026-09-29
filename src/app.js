import { AudioController } from "./audio-controller.js";
import { GameModel } from "./game-model.js";
import { InputController } from "./input-controller.js";
import { GameLoop } from "./game-loop.js";
import { Renderer } from "./renderer.js";
import { HighScoreStorage } from "./storage.js";

export function boot(documentRef = document, windowRef = window) {
  const model = new GameModel({ seed: Date.now() });
  const renderer = new Renderer(model, documentRef);
  const input = new InputController(model, windowRef);
  const audio = new AudioController(model);
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
  return { model, renderer, input, audio, storage, loop };
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => boot());
  else boot();
}

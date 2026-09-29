import { spawnSync } from "node:child_process";

const files = [
  "src/constants.js",
  "src/pieces.js",
  "src/randomizer.js",
  "src/game-model.js",
  "src/input-controller.js",
  "src/renderer.js",
  "src/audio-controller.js",
  "src/storage.js",
  "src/game-loop.js",
  "src/app.js",
  "scripts/serve.mjs",
  "scripts/browser-smoke.mjs",
];

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

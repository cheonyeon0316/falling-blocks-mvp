import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const browsers = [
  ["Chrome", process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"],
  ["Edge", process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"],
].filter(([, executable]) => existsSync(executable));

if (browsers.length === 0) throw new Error("Chrome or Edge is required for browser smoke QA");

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function waitFor(check, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result) return result;
    } catch {
      // The local server or browser may still be starting.
    }
    await delay(50);
  }
  throw new Error("Timed out waiting for the local browser QA session");
}

async function unusedPort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const port = server.address().port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function connectToPage(debugPort, url) {
  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    const targets = await response.json();
    return targets.find((entry) => entry.type === "page" && entry.url.startsWith(url));
  });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener("open", resolveOpen, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(message.error.message));
    else request.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const request of pending.values()) request.reject(new Error("Browser connection closed"));
    pending.clear();
  });

  const send = (method, params = {}) => new Promise((resolveRequest, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolveRequest, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  return { socket, send, evaluate, errors };
}

const snapshotExpression = `(() => {
  const previewType = (preview) => {
    const cells = [...preview.querySelectorAll('.preview-cell')];
    const colored = cells.filter((cell) => cell.dataset.piece);
    return { cells: cells.length, types: [...new Set(colored.map((cell) => cell.dataset.piece))], colored: colored.length };
  };
  const left = document.querySelector('.side-panel--left').getBoundingClientRect();
  const board = document.querySelector('.board-wrap').getBoundingClientRect();
  const right = document.querySelector('.side-panel--right').getBoundingClientRect();
  return {
    titleVisible: getComputedStyle(document.querySelector('#title-screen')).display !== 'none',
    next: [...document.querySelectorAll('#next-preview .preview')].map(previewType),
    hold: previewType(document.querySelector('#hold-preview .preview')),
    active: [...document.querySelectorAll('#board .cell--active')].map((cell) => [...cell.parentNode.children].indexOf(cell)),
    overlay: getComputedStyle(document.querySelector('#overlay')).display,
    score: Number(document.querySelector('#score').textContent),
    noOverlap: left.right <= board.left && board.right <= right.left,
    noHorizontalOverflow: document.documentElement.scrollWidth <= window.innerWidth,
  };
})()`;

async function inspectBrowser(name, executable, url) {
  const profile = await mkdtemp(join(tmpdir(), `falling-block-${name.toLowerCase()}-`));
  const browser = spawn(executable, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--window-size=1600,900", url,
  ], { windowsHide: true, stdio: "ignore" });
  let connection;
  try {
    const activePort = await waitFor(async () => {
      const content = await readFile(join(profile, "DevToolsActivePort"), "utf8");
      return Number(content.split(/\r?\n/)[0]);
    });
    connection = await connectToPage(activePort, url);
    const { send, evaluate, errors } = connection;
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
    await waitFor(() => evaluate("document.querySelectorAll('#board .cell').length === 200"));

    const key = async (keyName, code, virtualKeyCode) => {
      const params = { key: keyName, code, windowsVirtualKeyCode: virtualKeyCode };
      await send("Input.dispatchKeyEvent", { type: "keyDown", ...params });
      await send("Input.dispatchKeyEvent", { type: "keyUp", ...params });
    };

    assert.equal(await evaluate("getComputedStyle(document.querySelector('#title-screen')).display !== 'none'"), true);
    assert.deepEqual(await evaluate("Promise.all(['title/falling-blocks-title-bg.png', 'normalized/player-atlas.png', 'normalized/enemy-atlas.png', 'normalized/vfx-atlas.png'].map(path => fetch('./assets/generated/' + path).then(response => response.ok)))"), [true, true, true, true]);
    assert.equal(await evaluate("document.querySelector('#title-start-button').textContent.includes('게임 시작')"), true);
    assert.ok(await evaluate("document.querySelector('#title-start-button').getBoundingClientRect().width > 0"));

    if (name === "Chrome") {
      await evaluate("document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))");
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      const screenshot = join(tmpdir(), "falling-block-1600x900.png");
      await writeFile(screenshot, Buffer.from(data, "base64"));
      console.log(`Visual QA screenshot: ${screenshot}`);
    }

    await key("Enter", "Enter", 13);
    const initial = await evaluate(snapshotExpression);
    assert.equal(initial.titleVisible, false);
    assert.equal(initial.next.length, 5);
    assert.ok(initial.next.every((preview) => preview.cells === 16 && preview.colored === 4 && preview.types.length === 1));
    assert.equal(initial.hold.colored, 0);
    assert.equal(initial.overlay, "none");
    assert.equal(initial.noOverlap, true);
    assert.equal(initial.noHorizontalOverflow, true);
    await evaluate("document.querySelector('#board').focus()");

    await key("c", "KeyC", 67);
    const held = await evaluate(snapshotExpression);
    assert.equal(held.hold.colored, 4);
    assert.ok(held.next.every((preview) => preview.cells === 16 && preview.colored === 4));
    assert.notDeepEqual(held.next.map((preview) => preview.types[0]), initial.next.map((preview) => preview.types[0]));

    await key("p", "KeyP", 80);
    const paused = await evaluate(snapshotExpression);
    assert.notEqual(paused.overlay, "none");
    await key("ArrowLeft", "ArrowLeft", 37);
    assert.deepEqual((await evaluate(snapshotExpression)).active, paused.active);
    await key("p", "KeyP", 80);
    assert.equal((await evaluate(snapshotExpression)).overlay, "none");

    await key(" ", "Space", 32);
    assert.ok((await evaluate(snapshotExpression)).score > 0);
    await evaluate("window.dispatchEvent(new Event('blur'))");
    assert.notEqual((await evaluate(snapshotExpression)).overlay, "none");
    await evaluate("window.dispatchEvent(new Event('focus'))");
    assert.notEqual((await evaluate(snapshotExpression)).overlay, "none");
    await evaluate("document.querySelector('#volume').value = '0'; document.querySelector('#volume').dispatchEvent(new Event('input'))");
    assert.equal(await evaluate("document.querySelector('#volume-value').textContent"), "0%");
    assert.deepEqual(errors, []);

    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send("Page.navigate", { url });
    await waitFor(() => evaluate("getComputedStyle(document.querySelector('#title-screen')).display !== 'none' && document.querySelectorAll('#board .cell').length === 200"));
    const mobileTitle = await evaluate(`(() => {
      const start = document.querySelector('#title-start-button').getBoundingClientRect();
      return {
        noOverflow: document.documentElement.scrollWidth <= window.innerWidth,
        startVisible: start.top >= 0 && start.bottom <= window.innerHeight,
        startLabel: document.querySelector('#title-start-button').textContent.includes('게임 시작'),
      };
    })()`);
    assert.deepEqual(mobileTitle, { noOverflow: true, startVisible: true, startLabel: true });
    if (name === "Chrome") {
      const { data } = await send("Page.captureScreenshot", { format: "png" });
      const screenshot = join(tmpdir(), "falling-block-mobile-390x844.png");
      await writeFile(screenshot, Buffer.from(data, "base64"));
      console.log(`Mobile visual QA screenshot: ${screenshot}`);
    }
    console.log(`${name}: browser smoke passed`);
  } finally {
    if (connection) {
      try {
        await Promise.race([connection.send("Browser.close"), delay(1000)]);
      } catch {
        // Closing the browser can close DevTools before it sends a reply.
      }
      connection.socket.close();
    }
    browser.kill();
    const tempRoot = resolve(tmpdir());
    if (resolve(profile).startsWith(`${tempRoot}${sep}`)) {
      try { await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch { /* Browser cleanup can lag. */ }
    }
  }
}

const port = await unusedPort();
const url = `http://127.0.0.1:${port}/`;
const server = spawn(process.execPath, ["scripts/serve.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  windowsHide: true,
  stdio: "ignore",
});
try {
  await waitFor(async () => (await fetch(url)).ok);
  for (const [name, executable] of browsers) await inspectBrowser(name, executable, url);
} finally {
  server.kill();
}

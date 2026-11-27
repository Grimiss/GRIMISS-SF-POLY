import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
const { chromium } = createRequire(import.meta.url)("playwright");
const port = 8765,
  base = `http://127.0.0.1:${port}`;
const server = spawn("python3", ["-m", "http.server", String(port)], {
  stdio: "ignore",
});
let browser;
const results = [],
  errors = [];
const check = (name, condition) => {
  assert.ok(condition, name);
  results.push(name);
};
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : chromium.executablePath()),
    headless: true,
    args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage({
    viewport: { width: 1774, height: 950 },
    deviceScaleFactor: 1,
    hasTouch: true,
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.testMidiPort = { id: "test-midi", state: "connected" };
    Object.defineProperty(navigator, "requestMIDIAccess", {
      value: async () => ({
        inputs: new Map([["test-midi", window.testMidiPort]]),
      }),
    });
  });
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  const expected = {
    LFO: [52, 112, 160, 231],
    DCO: [221, 112, 274, 231],
    MIXER: [503, 112, 219, 231],
    "HPF / VCF": [729, 112, 252, 231],
    "ENV 1 (FILTER)": [989, 112, 242, 231],
    "ENV 2 (AMP)": [1239, 112, 241, 231],
    MASTER: [1488, 112, 235, 231],
    ARPEGGIATOR: [52, 368, 316, 186],
    AUTOMATION: [377, 368, 422, 186],
    "CHARACTER / VIEW": [814, 368, 250, 186],
    DELAY: [1073, 368, 197, 186],
    REVERB: [1278, 368, 192, 186],
    CHORUS: [1479, 368, 246, 186],
  };
  const geometry = await page.locator(".section").evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      return { name: n.dataset.section, rect: [r.x, r.y, r.width, r.height] };
    }),
  );
  for (const g of geometry) assert.deepEqual(g.rect, expected[g.name]);
  check(
    "all 13 section bounds match measured logical reference map",
    geometry.length === 13,
  );
  check(
    "49 playable keyboard keys",
    (await page.locator(".key").count()) === 49,
  );
  await mkdir("work/validation", { recursive: true });
  await page.screenshot({
    path: "work/validation/final.png",
    clip: { x: 0, y: 0, width: 1774, height: 887 },
  });
  await page.click("#audio");
  await page.waitForFunction(
    () => window.sfpoly.audio.node && sfpoly.audio.context.state === "running",
  );
  check(
    "AudioWorklet starts in running AudioContext",
    await page.evaluate(
      () => sfpoly.audio.context.state === "running" && !!sfpoly.audio.node,
    ),
  );
  await page.evaluate(() => {
    window.testAnalyser = sfpoly.audio.context.createAnalyser();
    testAnalyser.fftSize = 2048;
    sfpoly.audio.node.connect(testAnalyser);
  });
  await page.keyboard.down("a");
  await page.waitForTimeout(250);
  const rms = await page.evaluate(() => {
    const a = new Float32Array(2048);
    testAnalyser.getFloatTimeDomainData(a);
    return Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
  });
  check("computer key produces measurable browser audio", rms > 0.001);
  check(
    "key press reaches worklet voice ownership",
    (await page.evaluate(() => sfpoly.audio.snapshot())).voices === 1,
  );
  await page.keyboard.up("a");
  await page.waitForTimeout(850);
  check(
    "computer key release leaves no active voices",
    (await page.evaluate(() => sfpoly.audio.snapshot())).voices === 0,
  );
  await page.evaluate(() => {
    for (let i = 0; i < 13; i++)
      sfpoly.audio.send({ type: "on", id: "poly" + i, note: 48 + i });
  });
  await page.waitForTimeout(200);
  const poly = await page.evaluate(() => sfpoly.audio.snapshot());
  check(
    "browser enforces 12 voices and steals the thirteenth",
    poly.voices === 12 && poly.steals >= 1,
  );
  await page.click("#panic");
  await page.waitForTimeout(50);
  check(
    "panic clears all browser voices",
    (await page.evaluate(() => sfpoly.audio.snapshot())).voices === 0,
  );
  await page.touchscreen.tap(240, 800);
  // Real pointer capture/glissando, in addition to keyboard and MIDI ownership.
  await page.mouse.move(240, 800);
  await page.mouse.down();
  await page.mouse.move(350, 800);
  await page.mouse.up();
  await page.waitForTimeout(800);
  check(
    "pointer release/glissando leaves no stuck notes",
    (await page.evaluate(() => sfpoly.audio.snapshot())).voices === 0,
  );
  await page.click("#viewSeq");
  await page.fill("#seqLength", "4");
  await page.locator("#seqLength").dispatchEvent("change");
  await page.click("#seqPlay");
  await page.waitForTimeout(200);
  await page.click("#viewKey");
  check(
    "SEQ16 continues while keyboard view is selected",
    (await page.evaluate(() => sfpoly.audio.snapshot())).seqPlaying,
  );
  await page.evaluate(() => sfpoly.send({ type: "seqStop" }));
  await page.click("#arpOn");
  await page.keyboard.down("a");
  await page.waitForTimeout(150);
  await page.click("#viewSeq");
  check(
    "arpeggiator continues across view changes",
    (await page.evaluate(() => sfpoly.audio.snapshot())).arp.on,
  );
  await page.keyboard.up("a");
  await page.click("#arpOn");
  await page.click("#viewKey");
  await page.click("#panic");
  await page.click("#autoRec");
  await page.waitForTimeout(60);
  await page.locator('input[aria-label="character"]').evaluate((n) => {
    n.value = "0.1";
    n.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(100);
  await page.locator('input[aria-label="character"]').evaluate((n) => {
    n.value = "0.9";
    n.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(100);
  await page.click("#autoStop");
  const recorded = await page.evaluate(() => sfpoly.audio.snapshot());
  check(
    "panel movements record CHARACTER automation",
    recorded.automation.events.filter((e) => e.k === "character").length >= 2,
  );
  await page.click("#autoPlay");
  await page.waitForTimeout(90);
  const reflected = await page
    .locator('input[aria-label="character"]')
    .inputValue();
  check("automation updates visible slider position", +reflected < 0.85);
  await page.click("#autoStop");
  await page.click("#patches");
  await page.selectOption("#preset", "f8");
  await page.waitForTimeout(40);
  const recalled = await page.evaluate(() => sfpoly.audio.snapshot());
  check(
    "factory recall restores Juno profile and clears transports",
    recalled.params.character === 1 &&
      !recalled.autoPlaying &&
      !recalled.seqPlaying &&
      recalled.voices === 0,
  );
  page.once("dialog", (d) => d.accept("Browser round-trip"));
  await page.click("#save");
  await page.waitForTimeout(80);
  check(
    "user patch persists to browser storage",
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("sf-poly-patches-v1")).some(
        (p) => p.name === "Browser round-trip",
      ),
    ),
  );
  page.once("dialog", (d) => d.accept("Renamed patch"));
  await page.click("#rename");
  check(
    "user patch renames",
    (await page.locator("#preset option:checked").textContent()) ===
      "Renamed patch",
  );
  const downloadPromise = page.waitForEvent("download");
  await page.click("#export");
  const download = await downloadPromise;
  check(
    "JSON export triggers a download",
    download.suggestedFilename().endsWith(".json"),
  );
  await download.saveAs("work/validation/exported-patch.json");
  page.once("dialog", (d) => d.accept());
  await page.click("#delete");
  await page
    .locator("#import")
    .setInputFiles("work/validation/exported-patch.json");
  await page.waitForFunction(() =>
    document.querySelector("#patch-status").textContent.startsWith("Imported "),
  );
  check(
    "JSON import restores patch name",
    await page
      .locator("#patch-status")
      .textContent()
      .then((t) => t.includes("Renamed patch")),
  );
  await page.locator(".close").click();
  await page.click("#midi");
  await page.waitForFunction(() => !!testMidiPort.onmidimessage);
  await page.evaluate(() =>
    testMidiPort.onmidimessage({ data: [0x90, 60, 100] }),
  );
  await page.waitForTimeout(40);
  check(
    "MIDI note-on produces a voice",
    (await page.evaluate(() => sfpoly.audio.snapshot())).voices === 1,
  );
  await page.evaluate(() => {
    testMidiPort.onmidimessage({ data: [0xb0, 64, 127] });
    testMidiPort.onmidimessage({ data: [0x80, 60, 0] });
  });
  await page.waitForTimeout(100);
  check(
    "MIDI sustain holds a released note",
    (await page.evaluate(() => sfpoly.audio.snapshot())).voices === 1,
  );
  await page.evaluate(() =>
    testMidiPort.onmidimessage({ data: [0xb0, 64, 0] }),
  );
  await page.waitForTimeout(1200);
  // The recalled pad has a long release: panic must still silence it immediately.
  await page.click("#panic");
  check(
    "MIDI panic clears sustained/releasing notes",
    (await page.evaluate(() => sfpoly.audio.snapshot())).voices === 0,
  );
  await page.evaluate(() => sfpoly.audio.context.suspend());
  check(
    "context can suspend",
    (await page.evaluate(() => sfpoly.audio.context.state)) === "suspended",
  );
  await page.click("#audio");
  await page.waitForTimeout(60);
  check(
    "audio resumes after suspension",
    (await page.evaluate(() => sfpoly.audio.context.state)) === "running",
  );
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.click("#viewSeq");
  await page.screenshot({ path: "work/validation/tablet.png" });
  const small = await page.evaluate(() => ({
    sections: document.querySelectorAll(".section").length,
    view: document.querySelector("#seq-view").getBoundingClientRect().height,
    scroll: document.querySelector("#viewport").scrollWidth,
    client: document.querySelector("#viewport").clientWidth,
  }));
  check(
    "tablet keeps both banks and functional sequencer",
    small.sections === 13 && small.view > 100 && small.scroll === small.client,
  );
  const fresh = await browser.newPage({
    viewport: { width: 1774, height: 950 },
  });
  await fresh.goto(base);
  await fresh.keyboard.down("a");
  await fresh.waitForFunction(() => !!window.sfpoly.audio.node);
  await fresh.waitForTimeout(100);
  check(
    "first key starts audio and survives initial patch setup",
    (await fresh.evaluate(() => sfpoly.audio.snapshot())).voices === 1,
  );
  await fresh.keyboard.up("a");
  await fresh.close();
  await page.setViewportSize({ width: 600, height: 800 });
  check(
    "small screens scroll the intact instrument",
    await page.evaluate(
      () =>
        document.querySelector("#viewport").scrollWidth >
        document.querySelector("#viewport").clientWidth,
    ),
  );
  assert.deepEqual(errors, []);
  results.push("no uncaught browser exceptions");
  await writeFile(
    "work/validation/browser.json",
    JSON.stringify({ results, geometry, rms, poly, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ checks: results.length, rms, results }, null, 2),
  );
} finally {
  await browser?.close();
  server.kill();
}

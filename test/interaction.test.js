import test from "node:test";
import assert from "node:assert/strict";
import {
  BLINK_WINDOW_MS,
  BlinkWindowCounter,
  RouletteScanner,
  applyToken,
  removeLastGrapheme,
} from "../src/interaction.js";

test("zero blinks passes when the fixed scan window ends", () => {
  const window = new BlinkWindowCounter({ windowMs: 1_000 });
  window.start(100, "ก");
  assert.equal(window.resolve(1_099), null);
  assert.deepEqual(window.resolve(1_100), { type: "pass", candidate: "ก" });
});

test("one blink selects after the confirm window measured from that blink", () => {
  const window = new BlinkWindowCounter({ windowMs: 1_000, confirmMs: 500 });
  window.start(100, "ข");
  window.recordBlink(900);
  assert.equal(window.resolve(1_399), null);
  assert.deepEqual(window.resolve(1_400), { type: "select", candidate: "ข" });
});

test("a second blink switches mode right away", () => {
  const window = new BlinkWindowCounter({ windowMs: 1_000, confirmMs: 500 });
  window.start(100, "ค");
  window.recordBlink(900);
  window.recordBlink(1_150);
  assert.deepEqual(window.resolve(1_150), { type: "switch-bank", count: 2 });
});

test("a double blink straddling the slot boundary switches mode instead of selecting twice", () => {
  const window = new BlinkWindowCounter({ windowMs: BLINK_WINDOW_MS, confirmMs: 550 });
  window.start(0, "ง");
  window.recordBlink(1_290);
  assert.equal(window.resolve(BLINK_WINDOW_MS), null);
  window.recordBlink(1_500);
  assert.deepEqual(window.resolve(1_500), { type: "switch-bank", count: 2 });
});

test("closed eyes freeze an expired window until they reopen or stop", () => {
  const window = new BlinkWindowCounter({ windowMs: 1_000 });
  window.start(100, "ง");
  assert.equal(window.resolve(1_500, { eyesClosed: true }), null);
  assert.equal(window.deadline, 1_100);
});

test("scanner catches up deterministically after delayed frames", () => {
  const scanner = new RouletteScanner({
    intervalMs: 1_000,
    banks: [{ id: "test", label: "Test", items: ["ก", "ข", "ค", "ง"] }],
  });
  scanner.start(0);
  scanner.tick(2_500);
  assert.equal(scanner.item, "ค");
});

test("default scanner cycles through three content banks without a command bank", () => {
  const scanner = new RouletteScanner();
  scanner.nextBank(100);
  scanner.nextBank(200);
  scanner.nextBank(300);
  assert.equal(scanner.bank.id, "consonants");
  assert.equal(scanner.banks.length, 3);
});

test("tokens append, quick phrases get spacing, and backspace is Unicode-safe", () => {
  assert.equal(applyToken("", "ก"), "ก");
  assert.equal(applyToken("ก", "น้ำ"), "ก น้ำ ");
  assert.equal(removeLastGrapheme("ก😊"), "ก");
  assert.equal(removeLastGrapheme("กิ"), "");
});

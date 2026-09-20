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

test("one blink selects the item only when its scan window ends", () => {
  const window = new BlinkWindowCounter({ windowMs: 1_000 });
  window.start(100, "ข");
  window.recordBlink();
  assert.equal(window.resolve(1_099), null);
  assert.deepEqual(window.resolve(1_100), { type: "select", candidate: "ข" });
});

test("two blinks switch mode after the same fixed window", () => {
  const window = new BlinkWindowCounter();
  window.start(100, "ค");
  window.recordBlink();
  window.recordBlink();
  assert.equal(window.resolve(100 + BLINK_WINDOW_MS - 1), null);
  assert.deepEqual(window.resolve(100 + BLINK_WINDOW_MS), { type: "switch-bank", count: 2 });
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

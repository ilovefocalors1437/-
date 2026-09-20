import test from "node:test";
import assert from "node:assert/strict";
import {
  BLINK_WINDOW_MS,
  BlinkBurstBuffer,
  RouletteScanner,
  applyToken,
  removeLastGrapheme,
} from "../src/interaction.js";

test("one blink resolves to the item frozen at first eye closure", () => {
  const buffer = new BlinkBurstBuffer({ burstWindowMs: 1_000 });
  assert.equal(buffer.begin(100, "ก"), true);
  assert.equal(buffer.addBlink(260).type, "pending");
  assert.equal(buffer.flush(1_099), null);
  assert.deepEqual(buffer.flush(1_100), { type: "select", candidate: "ก" });
});

test("two blinks switch bank only when the fixed window ends", () => {
  const buffer = new BlinkBurstBuffer({ burstWindowMs: 1_000 });
  buffer.begin(100, "ข");
  buffer.addBlink(300);
  buffer.addBlink(700);
  assert.equal(buffer.flush(1_099), null);
  assert.deepEqual(buffer.flush(1_100), { type: "switch-bank", count: 2 });
});

test("three blinks finish the sentence after the same fixed window", () => {
  const buffer = new BlinkBurstBuffer();
  buffer.begin(100, "ค");
  buffer.addBlink(280);
  buffer.addBlink(620);
  buffer.addBlink(980);
  assert.equal(buffer.flush(100 + BLINK_WINDOW_MS - 1), null);
  assert.deepEqual(buffer.flush(100 + BLINK_WINDOW_MS), { type: "finish", count: 3 });
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

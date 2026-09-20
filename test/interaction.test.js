import test from "node:test";
import assert from "node:assert/strict";
import {
  BlinkBurstBuffer,
  COMMAND_TOKENS,
  RouletteScanner,
  applyToken,
  getItemLabel,
} from "../src/interaction.js";

test("one blink resolves to captured item after the burst window", () => {
  const buffer = new BlinkBurstBuffer({ switchBlinkCount: 2, burstWindowMs: 1_000 });
  assert.equal(buffer.addBlink(100, "ก").type, "pending");
  assert.equal(buffer.flush(1_099), null);
  assert.deepEqual(buffer.flush(1_100), { type: "select", candidate: "ก" });
});

test("two blinks switch bank without selecting first candidate", () => {
  const buffer = new BlinkBurstBuffer({ switchBlinkCount: 2, burstWindowMs: 1_000 });
  buffer.addBlink(100, "ข");
  assert.deepEqual(buffer.addBlink(600, "ค"), { type: "switch-bank", count: 2 });
  assert.equal(buffer.flush(2_000), null);
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

test("default scanner cycles through the eye-accessible command bank", () => {
  const scanner = new RouletteScanner();
  scanner.nextBank(100);
  scanner.nextBank(200);
  scanner.nextBank(300);
  assert.equal(scanner.bank.id, "commands");
  assert.ok(scanner.bank.items.includes(COMMAND_TOKENS.BACKSPACE));
});

test("tokens append, quick phrases get spacing, and backspace is Unicode-safe", () => {
  assert.equal(applyToken("", "ก"), "ก");
  assert.equal(applyToken("ก", "น้ำ"), "ก น้ำ ");
  assert.equal(applyToken("ก😊", COMMAND_TOKENS.BACKSPACE), "ก");
  assert.equal(applyToken("กิ", COMMAND_TOKENS.BACKSPACE), "");
  assert.equal(applyToken("ก", COMMAND_TOKENS.SPACE), "ก ");
  assert.equal(getItemLabel(COMMAND_TOKENS.CLEAR), "✕ ล้างข้อความ");
});

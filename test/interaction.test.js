import test from "node:test";
import assert from "node:assert/strict";
import { BlinkWindowCounter, CHARACTER_BANKS, RouletteScanner, applyToken, removeLastGrapheme } from "../src/interaction.js";

test("no blink passes after a fixed 1.35-second window", () => {
  const counter = new BlinkWindowCounter(); counter.start(0, "ก");
  assert.equal(counter.resolve(1_349), null);
  assert.deepEqual(counter.resolve(1_350), { type: "pass", candidate: "ก" });
});

test("first blink freezes the candidate and selects after 0.55 seconds", () => {
  const counter = new BlinkWindowCounter(); counter.start(0, "ข");
  assert.deepEqual(counter.recordBlink(400), { type: "pending", count: 1, deadline: 950 });
  assert.equal(counter.resolve(949), null);
  assert.deepEqual(counter.resolve(950), { type: "select", candidate: "ข" });
});

test("second blink switches bank immediately without selecting", () => {
  const counter = new BlinkWindowCounter(); counter.start(0, "ค");
  counter.recordBlink(300);
  assert.deepEqual(counter.recordBlink(700), { type: "pending", count: 2, deadline: 700 });
  assert.deepEqual(counter.resolve(700), { type: "switch-bank", count: 2 });
});

test("closed eyes freeze an expired window", () => {
  const counter = new BlinkWindowCounter(); counter.start(0, "ง");
  assert.equal(counter.resolve(2_000, { eyesClosed: true }), null);
  assert.deepEqual(counter.resolve(2_001), { type: "pass", candidate: "ง" });
});

test("roulette catches up deterministically", () => {
  const scanner = new RouletteScanner({ intervalMs: 1_350, banks: [{ id: "test", label: "test", items: ["ก","ข","ค"] }] });
  scanner.start(0);
  assert.equal(scanner.tick(1_349), false);
  assert.equal(scanner.tick(2_800), true);
  assert.equal(scanner.item, "ค");
});

test("banks contain only consonants and vowels", () => {
  assert.deepEqual(CHARACTER_BANKS.map((bank) => bank.id), ["consonants","vowels"]);
});

test("replaceBanks preserves the active content bank", () => {
  const scanner = new RouletteScanner(); scanner.setBank("vowels"); scanner.selectIndex(3);
  scanner.replaceBanks(CHARACTER_BANKS.map((bank) => ({ ...bank, items: [...bank.items] })));
  assert.equal(scanner.bank.id, "vowels"); assert.equal(scanner.itemIndex, 3);
});

test("tokens append and backspace is Unicode-safe", () => {
  assert.equal(applyToken("ก", "า"), "กา");
  assert.equal(removeLastGrapheme("ก😊"), "ก");
  assert.equal(removeLastGrapheme("กิ"), "");
});

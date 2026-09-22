import test from "node:test";
import assert from "node:assert/strict";
import { BlinkCommandResolver, CHARACTER_BANKS, RemoteScanner, applyToken, removeLastGrapheme } from "../src/interaction.js";

test("one bilateral blink resolves selection only after confirmation window", () => {
  const resolver = new BlinkCommandResolver({ confirmMs: 460 });
  assert.equal(resolver.record(100, "ก", "both").type, "pending-select");
  assert.equal(resolver.resolve(559), null);
  assert.deepEqual(resolver.resolve(560), { type: "select", candidate: "ก", eye: "both" });
});

test("second bilateral blink inside window switches bank without selecting", () => {
  const resolver = new BlinkCommandResolver({ confirmMs: 460 });
  resolver.record(100, "ข", "both");
  assert.deepEqual(resolver.record(400, "ข", "both"), { type: "switch-bank", firstEye: "both", secondEye: "both" });
  assert.equal(resolver.resolve(1_000), null);
});

test("scanner advances automatically at normal speed and catches up deterministically", () => {
  const scanner = new RemoteScanner({ intervalMs: 1_200, banks: [{ id: "test", label: "test", items: ["ก","ข","ค"] }] });
  scanner.start(0);
  assert.equal(scanner.tick(1_199), false);
  assert.equal(scanner.tick(2_500), true);
  assert.equal(scanner.item, "ค");
});

test("banks contain only consonants and vowels to keep eye commands simple", () => {
  assert.deepEqual(CHARACTER_BANKS.map((bank) => bank.id), ["consonants","vowels"]);
});

test("replaceBanks preserves the active content bank", () => {
  const scanner = new RemoteScanner(); scanner.setBank("vowels"); scanner.selectIndex(3);
  scanner.replaceBanks(CHARACTER_BANKS.map((bank) => ({ ...bank, items: [...bank.items] })));
  assert.equal(scanner.bank.id, "vowels"); assert.equal(scanner.itemIndex, 3);
});

test("tokens append and backspace is Unicode-safe", () => {
  assert.equal(applyToken("ก", "า"), "กา");
  assert.equal(removeLastGrapheme("ก😊"), "ก");
  assert.equal(removeLastGrapheme("กิ"), "");
});

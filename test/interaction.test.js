import test from "node:test";
import assert from "node:assert/strict";
import { CHARACTER_BANKS, RemoteScanner, STOP_ACTION, WinkCommandResolver, applyToken, removeLastGrapheme } from "../src/interaction.js";

test("single wink resolves selection only after confirmation window", () => {
  const resolver = new WinkCommandResolver({ confirmMs: 460 });
  assert.equal(resolver.record(100, "ก", "left").type, "pending-select");
  assert.equal(resolver.resolve(559), null);
  assert.deepEqual(resolver.resolve(560), { type: "select", candidate: "ก", eye: "left" });
});

test("second wink inside window switches bank without selecting", () => {
  const resolver = new WinkCommandResolver({ confirmMs: 460 });
  resolver.record(100, "ข", "right");
  assert.deepEqual(resolver.record(400, "ข", "left"), { type: "switch-bank", firstEye: "right", secondEye: "left" });
  assert.equal(resolver.resolve(1_000), null);
});

test("remote scanner moves only when commanded and wraps", () => {
  const scanner = new RemoteScanner({ banks: [{ id: "test", label: "test", items: ["ก","ข","ค"] }] });
  assert.equal(scanner.item, "ก"); scanner.advance(); scanner.advance(); scanner.advance(); assert.equal(scanner.item, "ก");
});

test("banks contain consonants, vowels, and accessible stop confirmation", () => {
  assert.deepEqual(CHARACTER_BANKS.map((bank) => bank.id), ["consonants","vowels","stop"]);
  assert.deepEqual(CHARACTER_BANKS.at(-1).items, [STOP_ACTION]);
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

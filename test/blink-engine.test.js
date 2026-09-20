import test from "node:test";
import assert from "node:assert/strict";
import { BlinkEngine, DEFAULT_BLINK_CONFIG, deriveCalibration } from "../src/blink-engine.js";

function feed(engine, frames) {
  return frames.flatMap((frame) => engine.process(frame));
}

test("emits a blink only after a valid closure reopens", () => {
  const engine = new BlinkEngine({ smoothing: 1, minBlinkMs: 80 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: 0.1, rightScore: 0.1 },
    { timestamp: 100, leftScore: 0.9, rightScore: 0.9 },
    { timestamp: 240, leftScore: 0.1, rightScore: 0.1 },
  ]);
  assert.deepEqual(events.map((event) => event.type), ["tracking-found", "eyes-closed", "blink"]);
  assert.equal(events.at(-1).duration, 140);
});

test("default threshold recognizes a lighter blink around forty percent", () => {
  assert.equal(DEFAULT_BLINK_CONFIG.closedThreshold, 0.4);
  assert.equal(DEFAULT_BLINK_CONFIG.openThreshold, 0.24);

  const engine = new BlinkEngine({ smoothing: 1, minBlinkMs: 80 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: 0.15, rightScore: 0.15 },
    { timestamp: 100, leftScore: 0.42, rightScore: 0.42 },
    { timestamp: 230, leftScore: 0.18, rightScore: 0.18 },
  ]);
  assert.equal(events.some((event) => event.type === "blink"), true);
});

test("requires both eyes so a wink is ignored", () => {
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: 0.1, rightScore: 0.1 },
    { timestamp: 100, leftScore: 0.9, rightScore: 0.1 },
    { timestamp: 300, leftScore: 0.1, rightScore: 0.1 },
  ]);
  assert.deepEqual(events.map((event) => event.type), ["tracking-found"]);
});

test("long closure fires once and never becomes a blink", () => {
  const engine = new BlinkEngine({ smoothing: 1, longCloseMs: 1_000, maxBlinkMs: 700 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: 0.1, rightScore: 0.1 },
    { timestamp: 100, leftScore: 0.9, rightScore: 0.9 },
    { timestamp: 1_100, leftScore: 0.9, rightScore: 0.9 },
    { timestamp: 1_500, leftScore: 0.9, rightScore: 0.9 },
    { timestamp: 1_700, leftScore: 0.1, rightScore: 0.1 },
  ]);
  assert.equal(events.filter((event) => event.type === "long-close").length, 1);
  assert.equal(events.some((event) => event.type === "blink"), false);
  assert.equal(events.at(-1).type, "long-close-ended");
});

test("default long closure threshold is five seconds", () => {
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: 0.1, rightScore: 0.1 },
    { timestamp: 100, leftScore: 0.9, rightScore: 0.9 },
    { timestamp: 5_099, leftScore: 0.9, rightScore: 0.9 },
    { timestamp: 5_100, leftScore: 0.9, rightScore: 0.9 },
  ]);
  assert.equal(events.filter((event) => event.type === "long-close").length, 1);
  assert.equal(events.at(-1).duration, 5_000);
});

test("tracking loss resets a partial closure", () => {
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: 0.1, rightScore: 0.1 },
    { timestamp: 100, leftScore: 0.9, rightScore: 0.9 },
    { timestamp: 150, facePresent: false },
    { timestamp: 300, leftScore: 0.1, rightScore: 0.1 },
  ]);
  assert.equal(events.some((event) => event.type === "blink"), false);
});

test("calibration uses robust medians and rejects poor separation", () => {
  const good = deriveCalibration([0.08, 0.1, 0.11, 0.12], [0.78, 0.8, 0.82, 0.95]);
  assert.equal(good.ok, true);
  assert.ok(good.openThreshold < good.closedThreshold);
  assert.ok(good.closedThreshold < 0.4);

  const poor = deriveCalibration([0.3, 0.31], [0.39, 0.4]);
  assert.deepEqual(poor.reason, "low-separation");
});

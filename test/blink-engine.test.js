import test from "node:test";
import assert from "node:assert/strict";
import { BlinkEngine, DEFAULT_BLINK_CONFIG, deriveCalibration } from "../src/blink-engine.js";

const feed = (engine, frames) => frames.flatMap((frame) => engine.process(frame));

test("a short closure of both eyes becomes one blink after reopening", () => {
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .1, rightScore: .1 },
    { timestamp: 100, leftScore: .8, rightScore: .8 },
    { timestamp: 250, leftScore: .1, rightScore: .1 },
  ]);
  assert.equal(events.filter((event) => event.type === "blink").length, 1);
});

test("default threshold recognizes forty-percent closure", () => {
  assert.equal(DEFAULT_BLINK_CONFIG.closedThreshold, .4);
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .15, rightScore: .15 },
    { timestamp: 100, leftScore: .42, rightScore: .43 },
    { timestamp: 230, leftScore: .18, rightScore: .17 },
  ]);
  assert.equal(events.some((event) => event.type === "blink"), true);
});

test("one-eye wink is ignored", () => {
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .1, rightScore: .1 },
    { timestamp: 100, leftScore: .9, rightScore: .1 },
    { timestamp: 250, leftScore: .1, rightScore: .1 },
  ]);
  assert.equal(events.some((event) => event.type === "blink"), false);
});

test("five-second closure stops once and never also becomes a blink", () => {
  assert.equal(DEFAULT_BLINK_CONFIG.longCloseMs, 5_000);
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .1, rightScore: .1 },
    { timestamp: 100, leftScore: .9, rightScore: .9 },
    { timestamp: 5_100, leftScore: .9, rightScore: .9 },
    { timestamp: 5_500, leftScore: .9, rightScore: .9 },
    { timestamp: 5_600, leftScore: .1, rightScore: .1 },
  ]);
  assert.equal(events.filter((event) => event.type === "long-close").length, 1);
  assert.equal(events.some((event) => event.type === "blink"), false);
});

test("tracking loss cancels a partial closure", () => {
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .1, rightScore: .1 },
    { timestamp: 100, leftScore: .9, rightScore: .9 },
    { timestamp: 150, facePresent: false },
    { timestamp: 300, leftScore: .1, rightScore: .1 },
  ]);
  assert.equal(events.some((event) => event.type === "blink"), false);
});

test("calibration uses robust medians and rejects poor separation", () => {
  const good = deriveCalibration([.08,.1,.11,.12],[.78,.8,.82,.95]);
  assert.equal(good.ok, true); assert.ok(good.openThreshold < good.closedThreshold);
  const poor = deriveCalibration([.3,.31],[.39,.4]);
  assert.equal(poor.reason, "low-separation");
});

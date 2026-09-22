import test from "node:test";
import assert from "node:assert/strict";
import { BlinkEngine, DEFAULT_BLINK_CONFIG, deriveCalibration } from "../src/blink-engine.js";

const feed = (engine, frames) => frames.flatMap((frame) => engine.process(frame));

test("a short left-eye closure becomes one wink only after reopening", () => {
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .1, rightScore: .1 },
    { timestamp: 100, leftScore: .8, rightScore: .1 },
    { timestamp: 250, leftScore: .1, rightScore: .1 },
  ]);
  assert.equal(events.filter((event) => event.type === "wink").length, 1);
  assert.equal(events.find((event) => event.type === "wink").eye, "left");
});

test("default threshold recognizes a lighter forty-percent wink", () => {
  assert.equal(DEFAULT_BLINK_CONFIG.closedThreshold, .4);
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .15, rightScore: .15 },
    { timestamp: 100, leftScore: .42, rightScore: .15 },
    { timestamp: 230, leftScore: .18, rightScore: .15 },
  ]);
  assert.equal(events.some((event) => event.type === "wink"), true);
});

test("near-simultaneous eyelids upgrade to a bilateral blink", () => {
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .1, rightScore: .1 },
    { timestamp: 100, leftScore: .9, rightScore: .1 },
    { timestamp: 160, leftScore: .9, rightScore: .9 },
    { timestamp: 280, leftScore: .1, rightScore: .1 },
  ]);
  assert.equal(events.some((event) => event.type === "both-blink"), true);
  assert.equal(events.some((event) => event.type === "wink"), false);
});

test("one-eye hold repeats every 200 ms and never also selects", () => {
  const engine = new BlinkEngine({ smoothing: 1, holdStartMs: 360, holdStepMs: 200 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .1, rightScore: .1 },
    { timestamp: 100, leftScore: .9, rightScore: .1 },
    { timestamp: 460, leftScore: .9, rightScore: .1 },
    { timestamp: 860, leftScore: .9, rightScore: .1 },
    { timestamp: 900, leftScore: .1, rightScore: .1 },
  ]);
  assert.equal(events.filter((event) => event.type === "hold-step").length, 3);
  assert.equal(events.some((event) => event.type === "hold-end"), true);
  assert.equal(events.some((event) => event.type === "wink"), false);
});

test("both-eye hold emits once", () => {
  const engine = new BlinkEngine({ smoothing: 1, bothHoldMs: 900 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .1, rightScore: .1 },
    { timestamp: 100, leftScore: .9, rightScore: .9 },
    { timestamp: 1_000, leftScore: .9, rightScore: .9 },
    { timestamp: 1_200, leftScore: .9, rightScore: .9 },
    { timestamp: 1_300, leftScore: .1, rightScore: .1 },
  ]);
  assert.equal(events.filter((event) => event.type === "both-hold").length, 1);
  assert.equal(events.some((event) => event.type === "both-blink"), false);
});

test("tracking loss cancels a partial gesture", () => {
  const engine = new BlinkEngine({ smoothing: 1 });
  const events = feed(engine, [
    { timestamp: 0, leftScore: .1, rightScore: .1 },
    { timestamp: 100, leftScore: .9, rightScore: .1 },
    { timestamp: 150, facePresent: false },
    { timestamp: 300, leftScore: .1, rightScore: .1 },
  ]);
  assert.equal(events.some((event) => event.type === "wink"), false);
});

test("calibration uses robust medians and rejects poor separation", () => {
  const good = deriveCalibration([.08,.1,.11,.12],[.78,.8,.82,.95]);
  assert.equal(good.ok, true); assert.ok(good.openThreshold < good.closedThreshold);
  const poor = deriveCalibration([.3,.31],[.39,.4]);
  assert.equal(poor.reason, "low-separation");
});

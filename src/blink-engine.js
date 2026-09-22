export const DEFAULT_BLINK_CONFIG = Object.freeze({
  closedThreshold: 0.4,
  openThreshold: 0.24,
  minWinkMs: 70,
  maxWinkMs: 340,
  holdStartMs: 360,
  holdStepMs: 200,
  bothHoldMs: 900,
  bilateralGraceMs: 140,
  smoothing: 0.42,
});

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

/**
 * Converts MediaPipe eyeBlinkLeft/Right scores into mutually exclusive gestures.
 * A short one-eye closure becomes a wink only after reopening. Once it reaches
 * holdStartMs it emits hold steps and can never also become a wink. Closing both
 * eyes is latched as a separate gesture, which prevents page navigation and
 * character selection from firing from the same movement.
 */
export class BlinkEngine {
  constructor(config = {}) {
    this.configure(config);
    this.reset();
  }

  configure(config = {}) {
    this.config = { ...DEFAULT_BLINK_CONFIG, ...this.config, ...config };
    if (this.config.openThreshold >= this.config.closedThreshold) {
      throw new Error("openThreshold must be lower than closedThreshold");
    }
    if (this.config.holdStartMs <= this.config.maxWinkMs) {
      throw new Error("holdStartMs must be greater than maxWinkMs");
    }
  }

  reset() {
    this.filteredLeft = null;
    this.filteredRight = null;
    this.leftClosed = false;
    this.rightClosed = false;
    this.tracking = false;
    this.gesture = null;
    this.startedAt = null;
    this.nextHoldStepAt = null;
    this.holdActive = false;
    this.bothHoldHandled = false;
  }

  updateEyeState(score, wasClosed) {
    if (wasClosed) return score > this.config.openThreshold;
    return score >= this.config.closedThreshold;
  }

  currentShape() {
    if (this.leftClosed && this.rightClosed) return "both";
    if (this.leftClosed) return "left";
    if (this.rightClosed) return "right";
    return "open";
  }

  beginGesture(kind, timestamp, events) {
    this.gesture = kind;
    this.startedAt = timestamp;
    this.holdActive = false;
    this.bothHoldHandled = false;
    this.nextHoldStepAt = kind === "both"
      ? timestamp + this.config.bothHoldMs
      : timestamp + this.config.holdStartMs;
    events.push({ type: "gesture-start", gesture: kind, timestamp });
  }

  finishGesture(timestamp, events) {
    const gesture = this.gesture;
    const duration = timestamp - this.startedAt;
    if (gesture === "both") {
      if (this.bothHoldHandled) {
        events.push({ type: "both-hold-ended", timestamp, duration });
      } else if (duration >= this.config.minWinkMs && duration <= this.config.maxWinkMs) {
        events.push({ type: "both-blink", timestamp, duration });
      } else {
        events.push({ type: "gesture-rejected", gesture, timestamp, duration });
      }
    } else if (gesture === "left" || gesture === "right") {
      if (this.holdActive) {
        events.push({ type: "hold-end", eye: gesture, timestamp, duration });
      } else if (duration >= this.config.minWinkMs && duration <= this.config.maxWinkMs) {
        events.push({ type: "wink", eye: gesture, timestamp, duration });
      } else {
        events.push({ type: "gesture-rejected", gesture, timestamp, duration });
      }
    }
    this.gesture = null;
    this.startedAt = null;
    this.nextHoldStepAt = null;
    this.holdActive = false;
    this.bothHoldHandled = false;
  }

  process({ timestamp, leftScore = 0, rightScore = 0, facePresent = true }) {
    const events = [];
    if (!facePresent) {
      if (this.tracking) events.push({ type: "tracking-lost", timestamp });
      this.reset();
      return events;
    }
    if (!this.tracking) events.push({ type: "tracking-found", timestamp });
    this.tracking = true;

    const alpha = this.config.smoothing;
    const left = clamp01(leftScore);
    const right = clamp01(rightScore);
    this.filteredLeft = this.filteredLeft === null ? left : alpha * left + (1 - alpha) * this.filteredLeft;
    this.filteredRight = this.filteredRight === null ? right : alpha * right + (1 - alpha) * this.filteredRight;
    this.leftClosed = this.updateEyeState(this.filteredLeft, this.leftClosed);
    this.rightClosed = this.updateEyeState(this.filteredRight, this.rightClosed);

    const shape = this.currentShape();
    if (!this.gesture) {
      if (shape !== "open") this.beginGesture(shape, timestamp, events);
      return events;
    }

    // MediaPipe often reports one eyelid a frame before the other.
    if (shape === "both" && this.gesture !== "both") {
      const elapsed = timestamp - this.startedAt;
      if (elapsed <= this.config.bilateralGraceMs && !this.holdActive) {
        this.gesture = "both";
        this.nextHoldStepAt = this.startedAt + this.config.bothHoldMs;
        events.push({ type: "gesture-upgraded", gesture: "both", timestamp });
      } else {
        events.push({ type: "gesture-cancelled", gesture: this.gesture, timestamp });
        this.beginGesture("both", timestamp, events);
      }
    }

    if (shape === "open") {
      this.finishGesture(timestamp, events);
      return events;
    }

    if (this.gesture === "both") {
      if (!this.bothHoldHandled && timestamp >= this.startedAt + this.config.bothHoldMs) {
        this.bothHoldHandled = true;
        events.push({ type: "both-hold", timestamp, duration: timestamp - this.startedAt });
      }
      return events;
    }

    if (shape !== this.gesture) return events;
    while (timestamp >= this.nextHoldStepAt) {
      this.holdActive = true;
      events.push({
        type: "hold-step",
        eye: this.gesture,
        timestamp: this.nextHoldStepAt,
        duration: this.nextHoldStepAt - this.startedAt,
      });
      this.nextHoldStepAt += this.config.holdStepMs;
    }
    return events;
  }

  getTelemetry(timestamp = performance.now()) {
    return {
      left: this.filteredLeft ?? 0,
      right: this.filteredRight ?? 0,
      leftClosed: this.leftClosed,
      rightClosed: this.rightClosed,
      gesture: this.gesture,
      closedForMs: this.gesture && this.startedAt !== null ? Math.max(0, timestamp - this.startedAt) : 0,
    };
  }
}

export function deriveCalibration(openSamples, closedSamples) {
  const robustMedian = (values) => {
    const sorted = values.filter(Number.isFinite).map(clamp01).sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };
  const open = robustMedian(openSamples);
  const closed = robustMedian(closedSamples);
  if (open === null || closed === null) return { ok: false, reason: "missing-samples" };
  const separation = closed - open;
  if (separation < 0.16) return { ok: false, reason: "low-separation", open, closed, separation };
  return {
    ok: true,
    open,
    closed,
    separation,
    openThreshold: clamp01(open + separation * 0.18),
    closedThreshold: clamp01(open + separation * 0.38),
  };
}

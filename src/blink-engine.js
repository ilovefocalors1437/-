export const DEFAULT_BLINK_CONFIG = Object.freeze({
  closedThreshold: 0.4,
  openThreshold: 0.24,
  minBlinkMs: 90,
  maxBlinkMs: 900,
  longCloseMs: 5_000,
  smoothing: 0.42,
});

const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

/**
 * Turns MediaPipe eyeBlink blendshape scores into stable eye events.
 * Both eyes must agree, thresholds use hysteresis, and no event is emitted
 * until the eyes reopen. Long closures are handled once while still closed.
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
  }

  reset() {
    this.eyeState = "unknown";
    this.filteredLeft = null;
    this.filteredRight = null;
    this.closedAt = null;
    this.longCloseHandled = false;
    this.tracking = false;
  }

  process({ timestamp, leftScore = 0, rightScore = 0, facePresent = true }) {
    const events = [];

    if (!facePresent) {
      if (this.tracking) events.push({ type: "tracking-lost", timestamp });
      this.eyeState = "unknown";
      this.closedAt = null;
      this.longCloseHandled = false;
      this.filteredLeft = null;
      this.filteredRight = null;
      this.tracking = false;
      return events;
    }

    if (!this.tracking) events.push({ type: "tracking-found", timestamp });
    this.tracking = true;

    const alpha = this.config.smoothing;
    const left = clamp01(leftScore);
    const right = clamp01(rightScore);
    this.filteredLeft = this.filteredLeft === null
      ? left
      : alpha * left + (1 - alpha) * this.filteredLeft;
    this.filteredRight = this.filteredRight === null
      ? right
      : alpha * right + (1 - alpha) * this.filteredRight;

    // Requiring both eyes reduces winks and landmark jitter being misread as input.
    const definitelyClosed =
      this.filteredLeft >= this.config.closedThreshold &&
      this.filteredRight >= this.config.closedThreshold;
    const definitelyOpen =
      this.filteredLeft <= this.config.openThreshold &&
      this.filteredRight <= this.config.openThreshold;

    if (this.eyeState === "unknown") {
      if (definitelyOpen) this.eyeState = "open";
      else if (definitelyClosed) {
        this.eyeState = "closed";
        this.closedAt = timestamp;
      }
      return events;
    }

    if (this.eyeState === "open" && definitelyClosed) {
      this.eyeState = "closed";
      this.closedAt = timestamp;
      this.longCloseHandled = false;
      events.push({ type: "eyes-closed", timestamp });
      return events;
    }

    if (this.eyeState === "closed") {
      const duration = timestamp - this.closedAt;

      if (!this.longCloseHandled && duration >= this.config.longCloseMs) {
        this.longCloseHandled = true;
        events.push({ type: "long-close", timestamp, duration });
      }

      if (definitelyOpen) {
        this.eyeState = "open";
        this.closedAt = null;

        if (this.longCloseHandled) {
          events.push({ type: "long-close-ended", timestamp, duration });
        } else if (
          duration >= this.config.minBlinkMs &&
          duration <= this.config.maxBlinkMs
        ) {
          events.push({ type: "blink", timestamp, duration });
        } else {
          events.push({ type: "closure-rejected", timestamp, duration });
        }
      }
    }

    return events;
  }

  getTelemetry(timestamp = performance.now()) {
    return {
      left: this.filteredLeft ?? 0,
      right: this.filteredRight ?? 0,
      state: this.eyeState,
      closedForMs:
        this.eyeState === "closed" && this.closedAt !== null
          ? Math.max(0, timestamp - this.closedAt)
          : 0,
    };
  }
}

export function deriveCalibration(openSamples, closedSamples) {
  const robustMedian = (values) => {
    const sorted = values
      .filter(Number.isFinite)
      .map(clamp01)
      .sort((a, b) => a - b);
    if (!sorted.length) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  const open = robustMedian(openSamples);
  const closed = robustMedian(closedSamples);
  if (open === null || closed === null) {
    return { ok: false, reason: "missing-samples" };
  }

  const separation = closed - open;
  if (separation < 0.16) {
    return { ok: false, reason: "low-separation", open, closed, separation };
  }

  return {
    ok: true,
    open,
    closed,
    separation,
    openThreshold: clamp01(open + separation * 0.18),
    closedThreshold: clamp01(open + separation * 0.38),
  };
}

export const WINK_CONFIRM_MS = 460;
export const HOLD_STEP_MS = 200;
export const NORMAL_SCAN_MS = 1_200;

export const CHARACTER_BANKS = Object.freeze([
  {
    id: "consonants",
    label: "พยัญชนะ",
    shortLabel: "ก–ฮ",
    items: [..."กขฃคฅฆงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ"],
  },
  {
    id: "vowels",
    label: "สระและวรรณยุกต์",
    shortLabel: "สระ",
    items: ["ะ", "า", "ิ", "ี", "ึ", "ื", "ุ", "ู", "เ", "แ", "โ", "ใ", "ไ", "ำ", "ั", "็", "่", "้", "๊", "๋", "์", "ๆ"],
  },
]);

export class RemoteScanner {
  constructor({ banks = CHARACTER_BANKS, intervalMs = NORMAL_SCAN_MS } = {}) {
    this.banks = banks;
    this.intervalMs = intervalMs;
    this.bankIndex = 0;
    this.itemIndex = 0;
    this.lastAdvancedAt = null;
    this.paused = true;
  }

  get bank() {
    return this.banks[this.bankIndex];
  }

  get item() {
    return this.bank.items[this.itemIndex];
  }

  advance(timestamp = performance.now()) {
    this.itemIndex = (this.itemIndex + 1) % this.bank.items.length;
    this.lastAdvancedAt = timestamp;
    return this.item;
  }

  start(timestamp = performance.now()) {
    this.paused = false;
    this.lastAdvancedAt = timestamp;
  }

  pause() {
    this.paused = true;
  }

  tick(timestamp) {
    if (this.paused) return false;
    if (this.lastAdvancedAt === null) this.lastAdvancedAt = timestamp;
    if (timestamp - this.lastAdvancedAt < this.intervalMs) return false;
    const steps = Math.floor((timestamp - this.lastAdvancedAt) / this.intervalMs);
    this.itemIndex = (this.itemIndex + steps) % this.bank.items.length;
    this.lastAdvancedAt += steps * this.intervalMs;
    return true;
  }

  nextBank(timestamp = performance.now()) {
    this.bankIndex = (this.bankIndex + 1) % this.banks.length;
    this.itemIndex = 0;
    this.lastAdvancedAt = timestamp;
    return this.bank;
  }

  setBank(id, timestamp = performance.now()) {
    const index = this.banks.findIndex((bank) => bank.id === id);
    if (index < 0) return false;
    this.bankIndex = index;
    this.itemIndex = 0;
    this.lastAdvancedAt = timestamp;
    return true;
  }

  selectIndex(index, timestamp = performance.now()) {
    if (!Number.isInteger(index) || index < 0 || index >= this.bank.items.length) {
      return false;
    }
    this.itemIndex = index;
    this.lastAdvancedAt = timestamp;
    return true;
  }

  replaceBanks(banks) {
    const activeId = this.bank?.id;
    this.banks = banks;
    this.bankIndex = Math.max(0, banks.findIndex((bank) => bank.id === activeId));
    this.itemIndex = Math.min(this.itemIndex, this.bank.items.length - 1);
  }
}

// Resolves one short bilateral blink after a small grace period. A second blink
// switches banks. One-eye events never enter this resolver, so acceleration and
// selection cannot fire from the same gesture.
export class BlinkCommandResolver {
  constructor({ confirmMs = WINK_CONFIRM_MS } = {}) {
    this.confirmMs = confirmMs;
    this.reset();
  }

  reset() {
    this.eye = null;
    this.deadline = null;
    this.candidate = null;
  }

  record(timestamp, candidate, eye) {
    if (this.deadline !== null && timestamp <= this.deadline) {
      const firstEye = this.eye;
      this.reset();
      return { type: "switch-bank", firstEye, secondEye: eye };
    }
    this.candidate = candidate;
    this.eye = eye;
    this.deadline = timestamp + this.confirmMs;
    return { type: "pending-select", candidate, eye, deadline: this.deadline };
  }

  resolve(timestamp) {
    if (this.deadline === null || timestamp < this.deadline) return null;
    const candidate = this.candidate;
    const eye = this.eye;
    this.reset();
    return { type: "select", candidate, eye };
  }

  cancel() {
    const hadPending = this.deadline !== null;
    this.reset();
    return hadPending;
  }
}

// Kept as a temporary alias for older imports while local drafts migrate.
export const RouletteScanner = RemoteScanner;

export function applyToken(text, token) {
  return `${text}${token}`;
}

export function removeLastGrapheme(text) {
  if (!text) return "";
  if (typeof Intl?.Segmenter === "function") {
    const segments = [...new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text)];
    return text.slice(0, segments.at(-1).index);
  }
  return Array.from(text).slice(0, -1).join("");
}

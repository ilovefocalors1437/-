export const WINK_CONFIRM_MS = 460;
export const HOLD_STEP_MS = 200;
export const STOP_ACTION = "หยุด";

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
  {
    id: "stop",
    label: "หยุด",
    shortLabel: "หยุด",
    items: [STOP_ACTION],
  },
]);

export class RemoteScanner {
  constructor({ banks = CHARACTER_BANKS } = {}) {
    this.banks = banks;
    this.bankIndex = 0;
    this.itemIndex = 0;
  }

  get bank() {
    return this.banks[this.bankIndex];
  }

  get item() {
    return this.bank.items[this.itemIndex];
  }

  advance() {
    this.itemIndex = (this.itemIndex + 1) % this.bank.items.length;
    return this.item;
  }

  nextBank() {
    this.bankIndex = (this.bankIndex + 1) % this.banks.length;
    this.itemIndex = 0;
    return this.bank;
  }

  setBank(id) {
    const index = this.banks.findIndex((bank) => bank.id === id);
    if (index < 0) return false;
    this.bankIndex = index;
    this.itemIndex = 0;
    return true;
  }

  selectIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.bank.items.length) {
      return false;
    }
    this.itemIndex = index;
    return true;
  }

  replaceBanks(banks) {
    const activeId = this.bank?.id;
    this.banks = banks;
    this.bankIndex = Math.max(0, banks.findIndex((bank) => bank.id === activeId));
    this.itemIndex = Math.min(this.itemIndex, this.bank.items.length - 1);
  }
}

// Resolves a short one-eye wink after a small grace period. A second wink inside
// that period switches banks. Long holds never call this class, so hold and tap
// cannot both fire for the same gesture.
export class WinkCommandResolver {
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

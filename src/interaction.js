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
    items: ["ะ", "า", "ิ", "ี", "ึ", "ื", "ุ", "ู", "เ", "แ", "โ", "ใ", "ไ", "ำ", "ั", "็", "่", "้", "๊", "๋", "์", "ๆ", " ", "⌫"],
  },
  {
    id: "quick",
    label: "ข้อความด่วน",
    shortLabel: "คำด่วน",
    items: ["ใช่", "ไม่", "หิว", "น้ำ", "เจ็บ", "ช่วยด้วย", "ขอบคุณ", "ห้องน้ำ", "ร้อน", "หนาว", "พักก่อน", "เรียกคนดูแล"],
  },
]);

export class RouletteScanner {
  constructor({ banks = CHARACTER_BANKS, intervalMs = 1_350 } = {}) {
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

  setInterval(intervalMs) {
    this.intervalMs = Math.max(450, Number(intervalMs) || 1_350);
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
}

export class BlinkBurstBuffer {
  constructor({ switchBlinkCount = 2, burstWindowMs = 1_300 } = {}) {
    this.configure({ switchBlinkCount, burstWindowMs });
    this.reset();
  }

  configure({ switchBlinkCount = this.switchBlinkCount, burstWindowMs = this.burstWindowMs } = {}) {
    this.switchBlinkCount = Math.max(2, Math.round(Number(switchBlinkCount) || 2));
    this.burstWindowMs = Math.max(500, Number(burstWindowMs) || 1_300);
  }

  reset() {
    this.count = 0;
    this.deadline = null;
    this.candidate = null;
  }

  addBlink(timestamp, candidate) {
    if (this.count === 0) {
      this.candidate = candidate;
      this.deadline = timestamp + this.burstWindowMs;
    }
    this.count += 1;

    if (this.count >= this.switchBlinkCount) {
      const count = this.count;
      this.reset();
      return { type: "switch-bank", count };
    }
    return { type: "pending", count: this.count, deadline: this.deadline };
  }

  flush(timestamp) {
    if (!this.count || timestamp < this.deadline) return null;
    const count = this.count;
    const candidate = this.candidate;
    this.reset();
    return count === 1
      ? { type: "select", candidate }
      : { type: "cancel", count };
  }

  cancel() {
    const hadPending = this.count > 0;
    this.reset();
    return hadPending;
  }
}

export function applyToken(text, token) {
  if (token === "⌫") return Array.from(text).slice(0, -1).join("");
  const quickPhrases = new Set(CHARACTER_BANKS.find((bank) => bank.id === "quick").items);
  if (quickPhrases.has(token)) {
    const spacer = text && !text.endsWith(" ") ? " " : "";
    return `${text}${spacer}${token} `;
  }
  return `${text}${token}`;
}


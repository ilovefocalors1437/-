export const BLINK_WINDOW_MS = 1_350;
export const CONFIRM_WINDOW_MS = 550;

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
    items: ["ะ","า","ิ","ี","ึ","ื","ุ","ู","เ","แ","โ","ใ","ไ","ำ","ั","็","่","้","๊","๋","์","ๆ"],
  },
]);

export class RouletteScanner {
  constructor({ banks = CHARACTER_BANKS, intervalMs = BLINK_WINDOW_MS } = {}) {
    this.banks = banks;
    this.intervalMs = intervalMs;
    this.bankIndex = 0;
    this.itemIndex = 0;
    this.lastAdvancedAt = null;
    this.paused = true;
  }
  get bank() { return this.banks[this.bankIndex]; }
  get item() { return this.bank.items[this.itemIndex]; }
  advance(timestamp = performance.now()) { this.itemIndex = (this.itemIndex + 1) % this.bank.items.length; this.lastAdvancedAt = timestamp; return this.item; }
  start(timestamp = performance.now()) { this.paused = false; this.lastAdvancedAt = timestamp; }
  pause() { this.paused = true; }
  tick(timestamp = performance.now()) {
    if (this.paused || this.lastAdvancedAt === null || timestamp - this.lastAdvancedAt < this.intervalMs) return false;
    const steps = Math.floor((timestamp - this.lastAdvancedAt) / this.intervalMs);
    this.itemIndex = (this.itemIndex + steps) % this.bank.items.length;
    this.lastAdvancedAt += steps * this.intervalMs;
    return true;
  }
  nextBank(timestamp = performance.now()) { this.bankIndex = (this.bankIndex + 1) % this.banks.length; this.itemIndex = 0; this.lastAdvancedAt = timestamp; return this.bank; }
  setBank(id, timestamp = performance.now()) { const index = this.banks.findIndex((bank) => bank.id === id); if (index < 0) return false; this.bankIndex = index; this.itemIndex = 0; this.lastAdvancedAt = timestamp; return true; }
  selectIndex(index, timestamp = performance.now()) { if (!Number.isInteger(index) || index < 0 || index >= this.bank.items.length) return false; this.itemIndex = index; this.lastAdvancedAt = timestamp; return true; }
  replaceBanks(banks) { const activeId = this.bank?.id; this.banks = banks; this.bankIndex = Math.max(0, banks.findIndex((bank) => bank.id === activeId)); this.itemIndex = Math.min(this.itemIndex, this.bank.items.length - 1); }
}

export class BlinkWindowCounter {
  constructor({ windowMs = BLINK_WINDOW_MS, confirmMs = CONFIRM_WINDOW_MS } = {}) { this.windowMs = windowMs; this.confirmMs = confirmMs; this.reset(); }
  reset() { this.count = 0; this.startedAt = null; this.deadline = null; this.candidate = null; }
  start(timestamp, candidate) { if (this.deadline !== null) return false; this.candidate = candidate; this.startedAt = timestamp; this.deadline = timestamp + this.windowMs; return true; }
  recordBlink(timestamp) { if (this.deadline === null) return { type:"ignored",count:0 }; this.count += 1; this.deadline = this.count === 1 ? timestamp + this.confirmMs : timestamp; return { type:"pending",count:this.count,deadline:this.deadline }; }
  resolve(timestamp, { eyesClosed = false } = {}) { if (this.deadline === null || timestamp < this.deadline || eyesClosed) return null; const count=this.count,candidate=this.candidate; this.reset(); if(count===0)return{type:"pass",candidate}; if(count===1)return{type:"select",candidate}; return{type:"switch-bank",count}; }
  cancel() { const hadPending=this.count>0; this.reset(); return hadPending; }
}

export function applyToken(text, token) { return `${text}${token}`; }
export function removeLastGrapheme(text) { if(!text)return""; if(typeof Intl?.Segmenter==="function"){const segments=[...new Intl.Segmenter("th",{granularity:"grapheme"}).segment(text)];return text.slice(0,segments.at(-1).index);}return Array.from(text).slice(0,-1).join(""); }

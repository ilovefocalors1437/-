export const CHAT_SEND_ACTION = "ส่งข้อความ";

export function validateSupabaseConfig(urlValue, key) {
  let url;
  try { url = new URL(urlValue); } catch { throw new Error("ยังไม่ได้ตั้งค่า Supabase URL"); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") throw new Error("Supabase URL ต้องเป็น origin เท่านั้น");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) throw new Error("Supabase ต้องใช้ HTTPS ยกเว้นการพัฒนาใน localhost");
  if (typeof key !== "string" || key.startsWith("YOUR_") || !(key.startsWith("sb_publishable_") || key.startsWith("eyJ"))) throw new Error("ใส่ Supabase Publishable/anon key ก่อน (ห้ามใช้ service_role)");
  return { url: url.origin, key };
}

export class ChatDelivery {
  constructor(sendMessage, { uuid = () => crypto.randomUUID(), now = Date.now } = {}) {
    this.sendMessage = sendMessage;
    this.uuid = uuid;
    this.now = now;
    this.pending = null;
    this.busy = false;
    this.lastAccepted = null;
  }
  wasRecentlyAccepted(body, recipientId) {
    return this.lastAccepted?.body === body && this.lastAccepted?.recipientId === recipientId && this.now() - this.lastAccepted.at < 10_000;
  }
  async send(body, recipientId) {
    if (this.busy) return { status: "sending" };
    if (!this.pending && this.wasRecentlyAccepted(body, recipientId)) return { status: "already-accepted" };
    if (!this.pending && (!recipientId || !body.trim() || body.length > 2000)) throw new Error("เลือกห้องแชตและสร้างข้อความ 1–2,000 ตัวอักษรก่อน");
    this.pending ||= { clientId: this.uuid(), recipientId, body };
    this.busy = true;
    try {
      const result = await this.sendMessage(this.pending);
      if (result.status === "accepted") {
        this.lastAccepted = { ...this.pending, at: this.now() };
        this.pending = null;
      }
      return result;
    } finally { this.busy = false; }
  }
}

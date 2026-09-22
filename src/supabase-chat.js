import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config.js";
import { ChatDelivery, validateSupabaseConfig } from "./chat-client.js";

const SUPABASE_MODULE = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export function mountSupabaseChat({ getMessage, onAvailability, onSendStatus = () => {}, onSent = () => {} }) {
  const $ = (id) => document.getElementById(id);
  let supabase = null;
  let user = null;
  let profile = null;
  let contacts = [];
  let conversations = [];
  let selected = null;
  let delivery = null;
  let messageChannel = null;
  let available = false;

  const say = (message, bad = false) => { $("chatFeedback").textContent = message; $("chatFeedback").classList.toggle("is-error", bad); };
  const fail = (result) => { if (result.error) throw result.error; return result.data; };

  function refreshAvailability() {
    const next = Boolean(user && selected);
    if (next !== available) { available = next; onAvailability(next); }
    const recent = selected && delivery?.wasRecentlyAccepted(getMessage(), selected.thread_id);
    $("chatSend").disabled = !next || delivery?.busy || (!delivery?.pending && (!getMessage().trim() || recent));
  }

  async function insertMessage(record) {
    const { data, error } = await supabase.from("chat_messages").insert({
      client_id: record.clientId,
      thread_id: record.recipientId,
      body: record.body,
    }).select("id,created_at").single();
    if (!error) return { status: "accepted", row: data };
    if (error.code === "23505") return { status: "accepted" };
    throw error;
  }

  function renderContacts() {
    const host = $("contactRequests");
    host.replaceChildren();
    const pending = contacts.filter((item) => item.status === "pending");
    $("contactRequestCount").textContent = pending.length ? `${pending.length} คำขอ` : "";
    for (const item of contacts) {
      const row = document.createElement("div"); row.className = "contact-row";
      const copy = document.createElement("div");
      const name = document.createElement("strong"); name.textContent = item.display_name;
      const detail = document.createElement("small"); detail.textContent = item.status === "accepted" ? item.public_uid : item.direction === "incoming" ? `ขอเพิ่มคุณ · ${item.public_uid}` : `รอตอบรับ · ${item.public_uid}`;
      copy.append(name, detail); row.append(copy);
      if (item.status === "pending" && item.direction === "incoming") {
        for (const [label, accept] of [["รับ", true], ["ปฏิเสธ", false]]) {
          const button = document.createElement("button"); button.type = "button"; button.className = accept ? "text-button" : "text-button danger"; button.textContent = label;
          button.addEventListener("click", async () => { button.disabled = true; try { fail(await supabase.rpc("respond_contact", { friendship_id: item.friendship_id, accept_request: accept })); await refreshAll(); } catch (error) { say(error.message, true); } });
          row.append(button);
        }
      } else if (item.status === "accepted") {
        const button = document.createElement("button"); button.type = "button"; button.className = "text-button"; button.textContent = "แชต";
        button.addEventListener("click", () => void openDm(item)); row.append(button);
      }
      host.append(row);
    }
    if (!contacts.length) { const empty = document.createElement("p"); empty.className = "empty-chat"; empty.textContent = "ยังไม่มีเพื่อน เพิ่มด้วย UID ได้ด้านบน"; host.append(empty); }
    renderGroupMembers();
  }

  function renderGroupMembers() {
    const host = $("groupMemberList"); host.replaceChildren();
    for (const item of contacts.filter((entry) => entry.status === "accepted")) {
      const label = document.createElement("label"); const box = document.createElement("input"); box.type = "checkbox"; box.name = "groupMember"; box.value = item.other_id;
      label.append(box, document.createTextNode(`${item.display_name} · ${item.public_uid}`)); host.append(label);
    }
    if (!host.children.length) host.textContent = "ต้องมีเพื่อนที่ตอบรับแล้วอย่างน้อย 1 คน";
  }

  function renderConversations() {
    const host = $("conversationList"); host.replaceChildren();
    for (const thread of conversations) {
      const button = document.createElement("button"); button.type = "button"; button.className = `conversation-row${selected?.thread_id === thread.thread_id ? " is-active" : ""}`;
      const avatar = document.createElement("span"); avatar.className = "conversation-avatar"; avatar.textContent = thread.kind === "group" ? "群" : (thread.title?.[0] || "E").toUpperCase();
      const copy = document.createElement("span"); const title = document.createElement("strong"); title.textContent = thread.title; const detail = document.createElement("small"); detail.textContent = thread.last_message || (thread.kind === "group" ? `${thread.member_count} สมาชิก` : "เริ่มบทสนทนา"); copy.append(title, detail);
      button.append(avatar, copy); button.addEventListener("click", () => void selectConversation(thread)); host.append(button);
    }
    if (!conversations.length) { const empty = document.createElement("p"); empty.className = "empty-chat"; empty.textContent = "เริ่ม DM จากรายชื่อเพื่อน หรือสร้างกลุ่มด้วยปุ่ม ＋"; host.append(empty); }
  }

  function renderMessages(rows) {
    const list = $("chatMessages"); list.replaceChildren();
    if (!rows.length) { const empty = document.createElement("p"); empty.className = "empty-chat"; empty.textContent = selected ? "ยังไม่มีข้อความ เริ่มคุยได้เลย" : "เลือกเพื่อนหรือกลุ่มเพื่อดูข้อความ"; list.append(empty); return; }
    for (const row of rows) {
      const bubble = document.createElement("div"); bubble.className = `chat-bubble ${row.sender_id === user.id ? "is-mine" : "is-theirs"}`;
      if (selected?.kind === "group" && row.sender_id !== user.id) { const sender = document.createElement("b"); sender.textContent = row.sender_name || "สมาชิก"; bubble.append(sender); }
      const body = document.createElement("p"); body.textContent = row.body;
      const time = document.createElement("time"); time.dateTime = row.created_at; time.textContent = new Date(row.created_at).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
      bubble.append(body, time); list.append(bubble);
    }
    list.scrollTop = list.scrollHeight;
  }

  async function loadContacts() { if (!user) return; contacts = fail(await supabase.rpc("list_contacts")) || []; renderContacts(); }
  async function loadConversations() { if (!user) return; conversations = fail(await supabase.rpc("list_chat_threads")) || []; if (selected) selected = conversations.find((item) => item.thread_id === selected.thread_id) || null; renderConversations(); refreshAvailability(); }

  async function loadMessages() {
    if (!user || !selected) return renderMessages([]);
    const rows = fail(await supabase.from("chat_messages").select("id,sender_id,body,created_at,sender:profiles!chat_messages_sender_id_fkey(display_name)").eq("thread_id", selected.thread_id).order("created_at", { ascending: false }).limit(200));
    renderMessages((rows || []).reverse().map((row) => ({ ...row, sender_name: row.sender?.display_name })));
  }

  async function selectConversation(thread) {
    selected = thread; $("conversationTitle").textContent = thread.title; $("conversationKind").textContent = thread.kind === "group" ? `${thread.member_count} สมาชิก` : "ข้อความส่วนตัว";
    renderConversations(); refreshAvailability(); await loadMessages();
  }

  async function openDm(contact) {
    try {
      const threadId = fail(await supabase.rpc("get_or_create_dm", { other_user_id: contact.other_id }));
      await loadConversations(); const thread = conversations.find((item) => item.thread_id === threadId); if (thread) await selectConversation(thread);
    } catch (error) { say(error.message, true); }
  }

  async function subscribe() {
    if (messageChannel) await supabase.removeChannel(messageChannel);
    if (!user) return;
    messageChannel = supabase.channel(`eyesay-chat-${user.id}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
      if (payload.new.thread_id === selected?.thread_id) void loadMessages();
      void loadConversations();
    }).subscribe((status) => { if (["CHANNEL_ERROR", "TIMED_OUT"].includes(status)) say("การอัปเดตสดหลุด กดรีเฟรชได้", true); });
  }

  async function refreshAll() { await loadContacts(); await loadConversations(); if (selected) await loadMessages(); }

  async function showUser(nextUser) {
    user = nextUser; $("authCard").hidden = Boolean(user); $("chatSignedIn").hidden = !user;
    if (!user) { profile = null; contacts = []; conversations = []; selected = null; delivery = null; renderContacts(); renderConversations(); renderMessages([]); refreshAvailability(); await subscribe(); return; }
    profile = fail(await supabase.from("profiles").select("id,public_uid,display_name").eq("id", user.id).single());
    $("accountName").textContent = profile.display_name; $("publicUid").textContent = profile.public_uid; $("accountAvatar").textContent = profile.display_name[0]?.toUpperCase() || "E";
    delivery = new ChatDelivery(insertMessage); await refreshAll(); await subscribe();
  }

  async function send() {
    const report = (text, bad = false) => { say(text, bad); onSendStatus(text, bad); };
    if (!available || !delivery) return report("ล็อกอินและเลือกห้องแชตก่อน", true);
    if (delivery.busy) return;
    if (!delivery.pending && delivery.wasRecentlyAccepted(getMessage(), selected.thread_id)) return report("ข้อความนี้เพิ่งส่งแล้ว รอ 10 วินาทีหากต้องการส่งซ้ำ");
    report(delivery.pending ? "กำลังส่งคำขอเดิมซ้ำ…" : "กำลังส่งข้อความ…");
    const work = delivery.send(getMessage(), selected.thread_id); refreshAvailability();
    try { const result = await work; if (["accepted", "already-accepted"].includes(result.status)) { report("ส่งข้อความแล้ว ✓"); if (result.status === "accepted") onSent(); await loadMessages(); await loadConversations(); } }
    catch (error) { report(`${error.message} — กดส่งอีกครั้งเพื่อใช้ข้อความและห้องเดิม`, true); }
    finally { refreshAvailability(); }
  }

  async function init() {
    try {
      const config = validateSupabaseConfig(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
      const { createClient } = await import(SUPABASE_MODULE);
      supabase = createClient(config.url, config.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
      const { data, error } = await supabase.auth.getSession(); if (error) throw error; await showUser(data.session?.user || null);
      supabase.auth.onAuthStateChange((_event, session) => setTimeout(() => void showUser(session?.user || null).catch((error) => say(error.message, true)), 0));
      say(user ? "พร้อมแชต" : "เข้าสู่ระบบด้วย Google เพื่อเริ่มแชต");
    } catch (error) { $("googleLogin").disabled = true; $("setupNotice").hidden = false; say(error.message, true); }
  }

  $("googleLogin").addEventListener("click", async () => {
    try { fail(await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}${location.pathname}#chat`, queryParams: { access_type: "offline", prompt: "consent" } } })); }
    catch (error) { say(error.message, true); }
  });
  $("logoutButton").addEventListener("click", async () => { const { error } = await supabase.auth.signOut({ scope: "local" }); if (error) say(error.message, true); });
  $("copyUid").addEventListener("click", async () => { try { await navigator.clipboard.writeText(profile.public_uid); say("คัดลอก UID แล้ว"); } catch { say("คัดลอกไม่ได้ กรุณาเลือก UID แล้วคัดลอก", true); } });
  $("addContactForm").addEventListener("submit", async (event) => { event.preventDefault(); try { fail(await supabase.rpc("request_contact", { target_public_uid: $("contactUid").value.trim().toUpperCase() })); $("contactUid").value = ""; say("ส่งคำขอแล้ว"); await refreshAll(); } catch (error) { say(error.message, true); } });
  $("refreshChat").addEventListener("click", async () => { try { await refreshAll(); say("รีเฟรชแล้ว"); } catch (error) { say(error.message, true); } });
  $("chatSend").addEventListener("click", send);
  $("openGroupDialog").addEventListener("click", () => { renderGroupMembers(); $("groupDialog").showModal(); });
  $("closeGroupDialog").addEventListener("click", () => $("groupDialog").close());
  $("groupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const memberIds = [...document.querySelectorAll('input[name="groupMember"]:checked')].map((item) => item.value);
    if (!memberIds.length) return say("เลือกสมาชิกอย่างน้อย 1 คน", true);
    try { const threadId = fail(await supabase.rpc("create_group", { group_name: $("groupName").value.trim(), member_ids: memberIds })); $("groupDialog").close(); $("groupForm").reset(); await loadConversations(); const thread = conversations.find((item) => item.thread_id === threadId); if (thread) await selectConversation(thread); say("สร้างกลุ่มแล้ว"); }
    catch (error) { say(error.message, true); }
  });
  window.addEventListener("beforeunload", (event) => { if (delivery?.pending) { event.preventDefault(); event.returnValue = ""; } });

  renderContacts(); renderConversations(); renderMessages([]); refreshAvailability(); void init();
  return { send, refresh: refreshAvailability };
}

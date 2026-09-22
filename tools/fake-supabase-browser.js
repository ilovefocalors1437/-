// Browser-smoke-only implementation of the small Supabase SDK surface EyeSay uses.
export function createClient() {
  const user = { id: "11111111-1111-4111-8111-111111111111", email: "test@example.com" };
  const friend = { friendship_id: "33333333-3333-4333-8333-333333333333", other_id: "22222222-2222-4222-8222-222222222222", public_uid: "ES-ABCDEF123456", display_name: "เพื่อนทดสอบ", status: "accepted", direction: "incoming" };
  const thread = { thread_id: "44444444-4444-4444-8444-444444444444", kind: "dm", title: "เพื่อนทดสอบ", member_count: 2, last_message: null, updated_at: new Date().toISOString() };
  const listeners = [];
  const messages = [];
  let session = null;
  globalThis.__fakeSent = messages;
  const ok = (data) => ({ data, error: null });
  const notify = () => listeners.forEach((callback) => callback(session ? "SIGNED_IN" : "SIGNED_OUT", session));

  function query(table) {
    const state = { insert: null };
    const q = {
      select() { return q; }, eq() { return q; }, order() { return q; },
      limit() { return Promise.resolve(ok(table === "chat_messages" ? messages : [])); },
      insert(value) { state.insert = value; return q; },
      single() {
        if (table === "profiles") return Promise.resolve(ok({ id: user.id, public_uid: "ES-123456ABCDEF", display_name: "ผู้ใช้ทดสอบ" }));
        if (table === "chat_messages" && state.insert) {
          const row = { id: crypto.randomUUID(), sender_id: user.id, created_at: new Date().toISOString(), ...state.insert };
          messages.push(row); thread.last_message = row.body; return Promise.resolve(ok(row));
        }
        return Promise.resolve(ok(null));
      },
    };
    return q;
  }

  return {
    auth: {
      getSession: async () => ok({ session }),
      onAuthStateChange(callback) { listeners.push(callback); return ok({ subscription: { unsubscribe() {} } }); },
      async signInWithOAuth() { session = { user }; setTimeout(notify); return ok({ provider: "google" }); },
      async signOut() { session = null; setTimeout(notify); return ok(null); },
    },
    from: query,
    async rpc(name) {
      if (name === "list_contacts") return ok([friend]);
      if (name === "list_chat_threads") return ok([thread]);
      if (name === "get_or_create_dm" || name === "create_group") return ok(thread.thread_id);
      return ok(null);
    },
    channel() { return { on() { return this; }, subscribe() { return this; } }; },
    async removeChannel() {},
  };
}

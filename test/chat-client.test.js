import test from "node:test";
import assert from "node:assert/strict";
import { ChatDelivery, validateSupabaseConfig } from "../src/chat-client.js";

test("Supabase config accepts browser publishable keys and rejects secrets/bad URLs", () => {
  assert.deepEqual(validateSupabaseConfig("https://project.supabase.co", "sb_publishable_test"), { url: "https://project.supabase.co", key: "sb_publishable_test" });
  assert.equal(validateSupabaseConfig("http://localhost:54321", "eyJtest").url, "http://localhost:54321");
  for (const [url, key] of [
    ["http://public.example", "sb_publishable_test"],
    ["https://project.supabase.co/path", "sb_publishable_test"],
    ["https://project.supabase.co", "YOUR_PUBLISHABLE_OR_ANON_KEY"],
    ["https://project.supabase.co", "service_role_secret"],
  ]) assert.throws(() => validateSupabaseConfig(url, key));
});

test("ambiguous retries keep the same body, recipient, and client id", async () => {
  const attempts = [];
  let result = new Error("network lost");
  const delivery = new ChatDelivery(async (record) => {
    attempts.push({ ...record });
    if (result instanceof Error) throw result;
    return result;
  }, { uuid: () => "request-one", now: () => 100 });
  await assert.rejects(delivery.send("น้ำ", "friend-a"));
  result = { status: "accepted" };
  await delivery.send("ข้อความใหม่", "friend-b");
  assert.deepEqual(attempts, [
    { clientId: "request-one", body: "น้ำ", recipientId: "friend-a" },
    { clientId: "request-one", body: "น้ำ", recipientId: "friend-a" },
  ]);
  assert.equal(delivery.pending, null);
});

test("concurrent send gestures create one request", async () => {
  let release;
  let calls = 0;
  const delivery = new ChatDelivery(async () => { calls++; return new Promise((resolve) => { release = resolve; }); });
  const first = delivery.send("สวัสดี", "friend-a");
  assert.equal((await delivery.send("สวัสดี", "friend-a")).status, "sending");
  assert.equal(calls, 1);
  release({ status: "accepted" });
  await first;
});

test("same message can intentionally be sent again after ten seconds", async () => {
  let time = 0;
  let calls = 0;
  const delivery = new ChatDelivery(async () => { calls++; return { status: "accepted" }; }, { now: () => time });
  await delivery.send("ช่วยด้วย", "friend-a");
  assert.equal((await delivery.send("ช่วยด้วย", "friend-a")).status, "already-accepted");
  time = 10_000;
  await delivery.send("ช่วยด้วย", "friend-a");
  assert.equal(calls, 2);
});

test("message validation requires a recipient and caps length", async () => {
  const delivery = new ChatDelivery(async () => ({ status: "accepted" }));
  await assert.rejects(delivery.send("", "friend"));
  await assert.rejects(delivery.send("hello", ""));
  await assert.rejects(delivery.send("x".repeat(2001), "friend"));
  assert.equal(delivery.pending, null);
});

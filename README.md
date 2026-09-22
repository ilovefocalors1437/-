# EyeSay

**ระบบแปลงการกะพริบตาเป็นข้อความสำหรับผู้มีภาวะอัมพาตและบกพร่องทางการพูด**

เว็บต้นแบบใช้ MediaPipe Face Landmarker ตรวจตาซ้าย/ขวาบนอุปกรณ์ เพื่อให้ผู้ใช้เลือกตัวอักษร ควบคุมหน้า และส่งข้อความโดยไม่ใช้มือ ภาพกล้องไม่ถูกอัปโหลดไป Supabase

> MVP สำหรับทดลองและเก็บข้อมูล ไม่ใช่อุปกรณ์การแพทย์ และไม่ควรเป็นช่องทางฉุกเฉินเพียงช่องทางเดียว

## 4 หน้า

- **หน้าหลัก** — ประกอบข้อความจากพยัญชนะและสระ
- **แชต** — Google Sign-In, เพิ่มเพื่อนด้วย UID, DM และ group chat; ผู้ใช้ทั่วไปพิมพ์ได้
- **วิธีใช้** — แสดง gesture และขั้นตอนปรับเทียบแทนปุ่มคู่มือเดิม
- **สนับสนุน** — QR PromptPay และข้อความ “แรงใจ 😭💖”

## การควบคุมแบบรีโมต

- ขยิบตาซ้ายหรือขวา **1 ครั้ง**: เลือกตัวปัจจุบันหลังรอหน้าต่างยืนยัน 0.46 วินาที
- ขยิบ **2 ครั้ง** ภายใน 0.46 วินาที: สลับ พยัญชนะ → สระ → หยุด/ส่ง
- ขยิบตาข้างเดียวค้างเกิน **0.36 วินาที**: เลื่อนหนึ่งตัวทุก **0.2 วินาที** จนลืมตา
- หลับ–ลืม **สองตา**: วน หน้าหลัก → แชต → วิธีใช้
- ในแท็บ **หยุด**: สองตายืนยันหยุดระบบเลือก หนึ่งตาย้อนกลับ
- ในแท็บ **ส่งข้อความ**: สองตายืนยันส่ง หนึ่งตาย้อนกลับ

Gesture hold กับ wink ไม่ซ้อนกัน: ระบบยังไม่เลือกในจังหวะปิดตา แต่รอจนลืมตา หากค้างถึง hold threshold แล้ว gesture นั้นจะกลายเป็นการเลื่อนและไม่มี event เลือกตามมา

## เริ่มในเครื่อง

```powershell
npm test
npm run serve
```

เปิด <http://localhost:4173> กล้องต้องทำงานผ่าน localhost หรือ HTTPS จากนั้นกด **เปิดกล้อง** และ **ปรับเทียบดวงตา**

## EyeSay Chat

Chat ใช้ Supabase Auth + Google OAuth, Postgres, Realtime และ RLS ผู้ดูแลใช้การสัมผัสเพื่อเข้าสู่ระบบ เพิ่ม UID และสร้างกลุ่มก่อน ส่วนผู้ใช้ส่งข้อความด้วยสายตาหรือพิมพ์ได้

ใส่เฉพาะ `sb_publishable_...` ใน `src/supabase-config.js` ห้ามฝัง `sb_secret_...` หรือ `service_role` ในเว็บ ดูขั้นตอนทั้งหมดที่ [คู่มือ Supabase](docs/SUPABASE_SETUP.md)

## หลักการตรวจจับ

`src/blink-engine.js` อ่าน `eyeBlinkLeft` และ `eyeBlinkRight` แยกกัน ใช้ smoothing + hysteresis และ state machine ที่แบ่ง gesture เป็น one-eye wink, one-eye hold, both-eye blink และ both-eye hold แบบ mutually exclusive ค่าเริ่มต้นถือว่าปิดเมื่อ score ถึง `0.40` และเปิดกลับเมื่อต่ำกว่า `0.24`; calibration คำนวณค่าใหม่จาก median ตอนเปิด/ปิดตาของผู้ใช้

ไม่ได้ใช้ YOLO-World เพราะโมเดลตรวจวัตถุทั่วไปไม่ได้ให้คลาสเปิด/ปิดตาที่ตรงกับโจทย์และหนักกว่า Face Landmarker ใน browser อย่างมาก

## โครงสร้าง

```text
index.html / styles.css      UI แบบ 4 หน้า
assets/                      ภาพหน้า support
src/app.js                   router, กล้อง, gesture และ UI controller
src/blink-engine.js          state machine แยกตาซ้าย/ขวา
src/interaction.js           remote selector + wink resolver
src/supabase-chat.js         Google Auth, UID, DM, group, Realtime
supabase/schema.sql          tables, RPC, trigger และ RLS
docs/SUPABASE_SETUP.md       คู่มือตั้งค่า Google + Supabase
test/                        unit tests
tools/smoke-supabase.js      browser smoke โดยใช้ Supabase จำลอง
```

## งานที่ต้องทดสอบกับผู้ใช้จริง

- false accept/false reject ของตาซ้ายและขวาแยกตามผู้ใช้ แว่น แสง หนังตาตก และการขยับศีรษะ
- hold threshold 0.36 วินาที, step 0.2 วินาที และ double-wink window 0.46 วินาทีว่าล้าเกินไปหรือไม่
- ทางควบคุมสำรองสำหรับผู้ใช้ที่ไม่สามารถขยิบตาข้างเดียวได้
- นโยบายเก็บ/ลบข้อความและข้อมูลบัญชีให้เหมาะสมกับ PDPA

Push เข้า `main` จะ deploy static site ผ่าน GitHub Actions แต่ Chat จะใช้งานจริงได้เมื่อรัน schema เปิด Google provider และใส่ publishable key แล้ว

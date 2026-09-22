# EyeSay

**ระบบแปลงการกะพริบตาเป็นข้อความสำหรับผู้มีภาวะอัมพาตและบกพร่องทางการพูด**

เว็บต้นแบบใช้ MediaPipe Face Landmarker ตรวจการหลับตาสองข้างบนอุปกรณ์ เพื่อให้ผู้ใช้เลือกตัวอักษรโดยไม่ใช้มือ ภาพกล้องไม่ถูกอัปโหลดออกจากเครื่อง

> MVP สำหรับทดลองและเก็บข้อมูล ไม่ใช่อุปกรณ์การแพทย์ และไม่ควรเป็นช่องทางฉุกเฉินเพียงช่องทางเดียว

## รุ่นที่เผยแพร่และรุ่น localhost

- GitHub Pages มีเฉพาะ **หน้าหลัก** และ **วิธีใช้** ไม่มีโค้ด Auth, Chat หรือ schema อยู่ใน deployment artifact
- `npm run serve` สร้างรุ่น localhost ที่เพิ่ม **แชต** สำหรับทดลอง Google Sign-In, UID, DM และ group chat

## การควบคุมแบบวงล้อ

- ตัวเลือกเดินเองทุก **1.35 วินาที**; ไม่กะพริบคือผ่านไปตัวถัดไป
- เมื่อเริ่มหลับตา วงล้อหยุดที่ตัวปัจจุบันทันที
- หลับ–ลืม **สองตา 1 ครั้ง**: เลือกตัวปัจจุบันหลังรอหน้าต่างยืนยัน **0.55 วินาที**
- หลับ–ลืม **สองตา 2 ครั้ง** ภายในหน้าต่างยืนยัน: สลับพยัญชนะ/สระโดยไม่เลือกตัวอักษร
- หลับตาค้าง **1–4 วินาที**: พักวงล้อไว้ที่ตัวเดิม เมื่อลืมตาจึงเริ่มรอบใหม่
- หลับตาค้างครบ **5 วินาที**: หยุดวงล้อและปิดกล้อง

ระบบไม่แยกคำสั่งตาซ้าย–ขวา ค่าเริ่มต้นถือว่าหลับเมื่อคะแนนของตาทั้งสองถึง **40%** เพื่อลดภาระการควบคุมกล้ามเนื้อตาทีละข้าง

## เริ่มในเครื่อง

```powershell
npm test
npm run serve
```

เปิด <http://localhost:4173> กล้องต้องทำงานผ่าน localhost หรือ HTTPS จากนั้นกด **เปิดกล้อง** และ **ปรับเทียบดวงตา**

## EyeSay Chat

Chat เป็นฟีเจอร์ localhost เท่านั้น ใช้ Supabase Auth + Google OAuth, Postgres, Realtime และ RLS ผู้ดูแลใช้การสัมผัสเพื่อเข้าสู่ระบบ เพิ่ม UID และสร้างกลุ่มก่อน

ใส่เฉพาะ `sb_publishable_...` ใน `src/supabase-config.js` ห้ามฝัง `sb_secret_...` หรือ `service_role` ในเว็บ ดูขั้นตอนทั้งหมดที่ [คู่มือ Supabase](docs/SUPABASE_SETUP.md)

## หลักการตรวจจับ

`src/blink-engine.js` อ่าน `eyeBlinkLeft` และ `eyeBlinkRight` แล้วใช้ค่าของตาทั้งสองร่วมกัน พร้อม smoothing + hysteresis และ state machine สำหรับ blink/long close ค่าเริ่มต้นถือว่าปิดเมื่อคะแนนของทั้งสองตาถึง `0.40` และเปิดกลับเมื่อต่ำกว่า `0.24`; calibration คำนวณค่าใหม่จาก median ตอนเปิด/ปิดตาของผู้ใช้

ไม่ได้ใช้ YOLO-World เพราะโมเดลตรวจวัตถุทั่วไปไม่ได้ให้คลาสเปิด/ปิดตาที่ตรงกับโจทย์และหนักกว่า Face Landmarker ใน browser อย่างมาก

## โครงสร้าง

```text
index.html / styles.css      source UI (chat ถูกตัดออกจาก public build)
src/app.js                   router, กล้อง, gesture และ UI controller
src/blink-engine.js          state machine สำหรับกะพริบสองตาและหลับค้าง
src/interaction.js           roulette scanner + blink window counter
src/supabase-chat.js         Google Auth, UID, DM, group, Realtime
supabase/schema.sql          tables, RPC, trigger และ RLS
docs/SUPABASE_SETUP.md       คู่มือตั้งค่า Google + Supabase
test/                        unit tests
tools/build-web.js           แยก public build กับ localhost build
tools/smoke-supabase.js      browser smoke ทั้งสอง edition
```

## งานที่ต้องทดสอบกับผู้ใช้จริง

- false accept/false reject ของการกะพริบสองตา แยกตามผู้ใช้ แว่น แสง หนังตาตก และการขยับศีรษะ
- รอบวงล้อ 1.35 วินาทีและหน้าต่างยืนยัน 0.55 วินาทีว่าล้าเกินไปหรือไม่
- ความเหมาะสมของ threshold 40% และการปรับเทียบเฉพาะบุคคล
- นโยบายเก็บ/ลบข้อความและข้อมูลบัญชีให้เหมาะสมกับ PDPA

Push เข้า `main` จะ deploy เฉพาะรุ่น public ที่ไม่มี Chat ส่วน Chat localhost จะใช้งานจริงได้เมื่อรัน schema เปิด Google provider และใส่ publishable key แล้ว

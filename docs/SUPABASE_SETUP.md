# ตั้งค่า EyeSay Chat รุ่น localhost ด้วย Supabase + Google

EyeSay ใช้ Supabase Auth, Postgres, Row Level Security (RLS) และ Realtime ผู้ใช้เข้าสู่ระบบด้วย Google มี UID สำหรับเพิ่มเพื่อน คุย DM และสร้างกลุ่มได้ โดยไม่ต้องเชื่อม LINE, Discord หรือ Facebook

## 1. เตรียมฐานข้อมูล

1. เปิดโปรเจกต์ใน [Supabase Dashboard](https://supabase.com/dashboard) แล้วเข้า SQL Editor
2. คัดลอกและรัน `supabase/schema.sql` ทั้งไฟล์
3. Table Editor ควรมี `profiles`, `friendships`, `chat_threads`, `chat_members` และ `chat_messages` โดยทุกตารางเปิด RLS

## 2. เปิด Google Sign-In

1. ใน Google Cloud Console สร้าง OAuth 2.0 Client ID ชนิด Web application
2. ใส่ Authorized JavaScript origins เป็น URL เว็บจริงและ `http://localhost:4173`
3. คัดลอก Callback URL ที่ Supabase แสดงใน Authentication → Providers → Google ไปใส่ Authorized redirect URI ของ Google
4. นำ Google Client ID และ Client Secret ใส่ใน Supabase Authentication → Providers → Google แล้วเปิด provider
5. ใน Supabase Authentication → URL Configuration ตั้ง Site URL และ Redirect URL เป็น `http://localhost:4173/**`

รุ่น localhost ใช้ Supabase OAuth ซึ่งส่งต่อไปยัง Google Identity Services ให้เอง จึงไม่ต้องฝัง Google Client Secret ในเว็บ รุ่นที่ deploy บน GitHub Pages ไม่มีหน้าแชตและไม่มีไฟล์ตั้งค่า Supabase

## 3. ใส่คีย์สำหรับหน้าเว็บ

ไป Project Settings → API Keys แล้วคัดลอก **Publishable key** ที่ขึ้นต้นด้วย `sb_publishable_` (โปรเจกต์รุ่นเก่าใช้ anon key) มาใส่ `src/supabase-config.js`

ห้ามใช้ `sb_secret_`, `service_role`, database password หรือ JWT secret ในไฟล์เว็บและ GitHub เด็ดขาด หากเคยส่ง secret ผ่านแชตหรือวางไว้ในที่สาธารณะ ให้ Rotate จาก Dashboard

Project URL ถูกใส่ไว้แล้ว แต่ควรตรวจว่า project ref ถูกต้องก่อนทดสอบ

## 4. ทดสอบ

```powershell
npm test
npm run serve
```

เปิด `http://localhost:4173/#chat` แล้วทดสอบด้วยบัญชี Google สองบัญชี:

1. ล็อกอินและแลก UID
2. ส่ง/รับคำขอเป็นเพื่อน
3. เริ่ม DM และส่งข้อความสองทาง
4. สร้างกลุ่มจากเพื่อนที่ตอบรับแล้วและส่งข้อความ
5. เปิดสองหน้าต่างเพื่อตรวจ Realtime

## กติกาความปลอดภัยใน schema

- ผู้ที่ไม่ล็อกอินอ่านหรือเขียนตารางไม่ได้
- ค้นหาผู้ใช้ด้วย UID แบบตรงตัวผ่าน RPC จึงไม่มี endpoint สำหรับไล่รายชื่อทั้งหมด
- อ่าน thread, สมาชิก และข้อความได้เฉพาะสมาชิกของห้องนั้น
- สร้าง DM/กลุ่มได้เฉพาะกับเพื่อนที่ตอบรับแล้ว กลุ่มมีสมาชิกเพิ่มได้สูงสุด 20 คน
- ส่งข้อความได้เฉพาะในนามบัญชีตัวเอง จำกัด 30 ข้อความต่อนาที และใช้ `client_id` ป้องกันข้อความซ้ำเมื่อ retry
- Realtime เปิดเฉพาะ `chat_messages`; รายชื่อและคำขอใช้ปุ่มรีเฟรชเป็น fallback

ข้อความอาจกลายเป็นข้อมูลสุขภาพจากบริบทการใช้งาน ผู้ดูแลระบบยังต้องกำหนดนโยบายเก็บ/ลบข้อมูล ช่องทางติดต่อ ภูมิภาค backup และ log ให้เหมาะสม ระบบนี้ไม่ใช่ช่องทางฉุกเฉิน

อ้างอิง: [Google Auth with Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)

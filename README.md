# MUSC SportSpace

ระบบจองสนามกีฬาและอุปกรณ์กีฬาออนไลน์ คณะวิทยาศาสตร์ มหาวิทยาลัยมหิดล  
Faculty of Science sports-facility booking portal.

จองคอร์ทล่วงหน้า ยืนยันด้วยรหัส OTP ที่ส่งไปอีเมลสถาบัน รับ QR สำหรับเช็คอิน และเห็นตารางที่ว่างอัปเดตทันทีเมื่อมีคนจองช่วงเดียวกัน

## รันด้วยคำสั่งเดียว / One command

ต้องมี Node.js 22 ขึ้นไป

```bash
npm install && npm run sportspace
```

หรือ `./start.sh` บน Linux / macOS ซึ่งทำขั้นตอนเดียวกัน

เปิด [http://127.0.0.1:43123](http://127.0.0.1:43123)

คำสั่งนี้จะสร้าง `.env` จากตัวอย่าง (ถ้ายังไม่มี) สร้างฐานข้อมูล SQLite ใส่ข้อมูลตัวอย่าง แล้วเปิด API พร้อมหน้าเว็บ

Docker (ทางเลือก):

```bash
docker compose up --build
```

บริการฟังที่พอร์ต `43123` เช่นกัน ฐานข้อมูลอยู่ใน volume `sportspace-data`

## ทำไมเลือกสแตกนี้ / Stack

| ส่วน | ตัวเลือก | เหตุผล |
| --- | --- | --- |
| API | Express + TypeScript (`tsx`) | REST JSON ชัดเจน ตรงโจทย์วิชา แยกจาก UI |
| ฐานข้อมูล | SQLite + Prisma | ไฟล์เดียว รันได้ทันที มี transaction และ unique constraint กันจองซ้อน เปลี่ยนไป PostgreSQL ได้ด้วยการสลับ `DATABASE_URL` |
| UI | React + Vite + Tailwind | หน้าเว็บเรียก API ด้วย `fetch` แบบ asynchronous ไม่ผูกกับ server render |
| เรียลไทม์ | Server-Sent Events + โพลทุก 4–5 วินาที | ตารางเปลี่ยนเป็น «จองแล้ว» โดยไม่ต้องรีเฟรชทั้งหน้า โพลเป็นตาข่ายกันพอร์ตพร็อกซีที่กัน SSE |
| อีเมล | ตัวส่งแบบถอดเปลี่ยนได้ | ตั้ง `SMTP_*` เพื่อส่งจริง ถ้าไม่ตั้ง จะเก็บบัตร OTP ไว้ในกล่องจดหมายทดลองและพิมพ์ลงคอนโซล |

## บัญชีทดลอง / Demo accounts

รหัสผ่านทุกบัญชีคือ `Sport@123`

| บทบาท | รหัส | ชื่อ | อีเมล | เหรียญหลังข้อมูลตัวอย่าง |
| --- | --- | --- | --- | --- |
| นักศึกษา | `66381234` | กัญญานนท์ ขาวเอียด | kannanon.kha@student.mahidol.ac.th | 105 |
| นักศึกษา | `66385678` | สิริกร พงษ์ทอง | sirikorn.pon@student.mahidol.ac.th | 120 |
| บุคลากร | `STF10234` | ดร.ปิยะ วัฒนกุล | piya.wat@mahidol.edu | 130 |
| ผู้ดูแลสนาม | `ADM10001` | วราภรณ์ ตั้งตรง | waraporn.tan@mahidol.ac.th | 500 |

บัญชีเพิ่มสำหรับทดลองค้นหาผู้ร่วมทีม: `anan.k@student.mahidol.ac.th`, `mintra.s@student.mahidol.edu` (รหัสเข้าสู่ระบบ `66380011` และ `66380022`)

หน้าเข้าสู่ระบบมีปุ่มเติมบัญชีทดลองให้อยู่แล้ว

## สิ่งที่ระบบทำ

- สมัครด้วยรหัสนักศึกษา/บุคลากร ชื่อ อีเมลสถาบัน (`@mahidol.edu`, `@mahidol.ac.th` รวมซับโดเมนเช่น `@student.mahidol.ac.th`) เบอร์โทร สังกัด และประเภทสมาชิก
- เข้าสู่ระบบด้วยรหัส + รหัสผ่าน (bcrypt) เซสชันเป็นคุกกี้ `httpOnly` อายุ 7 วัน
- สนาม: แบดมินตัน 4 คอร์ท, บาสเกตบอล, วอลเลย์บอล, ปิงปอง 3 โต๊ะ, ห้องออกกำลังกาย, สนามฟุตบอล, สระว่ายน้ำ พร้อมเวลาเปิดและรอบรายชั่วโมง
- ปฏิทินสาธารณะแบบรายวัน (ตารางทุกสนาม / รายการ) รายสัปดาห์ และเดือน
- จองล่วงหน้าได้ 14 วัน ต้องก่อนเวลาเริ่มอย่างน้อย 30 นาที
- นักศึกษาจองพร้อมกันได้ 3 รายการ (เฉพาะซ้อม) บุคลากร 6 รายการ ผู้ดูแล 8 รายการ บุคลากรจองกิจกรรมชมรมและแข่งขันภายในได้
- เพิ่มผู้ร่วมทีมด้วยอีเมลสมาชิก (ระบบเติมชื่อ เบอร์ สังกัด) หรือพิมพ์ชื่อเพิ่ม
- เปิด/ปิดไฟ เปิดไฟหักเหรียญตามประเภทสนาม คืนเหรียญเมื่อ OTP ไม่สำเร็จหรือยกเลิกทันเวลา
- บุคลากรและผู้ดูแลยืมอุปกรณ์พร้อมการจอง จำนวนคงเหลือถูกกันไว้ในธุรกรรมฐานข้อมูล
- ยืนยันด้วย OTP 6 หลัก อายุ 5 นาที ผิดได้ 5 ครั้ง ส่งซ้ำได้รวม 3 ครั้ง
- ได้ QR และรหัสเช็คอินหลังยืนยัน ยกเลิกได้ก่อนเริ่มอย่างน้อย 2 ชั่วโมง แล้วช่วงเวลากลับมาว่าง
- ผู้ดูแลสแกน QR ด้วยกล้องหรือกรอกรหัส เช็คอินได้ตั้งแต่ 60 นาทีก่อนเริ่มจนถึง 30 นาทีหลังเลิก ปิดสนามชั่วคราว ดูสถิติเป็นกราฟ และปรับสต็อกอุปกรณ์
- ประวัติการจองมีช่องค้นหา สวิตช์ 7 วันล่าสุด ช่วงวันที่ พิมพ์ และส่งออก CSV
- กันจองซ้อนที่ฐานข้อมูลด้วย unique `(facility, date, hour)` ภายใน transaction ถ้าชนกันได้ `409 SLOT_TAKEN`
- จำกัดความถี่ที่เข้าสู่ระบบและที่กรอก OTP

เหรียญมีไว้จ่ายค่าเปิดไฟ ซึ่งตรงกับเมนูกระเป๋าเงินของระบบเดิม โดยไม่ทำระบบเติมเงินเต็มรูปแบบ

## สถาปัตยกรรม

```text
browser (React, fetch, EventSource)
        │  /api  JSON + SSE
        ▼
Express  ── Prisma ── SQLite
        └── mailer: SMTP หรือ dev mailbox
```

โครงสร้างหลัก

- `server/src` API, กติกาการจอง, OTP, SSE
- `prisma/schema.prisma` โมเดลและ unique ของ `SlotLock`
- `client/src` หน้าจอภาษาไทย โหมดมืด แถบนำทางล่างบนมือถือ
- `server/tests/booking.test.ts` ทดสอบจองชนกัน, OTP, ยกเลิก, และสิทธิ์

## ทดสอบ / Tests

```bash
npm test
```

ครอบคลุมการจองช่วงเวลาเดียวกันพร้อมกัน (หนึ่งสำเร็จ หนึ่งได้ 409) การยืนยัน OTP ที่ถูกและผิด การล็อกหลังกรอกผิดครบโควตา การหมดอายุของ OTP การยกเลิกแล้วให้คนอื่นจองต่อ การยกเลิกกระชั้นเกิน 2 ชั่วโมง และสิทธิ์ที่นักศึกษาเรียกแดชบอร์ดหรือยืมอุปกรณ์ไม่ได้

## อีเมล OTP

ค่าใน `.env`

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=0
SMTP_USER=
SMTP_PASS=
MAIL_FROM="MUSC SportSpace <no-reply@sportspace.sc.mahidol.ac.th>"
```

ถ้า `SMTP_HOST` ว่าง ระบบจะ

1. พิมพ์รหัสลงคอนโซลของ API
2. เก็บจดหมายไว้ที่ `GET /api/dev/mailbox` และหน้า `/dev-mail`

## API

| Method | Path | สิทธิ์ | ความหมาย |
| --- | --- | --- | --- |
| GET | `/api/health` | สาธารณะ | สถานะเซิร์ฟเวอร์ |
| GET | `/api/meta` | สาธารณะ | กติกาการจองและรายชื่อสังกัด |
| POST | `/api/auth/register` | สาธารณะ | สมัครสมาชิก |
| POST | `/api/auth/login` | สาธารณะ | เข้าสู่ระบบ |
| POST | `/api/auth/logout` | สาธารณะ | ออกจากระบบ |
| GET | `/api/auth/me` | สมาชิก | โปรไฟล์ปัจจุบัน |
| GET | `/api/facilities` | สาธารณะ | รายการสนามและช่วงว่างวันนี้ |
| GET | `/api/facilities/:slug` | สาธารณะ | รายละเอียดสนาม |
| GET | `/api/availability?facility=&date=` | สาธารณะ | ช่องเวลารายชั่วโมง |
| GET | `/api/schedule?from=&to=` | สาธารณะ | ปฏิทินรวม |
| GET | `/api/events` | สาธารณะ | SSE เมื่อมีการจอง |
| GET | `/api/members/lookup?emails=` | สมาชิก | ค้นสมาชิกจากอีเมล |
| GET | `/api/equipment` | สมาชิก | คลังอุปกรณ์ |
| POST | `/api/bookings` | สมาชิก | สร้างการจองและส่ง OTP |
| GET | `/api/bookings` | สมาชิก | การจองของฉัน |
| GET | `/api/bookings/:id` | เจ้าของ/ผู้ดูแล | รายละเอียดและ QR |
| POST | `/api/bookings/:id/otp` | เจ้าของ | ยืนยัน OTP |
| POST | `/api/bookings/:id/otp/resend` | เจ้าของ | ส่ง OTP ใหม่ |
| POST | `/api/bookings/:id/cancel` | เจ้าของ/ผู้ดูแล | ยกเลิก |
| GET | `/api/wallet` | สมาชิก | ยอดเหรียญและประวัติ |
| GET | `/api/dev/mailbox` | เฉพาะตอนไม่ใช้ SMTP | จดหมายทดลอง |
| GET | `/api/admin/stats` | ผู้ดูแล | สถิติ |
| GET | `/api/admin/bookings?date=` | ผู้ดูแล | การจองของวันนั้น |
| POST | `/api/admin/checkin` | ผู้ดูแล | เช็คอินจาก QR หรือรหัส |
| POST | `/api/admin/closures` | ผู้ดูแล | ปิดสนามชั่วคราว |
| DELETE | `/api/admin/closures/:id` | ผู้ดูแล | ยกเลิกการปิดสนาม |
| POST | `/api/admin/equipment` | ผู้ดูแล | เพิ่มอุปกรณ์ |
| PATCH | `/api/admin/equipment/:id` | ผู้ดูแล | ปรับจำนวน |

ข้อผิดพลาดเป็น JSON `{ "error": { "code", "message" } }` ข้อความเป็นภาษาไทย เช่น `SLOT_TAKEN`, `OTP_EXPIRED`, `CANCEL_TOO_LATE`, `FORBIDDEN`

## ภาพหน้าจอ

จับจาก Chrome ที่ความกว้าง 1440 และ 390 พิกเซล ไฟล์อยู่ใน `docs/screenshots`

### เดสก์ท็อป

![เข้าสู่ระบบ](docs/screenshots/desktop-login.png)

![ตารางว่างรายวัน](docs/screenshots/desktop-calendar.png)

![ยืนยัน OTP](docs/screenshots/desktop-otp.png)

![QR หลังจองสำเร็จ](docs/screenshots/desktop-qr.png)

![แดชบอร์ดผู้ดูแล](docs/screenshots/desktop-admin.png)

![สแกนเช็คอิน](docs/screenshots/desktop-scanner.png)

### มือถือ

![เข้าสู่ระบบบนมือถือ](docs/screenshots/mobile-login.png)

![ตารางบนมือถือ](docs/screenshots/mobile-calendar.png)

![OTP บนมือถือ](docs/screenshots/mobile-otp.png)

![แดชบอร์ดบนมือถือ](docs/screenshots/mobile-admin.png)

![สแกนเช็คอินบนมือถือ](docs/screenshots/mobile-scanner.png)

## ความปลอดภัยที่ใช้

ตรวจอินพุตด้วย Zod, แฮชรหัสผ่าน, คุกกี้ `httpOnly`, middleware ตรวจตัวตนและบทบาท, unique constraint กันจองซ้อน, จำกัดความถี่ล็อกอิน/OTP, ไม่คืนรหัส OTP ใน JSON ของการจอง (อยู่ในอีเมลเท่านั้น) และไม่แสดงชื่อผู้จองบนปฏิทินสาธารณะ

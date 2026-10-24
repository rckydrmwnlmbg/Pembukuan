# OPEN-ISSUES — Daftar Pertentangan, Ambiguitas, dan Item Verifikasi

| | |
|---|---|
| Tanggal | 25 Oktober 2026 |
| Status | Disetujui (OI-01 s.d. OI-10 disetujui pemilik pada 25 Okt 2026) |
| Dasar dokumen | `AGENTS.md`, `docs/PRD.md`, `docs/SECURITY.md`, `docs/DESIGN.md`, `docs/TECH-STACK.md`, `docs/SKILLS.md` |

Dokumen ini mencatat pertentangan, ambiguitas, dan kekosongan spesifikasi lintas dokumen (Bagian 1) serta hal-hal yang bergantung pada versi pustaka atau konvensi Antigravity yang perlu diverifikasi pada dokumentasi resmi (Bagian 2), sesuai aturan `AGENTS.md` bagian 3 dan bagian 9.

---

## 1. Hal yang Bertentangan, Ambigu, atau Kurang di Dokumen

### OI-01 — Sisa artefak v2 (Rekonsiliasi & Nota) pada skema MVP dan skill `demo-data-seeder` [DISETUJUI 25 Okt 2026]
- **Lokasi:** `PRD.md` bagian 7 (baris 253–287), `SKILLS.md` bagian 8 (baris 253–255), `DESIGN.md` bagian 12 (baris 481), vs `AGENTS.md` bagian 2 (#12) & bagian 11 (M1).
- **Temuan:**
  1. `AGENTS.md` bagian 11 (M1) menginstruksikan *"Skema (tanpa tabel v2)"* dan aturan emas #12 melarang membangun rekonsiliasi serta pengelolaan nota di MVP. Namun pada `PRD.md` bagian 7:
     - Tabel `transaction_receipts(transaction_id, upload_id)` masih tercantum tanpa label `[v2]`/`[Di luar scope]`, padahal nota dikelola di luar sistem (`PRD.md` bagian 3 & F5).
     - Enum status/jenis pada `periods.status` (`reconciled`), `uploads.kind` (`statement`, `receipt`), dan `transactions.status` (`reconciled`) masih memuat nilai untuk fitur v2/luar scope.
  2. `SKILLS.md` bagian 8 (`demo-data-seeder`) masih mengharuskan skenario demo *"satu dapur rekonsiliasi cocok (selisih nol)"* dan *"satu dapur dengan dua item tak tercocok"*, yang bertentangan dengan `PRD.md` Lampiran B (*"Rekonsiliasi tidak didemokan"*).
  3. `DESIGN.md` bagian 12 menamai komponen domain `ReconcileEquation`, padahal di MVP (`DESIGN.md` 8.1) komponen tersebut adalah strip persamaan saldo periode.
- **Keputusan (Disetujui):**
  - Di M1, tidak membuat tabel `statement_lines`, `reconciliations`, maupun `transaction_receipts`. Membatasi constraint `CHECK` di MVP pada nilai yang aktif (`periods.status IN ('open', 'locked')`, `uploads.kind IN ('transfer_proof')`, `transactions.status IN ('posted', 'void')`).
  - Pada `demo-data-seeder`, mengganti dua skenario rekonsiliasi tersebut dengan skenario MVP: dapur dengan semua transaksi terposting (periode `open`), dapur dengan draf menunggu review, dapur dengan berkas `needs_manual`, dan dapur dengan periode `locked`.
  - Menggunakan nama komponen `PeriodBalanceStrip` untuk strip persamaan saldo periode di MVP.

### OI-02 — Kewajiban MFA TOTP untuk seluruh pengguna vs khusus `maker`/`admin`, serta cakupan MFA di Demo [DISETUJUI 25 Okt 2026]
- **Lokasi:** `PRD.md` FR-F1.1 & Lampiran B (baris 390) vs `SECURITY.md` S-01 (baris 87–88, 120) & Bagian D (baris 1139) dan `AGENTS.md` bagian 11 (M1, M5).
- **Temuan:**
  1. `PRD.md` FR-F1.1 menyatakan MFA wajib untuk `maker` dan `admin`, sedangkan `SECURITY.md` S-01 (`requireUser()`) memblokir semua sesi yang bukan `aal2` untuk seluruh pengguna kecuali ada pengecualian tertulis di `TECH-STACK.md`.
  2. `PRD.md` Lampiran B menulis *"Cakupan demo: F1 (tanpa MFA penuh)"*, tetapi `SECURITY.md` Bagian D (Gerbang sebelum demo) dan `AGENTS.md` M1/M5 menetapkan *"S-01: pendaftaran publik mati, MFA aktif"* serta layar login (+MFA).
- **Keputusan (Disetujui):** Mengikuti `SECURITY.md` (prioritas #1): mewajibkan MFA TOTP (`aal2`) di `requireUser()` untuk semua pengguna yang masuk di MVP, dan membangun alur MFA TOTP penuh untuk lingkungan demo (menyertakan kunci rahasia/TOTP seed akun demo di petunjuk demo agar pengujian lancar).

### OI-03 — Keberadaan peran `approver` dan `viewer` di skema database vs lingkup satu peran di MVP [DISETUJUI 25 Okt 2026]
- **Lokasi:** `AGENTS.md` bagian 2 (#12) & `PRD.md` Q10 vs `PRD.md` FR-F1.2, `SECURITY.md` S-01/S-02/S-03, dan `SKILLS.md` bagian 5.
- **Temuan:** `PRD.md` Q10 dan `AGENTS.md` menyatakan di MVP hanya maker yang memakai sistem (peran pemeriksa/approver ditunda ke v2). Namun `SECURITY.md` S-02 dan `SKILLS.md` bagian 5 (`rls-migration-author`) tetap menggunakan empat peran (`admin`, `maker`, `approver`, `viewer`) pada tabel `kitchen_members`, fungsi `has_kitchen_role`, dan uji wajib `test:rls` (mis. menguji `viewer` tidak dapat melakukan `insert`).
- **Keputusan (Disetujui):** Mempertahankan keempat nilai peran (`admin`, `maker`, `approver`, `viewer`) pada skema database, kebijakan RLS, dan pengujian `test:rls` sesuai `SECURITY.md` S-02 sejak M1, namun tidak membangun antarmuka khusus approver/viewer atau alur persetujuan di MVP.

### OI-04 — Representasi saldo awal periode (`periods.opening_balance` vs baris transaksi `kind = 'opening'`) [DISETUJUI 25 Okt 2026]
- **Lokasi:** `PRD.md` baris 49, FR-F5.2, FR-F8.2, bagian 7, `DESIGN.md` bagian 8.1, `SKILLS.md` bagian 2.
- **Temuan:**
  - Tabel `periods` memiliki kolom `opening_balance bigint`, sementara tabel `transactions` memiliki `kind[opening|incoming|outgoing|admin_fee]`, dan FR-F8.2 menyebutkan penutupan periode membuat baris `PERPINDAHAN SALDO <BULAN>`.
  - Jika saldo awal disimpan di `periods.opening_balance` **dan** sekaligus dimasukkan sebagai baris `transactions` dengan `kind = 'opening'` dan `debit > 0`, maka rumus `saldo_awal + Σ debit − Σ kredit` akan menghitung saldo awal **dua kali**, serta mengacaukan segmen `Dana masuk` pada strip persamaan (`DESIGN.md` 8.1).
- **Keputusan (Disetujui):**
  1. **Di Database (Single Source of Truth):** Menyimpan saldo awal **hanya di `periods.opening_balance`** (`bigint`), dan membatasi `transactions.kind` hanya untuk transaksi riil (`'incoming' | 'outgoing' | 'admin_fee'`). Dengan demikian:
     - `Saldo awal` = `periods.opening_balance`
     - `Dana masuk` = `SUM(debit)` dari transaksi `posted` (`kind = 'incoming'`)
     - `Dana keluar` = `SUM(credit)` dari transaksi `posted` (`kind IN ('outgoing', 'admin_fee')`)
     - `Saldo berjalan` = `periods.opening_balance + Σ debit − Σ credit`
     Tidak akan pernah ada bug hitung ganda.
  2. **Di Tabel UI & Ekspor Excel:** Merender `periods.opening_balance` sebagai **baris pertama (`NO = 1`)** bertuliskan `PERPINDAHAN SALDO <BULAN SEBELUMNYA>` dengan nilai pada kolom `DEBIT` (kolom `G`) dan kolom `TOTAL` (kolom `I` = `=G6`), lalu transaksi aktual dimulai dari `NO = 2` dengan rumus berantai `=IF(G7=H7,"",I6+G7-H7)` (persis seperti rumus di `PRD.md` baris 49).

### OI-05 — Perilaku edit dan pembatalan (`void`) pada pasangan transaksi induk (`outgoing`) dan `admin_fee` [DISETUJUI 25 Okt 2026]
- **Lokasi:** `PRD.md` FR-F4.3, FR-F5.5, bagian 7, `SKILLS.md` bagian 2.
- **Temuan:** Transaksi induk (`outgoing`) dan biaya admin (`admin_fee`) dibuat berpasangan dalam satu transaksi DB dengan `reference_no` yang sama. Namun skema `transactions` belum memiliki relasi eksplisit ke transaksi induk, dan belum diatur apakah membatalkan (`void`) atau mengubah `tx_date`/`reference_no` transaksi induk harus otomatis membatalkan/memperbarui baris `admin_fee` pasangannya.
- **Keputusan (Disetujui):** Menambahkan kolom opsional `parent_transaction_id uuid references public.transactions(id)` pada tabel `transactions`. Saat transaksi induk di-`void` atau diubah tanggal/referensinya, baris `admin_fee` yang terkait ikut diperbarui/di-`void` secara atomik dalam satu transaksi database (dengan opsi bagi maker untuk me-`void` baris `admin_fee` saja bila ternyata bebas biaya admin).

### OI-06 — Pemisahan nominal pokok transfer vs biaya admin pada hasil ekstraksi AI [DISETUJUI 25 Okt 2026]
- **Lokasi:** `TECH-STACK.md` bagian 4, `SECURITY.md` S-14 (`ExtractionOutput`), `DESIGN.md` bagian 8.3.
- **Temuan:** Bukti transfer bank sering menampilkan tiga angka: Nominal Transfer, Biaya Admin, dan Total Bayar/Total Debet. Kontrak `ExtractionOutput` hanya memiliki satu field `amount`. Jika AI mengambil angka Total Bayar lalu pengguna mencentang `"Tambahkan biaya admin Rp 6.500"` di layar review, biaya admin akan tercatat ganda.
- **Keputusan (Disetujui):** Memperjelas `SYSTEM_PROMPT` di `src/server/extraction/ai-extract.ts` bahwa `amount` wajib berisi **nominal pokok transfer (di luar biaya admin bank)**.

### OI-07 — Ketersediaan templat Excel kosong/tersamar (`tests/fixtures/template/`) untuk M2 [DISETUJUI 25 Okt 2026]
- **Lokasi:** `SKILLS.md` bagian 4 (`plombokan-excel-export`), `PRD.md` Q4 & Q11, `AGENTS.md` bagian 2 (#6).
- **Temuan:** `SKILLS.md` bagian 4 mewajibkan agent membaca templat sumber yang sudah dikosongkan di `tests/fixtures/template/` dan melarang menebak nomor baris/lebar kolom dari ingatan, sementara berkas Excel asli dilarang masuk ke repositori (`AGENTS.md` #6) dan templat kosong masih berstatus pertanyaan terbuka (`PRD.md` Q11).
- **Keputusan (Disetujui):** Membuat berkas templat kosong sintetis `tests/fixtures/template/plombokan-template.xlsx` yang hanya berisi struktur baris judul (dengan nama yayasan/PJ sintetis), header kolom, lebar kolom, border, format angka, rumus `TOTAL`, dan baris `SISA UANG` tanpa data nyata.

### OI-08 — Persetujuan dependensi pengolahan gambar (`sharp`) dan pembaca/penampil PDF [DISETUJUI 25 Okt 2026]
- **Lokasi:** `AGENTS.md` bagian 6 & 9, `SECURITY.md` S-06 & S-08, `TECH-STACK.md` bagian 2, `DESIGN.md` bagian 8.3.
- **Temuan:**
  1. `sharp` disebut di `SECURITY.md` S-08 dan `TECH-STACK.md` bagian 2 sebagai kandidat yang memerlukan persetujuan eksplisit sesuai `AGENTS.md` bagian 9.
  2. `SECURITY.md` S-08 menetapkan `MAX_PAGES = 10` untuk PDF, dan `SECURITY.md` S-06 menyebut render PDF dengan `pdf.js` ke canvas atau `<iframe sandbox>`, namun daftar pustaka PDF belum ditetapkan di `TECH-STACK.md` bagian 2.
- **Keputusan (Disetujui):** Menyertakan `sharp` (validasi dimensi, rotasi orientasi, penghapusan EXIF, dan resize gambar di server) serta `pdf-lib` (pengecekan jumlah halaman PDF ≤ 10 dan pemeriksaan apakah PDF terenkripsi kata sandi secara murni di server Node.js tanpa `child_process`), dan mencatatnya di `docs/DEPENDENCIES.md`. Penampil PDF di layar review menggunakan `<iframe sandbox>` dengan URL bertanda tangan berumur pendek (sesuai `SECURITY.md` S-06 & S-10 `frame-src`).

### OI-09 — Ketidakkonsistenan kapitalisasi label "Data contoh" vs "DATA CONTOH" [DISETUJUI 25 Okt 2026]
- **Lokasi:** `DESIGN.md` bagian 3.2, 6, 11, 13 & `SKILLS.md` bagian 8 vs `SECURITY.md` bagian D (baris 1141).
- **Temuan:** `DESIGN.md` melarang keras huruf kapital semua (ALL-CAPS) dan menetapkan label `"Data contoh"`, sedangkan `SECURITY.md` bagian D menulis `"DATA CONTOH"`.
- **Keputusan (Disetujui):** Menggunakan kalimat biasa `"Data contoh"` agar memenuhi aturan tipografi dan kriteria penerimaan visual `DESIGN.md` bagian 13.

### OI-10 — Lokasi folder pengujian ekstraksi (`tests/extraction/` vs `tests/unit/extraction/`) [DISETUJUI 25 Okt 2026]
- **Lokasi:** `TECH-STACK.md` bagian 6 & `AGENTS.md` bagian 5 vs `SKILLS.md` bagian 9 (baris 298).
- **Temuan:** `TECH-STACK.md` bagian 6 menetapkan `tests/{unit,e2e,fixtures}`, sedangkan `SKILLS.md` bagian 9 merujuk ke `tests/extraction/`.
- **Keputusan (Disetujui):** Menempatkan uji ekstraksi di `tests/unit/extraction/` (dijalankan oleh `npm run test:extraction` lewat filter path Vitest) agar struktur `tests/{unit,e2e,fixtures}` tetap rapi dan seragam.

---

## 2. Hal yang Bergantung pada Versi Pustaka atau Konvensi Antigravity (Perlu Verifikasi Dokumentasi Resmi)

### PV-01 — Konvensi Antigravity untuk `AGENTS.md` dan `SKILLS.md`
- **Rujukan:** `AGENTS.md` baris 7, `SKILLS.md` baris 11.
- **Status & Verifikasi:**
  - Di lingkungan Antigravity ini, `AGENTS.md` di akar repositori **sudah terbaca otomatis** sebagai aturan proyek (`<user_rules>`).
  - Untuk sistem skill Antigravity, konvensi resminya mendukung direktori `.agent/skills/<nama-skill>/SKILL.md` (atau `.gemini/skills/<nama-skill>/SKILL.md`) dengan YAML frontmatter `name` dan `description`. Isi `docs/SKILLS.md` dapat tetap menjadi dokumen rujukan utama di `docs/SKILLS.md` dan/atau dipecah ke `.agent/skills/<nama-skill>/SKILL.md` saat perancah proyek dibuat.

### PV-02 — Next.js App Router (Async Request APIs, CVE-2025-29927, dan CSP Nonce)
- **Rujukan:** `SECURITY.md` S-01, S-03, S-10.
- **Perlu diverifikasi saat instalasi M0:**
  - Pastikan versi Next.js yang dipasang berada di atas versi terdampak CVE-2025-29927 (Next.js ≥ 15.2.3).
  - Pastikan tanda tangan `ctx.params` (`Promise<{ ... }>`) serta pemanggilan `await headers()` dan `await cookies()` sesuai dengan Next.js versi terpasang.
  - Verifikasi pola pengiriman header `Content-Security-Policy` berbasis nonce di `middleware.ts` dan cara Next.js meneruskan nonce ke skrip internalnya.

### PV-03 — `@supabase/ssr` dan `@supabase/supabase-js` (Sesi Server, Cookie, MFA AAL2, Batas Sesi)
- **Rujukan:** `SECURITY.md` S-01, S-10; `PRD.md` FR-F1.4.
- **Perlu diverifikasi saat instalasi M0/M1:**
  - Pola resmi `createServerClient` pada `@supabase/ssr` terbaru dengan `cookies()` asinkron Next.js (`getAll` / `setAll`).
  - Perilaku flag cookie (`Secure`, `SameSite=Lax`, `HttpOnly`) pada `@supabase/ssr` ketika autentikasi dan TOTP sepenuhnya ditangani lewat Server Actions.
  - Struktur respons `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` (`currentLevel`, `nextLevel`).
  - Ketersediaan pengaturan *Inactivity Timeout* 12 jam (PRD F1.4) dan *Leaked Password Protection* pada tier proyek Supabase yang dipakai yayasan.

### PV-04 — Tailwind CSS (Konfigurasi Token pada v3.4 vs v4.x)
- **Rujukan:** `DESIGN.md` bagian 3 & bagian 12.
- **Perlu diverifikasi saat instalasi M0:**
  - Jika memasang Tailwind CSS v4, konfigurasi tema menggunakan direktif `@theme` di CSS (bukan `tailwind.config.ts`). Jika memakai Tailwind CSS v3.4, konfigurasi menggunakan `tailwind.config.ts`. Pemetaan variabel token (`--canvas`, `--surface`, `--ink`, `--accent`, dll.) dan pembatasan warna bawaan harus mengikuti dokumentasi resmi versi yang dipasang.

### PV-05 — Zod (Tipe Generik `.strict()` pada `kitchenRoute` dan Versi Zod)
- **Rujukan:** `SECURITY.md` S-07, S-08, S-14.
- **Perlu diverifikasi saat instalasi M0:**
  - Pada Zod, metode `.strict()` hanya tersedia pada `z.ZodObject` (bukan `z.ZodTypeAny` secara umum). Tanda tangan `kitchenRoute<T extends z.ZodRawShape>(roles: Role[], schema: z.ZodObject<T>, ...)` perlu disesuaikan dengan tipe resmi versi Zod yang terpasang.

### PV-06 — Anthropic Messages API (Format Blok PDF/Gambar, Header Versi, Nama Model, Retensi Data)
- **Rujukan:** `SECURITY.md` S-14, `TECH-STACK.md` bagian 4 & 5, `PRD.md` Q12.
- **Perlu diverifikasi sebelum M3 & sebelum produksi:**
  - Struktur payload blok `document` (`application/pdf`) dan `image` (`image/jpeg`, `image/png`) pada `POST https://api.anthropic.com/v1/messages` serta header `anthropic-version` terbaru.
  - String pengenal model resmi terkini untuk `LLM_MODEL` pada dokumentasi resmi Anthropic.
  - Kebijakan retensi data API komersial Anthropic (termasuk opsi *zero-data-retention* bila ada) untuk dicatat secara akurat di `docs/CONSENT.md`.

### PV-07 — `sharp` (Penghapusan Metadata EXIF/GPS dan Kompatibilitas Serverless)
- **Rujukan:** `SECURITY.md` S-08, `TECH-STACK.md` bagian 2.
- **Perlu diverifikasi saat M3:**
  - Verifikasi pada dokumentasi resmi `sharp` versi terpasang bahwa rantai `.rotate().resize(...).jpeg()/png().toBuffer()` tanpa `.withMetadata()` membuang seluruh tag EXIF/GPS setelah menerapkan orientasi, dan buktikan dengan pengujian unit pembaca EXIF.

### PV-08 — `@upstash/ratelimit` dan `@upstash/redis` (Sliding Window & Header IP Platform)
- **Rujukan:** `SECURITY.md` S-09.
- **Perlu diverifikasi saat M0/M1:**
  - Tanda tangan `Ratelimit.slidingWindow` dan field `reset`/`remaining` untuk mengisi header `Retry-After` pada respons 429.
  - Nama header IP klien yang dijamin tidak dapat dipalsukan di lingkungan Vercel (`x-real-ip` / `x-forwarded-for`).

### PV-09 — ExcelJS (Penulisan Rumus Berantai dan Pencegahan Formula Injection)
- **Rujukan:** `PRD.md` FR-F7.2, `SECURITY.md` S-13, `SKILLS.md` bagian 4.
- **Perlu diverifikasi saat M2:**
  - Format objek nilai rumus ExcelJS (`{ formula: '...', result: ... }`) dan penulisan sel teks agar string yang diawali `=`, `+`, `-`, `@` selalu disimpan dengan tipe sel string (`s`) di XML `.xlsx`.

### PV-10 — `Intl.DateTimeFormat('id-ID')` pada Lingkungan Node.js dan Browser
- **Rujukan:** `DESIGN.md` bagian 3.2 (`src/lib/format.ts`).
- **Perlu diverifikasi saat M0:**
  - Keluaran singkatan bulan `{ day: '2-digit', month: 'short', year: 'numeric' }` pada locale `'id-ID'` di runtime Node.js vs Chromium agar format tanggal (`02 Mar 2026`) konsisten di seluruh pengujian dan layar.

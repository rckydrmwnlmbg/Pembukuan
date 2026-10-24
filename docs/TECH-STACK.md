# TECH-STACK — Kasdapur (nama kerja)

| | |
|---|---|
| Versi | 0.2 |
| Tanggal | 23 Oktober 2026 |
| Dokumen induk | `PRD.md` |
| Status | Usulan. Setiap keputusan bisa diubah lewat catatan di bagian "Log keputusan" |

**Aturan versi.** Dokumen ini sengaja **tidak mencantumkan nomor versi paket**. Versi di sini akan basi. Agent harus memasang versi stabil terbaru saat instalasi, mengunci versi tepat di `package.json` dan lockfile, lalu mencatat hasilnya di `docs/DEPENDENCIES.md`. Jika dokumentasi resmi sebuah paket bertentangan dengan dokumen ini, ikuti dokumentasi resmi dan catat di Log keputusan.

---

## 1. Prinsip pemilihan

1. **Isolasi data per dapur ditegakkan di database**, bukan hanya di kode aplikasi. Bug di aplikasi tidak boleh otomatis menjadi kebocoran data antar dapur.
2. **Sedikit bagian bergerak.** Pengembangnya satu orang. Layanan terkelola lebih baik daripada server yang diurus sendiri.
3. **Uang itu bilangan bulat.** Seluruh perhitungan rupiah memakai integer (`bigint` di database, `bigint`/`number` aman di aplikasi).
4. **Ekstraksi harus bisa diuji tanpa data nyata.** Klien AI dapat ditiru (mock), fixture berupa gambar/PDF sintetis, dan evaluasi dengan API sungguhan hanya manual.
5. **Tidak ada kredensial bank di sistem.** Tidak ada modul untuk itu, sekarang maupun nanti.

---

## 2. Stack yang dipilih

| Lapisan | Pilihan | Alasan | Alternatif yang ditolak |
|---|---|---|---|
| Bahasa | **TypeScript** (strict mode) | Satu bahasa untuk UI, server, dan parser; tipe mencegah salah baca field uang | JavaScript polos: terlalu mudah salah tipe |
| Framework | **Next.js** (App Router) | Server components, route handler, middleware dalam satu proyek | SPA + API terpisah: dua deployment, lebih banyak permukaan serangan |
| UI | **Tailwind CSS** + komponen sendiri berbasis **Radix UI** primitives | Aksesibilitas dari Radix, tampilan sepenuhnya dikendalikan `DESIGN.md` | shadcn/ui dipakai apa adanya: hasilnya terlihat seperti template, bertentangan dengan `DESIGN.md`. Boleh dipakai sebagai titik awal kode hanya jika semua token diganti |
| Database | **PostgreSQL** via **Supabase** | Row-Level Security (RLS) untuk isolasi per dapur, auth, dan storage dalam satu layanan | Firebase: tidak relasional, keuangan butuh transaksi dan constraint |
| Auth | **Supabase Auth** + MFA TOTP | Tidak menulis sistem auth sendiri | Auth buatan sendiri: ditolak, risiko tinggi |
| Akses data | **Supabase client** untuk operasi biasa; **SQL migration** manual untuk skema, RLS, trigger | RLS bekerja jika query berjalan dengan identitas pengguna | ORM dengan koneksi service-role: melewati RLS, ditolak untuk jalur pengguna |
| Validasi | **Zod** di setiap batas (form, route, hasil parser, hasil LLM) | Satu skema untuk tipe dan validasi | Validasi ad hoc |
| Penyimpanan file | **Supabase Storage**, bucket **privat** | Tautan bertanda tangan berumur pendek | Bucket publik: ditolak |
| Ekstraksi | **Model AI yang membaca gambar dan PDF** via API Anthropic (jalur utama) | Bukti transfer sering berbentuk JPG [Dinyatakan], yang tak punya lapisan teks. Aktif karena yayasan mengizinkan penggunaan sistem [Dinyatakan] | OCR lokal (mis. Tesseract): tanpa pengiriman ke pihak ketiga, tetapi akurasi pada tangkapan layar m-banking berbahasa Indonesia belum diuji [Low confidence]; dibandingkan saat pilot |
| Parser aturan (opsional, v2) | Fungsi TypeScript murni per bank untuk PDF bernilai teks | Menekan biaya AI dan memberi pemeriksaan silang | Dijadikan jalur utama: tidak bisa membaca JPG |
| Pengolahan gambar | `sharp` (kandidat; dependensi baru yang perlu persetujuan sesuai `AGENTS.md` bagian 9) | Orientasi, buang EXIF, batas piksel, ubah ukuran | Mengirim gambar mentah: ukuran besar dan metadata lokasi ikut terkirim |
| Batas biaya AI | Rate limit + batas harian per dapur (`EXTRACTION_DAILY_LIMIT`) | Biaya ditanggung yayasan [Dinyatakan] dan harus terkendali | Tanpa batas |
| Ekspor Excel | **ExcelJS** | Mendukung gaya sel, rumus, lebar kolom | Membuat CSV: kehilangan format Plombokan |
| Rate limiting | **Upstash Redis** + `@upstash/ratelimit` | Sederhana di lingkungan serverless | Memori proses: tidak bekerja di serverless |
| Logging | **pino** dengan `redact` | Redaksi data sensitif di sumber | `console.log` |
| Pengujian | **Vitest** (unit), **Playwright** (E2E), **pgTAP** atau skrip SQL (uji RLS) | Uji RLS wajib, bukan opsional | Hanya uji manual |
| Lint/format | ESLint, Prettier, `tsc --noEmit` | | |
| Hosting aplikasi | **Vercel** | Terintegrasi dengan Next.js | VPS sendiri: beban operasional |
| Region data | Wilayah Asia Tenggara terdekat yang tersedia (kandidat: Singapura) | Latensi; **residensi data perlu diverifikasi** terhadap kebijakan yayasan dan UU PDP | |
| CI | **GitHub Actions** | Repo sudah di GitHub | |
| Pemantauan galat | Sentry atau setara, dengan `beforeSend` yang membersihkan data sensitif | Opsional di demo | |

---

## 3. Arsitektur

```
Browser (maker / viewer)
   │  HTTPS, cookie sesi httpOnly
   ▼
Next.js (Vercel)
   ├─ middleware.ts ............ verifikasi sesi, tolak default
   ├─ app/(auth)/ .............. login, MFA
   ├─ app/(app)/k/[kitchenId]/ . halaman per dapur
   ├─ app/api/ ................. route handler (unggah, ekspor)
   └─ src/server/
        ├─ auth/ ............... requireUser, requireKitchenRole
        ├─ parsers/ ............ (opsional, v2) parser aturan untuk PDF teks
        ├─ reconcile/ .......... (v2) matcher.ts, tidak dibuat di MVP
        ├─ export/ ............. plombokan-xlsx.ts
        └─ extraction/ ......... ai-extract.ts, normalize-image.ts, checks.ts
   │
   ▼  identitas pengguna diteruskan (JWT) → RLS aktif
Supabase
   ├─ Postgres: tabel domain + RLS + trigger kunci periode + audit append-only
   ├─ Auth: email/kata sandi + TOTP
   └─ Storage: bucket privat per dapur (prefiks kitchen_id/)
```

**Dua jalur akses ke database:**
- **Jalur pengguna** (default untuk semuanya): klien Supabase dengan token pengguna. RLS berlaku.
- **Jalur service-role** (sangat terbatas): hanya untuk tugas sistem yang tidak punya pengguna, misalnya pekerjaan pembersihan terjadwal. Hanya dari modul `src/server/admin/`, selalu diawali `import 'server-only'`, dan setiap pemakaian harus ada catatan alasan di kode. **Tidak boleh dipakai di jalur permintaan pengguna.**

---

## 4. Pipeline ekstraksi

Bukti transfer datang sebagai PDF dan, biasanya, JPG [Dinyatakan]. Gambar tidak punya lapisan teks, jadi jalur utama adalah **model AI yang membaca gambar atau PDF**. Jalur ini aktif karena yayasan mengizinkan pengembangan dan penggunaan sistem [Dinyatakan]. Cakupan izin yang menyebut penyedia AI pihak ketiga perlu dicatat tertulis (`SECURITY.md` S-14, `docs/CONSENT.md`).

```
unggah berkas (PDF / JPG / PNG)
  → validasi (magic bytes, ukuran, dimensi, SHA-256, duplikat)
  → normalisasi gambar (orientasi, buang EXIF, batasi piksel, ubah ukuran)
  → simpan ke Storage (nama acak, bucket privat)
  → EXTRACTION_MODE=manual ? ──ya──► needs_manual (tanpa panggilan keluar)
  → ekstraksi AI → JSON → validasi Zod
  → pemeriksaan konsistensi (checks.ts)
        ├─ lolos ──► draf dengan keyakinan per field
        └─ gagal / tak terbaca ──► needs_manual
  → usulan dapur dari rekening pengirim (satu rekening = satu dapur)
  → usulan deskripsi dari aturan penerima
  → layar review → posting
```

Kontrak hasil ekstraksi (nominal sebagai string digit agar tak pernah melewati `float`; diubah ke `bigint` setelah divalidasi):

```ts
export interface ExtractedTransferProof {
  txDate: string | null;              // 'YYYY-MM-DD'
  referenceNo: string | null;
  amount: string | null;              // digit rupiah tanpa pemisah
  senderAccount: string | null;
  recipientAccount: string | null;
  recipientName: string | null;
  recipientBank: string | null;
  memo: string | null;
  rawText: string | null;             // transkripsi untuk pemeriksaan internal; tidak boleh dicatat di log
  confidence: Record<string, number>; // 0..1 per field
}
```

Aturan:
- **Satu pintu keluar.** Pengiriman ke penyedia AI hanya dari `src/server/extraction/ai-extract.ts` dan hanya bila `EXTRACTION_MODE=ai`. Mode `manual` harus terbukti tidak melakukan panggilan jaringan keluar (uji dengan jaringan diblokir).
- **Minimisasi data.** Yang dikirim hanya berkas yang sedang diproses. Tidak ada nama dapur, saldo, atau konteks lain.
- Prompt sistem tetap berada di kode. Model **tidak diberi alat**. Keluaran JSON, divalidasi Zod. Field yang tak terbaca dikembalikan `null`, bukan tebakan.
- Nama model dari `LLM_MODEL` (jangan di-hardcode). Verifikasi string model di dokumentasi resmi sebelum dipakai.
- **Batas biaya:** rate limit per pengguna dan batas harian per dapur. Bila tercapai, berkas masuk `needs_manual`.
- **Akurasi belum teruji.** Kemampuan model membaca digit dari tangkapan layar m-banking nyata belum diukur [Low confidence]. Karena itu review manusia dengan gambar berdampingan wajib, dan akurasi diukur per bank dan per tipe berkas saat pilot.
- Parser aturan per bank (v2) hanya dibuat setelah ada contoh nyata yang disamarkan, untuk PDF bernilai teks. Fungsinya menekan biaya dan memberi pemeriksaan silang, bukan menggantikan review.
- Pengujian: klien AI tiruan sebagai default. Fixture gambar sintetis dibuat dari HTML yang dirender ke PNG. Evaluasi dengan API sungguhan hanya bila `RUN_LIVE_EXTRACTION_EVAL=true` dan hanya dengan berkas sintetis atau yang sudah disamarkan.

## 5. Variabel lingkungan

| Variabel | Lingkup | Keterangan |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | publik | URL proyek |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publik | Kunci anon. Aman diekspos **hanya karena RLS aktif** di semua tabel |
| `SUPABASE_SERVICE_ROLE_KEY` | **rahasia, server saja** | Tidak boleh berawalan `NEXT_PUBLIC_` |
| `FIELD_ENCRYPTION_KEY` | **rahasia, server saja** | Kunci enkripsi nomor rekening di tingkat aplikasi (32 byte, base64) |
| `FIELD_HASH_KEY` | **rahasia, server saja** | Kunci HMAC terpisah untuk hash pencarian aturan penerima (32 byte, base64) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | rahasia, server | Rate limit |
| `EXTRACTION_MODE` | server | `ai` (default) atau `manual`. Mode `manual` menonaktifkan seluruh pengiriman ke penyedia AI |
| `ANTHROPIC_API_KEY` | **rahasia, server saja** | Wajib bila `EXTRACTION_MODE=ai` |
| `LLM_MODEL` | server | Dikonfigurasi, tidak di-hardcode. Verifikasi string model di dokumentasi resmi |
| `EXTRACTION_DAILY_LIMIT` | server | Batas berkas per dapur per hari untuk mengendalikan biaya |
| `SENTRY_DSN` | server/publik | Opsional |

Aturan: file `.env*` selalu di `.gitignore`. Repo menyertakan `.env.example` berisi nama variabel tanpa nilai. Variabel rahasia dibaca lewat modul `src/server/env.ts` yang memvalidasi dengan Zod saat startup dan gagal keras jika hilang.

---

## 6. Struktur repositori

```
/
├─ AGENTS.md
├─ docs/  (PRD.md, TECH-STACK.md, SECURITY.md, DESIGN.md, SKILLS.md, DEPENDENCIES.md)
├─ supabase/
│   ├─ migrations/        # skema, RLS, trigger, fungsi
│   └─ tests/             # uji RLS (pgTAP atau SQL)
├─ src/
│   ├─ app/               # route Next.js
│   ├─ components/ui/     # komponen dasar sesuai DESIGN.md
│   ├─ components/domain/ # tabel buku kas, panel review, dll.
│   ├─ server/            # kode yang hanya jalan di server
│   ├─ lib/               # util murni (format rupiah, tanggal)
│   └─ types/
├─ tests/
│   ├─ unit/
│   ├─ e2e/
│   └─ fixtures/          # data SINTETIS saja
└─ .github/workflows/ci.yml
```

---

## 7. CI/CD

Setiap pull request wajib lolos:
1. `tsc --noEmit`, ESLint, Prettier check
2. Vitest
3. Uji RLS (pengguna dapur A tidak bisa membaca/menulis data dapur B)
4. `npm audit --omit=dev` (gagal pada severity High ke atas, kecuali ada pengecualian tertulis)
5. Pemindaian rahasia (gitleaks atau setara)
6. Playwright untuk alur kritis (login, unggah, review, posting, ekspor) pada rilis, bukan setiap commit
7. Build produksi
8. Uji ekstraksi dengan klien AI tiruan (`npm run test:extraction`). Evaluasi dengan API sungguhan hanya manual dan hanya dengan berkas sintetis atau yang sudah disamarkan.

Rilis ke produksi: manual dengan persetujuan, dari branch `main` saja. Migrasi database dijalankan sebelum aplikasi, dan harus dapat dimundurkan atau bersifat aditif.

---

## 8. Lingkungan

| Lingkungan | Data | Catatan |
|---|---|---|
| `local` | Sintetis | Supabase lokal atau proyek dev |
| `demo` | **Sintetis saja** | Untuk diperlihatkan ke teman Ricky |
| `production` | Nyata | Dibuat **di akun atas nama yayasan** setelah gerbang `SECURITY.md` bagian D lulus. Izin yayasan [Dinyatakan] perlu dicatat tertulis |

---

## 9. Batas dan risiko stack

- **Ketergantungan pada satu vendor (Supabase).** Skema memakai SQL standar dan migrasi tertulis, jadi pindah ke Postgres lain dimungkinkan, tetapi RLS yang bergantung pada `auth.uid()` perlu disesuaikan. Biaya pindah: sedang.
- **Ketergantungan pada penyedia AI.** Layanan bisa turun, berubah harga, atau mengubah perilaku model. Mitigasi: keluaran divalidasi skema, review manusia wajib, mode `manual` selalu tersedia, batas biaya harian.
- **Akurasi membaca gambar** belum teruji pada contoh nyata [Low confidence]. Mitigasi: pilot terukur per bank dan per tipe berkas.
- **Data keluar ke pihak ketiga.** Gambar bukti transfer memuat nomor rekening dan nama. Mitigasi: minimisasi, buang EXIF, catat izin yayasan tertulis, periksa ketentuan retensi penyedia [Perlu verifikasi].
- **Ekstraksi PDF di server serverless** punya batas waktu dan memori. Batasi ukuran file dan jumlah per batch (PRD F3.1).
- **Pengembangan dari ponsel dengan bantuan agent** meningkatkan risiko kode tak teruji lolos. Karena itu CI wajib dan `AGENTS.md` mengharuskan uji sebelum selesai.

---

## 10. Log keputusan

| Tanggal | Keputusan | Alasan | Status |
|---|---|---|---|
| 22 Okt 2026 | Supabase + RLS sebagai tulang punggung isolasi dapur | Lihat bagian 1 | Diusulkan |
| 22 Okt 2026 | LLM fallback dimatikan default | Menunggu izin yayasan | **Digantikan 23 Okt 2026** |
| 22 Okt 2026 | Tidak ada modul kredensial bank | Keputusan Ricky | Final |
| 23 Okt 2026 | Ekstraksi berbasis AI menjadi jalur utama (gambar dan PDF) | Bukti transfer sering berbentuk JPG; yayasan mengizinkan penggunaan sistem | Diusulkan |
| 23 Okt 2026 | Rekonsiliasi mutasi bank ditunda ke v2 | Kebutuhan saat ini hanya pembukuan otomatis | Final untuk MVP |
| 23 Okt 2026 | Satu rekening per dapur; nota di luar scope; pelaporan hanya Excel | Jawaban Ricky | Final untuk MVP |
| 25 Okt 2026 | Keputusan `OI-01` s.d. `OI-10` (lihat `docs/OPEN-ISSUES.md`): skema MVP tanpa tabel v2/`transaction_receipts`; MFA TOTP (`aal2`) aktif penuh termasuk di demo; saldo awal disimpan di `periods.opening_balance` dan dirender sebagai baris pertama `PERPINDAHAN SALDO` di UI/Excel; relasi `parent_transaction_id` untuk pasangan `admin_fee`; persetujuan dependensi `sharp` dan `pdf-lib` | Menyelaraskan dokumen dan mencegah hitung ganda saldo awal | Final untuk MVP |

---

## 11. Serah terima dan kepemilikan

Yayasan menjadi pemilik sistem setelah pembayaran penuh dan menanggung hosting [Dinyatakan]. Karena itu:

- **Akun infrastruktur** (Supabase, Vercel, Upstash, penyedia AI, organisasi repositori) dibuat atas nama dan tagihan yayasan sejak awal, dengan Ricky sebagai kolaborator terbatas. Ini menghindari migrasi saat serah terima.
- **Akses data produksi:** Ricky tidak memiliki akses baca ke data produksi secara default. Akses darurat dicatat dan diberitahukan. Pengembangan dan debugging memakai data sintetis.
- **Status kepemilikan kode sebelum pembayaran penuh**, ruang lingkup, dukungan pasca-serah-terima, dan tanggung jawab data diatur dalam **perjanjian tertulis**. Ini bukan nasihat hukum; minta peninjauan pihak yang kompeten.
- **Daftar serah terima:** repositori, dokumen (`docs/`), rotasi semua rahasia saat serah terima, akun dan hak akses, runbook (cadangan, pemulihan, rotasi kunci, kehilangan perangkat MFA), kontak darurat.
- **Biaya berulang untuk yayasan:** hosting, database, penyimpanan, dan biaya AI per berkas. Perkiraan biaya belum ada (PRD Q13); ukur saat pilot dan beri tahu yayasan sebelum produksi.

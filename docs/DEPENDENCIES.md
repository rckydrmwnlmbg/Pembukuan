# DEPENDENCIES — Daftar Dependensi Terkunci Kasdapur

| | |
|---|---|
| Tanggal pencatatan | 25 Oktober 2026 |
| Aturan acuan | `AGENTS.md` bagian 6 & 9, `TECH-STACK.md` bagian 2, `SECURITY.md` S-11 |
| Kebijakan versi | Seluruh dependensi dikunci tepat (tanpa `^` atau `~`) di `package.json` dan `package-lock.json` |

---

## 1. Dependensi Produksi (`dependencies`)

| Paket | Versi Terkunci | Alasan & Kegunaan | Rujukan Dokumen |
|---|---|---|---|
| `next` | `16.4.3` | Framework aplikasi (App Router, Server Components, Route Handlers, Middleware, `next/font/google`). Bebas dari CVE-2025-29927 | `TECH-STACK.md` §2, `SECURITY.md` S-01 |
| `react` | `19.3.1` | Pustaka UI inti untuk komponen server dan klien | `TECH-STACK.md` §2 |
| `react-dom` | `19.3.1` | Renderer DOM untuk React | `TECH-STACK.md` §2 |
| `server-only` | `0.0.1` | Penjaga waktu-build agar modul `src/server/**` gagal di-build bila tak sengaja diimpor dari kode klien | `AGENTS.md` §5, `SECURITY.md` S-04 |
| `@supabase/supabase-js` | `2.118.0` | Klien PostgreSQL (dengan RLS), Supabase Auth (termasuk MFA TOTP), dan Supabase Storage | `TECH-STACK.md` §2, `SECURITY.md` S-01..S-03 |
| `@supabase/ssr` | `0.12.7` | Pengelolaan sesi berbasis cookie di Next.js App Router & Middleware | `SECURITY.md` S-01, S-10 |
| `zod` | `4.6.7` | Validasi skema ketat (`.strict()`) di setiap batas data (env, form, route API, hasil ekstraksi AI) | `AGENTS.md` §6, `SECURITY.md` S-04, S-07, S-08, S-14 |
| `@upstash/ratelimit` | `2.2.0` | Pembatas laju (*sliding window*) untuk login, MFA, unggah, ekstraksi AI, dan API umum | `TECH-STACK.md` §2, `SECURITY.md` S-09 |
| `@upstash/redis` | `1.39.0` | Klien Redis HTTP serverless untuk menyimpan state pembatas laju | `TECH-STACK.md` §2, `SECURITY.md` S-09 |
| `pino` | `10.4.0` | Logger terstruktur di sisi server dengan fitur `redact` untuk menyensor nomor rekening, token, dan teks bukti transfer | `TECH-STACK.md` §2, `SECURITY.md` S-12 |
| `exceljs` | `4.4.0` | Pembuatan dan pembacaan berkas `.xlsx` berformat identik dengan buku kas Plombokan (gaya sel, lebar kolom, rumus berantai) | `TECH-STACK.md` §2, `SKILLS.md` §4 |
| `sharp` | `0.35.5` | Validasi dimensi gambar (anti *decompression bomb*), rotasi orientasi, penghapusan metadata EXIF/GPS, dan pengubahan ukuran gambar bukti transfer (`OI-08`, disetujui 25 Okt 2026) | `TECH-STACK.md` §2, `SECURITY.md` S-08 |
| `pdf-lib` | `1.17.1` | Pemeriksaan jumlah halaman PDF (`MAX_PAGES = 10`) dan deteksi PDF berproteksi kata sandi secara murni di JavaScript tanpa `child_process` (`OI-08`, disetujui 25 Okt 2026) | `SECURITY.md` S-05, S-08, `PRD.md` E2 |
| `lucide-react` | `1.61.0` | Satu-satunya set ikon garis (1,5px, ukuran 16px/20px) sesuai standar desain | `DESIGN.md` §3.5 |
| `@radix-ui/react-dialog` | `1.3.1` | Primitif dialog modal aksesibel (fokus terkurung, tutup dengan `Esc`) | `TECH-STACK.md` §2, `DESIGN.md` §5.6 |
| `@radix-ui/react-dropdown-menu` | `2.2.1` | Primitif menu aksi baris dan pemilih dapur aksesibel papan ketik | `TECH-STACK.md` §2, `DESIGN.md` §4, §8.4 |
| `@radix-ui/react-select` | `2.4.1` | Primitif kontrol pemilih periode/filter aksesibel | `TECH-STACK.md` §2, `DESIGN.md` §5.2 |
| `@radix-ui/react-tabs` | `1.2.1` | Primitif tab aksesibel (layar review di layar `< 768px`) | `TECH-STACK.md` §2, `DESIGN.md` §8.3 |
| `@radix-ui/react-tooltip` | `1.4.1` | Primitif tooltip aksesibel untuk sidebar ciut dan deskripsi panjang tabel | `TECH-STACK.md` §2, `DESIGN.md` §4, §5.3 |
| `@radix-ui/react-checkbox` | `1.4.1` | Primitif kotak centang aksesibel (mis. biaya admin Rp 6.500 di layar review) | `TECH-STACK.md` §2, `DESIGN.md` §8.3 |

---

## 2. Dependensi Pengembangan (`devDependencies`)

| Paket | Versi Terkunci | Alasan & Kegunaan |
|---|---|---|
| `typescript` | `6.0.3` | Pemeriksaan tipe statis (`strict: true`, `npm run typecheck`) |
| `@types/node` | `26.6.5` | Definisi tipe Node.js |
| `@types/react` | `19.3.0` | Definisi tipe React |
| `@types/react-dom` | `19.3.0` | Definisi tipe React DOM |
| `tailwindcss` | `4.3.3` | Utilitas CSS yang dipetakan ke variabel token `DESIGN.md` §3 |
| `@tailwindcss/postcss` | `4.3.3` | Plugin PostCSS resmi untuk Tailwind CSS v4 |
| `postcss` | `8.5.31` | Pemroses CSS untuk build Next.js |
| `eslint` | `9.39.5` | Linter kode statis (`npm run lint`) |
| `@eslint/js` | `9.39.5` | Aturan dasar JavaScript untuk ESLint Flat Config |
| `typescript-eslint` | `8.72.0` | Parser dan aturan ESLint untuk TypeScript (`no-explicit-any`, `ban-ts-comment`) |
| `eslint-plugin-react` | `7.37.5` | Penegakan aturan keamanan React (`react/no-danger` melarang `dangerouslySetInnerHTML`) |
| `eslint-plugin-react-hooks` | `7.1.1` | Penegakan aturan React Hooks |
| `prettier` | `3.9.10` | Pemformat kode konsisten |
| `vitest` | `5.0.5` | Kerangka uji unit dan uji ekstraksi (`npm run test`, `npm run test:extraction`) |
| `@playwright/test` | `1.64.1` | Kerangka uji E2E dan tangkapan layar penerimaan visual 1440/1024/390 (`npm run test:e2e`) |
| `@axe-core/playwright` | `4.14.0` | Pengujian aksesibilitas WCAG AA otomatis pada Playwright (`SKILLS.md` §6) |
| `tsx` | `4.23.15` | Eksekutor TypeScript untuk skrip `npm run seed:demo` |

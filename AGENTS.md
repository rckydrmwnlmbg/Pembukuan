# AGENTS.md — Aturan Kerja Agent untuk Kasdapur (nama kerja)

*Versi 0.2, 23 Oktober 2026. Scope MVP dipangkas: pembukuan otomatis dari bukti transfer (PDF/JPG) ke Excel per dapur. Rekonsiliasi mutasi bank ditunda ke v2.*

Dokumen ini dibaca **pertama** oleh setiap agent sebelum mengubah apa pun di repositori ini.

> **Catatan Antigravity [Perlu verifikasi].** Saya tidak dapat memastikan dari sini apakah Antigravity membaca `AGENTS.md` di akar repositori secara otomatis, atau memakai folder aturan/skill sendiri (misalnya `.agent/`). Jika memakai folder sendiri, salin bagian 2 (aturan emas) dan bagian 9 (berhenti dan bertanya) ke dalam aturan global proyek, dan tempatkan isi `SKILLS.md` sesuai konvensi yang berlaku di versi Antigravity yang dipakai.

---

## 1. Produk dalam tiga kalimat

Kasdapur membantu maker keuangan yayasan mengelola pembukuan beberapa dapur (SPPG). Maker mengunggah bukti transfer (PDF atau JPG), memeriksa hasil bacaan AI, menyimpannya ke buku kas **per dapur**, lalu mengekspor Excel berformat sama seperti rekapan manual. Sistem **tidak pernah** menyentuh kredensial atau akun bank. Rekonsiliasi dengan mutasi bank adalah v2.

## 2. Aturan emas (tidak boleh dilanggar, tidak boleh ditawar)

1. **Isolasi dapur.** Setiap dapur punya buku dan saldo sendiri. Tidak ada kode, kueri, tampilan, atau ekspor yang menjumlahkan lintas dapur. Pengguna dapur A tidak boleh dapat membaca/menulis data dapur B, dan ini ditegakkan di database lewat RLS.
2. **Uang adalah bilangan bulat.** Rupiah disimpan `bigint`, dihitung dengan `bigint`/integer. **Dilarang** `float`, `double`, `Number` untuk nominal yang diparse.
3. **Tidak ada kredensial bank, tidak ada login otomatis ke bank, tidak ada eksekusi transfer.** Sistem hanya menerima file unggahan.
4. **Manusia memeriksa sebelum posting.** Hasil ekstraksi (aturan maupun LLM) selalu berstatus draf sampai pengguna menyimpan. Tidak ada posting otomatis.
5. **Gagal aman.** Ekstraksi (AI maupun aturan) yang tidak yakin mengembalikan `null` untuk field itu, dan berkas yang tak terbaca masuk `needs_manual`. Dilarang menebak nominal atau tanggal.
6. **Data sintetis saja.** Dilarang memasukkan data nyata (rekening, nama, nominal dari berkas Excel asli) ke repositori, fixture, seed, tangkapan layar, atau log. Berkas Excel asli tidak boleh di-commit.
7. **RLS di setiap tabel.** Tabel baru tanpa RLS dan uji lintas dapur tidak boleh digabung.
8. **Tidak ada rahasia di klien atau di Git.** Lihat `SECURITY.md` S-04.
9. **UI mengikuti `DESIGN.md`** dan lolos penerimaan visual (bagian 13 dokumen itu). Dilarang pola yang tercantum di bagian 2 `DESIGN.md`.
10. **Jangan mengarang.** Jangan mengarang nomor versi paket, nama fungsi API, format PDF bank, atau fakta tentang bank. Jika tidak tahu: periksa dokumentasi resmi, atau tandai `UNVERIFIED` dan tanyakan.
11. **Satu pintu keluar ke penyedia AI.** Pengiriman berkas hanya dari `src/server/extraction/ai-extract.ts`, hanya bila `EXTRACTION_MODE=ai`, dan hanya berkas yang sedang diproses. Mode `manual` tidak boleh melakukan panggilan keluar.
12. **Lingkup MVP.** Rekonsiliasi, status DONE/ON PROGRESS, pengelolaan nota, dan peran pemeriksa/approver **tidak dibangun** tanpa persetujuan eksplisit (PRD v0.2).

## 3. Dokumen otoritatif dan urutan prioritas

Jika dokumen bertentangan, yang lebih atas menang:

1. `SECURITY.md` (keamanan menang atas kenyamanan dan kecepatan)
2. `PRD.md` (apa yang dibangun dan batasnya)
3. `DESIGN.md` (bagaimana tampilannya)
4. `TECH-STACK.md` (dengan apa dibangun)
5. `SKILLS.md` (cara mengerjakan tugas berulang)

Jika menemukan pertentangan atau lubang di dokumen, **catat** di `docs/OPEN-ISSUES.md` dan tanyakan. Jangan memilih diam-diam.

## 4. Perintah proyek

Buat skrip berikut di `package.json` pada milestone M0 (nama harus persis ini agar CI dan agent lain konsisten):

| Skrip | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (unit) |
| `npm run test:rls` | Uji RLS/skema di database lokal |
| `npm run test:e2e` | Playwright |
| `npm run audit:deps` | `npm audit --omit=dev --audit-level=high` |
| `npm run check:routes` | Pemindai rute API (SECURITY S-07) |
| `npm run check:secrets` | Pemindai rahasia |
| `npm run test:extraction` | Uji ekstraksi dengan klien AI tiruan dan fixture sintetis |
| `npm run seed:demo` | Isi data demo sintetis |

Sebelum menyatakan tugas selesai, jalankan: `lint`, `typecheck`, `test`, dan `test:rls` bila menyentuh database.

## 5. Struktur repositori

Ikuti `TECH-STACK.md` bagian 6. Ringkasnya: `supabase/migrations`, `supabase/tests`, `src/app`, `src/components/ui`, `src/components/domain`, `src/server`, `src/lib`, `tests/{unit,e2e,fixtures}`. Kode yang hanya boleh berjalan di server berada di `src/server` dan mengimpor `server-only`.

## 6. Konvensi kode

- TypeScript `strict: true`. Tanpa `any` (gunakan `unknown` lalu persempit). Tanpa `@ts-ignore` tanpa komentar alasan.
- Setiap batas data (form, route, hasil parser, hasil LLM) divalidasi dengan Zod.
- Nama berkas `kebab-case`; komponen React `PascalCase`; identifier dan nama tabel/kolom dalam bahasa Inggris `snake_case` di database, `camelCase` di TypeScript.
- Teks antarmuka dalam bahasa Indonesia sesuai `DESIGN.md` bagian 9. Komentar kode dalam bahasa Indonesia atau Inggris, konsisten per berkas.
- Fungsi parser dan perhitungan keuangan adalah **fungsi murni** (tanpa jaringan, tanpa `Date.now()` tersembunyi).
- Format rupiah dan tanggal lewat satu modul `src/lib/format.ts`. Dilarang memformat manual di komponen.
- Pesan galat ke pengguna: apa yang terjadi + cara memperbaiki. Detail teknis hanya di log server yang sudah ter-redaksi.
- Tidak ada `console.log` untuk data keuangan. Gunakan logger (`SECURITY.md` S-12).
- Dependensi baru: tambahkan hanya bila perlu, catat alasan di `docs/DEPENDENCIES.md`, dan **tanyakan dulu** (bagian 9).

## 7. Konvensi keuangan

- Konvensi kolom mengikuti berkas sumber: **DEBIT = uang masuk, KREDIT = uang keluar**.
- Saldo berjalan = saldo awal + Σ debit − Σ kredit, **dihitung sistem**, tidak disimpan sebagai kolom.
- Biaya admin bank = baris `admin_fee` terpisah dengan nomor referensi yang sama dengan transaksi induk. Kunci keunikan: `(kitchen_id, reference_no, kind)`.
- Tanggal transaksi bertipe `date` (WIB). Periode ditentukan oleh `tx_date`.
- Periode terkunci tidak dapat diubah (ditegakkan di database).
- Hapus permanen transaksi tidak ada. Gunakan status `void` dan catat di audit log.

## 8. Alur kerja untuk setiap tugas

1. **Baca** bagian dokumen yang relevan. Sebutkan di ringkasan dokumen apa yang dijadikan dasar.
2. **Rencana singkat** (maksimal 10 baris): berkas yang disentuh, skema yang berubah, risiko keamanan, uji yang akan ditulis. Untuk UI: rencana desain sesuai `DESIGN.md` bagian 13.
3. **Kerjakan dalam langkah kecil** yang dapat diuji. Satu perubahan logis per commit.
4. **Tulis uji bersama kode.** Perubahan perilaku tanpa uji tidak dianggap selesai.
5. **Tinjau diri sendiri** dengan checklist PR di `SECURITY.md` bagian D dan, untuk UI, penerimaan visual `DESIGN.md` bagian 13.
6. **Laporkan** dengan format bagian 10.

Commit memakai Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, `security:`. Branch: `feat/<ringkas>`, `fix/<ringkas>`. Jangan langsung ke `main`.

## 9. Berhenti dan tanyakan (jangan lanjut sendiri)

Hentikan pekerjaan dan ajukan pertanyaan spesifik jika:

- Persyaratan keuangan ambigu (cara menghitung, kapan baris dianggap cocok, perlakuan koreksi).
- Perubahan menyentuh **autentikasi, RLS, enkripsi, penyimpanan file, atau kunci periode**.
- Perlu **menambah dependensi** atau mengubah stack.
- Diminta atau tergoda memakai **data nyata**, mengubah `EXTRACTION_MODE`, mengubah apa yang dikirim ke penyedia AI, atau menghubungkan ke layanan eksternal baru.
- Perlu membuat **parser aturan per bank** (v2) tetapi tidak ada contoh yang sudah disamarkan; atau akan **mengklaim akurasi ekstraksi** tanpa pengukuran pada contoh.
- Dokumen saling bertentangan atau ada lubang yang memengaruhi desain.
- Uji gagal dan satu-satunya jalan keluar adalah melonggarkan uji, kebijakan RLS, atau validasi.

Pertanyaan harus menyertakan: apa yang diketahui, opsi yang dipertimbangkan, dan rekomendasi agent.

## 10. Definition of Done

Tugas selesai hanya jika **semua** berikut benar:

- [ ] Perilaku sesuai kriteria penerimaan (KP) pada `PRD.md` untuk fitur terkait
- [ ] `lint`, `typecheck`, `test` lulus; `test:rls` lulus bila menyentuh database
- [ ] Tidak ada pelanggaran aturan emas (bagian 2)
- [ ] Checklist PR `SECURITY.md` bagian D terisi
- [ ] UI: penerimaan visual lulus dan tangkapan layar tersimpan di `docs/screens/`
- [ ] Tidak ada data nyata, rahasia, atau `console.log` data keuangan
- [ ] Dokumen terkait diperbarui bila perilaku berubah

**Format laporan akhir agent:**

```md
## Ringkasan
<apa yang dikerjakan, 2-4 kalimat>

## Dasar dokumen
<bagian PRD/SECURITY/DESIGN yang dipakai>

## Perubahan
<daftar berkas>

## Pengujian
<perintah yang dijalankan dan hasilnya; uji yang ditambahkan>

## Risiko dan asumsi
<hal yang belum diverifikasi, ditandai UNVERIFIED atau Perlu verifikasi>

## Pertanyaan terbuka
<bila ada>
```

Jangan menulis "selesai" untuk hal yang tidak dijalankan. Bila suatu uji tidak bisa dijalankan di lingkungan agent, katakan terus terang.

## 11. Urutan pembangunan demo (milestone)

| M | Isi | Selesai bila |
|---|---|---|
| M0 | Perancah proyek, token desain, skrip, CI dasar | `lint`, `typecheck`, `test` hijau di CI |
| M1 | Skema (tanpa tabel v2), RLS, peran, Supabase Auth + MFA, data demo sintetis | Uji RLS lintas dapur lulus (SECURITY S-02) |
| M2 | Buku kas per dapur, saldo berjalan, ekspor Excel format sumber | Saldo akhir data demo sama dengan hitungan independen; Excel terbuka tanpa peringatan |
| M3 | Unggah PDF/JPG/PNG, normalisasi gambar, ekstraksi AI (klien tiruan di uji), layar review, posting, aturan penerima | Alur unggah → review → posting berjalan; duplikat ditolak; mode `manual` tanpa panggilan keluar |
| M4 | Kunci periode, saldo awal periode berikutnya otomatis, strip saldo periode, pengaturan dapur | Periode terkunci ditolak di DB; saldo awal terbawa benar |
| M5 | Homepage, login (+MFA), dasbor, polesan sesuai `DESIGN.md` | Penerimaan visual pada 1440/1024/390 |
| M6 | Audit keamanan penuh format SECURITY bagian C, gerbang demo | Tidak ada Critical/High terbuka |

**v2 (tidak dikerjakan sekarang):** unggah mutasi dan rekonsiliasi, status DONE/ON PROGRESS, parser aturan per bank, peran pemeriksa.

Jangan memulai milestone berikutnya sebelum yang sebelumnya lulus. Fitur di luar PRD MVP (v2/Nanti) **tidak dibangun** tanpa persetujuan eksplisit.

## 12. Hal yang dilarang

- Membuat modul yang memakai kredensial bank, scraping internet banking, atau otomatisasi browser ke situs bank.
- Menjumlahkan saldo lintas dapur di mana pun.
- Menjalankan kueri dengan kunci service-role di jalur permintaan pengguna.
- Mengirim isi berkas atau data rekening ke layanan eksternal di luar `src/server/extraction/`, atau saat `EXTRACTION_MODE=manual`.
- Melonggarkan RLS, CSP, validasi, atau batas laju demi membuat uji lulus.
- Membuat tangkapan layar, fixture, atau seed dari berkas Excel/PDF asli yang belum disamarkan.
- Mengklaim akurasi atau dukungan bank tertentu tanpa hasil pengukuran pada contoh nyata yang disamarkan.
- Menambahkan telemetri atau analitik pihak ketiga tanpa persetujuan.
- Menggunakan ikon emoji, gradien, kaca buram, atau pola lain dari daftar larangan `DESIGN.md`.

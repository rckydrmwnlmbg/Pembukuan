# SKILLS.md — Prosedur Tugas Berulang untuk Agent

| | |
|---|---|
| Versi | 0.2 |
| Tanggal | 23 Oktober 2026 |
| Dokumen terkait | `AGENTS.md`, `PRD.md`, `SECURITY.md`, `DESIGN.md`, `TECH-STACK.md` |

Setiap skill adalah prosedur tertulis untuk satu jenis tugas yang akan berulang. Agent **membaca skill yang relevan sebelum mulai** dan mengikuti langkahnya. Skill tidak boleh melonggarkan aturan di `AGENTS.md` bagian 2.

> **Catatan penempatan [Perlu verifikasi].** Setiap skill di bawah ditulis dengan blok metadata (`name`, `description`) seperti lazimnya berkas skill agent. Saya tidak dapat memastikan konvensi folder Antigravity. Jika Antigravity memakai folder skill sendiri (misalnya `.agent/skills/<nama>/SKILL.md`), pisahkan tiap skill menjadi satu berkas di sana. Jika tidak, biarkan dokumen ini sebagai satu berkas rujukan di akar repositori.

Daftar skill:

1. `bank-parser-builder` membuat parser aturan per bank untuk PDF bernilai teks (**opsional, v2**; hanya setelah ada contoh nyata yang disamarkan)
2. `ledger-integrity` menjaga ketepatan uang, saldo, dan impor
3. `reconciliation-matcher` mencocokkan buku dengan mutasi bank (**v2, tidak dikerjakan di MVP**)
4. `plombokan-excel-export` membuat Excel berformat sama dengan sumber
5. `rls-migration-author` menulis migrasi skema, RLS, dan uji
6. `ui-enterprise-implementer` membangun layar sesuai `DESIGN.md`
7. `security-auditor` mengaudit kode dengan format `SECURITY.md`
8. `demo-data-seeder` membuat data demo sintetis
9. `ai-extraction` membangun dan menguji ekstraksi bukti transfer (PDF/JPG/PNG) berbasis AI (**utama di MVP**)

---

## 1. bank-parser-builder

```yaml
name: bank-parser-builder
description: Gunakan saat menambah atau memperbaiki parser bukti transfer atau mutasi untuk satu bank (BNI, BCA, Mandiri, BPD Jateng). Wajib sebelum menulis kode apa pun di src/server/parsers/.
```

**Prasyarat keras.** Harus ada **contoh PDF/CSV nyata yang sudah disamarkan** dari bank itu, ditaruh pemiliknya di `tests/fixtures/<bank>/samples/` (nomor rekening dan nama diganti, struktur teks dan format angka dipertahankan). **Tanpa contoh, hentikan dan tanyakan.** Kerangka parser tanpa contoh hanya boleh berlabel `UNVERIFIED` dan tidak boleh dipakai di layar review sebagai "didukung".

**Langkah**
1. Ekstrak teks mentah dari contoh dan simpan sebagai fixture teks (`*.txt`) di samping contoh. Periksa urutan baris, pemisah, spasi ganda, dan penulisan label.
2. Tulis `detect(text)` yang bergantung pada penanda yang **khas bank itu** (judul dokumen, kata kunci tetap). Uji bahwa teks dari bank lain mengembalikan `false`.
3. Tulis `parse(text)` dengan jangkar label, bukan posisi baris absolut. Ekstrak: tanggal, nomor referensi, nominal, rekening pengirim, rekening/nama/bank penerima, berita bila ada.
4. **Parsing nominal** menjadi `bigint`:
   - buang `Rp`, spasi, dan pemisah ribuan sesuai format bank (titik atau koma; **jangan menebak**: pilih berdasarkan pola yang terlihat pada contoh dan uji kedua arah);
   - jika ada bagian desimal, hanya terima `,00`/`.00`; selain itu kembalikan `null`;
   - tolak nilai ≤ 0.
5. **Parsing tanggal** ke `YYYY-MM-DD`. Nama bulan Indonesia dan Inggris ditangani eksplisit lewat tabel, bukan `new Date(string)`.
6. Hitung `confidence` per field (1 jika jangkar label ditemukan dan format valid; lebih rendah bila hasil turunan/heuristik).
7. Aturan **gagal aman**: bila salah satu dari tanggal, nominal, atau nomor referensi tidak terbaca yakin → `return null`. Jangan mengembalikan objek setengah terisi.
8. Daftarkan parser di registri. Registri mencoba `detect` satu per satu; bila lebih dari satu parser cocok, hasilnya `needs_manual` (ambigu), bukan memilih yang pertama.

**Keluaran**
- `src/server/parsers/<bank>.ts`
- `tests/unit/parsers/<bank>.test.ts` dengan kasus: contoh normal, nominal dengan pemisah, tanggal berbagai bulan, bukti dari bank lain (harus `detect=false`), teks terpotong (harus `null`), teks dengan angka ganda (jangan salah ambil), dan teks berisi upaya injeksi seperti `=1+1` atau `<script>` (diteruskan sebagai teks apa adanya, tidak dieksekusi).
- Pembaruan `docs/PARSERS.md`: status parser (`VERIFIED` dengan jumlah contoh yang dipakai / `UNVERIFIED`).

**Verifikasi selesai**
- Semua fixture lulus; cakupan cabang parser ≥ 90%.
- Parser tidak mengimpor modul jaringan/waktu (uji impor).
- Dilarang mengklaim "mendukung bank X" di UI atau dokumen kecuali `VERIFIED`.

**Larangan.** Tidak memakai LLM di dalam parser. Tidak menyimpan PDF/teks asli di repositori. Tidak memakai regex yang rentan backtracking katastrofik pada teks tak tepercaya (uji dengan input panjang berulang).

---

## 2. ledger-integrity

```yaml
name: ledger-integrity
description: Gunakan saat menyentuh perhitungan saldo, posting transaksi, biaya admin, deteksi duplikat, penutupan periode, atau impor dari Excel. Wajib pada setiap perubahan yang memengaruhi angka uang.
```

**Invarian yang harus selalu benar**
1. Nominal `bigint`, non-negatif; satu baris tidak boleh memiliki debit dan kredit sekaligus.
2. Saldo berjalan = saldo awal periode + Σ debit − Σ kredit, **dihitung** (view/window function), tidak disimpan.
3. Urutan baris: `tx_date`, lalu `seq_no`. `seq_no` dibuat per `(kitchen_id, period_id)`.
4. Kunci keunikan `(kitchen_id, reference_no, kind)` hanya untuk `reference_no` tidak null dan status bukan `void`.
5. `admin_fee` selalu berpasangan dengan transaksi induk berbagi `reference_no`, dibuat dalam **satu transaksi database** yang sama.
6. Saldo awal periode N+1 = saldo akhir periode N saat periode N ditutup.
7. Periode terkunci tidak dapat ditulis (trigger, bukan hanya UI).

**Langkah saat menambah/mengubah logika**
1. Tulis dulu uji berbasis properti atau tabel kasus untuk invarian yang terpengaruh (mis. acak 1000 transaksi sintetis: saldo akhir cocok dengan penjumlahan independen).
2. Implementasi di SQL (view, fungsi, constraint) bila mungkin; logika TypeScript hanya untuk yang tidak bisa di SQL.
3. Pastikan operasi posting bersifat atomik (satu transaksi DB) dan idempoten (unggah ulang tidak menggandakan).
4. Pastikan setiap perubahan menulis `audit_logs` (aksi, sebelum, sesudah).

**Impor dari Excel (hanya untuk data uji sintetis atau data yang sudah disamarkan)**
1. Baca sel angka sebagai nilai, bukan rumus. Konversi ke `bigint` tanpa pembulatan; bila ada pecahan, hentikan dan laporkan.
2. Pisahkan baris menjadi `opening` (saldo awal), `incoming` (debit), `outgoing` (kredit), `admin_fee` (deskripsi berawalan "ADMIN BANK" atau sejenis, berbagi referensi dengan baris sebelumnya).
3. **Uji penerimaan:** saldo akhir sistem harus **sama persis** dengan sel `SISA UANG` pada Excel sumber. Bila berbeda, laporkan baris pertama yang menyimpang. Jangan "memperbaiki" sumber.

**Keluaran.** Migrasi/view/fungsi, uji, dan catatan pada `docs/LEDGER.md` bila ada aturan baru.

**Larangan.** `float`/`Number` untuk nominal. Menyimpan saldo berjalan sebagai kolom. Menghapus transaksi. Menggabungkan saldo antardapur.

---

## 3. reconciliation-matcher

```yaml
name: reconciliation-matcher
description: Gunakan saat membuat atau mengubah pencocokan baris buku dengan baris mutasi bank, perhitungan selisih, atau status rekonsiliasi.
```

**Definisi**
- **Selisih = saldo buku − saldo bank** pada tanggal acuan yang sama (sesuai strip persamaan di `DESIGN.md` 8.1).
- Saldo bank = `balance_after` pada baris mutasi terakhir dengan tanggal ≤ tanggal acuan. Bila mutasi tidak memuat saldo, hentikan dan tanyakan; jangan menurunkan dari saldo awal tebakan.
- Status `cocok` **hanya jika** selisih = 0 **dan** tidak ada item tak tercocok.

**Algoritma pencocokan (urut, satu-ke-satu)**
1. **Referensi + nominal sama** → `matched`.
2. **Referensi sama, nominal beda** → `amount_mismatch`. Tidak diselesaikan otomatis.
3. **Tanpa referensi** (mis. dana masuk, potongan kecil): cocokkan jika `|selisih tanggal| ≤ 1 hari`, nominal sama persis, dan **kandidat tepat satu**. Jika lebih dari satu kandidat → biarkan `unmatched` dan minta pengguna memilih. **Jangan menebak.**
4. Satu baris mutasi hanya boleh tercocok dengan satu transaksi, dan sebaliknya. Lakukan penguncian agar proses paralel tidak mencocokkan dua kali.
5. Hasil akhir tiga daftar: ada di buku tidak ada di bank; ada di bank belum dibukukan; nominal berbeda.

**Keluaran**
- `src/server/reconcile/matcher.ts` (fungsi murni: masukan dua daftar, keluaran hasil pencocokan).
- Uji tabel kasus: semua cocok; satu transaksi tak ada di bank; satu baris bank tak dibukukan; referensi sama nominal beda; dua kandidat ambigu; mutasi dari tanggal berbeda; duplikat referensi pada `admin_fee`; mutasi kosong.
- Uji properti: hasil tidak bergantung pada urutan masukan.

**Larangan.** Pencocokan "fuzzy" pada nominal. Mengubah transaksi buku otomatis dari mutasi (hanya usulan, pengguna mengonfirmasi). Menjumlahkan selisih antar rekening atau dapur.

---

## 4. plombokan-excel-export

```yaml
name: plombokan-excel-export
description: Gunakan saat membuat atau mengubah ekspor Excel buku kas satu dapur satu periode dengan format yang sama seperti berkas contoh PEMBUKUAN UMUM.
```

**Prasyarat.** Pemilik harus menaruh **templat sumber yang sudah dikosongkan/disamarkan** di `tests/fixtures/template/` (struktur sama, data diganti). Agent **membaca templat itu** untuk menentukan posisi sel, lebar kolom, gaya, format angka, dan rumus saldo. **Jangan mengandalkan ingatan atau deskripsi di dokumen ini untuk nomor baris tepat.**

**Struktur yang harus ditiru (dari pengamatan awal, verifikasi terhadap templat)**
- Tiga baris judul: nama yayasan; nama pembukuan dan PJ dapur; periode.
- Header kolom: NO, TANGGAL, NO. REFERENCE, DESKRIPSI, REKENING PENERIMA, BANK, DEBIT, KREDIT, TOTAL, KET, DOKUMENTASI NOTA.
- Baris data; saldo berjalan sebagai rumus berantai seperti sumber **dan** nilai tersimpan agar terbaca di semua aplikasi.
- Baris akhir `SISA UANG` dan catatan biaya admin; legenda status di bagian bawah bila ada pada templat.

**Langkah**
1. Muat templat dengan ExcelJS; salin gaya, bukan menggambar ulang dari nol, bila memungkinkan.
2. Isi judul dari data dapur dan periode.
3. Tulis baris data. **Nilai teks dari pengguna ditulis sebagai string** (jangan pernah sebagai objek `{formula}`). Hanya kolom saldo yang berupa rumus, dihasilkan sistem.
4. Terapkan format angka rupiah dan lebar kolom sesuai templat.
5. Hitung `SISA UANG` sama dengan saldo akhir sistem.

**Verifikasi**
- Uji: buka hasil dengan ExcelJS lagi dan bandingkan sel demi sel dengan data sumber.
- Uji: deskripsi `=1+1`, `+cmd`, `-2+3`, `@SUM(A1)` menghasilkan sel **string** (SECURITY S-13).
- Uji: saldo akhir di Excel = saldo akhir sistem = hitungan independen.
- Manual: file terbuka di Excel tanpa peringatan perbaikan (dilakukan manusia; agent menandai "perlu uji manual").

**Larangan.** Memasukkan data nyata ke fixture. Mengubah tata letak tanpa persetujuan.

---

## 5. rls-migration-author

```yaml
name: rls-migration-author
description: Gunakan saat menambah/mengubah tabel, kolom, kebijakan RLS, fungsi SQL, trigger, atau kebijakan Storage. Wajib untuk semua file di supabase/migrations dan supabase/tests.
```

**Langkah**
1. Tentukan: apakah tabel menyimpan data **per dapur**? Jika ya, wajib kolom `kitchen_id uuid not null references kitchens(id)`.
2. Tulis migrasi **aditif** dan dapat diulang. Hindari `drop` data; bila perlu, jelaskan di komentar dan minta persetujuan.
3. Untuk tabel baru:
   - `alter table ... enable row level security; ... force row level security;`
   - Buat kebijakan select/insert/update berdasarkan `public.has_kitchen_role(kitchen_id, array[...])` (lihat `SECURITY.md` S-02). Sengaja **tanpa kebijakan delete** untuk data keuangan.
   - Tambahkan `CHECK`, `NOT NULL`, dan indeks pada `kitchen_id` serta kolom yang sering difilter.
   - Tambahkan trigger audit bila tabel menyimpan data keuangan.
4. Fungsi SQL: `set search_path = ''`, nama objek berkualifikasi skema, `security invoker` kecuali ada alasan tertulis untuk `security definer`; `security definer` selalu disertai `revoke ... from public, anon`.
5. Storage: path berawalan `<kitchen_id>/`, kebijakan berdasarkan folder pertama (S-03).

**Uji wajib (`supabase/tests/`)**
- Sebagai anggota dapur A: tidak dapat `select/insert/update` baris dapur B.
- Sebagai `viewer`: tidak dapat menulis.
- Tidak ada kebijakan delete untuk data keuangan: `delete` menghasilkan 0 baris terpengaruh.
- Pemeriksaan global: tidak ada tabel `public` tanpa RLS.

**Verifikasi selesai.** `npm run test:rls` hijau. Migrasi dapat dijalankan dari database kosong sampai terbaru.

**Larangan.** Kebijakan `using (true)`. Memberi `anon` akses ke tabel domain. Mematikan RLS "sementara". Memakai kunci service-role untuk membuat uji lulus.

---

## 6. ui-enterprise-implementer

```yaml
name: ui-enterprise-implementer
description: Gunakan saat membangun atau mengubah layar atau komponen UI: homepage, login, dasbor, buku kas, review, rekonsiliasi, dan komponen dasar.
```

**Langkah**
1. Baca `DESIGN.md` bagian 2 (larangan), 3 (token), dan bagian layar yang dikerjakan.
2. **Tulis rencana** (maks 15 baris): token yang dipakai, sketsa tata letak ASCII, kondisi yang harus dirancang (kosong, memuat, galat, ada/tidak ada draf menunggu review, baris panjang, 134 baris). Periksa rencana terhadap bagian 2; buang apa pun yang bisa menjadi hasil generik untuk produk lain.
3. Bangun komponen dasar lebih dulu bila belum ada (`src/components/ui`), dengan halaman contoh di `/dev/ui`.
4. Bangun layar dari komponen dasar. Semua warna, radius, ukuran, spasi berasal dari token. **Dilarang nilai acak** di luar skala 4px.
5. Pastikan angka: rata kanan, `tabular-nums`, format lewat `src/lib/format.ts`.
6. Pastikan **nama dapur terlihat** di layar data dan di area unggah.
7. Data tampil dari data demo sintetis berlabel "Data contoh".

**Verifikasi (wajib, bukan opsional)**
- Ambil tangkapan layar di 1440, 1024, 390 lewat Playwright; simpan di `docs/screens/<layar>-<lebar>.png`.
- Periksa daftar penerimaan visual `DESIGN.md` bagian 13 satu per satu dan tulis hasilnya di PR.
- Jalankan uji aksesibilitas otomatis (mis. `@axe-core/playwright`) dan perbaiki pelanggaran serius. Alat otomatis tidak menangkap semuanya, jadi tetap uji navigasi papan ketik.
- Lakukan "lepas satu aksesori": hapus satu perlakuan dekoratif per layar.

**Larangan.** Memakai kelas atau pola yang tercantum di `DESIGN.md` 2 dan 12. Menambahkan ilustrasi, foto stok, testimoni, logo klien, atau statistik karangan. Menyalin komponen pustaka UI tanpa mengganti token.

---

## 7. security-auditor

```yaml
name: security-auditor
description: Gunakan saat diminta mengaudit keamanan kode, sebelum merge ke main, sebelum demo ke orang lain, dan sebelum data nyata masuk.
```

**Langkah**
1. Baca `SECURITY.md` penuh. Audit mengikuti S-01 sampai S-15, satu per satu.
2. Untuk setiap kategori, **periksa kode nyata**: buka berkas lokasi target, cari pola celah, jalankan perintah verifikasi yang tercantum (grep bundel, uji RLS, skrip rute, pemindai rahasia, audit dependensi).
3. Untuk setiap temuan, tulis dengan format `SECURITY.md` bagian C: Severity, Kategori, **File dan baris yang benar-benar dibaca**, Deskripsi, Cara nyata dieksploitasi (langkah yang dapat direproduksi), Bukti, Fix kode yang dapat diterapkan, Uji verifikasi, Status.
4. Jika tidak bisa membuktikan sebuah dugaan, tulis sebagai **"dugaan, perlu diverifikasi"**, bukan temuan, dan jangan beri severity tinggi.
5. Untuk kategori tanpa temuan: tulis "diperiksa, tidak ada temuan" dan **cara memeriksanya** (perintah/berkas).
6. Simpan di `docs/audit/AUDIT-<tanggal>.md`. Ringkasan di atas: jumlah per severity, daftar temuan terbuka, rekomendasi gerbang rilis.

**Perintah bantu (sesuaikan)**
```bash
npm run lint && npm run typecheck && npm run test && npm run test:rls
npm run audit:deps
npm run check:routes
npm run check:secrets
npm run build && grep -rIl -i "service_role\|SERVICE_ROLE_KEY\|ANTHROPIC_API_KEY" .next/static   # harus kosong
grep -rn "dangerouslySetInnerHTML\|child_process\|eval(" src/                                    # harus kosong
```

**Larangan.** Mengarang nomor baris atau berkas. Menandai selesai tanpa menjalankan perintah. Menurunkan severity agar rilis lolos. Memperbaiki temuan tanpa menulis uji yang mereproduksinya.

---

## 8. demo-data-seeder

```yaml
name: demo-data-seeder
description: Gunakan saat membuat atau mengubah data demo sintetis untuk menunjukkan produk tanpa data nyata.
```

**Aturan**
- Data **100% rekaan**, deterministik (generator acak dengan seed tetap) agar tangkapan layar dan uji stabil.
- Lima dapur demo dengan nama rekaan (jangan nama dapur/yayasan nyata). Saldo dan transaksi tiap dapur berdiri sendiri.
- Nomor rekening rekaan dengan pola yang jelas palsu (mis. diawali `9990`), nama penerima fiktif, nominal acak dalam rentang wajar.
- Meniru **pola**, bukan isi, buku kas sumber: satu periode ± 100–140 transaksi per dapur; jenis: pembelian bahan baku, galon, sewa kendaraan, insentif fasilitas, gaji relawan (transaksi massal satu referensi), dana masuk dari BGN (tanpa referensi), dan biaya admin Rp6.500 berpasangan.
- Sertakan skenario yang sengaja dipilih agar semua keadaan UI terlihat:
  - satu dapur rekonsiliasi **cocok** (selisih nol),
  - satu dapur dengan **dua item tak tercocok** (selisih bukan nol),
  - satu dapur dengan **draf menunggu review**,
  - satu dapur dengan periode **terkunci**,
  - satu unggahan berstatus `needs_manual`.
- Bukti transfer demo dibuat sebagai **berkas sintetis**: render HTML yang menyerupai tampilan bukti transfer (tanpa logo atau merek bank asli) menjadi PNG/JPG dan PDF dengan Playwright, lengkap dengan beberapa variasi (buram ringan, terpotong, gelap) untuk menguji `needs_manual`. (Mutasi bank sintetis hanya untuk v2.)
- Berikan label "Data contoh" pada UI saat `NEXT_PUBLIC_DEMO=true` **[nama variabel contoh; tambahkan ke `.env.example` dan `src/server/env.ts` bila dipakai]**.

**Verifikasi**
- Uji: saldo akhir tiap dapur demo sama dengan hitungan independen dari daftar transaksi.
- Uji: tidak ada string yang cocok dengan pola rekening nyata (cek terhadap daftar pola terlarang yang diberikan pemilik, bila ada).
- `npm run seed:demo` dapat dijalankan berulang (idempoten: menghapus data demo lama lalu mengisi ulang, **hanya** pada lingkungan `local`/`demo`, tidak pernah pada `production`; skrip menolak jalan bila `APP_ENV=production`).

**Larangan.** Menyalin nominal, nama, atau rekening dari berkas Excel/PDF asli. Menjalankan seeder pada basis data produksi.

---

## 9. ai-extraction

```yaml
name: ai-extraction
description: Gunakan saat membangun, mengubah, atau menguji ekstraksi bukti transfer (PDF, JPG, PNG) berbasis model AI: normalisasi gambar, panggilan penyedia AI, validasi keluaran, pemeriksaan konsistensi, batas biaya.
```

**Prasyarat**
- Baca `SECURITY.md` S-08 (validasi berkas) dan S-14 (ekstraksi AI) serta `TECH-STACK.md` bagian 4.
- `EXTRACTION_MODE` dan izin yayasan: perubahan pada apa yang dikirim ke penyedia AI **harus ditanyakan dulu** (`AGENTS.md` bagian 9).

**Langkah**
1. **Normalisasi masukan** (`normalize-image.ts`, memakai `validate-image.ts`): periksa magic bytes, ukuran, dimensi; terapkan orientasi; buang EXIF; ubah ukuran bila terlalu besar. PDF diteruskan apa adanya setelah validasi `%PDF-`, batas ukuran, dan batas halaman.
2. **Panggilan AI** (`ai-extract.ts`): ikuti pola di `SECURITY.md` S-14. Prompt sistem tetap di kode, berkas sebagai satu-satunya masukan pengguna, tanpa konteks lain, tanpa alat. Nama model dari `LLM_MODEL`. Verifikasi bentuk permintaan, header, dan versi API pada dokumentasi resmi sebelum menulis kode.
3. **Validasi keluaran** dengan skema Zod `.strict()`. Keluaran bukan JSON, field ekstra, atau nilai tak valid → `null` dan berkas menjadi `needs_manual`. Jangan memperbaiki keluaran secara diam-diam.
4. **Pemeriksaan konsistensi** (`checks.ts`): nominal > 0, tanggal tidak di masa depan, nominal besar, nominal ada di transkripsi, referensi selaras tanggal (heuristik, hanya menandai). Tanda-tanda ditampilkan di layar review.
5. **Usulan lanjutan:** dapur dari rekening pengirim (satu rekening = satu dapur) dan deskripsi dari `counterparty_rules` berdasarkan hash rekening penerima.
6. **Batas biaya:** `extractLimiter` per pengguna dan `EXTRACTION_DAILY_LIMIT` per dapur. Bila tercapai, berkas menjadi `needs_manual` tanpa memanggil penyedia.
7. **Penyimpanan hasil:** simpan hasil terstruktur, keyakinan, model yang dipakai, dan durasi. **Jangan menyimpan atau mencatat respons mentah atau transkripsi di log.**

**Pengujian**
- Klien AI **tiruan** sebagai default. Uji: keluaran valid, keluaran bukan JSON, field ekstra, nominal negatif, tanggal masa depan, respons kosong, timeout, status 429/500.
- Fixture gambar sintetis dari skill `demo-data-seeder`, termasuk gambar yang memuat kalimat injeksi. Pastikan alur tidak mengeksekusi instruksi dan keluaran tetap divalidasi.
- Uji mode `manual`: **tidak ada permintaan jaringan keluar** (blokir jaringan di uji).
- Uji batas harian dan rate limit.
- **Evaluasi akurasi dengan API sungguhan** hanya manual (`RUN_LIVE_EXTRACTION_EVAL=true`), hanya dengan berkas sintetis atau yang sudah disamarkan oleh pemilik. Laporkan akurasi **per field, per bank, dan per tipe berkas (PDF vs JPG)**. Jangan menyatakan angka akurasi tanpa pengukuran.

**Keluaran.** Modul di `src/server/extraction/`, uji di `tests/extraction/`, dan ringkasan hasil evaluasi di `docs/EXTRACTION-EVAL.md` (tanpa data nyata).

**Larangan.** Mengirim data selain berkas yang sedang diproses. Posting otomatis dari hasil AI. Meng-hardcode nama model atau kunci. Menambah penyedia AI lain tanpa persetujuan. Menyatakan akurasi tanpa data.

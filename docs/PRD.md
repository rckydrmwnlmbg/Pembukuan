# PRD — Kasdapur (nama kerja)

| | |
|---|---|
| Versi | 0.2 (draft untuk demo, scope dipangkas) |
| Tanggal | 23 Oktober 2026 |
| Penulis | Ricky |
| Status | Draft. Belum divalidasi dengan pengguna akhir |
| Dokumen pendamping | `TECH-STACK.md`, `SECURITY.md`, `DESIGN.md`, `AGENTS.md`, `SKILLS.md` |

## Riwayat perubahan

### v0.2 (23 Oktober 2026): scope dipangkas berdasarkan jawaban Ricky

Keputusan baru [Dinyatakan]:
- Kebutuhan saat ini **hanya pembukuan otomatis**: memindahkan bukti transfer ke rekapan Excel tiap dapur.
- Bukti transfer berbentuk **PDF dan, biasanya, JPG**. Ekstraksi memakai **model AI yang membaca gambar/PDF** sebagai jalur utama. Pemeriksaan manusia tetap wajib.
- **Satu rekening untuk satu dapur.**
- **Nota dikelola sendiri oleh pengguna**, di luar sistem. Kolom DOKUMENTASI NOTA dikosongkan.
- Pelaporan **hanya dari Excel**. Ekspor Excel adalah keluaran utama.
- Yayasan **mengizinkan** pengembangan dan penggunaan sistem.
- Yayasan menjadi pemilik sistem setelah pembayaran penuh; hosting ditanggung yayasan.
- Rekonsiliasi mutasi bank, status DONE/ON PROGRESS, alur approver, dan peran pemeriksa **dipindah ke v2**.

Dampak pada dokumen: F6 (rekonsiliasi) ke v2; F8 disederhanakan (kunci periode dan saldo awal otomatis, tanpa syarat rekonsiliasi); F10 tanpa saldo bank; F3 menerima JPG/PNG dan memakai AI; usulan deskripsi dari aturan penerima masuk MVP; Q1 sampai Q10 diperbarui di bagian 10.

**Konvensi penandaan.** Setiap klaim diberi tag agar agent dan pembaca tahu seberapa kokoh dasarnya.

- **[Fakta file]** diamati langsung di `PEMBUKUAN_UMUM_DAPUR_PLOMBOKAN_PERIODE_MARET_2026.xlsx`.
- **[Dinyatakan]** disampaikan langsung oleh Ricky.
- **[Asumsi]** dugaan yang belum diverifikasi. Jangan dibangun menjadi fitur permanen sebelum divalidasi.

---

## 1. Problem statement

### Siapa yang dirugikan
1. **Maker keuangan yayasan** yang mengelola pembukuan banyak dapur/SPPG sekaligus. [Dinyatakan: lima dapur saat ini, kemungkinan bertambah]
2. **Penanggung jawab dapur (PJ) dan pengurus yayasan** yang bergantung pada angka yang benar dan bisa diperiksa.

### Apa masalahnya
Pembukuan dibuat di Excel, satu file per dapur per bulan. Maker membaca bukti transfer lalu mengetik tiap kolom: tanggal, nomor referensi, deskripsi, rekening penerima, bank, nominal. Bukti transfer berupa PDF dan, biasanya, JPG. [Dinyatakan]

Dari file contoh (dapur Plombokan, Maret 2026):

- 134 baris transaksi dalam satu bulan untuk satu dapur. [Fakta file]
- Deskripsi memuat informasi yang tidak ada di bukti transfer, misalnya jumlah porsi dan periode (`347 PM periode 23-28 Februari`) serta jumlah galon dan harga satuan. [Fakta file]
- Biaya admin bank Rp6.500 dicatat sebagai baris terpisah, berbagi nomor referensi dengan transaksi induknya. Ada puluhan baris seperti ini. [Fakta file]
- Saldo dihitung dengan rumus berantai antarbaris (`=IF(G=H,"",saldo_sebelumnya+debit-kredit)`). Satu baris yang salah memengaruhi semua baris sesudahnya. [Fakta file]
- Dana masuk dari BGN dicatat tanpa nomor referensi. [Fakta file]
- Kolom `KET` terisi 2 dari 134 baris dan `DOKUMENTASI NOTA` kosong seluruhnya. Belum diketahui apakah nota diurus di tempat lain. [Fakta file]

### Kenapa ini merugikan
- **Waktu.** Jika dapur lain bervolume serupa, sekitar 670 baris diketik manual per bulan untuk lima dapur. [Asumsi: volume dapur lain belum diketahui]
- **Risiko salah ketik.** Salah satu digit nominal mengubah saldo semua baris di bawahnya.
- **Saldo buku bisa menyimpang dari saldo bank tanpa ada yang tahu.** Bukti transfer hanya merekam uang keluar yang dibuat sendiri. Dana masuk dan potongan kecil bank hanya terlihat di mutasi rekening.
- **Sulit diperiksa.** Tanpa jejak perubahan dan tanpa nota yang tertaut, pertanyaan dari yayasan sulit dijawab dengan bukti.
- **Beban akhir bulan.** Seluruh pekerjaan menumpuk menjelang penutupan.

### Hipotesis nilai
Jika ekstraksi bukti transfer dan penyusunan Excel diotomatisasi, maker mengubah pekerjaannya dari **mengetik** menjadi **memeriksa**. (Pencocokan saldo dengan mutasi bank, yang menurunkan risiko selisih terlambat ditemukan, ditunda ke v2.)

---

## 2. Target user dan persona

### Target user
- **Primer:** maker keuangan yang menyiapkan pembukuan banyak dapur.
- **Sekunder (v2):** PJ dapur dan pengurus yayasan sebagai pemeriksa baca-saja. Untuk saat ini hanya maker yang memakai sistem. [Dinyatakan]

> Persona di bawah adalah **hipotesis**. Nama dan detail bersifat ilustratif. Validasi dengan teman Ricky sebelum dijadikan dasar keputusan desain.

### Persona 1 — Maya, Maker Keuangan Yayasan (pengguna utama)
- **Konteks:** menyiapkan transfer di internet banking yayasan sebagai maker, lalu mencatat pembukuan lima dapur di Excel. Bekerja dari laptop kantor dan sesekali dari ponsel.
- **Tujuan:** pembukuan tiap dapur selesai dan akurat tanpa lembur di akhir bulan; saldo buku sama dengan saldo bank.
- **Frustrasi:** mengetik ulang data yang sudah ada di bukti transfer; takut salah satu digit; saldo bank tidak cocok dan tidak tahu baris mana penyebabnya.
- **Kompetensi digital:** nyaman dengan Excel dan internet banking; bukan pengembang.
- **Kriteria sukses:** sehari-hari ia hanya memeriksa hasil ekstraksi dan menekan simpan.

### Persona 2 — Pak Dedi, Pemeriksa (PJ dapur atau pengurus yayasan) — v2, bukan target MVP
- **Konteks:** menerima laporan bulanan dan ingin tahu saldo dapurnya wajar. Tidak menginput data.
- **Tujuan:** melihat saldo, rekonsiliasi, dan rincian transaksi dapurnya sendiri dengan cepat. Mengunduh Excel bila perlu.
- **Frustrasi:** menerima file Excel tanpa cara memastikan angkanya cocok dengan bank.
- **Kriteria sukses:** melihat status "sudah cocok dengan bank" pada bulan berjalan tanpa bertanya.

---

## 3. Goals dan non-goals

### Goals (MVP)
1. Mengubah unggahan bukti transfer (PDF atau JPG/PNG) menjadi baris pembukuan terstruktur dengan **review manusia sebelum disimpan**.
2. Menjaga **saldo yang terpisah tegas per dapur**. [Dinyatakan]
3. Menghasilkan **saldo periode yang benar per dapur** (saldo awal + masuk − keluar). Rekonsiliasi dengan mutasi bank ditunda ke v2.
4. Menghasilkan Excel dengan **format yang sama** seperti file Plombokan, agar bisa dipakai di alur yang ada.
5. Mencatat **jejak audit** untuk setiap perubahan.
6. Dapat didemokan ke pengguna akhir **tanpa data nyata**.

### Non-goals (MVP)
- **Tidak memakai kredensial bank, tidak melakukan login otomatis, tidak mengeksekusi transfer.** Sistem hanya menerima file yang diunggah. [Dinyatakan]
- **Tidak ada saldo atau laporan gabungan lintas dapur.** [Dinyatakan]
- Tidak menggantikan sistem approval/transfer di internet banking.
- Tidak menjadi sistem akuntansi jurnal berpasangan (double-entry). Formatnya buku kas satu entri dengan kategori. [Asumsi: persyaratan pelaporan yayasan/BGN belum diverifikasi]
- Tidak ada rekonsiliasi dengan mutasi bank di MVP (v2).
- Tidak ada pengelolaan nota. Nota dikelola pengguna di luar sistem.
- Tidak ada alur persetujuan (approver) dan tidak ada peran pemeriksa di MVP.
- Tidak ada status transaksi DONE / ON PROGRESS di MVP (v2).
- Tidak ada anggaran, payroll, atau modul vendor penuh.
- Tidak ada aplikasi mobile native. Web responsif cukup.

---

## 4. User stories

Format: **Sebagai** … **saya ingin** … **supaya** ….

| ID | Cerita |
|---|---|
| US-01 | Sebagai maker, saya ingin mengunggah beberapa bukti transfer (PDF atau JPG) sekaligus ke dapur tertentu, supaya saya tidak mengetik tiap baris. |
| US-02 | Sebagai maker, saya ingin melihat PDF di sebelah hasil ekstraksinya dan mengoreksi field yang salah, supaya tidak ada data keliru yang tersimpan. |
| US-03 | Sebagai maker, saya ingin sistem mengisi deskripsi otomatis untuk penerima yang sering muncul, supaya saya hanya mengubah bagian yang berbeda (tanggal, jumlah porsi). |
| US-04 | Sebagai maker, saya ingin biaya admin bank otomatis tercatat berpasangan dengan transaksinya, supaya tidak ada yang terlewat. |
| US-05 | Sebagai maker, saya ingin sistem menolak atau memperingatkan transaksi yang sudah pernah dicatat, supaya tidak ada pencatatan ganda. |
| US-06 | Sebagai maker, saya ingin mencatat dana masuk (misalnya dari BGN) dengan referensi, supaya saldo buku mencerminkan kenyataan. |
| US-07 | **[v2]** Sebagai maker, saya ingin mengunggah mutasi rekening dan melihat baris yang tidak cocok, supaya saya tahu penyebab selisih saldo. |
| US-08 | **[v2]** Sebagai maker, saya ingin melihat saldo buku, saldo bank, dan selisih per dapur, supaya saya tahu dapur mana yang perlu diperiksa. |
| US-09 | Sebagai maker, saya ingin mengekspor Excel dengan format Plombokan, supaya laporan bisa dikirim seperti biasa. |
| US-10 | Sebagai maker, saya ingin menutup bulan dan membawa saldo akhir sebagai saldo awal bulan berikutnya, supaya tidak ada salin-tempel saldo. |
| US-11 | **[Di luar scope]** Nota dikelola pengguna di luar sistem. |
| US-12 | **[v2]** Sebagai pemeriksa, saya ingin melihat buku kas dapur saya saja, supaya saya bisa memeriksa tanpa bisa mengubah data. |
| US-13 | Sebagai maker, saya ingin melihat riwayat perubahan transaksi, supaya perubahan bisa saya pertanggungjawabkan. |
| US-14 | Sebagai maker, saya ingin menambah dapur baru tanpa bantuan pengembang, supaya sistem ikut tumbuh. |

---

## 5. Daftar fitur

| Fitur | MVP | v2 | Nanti |
|---|:-:|:-:|:-:|
| F1 Autentikasi, MFA, peran per dapur | ✓ | | |
| F2 Manajemen dapur dan rekening | ✓ | | |
| F3 Unggah bukti transfer (PDF/JPG/PNG) + ekstraksi berbasis AI | ✓ | | |
| F4 Layar review dan posting | ✓ | | |
| F5 Buku kas per dapur (saldo berjalan) | ✓ | | |
| F6 Unggah mutasi + rekonsiliasi | | ✓ | |
| F7 Ekspor Excel format Plombokan | ✓ | | |
| F8 Kunci periode dan saldo awal otomatis (tanpa syarat rekonsiliasi) | ✓ | | |
| F9 Jejak audit | ✓ | | |
| F10 Ringkasan per dapur (tanpa total gabungan) | ✓ | | |
| Usulan deskripsi dari aturan penerima (belajar dari koreksi pengguna) | ✓ | | |
| Tautan nota ke transaksi (unggah foto) | | | ✓ |
| Peran pemeriksa dengan alur persetujuan | | ✓ | |
| Parser berbasis aturan untuk PDF bernilai teks (menekan biaya AI) | | ✓ | |
| Notifikasi (saldo bank ≠ saldo buku) | | ✓ | |
| Status transaksi DONE / ON PROGRESS | | ✓ | |
| Master vendor dan rekap payroll relawan | | | ✓ |
| Anggaran vs realisasi per kategori | | | ✓ |
| Bot WhatsApp untuk unggah | | | ✓ |
| OCR PDF pindai | | | ✓ |
| Laporan format BGN/yayasan otomatis [perlu verifikasi format] | | | ✓ |

Catatan: dasbor ringkasan per dapur (F10) menampilkan lima baris terpisah. **Tidak ada baris "total semua dapur".**

---

## 6. Functional requirements (MVP)

Notasi: **FR-Fx.y**. Setiap FR harus lolos kriteria penerimaan (KP).

### F1 — Autentikasi, MFA, peran
- **FR-F1.1** Pengguna masuk dengan email dan kata sandi. MFA TOTP **wajib** untuk peran maker dan admin.
- **FR-F1.2** Peran per dapur: `admin`, `maker`, `approver`, `viewer`. Seorang pengguna bisa punya peran berbeda di dapur berbeda.
- **FR-F1.3** Tidak ada pendaftaran publik. Pengguna dibuat atau diundang admin.
- **FR-F1.4** Sesi berakhir setelah 12 jam tidak aktif; logout menghapus cookie sesi.
- **KP:** pengguna tanpa keanggotaan di dapur X tidak dapat melihat satu pun data dapur X (diuji lewat UI dan API langsung).

### F2 — Dapur dan rekening
- **FR-F2.1** Admin membuat dapur dengan nama, kode, dan nama PJ.
- **FR-F2.2** Setiap dapur memiliki **tepat satu** rekening sumber [Dinyatakan]. Nomor rekening disimpan terenkripsi; tampilan memakai 4 digit terakhir.
- **FR-F2.3** Setiap dapur memiliki saldo awal periode sendiri. Tidak ada operasi yang menggabungkan saldo dua dapur.
- **KP:** menambah dapur kelima atau keenam tidak memerlukan perubahan kode atau migrasi skema.

### F3 — Unggah bukti transfer dan ekstraksi
- **FR-F3.1** Unggah banyak berkas PDF, JPG, atau PNG (maksimal 20 per batch, 10 MB per file) ke satu dapur.
- **FR-F3.2** Validasi: tipe sebenarnya (periksa magic bytes `%PDF-`, JPEG, atau PNG, bukan hanya ekstensi), ukuran, dimensi gambar maksimum, dan bukan duplikat (hash SHA-256 sama dalam dapur yang sama). HEIC dan format lain ditolak dengan pesan yang jelas. Metadata EXIF gambar dibuang sebelum disimpan atau dikirim.
- **FR-F3.3** Ekstraksi memakai **model AI yang membaca gambar atau PDF** (lihat `TECH-STACK.md` bagian 4). Hasil: tanggal, nomor referensi, nominal, rekening pengirim, rekening/nama/bank penerima, berita bila ada, dan keyakinan per field. Keluaran wajib lolos validasi skema. Mode `manual` menonaktifkan pengiriman ke penyedia AI.
- **FR-F3.4** Karena satu rekening hanya milik satu dapur, rekening pengirim dipakai untuk mengusulkan dapur tujuan. Jika tidak cocok dengan dapur yang dipilih, tampilkan peringatan "bukti ini tampaknya milik dapur X".
- **FR-F3.5** Jika berkas tak terbaca, field penting kosong, atau keluaran gagal validasi, berkas berstatus `needs_manual` dan pengguna mengisi form dengan berkas di sebelahnya. Sistem tidak menebak diam-diam.
- **FR-F3.6** Field berkeyakinan rendah ditandai di layar review.
- **FR-F3.7** Pemeriksaan konsistensi sebelum draf ditampilkan: nominal > 0; tanggal tidak di masa depan; nomor referensi tidak duplikat; nominal di atas ambang per dapur ditandai; dan, jika pola ini berlaku, nomor referensi berawalan tanggal transaksi (teramati pada baris contoh di berkas sumber [Medium confidence, perlu diuji pada lebih banyak contoh]).
- **KP:** pada set uji berisi contoh bukti transfer nyata yang disamarkan (PDF dan JPG, per bank), akurasi field nominal dan nomor referensi **diukur dan dilaporkan per bank dan per tipe berkas**. Ambang penerimaan (usulan awal ≥ 95%) dikonfirmasi setelah contoh nyata tersedia. Kegagalan membaca tidak boleh menghasilkan angka salah yang tampak yakin.

### F4 — Layar review dan posting
- **FR-F4.1** Tampilan dua panel: PDF di kiri, form hasil ekstraksi di kanan, navigasi antarfile dengan papan ketik.
- **FR-F4.2** Deskripsi diusulkan dari aturan penerima (lihat `counterparty_rules`); pengguna dapat mengubah.
- **FR-F4.3** Jika bank penerima berbeda dari bank pengirim dan biaya admin berlaku, sistem mengusulkan baris `admin_fee` dengan nominal dari pengaturan dapur (default Rp6.500, dapat diubah), memakai nomor referensi yang sama.
- **FR-F4.4** Posting menyimpan draf menjadi transaksi berstatus `posted` dan memberinya nomor urut. Posting ditolak jika periode terkunci.
- **FR-F4.5** Tidak ada posting otomatis tanpa konfirmasi pengguna.
- **KP:** transaksi dengan `(kitchen_id, reference_no, kind)` yang sama tidak dapat diposting dua kali.

### F5 — Buku kas per dapur
- **FR-F5.1** Tabel transaksi dengan kolom sama dengan Excel: NO, TANGGAL, NO. REFERENCE, DESKRIPSI, REKENING PENERIMA, BANK, DEBIT, KREDIT, TOTAL (saldo berjalan), KET, DOKUMENTASI NOTA. Kolom DOKUMENTASI NOTA dikosongkan (nota dikelola pengguna di luar sistem).
- **FR-F5.2** Konvensi: **DEBIT = uang masuk, KREDIT = uang keluar**, mengikuti file contoh. Saldo berjalan = saldo awal + Σ debit − Σ kredit, **dihitung oleh sistem**, bukan diketik.
- **FR-F5.3** Pencatatan dana masuk (misalnya `PENAMBAHAN DANA DARI BGN KE VA DAPUR`) dengan tanggal, nominal, dan referensi opsional.
- **FR-F5.4** Filter periode, pencarian deskripsi/referensi/penerima, urut tanggal lalu nomor urut.
- **FR-F5.5** Edit dan pembatalan (`void`) tersedia selama periode terbuka. Hapus permanen tidak ada. Perubahan tercatat di audit log.
- **KP:** saldo akhir sistem untuk data Maret 2026 hasil impor sama persis dengan sel `SISA UANG` di file contoh.

### F6 — Mutasi bank dan rekonsiliasi **(DITUNDA ke v2, tidak dibangun di MVP)**

> Spesifikasi di bawah dipertahankan sebagai acuan v2. Mutasi bank hanya diperlukan untuk fitur ini.
- **FR-F6.1** Unggah file mutasi (CSV, XLSX, atau PDF) per rekening dapur. Format per bank didaftarkan sebagai parser. [Perlu verifikasi: format ekspor tiap bank]
- **FR-F6.2** Pencocokan otomatis berdasarkan nomor referensi; cadangan: kombinasi tanggal ± 1 hari dan nominal.
- **FR-F6.3** Tiga daftar hasil: (a) ada di buku, tidak ada di bank; (b) ada di bank, belum dibukukan (termasuk dana masuk dan potongan kecil bank); (c) cocok referensi tetapi nominal berbeda.
- **FR-F6.4** Dari daftar (b), pengguna dapat membuat transaksi dengan satu klik.
- **FR-F6.5** Ringkasan per rekening: saldo buku, saldo bank per tanggal terakhir mutasi, selisih. Status `cocok` hanya jika selisih tepat nol dan tidak ada item tak tercocok.
- **KP:** satu baris mutasi hanya bisa tercocok dengan satu transaksi, dan sebaliknya.

### F7 — Ekspor Excel
- **FR-F7.1** Ekspor satu dapur satu periode ke `.xlsx` dengan tata letak sama seperti file contoh: tiga baris judul (yayasan, nama pembukuan dan PJ, periode), header kolom, baris data, baris `SISA UANG`, catatan biaya admin.
- **FR-F7.2** Saldo ditulis sebagai rumus berantai seperti aslinya **dan** nilai tersimpan agar terbaca di semua aplikasi.
- **FR-F7.3** Sel teks yang diawali `=`, `+`, `-`, `@` diperlakukan sebagai teks (lihat `SECURITY.md`, bagian formula injection).
- **KP:** file hasil ekspor dibuka di Excel tanpa peringatan perbaikan, dan angka sama dengan layar buku kas.

### F8 — Penutupan bulan
- **FR-F8.1** Maker dapat mengunci periode. Di MVP tidak ada syarat rekonsiliasi; sistem menampilkan peringatan bila masih ada draf yang belum diposting. (Syarat rekonsiliasi `cocok` ditambahkan di v2.)
- **FR-F8.2** Penutupan membuat saldo awal periode berikutnya otomatis (baris `PERPINDAHAN SALDO <BULAN>`).
- **FR-F8.3** Periode terkunci tidak dapat diubah lewat UI maupun API. Pembukaan kembali hanya oleh admin, dengan alasan, dan tercatat.
- **KP:** percobaan menulis transaksi ke periode terkunci ditolak di lapisan database, bukan hanya di UI.

### F9 — Jejak audit
- **FR-F9.1** Setiap pembuatan, perubahan, pembatalan, unggahan, ekspor, penutupan, dan perubahan peran tercatat: pelaku, waktu, entitas, nilai sebelum dan sesudah.
- **FR-F9.2** Audit log hanya dapat ditambah, tidak dapat diubah atau dihapus oleh peran aplikasi mana pun.

### F10 — Ringkasan per dapur
- **FR-F10.1** Dasbor menampilkan satu baris per dapur: saldo akhir periode berjalan (dari transaksi yang sudah diposting), jumlah draf menunggu review, waktu unggahan terakhir, dan status periode. Tidak ada saldo bank di MVP.
- **FR-F10.2** Tidak ada penjumlahan lintas dapur di layar, ekspor, maupun API.

---

## 7. Sketsa data model

Semua tabel domain memiliki `kitchen_id` (kecuali `organizations`, `profiles`). Uang disimpan sebagai **bigint rupiah**, tidak pernah float. Semua waktu disimpan UTC; tampilan WIB.

```
organizations(id, name)
profiles(user_id PK→auth.users, full_name)
kitchens(id, organization_id, name, code, pj_name, admin_fee_default bigint, status)
kitchen_members(kitchen_id, user_id, role[admin|maker|approver|viewer])   PK(kitchen_id,user_id)

bank_accounts(id, kitchen_id, bank_code, label, account_no_enc, account_no_last4, kind[operasional|va])
             UNIQUE(kitchen_id)      -- satu rekening per dapur [Dinyatakan]

periods(id, kitchen_id, year, month, opening_balance bigint,
        status[open|reconciled|locked], locked_at, locked_by)               UNIQUE(kitchen_id,year,month)

uploads(id, kitchen_id, kind[transfer_proof|statement|receipt],
        storage_path, original_name, mime, size_bytes, sha256,
        status[uploaded|parsed|needs_manual|failed|posted],
        parser_used, parse_result jsonb, uploaded_by, created_at)           UNIQUE(kitchen_id,sha256,kind)

categories(id, organization_id, name, parent_id)

counterparty_rules(id, organization_id, match_account_no_hash, description_template,
                   category_id, times_used, last_used_at)

transactions(id, kitchen_id, period_id, seq_no, tx_date,
             kind[opening|incoming|outgoing|admin_fee],
             reference_no, description,
             counterparty_account_no_enc, counterparty_account_last4, counterparty_name, counterparty_bank,
             debit bigint default 0, credit bigint default 0,
             note, category_id, source_upload_id,
             status[posted|reconciled|void],
             version int, created_by, created_at, updated_at)
             UNIQUE(kitchen_id, reference_no, kind) WHERE reference_no IS NOT NULL AND status <> 'void'
             CHECK (debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0))

transaction_receipts(transaction_id, upload_id)

-- [v2] statement_lines dan reconciliations tidak dibuat di MVP
statement_lines(id, kitchen_id, bank_account_id, upload_id, line_date, reference_no,
                description, debit bigint, credit bigint, balance_after bigint,
                matched_transaction_id, match_status[unmatched|matched|amount_mismatch|ignored])

reconciliations(id, kitchen_id, bank_account_id, period_id, as_of_date,
                book_balance bigint, bank_balance bigint, difference bigint,
                status[draft|cocok|selisih_dijelaskan], note, prepared_by, created_at)

audit_logs(id, kitchen_id, actor_id, action, entity, entity_id,
           before jsonb, after jsonb, created_at)      -- append-only
```

Catatan desain:
- `seq_no` (kolom NO di Excel) dihitung per `(kitchen_id, period_id)` dan tidak dipakai sebagai kunci.
- Saldo berjalan **tidak disimpan** sebagai kolom. Gunakan view atau window function, sehingga satu koreksi tidak merusak baris lain.
- `UNIQUE(kitchen_id, reference_no, kind)` memungkinkan transaksi induk dan `admin_fee` berbagi referensi yang sama.
- Nomor rekening penerima disimpan terenkripsi; aturan penerima memakai hash agar bisa dicocokkan tanpa menyimpan nomor mentah.

---

## 8. Edge case dan failure state

| # | Situasi | Perilaku yang diharapkan |
|---|---|---|
| E1 | PDF hasil pindai (tanpa teks) | Status `needs_manual`, pesan jelas, form manual terbuka. Tidak ada tebakan diam-diam. |
| E2 | PDF diproteksi kata sandi atau rusak | Ditolak dengan alasan spesifik; file tidak disimpan. |
| E3 | PDF bukan dari bank yang dikenal | `needs_manual`. Log jenis dokumen tanpa isi sensitif. |
| E4 | Bukti payroll massal (satu referensi, banyak penerima) | Disimpan sebagai satu transaksi total dengan penerima `Rekening Masing-Masing Relawan`, seperti pola di file contoh. Rincian penerima disimpan sebagai lampiran, bukan baris terpisah. |
| E5 | Referensi sama untuk transaksi dan admin fee | Diizinkan karena `kind` berbeda. Dua transaksi `outgoing` dengan referensi sama ditolak. |
| E6 | File yang sama diunggah dua kali | Ditolak berdasarkan SHA-256; pesan menunjuk transaksi yang sudah ada. |
| E7 | Bukti dari dapur lain terunggah ke dapur ini | Peringatan (FR-F3.4). Posting tetap membutuhkan konfirmasi eksplisit. |
| E8 | Tanggal catat berbeda dari tanggal transfer | Field `tx_date` dapat diedit. Contoh nyata di file: transaksi tanggal 2 Maret untuk belanja 28 Februari. Periode ditentukan oleh `tx_date`. |
| E9 | Periode sudah terkunci | Penulisan ditolak di database. UI menawarkan alur "buka kembali" hanya untuk admin. |
| E10 [v2] | Mutasi memuat baris yang tak ada di buku | Masuk daftar (b), tidak otomatis dibukukan. |
| E11 [v2] | Mutasi memuat nominal berbeda untuk referensi sama | Status `amount_mismatch`, tampil menonjol. Tidak diselesaikan otomatis. |
| E12 | Format bank berubah | Parser gagal aman: `needs_manual` plus alarm internal. Tidak menghasilkan angka sebagian. |
| E13 | Dua pengguna mengedit transaksi sama | Optimistic locking lewat kolom `version`; yang kedua mendapat konflik, bukan menimpa. |
| E14 | Koneksi putus saat unggah batch | Per file berstatus sendiri; unggah ulang melanjutkan, tidak menggandakan. |
| E15 | Fallback LLM mati/timeout | Fitur dinonaktifkan dengan elegan; alur manual tetap jalan. |
| E16 | Saldo berjalan negatif | Peringatan menonjol; tidak diblokir (dapat terjadi karena koreksi). |
| E17 | Zona waktu | Penyimpanan UTC, tampilan WIB (Asia/Jakarta). Tanggal transaksi bertipe `date`, bukan timestamp. |
| E18 | Pengguna kehilangan perangkat MFA | Pemulihan oleh admin dengan verifikasi, tercatat di audit. |
| E19 | Gambar buram, terpotong, atau gelap | Field tak terbaca dibiarkan kosong dan ditandai; berkas `needs_manual` bila field penting hilang. |
| E20 | Satu tangkapan layar memuat lebih dari satu bukti | Hanya satu transaksi diusulkan per berkas; sistem memperingatkan bila terdeteksi lebih dari satu. [Perlu diuji] |
| E21 | HEIC atau format gambar lain | Ditolak dengan pesan jelas: ubah ke JPG atau PNG. |
| E22 | Gambar mengandung metadata lokasi (EXIF) | Metadata dibuang sebelum disimpan dan sebelum dikirim ke penyedia AI. |
| E23 | AI salah membaca satu digit nominal | Mitigasi: gambar tampil berdampingan di layar review, nominal besar ditandai, pemeriksaan konsistensi (FR-F3.7). Risiko tidak dapat dihilangkan, hanya dikurangi. |
| E24 | Teks pada gambar/PDF berisi instruksi ("abaikan instruksi sebelumnya") | Diperlakukan sebagai data. Keluaran divalidasi skema dan tetap lewat review manusia (`SECURITY.md` S-14). |
| E25 | Penyedia AI tidak tersedia, kena batas, atau biaya harian tercapai | Berkas berstatus `needs_manual`; alur manual tetap berjalan. |

---

## 9. Success metrics

Semua target di bawah adalah **usulan awal**, bukan hasil pengukuran. Tetapkan baseline lewat pilot satu dapur.

| Metrik | Cara ukur | Target awal |
|---|---|---|
| Akurasi ekstraksi | Field benar tanpa koreksi / total field, **per bank dan per tipe berkas (PDF vs JPG)** | Usulan awal ≥ 95% untuk nominal dan referensi; baseline diukur saat pilot |
| Biaya ekstraksi AI per berkas | Tagihan penyedia / jumlah berkas | Dicatat saat pilot; batas harian per dapur; biaya ditanggung yayasan |
| Waktu penyusunan pembukuan satu dapur per bulan | Catatan waktu maker, sebelum vs sesudah | Turun ≥ 50% dari baseline |
| Baris yang butuh koreksi manual | Persentase draf yang diubah sebelum posting | < 20% setelah aturan penerima terisi |
| Selisih buku vs bank pada penutupan bulan **(v2)** | Rupiah, per dapur | 0, atau seluruhnya terjelaskan |
| Pencatatan ganda lolos | Jumlah | 0 |
| Kesesuaian dengan Excel manual | Saldo akhir pilot vs Excel maker | Sama persis |
| Adopsi | Persentase bulan di mana maker menutup periode lewat sistem | Pilot satu dapur 1 bulan, lalu 5 dapur |
| Kepuasan maker | Wawancara 15 menit setelah pilot | Subjektif, dicatat kualitatif |

**Uji penerimaan pilot:** impor ulang data Maret 2026 dapur Plombokan (dengan data diganti/di-anonimkan untuk demo). Hasil sistem dibandingkan baris demi baris dengan Excel sumber.

---

## 10. Keputusan dan pertanyaan terbuka (status 23 Oktober 2026)

| # | Pertanyaan | Mengapa penting | Pemilik |
|---|---|---|---|
| Q1 | **Terjawab:** yayasan mengizinkan pengembangan dan penggunaan sistem [Dinyatakan]. Tindak lanjut: catat izin itu tertulis di `docs/CONSENT.md` dengan cakupan yang menyebut pembacaan bukti transfer oleh penyedia AI pihak ketiga | Dasar penggunaan data nyata | Ricky, yayasan |
| Q2 | **Direvisi:** daftar bank tidak diperlukan, pembacaan memakai AI. Yang dibutuhkan: contoh bukti transfer nyata yang disamarkan (PDF dan JPG) dari tiap bank yang dipakai, untuk mengukur akurasi. Mutasi bank baru dibutuhkan di v2 | Mengukur akurasi ekstraksi | Teman Ricky |
| Q3 | **Terjawab:** satu rekening satu dapur [Dinyatakan] | Struktur `bank_accounts`, penentuan dapur otomatis | - |
| Q4 | **Terjawab:** pelaporan hanya dari Excel [Dinyatakan]. Terbuka: templat Excel kosong untuk menyamakan format | Kriteria penerimaan ekspor | Teman Ricky |
| Q5 | **Terjawab:** untuk saat ini hanya maker yang memakai sistem; kebutuhan = pembukuan otomatis [Dinyatakan]. Pemeriksa ke v2 | Cakupan MVP | - |
| Q6 | **Terjawab:** nota dikelola pengguna di luar sistem, berupa PDF/JPG [Dinyatakan]. Di luar scope | Cakupan MVP | - |
| Q7 | **Terjawab sebagian:** DONE = transaksi selesai, ON PROGRESS = masih proses [Dinyatakan]. Pada berkas contoh, legenda ada tetapi tidak terlihat dipakai lewat warna isian pada baris data (warna huruf belum diperiksa). Ditunda ke v2 | Model status | Teman Ricky |
| Q8 | **Terjawab:** yayasan menjadi pemilik setelah pembayaran penuh; hosting ditanggung yayasan [Dinyatakan]. Terbuka: perjanjian tertulis dan akun infrastruktur atas nama yayasan (lihat `TECH-STACK.md` bagian 11) | Kontrak, serah terima, tanggung jawab | Ricky, yayasan |
| Q9 | **Terjawab:** tergantung yayasan, tidak dipikirkan sekarang [Dinyatakan]. Syarat desain: yayasan dapat mengekspor dan menghapus data | Retensi | Yayasan |
| Q10 | **Belum diketahui.** Keputusan sementara: satu peran pengguna (maker) ditambah jejak audit; alur persetujuan ditunda ke v2. Ricky tidak memerlukan akses ke data produksi | Desain peran | Yayasan |
| Q11 | Templat Excel kosong dari teman (struktur sama, data dikosongkan) | Ekspor berformat identik | Teman Ricky |
| Q12 | Apa ketentuan retensi dan pemakaian data oleh penyedia AI yang dipakai, dan apakah ada opsi nol-retensi? [Perlu verifikasi pada dokumentasi resmi penyedia] | Isi persetujuan yayasan | Ricky |
| Q13 | Berapa perkiraan jumlah berkas per bulan untuk lima dapur, untuk memperkirakan biaya AI? | Anggaran hosting yayasan | Teman Ricky |

---

## Lampiran A — Pemetaan kolom Excel ke field

| Kolom Excel | Field | Catatan |
|---|---|---|
| NO | `transactions.seq_no` | Dihitung sistem |
| TANGGAL | `tx_date` | |
| NO. REFERENCE | `reference_no` | Kosong untuk dana masuk |
| DESKRIPSI | `description` | Diusulkan dari aturan penerima, diedit pengguna |
| REKENING PENERIMA | `counterparty_account_no_enc` + `counterparty_name` | Format tampilan `nomor a.n Nama` |
| BANK | `counterparty_bank` | |
| DEBIT | `debit` | Uang masuk |
| KREDIT | `credit` | Uang keluar |
| TOTAL | dihitung | Saldo berjalan |
| KET | `note` | |
| DOKUMENTASI NOTA | dikosongkan | Nota dikelola pengguna di luar sistem |

## Lampiran B — Cakupan demo

Demo untuk teman Ricky memakai **data sintetis** yang meniru pola file Plombokan (jumlah baris, jenis penerima, dana masuk, biaya admin) tanpa nomor rekening, nama, atau nominal nyata. Cakupan demo: F1 (tanpa MFA penuh), F2, F3 (dengan bukti transfer sintetis berbentuk PDF dan gambar), F4, F5, F7, F8, F10. Rekonsiliasi tidak didemokan. Tujuan demo: memvalidasi alur unggah → review → buku kas → Excel dan menjawab Q7, Q11, Q13.

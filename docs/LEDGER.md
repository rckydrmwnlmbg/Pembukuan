# LEDGER — Invarian dan Konvensi Buku Kas Kasdapur

| | |
|---|---|
| Versi | 0.2 |
| Tanggal | 25 Oktober 2026 |
| Acuan | `AGENTS.md` §2 & §7, `PRD.md` F5 & F7, `SKILLS.md` §2 (`ledger-integrity`) & §4 (`plombokan-excel-export`), `OPEN-ISSUES.md` `OI-04` & `OI-05` |

---

## 1. Tujuh Invarian Wajib Buku Kas

1. **Nominal bilangan bulat (`bigint`):**
   - Seluruh nilai Rupiah disimpan sebagai `bigint` di PostgreSQL dan dihitung dengan `bigint` di TypeScript.
   - Dilarang menggunakan `float`, `double`, atau `Number` untuk mem-parse atau menghitung nominal.
   - Satu baris transaksi wajib memenuhi `debit >= 0 AND credit >= 0 AND NOT (debit > 0 AND credit > 0)`.
2. **Konvensi kolom mengikuti berkas sumber Plombokan:**
   - **DEBIT = uang masuk** (`kind = 'incoming'`, misalnya dana masuk dari BGN ke VA dapur).
   - **KREDIT = uang keluar** (`kind = 'outgoing'` dan `kind = 'admin_fee'`).
3. **Saldo berjalan dihitung sistem, tidak pernah disimpan sebagai kolom:**
   - Di database: dihitung oleh view `public.v_period_ledger` (window function `SUM(debit - credit) OVER (PARTITION BY kitchen_id, period_id ORDER BY tx_date, seq_no, id)`) dan `public.v_period_summary`.
   - Di aplikasi: dihitung oleh fungsi murni `computePeriodLedger` di `src/lib/ledger-math.ts`.
   - Persamaan periode: `Saldo akhir = Saldo awal + Σ debit (posted) − Σ credit (posted)`.
4. **Representasi saldo awal (`OI-04`):**
   - Nilai kanonik saldo awal disimpan di `periods.opening_balance`.
   - Pada tabel Buku Kas (UI) dan berkas ekspor Excel (`.xlsx`), `periods.opening_balance` dirender sebagai baris pertama (`NO = 1`) dengan deskripsi `PERPINDAHAN SALDO <BULAN SEBELUMNYA>`, nominal di kolom `DEBIT` (`G6`), dan rumus `TOTAL` (`I6 = G6`). Transaksi aktual dimulai dari `NO = 2` (`baris 7`).
5. **Pasangan biaya admin bank (`admin_fee`) atomik (`OI-05`):**
   - Biaya admin bank dibuat sebagai baris `admin_fee` terpisah dalam satu operasi atomik bersama transaksi induk (`outgoing`), memakai `reference_no` yang sama dan menautkan `parent_transaction_id`.
   - Kunci keunikan parsial di database: `UNIQUE (kitchen_id, reference_no, kind) WHERE reference_no IS NOT NULL AND status <> 'void'`.
   - Membatalkan (`void`) atau mengubah tanggal/nomor referensi transaksi induk secara otomatis memperbarui/me-`void` baris `admin_fee` pasangannya.
6. **Penguncian optimistik & larangan hapus permanen:**
   - Perubahan transaksi memeriksa kolom `version` (`version = expected_version`, lalu `version = version + 1`). Konflik versi mengembalikan HTTP `409 Conflict`.
   - Tidak ada operasi `DELETE` pada transaksi. Pembatalan menggunakan `status = 'void'`, baris tetap tampil dicoret ringan di UI dengan saldo berjalan tidak berubah pada baris tersebut, dan perubahan tercatat di `audit_logs`.
7. **Periode terkunci ditolak di database:**
   - Trigger `trg_transactions_period_lock` menolak `INSERT`, `UPDATE`, dan `DELETE` pada tabel `transactions` bila `periods.status = 'locked'` dengan kode galat `P0001`.

# Catatan Desain UI — Kasdapur

## Milestone M2: Halaman Buku Kas per Dapur (`/k/[kitchenId]/ledger`)

### 1. Token Desain yang Dipakai (`DESIGN.md` Bagian 3)
- **Latar & Permukaan:** `--canvas` (`#F4F6F8`), `--surface` (`#FFFFFF`), `--surface-muted` (`#F8FAFB`)
- **Garis Batas:** `--line` (`#DDE2E8`, 1px solid), `--line-strong` (`#C3CBD4`, 1px solid untuk baris `SISA UANG` dan kontrol sekunder)
- **Teks:** `--ink` (`#1B2430`), `--ink-muted` (`#566272`), `--ink-subtle` (`#7A8695`), `--ink-on-accent` (`#FFFFFF`)
- **Aksen Tunggal:** `--accent` (`#0B4F6C`), `--accent-hover` (`#093F57`), `--accent-subtle` (`#E7F0F4`), `--focus-ring` (`#0B4F6C`)
- **Status:** `--ok`/`--ok-subtle`, `--warn`/`--warn-subtle`, `--danger`/`--danger-subtle`
- **Tipografi:** `IBM Plex Sans` (400, 500, 600); `tabular-nums` wajib pada semua angka, tanggal, dan nomor referensi.
- **Ukuran & Radius:** Bilah atas `56px`, sidebar `240px`, tinggi header tabel `40px`, tinggi baris tabel `44px`, toolbar tabel `48px`, radius badge `4px`, radius kontrol `6px`, radius panel/tabel `8px`, panel samping edit `480px`.

### 2. Sketsa Tata Letak ASCII (`DESIGN.md` Bagian 4, 5.3, 8.1, 8.4)
```text
┌──────────────┬──────────────────────────────────────────────────────────────────────────┐
│ Kasdapur     │ [Dapur: Dapur Sintetis Cempaka ▾]              [Data contoh] [Maker ▾]   │ 56px
│              ├──────────────────────────────────────────────────────────────────────────┤
│ Ringkasan    │ Buku kas — Dapur Sintetis Cempaka      [Catat transaksi] [Ekspor Excel]  │
│ Buku kas  ◂  │ Periode Maret 2026 · Rekening BNI ****1001                               │
│ Unggahan     │                                                                          │
│ Riwayat      │ ┌ Strip persamaan saldo periode (ringkas, 56px) ───────────────────────┐ │
│ Pengaturan   │ │ Awal Rp 115.000.000 + Masuk Rp 300.000.000 − Keluar ... = Akhir ...  │ │
│              │ └──────────────────────────────────────────────────────────────────────┘ │
│              │ ┌ Toolbar 48px: [Cari deskripsi/referensi...] [Maret 2026 ▾] 111 baris ┐ │
│              │ ├────┬───────────┬──────────────┬─────────────────┬───────────┬────────┤ │
│              │ │ NO │ TANGGAL   │ NO. REFERENCE│ DESKRIPSI       │ DEBIT     │ KREDIT │ │ 40px
│              │ ├────┼───────────┼──────────────┼─────────────────┼───────────┼────────┤ │
│              │ │ 1  │ 01 Mar 26 │ —            │ PERPINDAHAN...  │ 115.000.. │        │ │ 44px
│              │ │ 2  │ 02 Mar 26 │ 20260302...  │ Pembelian...    │           │ 2.430..│ │ 44px
│              │ ├────┴───────────┴──────────────┴─────────────────┼───────────┴────────┤ │
│              │ │ SISA UANG                                       │     Rp 190.724.000 │ │ 44px
│              │ └─────────────────────────────────────────────────┴────────────────────┘ │
└──────────────┴──────────────────────────────────────────────────────────────────────────┘
```

### 3. Pemeriksaan terhadap Daftar Larangan (`DESIGN.md` Bagian 2)
Rencana ini telah diperiksa terhadap seluruh larangan di `DESIGN.md` bagian 2.1 dan 2.2: tidak ada gradien, glassmorphism/`backdrop-blur`, kartu KPI bulat berseri, bayangan pada panel/tabel (hanya batas `1px --line`, bayangan hanya dipakai pada panel samping edit `480px` dan menu pop-up), tidak ada emoji, tidak ada teks kapital semua pada label UI (kolom tabel menyajikan nama kolom buku kas sumber sesuai `PRD.md` FR-F5.1), tidak ada warna merah-hijau untuk membedakan debit dan kredit (dibedakan lewat posisi kolom `DEBIT` dan `KREDIT`), serta tidak ada baris total gabungan lintas dapur. Elemen khas yang langsung membedakan halaman ini dari tabel generik adalah **strip persamaan saldo periode** (`Saldo awal + Dana masuk − Dana keluar = Saldo akhir`), baris pertama `PERPINDAHAN SALDO`, dan baris penutup `SISA UANG` yang mencerminkan lembar kerja Excel maker.

# Catatan Desain UI — Kasdapur

## Milestone M5: Sistem Desain Lengkap, Homepage, Login (+MFA), Dasbor, & Layar Inti

### 1. Token Desain yang Dipakai (`DESIGN.md` Bagian 3)
- **Netral & Permukaan:**
  - Latar Kanvas: `--canvas` (`#F4F6F8`, abu dingin tenang)
  - Permukaan Konten: `--surface` (`#FFFFFF`)
  - Permukaan Sekunder: `--surface-muted` (`#F8FAFB`)
  - Batas Utama 1px: `--line` (`#DDE2E8`)
  - Batas Tegas: `--line-strong` (`#C3CBD4`)
- **Tipografi & Tinta:**
  - Font: `IBM Plex Sans` (400, 500, 600) via `next/font/google` dengan fallback `system-ui, sans-serif`.
  - Teks Utama: `--ink` (`#1B2430`, biru-abu pekat, bukan hitam pekat)
  - Teks Sekunder: `--ink-muted` (`#566272`)
  - Teks Keterangan: `--ink-subtle` (`#7A8695`)
  - Teks di Atas Aksen: `--ink-on-accent` (`#FFFFFF`)
  - `tabular-nums` pada seluruh angka keuangan, saldo, tanggal, dan nomor referensi.
- **Aksen Tunggal (Petrol):**
  - Utama: `--accent` (`#0B4F6C`, Petrol solid)
  - Hover: `--accent-hover` (`#093F57`)
  - Aktif: `--accent-press` (`#07324A`)
  - Aksen Halus: `--accent-subtle` (`#E7F0F4`)
  - Garis Aksen: `--accent-line` (`#B9D3DE`)
  - Fokus: `--focus-ring` (`#0B4F6C`, 2px solid dengan offset 2px)
- **Status (Bukan Dekorasi, Hanya Arti):**
  - Cocok/Ok: `--ok` (`#1E7B4F`), `--ok-subtle` (`#E8F4EE`)
  - Perhatian: `--warn` (`#8A5300`), `--warn-subtle` (`#FBF1DE`)
  - Bahaya/Galat: `--danger` (`#B3261E`), `--danger-subtle` (`#FBECEA`)
- **Bentuk & Batas:**
  - Radius Badge: `4px`
  - Radius Kontrol: `6px`
  - Radius Panel/Tabel: `8px`
  - Radius Dialog: `12px`
  - Bayangan HANYA untuk elemen melayang (dialog, dropdown, toast): `0 8px 24px rgba(27,36,48,0.10), 0 0 0 1px var(--line)`.
  - Panel, tabel, dan kartu TIDAK memakai bayangan (hanya batas 1px solid).

---

### 2. Sketsa Tata Letak ASCII Tiap Layar

#### A. Halaman Depan (Homepage — `DESIGN.md` Bagian 6)
```text
┌────────────────────────────────────────────────────────────────────────┐
│ Kasdapur                     Cara kerja   Keamanan   Tanya jawab  [Masuk] 64px
├────────────────────────────────────────────────────────────────────────┤
│ (Hero 1440/1024)                                                       │
│ Dari bukti transfer ke buku kas Excel,        ┌──────────────────────┐ │
│ tanpa mengetik ulang.                         │ [Data contoh]        │ │
│                                               │ Persamaan Saldo:     │ │
│ Unggah bukti transfer (PDF atau JPG), periksa │ 115 jt + 300 jt ...  │ │
│ hasil bacaannya, lalu unduh buku kas dalam    │ Tabel Buku Kas:      │ │
│ format Excel yang sama seperti biasa. Setiap  │ NO | TGL | DESK...   │ │
│ dapur punya buku dan saldonya sendiri.        │ 1  | 01  | PERPIN... │ │
│                                               │ 2  | 02  | Belanja.. │ │
│ [Masuk]  [Lihat cara kerja]                   │ (terpotong ke bawah) │ │
│                                               └──────────────────────┘ │
│ Tanpa kata sandi bank. Sistem hanya menerima file yang Anda unggah.    │
├────────────────────────────────────────────────────────────────────────┤
│ Cara kerja: 1 Unggah bukti transfer → 2 Periksa dan simpan → 3 Unduh   │
├────────────────────────────────────────────────────────────────────────┤
│ Saldo tiap dapur dijaga terpisah (Strip persamaan hidup + penjelasan)  │
├────────────────────────────────────────────────────────────────────────┤
│ Keamanan: Fakta terimplementasi (MFA, RLS, AES-256-GCM, AI transparan) │
├────────────────────────────────────────────────────────────────────────┤
│ Tanya jawab: 5 pertanyaan konkret maker & pengurus yayasan             │
├────────────────────────────────────────────────────────────────────────┤
│ Footer ringkas                                                         │
└────────────────────────────────────────────────────────────────────────┘
```

#### B. Halaman Login & MFA (`DESIGN.md` Bagian 7)
```text
┌─────────────────────────────┬──────────────────────────────────────────┐
│                             │ (Kolom Kanan: Petrol Solid #0B4F6C)      │
│ Kasdapur                    │                                          │
│                             │ "Setiap dapur punya buku dan saldonya    │
│ Masuk ke Kasdapur           │  sendiri."                               │
│ Masukkan akun Anda          │                                          │
│                             │ ┌ Strip Persamaan (Komponen Nyata) ────┐ │
│ Email                       │ │ Saldo awal + Masuk − Keluar = Akhir  │ │
│ [_________________________] │ │ Rp 115.000.000 + Rp 300.000.000 ...  │ │
│ Kata sandi                  │ └──────────────────────────────────────┘ │
│ [_______________________] 👁│                                          │
│                             │ [Data contoh]                            │
│ [         Masuk          ]  │                                          │
│                             │                                          │
│ Akses hanya dengan          │                                          │
│ undangan admin.             │                                          │
└─────────────────────────────┴──────────────────────────────────────────┘
Langkah MFA:
Ganti form menjadi: 6 kotak digit [ _ ][ _ ][ _ ][ _ ][ _ ][ _ ] (44x52),
fokus otomatis, paste didukung, tombol "Verifikasi Kode".
Di layar < 1024px: kolom kanan disembunyikan; form di tengah (maks 360px).
```

#### C. Dasbor Ringkasan (`DESIGN.md` Bagian 8.2 & PRD F10)
```text
┌────────────────────────────────────────────────────────────────────────┐
│ Ringkasan                             [Periode: Maret 2026] [Unggah]   │
│ Saldo tiap dapur dihitung terpisah.                                    │
│                                                                        │
│ ┌ Perlu tindakan ────────────────────────────────────────────────────┐ │
│ │ Dapur Sintetis Kenanga     3 draf menunggu review            Buka  │ │
│ │ Dapur Sintetis Melati      1 berkas perlu input manual       Buka  │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│ ┌ Dapur (Klik baris membuka buku kas) ───────────────────────────────┐ │
│ │ Dapur             Saldo akhir   Menunggu review  Terakhir  Periode │ │
│ │ Dapur Cempaka     Rp 190.724.000  0              28 Mar    Terbuka │ │
│ │ Dapur Kenanga     Rp 184.210.000  3 (amber badge) 28 Mar   Terbuka │ │
│ │ Dapur Anggrek     Rp 220.150.000  0              28 Mar   Terkunci │ │
│ └────────────────────────────────────────────────────────────────────┘ │
│ (Tanpa baris total gabungan. Tanpa grafik gabungan. Tanpa saldo bank.) │
└────────────────────────────────────────────────────────────────────────┘
```

#### D. Komponen Dasar di `/dev/ui`
Halaman uji interaktif terlindung untuk memverifikasi seluruh komponen UI:
- `Button` (Primary, Secondary, Ghost, Danger, Loading)
- `Input` & Field Nominal Rupiah (format tabular otomatis, prefix Rp)
- `Select` (Dapur, Periode)
- `Badge` (Ok/Cocok, Warn/Menunggu, Danger/Selisih, Netral/Draf, Terkunci)
- `Table` (Header sticky, baris tabular, kolom NO sticky)
- `Dialog` (Trap focus, backdrop, Esc close)
- `Toast` (Notifikasi pojok kanan bawah, auto-dismiss 4 detik)
- `Tabs` (Tab horizontal, active state)
- `Skeleton` (Shimmer bentuk nyata komponen)
- `EmptyState` (Pesan aksi konkret, tanpa ilustrasi kartun)

---

### 3. Kondisi yang Dirancang (Edge Cases & State)
1. **Normal:** Data tampil penuh dengan tabular figures, hierarki teks jelas, baris pertama `PERPINDAHAN SALDO`, penutup `SISA UANG`.
2. **Kosong:** Arahkan maker ke tindakan konkret: "Belum ada transaksi di Maret 2026. Unggah bukti transfer pertama." disertai tombol utama "Unggah bukti transfer". Tanpa ilustrasi.
3. **Memuat (Loading):** Skeleton sesuai bentuk komponen nyata (bukan spinner melayang di tengah layar). Spinner mini hanya di dalam tombol aksi saat permintaan diproses.
4. **Galat (Error):** Penjelasan apa yang terjadi dan tindakan pemulihan: "Gagal memuat buku kas. Periksa koneksi Anda dan coba lagi."
5. **Draf Tertunda:** Jika `draftCount > 0`, banner amber di bawah strip persamaan: "N draf belum dihitung. [Tinjau]". Saldo akhir tetap HANYA menghitung transaksi yang sudah diposting.
6. **Responsif (1440, 1024, 390):**
   - **≥ 1280px:** Sidebar penuh 240px, layout 2 kolom di review (50% berkas, 50% form).
   - **1024px:** Sidebar ciut 64px, kolom kanan login tetap tampil (solid Petrol).
   - **390px (Ponsel):** Sidebar menjadi menu drawer; tabel buku kas menjadi daftar baris bertumpuk rapi; layar review terbagi menjadi 2 tab ("Bukti" dan "Form Hasil").

---

### 4. Pemeriksaan terhadap Daftar Larangan (`DESIGN.md` Bagian 2)
Rencana ini telah diperiksa secara menyeluruh terhadap setiap larangan di `DESIGN.md` bagian 2:
- **Pola Visual:** TIDAK ADA gradien ungu/indigo/biru, tidak ada teks bergradien, tidak ada `backdrop-blur`/glassmorphism, tidak ada blob/orb di latar, tidak ada kartu SaaS seragam dengan bayangan lembut, tidak ada radius seragam 16–24px, tidak ada bayangan pada panel atau tabel, tidak ada ikon di dalam lingkaran berwarna, tidak ada emoji sebagai ikon, tidak ada palet krem/terakota, tidak ada ilustrasi 3D/kartun/foto stok, dan tidak ada animasi fade-and-slide berlebih.
- **Pola Tipografi & Salinan:** TIDAK ADA label ALL-CAPS ber-tracking (eyebrow), tidak ada penyorotan satu kata miring/warna di judul, tidak ada rantai titik tengah (`A · B · C`), tidak ada tanda panah `→` di tombol, tidak ada frasa pemasaran kosong ("revolusioner", "mulus"), tidak ada testimoni atau logo klien palsu, dan tidak ada data nama fiktif umum seperti `John Doe` (seluruh data sintetis meniru pola riil dapur sosial).
- **Integritas Keuangan:** TIDAK ADA baris total atau grafik gabungan lintas dapur (Aturan Emas #1). Kolom kanan halaman login menggunakan warna Petrol solid `#0B4F6C` dengan komponen `PeriodEquation` asli berdata contoh, bukan gambar mock-up.
- **Lepas Satu Aksesori:** Setiap elemen yang murni dekoratif telah dibuang agar antarmuka fokus 100% pada keterbacaan angka, ketepatan data, dan kecepatan maker dalam membukukan transaksi.

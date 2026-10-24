# DESIGN — Sistem Desain Kasdapur (nama kerja)

| | |
|---|---|
| Versi | 0.2 |
| Tanggal | 23 Oktober 2026 |
| Berlaku untuk | Halaman depan (homepage), login, dasbor, dan seluruh layar aplikasi |
| Dokumen terkait | `PRD.md`, `AGENTS.md`, `SKILLS.md` |

**Status keyakinan.** Dokumen ini menetapkan arah dan angka yang bisa langsung diterapkan. Saya tidak dapat membuka Dribbble atau situs lain dari sini, jadi dokumen ini **tidak meniru shot tertentu**. Ia merumuskan prinsip yang membedakan antarmuka keuangan kelas enterprise dari antarmuka hasil generator. Arah rasa: dasbor produk keuangan dan alat kerja padat data yang matang (kandidat acuan untuk dilihat manusia: Stripe Dashboard, Linear, Mercury). Tampilan terkini produk-produk itu belum saya verifikasi. Penilaian akhir tetap lewat tangkapan layar (lihat bagian 13).

---

## 1. Posisi desain

**Subjek:** alat pembukuan untuk maker keuangan yang mengurus beberapa dapur. Pekerjaannya berulang, teliti, dan menyangkut uang. **Tugas utama antarmuka:** membuat orang cepat memeriksa angka dan yakin bahwa angka itu benar.

**Konsekuensi desain:**
- Kepadatan informasi tinggi tetapi tenang. Pengguna menatap tabel berjam-jam.
- Angka adalah konten utama. Tipografi angka (lurus, rata kanan, lebar tetap) lebih penting daripada hiasan.
- Kepercayaan datang dari ketelitian (keselarasan, konsistensi, bahasa yang jelas), bukan dari efek visual.

**Satu hal yang dibuat tak terlupakan:** **strip persamaan saldo periode** (bagian 8.1): `Saldo awal + Dana masuk − Dana keluar = Saldo akhir`. Itu cermin dari baris `SISA UANG` di Excel yang selama ini dihitung manual, dan angka yang paling dipercaya maker. Semua elemen lain sengaja tenang agar strip itu menonjol. (Di v2, strip rekonsiliasi `Saldo buku − Saldo bank = Selisih` ditambahkan di bawahnya.)

---

## 2. Larangan keras (anti AI slop)

Agent **dilarang** menghasilkan hal-hal berikut. Pelanggaran dianggap cacat, bukan selera.

### 2.1 Pola visual
| Dilarang | Kenapa |
|---|---|
| Gradien ungu/indigo/biru-ke-ungu, gradien sebagai latar kartu atau tombol | Tanda paling umum desain generik |
| Teks bergradien | Idem |
| Glassmorphism, `backdrop-blur` sebagai gaya, blob/orb buram di latar | Dekorasi tanpa fungsi |
| Setiap konten dipotong menjadi kartu bulat identik dengan bayangan lembut yang sama | "SaaS-card kit": hierarki hilang |
| Satu `border-radius` besar (16–24px) di semua elemen | Hierarki bentuk hilang |
| Bayangan di setiap kartu | Gunakan batas 1px; bayangan hanya untuk elemen melayang |
| Ikon dalam lingkaran/kotak berwarna di atas setiap judul fitur | Template |
| Emoji sebagai ikon atau penghias | Tidak profesional untuk keuangan |
| Latar krem (sekitar `#F4F1EA`) dengan serif tinggi-kontras dan aksen terakota | Kecenderungan umum keluaran AI |
| Latar hitam pekat dengan satu aksen hijau neon/vermilion | Idem |
| Tata letak koran dengan garis rambut dan radius nol | Idem, dan tidak cocok untuk alat kerja |
| Ilustrasi 3D, orang kartun, foto stok, dompet/koin/grafik naik | Klise fintech |
| Animasi masuk fade-and-slide-up di tiap seksi; hover mengangkat di tiap kartu | Gerak yang tidak melayani tugas |

### 2.2 Pola tipografi dan salinan
| Dilarang | Kenapa |
|---|---|
| Label ALL-CAPS ber-tracking di atas setiap judul (eyebrow) | Tanda template |
| Menyorot satu kata dalam judul dengan warna/miring | Tanda template |
| Rangkaian meta dengan titik tengah (`A · B · C`) dan label berformat `KATA — fragmen` | Tanda template |
| Menambahkan `→` di akhir tombol atau tautan | Tanda template |
| Penomoran `01 / 02 / 03` pada konten yang **bukan urutan** | Struktur harus menyandi informasi. Alur unggah → review → cocokkan memang urutan, jadi boleh bernomor |
| Font monospace untuk label kecil sebagai gaya | Hanya angka dan referensi, dan tetap memakai angka tabular dari font UI (lihat 4.2) |
| Frasa pemasaran kosong: "revolusioner", "mulus", "di era digital", "dukungan AI generasi baru" | Tidak spesifik |
| Testimoni, logo klien, angka statistik karangan | Tidak ada di produk ini. Dilarang memalsukan bukti sosial |
| Teks isian `Lorem ipsum`, nama `John Doe`, `PT Contoh Maju Jaya` | Data contoh harus meniru pola nyata (lihat 11) |

---

## 3. Token

### 3.1 Warna

Palet inti (6 nilai bernama):

| Nama | Hex | Peran |
|---|---|---|
| Kanvas | `#F4F6F8` | Latar halaman aplikasi (abu dingin, bukan krem) |
| Permukaan | `#FFFFFF` | Panel, tabel, form |
| Tinta | `#1B2430` | Teks utama (biru-abu tua, bukan hitam murni) |
| Garis | `#DDE2E8` | Batas 1px |
| Petrol | `#0B4F6C` | Aksen tunggal: tombol utama, tautan, fokus, item aktif |
| Penanda status | lihat di bawah | Hanya untuk makna status |

Token lengkap (tema terang):

```css
:root {
  /* Netral */
  --canvas:        #F4F6F8;
  --surface:       #FFFFFF;
  --surface-muted: #F8FAFB;
  --line:          #DDE2E8;
  --line-strong:   #C3CBD4;

  /* Teks */
  --ink:           #1B2430;
  --ink-muted:     #566272;
  --ink-subtle:    #7A8695;
  --ink-on-accent: #FFFFFF;

  /* Aksen tunggal */
  --accent:        #0B4F6C;
  --accent-hover:  #093F57;
  --accent-press:  #07324A;
  --accent-subtle: #E7F0F4;
  --accent-line:   #B9D3DE;

  /* Status (makna, bukan dekorasi) */
  --ok:            #1E7B4F;
  --ok-subtle:     #E8F4EE;
  --warn:          #8A5300;
  --warn-subtle:   #FBF1DE;
  --danger:        #B3261E;
  --danger-subtle: #FBECEA;

  /* Fokus */
  --focus-ring:    #0B4F6C;
}
```

Aturan warna:
- **Aksen hanya satu (Petrol).** Hijau/amber/merah hanya untuk status (cocok / perlu perhatian / selisih atau galat). Dilarang memakainya untuk dekorasi.
- Debit (uang masuk) dan kredit (uang keluar) **dibedakan oleh kolom dan tanda, bukan oleh warna** merah-hijau. Warna tidak boleh menjadi satu-satunya penanda (aksesibilitas).
- Kontras teks minimum WCAG AA (4,5:1 untuk teks normal). **Verifikasi semua pasangan token dengan alat pemeriksa kontras**; angka di atas dipilih dengan perkiraan, belum diukur.
- Tema gelap: **ditunda (v2)**. Token diberi nama semantik agar pembuatannya nanti hanya mengganti nilai.

### 3.2 Tipografi

**Satu keluarga:** **IBM Plex Sans** (400, 500, 600). Dipasang lewat `next/font/google` agar di-host sendiri (selaras dengan CSP `font-src 'self'`). Cadangan: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.

| Peran | Ukuran / tinggi baris | Bobot | Catatan |
|---|---|---|---|
| Tampilan (hanya homepage) | 44 / 52 | 600 | tracking −0,02em |
| H1 halaman | 24 / 32 | 600 | tracking −0,01em |
| H2 seksi | 18 / 26 | 600 | |
| H3 | 15 / 22 | 600 | |
| Isi | 14 / 22 | 400 | |
| Isi tabel | 13 / 20 | 400 | |
| Label form | 13 / 18 | 500 | kalimat biasa, bukan kapital |
| Keterangan | 12 / 16 | 400 | warna `--ink-muted` |
| Angka besar (strip persamaan) | 28 / 36 | 500 | tabular |

Aturan:
- **Angka selalu tabular:** `font-variant-numeric: tabular-nums;` pada semua sel angka, saldo, tanggal, dan nomor referensi. Verifikasi dengan mata: digit pada baris berurutan harus tegak lurus.
- Panjang baris teks bacaan ≤ 72 karakter.
- Judul homepage rata kiri. **Tidak ada pusat-semua.**
- Tanpa kapital semua. Tanpa kata tunggal yang disorot.
- Pemformatan Indonesia: `Rp 1.234.567` (pemisah ribuan titik), tanpa desimal untuk rupiah. Tanggal `02 Mar 2026` memakai `Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })` **[perlu verifikasi hasil singkatan bulan di lingkungan target]**. Zona waktu `Asia/Jakarta`.

### 3.3 Spasi dan ukuran

Basis **4px**. Skala: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`.

| Elemen | Ukuran |
|---|---|
| Sidebar | 240px; ciut 64px (≤ 1024px) |
| Bilah atas | 56px |
| Padding konten | 32px (≥ 1024), 24px (≥ 768), 16px (< 768) |
| Lebar konten maks | 1280px, rata kiri di area konten |
| Grid | 12 kolom, jarak antarkolom 24px |
| Tinggi kontrol form | 36px (default), 32px (padat), 40px (halaman login) |
| Tinggi baris tabel | 44px (default), 36px (padat) |
| Tinggi header tabel | 40px |
| Padding sel | 0 12px |
| Jarak antarseksi halaman | 32px |
| Jarak label–kontrol | 6px |
| Jarak antarfield form | 20px |
| Target sentuh minimal | 40×40px |

### 3.4 Bentuk, batas, bayangan

| Elemen | Radius |
|---|---|
| Badge/status | 4px |
| Kontrol (input, tombol, select) | 6px |
| Panel, tabel, strip persamaan | 8px |
| Dialog | 12px |

- **Batas 1px `--line` adalah alat pemisah utama.** Panel tidak memakai bayangan.
- Satu-satunya bayangan: elemen melayang (popover, dropdown, dialog): `0 8px 24px rgba(27,36,48,0.10), 0 0 0 1px var(--line)`.
- Fokus: cincin 2px `--focus-ring` dengan offset 2px, selalu terlihat saat navigasi papan ketik.

### 3.5 Ikon
Satu set saja (Lucide atau Phosphor), garis 1,5px, ukuran 16px (tabel, tombol), 20px (navigasi). Warna mengikuti teks. Tanpa kotak atau lingkaran berwarna di belakang ikon.

### 3.6 Gerak
- Durasi 120–180ms, easing `ease-out`. Tidak ada pantulan.
- Tidak ada animasi masuk otomatis saat halaman dimuat.
- Gerak hanya sebagai respons tindakan: dialog (fade + skala 0,98→1, 160ms), toast (geser 8px + fade, 150ms), perubahan status strip persamaan (transisi warna 200ms).
- Pemuatan memakai **skeleton** pada bentuk konten yang sebenarnya, bukan spinner di tengah layar. Spinner kecil hanya di dalam tombol yang sedang diproses.
- Hormati `prefers-reduced-motion`: matikan semua transisi non-esensial.

---

## 4. Tata letak aplikasi

```
┌──────────┬────────────────────────────────────────────────────────┐
│ Sidebar  │ Bilah atas 56px: [Pemilih dapur]            [Pengguna] │
│ 240px    ├────────────────────────────────────────────────────────┤
│          │ Judul halaman (H1)                    [Aksi utama]     │
│ Ringkasan│ Keterangan satu baris                                  │
│ Dapur    │ ────────────────────────────────────────────────────── │
│  ├ ...   │ Konten (max 1280)                                      │
│ Unggahan │                                                        │
│ Riwayat  │                                                        │
│ Pengatur-│                                                        │
│ an       │                                                        │
└──────────┴────────────────────────────────────────────────────────┘
```

**Aturan pemilih dapur (kritis, tidak boleh dilanggar):**
- Nama dapur aktif **selalu terlihat** di bilah atas, di semua layar yang memuat data dapur.
- Pemilih berbentuk tombol 36px berisi nama dapur dan ikon chevron. Daftar tidak pernah menampilkan jumlah saldo gabungan.
- Saat beralih dapur, seluruh konten dimuat ulang dan judul halaman menyertakan nama dapur. Ini mencegah salah posting antar dapur.
- Halaman unggah menampilkan nama dapur tujuan di dekat area unggah dengan teks yang jelas, bukan hanya di bilah atas.

**Sidebar:** teks 14/20, item 36px tinggi, ikon 20px. Item aktif: latar `--accent-subtle`, teks `--accent`, bar vertikal 2px di kiri. Tidak ada eyebrow kapital pada grup. Grup dipisahkan jarak 16px dan judul kecil kalimat biasa bila perlu.

**Responsif:**
| Lebar | Perilaku |
|---|---|
| ≥ 1280 | Sidebar penuh, konten sampai 1280 |
| 1024–1279 | Sidebar ciut 64px (ikon + tooltip) |
| 768–1023 | Sidebar jadi laci (tombol menu di bilah atas) |
| < 768 | Tabel menjadi daftar baris bertumpuk (tanggal, deskripsi, nominal); layar review menjadi dua tab (PDF / Form) |

---

## 5. Komponen

### 5.1 Tombol
| Varian | Tampilan | Pemakaian |
|---|---|---|
| Utama | Latar `--accent`, teks putih, tinggi 36, padding 0 14, 14/20 bobot 500 | Satu per layar/area |
| Sekunder | Latar putih, batas `--line-strong`, teks `--ink` | Aksi lain |
| Ghost | Tanpa batas, teks `--ink-muted`, hover latar `--surface-muted` | Aksi tersier |
| Berbahaya | Latar putih, batas dan teks `--danger`; terisi hanya pada dialog konfirmasi | Void, buka kunci periode |

Label tombol berupa kata kerja spesifik: **"Simpan dan lanjut", "Unggah mutasi", "Tutup periode Maret 2026"**. Bukan "Kirim", "OK", "Submit". Tanpa `→`. Nama aksi dipertahankan di seluruh alur: tombol "Simpan transaksi" menghasilkan toast "Transaksi disimpan".

### 5.2 Input dan form
- Label di atas kontrol, kalimat biasa, 13/18 bobot 500. Teks bantu 12/16 `--ink-muted` di bawah kontrol.
- Field nominal: rata kanan, awalan "Rp" tetap di dalam kontrol, pemisah ribuan otomatis, angka tabular.
- Galat inline di bawah field, warna `--danger`, ikon + teks. Teks menjelaskan **apa yang salah dan cara memperbaikinya**: "Nominal harus berupa angka tanpa titik atau koma." Bukan "Input tidak valid".
- Field dengan keyakinan ekstraksi rendah: batas kiri 2px `--warn` dan teks bantu "Terbaca dengan keyakinan rendah. Cocokkan dengan PDF."

### 5.3 Tabel data (komponen terpenting)
- Header 40px, latar `--surface-muted`, teks 12/16 bobot 500 `--ink-muted`, kalimat biasa, batas bawah 1px.
- Baris 44px, batas bawah 1px `--line`. **Tanpa zebra.** Hover latar `--surface-muted`. Baris terpilih: bar 2px `--accent` di kiri, latar `--accent-subtle`.
- Kolom angka (DEBIT, KREDIT, TOTAL) rata kanan, tabular, lebar tetap. Nilai nol dikosongkan seperti pada Excel sumber.
- Kolom pertama (NO/TANGGAL) menempel (sticky) saat gulir horizontal; header menempel saat gulir vertikal.
- Deskripsi panjang dipotong satu baris dengan elipsis; teks lengkap di tooltip dan panel detail. Tidak ada baris yang berubah tinggi.
- Toolbar tabel 48px: pencarian, filter periode, filter status, jumlah hasil ("134 transaksi").
- Baris "SISA UANG" di akhir: bobot 600, batas atas 1px `--line-strong`.
- Pagination atau gulir virtual untuk > 200 baris.

### 5.4 Badge status

Status Cocok dan Selisih dipakai mulai v2 (rekonsiliasi). Di MVP badge dipakai untuk Draf, Diposting, Dibatalkan, Terkunci, dan Perlu input manual.
Tinggi 22px, radius 4px, teks 12/16 bobot 500, ikon 12px + teks (bukan warna saja).

| Status | Warna | Teks |
|---|---|---|
| Cocok | `--ok` di atas `--ok-subtle` | "Cocok" |
| Perlu perhatian | `--warn` di atas `--warn-subtle` | "Menunggu review" |
| Selisih/galat | `--danger` di atas `--danger-subtle` | "Selisih" |
| Netral | `--ink-muted` di atas `--surface-muted` | "Draf", "Dibatalkan" |
| Terkunci | `--ink` di atas `--surface-muted` + ikon gembok | "Terkunci" |

### 5.5 Area unggah
Bukan kotak putus-putus raksasa berhias ikon awan. Panel dengan batas 1px solid, padding 24, berisi: judul "Unggah bukti transfer untuk <nama dapur>", teks bantu "PDF, JPG, atau PNG, maksimal 10 MB per file, sampai 20 file", tombol sekunder "Pilih file", dan teks "atau seret file ke sini". Saat menyeret: batas berubah `--accent`, latar `--accent-subtle`. Setelah unggah: daftar file dengan status per file (diproses, siap direview, perlu input manual, ditolak + alasan).

### 5.6 Dialog, toast, kosong, galat
- Dialog: lebar 480 (konfirmasi) atau 640 (form), radius 12, tombol utama di kanan, tombol batal di kiri-nya, `Esc` menutup, fokus terkurung.
- Toast: kanan bawah, maksimal satu tampil sekaligus, 4 detik, tidak menutup konten tabel penting. `role="status"`.
- Kondisi kosong adalah ajakan bertindak, bukan suasana: "Belum ada transaksi di Maret 2026. Unggah bukti transfer pertama." plus tombol. Tanpa ilustrasi.
- Galat sistem: jelaskan yang terjadi dan tindakan. Tanpa permintaan maaf berlebihan. Sertakan kode pelacak: "Gagal membaca file. Coba unggah ulang. Jika berulang, sertakan kode 7F3A-91C2 saat melapor."

---

## 6. Homepage (halaman depan)

Tujuan: menjelaskan produk kepada maker dan pengurus yayasan dengan jelas dalam satu layar pertama, lalu memberi jalan ke login. Produk ini berbasis undangan, jadi tombol utamanya "Masuk". Untuk versi demo, beri label kecil "Versi demo, data contoh" di bilah atas.

**Struktur (urut dari atas):**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Logo Kasdapur            Cara kerja  Keamanan  Tanya jawab   [Masuk] │  64px
├──────────────────────────────────────────────────────────────────────┤
│ H1 rata kiri (44/52), maks 2 baris           ┌──────────────────────┐│
│ Satu kalimat penjelas (16/26, maks 52 huruf) │ Cuplikan produk      ││
│ [Masuk]  [Lihat cara kerja]                  │ (komponen nyata,     ││
│ Satu baris fakta kecil                       │  data contoh,        ││
│                                              │  terpotong di bawah) ││
│                                              └──────────────────────┘│
├──────────────────────────────────────────────────────────────────────┤
│ Cara kerja: tiga langkah berurutan (boleh bernomor, ini urutan nyata)│
├──────────────────────────────────────────────────────────────────────┤
│ Saldo tiap dapur dijaga terpisah: strip persamaan hidup + penjelasan │
├──────────────────────────────────────────────────────────────────────┤
│ Keamanan: daftar fakta yang benar-benar diterapkan                   │
├──────────────────────────────────────────────────────────────────────┤
│ Tanya jawab (5 pertanyaan konkret)                                   │
├──────────────────────────────────────────────────────────────────────┤
│ Penutup: satu kalimat + tombol Masuk │ Footer ringkas                │
└──────────────────────────────────────────────────────────────────────┘
```

**Hero**
- Judul rata kiri, konkret, tanpa kata sorot. Contoh salinan:
  *"Dari bukti transfer ke buku kas Excel, tanpa mengetik ulang."*
- Kalimat penjelas: *"Unggah bukti transfer (PDF atau JPG), periksa hasil bacaannya, lalu unduh buku kas dalam format Excel yang sama seperti biasa. Setiap dapur punya buku dan saldonya sendiri."*
- Dua tombol: **Masuk** (utama), **Lihat cara kerja** (sekunder, gulir ke seksi).
- Satu baris fakta di bawah tombol, kalimat biasa, bukan angka karangan: *"Tanpa kata sandi bank. Sistem hanya menerima file yang Anda unggah."*
- Sisi kanan: **komponen produk sungguhan** (tabel buku kas dan strip persamaan) dirender dari data contoh, dalam bingkai batas 1px radius 8, terpotong di tepi bawah. **Bukan gambar ilustrasi, bukan tangkapan layar palsu, bukan perangkat (mockup laptop/ponsel).** Beri teks kecil "Data contoh" di pojok bingkai.
- Latar hero sama dengan kanvas. Tanpa gradien, tanpa blob, tanpa pola dekoratif.

**Cara kerja** (urutan nyata, penomoran boleh): 1 Unggah bukti transfer. 2 Periksa dan simpan. 3 Unduh Excel. Setiap langkah: judul 15/22, satu kalimat, dan potongan komponen asli di sebelahnya. Tanpa ikon dalam lingkaran.

**Saldo terpisah per dapur:** kolom kiri penjelasan dua-tiga kalimat; kolom kanan **strip persamaan** hidup dengan angka contoh. Tegaskan: "Tidak ada saldo gabungan."

**Keamanan:** daftar pendek fakta yang **benar-benar terimplementasi** (rujuk `SECURITY.md`): autentikasi dua langkah, data tiap dapur terisolasi di tingkat database, file disimpan privat, setiap perubahan tercatat, tidak menyimpan kredensial bank, dan pembacaan bukti transfer memakai layanan AI pihak ketiga dengan hasil yang selalu diperiksa manusia sebelum disimpan. **Dilarang mencantumkan sertifikasi, kepatuhan, atau klaim yang belum ada (misalnya "bersertifikat ISO", "bank-grade").**

**Tanya jawab:** pertanyaan nyata, misalnya "Apakah sistem ini mengakses rekening bank saya?", "Bukti transfer dari bank mana saja bisa dibaca?", "Apa yang terjadi jika berkas tidak terbaca?", "Siapa yang bisa melihat data dapur saya?", "Apakah berkas saya dikirim ke pihak ketiga?", "Bisakah saya tetap memakai Excel?". Akordeon sederhana, tanpa ikon plus berwarna.

**Yang tidak ada di homepage:** testimoni, logo klien, angka statistik, harga, badge penghargaan, ilustrasi, video latar.

---

## 7. Halaman login

**Tata letak:** dua kolom 50/50 pada ≥ 1024px; satu kolom di bawahnya.

```
┌────────────────────────────┬────────────────────────────┐
│                            │ (Petrol solid #0B4F6C)     │
│  Logo                      │                            │
│                            │  Pernyataan satu kalimat   │
│  Masuk ke Kasdapur  (24/32)│  (20/28, putih)            │
│  Keterangan satu baris     │                            │
│                            │  ┌──────────────────────┐  │
│  Email                     │  │ Strip persamaan      │  │
│  [__________________]      │  │ (komponen nyata,     │  │
│  Kata sandi                │  │  data contoh)        │  │
│  [__________________] 👁   │  └──────────────────────┘  │
│                            │                            │
│  [        Masuk         ]  │                            │
│                            │                            │
│  Akses hanya dengan        │                            │
│  undangan admin.           │                            │
└────────────────────────────┴────────────────────────────┘
```
(Ikon mata pada wireframe hanya penanda posisi; implementasi memakai ikon dari set ikon, bukan emoji.)

Aturan:
- Kolom kiri: formulir lebar maks 360px, dipusatkan vertikal dan rata kiri di dalam kolom. Tinggi kontrol 40px. Tombol "Masuk" lebar penuh 40px.
- Kolom kanan: **warna Petrol solid**, tanpa gradien, tanpa pola. Isinya satu pernyataan konkret (*"Setiap dapur punya buku dan saldonya sendiri."*) dan satu strip persamaan dari komponen asli dengan data contoh. Tidak ada testimoni.
- Tombol tampilkan/sembunyikan kata sandi bertipe ikon dengan label aksesibel.
- **Langkah MFA:** layar yang sama berganti isi: judul "Masukkan kode verifikasi", enam kotak digit 44×52 (radius 6), fokus otomatis, tempel kode didukung, teks bantu "Buka aplikasi autentikator Anda dan masukkan kode 6 digit."
- Galat inline di atas formulir, spesifik tetapi tidak membocorkan informasi: "Email atau kata sandi salah." Saat dibatasi laju: "Terlalu banyak percobaan. Coba lagi dalam 15 menit."
- Tidak ada tautan daftar. Satu baris: "Akses hanya dengan undangan admin."
- Di < 1024px: kolom kanan disembunyikan; formulir tetap lebar maks 360px dan di tengah halaman.

---

## 8. Layar inti aplikasi

### 8.1 Strip persamaan saldo periode (elemen khas)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Saldo awal           Dana masuk            Dana keluar            Saldo akhir   │
│  Rp 120.000.000   +   Rp 300.000.000   −    Rp 287.450.000    =    Rp 132.550.000│
│  1 Mar 2026           2 transaksi           120 transaksi          per 28 Mar 2026│
│                                                                    ▮ Terbuka     │
│  ┃ 3 draf belum dihitung. Tinjau                                                 │
└──────────────────────────────────────────────────────────────────────────────────┘
(angka contoh rekaan: 120.000.000 + 300.000.000 − 287.450.000 = 132.550.000)
```
- Wadah: batas 1px `--line`, radius 8, latar `--surface`, padding 20/24.
- Empat segmen sejajar; operator `+`, `−`, `=` di antara segmen, warna `--ink-subtle`, ukuran sama dengan angka.
- Angka 28/36 bobot 500 tabular; label 13/20 `--ink-muted`; keterangan 12/16 `--ink-subtle`.
- Segmen **Saldo akhir** membawa badge status periode: "Terbuka" (netral) atau "Terkunci" (ikon gembok).
- **Saldo hanya menghitung transaksi yang sudah diposting.** Bila ada draf, tampil baris keterangan di bawah strip: batas kiri 2px `--warn`, latar `--warn-subtle`, teks "3 draf belum dihitung" dengan tautan "Tinjau" ke antrean review. Ini mencegah maker mengira saldo sudah final.
- Saat transaksi diposting, angka berganti dengan cross-fade 200ms (bukan animasi hitung naik). `aria-live="polite"` pada segmen Saldo akhir.
- **Satu strip per dapur**, tidak pernah dijumlahkan lintas dapur.
- Versi ringkas (tinggi 56px, satu baris) dipakai di kepala halaman Buku kas.
- **v2:** strip rekonsiliasi `Saldo buku − Saldo bank = Selisih` ditambahkan di bawah strip ini. Segmen Selisih berlatar `--ok-subtle` dengan batas kiri `--ok` dan teks "Cocok" bila selisih Rp 0 dan tidak ada item tak tercocok; bila bukan nol, `--danger-subtle` dengan batas `--danger`, teks "Selisih" dan ringkasan jumlah item tak tercocok sebagai tautan. Satu strip per rekening.

### 8.2 Dasbor (ringkasan)

```
Ringkasan                               [Periode: Maret 2026 ▾] [Unggah bukti transfer]
Saldo tiap dapur dihitung terpisah.

┌ Perlu tindakan ──────────────────────────────────────────────────────┐
│ Dapur Mijen         12 draf menunggu review                  Buka    │
│ Dapur Plombokan     1 berkas perlu input manual              Buka    │
│ Yayasan A. A. N. 2  Periode Februari 2026 belum dikunci      Buka    │
└──────────────────────────────────────────────────────────────────────┘

┌ Dapur ───────────────────────────────────────────────────────────────┐
│ Dapur            Saldo akhir  Menunggu review  Terakhir diunggah  Periode │
│ Wonoplumbon      ...          0                28 Mar 2026        Terbuka │
│ Mijen            ...          12               27 Mar 2026        Terbuka │
│ Plombokan        ...          0                28 Mar 2026        Terbuka │
│ Yayasan A.A.N.   ...          0                15 Mar 2026        Terkunci│
│ Yayasan A.A.N. 2 ...          3                28 Mar 2026        Terbuka │
└──────────────────────────────────────────────────────────────────────┘
(Tidak ada baris total. Tidak ada grafik gabungan. Tidak ada saldo bank di MVP.)
```
- **Bukan** deretan empat kartu KPI identik. Panel "Perlu tindakan" memandu pekerjaan; tabel "Dapur" memberi gambaran.
- Baris tabel dapat diklik seluruhnya; Enter membuka dapur.
- Grafik (bila ada, v2): garis saldo harian **per dapur**. Tanpa donat, tanpa 3D, sumbu dan garis kisi tipis, angka sumbu tabular.

### 8.3 Layar review unggahan

Panel kiri menampilkan PDF **atau gambar JPG/PNG** dengan zoom dan geser (pan). Bukti transfer sering berupa gambar, jadi kontrol zoom wajib nyaman dipakai di ponsel. Field yang ditandai pemeriksaan konsistensi (misalnya "nominal besar") tampil dengan keterangan alasannya.

```
┌ PDF (50%) ────────────────────────┬ Hasil bacaan (50%) ───────────────────┐
│ Bar alat: ◀ 1/1 ▶  zoom − 100% +  │ Dapur tujuan: Plombokan               │
│                                   │ Tanggal        [02 Mar 2026]          │
│  (halaman PDF dirender)           │ No. referensi  [2026030204...]        │
│                                   │ Nominal        [Rp   2.436.500]       │
│                                   │ Rekening penerima / Nama / Bank       │
│                                   │ Deskripsi      [usulan dari aturan]   │
│                                   │ ☐ Tambahkan biaya admin Rp 6.500      │
├───────────────────────────────────┴───────────────────────────────────────┤
│ 3 dari 12                     [Lewati]   [Simpan dan lanjut]              │ 64px, menempel di bawah
└───────────────────────────────────────────────────────────────────────────┘
```
- Papan ketik: `↓/↑` berpindah file, `Ctrl/⌘+Enter` simpan dan lanjut.
- Field berkeyakinan rendah ditandai (5.2). Peringatan dapur salah (PRD F3.4) tampil sebagai banner amber di atas panel kanan.
- Di < 768px: dua tab "PDF" dan "Form".

### 8.4 Buku kas
Tabel 5.3 dengan kolom persis seperti Excel sumber. Kepala halaman: nama dapur (H1), periode, strip persamaan ringkas, tombol "Ekspor Excel" (sekunder). Aksi baris (edit, batalkan) lewat menu di ujung kanan; perubahan membuka panel samping 480px, bukan halaman baru. Baris berstatus batal tampil dicoret ringan dengan badge "Dibatalkan".

### 8.5 Rekonsiliasi (v2, tidak dibangun di MVP)
Strip persamaan penuh di atas. Di bawahnya tiga tab dengan jumlah: "Belum ada di bank (n)", "Belum dibukukan (n)", "Nominal berbeda (n)". Setiap tab berupa tabel dengan aksi baris yang spesifik ("Buat transaksi", "Cocokkan dengan…", "Abaikan dengan catatan"). Tombol "Tutup periode Maret 2026" nonaktif dengan alasan terlihat bila belum memenuhi syarat.

---

## 9. Bahasa antarmuka

- Bahasa Indonesia baku yang ramah, kalimat biasa (huruf kapital hanya di awal kalimat dan nama diri). Tidak memakai "Anda" berlebihan; gunakan kalimat langsung.
- Menamai berdasarkan pemahaman pengguna: "Bukti transfer", "Mutasi bank", "Saldo buku", "Selisih". Bukan istilah teknis sistem ("parse", "payload", "reconcile job").
- Satu istilah, satu makna, di seluruh aplikasi (jangan bergantian "unggahan/upload/berkas").
- Galat: apa yang terjadi + cara memperbaiki. Tanpa permintaan maaf berlebihan dan tanpa kata "Oops".
- Kondisi kosong: arahkan ke tindakan berikutnya.
- Konfirmasi yang merusak menyebut akibatnya: "Membuka kembali Maret 2026 mengizinkan perubahan transaksi. Tindakan ini dicatat."

---

## 10. Aksesibilitas

- Kontras AA minimum; fokus terlihat; seluruh fungsi dapat dijangkau dengan papan ketik.
- Tabel memakai elemen tabel semantik dengan `th scope`. Tabel yang berubah menjadi daftar di ponsel tetap memiliki label.
- Status tidak pernah hanya warna: selalu ikon dan teks.
- Toast dan strip persamaan memakai `aria-live`.
- Target sentuh ≥ 40px. Teks dapat diperbesar hingga 200% tanpa kehilangan fungsi.
- Gerak dikurangi sesuai preferensi sistem.

---

## 11. Data contoh yang realistis

Data demo harus **terlihat nyata tanpa berisi data nyata**:
- Nominal, tanggal, pola deskripsi, dan jenis penerima meniru pola buku kas sumber (pembelian bahan baku, galon, sewa kendaraan, insentif fasilitas, gaji relawan, biaya admin Rp6.500, dana masuk dari BGN) dengan **angka dan nama rekaan**.
- Nomor rekening rekaan dan dapat dikenali sebagai rekaan; nama penerima fiktif.
- Selalu ada dapur dengan draf menunggu review dan dapur tanpa draf, serta satu berkas `needs_manual`, agar semua keadaan strip saldo dan dasbor terlihat.
- Label "Data contoh" pada setiap layar demo.
- Dilarang memakai nama, rekening, atau nominal dari berkas Excel asli.

---

## 12. Implementasi

Pemetaan token ke Tailwind: definisikan token di atas sebagai variabel CSS, lalu petakan ke tema Tailwind sesuai versi yang terpasang (**[perlu verifikasi cara konfigurasi pada versi terpasang]**). Larangan:
- Memakai palet bawaan Tailwind (`blue-500`, `slate-*`, `indigo-*`) langsung di komponen. Semua warna lewat token.
- Memakai `rounded-2xl`/`rounded-3xl`, `shadow-lg`/`shadow-xl`, `backdrop-blur`, `bg-gradient-*`, dan kelas `animate-*` bawaan untuk dekorasi.
- Memakai komponen dari pustaka UI tanpa mengganti seluruh token dan membandingkannya dengan dokumen ini.

Struktur: komponen dasar di `src/components/ui/` (Button, Input, Select, Badge, Table, Dialog, Toast, Tabs, Skeleton); komponen domain di `src/components/domain/` (LedgerTable, ReviewPanel, PeriodEquation, DapurSwitcher, UploadDropzone). Setiap komponen dasar memiliki halaman contoh di `/dev/ui` (tidak dapat diakses di produksi).

Font:

```ts
import { IBM_Plex_Sans } from 'next/font/google';
export const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-sans',
});
```

---

## 13. Proses desain dan penerimaan visual

**Sebelum menulis kode UI**, agent menulis rencana singkat (di PR atau `docs/design-notes.md`): token yang dipakai, sketsa tata letak ASCII, dan satu paragraf yang memeriksa rencana terhadap bagian 2 (larangan). Jika ada bagian rencana yang bisa menjadi hasil generik untuk produk apa pun, revisi dan catat alasannya.

**Penerimaan visual (wajib untuk setiap halaman):**
1. Ambil tangkapan layar pada lebar **1440**, **1024**, dan **390**.
2. Periksa terhadap daftar:
   - [ ] Tidak ada item di bagian 2.1 dan 2.2
   - [ ] Semua warna, ukuran, radius berasal dari token
   - [ ] Angka rata kanan dan tabular; kolom bergaris lurus
   - [ ] Satu tombol utama per area
   - [ ] Nama dapur terlihat pada layar data
   - [ ] Spasi mengikuti skala 4px; tidak ada nilai acak (13px, 22px margin, dll.)
   - [ ] Teks UI kalimat biasa; tidak ada kapital semua
   - [ ] Keadaan kosong, memuat, galat, serta ada/tidak ada draf menunggu review sudah dirancang
   - [ ] Fokus papan ketik terlihat di semua kontrol
3. **Uji "lepas satu aksesori":** untuk tiap halaman, buang satu elemen dekoratif atau satu perlakuan visual yang tidak melayani tugas pengguna.
4. Simpan tangkapan layar di `docs/screens/` bersama catatan perubahan.

**Penilaian akhir oleh manusia.** Karena penilaian estetika tidak dapat sepenuhnya diotomatisasi, Ricky atau teman Ricky meninjau tangkapan layar dan memutuskan. Dokumen ini diperbarui bila ada keputusan yang mengubah aturan.

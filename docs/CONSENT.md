# CONSENT — Catatan Persetujuan Penggunaan Penyedia AI Pihak Ketiga

| | |
|---|---|
| Status | **Draf Prasyarat Sebelum Data Nyata Masuk (SECURITY.md S-14 & PRD Q1/Q12)** |
| Tanggal pencatatan | 25 Oktober 2026 |
| Dokumen acuan | `AGENTS.md` #6 & #11, `PRD.md` Q1 & Q12, `SECURITY.md` S-14, `TECH-STACK.md` §4 |

---

## 1. Status Izin Saat Ini

1. **Lingkungan Demo & Pengembangan Saat Ini:**
   - Seluruh data di repositori, fixture pengujian, dan layar demo adalah **100% data sintetis** (nama rekaan, nomor rekening berawalan `9990`, nominal rekaan, tanpa logo/merek bank asli).
   - Pengujian otomatis (`npm run test` dan `npm run test:extraction`) menggunakan **klien AI tiruan** dan tidak pernah memanggil penyedia AI eksternal.
2. **Prasyarat Sebelum Data Nyata Digunakan (Gerbang Produksi `SECURITY.md` Bagian D):**
   - Yayasan telah menyatakan izin pengembangan dan penggunaan sistem secara lisan/pesan (`PRD.md` Q1).
   - Sebelum satu pun berkas bukti transfer nyata diunggah pada mode `EXTRACTION_MODE=ai`, pengurus yayasan yang berwenang wajib menandatangani/mencatat persetujuan tertulis di dokumen ini yang secara eksplisit mencakup:
     - Pengiriman berkas bukti transfer yang sedang diproses (gambar JPG/PNG yang telah dibersihkan dari metadata EXIF/lokasi, atau dokumen PDF) ke penyedia AI pihak ketiga (Anthropic API `https://api.anthropic.com/v1/messages`) semata-mata untuk membaca field transaksi.
     - Pemahaman bahwa sistem menerapkan minimisasi data (hanya berkas yang sedang diproses yang dikirim, tanpa nama dapur, saldo, atau daftar transaksi lain) dan hasil ekstraksi selalu berstatus draf yang wajib diperiksa manusia sebelum diposting.
     - Apabila yayasan tidak menghendaki pengiriman berkas ke pihak ketiga, sistem dapat dijalankan dengan `EXTRACTION_MODE=manual` yang menonaktifkan seluruh panggilan keluar ke penyedia AI.

---

## 2. Hasil Pemeriksaan Dokumentasi Resmi Penyedia AI (Anthropic Messages API)

Berdasarkan pemeriksaan dokumentasi resmi Anthropic per Oktober 2026:

1. **Endpoint, Header, dan Format Permintaan (`VERIFIED`):**
   - Endpoint: `POST https://api.anthropic.com/v1/messages`
   - Header wajib: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
   - Blok konten PDF: `{ "type": "document", "source": { "type": "base64", "media_type": "application/pdf", "data": "<base64>" } }`
   - Blok konten Gambar: `{ "type": "image", "source": { "type": "base64", "media_type": "image/jpeg" | "image/png", "data": "<base64>" } }`
2. **Kebijakan Retensi & Pemakaian Data Komersial (`VERIFIED` secara umum, `UNVERIFIED` untuk tier akun yayasan):**
   - Pada Commercial Terms standar Anthropic API, input dan output API **tidak digunakan untuk melatih model** secara bawaan.
   - Secara bawaan, log API komersial disimpan selama maksimal **30 hari** untuk pemantauan penyalahgunaan (*trust & safety*) dan keandalan sistem sebelum dihapus otomatis.
   - Opsi **Zero Data Retention (ZDR)** tersedia khusus bagi akun organisasi/enterprise yang mengajukan dan memperoleh persetujuan ZDR dari Anthropic (**`UNVERIFIED`** apakah akun infrastruktur yayasan nantinya menggunakan tier standar 30 hari atau ZDR).

---

## 3. Kolom Tanda Tangan Persetujuan Yayasan (Diisi Sebelum Pilot Data Nyata)

- **Nama Pengurus Berwenang:** `[BELUM DIISI — Diisi sebelum pilot data nyata]`
- **Jabatan di Yayasan:** `[BELUM DIISI]`
- **Tanggal Persetujuan Tertulis:** `[BELUM DIISI]`
- **Pilihan Mode Operasi Produksi:** `[ ] EXTRACTION_MODE=ai` / `[ ] EXTRACTION_MODE=manual`

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, NominalInput } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/Table';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/Dialog';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';

function ShowcaseContent() {
  const { toast } = useToast();
  const [nominal, setNominal] = useState<bigint>(1450000n);
  const [inputText, setInputText] = useState('Pembelian beras 100 kg');

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--ink)] p-4 sm:p-8 space-y-10">
      <header className="max-w-4xl mx-auto border-b border-[var(--line)] pb-4">
        <div className="inline-block px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--neutral-subtle)] text-[var(--ink-muted)] mb-2">
          Halaman Pengujian Desain Internal · /dev/ui
        </div>
        <h1 className="text-xl font-bold text-[var(--ink)]">
          Showcase Komponen Dasar UI Kasdapur
        </h1>
        <p className="text-xs text-[var(--ink-muted)]">
          Verifikasi penerapan token DESIGN.md (radius 6px kontrol, batas 1px, angka tabular, tanpa gradien).
        </p>
      </header>

      <main className="max-w-4xl mx-auto space-y-8">
        {/* 1. Tombol (Button) */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            1. Tombol (Button) — Varian & State
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary">Simpan dan lanjut</Button>
            <Button variant="secondary">Ekspor Excel</Button>
            <Button variant="ghost">Batal</Button>
            <Button variant="danger">Batalkan transaksi</Button>
            <Button variant="primary" loading>
              Menyimpan...
            </Button>
            <Button variant="secondary" disabled>
              Nonaktif
            </Button>
          </div>
        </section>

        {/* 2. Input & Field Nominal Rupiah */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            2. Input & Field Nominal Rupiah
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Deskripsi Transaksi"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              helperText="Tuliskan peruntukan belanja dapur"
            />
            <NominalInput
              label="Nominal Transaksi (Rupiah)"
              value={nominal}
              onValueChange={setNominal}
              helperText="Format ribuan titik otomatis"
            />
            <Input
              label="Field Berkeyakinan Rendah"
              defaultValue="20260302048821"
              lowConfidence
            />
            <Input
              label="Field Galat"
              defaultValue="nominal-salah"
              errorText="Nominal harus berupa angka valid."
            />
          </div>
        </section>

        {/* 3. Select */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            3. Select Dropdown
          </h2>
          <div className="max-w-sm">
            <Select
              label="Pilih Dapur Tujuan"
              options={[
                { value: 'cmp', label: 'Dapur Sintetis Cempaka (DS-CMP)' },
                { value: 'kng', label: 'Dapur Sintetis Kenanga (DS-KNG)' },
                { value: 'mlt', label: 'Dapur Sintetis Melati (DS-MLT)' },
              ]}
            />
          </div>
        </section>

        {/* 4. Badge Status */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            4. Badge Status (Ikon + Teks, Bukan Warna Saja)
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="ok">Cocok</Badge>
            <Badge tone="warn">Menunggu review</Badge>
            <Badge tone="danger">Selisih</Badge>
            <Badge tone="neutral">Draf</Badge>
            <Badge tone="locked">Terkunci</Badge>
            <Badge tone="accent">Bantuan</Badge>
          </div>
        </section>

        {/* 5. Tabel (Table) */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            5. Tabel Data (Header Sticky, Baris Tabular 44px)
          </h2>
          <div className="border border-[var(--line)] rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead className="w-12 text-center">NO</TableHead>
                  <TableHead className="w-28">TANGGAL</TableHead>
                  <TableHead>DESKRIPSI</TableHead>
                  <TableHead alignRight className="w-32">
                    DEBIT
                  </TableHead>
                  <TableHead alignRight className="w-32">
                    KREDIT
                  </TableHead>
                  <TableHead alignRight className="w-36">
                    SALDO
                  </TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell alignCenter tabular>
                    1
                  </TableCell>
                  <TableCell tabular>01 Mar 2026</TableCell>
                  <TableCell className="font-medium">
                    PERPINDAHAN SALDO FEBRUARI 2026
                  </TableCell>
                  <TableCell alignRight tabular>
                    Rp 115.000.000
                  </TableCell>
                  <TableCell alignRight tabular>
                    —
                  </TableCell>
                  <TableCell alignRight tabular className="font-semibold">
                    Rp 115.000.000
                  </TableCell>
                </TableRow>
                <TableRow selected>
                  <TableCell alignCenter tabular>
                    2
                  </TableCell>
                  <TableCell tabular>02 Mar 2026</TableCell>
                  <TableCell>Pembelian beras & telur 150 kg</TableCell>
                  <TableCell alignRight tabular>
                    —
                  </TableCell>
                  <TableCell alignRight tabular>
                    Rp 3.250.000
                  </TableCell>
                  <TableCell alignRight tabular className="font-semibold">
                    Rp 111.750.000
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

        {/* 6. Dialog & Toast */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            6. Dialog Konfirmasi & Toast
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">Buka Dialog Konfirmasi</Button>
              </DialogTrigger>
              <DialogContent size="sm">
                <DialogHeader>
                  <DialogTitle>Kunci Periode Maret 2026</DialogTitle>
                  <DialogDescription>
                    Setelah dikunci, seluruh transaksi tidak dapat diubah di database. Saldo akhir akan otomatis terbawa ke periode berikutnya.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Batal</Button>
                  </DialogClose>
                  <Button
                    variant="primary"
                    onClick={() =>
                      toast({
                        tone: 'success',
                        title: 'Periode berhasil dikunci',
                        description: 'Saldo akhir telah terbawa ke periode April 2026.',
                      })
                    }
                  >
                    Ya, Kunci Periode
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  tone: 'success',
                  title: 'Transaksi disimpan',
                  description: '1 transaksi berhasil diposting ke buku kas.',
                })
              }
            >
              Trigger Toast Sukses
            </Button>

            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  tone: 'error',
                  title: 'Gagal memproses file',
                  description: 'Ukuran berkas melebihi batas 10 MB.',
                })
              }
            >
              Trigger Toast Galat
            </Button>
          </div>
        </section>

        {/* 7. Tabs */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            7. Tabs Navigasi
          </h2>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Ringkasan Dapur</TabsTrigger>
              <TabsTrigger value="rules">Aturan Penerima</TabsTrigger>
              <TabsTrigger value="audit">Jejak Audit</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="p-3 bg-[var(--surface-muted)] rounded border border-[var(--line)] text-xs">
              Konten tab Ringkasan Dapur.
            </TabsContent>
            <TabsContent value="rules" className="p-3 bg-[var(--surface-muted)] rounded border border-[var(--line)] text-xs">
              Konten tab Aturan Penerima.
            </TabsContent>
            <TabsContent value="audit" className="p-3 bg-[var(--surface-muted)] rounded border border-[var(--line)] text-xs">
              Konten tab Jejak Audit.
            </TabsContent>
          </Tabs>
        </section>

        {/* 8. Skeleton & EmptyState */}
        <section className="bg-[var(--surface)] border border-[var(--line)] rounded-lg p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            8. Skeleton & Empty State (Tanpa Ilustrasi Kartun)
          </h2>
          <div className="space-y-2 max-w-sm">
            <p className="text-xs text-[var(--ink-muted)]">Skeleton memuat:</p>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-full" />
          </div>

          <EmptyState
            title="Belum ada transaksi di Maret 2026"
            description="Unggah bukti transfer pertama untuk mulai membukukan pengeluaran dapur ini."
            actionLabel="Unggah bukti transfer"
            onAction={() =>
              toast({
                tone: 'info',
                title: 'Buka dialog unggah',
              })
            }
          />
        </section>
      </main>
    </div>
  );
}

export default function DevUiPage() {
  return (
    <ToastProvider>
      <ShowcaseContent />
    </ToastProvider>
  );
}

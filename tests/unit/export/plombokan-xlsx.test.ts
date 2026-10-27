import path from 'node:path';
import fs from 'node:fs';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { generateDemoDataset } from '@/lib/demo-data';
import { computePeriodLedger, type LedgerEntryInput } from '@/lib/ledger-math';
import {
  createSanitizedPlombokanTemplate,
  exportPlombokanXlsx,
  PLOMBOKAN_COLUMN_WIDTHS,
  PLOMBOKAN_HEADERS,
  PLOMBOKAN_RUPIAH_NUM_FMT,
} from '@/server/export/plombokan-xlsx';

const TEMPLATE_FIXTURE_PATH = path.resolve(
  process.cwd(),
  'tests/fixtures/template/plombokan-template.xlsx',
);

describe('plombokan-excel-export & kesamaan saldo UI = hitungan independen = Excel (M2)', () => {
  it('membuat templat tersamar tanpa data nyata dengan lebar kolom dan header persis Plombokan', async () => {
    await createSanitizedPlombokanTemplate(TEMPLATE_FIXTURE_PATH);
    expect(fs.existsSync(TEMPLATE_FIXTURE_PATH)).toBe(true);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(TEMPLATE_FIXTURE_PATH);
    const ws = wb.getWorksheet('Sheet1')!;
    expect(ws).toBeDefined();

    // Pastikan lebar 11 kolom A..K persis sama dengan templat sumber
    PLOMBOKAN_COLUMN_WIDTHS.forEach((expectedWidth, idx) => {
      expect(ws.getColumn(idx + 1).width).toBeCloseTo(expectedWidth, 4);
    });

    // Pastikan baris 5 adalah header 11 kolom persis
    const row5 = ws.getRow(5);
    PLOMBOKAN_HEADERS.forEach((expectedHeader, idx) => {
      expect(row5.getCell(idx + 1).value).toBe(expectedHeader);
    });

    // Pastikan tidak ada baris data nyata (baris 6 kosong di templat dasar)
    expect(ws.getRow(6).getCell(4).value).toBeNull();
  }, 15_000);

  it(
    'mengekspor seluruh 5 dapur demo dengan saldo akhir UI === hitungan independen === sel SISA UANG di Excel',
    async () => {
    const dataset = generateDemoDataset(20261025);

    for (const kitchen of dataset.kitchens) {
      // 1. Hitungan saldo UI / fungsi murni buku kas
      const uiLedger = computePeriodLedger(
        kitchen.openingBalance,
        kitchen.entries,
      );

      // 2. Hitungan independen (penjumlahan BigInt terpisah dari nol)
      let independentDebit = 0n;
      let independentCredit = 0n;
      for (const e of kitchen.entries) {
        if (e.status === 'posted') {
          independentDebit += e.debit;
          independentCredit += e.credit;
        }
      }
      const independentClosing =
        kitchen.openingBalance + independentDebit - independentCredit;

      // 3. Ekspor Excel dan baca kembali buffer-nya dengan ExcelJS
      const exported = await exportPlombokanXlsx(
        {
          organizationName: dataset.organization.name,
          kitchenName: kitchen.name,
          pjName: kitchen.pjName,
          year: kitchen.year,
          month: kitchen.month,
          openingBalance: kitchen.openingBalance,
          adminFeeDefault: kitchen.adminFeeDefault,
          entries: kitchen.entries,
        },
        TEMPLATE_FIXTURE_PATH,
      );

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(exported.buffer as unknown as ExcelJS.Buffer);
      const ws = wb.getWorksheet('Sheet1')!;

      // Verifikasi 3 baris judul tergabung A1:K1, A2:K2, A3:K3
      expect(ws.getRow(1).getCell(1).value).toBe(
        dataset.organization.name.toUpperCase(),
      );
      expect(String(ws.getRow(2).getCell(1).value)).toContain(
        kitchen.name.toUpperCase(),
      );
      expect(ws.getRow(3).getCell(1).value).toBe('PERIODE MARET 2026');

      // Verifikasi baris 6: PERPINDAHAN SALDO FEBRUARI 2026 & rumus I6 = G6
      const row6 = ws.getRow(6);
      expect(row6.getCell(1).value).toBe(1);
      expect(row6.getCell(4).value).toBe('PERPINDAHAN SALDO FEBRUARI 2026');
      expect(row6.getCell(7).value).toBe(Number(kitchen.openingBalance));
      expect(row6.getCell(9).formula).toBe('G6');
      expect(row6.getCell(9).numFmt).toBe(PLOMBOKAN_RUPIAH_NUM_FMT);

      // Evaluasi ulang rantai rumus Excel dari baris 6 sampai SISA UANG secara independen
      let excelEvaluatedRunning = BigInt(
        Math.round(Number(row6.getCell(7).value ?? 0)),
      );
      for (
        let r = 7;
        r <= exported.lastDataRowNumber;
        r += 1
      ) {
        const row = ws.getRow(r);
        const gVal = BigInt(Math.round(Number(row.getCell(7).value ?? 0)));
        const hVal = BigInt(Math.round(Number(row.getCell(8).value ?? 0)));
        const totalCell = row.getCell(9);

        expect(totalCell.formula).toBe(
          `IF(G${r}=H${r},"",I${r - 1}+G${r}-H${r})`,
        );
        excelEvaluatedRunning = excelEvaluatedRunning + gVal - hVal;
        expect(BigInt(Math.round(Number(totalCell.result)))).toBe(
          excelEvaluatedRunning,
        );
      }

      // Verifikasi baris SISA UANG
      const sisaRow = ws.getRow(exported.sisaUangRowNumber);
      expect(sisaRow.getCell(1).value).toBe('SISA UANG');
      const sisaCell = sisaRow.getCell(9);
      expect(sisaCell.formula).toBe(`I${exported.lastDataRowNumber}`);
      const excelSisaUang = BigInt(Math.round(Number(sisaCell.result)));

      // KRITERIA SELESAI M2: Saldo akhir UI === Hitungan Independen === Sel SISA UANG Excel
      expect(uiLedger.summary.closingBalance).toBe(independentClosing);
      expect(excelSisaUang).toBe(independentClosing);
      expect(excelEvaluatedRunning).toBe(uiLedger.summary.closingBalance);
    }
  }, 25000);

  it('menangkal formula injection (=1+1, +cmd, -2+3, @SUM(A1)): teks pengguna selalu string dan hanya kolom I yang berisi rumus', async () => {
    const maliciousDescriptions = [
      '=1+1',
      '+cmd|\' /C calc\'!A0',
      '-2+3',
      '@SUM(A1:A10)',
    ];

    const entries: LedgerEntryInput[] = maliciousDescriptions.map(
      (desc, idx) => ({
        id: `00000000-0000-4000-8000-00000000010${idx + 1}`,
        seqNo: idx + 1,
        txDate: '2026-03-15',
        kind: 'outgoing',
        referenceNo: `=REF+${idx + 1}`,
        description: desc,
        counterpartyAccount: '184601001020501',
        counterpartyName: `@PENERIMA_${idx + 1}`,
        counterpartyBank: '+BRI',
        debit: 0n,
        credit: 100_000n * BigInt(idx + 1),
        note: `-CATATAN_${idx + 1}`,
        status: 'posted',
      }),
    );

    const exported = await exportPlombokanXlsx(
      {
        organizationName: 'YAYASAN UJI KEAMANAN',
        kitchenName: 'DAPUR UJI INJEKSI',
        pjName: 'SITI NURLAILA',
        year: 2026,
        month: 3,
        openingBalance: 10_000_000n,
        entries,
      },
      TEMPLATE_FIXTURE_PATH,
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(exported.buffer as unknown as ExcelJS.Buffer);
    const ws = wb.getWorksheet('Sheet1')!;

    // Periksa ke-4 baris transaksi berbahaya (baris 7..10)
    for (let idx = 0; idx < maliciousDescriptions.length; idx += 1) {
      const rowNumber = 7 + idx;
      const row = ws.getRow(rowNumber);
      const descCell = row.getCell(4);

      expect(descCell.type).toBe(ExcelJS.ValueType.String);
      expect(descCell.formula).toBeUndefined();
      expect(descCell.value).toBe(maliciousDescriptions[idx]);
      expect(descCell.numFmt).toBe('@');
    }

    // Pastikan di seluruh lembar kerja HANYA kolom I (kolom ke-9) yang memiliki formula
    ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        if (colNumber !== 9) {
          expect(
            cell.type,
            `Baris ${rowNumber} kolom ${colNumber} tidak boleh bertipe Formula`,
          ).not.toBe(ExcelJS.ValueType.Formula);
          expect(cell.formula).toBeUndefined();
        }
      });
    });
  });
});

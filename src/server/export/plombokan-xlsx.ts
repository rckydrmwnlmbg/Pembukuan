import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {
  computePeriodLedger,
  type LedgerEntryInput,
  type PeriodBalanceSummary,
} from '@/lib/ledger-math';

/**
 * Format angka Rupiah persis dari templat sumber Plombokan:
 * `_-"Rp"* #,##0_-;-"Rp"* #,##0_-;_-"Rp"* "-"??_-;_-@_-`
 */
export const PLOMBOKAN_RUPIAH_NUM_FMT =
  '_-"Rp"* #,##0_-;-"Rp"* #,##0_-;_-"Rp"* "-"??_-;_-@_-';

export const PLOMBOKAN_DATE_NUM_FMT = 'mm-dd-yy';

export const PLOMBOKAN_COLUMN_WIDTHS: readonly number[] = [
  5.90625, // A: NO
  16.453125, // B: TANGGAL
  24.7265625, // C: NO. REFERENCE
  102.6328125, // D: DESKRIPSI
  49.7265625, // E: REKENING PENERIMA
  18.6328125, // F: BANK
  20.26953125, // G: DEBIT
  23.26953125, // H: KREDIT
  23.453125, // I: TOTAL
  35.7265625, // J: KET
  21.90625, // K: DOKUMENTASI NOTA
];

export const PLOMBOKAN_HEADERS: readonly string[] = [
  'NO',
  'TANGGAL',
  'NO. REFERENCE',
  'DESKRIPSI',
  'REKENING PENERIMA',
  'BANK',
  'DEBIT',
  'KREDIT',
  'TOTAL',
  'KET',
  'DOKUMENTASI NOTA',
];

const INDONESIAN_UPPER_MONTHS: readonly string[] = [
  'JANUARI',
  'FEBRUARI',
  'MARET',
  'APRIL',
  'MEI',
  'JUNI',
  'JULI',
  'AGUSTUS',
  'SEPTEMBER',
  'OKTOBER',
  'NOVEMBER',
  'DESEMBER',
];

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF000000' } },
  left: { style: 'thin', color: { argb: 'FF000000' } },
  bottom: { style: 'thin', color: { argb: 'FF000000' } },
  right: { style: 'thin', color: { argb: 'FF000000' } },
};

const FONT_REGULAR: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 12,
  family: 2,
  color: { theme: 1 },
};

const FONT_BOLD: Partial<ExcelJS.Font> = {
  ...FONT_REGULAR,
  bold: true,
};

const YELLOW_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF00' },
};

export interface PlombokanExportInput {
  organizationName: string;
  kitchenName: string;
  pjName: string;
  year: number;
  month: number; // 1..12
  openingBalance: bigint;
  adminFeeDefault?: bigint;
  entries: readonly LedgerEntryInput[];
}

export interface PlombokanExportResult {
  buffer: Buffer;
  summary: PeriodBalanceSummary;
  sisaUangRowNumber: number;
  lastDataRowNumber: number;
}

function getPreviousMonthLabel(year: number, month: number): string {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return `${INDONESIAN_UPPER_MONTHS[prevMonth - 1]} ${prevYear}`;
}

function getPeriodUpperLabel(year: number, month: number): string {
  return `PERIODE ${INDONESIAN_UPPER_MONTHS[month - 1] ?? 'MARET'} ${year}`;
}

function parseIsoDateUtc(isoDate: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return new Date(Date.UTC(2026, 2, 1));
  }
  return new Date(
    Date.UTC(
      Number.parseInt(match[1]!, 10),
      Number.parseInt(match[2]!, 10) - 1,
      Number.parseInt(match[3]!, 10),
    ),
  );
}

/**
 * Memastikan nilai teks dari pengguna selalu ditulis sebagai string murni (SECURITY.md S-13),
 * tidak pernah sebagai objek formula.
 */
export function asExcelSafeString(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

/**
 * Membuat berkas templat kosong tersamar di `tests/fixtures/template/plombokan-template.xlsx`
 * dengan struktur, lebar kolom, font, border, dan warna persis seperti sumber Plombokan,
 * tanpa satu pun data nyata (AGENTS.md #6 & SKILLS.md §4).
 */
export async function createSanitizedPlombokanTemplate(
  targetPath: string,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');

  ws.columns = PLOMBOKAN_COLUMN_WIDTHS.map((width, idx) => ({
    key: `col_${idx + 1}`,
    width,
    style:
      idx >= 6 && idx <= 8
        ? { numFmt: PLOMBOKAN_RUPIAH_NUM_FMT, font: FONT_REGULAR }
        : { font: FONT_REGULAR },
  }));

  // Tiga baris judul (A1:K1, A2:K2, A3:K3)
  const titles = [
    'YAYASAN CONTOH SINTETIS',
    'PEMBUKUAN UMUM DAPUR CONTOH (PJ NAMA CONTOH)',
    'PERIODE MARET 2026',
  ];

  for (let r = 1; r <= 3; r += 1) {
    const row = ws.getRow(r);
    row.getCell(1).value = titles[r - 1]!;
    ws.mergeCells(r, 1, r, 11);
    for (let c = 1; c <= 11; c += 1) {
      const cell = row.getCell(c);
      cell.font = FONT_BOLD;
      cell.alignment = { horizontal: 'center' };
    }
  }

  // Baris 5: Header kolom A5:K5
  const headerRow = ws.getRow(5);
  for (let c = 1; c <= 11; c += 1) {
    const cell = headerRow.getCell(c);
    cell.value = PLOMBOKAN_HEADERS[c - 1]!;
    cell.font = FONT_BOLD;
    cell.fill = YELLOW_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = THIN_BORDER;
    if (c >= 7 && c <= 9) {
      cell.numFmt = PLOMBOKAN_RUPIAH_NUM_FMT;
    }
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  await wb.xlsx.writeFile(targetPath);
}

/**
 * Mengekspor buku kas satu dapur satu periode ke `.xlsx` dengan tata letak dan rumus berantai
 * yang sama persis seperti berkas sumber Plombokan (PRD F7, SECURITY S-13, SKILLS.md §4).
 */
export async function exportPlombokanXlsx(
  input: PlombokanExportInput,
  templatePath = path.resolve(
    process.cwd(),
    'tests/fixtures/template/plombokan-template.xlsx',
  ),
): Promise<PlombokanExportResult> {
  if (!fs.existsSync(/*turbopackIgnore: true*/ templatePath)) {
    await createSanitizedPlombokanTemplate(templatePath);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(templatePath);
  const ws = wb.getWorksheet('Sheet1') ?? wb.worksheets[0] ?? wb.addWorksheet('Sheet1');

  // Pastikan lebar kolom dan format sesuai templat sumber
  PLOMBOKAN_COLUMN_WIDTHS.forEach((width, idx) => {
    const col = ws.getColumn(idx + 1);
    col.width = width;
    if (idx >= 6 && idx <= 8) {
      col.numFmt = PLOMBOKAN_RUPIAH_NUM_FMT;
    }
  });

  // 1. Isi tiga baris judul (A1:K1, A2:K2, A3:K3)
  const titleLines = [
    asExcelSafeString(input.organizationName).toUpperCase(),
    `PEMBUKUAN UMUM ${asExcelSafeString(input.kitchenName).toUpperCase()} (PJ ${asExcelSafeString(input.pjName).toUpperCase()})`,
    getPeriodUpperLabel(input.year, input.month),
  ];

  for (let r = 1; r <= 3; r += 1) {
    const row = ws.getRow(r);
    row.getCell(1).value = titleLines[r - 1]!;
    for (let c = 1; c <= 11; c += 1) {
      const cell = row.getCell(c);
      cell.font = FONT_BOLD;
      cell.alignment = { horizontal: 'center' };
    }
  }

  // 2. Pastikan baris 5 adalah header berlatar kuning dan bergaris tipis
  const headerRow = ws.getRow(5);
  for (let c = 1; c <= 11; c += 1) {
    const cell = headerRow.getCell(c);
    cell.value = PLOMBOKAN_HEADERS[c - 1]!;
    cell.font = FONT_BOLD;
    cell.fill = YELLOW_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = THIN_BORDER;
    if (c >= 7 && c <= 9) {
      cell.numFmt = PLOMBOKAN_RUPIAH_NUM_FMT;
    }
  }

  // 3. Hitung buku kas dari transaksi yang berstatus 'posted'
  const postedEntries = input.entries.filter((e) => e.status === 'posted');
  const { rows: computedRows, summary } = computePeriodLedger(
    input.openingBalance,
    postedEntries,
  );

  // 4. Baris 6 (NO = 1): PERPINDAHAN SALDO <BULAN SEBELUMNYA>
  const row6 = ws.getRow(6);
  row6.getCell(1).value = 1;
  row6.getCell(2).value = new Date(Date.UTC(input.year, input.month - 1, 1));
  row6.getCell(2).numFmt = PLOMBOKAN_DATE_NUM_FMT;
  row6.getCell(2).alignment = { horizontal: 'left' };

  const transferTitle = `PERPINDAHAN SALDO ${getPreviousMonthLabel(input.year, input.month)}`;
  row6.getCell(4).value = transferTitle;
  ws.mergeCells(6, 4, 6, 6);
  for (let c = 4; c <= 6; c += 1) {
    row6.getCell(c).alignment = { horizontal: 'center' };
  }

  row6.getCell(7).value = Number(input.openingBalance);
  row6.getCell(7).numFmt = PLOMBOKAN_RUPIAH_NUM_FMT;
  row6.getCell(8).value = null;
  row6.getCell(8).numFmt = PLOMBOKAN_RUPIAH_NUM_FMT;
  // Satu-satunya kolom rumus adalah kolom I (TOTAL)
  row6.getCell(9).value = {
    formula: 'G6',
    result: Number(input.openingBalance),
  };
  row6.getCell(9).numFmt = PLOMBOKAN_RUPIAH_NUM_FMT;
  row6.getCell(10).value = '';
  row6.getCell(11).value = '';

  for (let c = 1; c <= 11; c += 1) {
    const cell = row6.getCell(c);
    cell.font = FONT_REGULAR;
    cell.border = THIN_BORDER;
  }

  // 5. Baris 7..N (NO = 2..): Transaksi buku kas
  let currentExcelRow = 6;
  for (let idx = 0; idx < computedRows.length; idx += 1) {
    const item = computedRows[idx]!;
    currentExcelRow = 7 + idx;
    const prevExcelRow = currentExcelRow - 1;
    const row = ws.getRow(currentExcelRow);

    const recipientLabel =
      item.counterpartyAccount && item.counterpartyName
        ? `${item.counterpartyAccount} a.n ${item.counterpartyName}`
        : item.counterpartyName
          ? item.counterpartyName
          : (item.counterpartyAccount ?? '');

    row.getCell(1).value = idx + 2; // NO (dimulai dari 2 setelah PERPINDAHAN SALDO)
    row.getCell(2).value = parseIsoDateUtc(item.txDate);
    row.getCell(2).numFmt = PLOMBOKAN_DATE_NUM_FMT;
    row.getCell(2).alignment = { horizontal: 'left' };

    // Seluruh nilai teks pengguna ditulis sebagai string polos (SECURITY.md S-13)
    const refCell = row.getCell(3);
    refCell.value = asExcelSafeString(item.referenceNo);
    refCell.numFmt = '@';
    refCell.alignment = { horizontal: 'left' };

    const descCell = row.getCell(4);
    descCell.value = asExcelSafeString(item.description);
    descCell.numFmt = '@';

    const recCell = row.getCell(5);
    recCell.value = asExcelSafeString(recipientLabel);
    recCell.numFmt = '@';

    const bankCell = row.getCell(6);
    bankCell.value = asExcelSafeString(item.counterpartyBank);
    bankCell.numFmt = '@';

    const debitCell = row.getCell(7);
    debitCell.value = item.debit > 0n ? Number(item.debit) : null;
    debitCell.numFmt = PLOMBOKAN_RUPIAH_NUM_FMT;

    const creditCell = row.getCell(8);
    creditCell.value = item.credit > 0n ? Number(item.credit) : null;
    creditCell.numFmt = PLOMBOKAN_RUPIAH_NUM_FMT;

    // Rumus berantai persis seperti berkas sumber: =IF(G7=H7,"",I6+G7-H7)
    const totalCell = row.getCell(9);
    totalCell.value = {
      formula: `IF(G${currentExcelRow}=H${currentExcelRow},"",I${prevExcelRow}+G${currentExcelRow}-H${currentExcelRow})`,
      result: Number(item.runningBalance),
    };
    totalCell.numFmt = PLOMBOKAN_RUPIAH_NUM_FMT;

    const noteCell = row.getCell(10);
    noteCell.value = asExcelSafeString(item.note);
    noteCell.numFmt = '@';

    // DOKUMENTASI NOTA selalu dikosongkan (PRD FR-F5.1)
    const docCell = row.getCell(11);
    docCell.value = '';
    docCell.numFmt = '@';

    for (let c = 1; c <= 11; c += 1) {
      const cell = row.getCell(c);
      cell.font = FONT_REGULAR;
      cell.border = THIN_BORDER;
    }
  }

  const lastDataRowNumber = currentExcelRow;
  const sisaUangRowNumber = lastDataRowNumber + 1;

  // 6. Baris SISA UANG (A<sisa>:H<sisa> digabung, kuning, bold; I<sisa> rumus =I<lastDataRow>)
  const sisaRow = ws.getRow(sisaUangRowNumber);
  sisaRow.getCell(1).value = 'SISA UANG';
  ws.mergeCells(sisaUangRowNumber, 1, sisaUangRowNumber, 8);
  for (let c = 1; c <= 8; c += 1) {
    const cell = sisaRow.getCell(c);
    cell.font = FONT_BOLD;
    cell.fill = YELLOW_FILL;
    cell.alignment = { horizontal: 'center' };
    cell.border = THIN_BORDER;
  }

  const sisaValueCell = sisaRow.getCell(9);
  sisaValueCell.value = {
    formula: `I${lastDataRowNumber}`,
    result: Number(summary.closingBalance),
  };
  sisaValueCell.font = FONT_REGULAR;
  sisaValueCell.numFmt = PLOMBOKAN_RUPIAH_NUM_FMT;
  sisaValueCell.border = THIN_BORDER;

  for (let c = 10; c <= 11; c += 1) {
    const cell = sisaRow.getCell(c);
    cell.font = FONT_REGULAR;
    cell.border = THIN_BORDER;
  }

  // 7. Catatan kaki biaya admin & legenda sesuai berkas sumber (baris sisaUangRow + 3..6)
  const adminFeeFormatted = (input.adminFeeDefault ?? 6_500n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const noteRow1 = ws.getRow(sisaUangRowNumber + 3);
  noteRow1.getCell(1).value = `*Biaya admin bank : ${adminFeeFormatted}`;
  noteRow1.getCell(1).font = FONT_BOLD;

  const noteRow2 = ws.getRow(sisaUangRowNumber + 4);
  noteRow2.getCell(1).value = 'DONE';
  noteRow2.getCell(1).font = FONT_REGULAR;

  const noteRow3 = ws.getRow(sisaUangRowNumber + 5);
  noteRow3.getCell(1).value = 'ON PROGRESS';
  noteRow3.getCell(1).font = FONT_REGULAR;

  const noteRow4 = ws.getRow(sisaUangRowNumber + 6);
  noteRow4.getCell(1).value = '-';
  noteRow4.getCell(1).font = FONT_REGULAR;

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    summary,
    sisaUangRowNumber,
    lastDataRowNumber,
  };
}

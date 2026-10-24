/**
 * Satu-satunya modul pemformatan Rupiah dan tanggal WIB (AGENTS.md bagian 6 & DESIGN.md 3.2).
 * Dilarang memformat nominal atau tanggal secara manual di komponen.
 * Seluruh fungsi di modul ini adalah fungsi murni.
 */

const WIB_TIMEZONE = 'Asia/Jakarta';

const INDONESIAN_SHORT_MONTHS: readonly string[] = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const INDONESIAN_FULL_MONTHS: readonly string[] = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

/**
 * Memformat nilai bigint menjadi string angka ribuan bertitik tanpa awalan "Rp"
 * (mis. 1234567n -> "1.234.567", -6500n -> "−6.500").
 */
export function formatRupiahNumber(amount: bigint): string {
  const isNegative = amount < 0n;
  const absStr = (isNegative ? -amount : amount).toString();
  const formatted = absStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return isNegative ? `\u2212${formatted}` : formatted;
}

/**
 * Memformat nilai bigint menjadi string Rupiah lengkap sesuai DESIGN.md 3.2
 * (mis. 1234567n -> "Rp 1.234.567", -50000n -> "−Rp 50.000").
 */
export function formatRupiah(amount: bigint): string {
  const isNegative = amount < 0n;
  const absFormatted = formatRupiahNumber(isNegative ? -amount : amount);
  return isNegative ? `\u2212Rp ${absFormatted}` : `Rp ${absFormatted}`;
}

/**
 * Memformat nilai sel DEBIT/KREDIT tabel buku kas: nilai 0n dikosongkan ("")
 * sesuai DESIGN.md 5.3 ("Nilai nol dikosongkan seperti pada Excel sumber").
 */
export function formatLedgerCellAmount(amount: bigint): string {
  if (amount === 0n) return '';
  return formatRupiah(amount);
}

/**
 * Memformat tanggal berformat 'YYYY-MM-DD' menjadi '02 Mar 2026' secara deterministik.
 * Menggunakan tabel bulan eksplisit agar konsisten lintas runtime Node.js dan browser (PV-10).
 */
export function formatTxDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
  if (!match) {
    throw new Error(`Format tanggal transaksi tidak valid: ${isoDate}`);
  }
  const year = match[1];
  const monthIndex = Number.parseInt(match[2] ?? '0', 10) - 1;
  const day = match[3];
  const monthName = INDONESIAN_SHORT_MONTHS[monthIndex];
  if (!monthName || !year || !day) {
    throw new Error(`Bulan tanggal transaksi di luar rentang: ${isoDate}`);
  }
  return `${day} ${monthName} ${year}`;
}

/**
 * Memformat periode (tahun, bulan 1..12) menjadi nama periode bahasa Indonesia
 * (mis. (2026, 3) -> "Maret 2026").
 */
export function formatPeriodLabel(year: number, month: number): string {
  const monthName = INDONESIAN_FULL_MONTHS[month - 1];
  if (!monthName || !Number.isInteger(year)) {
    throw new Error(`Periode tidak valid: ${year}-${month}`);
  }
  return `${monthName} ${year}`;
}

/**
 * Memformat waktu ISO UTC menjadi tampilan tanggal dan jam WIB ('02 Mar 2026, 14.30 WIB').
 */
export function formatTimestampWib(isoUtc: string | Date): string {
  const date = typeof isoUtc === 'string' ? new Date(isoUtc) : isoUtc;
  if (Number.isNaN(date.getTime())) {
    throw new Error('Timestamp tidak valid');
  }

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: WIB_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  const isoDateWib = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
  return `${formatTxDate(isoDateWib)}, ${getPart('hour')}.${getPart('minute')} WIB`;
}

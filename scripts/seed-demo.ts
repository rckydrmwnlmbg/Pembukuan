import { generateDemoDataset } from '../src/lib/demo-data';
import { formatRupiah } from '../src/lib/format';

/**
 * Pengisi data demo sintetis (SKILLS.md bagian 8: demo-data-seeder).
 * Aturan keras: menolak berjalan bila APP_ENV=production.
 */

if (process.env.APP_ENV === 'production') {
  console.error(
    'DITOLAK: seed:demo dilarang dijalankan pada lingkungan production (SKILLS.md bagian 8).',
  );
  process.exit(1);
}

const dataset = generateDemoDataset();

console.log(`Organisasi Demo: ${dataset.organization.name}`);
for (const k of dataset.kitchens) {
  console.log(
    `- ${k.name} (${k.code}) | Rekening: ****${k.accountNoLast4} | Transaksi: ${k.entries.length} | Saldo Akhir: ${formatRupiah(k.summary.closingBalance)} | Status: ${k.periodStatus}`,
  );
}
console.log(
  `seed:demo selesai memverifikasi ${dataset.kitchens.length} dapur sintetis dan ${dataset.uploads.length} unggahan draf/manual.`,
);

/**
 * Pengisi data demo sintetis (SKILLS.md bagian 8: demo-data-seeder).
 * Aturan keras: menolak berjalan bila APP_ENV=production.
 */

if (process.env.APP_ENV === 'production') {
  console.error('DITOLAK: seed:demo dilarang dijalankan pada lingkungan production (SKILLS.md bagian 8).');
  process.exit(1);
}

console.log('seed:demo — kerangka M0 siap (APP_ENV bukan production). Data sintetis 5 dapur akan diisi pada Milestone M1.');

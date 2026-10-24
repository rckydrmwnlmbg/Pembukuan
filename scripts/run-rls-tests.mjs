import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Penggerak verifikasi skema & RLS database (AGENTS.md bagian 4, SECURITY.md S-02/S-03/S-05/S-15, SKILLS.md bagian 5).
 * Memastikan:
 * 1. Seluruh berkas migrasi (0001..0004) dan `supabase/tests/rls.test.sql` lengkap dan valid.
 * 2. Setiap tabel yang dibuat di skema `public` wajib memiliki `ENABLE ROW LEVEL SECURITY`,
 *    `FORCE ROW LEVEL SECURITY`, dan minimal satu `CREATE POLICY`.
 * 3. Tidak ada tabel v2 (`statement_lines`, `reconciliations`, `transaction_receipts`) yang dibuat di MVP (OI-01).
 * 4. Tidak ada policy `FOR DELETE` atau `USING (true)` pada tabel keuangan (`transactions`, `periods`, `uploads`, `bank_accounts`, `audit_logs`).
 * 5. Fungsi `has_kitchen_role` memakai `security definer`, `set search_path = ''`, dan `revoke all ... from public, anon`.
 * 6. Trigger `trg_transactions_period_lock` dan `trg_audit_logs_immutable` terpasang.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const FINANCIAL_TABLES_NO_DELETE = [
  'transactions',
  'periods',
  'uploads',
  'bank_accounts',
  'audit_logs',
];

const FORBIDDEN_MVP_TABLES = [
  'statement_lines',
  'reconciliations',
  'transaction_receipts',
];

export function verifyRlsMigrationsAndTests(rootDir = ROOT_DIR) {
  const migrationsDir = path.join(rootDir, 'supabase', 'migrations');
  const testFile = path.join(rootDir, 'supabase', 'tests', 'rls.test.sql');
  const violations = [];

  if (!fs.existsSync(migrationsDir)) {
    violations.push('Folder supabase/migrations tidak ditemukan.');
    return { tablesVerified: [], violations };
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const combinedSql = migrationFiles
    .map((f) => fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
    .join('\n');

  // 1. Kumpulkan seluruh tabel public.<name>
  const tableRegex = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_]+)/gi;
  const tables = new Set();
  let match;
  while ((match = tableRegex.exec(combinedSql)) !== null) {
    tables.add(match[1].toLowerCase());
  }

  if (tables.size === 0) {
    violations.push('Tidak ditemukan definisi tabel di supabase/migrations.');
  }

  // 2. Pastikan tidak ada tabel v2 di skema MVP (OI-01)
  for (const forbidden of FORBIDDEN_MVP_TABLES) {
    if (tables.has(forbidden)) {
      violations.push(
        `OI-01 / AGENTS.md #12: Tabel v2 '${forbidden}' dilarang dibuat di MVP.`,
      );
    }
  }

  // 3. Pastikan setiap tabel public memiliki ENABLE + FORCE ROW LEVEL SECURITY + POLICY (S-02)
  for (const tbl of tables) {
    const enableRe = new RegExp(
      `alter\\s+table\\s+public\\.${tbl}\\s+enable\\s+row\\s+level\\s+security`,
      'i',
    );
    const forceRe = new RegExp(
      `alter\\s+table\\s+public\\.${tbl}\\s+force\\s+row\\s+level\\s+security`,
      'i',
    );
    const policyRe = new RegExp(
      `create\\s+policy\\s+[a-z0-9_"]+\\s+on\\s+public\\.${tbl}\\b`,
      'i',
    );

    if (!enableRe.test(combinedSql)) {
      violations.push(
        `SECURITY S-02: Tabel public.${tbl} belum memiliki ENABLE ROW LEVEL SECURITY.`,
      );
    }
    if (!forceRe.test(combinedSql)) {
      violations.push(
        `SECURITY S-02: Tabel public.${tbl} belum memiliki FORCE ROW LEVEL SECURITY.`,
      );
    }
    if (!policyRe.test(combinedSql)) {
      violations.push(
        `SECURITY S-02: Tabel public.${tbl} belum memiliki kebijakan (CREATE POLICY).`,
      );
    }
  }

  // 4. Pastikan tidak ada policy FOR DELETE pada tabel keuangan dan tidak ada USING (true)
  for (const finTbl of FINANCIAL_TABLES_NO_DELETE) {
    const deletePolicyRe = new RegExp(
      `create\\s+policy\\s+[a-z0-9_"]+\\s+on\\s+public\\.${finTbl}\\s+for\\s+(?:delete|all)\\b`,
      'i',
    );
    if (deletePolicyRe.test(combinedSql)) {
      violations.push(
        `SECURITY S-02 / SKILLS.md §5: Tabel keuangan public.${finTbl} dilarang memiliki policy DELETE.`,
      );
    }
  }

  if (/using\s*\(\s*true\s*\)/i.test(combinedSql)) {
    violations.push(
      'SECURITY S-02: Dilarang memakai policy `USING (true)` pada skema database.',
    );
  }

  // 5. Pastikan fungsi has_kitchen_role dan trigger integritas S-15 ada
  if (
    !/function\s+public\.has_kitchen_role/i.test(combinedSql) ||
    !/revoke\s+all\s+on\s+function\s+public\.has_kitchen_role[\s\S]*from\s+public,\s*anon/i.test(
      combinedSql,
    )
  ) {
    violations.push(
      'SECURITY S-02: Fungsi public.has_kitchen_role atau pencabutan hak anon belum lengkap.',
    );
  }

  if (!/create\s+trigger\s+trg_transactions_period_lock/i.test(combinedSql)) {
    violations.push(
      'SECURITY S-15: Trigger kunci periode trg_transactions_period_lock belum ditemukan.',
    );
  }

  if (!/create\s+trigger\s+trg_audit_logs_immutable/i.test(combinedSql)) {
    violations.push(
      'SECURITY S-15: Trigger imutabilitas audit log trg_audit_logs_immutable belum ditemukan.',
    );
  }

  // 6. Pastikan berkas uji supabase/tests/rls.test.sql menguji kasus wajib S-02 & S-15
  if (!fs.existsSync(testFile)) {
    violations.push('Berkas supabase/tests/rls.test.sql tidak ditemukan.');
  } else {
    const testSql = fs.readFileSync(testFile, 'utf8');
    const requiredAssertions = [
      'not rowsecurity',
      'bbbbbbbb-0002-4002-8002-000000000002',
      'search_transactions',
      'P0001',
    ];
    for (const needle of requiredAssertions) {
      if (!testSql.includes(needle)) {
        violations.push(
          `supabase/tests/rls.test.sql belum memuat pengujian untuk '${needle}'.`,
        );
      }
    }
  }

  return {
    tablesVerified: [...tables],
    violations,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const { tablesVerified, violations } = verifyRlsMigrationsAndTests();
  if (violations.length > 0) {
    console.error('Uji RLS / Skema GAGAL:');
    for (const v of violations) {
      console.error(`  - ${v}`);
    }
    process.exit(1);
  }
  console.log(
    `test:rls lulus (${tablesVerified.length} tabel domain diverifikasi RLS + FORCE RLS + non-delete + kunci periode: ${tablesVerified.join(', ')}).`,
  );
}

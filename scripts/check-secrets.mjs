import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pemindai rahasia & kebocoran bundel klien (SECURITY.md S-04).
 * 1. Memastikan tidak ada kunci rahasia ter-hardcode di kode sumber.
 * 2. Memastikan tidak ada variabel rahasia berawalan NEXT_PUBLIC_ selain URL dan ANON_KEY.
 * 3. Bila folder `.next/static` ada, memastikan tidak ada string `SUPABASE_SERVICE_ROLE_KEY`
 *    atau `ANTHROPIC_API_KEY` yang terbawa ke bundel klien.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const SECRET_PATTERNS = [
  { name: 'Anthropic API Key', regex: /sk-ant-[a-zA-Z0-9\-_]{20,}/ },
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'Supabase Secret Key Literal', regex: /sbp_[a-f0-9]{30,}/ },
  {
    name: 'Forbidden NEXT_PUBLIC_ Secret Prefix',
    regex: /NEXT_PUBLIC_(?:SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|FIELD_ENCRYPTION_KEY|FIELD_HASH_KEY|UPSTASH_REDIS)/,
  },
];

const BUNDLE_FORBIDDEN_STRINGS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANTHROPIC_API_KEY',
  'FIELD_ENCRYPTION_KEY',
  'FIELD_HASH_KEY',
];

function walkFiles(dir, filterFn) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', '.next', 'coverage'].includes(entry.name)) continue;
      files.push(...walkFiles(full, filterFn));
    } else if (entry.isFile() && filterFn(full)) {
      files.push(full);
    }
  }
  return files;
}

export function scanSecrets(rootDir = ROOT_DIR) {
  const violations = [];
  const sourceFiles = walkFiles(
    rootDir,
    (f) => /\.(ts|tsx|js|mjs|json|sql|yml|yaml)$/.test(f) && !f.endsWith('package-lock.json') && !f.endsWith('check-secrets.mjs') && !f.endsWith('security-scripts.test.ts'),
  );

  for (const filePath of sourceFiles) {
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(content)) {
        violations.push({
          file: relPath,
          reason: `Terdeteksi pola rahasia: ${pattern.name}`,
        });
      }
    }
  }

  const nextStaticDir = path.join(rootDir, '.next', 'static');
  if (fs.existsSync(nextStaticDir)) {
    const staticFiles = walkFiles(nextStaticDir, () => true);
    for (const filePath of staticFiles) {
      const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
      const content = fs.readFileSync(filePath, 'utf8');
      for (const forbidden of BUNDLE_FORBIDDEN_STRINGS) {
        if (content.includes(forbidden)) {
          violations.push({
            file: relPath,
            reason: `Bundel klien memuat identifier rahasia: ${forbidden}`,
          });
        }
      }
    }
  }

  return { scannedCount: sourceFiles.length, violations };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const { scannedCount, violations } = scanSecrets();
  if (violations.length > 0) {
    console.error('SECURITY S-04: Ditemukan potensi kebocoran rahasia:');
    for (const v of violations) {
      console.error(`  - ${v.file}: ${v.reason}`);
    }
    process.exit(1);
  }
  console.log(`check:secrets lulus (${scannedCount} berkas diperiksa).`);
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pemindai rute API (SECURITY.md S-07).
 * Memastikan seluruh berkas `src/app/api/<path>/route.ts` memakai pembungkus
 * `kitchenRoute` atau `userRoute`, kecuali daftar pengecualian tertulis (`/api/health`).
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

export const ALLOWED_UNWRAPPED_ROUTES = new Set([
  'src/app/api/health/route.ts',
]);

function collectRouteFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectRouteFiles(fullPath));
    } else if (entry.isFile() && entry.name === 'route.ts') {
      results.push(fullPath);
    }
  }
  return results;
}

export function scanApiRoutes(rootDir = ROOT_DIR) {
  const apiDir = path.join(rootDir, 'src', 'app', 'api');
  const routeFiles = collectRouteFiles(apiDir);
  const violations = [];

  for (const filePath of routeFiles) {
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    if (ALLOWED_UNWRAPPED_ROUTES.has(relPath)) {
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const usesWrapper = /\b(kitchenRoute|userRoute)\s*\(/.test(content);
    const hasRawAsyncHandler =
      /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/.test(
        content,
      );

    if (!usesWrapper || hasRawAsyncHandler) {
      violations.push({
        file: relPath,
        reason: !usesWrapper
          ? 'Tidak memakai pembungkus kitchenRoute() atau userRoute()'
          : 'Mendeklarasikan export async function HTTP langsung tanpa pembungkus',
      });
    }
  }

  return { scannedCount: routeFiles.length, violations };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const { scannedCount, violations } = scanApiRoutes();
  if (violations.length > 0) {
    console.error('SECURITY S-07: Ditemukan route API tanpa pembungkus otorisasi:');
    for (const v of violations) {
      console.error(`  - ${v.file}: ${v.reason}`);
    }
    process.exit(1);
  }
  console.log(`check:routes lulus (${scannedCount} berkas route.ts diperiksa).`);
}

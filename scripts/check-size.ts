import { gzipSync } from "bun";
import { brotliCompressSync } from "node:zlib";
import { rmSync, mkdirSync } from "node:fs";

const BUDGET_GZIP_KB = 120;
const BUDGET_BROTLI_KB = 100;
const DIST = "./dist";

// Clean + build
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const result = await Bun.build({
  entrypoints: ["./src/index.ts"],
  outdir: DIST,
  target: "browser",
  minify: true,
  sourcemap: "linked",
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

let totalGzip = 0;
let totalBrotli = 0;

for (const output of result.outputs) {
  if (!output.path.endsWith(".js")) continue;
  const blob = await output.arrayBuffer();
  const bytes = new Uint8Array(blob);
  totalGzip += gzipSync(bytes).length;
  totalBrotli += brotliCompressSync(bytes).length;
}

const totalGzipKB = totalGzip / 1024;
const totalBrotliKB = totalBrotli / 1024;

console.log(`\n  Gzip:   ${totalGzipKB.toFixed(1)} KB (budget: ${BUDGET_GZIP_KB} KB)`);
console.log(`  Brotli: ${totalBrotliKB.toFixed(1)} KB (budget: ${BUDGET_BROTLI_KB} KB)\n`);

let failed = false;

if (totalGzipKB > BUDGET_GZIP_KB) {
  console.error(`FAIL: Gzip exceeds budget by ${(totalGzipKB - BUDGET_GZIP_KB).toFixed(1)} KB`);
  failed = true;
} else {
  console.log(`PASS: Gzip ${(BUDGET_GZIP_KB - totalGzipKB).toFixed(1)} KB under budget`);
}

if (totalBrotliKB > BUDGET_BROTLI_KB) {
  console.error(`FAIL: Brotli exceeds budget by ${(totalBrotliKB - BUDGET_BROTLI_KB).toFixed(1)} KB`);
  failed = true;
} else {
  console.log(`PASS: Brotli ${(BUDGET_BROTLI_KB - totalBrotliKB).toFixed(1)} KB under budget`);
}

if (failed) process.exit(1);

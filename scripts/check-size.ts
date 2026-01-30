import { gzipSync } from "bun";
import { rmSync, mkdirSync } from "node:fs";

const BUDGET_GZIP_KB = 120;
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

for (const output of result.outputs) {
  if (!output.path.endsWith(".js")) continue;
  const blob = await output.arrayBuffer();
  totalGzip += gzipSync(new Uint8Array(blob)).length;
}

const totalGzipKB = totalGzip / 1024;

console.log(`\nTotal gzip size: ${totalGzipKB.toFixed(1)} KB (budget: ${BUDGET_GZIP_KB} KB)\n`);

if (totalGzipKB > BUDGET_GZIP_KB) {
  console.error(`FAIL: Bundle exceeds size budget by ${(totalGzipKB - BUDGET_GZIP_KB).toFixed(1)} KB`);
  process.exit(1);
} else {
  const headroom = BUDGET_GZIP_KB - totalGzipKB;
  console.log(`PASS: ${headroom.toFixed(1)} KB under budget`);
}

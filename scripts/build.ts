import { gzipSync } from "bun";
import { brotliCompressSync } from "node:zlib";
import { rmSync, mkdirSync } from "node:fs";

const DIST = "./dist";

// Clean output
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

// Write metafile
const meta = {
  outputs: result.outputs.map((o) => ({
    path: o.path,
    size: o.size,
    kind: o.kind,
    loader: o.loader,
  })),
};
await Bun.write(`${DIST}/meta.json`, JSON.stringify(meta, null, 2));

// Size table
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

console.log("\nBuild output:\n");
console.log("  File".padEnd(40) + "Raw".padStart(12) + "Gzip".padStart(12) + "Brotli".padStart(12));
console.log("  " + "─".repeat(72));

let totalRaw = 0;
let totalGzip = 0;
let totalBrotli = 0;

for (const output of result.outputs) {
  const name = output.path.replace(process.cwd() + "/", "");
  const raw = output.size;
  const blob = await output.arrayBuffer();
  const bytes = new Uint8Array(blob);
  const gzip = gzipSync(bytes).length;
  const brotli = brotliCompressSync(bytes).length;
  totalRaw += raw;
  totalGzip += gzip;
  totalBrotli += brotli;
  console.log(`  ${name.padEnd(38)}${formatSize(raw).padStart(12)}${formatSize(gzip).padStart(12)}${formatSize(brotli).padStart(12)}`);
}

console.log("  " + "─".repeat(72));
console.log(`  ${"Total".padEnd(38)}${formatSize(totalRaw).padStart(12)}${formatSize(totalGzip).padStart(12)}${formatSize(totalBrotli).padStart(12)}`);
console.log();

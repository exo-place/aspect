import { readFileSync, existsSync } from "node:fs";

const META_PATH = "./dist/meta.json";

if (!existsSync(META_PATH)) {
  console.error("No dist/meta.json found. Run `bun run build` first.");
  process.exit(1);
}

const meta = JSON.parse(readFileSync(META_PATH, "utf-8"));
const totalSize = meta.outputs
  .filter((o: { path: string }) => o.path.endsWith(".js"))
  .reduce((sum: number, o: { size: number }) => sum + o.size, 0);

console.log("\nBundle analysis:\n");
console.log(`  Total JS size: ${(totalSize / 1024).toFixed(1)} KB\n`);

// Parse sourcemap to find module contributions
const mapPath = meta.outputs.find((o: { path: string }) => o.path.endsWith(".js.map"))?.path;
if (!mapPath) {
  console.log("  No sourcemap found for detailed analysis.");
  process.exit(0);
}

interface SourceMap {
  sources: string[];
  sourcesContent: (string | null)[];
}

const sourcemap: SourceMap = JSON.parse(readFileSync(mapPath, "utf-8"));
const { sources, sourcesContent } = sourcemap;

// Aggregate source sizes by package
const pkgSizes = new Map<string, number>();

for (let i = 0; i < sources.length; i++) {
  const source = sources[i];
  const content = sourcesContent?.[i];
  const size = content ? new TextEncoder().encode(content).length : 0;

  // Determine package name
  const nmMatch = source.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/);
  const pkg = nmMatch ? nmMatch[1] : "(app)";

  pkgSizes.set(pkg, (pkgSizes.get(pkg) || 0) + size);
}

const sorted = [...pkgSizes.entries()].sort((a, b) => b[1] - a[1]);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

console.log("  Source contributions (pre-minification):\n");
console.log("  Package".padEnd(40) + "Source size".padStart(14));
console.log("  " + "─".repeat(50));

for (const [pkg, size] of sorted) {
  console.log(`  ${pkg.padEnd(38)}${formatSize(size).padStart(14)}`);
}
console.log();

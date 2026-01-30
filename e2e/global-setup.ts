import { rmSync, mkdirSync } from "fs";

export default function globalSetup() {
  const dataDir = "/tmp/aspect-e2e-data";
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // directory may not exist
  }
  mkdirSync(dataDir, { recursive: true });
}

/**
 * After `next build` with `output: "standalone"`, copies the files that the
 * standalone server needs to find at runtime into the standalone directory.
 *
 * Run automatically via the "postbuild" npm script.
 */
import { cpSync, existsSync, rmSync } from "fs";
import { join } from "path";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");
const nextStaticSrc = join(root, ".next", "static");
const nextStaticDst = join(standaloneDir, ".next", "static");
const publicSrc = join(root, "public");
const publicDst = join(standaloneDir, "public");

if (!existsSync(standaloneDir)) {
  console.error(
    "ERROR: .next/standalone not found. Make sure next.config.ts has output: 'standalone'."
  );
  process.exit(1);
}

// .next/static → .next/standalone/.next/static
if (existsSync(nextStaticSrc)) {
  if (existsSync(nextStaticDst)) rmSync(nextStaticDst, { recursive: true });
  cpSync(nextStaticSrc, nextStaticDst, { recursive: true });
  console.log("✓ Copied .next/static  → .next/standalone/.next/static");
}

// public → .next/standalone/public
if (existsSync(publicSrc)) {
  if (existsSync(publicDst)) rmSync(publicDst, { recursive: true });
  cpSync(publicSrc, publicDst, { recursive: true });
  console.log("✓ Copied public        → .next/standalone/public");
}

console.log("✓ Standalone directory is ready.");

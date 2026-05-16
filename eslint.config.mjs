import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "electron/dist/**",
    "dist-electron/**",
    "next-env.d.ts",
    // Mobile app has its own ESLint config and toolchain
    "mobile/**",
    // Monorepo packages have their own lint rules
    "packages/**",
  ]),
]);

export default eslintConfig;

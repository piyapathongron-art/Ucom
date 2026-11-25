import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // ADR 0033: text sizes come from the type scale (text-xs … text-3xl), not arbitrary values like
  // text-[13.5px]. A warning, so the existing uses can move over page by page during the rollout.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/(^|\\s|:)text-\\[[0-9.]+(px|rem|em)\\]/]",
          message: "Use a type-scale size (text-xs … text-3xl) instead of an arbitrary text-[…] value (ADR 0033).",
        },
        {
          selector: "TemplateElement[value.raw=/(^|\\s|:)text-\\[[0-9.]+(px|rem|em)\\]/]",
          message: "Use a type-scale size (text-xs … text-3xl) instead of an arbitrary text-[…] value (ADR 0033).",
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;

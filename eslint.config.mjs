import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ESLint config — re-enabled most rules that were previously disabled.
// We kept `no-explicit-any` and `no-non-null-assertion` as warnings (not
// errors) because the codebase has a lot of `any` types that would be too
// noisy to fix all at once. They'll show in dev but won't fail the build.
const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    // ===== TypeScript rules =====
    // `any` is permitted but discouraged — too many existing call sites to fix
    // in one pass. Reported as warning.
    "@typescript-eslint/no-explicit-any": "warn",
    // Unused vars must be prefixed with _ or removed.
    "@typescript-eslint/no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    }],
    "@typescript-eslint/no-non-null-assertion": "warn",
    "@typescript-eslint/ban-ts-comment": "warn",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",

    // ===== React rules =====
    // exhaustive-deps is the #1 source of subtle bugs — report as warning.
    "react-hooks/exhaustive-deps": "warn",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    // ===== Next.js rules =====
    "@next/next/no-img-element": "off",  // POS uses emoji + few images; OK
    "@next/next/no-html-link-for-pages": "off",

    // ===== General JavaScript rules =====
    "prefer-const": "warn",
    "no-unused-vars": "off",  // handled by @typescript-eslint/no-unused-vars
    "no-console": "off",  // we use console for logging (TODO: replace with pino)
    "no-debugger": "error",  // debugger statements should never ship
    "no-empty": ["warn", { allowEmptyCatch: true }],  // allow empty catch but warn
    "no-irregular-whitespace": "warn",
    "no-case-declarations": "off",
    "no-fallthrough": "warn",
    "no-mixed-spaces-and-tabs": "warn",
    "no-redeclare": "warn",
    "no-undef": "error",
    "no-unreachable": "warn",
    "no-useless-escape": "warn",
    // Security-focused rules
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
  },
}, {
  ignores: [
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "examples/**",
    "skills/**",
    "scripts/**",  // legacy seed scripts use CommonJS; don't lint
    "prisma/migrations/**",  // generated SQL
  ],
}];

export default eslintConfig;

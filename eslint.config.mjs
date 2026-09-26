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
    "next-env.d.ts",
    // The Expo app and MCP server have their own toolchains.
    "mobile/**",
    "mcp/**",
    // Snapshots and throwaway probe scripts. Gitignored, so nothing here ships —
    // but eslint was still linting it, which meant one scratch file failed the
    // zero-warning gate and the fix looked like a lint problem in the product.
    "tmp/**",
  ]),
  {
    // Treat a leading underscore as "intentionally unused" (params kept for
    // signature/compatibility, ignored destructured siblings, unused catch vars).
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;

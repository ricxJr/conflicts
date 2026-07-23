import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/target/**",
      "**/node_modules/**",
      "scripts/gen-icon.mjs",
      "scripts/bump-minor-version.mjs",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["warn", { fixStyle: "inline-type-imports" }],
    },
  },
  {
    files: ["**/*.tsx"],
    languageOptions: {
      globals: { window: "readonly", document: "readonly" },
    },
  },
);

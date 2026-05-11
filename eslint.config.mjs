// eslint.config.mjs
import { FlatCompat } from "@eslint/eslintrc";
import nextPlugin from "@next/eslint-plugin-next";
import js from "@eslint/js";

const compat = new FlatCompat();

export default [
  {
    plugins: {
      "@next/next": nextPlugin,
    },
  },
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      // You can add your own custom rules here
    },
  },
  {
    // If you are using TypeScript, add this section
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
  },
];
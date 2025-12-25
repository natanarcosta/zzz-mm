import js from "@eslint/js";
import globals from "globals";

export default [
  // ============================
  // MAIN / PRELOAD (Electron)
  // ============================
  {
    files: ["main.js", "preload.js", "electron/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-empty": "warn",
    },
  },

  // ============================
  // GENERAL JS (optional)
  // ============================
  {
    files: ["**/*.js"],
    ignores: ["dist/**", "node_modules/**"],
    rules: {
      ...js.configs.recommended.rules,
    },
  },
];

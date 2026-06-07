import js from "@eslint/js";
import vue from "eslint-plugin-vue";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "node_modules/",
      "dist/",
      "docs/",
      "coverage/",
      "**/coverage/",
      "*.json",
      ".env",
      "aiagent-be/logs/",
      "aiagent-web-panel/dist/",
    ],
  },
  js.configs.recommended,
  ...vue.configs["flat/recommended"],
  {
    files: ["aiagent-be/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-empty": "off",
    },
  },
  {
    files: ["aiagent-web-panel/**/*.{js,vue}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-empty": "off",
      "no-control-regex": "off",
      "vue/multi-word-component-names": "off",
      "vue/no-v-html": "off",
      "vue/require-default-prop": "off",
      "vue/max-attributes-per-line": "off",
      "vue/html-self-closing": "off",
      "vue/singleline-html-element-content-newline": "off",
      "vue/html-closing-bracket-newline": "off",
      "vue/html-indent": "off",
      "vue/no-mutating-props": "off",
    },
  },
  prettier,
];

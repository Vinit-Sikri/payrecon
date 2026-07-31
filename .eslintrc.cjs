module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended", "prettier"],
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: ["dist/", "node_modules/", "**/generated/**"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
  },
  overrides: [
    {
      files: ["services/dashboard/**/*.tsx", "services/dashboard/**/*.ts"],
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
      plugins: ["react", "react-hooks"],
      extends: ["plugin:react/recommended", "plugin:react-hooks/recommended"],
      env: {
        browser: true,
        node: false,
      },
      settings: {
        react: { version: "18.3" },
      },
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
      },
    },
  ],
};

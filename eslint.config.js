import eslint from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "playwright-report/**", "test-results/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        { "name": "document", "message": "domain must not depend on the DOM" },
        { "name": "fetch", "message": "domain must not perform I/O" },
        { "name": "localStorage", "message": "domain must not own persistence" },
        { "name": "navigator", "message": "domain must not depend on browser state" },
        { "name": "sessionStorage", "message": "domain must not own persistence" },
        { "name": "window", "message": "domain must not depend on the DOM" }
      ],
      "no-restricted-imports": [
        "error",
        {
          "patterns": [
            { "group": ["react", "react/*"], "message": "domain must not depend on React" },
            { "group": ["react-dom", "react-dom/*"], "message": "domain must not depend on React DOM" },
            { "group": ["three", "three/*"], "message": "domain must not depend on Three.js" },
            { "group": ["../scene/**", "../ui/**", "../persistence/**"], "message": "outer layers depend on domain, not the reverse" }
          ]
        }
      ]
    }
  }
);

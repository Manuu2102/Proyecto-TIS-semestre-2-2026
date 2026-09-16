import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      // El proyecto sincroniza datos de localStorage/sessionStorage
      // con estados de React dentro de efectos.
      "react-hooks/set-state-in-effect": "off",

      // Hay valores generados dinámicamente dentro de handlers.
      "react-hooks/purity": "off",

      // Algunas funciones de carga de datos se utilizan desde efectos.
      "react-hooks/immutability": "off",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;

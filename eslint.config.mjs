import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypeScript,
  {
    ignores: [
      "desktop/dist/**",
      "desktop/src-tauri/target/**",
    ],
  },
];

export default eslintConfig;

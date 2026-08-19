import { config as remotionConfig } from "@remotion/eslint-config-flat";
import nextConfig from "eslint-config-next";

export default [
  ...remotionConfig.map((entry) => ({
    ...entry,
    files: entry.files ?? ["src/**/*.ts", "src/**/*.tsx"],
  })),
  ...nextConfig.map((entry) => ({
    ...entry,
    files: ["app/**/*.ts", "app/**/*.tsx", "lib/**/*.ts", "proxy.ts"],
  })),
];

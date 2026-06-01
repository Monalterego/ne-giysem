// Node.js global bildirimleri — Expo/Metro bu değerleri runtime'da polyfill eder,
// TS tip denetimi için minimal tanımlar yeterli.

declare const process: {
  readonly env: Record<string, string | undefined>;
};

declare function require(id: string): unknown;
declare namespace require {
  let main: { id: string; filename: string } | undefined;
}

declare const module: {
  id: string;
  filename: string;
  exports: unknown;
};

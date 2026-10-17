// Görsel modülleri — Metro import edilen görseli bir asset id'sine (number) çevirir.
// Image / expo-image `source` prop'u bu değeri (ImageRequireSource) doğrudan kabul eder.
// Not: globals.d.ts'deki require() `unknown` döner; görseller bu yüzden import ile alınır.

declare module '*.png' {
  const value: number;
  export default value;
}

declare module '*.jpg' {
  const value: number;
  export default value;
}

declare module '*.jpeg' {
  const value: number;
  export default value;
}

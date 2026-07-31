/** Mirrors packages/shared/src/money.ts formatting — duplicated locally rather
 * than imported cross-workspace, since that package targets Node/CommonJS
 * consumers (tsx/esbuild) and Vite's bundler resolution doesn't need to take
 * on that config surface for one formatting function. */
export function formatMinorUnits(minorAmount: number, currency: string, locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(minorAmount / 100);
}

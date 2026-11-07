export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en", { notation: n >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
}
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}
export function formatWeek(iso: string): string {
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short" });
}

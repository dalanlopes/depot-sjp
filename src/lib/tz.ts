// Brazil (America/Sao_Paulo) is a fixed UTC-3 offset year-round since the
// 2019 DST abolition, so we can safely hardcode the offset for date math
// while still using Intl for display formatting.
const TZ = "America/Sao_Paulo";
const BR_OFFSET = "-03:00";

/** Today's date in Brazil, as YYYY-MM-DD. */
export function todayBR(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Given a YYYY-MM-DD, returns the JS Date instant for 00:00 in Brazil time. */
export function startOfDayBR(ymd: string): Date {
  return new Date(`${ymd}T00:00:00${BR_OFFSET}`);
}

/** Given a YYYY-MM-DD, returns the JS Date instant for 23:59:59.999 in Brazil time. */
export function endOfDayBR(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999${BR_OFFSET}`);
}

/** Adds n days to a YYYY-MM-DD string, returning a new YYYY-MM-DD string. */
export function addDaysBR(ymd: string, n: number): string {
  const d = startOfDayBR(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Formats an ISO timestamp as a BR date (dd/mm/yyyy). */
export function formatDateBR(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso)
  );
}

/** Formats an ISO timestamp as BR date + time (dd/mm/yyyy HH:MM). */
export function formatDateTimeBR(iso: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Whole days between a BR entrada instant and now, using BR calendar days. */
export function diasEmEstoque(entrada: string | Date | null): number | null {
  if (!entrada) return null;
  const entradaYmd = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(entrada));
  const hojeYmd = todayBR();
  const diffMs = startOfDayBR(hojeYmd).getTime() - startOfDayBR(entradaYmd).getTime();
  return Math.round(diffMs / 86400000);
}

/** First day (YYYY-MM-DD) of the BR calendar month containing ymd. */
export function startOfMonthBR(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

/** Monday (YYYY-MM-DD) of the BR calendar week containing ymd. */
export function mondayOfWeekBR(ymd: string): string {
  const weekday = startOfDayBR(ymd).getUTCDay(); // 0=Sun..6=Sat
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDaysBR(ymd, diff);
}

/** Sunday (YYYY-MM-DD) of the BR calendar week containing ymd. */
export function sundayOfWeekBR(ymd: string): string {
  return addDaysBR(mondayOfWeekBR(ymd), 6);
}

/** Current hour of day (0-23) in Brazil time. */
export function nowHourBR(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hour12: false }).format(new Date())
  );
}

/** Opening-hours logic in India time. opening_hours = { mon: [["10:00","23:00"]], ... }; ranges may cross midnight. */
export type OpeningHours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string][]>>;
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export type OpenState = {
  open: boolean;
  /** Short status for cards, e.g. "Opens at 7:00 am", "Closed today", "Busy, back in 20 min". */
  label?: string;
  opensSoon?: boolean;
};

function istParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dayIdx = DAYS.indexOf(get("weekday").toLowerCase().slice(0, 3) as (typeof DAYS)[number]);
  const minutes = Number(get("hour")) % 24 * 60 + Number(get("minute"));
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { dayIdx, minutes, date };
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function formatClock(hhmm: string) {
  const mins = toMin(hhmm);
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${suffix}`;
}

/**
 * In demo mode restaurants ignore their opening hours (offline, busy and holidays still close them), so the demo
 * works at any hour. Set NEXT_PUBLIC_DEMO_RESPECT_HOURS=true to show real hours in demo mode.
 */
const IGNORE_HOURS = process.env.NEXT_PUBLIC_DEMO_MODE === "true" && process.env.NEXT_PUBLIC_DEMO_RESPECT_HOURS !== "true";

export function getOpenState(
  r: { is_online: boolean; busy_until: string | null; holidays: string[]; opening_hours: unknown },
  now = new Date(),
): OpenState {
  const { dayIdx, minutes, date } = istParts(now);
  if (!r.is_online) return { open: false, label: "Temporarily closed" };
  if (r.holidays.includes(date)) return { open: false, label: "Closed today" };
  if (r.busy_until && new Date(r.busy_until) > now) {
    const mins = Math.ceil((new Date(r.busy_until).getTime() - now.getTime()) / 60000);
    return { open: false, label: `Busy, back in ${mins} min`, opensSoon: mins <= 60 };
  }
  if (IGNORE_HOURS) return { open: true };
  const hours = (r.opening_hours ?? {}) as OpeningHours;
  const today = hours[DAYS[dayIdx]!] ?? [];
  const yesterday = hours[DAYS[(dayIdx + 6) % 7]!] ?? [];
  for (const [o, c] of today) {
    const open = toMin(o);
    const close = toMin(c);
    if (close > open ? minutes >= open && minutes < close : minutes >= open) return { open: true };
  }
  for (const [o, c] of yesterday) {
    const open = toMin(o);
    const close = toMin(c);
    if (close <= open && minutes < close) return { open: true };
  }
  const next = today.map(([o]) => o).find((o) => toMin(o) > minutes);
  if (next) return { open: false, label: `Opens at ${formatClock(next)}`, opensSoon: toMin(next) - minutes <= 60 };
  const tomorrow = hours[DAYS[(dayIdx + 1) % 7]!]?.[0]?.[0];
  return { open: false, label: tomorrow ? `Opens tomorrow at ${formatClock(tomorrow)}` : "Closed today" };
}

/** Category availability windows (e.g. breakfast till 11:30). */
export function isCategoryAvailable(c: { available_from: string | null; available_to: string | null; available_days: number[] }, now = new Date()) {
  const { dayIdx, minutes } = istParts(now);
  if (c.available_days.length && !c.available_days.includes(dayIdx)) return false;
  if (!c.available_from || !c.available_to) return true;
  return minutes >= toMin(c.available_from) && minutes < toMin(c.available_to);
}

/** Shared formatting of the next scheduled review (Today card and session end). */
export type NextDue = { kind: "today" | "tomorrow" | "date"; value: string };

export function describeNextDue(ts: number, locale: string): NextDue {
  const due = new Date(ts);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayDiff = Math.floor((ts - startOfToday.getTime()) / 86_400_000);
  if (dayDiff <= 1) {
    const time = due.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    return { kind: dayDiff <= 0 ? "today" : "tomorrow", value: time };
  }
  return {
    kind: "date",
    value: due.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" }),
  };
}

/** The i18n key matching a NextDue kind, under the `today` namespace. */
export function nextDueKey(kind: NextDue["kind"]): string {
  return kind === "today"
    ? "today.nextDueToday"
    : kind === "tomorrow"
      ? "today.nextDueTomorrow"
      : "today.nextDueOn";
}

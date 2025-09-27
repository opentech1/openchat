const RELATIVE_TIME = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const DIVISORS: Array<[unit: Intl.RelativeTimeFormatUnit, ms: number]> = [
	["year", 1000 * 60 * 60 * 24 * 365],
	["month", 1000 * 60 * 60 * 24 * 30],
	["week", 1000 * 60 * 60 * 24 * 7],
	["day", 1000 * 60 * 60 * 24],
	["hour", 1000 * 60 * 60],
	["minute", 1000 * 60],
	["second", 1000],
];

export function toDate(value: Date | string | number | null | undefined): Date | null {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value;
	}
	if (typeof value === "string" || typeof value === "number") {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? null : date;
	}
	return null;
}

export function formatRelativeTime(value: Date | string | number | null | undefined, now: Date = new Date()): string {
	const date = toDate(value);
	if (!date) return "";
	const diff = date.getTime() - now.getTime();
	const abs = Math.abs(diff);
	for (const [unit, ms] of DIVISORS) {
		if (abs >= ms || unit === "second") {
			return RELATIVE_TIME.format(Math.round(diff / ms), unit);
		}
	}
	return "";
}

export function formatDayLabel(value: Date | string | number | null | undefined): string {
	const date = toDate(value);
	if (!date) return "";
	return date.toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

import type { MusicCastDeviceSettings } from "./settings.js";

/** Optional overrides from the property inspector (`colors.*` settings). */
export type VolumeColorOverrides = {
	level?: string;
	muted?: string;
	number?: string;
	subtitle?: string;
	error?: string;
	barTrack?: string;
	background?: string;
};

export type ResolvedVolumeColors = {
	level: string;
	muted: string;
	number: string;
	subtitle: string;
	error: string;
	barTrack: string;
	background: string;
};

export const DEFAULT_VOLUME_COLORS: ResolvedVolumeColors = {
	level: "#5AC8FA",
	muted: "#FF9F0A",
	number: "#FFFFFF",
	subtitle: "#8E8E93",
	error: "#FF453A",
	barTrack: "transparent",
	background: "#1C1C1E",
};

const HEX_COLOR =
	/^#([0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{3})$/;

/** Normalizes color values to CSS hex (`#RGB[A]` / `#RRGGBB[AA]`) or `transparent`. */
export function parseHexColor(raw: unknown, fallback: string): string {
	if (typeof raw !== "string") return fallback;
	const trimmed = raw.trim();
	if (!trimmed) return fallback;
	if (trimmed.toLowerCase() === "transparent") return "transparent";
	if (HEX_COLOR.test(trimmed)) return trimmed;
	if (
		/^([0-9A-Fa-f]{8}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{3})$/.test(
			trimmed
		)
	) {
		return `#${trimmed}`;
	}
	return fallback;
}

export function resolveVolumeColors(
	settings: MusicCastDeviceSettings
): ResolvedVolumeColors {
	const o = settings.colors;
	const d = DEFAULT_VOLUME_COLORS;
	return {
		level: parseHexColor(o?.level, d.level),
		muted: parseHexColor(o?.muted, d.muted),
		number: parseHexColor(o?.number, d.number),
		subtitle: parseHexColor(o?.subtitle, d.subtitle),
		error: parseHexColor(o?.error, d.error),
		barTrack: parseHexColor(o?.barTrack, d.barTrack),
		background: parseHexColor(o?.background, d.background),
	};
}

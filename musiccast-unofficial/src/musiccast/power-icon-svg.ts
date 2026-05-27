import { escapeXmlAttr } from "./volume-bar-svg.js";

const ICON_SIZE = 18;

/** MusicCast `getStatus` power field → icon treats only `on` as powered. */
export function isPowerOn(power: string | undefined): boolean {
	return (power ?? "").trim().toLowerCase() === "on";
}

/**
 * IEC-style power symbol for the touch strip (lower-left), as an SVG data URI.
 */
export function powerIconPixmapUri(opts: {
	on: boolean;
	color: string;
}): string {
	const c = escapeXmlAttr(opts.color);
	const glowOpacity = opts.on ? "0.22" : "0.1";
	const strokeW = opts.on ? "1.85" : "1.65";

	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 18 18">` +
		`<circle cx="9" cy="9" r="7.5" fill="${c}" opacity="${glowOpacity}"/>` +
		`<path d="M9 3.35V8.1" fill="none" stroke="${c}" stroke-width="${strokeW}" stroke-linecap="round"/>` +
		`<path d="M5.55 5.55a4.45 4.45 0 1 0 6.9 0" fill="none" stroke="${c}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round"/>` +
		`</svg>`;

	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function powerIconColor(
	power: string | undefined,
	muted: boolean,
	colors: { level: string; muted: string }
): string {
	if (!isPowerOn(power)) return colors.muted;
	return muted ? colors.muted : colors.level;
}

import type { MusicCastDeviceSettings } from "./settings.js";
import { resolveVolumeColors } from "./volume-colors.js";

export type MusicCastKeyIcon =
	| "play"
	| "play-pause"
	| "stop"
	| "previous"
	| "next"
	| "mute"
	| "power";

function glyph(icon: MusicCastKeyIcon, color: string, accent: string): string {
	switch (icon) {
		case "play":
			return `<path d="M25 18v36l25-18-25-18z" fill="none" stroke="${accent}" stroke-width="5" stroke-linejoin="round" opacity="0.9"/><path fill="${color}" d="M25 18v36l25-18-25-18z"/>`;
		case "play-pause":
			return `<path d="M16 18v36l24-18-24-18z" fill="none" stroke="${accent}" stroke-width="5" stroke-linejoin="round" opacity="0.9"/><path fill="${color}" d="M16 18v36l24-18-24-18z"/><rect x="45" y="20" width="5" height="32" rx="2" fill="${accent}"/><rect x="56" y="20" width="5" height="32" rx="2" fill="${accent}"/>`;
		case "stop":
			return `<rect x="18" y="18" width="36" height="36" rx="7" fill="none" stroke="${accent}" stroke-width="3" opacity="0.9"/><rect x="23" y="23" width="26" height="26" rx="4" fill="${color}"/>`;
		case "previous":
			return `<rect x="18" y="19" width="5" height="34" rx="2" fill="${accent}"/><path d="M53 18v36L29 36l24-18z" fill="none" stroke="${accent}" stroke-width="5" stroke-linejoin="round" opacity="0.9"/><path fill="${color}" d="M53 18v36L29 36l24-18z"/>`;
		case "next":
			return `<rect x="49" y="19" width="5" height="34" rx="2" fill="${accent}"/><path d="M19 18v36l24-18-24-18z" fill="none" stroke="${accent}" stroke-width="5" stroke-linejoin="round" opacity="0.9"/><path fill="${color}" d="M19 18v36l24-18-24-18z"/>`;
		case "mute":
			return `<path fill="${color}" d="M17 31h10l14-11v32L27 41H17V31z"/><path d="M50 28l10 16M60 28L50 44" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>`;
		case "power":
			return `<circle cx="36" cy="36" r="27" fill="none" stroke="${accent}" stroke-width="3" opacity="0.9"/><path d="M36 16v22" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/><path d="M25 24a19 19 0 1022 0" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
	}
}

function hasPrimaryShadow(icon: MusicCastKeyIcon): boolean {
	return (
		icon === "play" ||
		icon === "play-pause" ||
		icon === "previous" ||
		icon === "next"
	);
}

export function musicCastKeyImage(
	icon: MusicCastKeyIcon,
	settings: MusicCastDeviceSettings
): string {
	const colors = resolveVolumeColors(settings);
	const shadow = hasPrimaryShadow(icon);
	const glyphColor = colors.number;
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72">` +
		(shadow
			? `<defs><filter id="primary-shadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="${colors.level}" flood-opacity="0.75"/></filter></defs>`
			: "") +
		`<rect width="72" height="72" rx="13" fill="#1C1C1E"/>` +
		(shadow
			? `<g filter="url(#primary-shadow)">${glyph(
					icon,
					glyphColor,
					colors.level
			  )}</g>`
			: glyph(icon, glyphColor, colors.level)) +
		`</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

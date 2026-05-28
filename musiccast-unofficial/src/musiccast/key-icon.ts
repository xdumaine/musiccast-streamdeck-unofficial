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

function glyph(
	icon: MusicCastKeyIcon,
	color: string,
	accent: string,
	background: string
): string {
	switch (icon) {
		case "play":
			return `<path fill="${accent}" opacity="0.9" d="M21 14v44l31-22-31-22z"/><path fill="${background}" d="M25 19v34l24-17-24-17z"/><path fill="${color}" d="M29 24v24l17-12-17-12z"/>`;
		case "play-pause":
			return `<path fill="${accent}" opacity="0.9" d="M12 14v44l31-22-31-22z"/><path fill="${background}" d="M16 19v34l24-17-24-17z"/><path fill="${color}" d="M20 24v24l17-12-17-12z"/><rect x="43" y="17" width="10" height="38" rx="4" fill="${accent}" opacity="0.9"/><rect x="46" y="21" width="4" height="30" rx="2" fill="${color}"/><rect x="55" y="17" width="10" height="38" rx="4" fill="${accent}" opacity="0.9"/><rect x="58" y="21" width="4" height="30" rx="2" fill="${color}"/>`;
		case "stop":
			return `<rect x="18" y="18" width="36" height="36" rx="7" fill="none" stroke="${accent}" stroke-width="3" opacity="0.9"/><rect x="23" y="23" width="26" height="26" rx="4" fill="${color}"/>`;
		case "previous":
			return `<rect x="15" y="16" width="11" height="40" rx="4" fill="${accent}" opacity="0.9"/><rect x="19" y="20" width="3" height="32" rx="1.5" fill="${color}"/><path fill="${accent}" opacity="0.9" d="M56 14v44L25 36l31-22z"/><path fill="${background}" d="M52 19v34L28 36l24-17z"/><path fill="${color}" d="M48 24v24L31 36l17-12z"/>`;
		case "next":
			return `<path fill="${accent}" opacity="0.9" d="M16 14v44l31-22-31-22z"/><path fill="${background}" d="M20 19v34l24-17-24-17z"/><path fill="${color}" d="M24 24v24l17-12-17-12z"/><rect x="46" y="16" width="11" height="40" rx="4" fill="${accent}" opacity="0.9"/><rect x="50" y="20" width="3" height="32" rx="1.5" fill="${color}"/>`;
		case "mute":
			return `<path fill="${accent}" opacity="0.9" d="M14 28h12l18-14v44L26 44H14V28z"/><path fill="${background}" d="M17 31h10l14-11v32L27 41H17V31z"/><path fill="${color}" d="M20 33h8l10-8v22l-10-8h-8v-6z"/><path d="M50 28l10 16M60 28L50 44" fill="none" stroke="${accent}" stroke-width="4" stroke-linecap="round"/>`;
		case "power":
			return `<path d="M22 22a23 23 0 1028 0" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round" opacity="0.9"/><path d="M36 16v22" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/><path d="M25 24a19 19 0 1022 0" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
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
		`<rect width="72" height="72" rx="13" fill="${colors.background}"/>` +
		(shadow
			? `<g filter="url(#primary-shadow)">${glyph(
					icon,
					glyphColor,
					colors.level,
					colors.background
			  )}</g>`
			: glyph(icon, glyphColor, colors.level, colors.background)) +
		`</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

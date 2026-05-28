import type { FeedbackPayload } from "@elgato/streamdeck";

import type { NetPlayInfo } from "./client.js";
import type { MusicCastDeviceSettings } from "./settings.js";
import { sourceKeyImage, sourceLabel } from "./source-icon.js";
import { resolveVolumeColors } from "./volume-colors.js";

function escapeXmlAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function escapeXmlText(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function asText(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}

function firstText(info: NetPlayInfo, keys: string[]): string {
	for (const key of keys) {
		const value = asText(info[key]);
		if (value) return value;
	}
	return "";
}

function formatTime(seconds: unknown): string {
	const n = typeof seconds === "number" ? seconds : Number(seconds);
	if (!Number.isFinite(n) || n < 0) return "";
	const min = Math.floor(n / 60);
	const sec = Math.floor(n % 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}

function playbackLabel(raw: unknown): string {
	const value = asText(raw).toLowerCase();
	if (!value) return "";
	return value === "play"
		? "Playing"
		: value[0]?.toUpperCase() + value.slice(1);
}

function progressPercent(info: NetPlayInfo): number {
	const played =
		typeof info.play_time === "number"
			? info.play_time
			: Number(info.play_time);
	const total =
		typeof info.total_time === "number"
			? info.total_time
			: Number(info.total_time);
	if (!Number.isFinite(played) || !Number.isFinite(total) || total <= 0)
		return 0;
	return Math.max(0, Math.min(100, (played / total) * 100));
}

function truncate(value: string, max: number): string {
	return value.length > max
		? `${value.slice(0, Math.max(0, max - 1))}…`
		: value;
}

function isTransparent(color: string): boolean {
	const normalized = color.trim().toLowerCase();
	return (
		normalized === "transparent" ||
		normalized === "#0000" ||
		normalized === "#00000000"
	);
}

function currentPlayingPixmap(opts: {
	coverUri?: string;
	title: string;
	artist: string;
	status: string;
	percent: number;
	colors: {
		level: string;
		number: string;
		subtitle: string;
		barTrack: string;
		background: string;
	};
}): string {
	const showCover = Boolean(opts.coverUri);
	const textX = showCover ? 100 : 8;
	const textW = showCover ? 94 : 184;
	const progressW = showCover ? 94 : 184;
	const titleMax = showCover ? 17 : 32;
	const artistMax = showCover ? 22 : 40;
	const statusMax = showCover ? 26 : 44;
	const fillW = Math.max(
		0,
		Math.min(progressW, Math.round((progressW * opts.percent) / 100))
	);
	const coverBacking = isTransparent(opts.colors.background)
		? ""
		: `<rect x="8" y="10" width="80" height="80" rx="10" ry="10" fill="${escapeXmlAttr(
				opts.colors.background
		  )}"/>`;
	const coverMarkup = showCover
		? coverBacking +
		  `<image x="10" y="12" width="76" height="76" href="${escapeXmlAttr(
				opts.coverUri ?? ""
		  )}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cover)"/>`
		: "";
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">` +
		`<defs><clipPath id="cover"><rect x="10" y="12" width="76" height="76" rx="8" ry="8"/></clipPath></defs>` +
		coverMarkup +
		`<text x="${textX}" y="28" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="13" font-weight="700" fill="${escapeXmlAttr(
			opts.colors.number
		)}">${escapeXmlText(truncate(opts.title, titleMax))}</text>` +
		`<text x="${textX}" y="49" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="10" font-weight="500" fill="${escapeXmlAttr(
			opts.colors.subtitle
		)}">${escapeXmlText(truncate(opts.artist, artistMax))}</text>` +
		`<text x="${textX}" y="67" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="8" font-weight="600" fill="${escapeXmlAttr(
			opts.colors.level
		)}">${escapeXmlText(truncate(opts.status, statusMax))}</text>` +
		`<rect x="${textX}" y="82" width="${progressW}" height="4" rx="2" fill="${escapeXmlAttr(
			opts.colors.barTrack
		)}"/>` +
		(fillW > 0
			? `<rect x="${textX}" y="82" width="${fillW}" height="4" rx="2" fill="${escapeXmlAttr(
					opts.colors.level
			  )}"/>`
			: "") +
		`</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function buildCurrentPlayingFeedback(
	settings: MusicCastDeviceSettings,
	info: NetPlayInfo,
	opts?: { albumArtUri?: string }
): FeedbackPayload {
	const colors = resolveVolumeColors(settings);
	const input = asText(info.input);
	const showAlbumArt = settings.showAlbumArt !== false;
	const title =
		firstText(info, ["song", "track", "title", "track_name", "name"]) ||
		firstText(info, ["station"]) ||
		"No song info";
	const artist = firstText(info, ["artist", "album"]);
	const album = firstText(info, ["album"]);
	const artistLine =
		artist && album && artist !== album
			? `${artist} · ${album}`
			: artist || album;
	const playback = playbackLabel(info.playback);
	const elapsed = formatTime(info.play_time);
	const total = formatTime(info.total_time);
	const time = elapsed && total ? `${elapsed} / ${total}` : elapsed;
	const status = [playback, time, sourceLabel(input)]
		.filter(Boolean)
		.join(" · ");
	const pct = progressPercent(info);

	return {
		display: {
			value: currentPlayingPixmap({
				coverUri: showAlbumArt
					? opts?.albumArtUri ??
					  sourceKeyImage(input, {
							background: colors.background,
							accent: colors.level,
							foreground: colors.number,
							muted: colors.subtitle,
					  })
					: undefined,
				title,
				artist: artistLine || "MusicCast",
				status: status || "Current playing",
				percent: pct,
				colors,
			}),
		},
	};
}

export function buildCurrentPlayingErrorFeedback(
	settings: MusicCastDeviceSettings,
	message: string
): FeedbackPayload {
	const colors = resolveVolumeColors(settings);
	const showAlbumArt = settings.showAlbumArt !== false;
	return {
		display: {
			value: currentPlayingPixmap({
				coverUri: showAlbumArt
					? sourceKeyImage(undefined, {
							background: colors.background,
							accent: colors.error,
							foreground: colors.number,
							muted: colors.subtitle,
					  })
					: undefined,
				title: "Now Playing",
				artist: message.slice(0, 34),
				status: "Refresh failed",
				percent: 0,
				colors: { ...colors, level: colors.error },
			}),
		},
	};
}

export function buildCurrentPlayingStandbyFeedback(
	settings: MusicCastDeviceSettings
): FeedbackPayload {
	const colors = resolveVolumeColors(settings);
	const showAlbumArt = settings.showAlbumArt !== false;
	return {
		display: {
			value: currentPlayingPixmap({
				coverUri: showAlbumArt
					? sourceKeyImage(undefined, {
							background: colors.background,
							accent: colors.muted,
							foreground: colors.number,
							muted: colors.subtitle,
					  })
					: undefined,
				title: "Standby",
				artist: "Power off",
				status: "MusicCast",
				percent: 0,
				colors: { ...colors, level: colors.muted },
			}),
		},
	};
}

export function buildCurrentPlayingLoadingFeedback(
	settings: MusicCastDeviceSettings
): FeedbackPayload {
	const colors = resolveVolumeColors(settings);
	const showAlbumArt = settings.showAlbumArt !== false;
	return {
		display: {
			value: currentPlayingPixmap({
				coverUri: showAlbumArt
					? sourceKeyImage(undefined, {
							background: colors.background,
							accent: colors.level,
							foreground: colors.number,
							muted: colors.subtitle,
					  })
					: undefined,
				title: "Loading...",
				artist: "Fetching now playing",
				status: "MusicCast",
				percent: 0,
				colors,
			}),
		},
	};
}

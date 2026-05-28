type SourceIconColors = {
	background?: string;
	foreground?: string;
	accent?: string;
	muted?: string;
};

const DEFAULT_COLORS = {
	background: "#1C1C1E",
	foreground: "#FFFFFF",
	accent: "#5AC8FA",
	muted: "#8E8E93",
};

const LABELS: Record<string, string> = {
	airplay: "AIR",
	bluetooth: "BT",
	mc_link: "LINK",
	net_radio: "RADIO",
	phono: "PHONO",
	server: "NAS",
	spotify: "Spotify",
	tidal: "TIDAL",
	qobuz: "QOBUZ",
	deezer: "DEEZ",
	juke: "JUKE",
	napster: "NAPS",
	usb: "USB",
};

function escapeXml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

export function sourceLabel(input: string | undefined): string {
	const key = (input ?? "").trim().toLowerCase();
	if (!key) return "SRC";
	return LABELS[key] ?? key.replace(/^net_/, "").slice(0, 5).toUpperCase();
}

function colorsFor(colors?: SourceIconColors): Required<SourceIconColors> {
	return {
		background: colors?.background ?? DEFAULT_COLORS.background,
		foreground: colors?.foreground ?? DEFAULT_COLORS.foreground,
		accent: colors?.accent ?? DEFAULT_COLORS.accent,
		muted: colors?.muted ?? DEFAULT_COLORS.muted,
	};
}

function isTransparent(color: string): boolean {
	const normalized = color.trim().toLowerCase();
	return (
		normalized === "transparent" ||
		normalized === "#0000" ||
		normalized === "#00000000"
	);
}

function glyphFor(
	input: string | undefined,
	colors: Required<SourceIconColors>
): string {
	const key = (input ?? "").trim().toLowerCase();
	const { foreground: fg, accent, background: bg } = colors;
	const holeFill = isTransparent(bg) ? "none" : bg;
	switch (key) {
		case "phono":
			return `<circle cx="36" cy="26" r="11" fill="none" stroke="${fg}" stroke-width="3"/><circle cx="36" cy="26" r="3" fill="${accent}"/><path d="M50 18l7-5 2 3-7 5" stroke="${fg}" stroke-width="3" stroke-linecap="round"/>`;
		case "bluetooth":
			return `<path d="M35 13v28l10-9-10-9 10-9-10-9" fill="none" stroke="${fg}" stroke-width="3" stroke-linejoin="round"/><path d="M25 20l20 16M25 36l20-16" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>`;
		case "airplay":
			return `<rect x="19" y="15" width="34" height="24" rx="4" fill="none" stroke="${fg}" stroke-width="3"/><path d="M36 33l12 15H24l12-15z" fill="${accent}"/>`;
		case "spotify":
		case "tidal":
		case "qobuz":
		case "deezer":
		case "napster":
		case "juke":
		case "net_radio":
		case "server":
		case "usb":
		case "mc_link":
			return `<path d="M24 32h7l10-8v24l-10-8h-7v-8z" fill="${fg}"/><path d="M47 27c4 3 6 6 6 9s-2 6-6 9M51 21c7 5 10 10 10 15s-3 10-10 15" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`;
		default:
			return `<path d="M24 30h24v12H24z" fill="${fg}"/><path d="M18 24h36v24H18z" fill="none" stroke="${accent}" stroke-width="3" stroke-linejoin="round"/><circle cx="28" cy="36" r="2" fill="${holeFill}"/><circle cx="44" cy="36" r="2" fill="${holeFill}"/>`;
	}
}

export function sourceKeyImage(
	input: string | undefined,
	iconColors?: SourceIconColors
): string {
	const colors = colorsFor(iconColors);
	const label = escapeXml(sourceLabel(input));
	const glyph = glyphFor(input, colors);
	const background = isTransparent(colors.background)
		? ""
		: `<rect width="72" height="72" rx="13" fill="${colors.background}"/>`;
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72">` +
		background +
		glyph +
		`<text x="36" y="62" text-anchor="middle" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="9" font-weight="700" fill="${colors.muted}">${label}</text>` +
		`</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

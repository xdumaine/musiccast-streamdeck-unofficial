import type { FeedbackPayload } from "@elgato/streamdeck";

import {
	normalizeHost,
	sourceCycle,
	type MusicCastDeviceSettings,
} from "./settings.js";
import { sourceKeyImage, sourceLabel } from "./source-icon.js";
import { resolveVolumeColors } from "./volume-colors.js";

function sourcePosition(
	settings: MusicCastDeviceSettings,
	input: string | undefined
): string {
	const cycle = sourceCycle(settings);
	const idx = cycle.indexOf((input ?? "").trim());
	return idx >= 0 ? `${idx + 1} / ${cycle.length}` : `${cycle.length} inputs`;
}

export function buildSourceFeedback(
	settings: MusicCastDeviceSettings,
	input: string | undefined,
	opts?: { status?: string }
): FeedbackPayload {
	const host = normalizeHost(settings.host);
	const label = sourceLabel(input);
	const colors = resolveVolumeColors(settings);
	return {
		icon: {
			value: sourceKeyImage(input, {
				background: colors.background,
				accent: colors.level,
				foreground: colors.number,
				muted: colors.subtitle,
			}),
		},
		source: { value: label, color: colors.number },
		sub: {
			value:
				opts?.status ??
				(host
					? `${sourcePosition(settings, input)} · ${host}`
					: "Set device IP"),
			color: colors.subtitle,
		},
	};
}

export function buildSourceErrorFeedback(
	settings: MusicCastDeviceSettings,
	message: string
): FeedbackPayload {
	const colors = resolveVolumeColors(settings);
	return {
		icon: {
			value: sourceKeyImage(undefined, {
				background: colors.background,
				accent: colors.error,
				foreground: colors.error,
				muted: colors.subtitle,
			}),
		},
		source: { value: "Source", color: colors.error },
		sub: { value: message.slice(0, 38), color: colors.subtitle },
	};
}

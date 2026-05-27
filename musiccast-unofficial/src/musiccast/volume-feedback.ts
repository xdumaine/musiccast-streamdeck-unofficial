import type { FeedbackPayload } from "@elgato/streamdeck";

import type { MusicCastDeviceSettings } from "./settings.js";
import {
  showHostOnDial,
  volumeDisplayMode,
  zoneFromSettings,
} from "./settings.js";
import {
  isPowerOn,
  powerIconColor,
  powerIconPixmapUri,
} from "./power-icon-svg.js";
import { clampBarThickness, volumeBarPixmapUri } from "./volume-bar-svg.js";
import { resolveVolumeColors } from "./volume-colors.js";

export function volumePercent(vol: number | undefined, max: number): number {
  if (vol === undefined || !Number.isFinite(vol)) return 0;
  if (max <= 0) return Math.max(0, Math.min(100, Math.round(vol)));
  return Math.max(0, Math.min(100, Math.round((vol / max) * 100)));
}

function subtitleLine(parts: string[]): string {
  return parts.filter(Boolean).join(" · ");
}

function statusSubtitleParts(
  settings: MusicCastDeviceSettings,
  opts: {
    host: string;
    zone: string;
    muted: boolean;
    power: string;
  },
  barMode: boolean
): string[] {
  const parts: string[] = [];
  if (showHostOnDial(settings)) parts.push(opts.host);
  if (opts.zone !== "main") parts.push(opts.zone);
  if (opts.muted) parts.push("Muted");
  if (!barMode && opts.power) parts.push(opts.power);
  return parts;
}

function barVisualFeedback(
  settings: MusicCastDeviceSettings,
  opts: {
    percent: number;
    fillColor: string;
    power: string;
    muted: boolean;
  }
): Pick<FeedbackPayload, "level" | "power"> {
  const c = resolveVolumeColors(settings);
  const iconColor = powerIconColor(opts.power, opts.muted, {
    level: c.level,
    muted: c.muted,
  });
  return {
    level: {
      value: volumeBarPixmapUri({
        percent: opts.percent,
        thickness: clampBarThickness(settings.barThickness),
        trackColor: c.barTrack,
        fillColor: opts.fillColor,
        radius: 4,
        animated: settings.experimentalAnimatedBar !== false,
        squiggleAmplitude: settings.squiggleAmplitude,
        squiggleWavelength: settings.squiggleWavelength,
      }),
    },
    power: {
      value: powerIconPixmapUri({
        on: isPowerOn(opts.power),
        color: iconColor,
      }),
    },
  };
}

export function buildUnconfiguredFeedback(
  settings: MusicCastDeviceSettings
): FeedbackPayload {
  const c = resolveVolumeColors(settings);
  if (volumeDisplayMode(settings) === "bar") {
    return {
      ...barVisualFeedback(settings, {
        percent: 0,
        fillColor: c.error,
        power: "standby",
        muted: false,
      }),
      power: {
        value: powerIconPixmapUri({ on: false, color: c.error }),
      },
      sub: { value: "Set device IP in settings", color: c.subtitle },
    };
  }
  return {
    vol: { value: "No host", color: c.error },
    sub: { value: "Set device IP in settings", color: c.subtitle },
  };
}

export function buildErrorFeedback(
  settings: MusicCastDeviceSettings,
  host: string,
  message: string
): FeedbackPayload {
  const c = resolveVolumeColors(settings);
  const errSub = showHostOnDial(settings)
    ? subtitleLine([host, message.slice(0, 24)])
    : message.slice(0, 32);
  if (volumeDisplayMode(settings) === "bar") {
    return {
      ...barVisualFeedback(settings, {
        percent: 0,
        fillColor: c.error,
        power: "",
        muted: false,
      }),
      power: {
        value: powerIconPixmapUri({ on: false, color: c.error }),
      },
      sub: { value: errSub, color: c.subtitle },
    };
  }
  return {
    vol: { value: "Unreachable", color: c.error },
    sub: { value: errSub, color: c.subtitle },
  };
}

export function buildVolumeFeedback(
  settings: MusicCastDeviceSettings,
  opts: {
    host: string;
    vol: number | undefined;
    max: number;
    muted: boolean;
    power: string;
  }
): FeedbackPayload {
  const { host, vol, max, muted, power } = opts;
  const c = resolveVolumeColors(settings);
  const zone = zoneFromSettings(settings);
  const barMode = volumeDisplayMode(settings) === "bar";
  const sub = subtitleLine(
    statusSubtitleParts(settings, { host, zone, muted, power }, barMode)
  );

  if (barMode) {
    const pct = volumePercent(vol, max);
    return {
      ...barVisualFeedback(settings, {
        percent: pct,
        fillColor: muted ? c.muted : c.level,
        power,
        muted,
      }),
      sub: {
        value: sub || "MusicCast",
        color: c.subtitle,
      },
    };
  }

  const volLine =
    vol !== undefined ? `${vol}${max > 0 ? ` / ${max}` : ""}` : "—";
  return {
    vol: {
      value: volLine,
      color: muted ? c.muted : c.number,
    },
    sub: { value: sub || "MusicCast", color: c.subtitle },
  };
}

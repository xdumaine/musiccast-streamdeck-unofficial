/** How the volume dial renders level on the touch strip. */
export type VolumeDisplayMode = "number" | "bar";

import type { VolumeColorOverrides } from "./volume-colors.js";

/** Per-action settings configured in the property inspector. */
export type MusicCastDeviceSettings = {
  /** Device IP or hostname (no scheme), e.g. `192.168.1.42`. */
  host?: string;
  /** Zone from getLocationInfo; default `main`. */
  zone?: string;
  /** Dial-only: status poll interval in seconds. */
  pollSeconds?: number;
  /** Dial-only: numeric level vs horizontal bar (0–100). */
  displayMode?: VolumeDisplayMode | string;
  /** Dial-only: touch strip color overrides. */
  colors?: VolumeColorOverrides;
  /** Dial-only: show configured host/IP on the subtitle line (default on). */
  showHost?: boolean;
  /** Dial bar mode: bar height in pixels (4–28). */
  barThickness?: number;
  /** Dial bar mode: static SVG "worm" squiggle fill (default on). */
  experimentalAnimatedBar?: boolean;
  /** Squiggle mode: wave height in pixels. */
  squiggleAmplitude?: number;
  /** Squiggle mode: wavelength in pixels. */
  squiggleWavelength?: number;
  /** Source key: comma-separated MusicCast input IDs to cycle through. */
  sourceCycle?: string;
};

export function showHostOnDial(settings: MusicCastDeviceSettings): boolean {
  return settings.showHost !== false;
}

export function volumeDisplayMode(
  settings: MusicCastDeviceSettings
): VolumeDisplayMode {
  const raw = (settings.displayMode ?? "number")
    .toString()
    .trim()
    .toLowerCase();
  return raw === "bar" ? "bar" : "number";
}

export function volumeDialLayoutFile(
  settings: MusicCastDeviceSettings
): string {
  return volumeDisplayMode(settings) === "bar"
    ? "volume-dial-bar.json"
    : "volume-dial.json";
}

export const DEFAULT_ZONE = "main";
export const DEFAULT_POLL_SECONDS = 10;
export const MIN_POLL_SECONDS = 5;
export const MAX_POLL_SECONDS = 120;

export function normalizeHost(raw: string | undefined): string | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return null;
  return trimmed.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export function zoneFromSettings(settings: MusicCastDeviceSettings): string {
  const z = (settings.zone ?? "").trim();
  return z || DEFAULT_ZONE;
}

export function clampPollSeconds(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  const configured = Number.isFinite(n) ? n : DEFAULT_POLL_SECONDS;
  return Math.max(MIN_POLL_SECONDS, Math.min(MAX_POLL_SECONDS, configured));
}

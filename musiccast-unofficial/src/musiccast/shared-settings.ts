import streamDeck from "@elgato/streamdeck";

import type { MusicCastDeviceSettings } from "./settings.js";

export type MusicCastSharedSettings = Pick<
  MusicCastDeviceSettings,
  "host" | "zone" | "colors"
>;

let sharedSettings: MusicCastSharedSettings = {};
const listeners = new Set<() => void>();

function definedShared(
  settings: MusicCastDeviceSettings | undefined
): MusicCastSharedSettings {
  const next: MusicCastSharedSettings = {};
  if (!settings) return next;
  if (Object.hasOwn(settings, "host")) next.host = settings.host;
  if (Object.hasOwn(settings, "zone")) next.zone = settings.zone;
  if (Object.hasOwn(settings, "colors")) next.colors = settings.colors;
  return next;
}

function hasSharedKeys(settings: MusicCastDeviceSettings | undefined): boolean {
  if (!settings) return false;
  return (
    Object.hasOwn(settings, "host") ||
    Object.hasOwn(settings, "zone") ||
    Object.hasOwn(settings, "colors")
  );
}

export function setSharedSettings(settings: MusicCastSharedSettings): void {
  sharedSettings = {
    ...sharedSettings,
    ...settings,
    colors: {
      ...sharedSettings.colors,
      ...settings.colors,
    },
  };
  for (const listener of listeners) listener();
}

export function onSharedSettingsChanged(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function withSharedSettings(
  settings: MusicCastDeviceSettings
): MusicCastDeviceSettings {
  return {
    ...settings,
    ...sharedSettings,
    colors: {
      ...settings.colors,
      ...sharedSettings.colors,
    },
  };
}

export async function hydrateSharedSettings(): Promise<void> {
  try {
    const global =
      await streamDeck.settings.getGlobalSettings<MusicCastSharedSettings>();
    setSharedSettings(global);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    streamDeck.logger.warn(`Shared settings load failed: ${msg}`);
  }
}

export function saveSharedSettingsFromActionSettings(
  settings: MusicCastDeviceSettings | undefined
): void {
  if (!hasSharedKeys(settings)) return;
  const next = definedShared(settings);
  setSharedSettings(next);
  void streamDeck.settings.setGlobalSettings<MusicCastSharedSettings>(
    sharedSettings
  );
}


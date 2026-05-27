import { normalizeHost, type MusicCastDeviceSettings } from "./settings.js";

/** Merges Stream Deck settings from events and getSettings into a per-action cache. */
export class MusicCastSettingsCache {
  private readonly byAction = new Map<string, MusicCastDeviceSettings>();

  get(actionId: string): MusicCastDeviceSettings {
    return this.byAction.get(actionId) ?? {};
  }

  merge(
    actionId: string,
    partial: MusicCastDeviceSettings | undefined
  ): MusicCastDeviceSettings {
    if (!partial) return this.get(actionId);
    const prev = this.byAction.get(actionId) ?? {};
    const next = { ...prev, ...partial };
    this.byAction.set(actionId, next);
    return next;
  }

  delete(actionId: string): void {
    this.byAction.delete(actionId);
  }

  hostChanged(actionId: string, partial: MusicCastDeviceSettings): boolean {
    const prevHost = normalizeHost(this.get(actionId).host);
    const merged = this.merge(actionId, partial);
    const nextHost = normalizeHost(merged.host);
    return prevHost !== nextHost;
  }
}

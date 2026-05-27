import {
  action,
  type KeyDownEvent,
  type KeyAction,
  type WillAppearEvent,
  SingletonAction,
  streamDeck,
} from "@elgato/streamdeck";

import { MusicCastClient } from "../musiccast/client.js";
import { MusicCastSettingsCache } from "../musiccast/settings-cache.js";
import {
  normalizeHost,
  type MusicCastDeviceSettings,
} from "../musiccast/settings.js";
import { sourceKeyImage } from "../musiccast/source-icon.js";

const UUID =
  "com.xander-dumaine-xanderxdumainecom.musiccast-unofficial.source-toggle";
const DEFAULT_SOURCE_CYCLE = "phono,airplay,bluetooth,net_radio,spotify,server";

function sourceCycle(settings: MusicCastDeviceSettings): string[] {
  const raw = (settings.sourceCycle ?? DEFAULT_SOURCE_CYCLE).trim();
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

@action({ UUID })
export class SourceToggleKey extends SingletonAction<MusicCastDeviceSettings> {
  private readonly settingsCache = new MusicCastSettingsCache();

  override async onWillAppear(
    ev: WillAppearEvent<MusicCastDeviceSettings>
  ): Promise<void> {
    this.settingsCache.merge(ev.action.id, ev.payload.settings);
    if (!ev.action.isKey()) return;
    await this.refresh(ev.action);
  }

  override async onKeyDown(
    ev: KeyDownEvent<MusicCastDeviceSettings>
  ): Promise<void> {
    if (!ev.action.isKey()) return;
    const key = ev.action;
    const settings = this.settingsCache.merge(key.id, ev.payload.settings);
    if (!normalizeHost(settings.host)) {
      await key.showAlert();
      return;
    }

    try {
      const client = MusicCastClient.fromSettings(settings);
      const status = await client.getZoneStatus();
      const current = (status.input ?? "").toString();
      const cycle = sourceCycle(settings);
      if (cycle.length === 0) {
        throw new Error("No source cycle configured");
      }

      const currentIdx = cycle.indexOf(current);
      const next = cycle[(currentIdx + 1) % cycle.length] ?? cycle[0];
      await client.setInput(next);
      await this.paint(key, next);
      await key.showOk();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      streamDeck.logger.error(`Source toggle: ${msg}`);
      await key.showAlert();
    }
  }

  private async refresh(
    key: KeyAction<MusicCastDeviceSettings>
  ): Promise<void> {
    const settings = this.settingsCache.get(key.id);
    if (!normalizeHost(settings.host)) {
      await this.paint(key, undefined);
      return;
    }
    try {
      const client = MusicCastClient.fromSettings(settings);
      const status = await client.getZoneStatus();
      await this.paint(key, (status.input ?? "").toString());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      streamDeck.logger.warn(`Source refresh: ${msg}`);
      await this.paint(key, undefined);
    }
  }

  private async paint(
    key: KeyAction<MusicCastDeviceSettings>,
    input: string | undefined
  ): Promise<void> {
    await key.setImage(sourceKeyImage(input));
    await key.setTitle("");
  }
}

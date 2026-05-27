import {
  type KeyDownEvent,
  type WillAppearEvent,
  SingletonAction,
  streamDeck,
} from "@elgato/streamdeck";

import { MusicCastClient } from "./client.js";
import { MusicCastSettingsCache } from "./settings-cache.js";
import { normalizeHost, type MusicCastDeviceSettings } from "./settings.js";

const keySettingsCache = new MusicCastSettingsCache();

/** Key action that runs a single MusicCast command on press. */
export abstract class MusicCastKeyAction extends SingletonAction<MusicCastDeviceSettings> {
  protected abstract label: string;

  protected abstract run(client: MusicCastClient): Promise<void>;

  override onWillAppear(
    ev: WillAppearEvent<MusicCastDeviceSettings>
  ): void | Promise<void> {
    keySettingsCache.merge(ev.action.id, ev.payload.settings);
    return ev.action.setTitle(this.label);
  }

  override async onKeyDown(
    ev: KeyDownEvent<MusicCastDeviceSettings>
  ): Promise<void> {
    await ev.action.setTitle(this.label);
    const settings = keySettingsCache.merge(ev.action.id, ev.payload.settings);
    if (!normalizeHost(settings.host)) {
      await ev.action.showAlert();
      return;
    }
    try {
      const client = MusicCastClient.fromSettings(settings);
      await this.run(client);
      await ev.action.showOk();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      streamDeck.logger.error(`${this.label}: ${msg}`);
      await ev.action.showAlert();
    }
  }
}

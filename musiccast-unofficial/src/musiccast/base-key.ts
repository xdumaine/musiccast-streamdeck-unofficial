import {
	type KeyAction,
	type KeyDownEvent,
	type WillDisappearEvent,
	type WillAppearEvent,
	SingletonAction,
	streamDeck,
} from "@elgato/streamdeck";

import { MusicCastClient } from "./client.js";
import { musicCastKeyImage, type MusicCastKeyIcon } from "./key-icon.js";
import { MusicCastSettingsCache } from "./settings-cache.js";
import { normalizeHost, type MusicCastDeviceSettings } from "./settings.js";
import { onSharedSettingsChanged } from "./shared-settings.js";

const keySettingsCache = new MusicCastSettingsCache();

/** Key action that runs a single MusicCast command on press. */
export abstract class MusicCastKeyAction extends SingletonAction<MusicCastDeviceSettings> {
	protected abstract label: string;
	protected abstract icon: MusicCastKeyIcon;
	private readonly activeKeys = new Map<
		string,
		KeyAction<MusicCastDeviceSettings>
	>();
	private readonly unsubscribeShared = onSharedSettingsChanged(() => {
		for (const key of this.activeKeys.values()) void this.paintIcon(key);
	});

	protected abstract run(client: MusicCastClient): Promise<void>;

	override onWillAppear(
		ev: WillAppearEvent<MusicCastDeviceSettings>
	): void | Promise<void> {
		const settings = keySettingsCache.merge(ev.action.id, ev.payload.settings);
		void ev.action.setTitle(this.label);
		if (ev.action.isKey()) {
			this.activeKeys.set(ev.action.id, ev.action);
			return ev.action.setImage(musicCastKeyImage(this.icon, settings));
		}
	}

	override onWillDisappear(
		ev: WillDisappearEvent<MusicCastDeviceSettings>
	): void {
		this.activeKeys.delete(ev.action.id);
		keySettingsCache.delete(ev.action.id);
	}

	override async onKeyDown(
		ev: KeyDownEvent<MusicCastDeviceSettings>
	): Promise<void> {
		await ev.action.setTitle(this.label);
		const settings = keySettingsCache.merge(ev.action.id, ev.payload.settings);
		if (ev.action.isKey()) {
			await ev.action.setImage(musicCastKeyImage(this.icon, settings));
		}
		if (!normalizeHost(settings.host)) {
			await ev.action.showAlert();
			return;
		}
		try {
			const client = MusicCastClient.fromSettings(settings);
			await this.run(client);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.error(`${this.label}: ${msg}`);
			await ev.action.showAlert();
		}
	}

	private async paintIcon(
		key: KeyAction<MusicCastDeviceSettings>
	): Promise<void> {
		await key.setImage(
			musicCastKeyImage(this.icon, keySettingsCache.get(key.id))
		);
	}
}

import {
	action,
	type KeyDownEvent,
	type KeyAction,
	type WillAppearEvent,
	type WillDisappearEvent,
	SingletonAction,
	streamDeck,
} from "@elgato/streamdeck";

import { MusicCastClient } from "../musiccast/client.js";
import { MusicCastSettingsCache } from "../musiccast/settings-cache.js";
import {
	normalizeHost,
	sourceCycle,
	type MusicCastDeviceSettings,
} from "../musiccast/settings.js";
import { onSharedSettingsChanged } from "../musiccast/shared-settings.js";
import { sourceKeyImage } from "../musiccast/source-icon.js";
import { resolveVolumeColors } from "../musiccast/volume-colors.js";

const UUID =
	"com.xander-dumaine-xanderxdumainecom.musiccast-unofficial.source-toggle";

@action({ UUID })
export class SourceToggleKey extends SingletonAction<MusicCastDeviceSettings> {
	private readonly settingsCache = new MusicCastSettingsCache();
	private readonly activeKeys = new Map<
		string,
		KeyAction<MusicCastDeviceSettings>
	>();
	private readonly inputCache = new Map<string, string | undefined>();
	private readonly unsubscribeShared = onSharedSettingsChanged(() => {
		for (const key of this.activeKeys.values()) {
			void this.paint(
				key,
				this.inputCache.get(key.id),
				this.settingsCache.get(key.id)
			);
		}
	});

	override async onWillAppear(
		ev: WillAppearEvent<MusicCastDeviceSettings>
	): Promise<void> {
		const settings = this.settingsCache.merge(
			ev.action.id,
			ev.payload.settings
		);
		if (!ev.action.isKey()) return;
		this.activeKeys.set(ev.action.id, ev.action);
		await this.refresh(ev.action, settings);
	}

	override onWillDisappear(
		ev: WillDisappearEvent<MusicCastDeviceSettings>
	): void {
		this.activeKeys.delete(ev.action.id);
		this.inputCache.delete(ev.action.id);
		this.settingsCache.delete(ev.action.id);
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
			await this.paint(key, next, settings);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.error(`Source toggle: ${msg}`);
			await key.showAlert();
		}
	}

	private async refresh(
		key: KeyAction<MusicCastDeviceSettings>,
		settings = this.settingsCache.get(key.id)
	): Promise<void> {
		if (!normalizeHost(settings.host)) {
			await this.paint(key, undefined, settings);
			return;
		}
		try {
			const client = MusicCastClient.fromSettings(settings);
			const status = await client.getZoneStatus();
			await this.paint(key, (status.input ?? "").toString(), settings);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.warn(`Source refresh: ${msg}`);
			await this.paint(key, undefined, settings);
		}
	}

	private async paint(
		key: KeyAction<MusicCastDeviceSettings>,
		input: string | undefined,
		settings: MusicCastDeviceSettings
	): Promise<void> {
		this.inputCache.set(key.id, input);
		const colors = resolveVolumeColors(settings);
		await key.setImage(
			sourceKeyImage(input, {
				background: colors.background,
				accent: colors.level,
				foreground: colors.number,
				muted: colors.subtitle,
			})
		);
		await key.setTitle("");
	}
}

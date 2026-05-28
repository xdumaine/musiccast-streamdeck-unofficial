import {
	action,
	type DialAction,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	type FeedbackPayload,
	type TouchTapEvent,
	type DialUpEvent,
	SingletonAction,
	streamDeck,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import type { NetPlayInfo } from "../musiccast/client.js";
import { MusicCastClient } from "../musiccast/client.js";
import {
	buildCurrentPlayingErrorFeedback,
	buildCurrentPlayingFeedback,
	buildCurrentPlayingLoadingFeedback,
	buildCurrentPlayingStandbyFeedback,
} from "../musiccast/current-playing-feedback.js";
import { isPowerOn } from "../musiccast/power-icon-svg.js";
import { MusicCastSettingsCache } from "../musiccast/settings-cache.js";
import {
	clampPollSeconds,
	normalizeHost,
	type MusicCastDeviceSettings,
} from "../musiccast/settings.js";
import { onSharedSettingsChanged } from "../musiccast/shared-settings.js";

const UUID =
	"com.xander-dumaine-xanderxdumainecom.musiccast-unofficial.current-playing";
const LAYOUT = "current-playing-dial.json";
/** Debounce property-inspector updates before restarting poll. */
const SETTINGS_DEBOUNCE_MS = 500;

@action({ UUID })
export class CurrentPlayingDial extends SingletonAction<MusicCastDeviceSettings> {
	private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
	private readonly inFlight = new Set<string>();
	private readonly settingsCache = new MusicCastSettingsCache();
	private readonly infoCache = new Map<string, NetPlayInfo>();
	private readonly albumArtByAction = new Map<string, string | undefined>();
	private readonly albumArtByUrl = new Map<string, string>();
	private readonly lastFeedback = new Map<string, FeedbackPayload>();
	private readonly powerOnByAction = new Map<string, boolean>();
	private readonly settingsDebounce = new Map<
		string,
		ReturnType<typeof setTimeout>
	>();
	private readonly activeDials = new Map<
		string,
		DialAction<MusicCastDeviceSettings>
	>();
	private readonly unsubscribeShared = onSharedSettingsChanged(() => {
		for (const dial of this.activeDials.values()) {
			const settings = this.settingsCache.get(dial.id);
			if (this.powerOnByAction.get(dial.id) === false) {
				void this.showFeedback(
					dial,
					buildCurrentPlayingStandbyFeedback(settings)
				);
				continue;
			}
			const info = this.infoCache.get(dial.id);
			if (!info) continue;
			void this.showFeedback(
				dial,
				buildCurrentPlayingFeedback(settings, info, {
					albumArtUri: this.albumArtByAction.get(dial.id),
				})
			);
		}
	});

	override async onWillAppear(
		ev: WillAppearEvent<MusicCastDeviceSettings>
	): Promise<void> {
		if (!ev.action.isDial()) return;
		const dial = ev.action;
		this.activeDials.set(dial.id, dial);
		this.settingsCache.merge(dial.id, ev.payload.settings);
		await this.applyLayout(dial);
		await dial.setTriggerDescription({
			rotate: "Refresh now playing",
			touch: "Refresh now playing",
			push: "Refresh now playing",
			longTouch: "Refresh now playing",
		});
		void this.hydrateSettings(dial);
		this.startPoll(dial);
	}

	override onWillDisappear(
		ev: WillDisappearEvent<MusicCastDeviceSettings>
	): void {
		const id = ev.action.id;
		this.stopPoll(id);
		this.inFlight.delete(id);
		this.settingsCache.delete(id);
		this.infoCache.delete(id);
		this.albumArtByAction.delete(id);
		this.lastFeedback.delete(id);
		this.powerOnByAction.delete(id);
		this.clearSettingsDebounce(id);
		this.activeDials.delete(id);
	}

	override onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<MusicCastDeviceSettings>
	): void {
		if (!ev.action.isDial()) return;
		this.settingsCache.merge(ev.action.id, ev.payload.settings);
		this.schedulePollRestart(ev.action);
	}

	override async onDialRotate(
		ev: DialRotateEvent<MusicCastDeviceSettings>
	): Promise<void> {
		if (!ev.action.isDial()) return;
		const settings = this.settingsCache.merge(
			ev.action.id,
			ev.payload.settings
		);
		await this.refresh(ev.action, settings);
	}

	override async onDialUp(
		ev: DialUpEvent<MusicCastDeviceSettings>
	): Promise<void> {
		if (!ev.action.isDial()) return;
		const settings = this.settingsCache.merge(
			ev.action.id,
			ev.payload.settings
		);
		await this.refresh(ev.action, settings);
	}

	override async onTouchTap(
		ev: TouchTapEvent<MusicCastDeviceSettings>
	): Promise<void> {
		if (!ev.action.isDial()) return;
		const settings = this.settingsCache.merge(
			ev.action.id,
			ev.payload.settings
		);
		await this.refresh(ev.action, settings);
	}

	private async hydrateSettings(
		dial: DialAction<MusicCastDeviceSettings>
	): Promise<void> {
		try {
			const fromSd = await dial.getSettings();
			this.settingsCache.merge(dial.id, fromSd);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.warn(`Now playing getSettings failed: ${msg}`);
		}
	}

	private clearSettingsDebounce(actionId: string): void {
		const timer = this.settingsDebounce.get(actionId);
		if (!timer) return;
		clearTimeout(timer);
		this.settingsDebounce.delete(actionId);
	}

	private schedulePollRestart(dial: DialAction<MusicCastDeviceSettings>): void {
		this.clearSettingsDebounce(dial.id);
		const timer = setTimeout(() => {
			this.settingsDebounce.delete(dial.id);
			this.startPoll(dial);
		}, SETTINGS_DEBOUNCE_MS);
		this.settingsDebounce.set(dial.id, timer);
	}

	private startPoll(dial: DialAction<MusicCastDeviceSettings>): void {
		this.stopPoll(dial.id);
		void this.refresh(dial, this.settingsCache.get(dial.id));
		void this.hydrateSettings(dial).then(() => {
			const sec = clampPollSeconds(this.settingsCache.get(dial.id).pollSeconds);
			const timer = setInterval(() => {
				void this.refresh(dial, this.settingsCache.get(dial.id));
			}, sec * 1000);
			this.timers.set(dial.id, timer);
		});
	}

	private stopPoll(actionId: string): void {
		const timer = this.timers.get(actionId);
		if (timer) {
			clearInterval(timer);
			this.timers.delete(actionId);
		}
	}

	private async refresh(
		dial: DialAction<MusicCastDeviceSettings>,
		settings: MusicCastDeviceSettings
	): Promise<void> {
		if (this.inFlight.has(dial.id)) return;
		this.inFlight.add(dial.id);
		try {
			if (!normalizeHost(settings.host)) {
				await this.showFeedback(
					dial,
					buildCurrentPlayingErrorFeedback(settings, "Set device IP")
				);
				return;
			}
			const client = MusicCastClient.fromSettings(settings);
			const status = await client.getZoneStatus();
			const power = (status.power ?? "").toString();
			if (!isPowerOn(power)) {
				this.powerOnByAction.set(dial.id, false);
				await this.showFeedback(
					dial,
					buildCurrentPlayingStandbyFeedback(settings)
				);
				return;
			}
			this.powerOnByAction.set(dial.id, true);

			if (!this.infoCache.has(dial.id)) {
				await this.showFeedback(
					dial,
					buildCurrentPlayingLoadingFeedback(settings)
				);
			}

			const info = await client.getNetPlayInfo();
			const albumArtUrl = this.albumArtUrlFromInfo(client, info);
			const cachedAlbumArt =
				(albumArtUrl ? this.albumArtByUrl.get(albumArtUrl) : undefined) ??
				this.albumArtByAction.get(dial.id);
			this.infoCache.set(dial.id, info);
			this.albumArtByAction.set(dial.id, cachedAlbumArt);
			await this.showFeedback(
				dial,
				buildCurrentPlayingFeedback(settings, info, {
					albumArtUri: cachedAlbumArt,
				})
			);
			if (settings.showAlbumArt !== false) {
				void this.refreshAlbumArt(dial, settings, client, info);
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.warn(`Now playing refresh: ${msg}`);
			if (this.powerOnByAction.get(dial.id) === false) {
				await this.showFeedback(
					dial,
					buildCurrentPlayingStandbyFeedback(settings)
				);
				return;
			}
			await this.showFeedback(
				dial,
				buildCurrentPlayingErrorFeedback(settings, msg)
			);
		} finally {
			this.inFlight.delete(dial.id);
		}
	}

	private async showFeedback(
		dial: DialAction<MusicCastDeviceSettings>,
		feedback: FeedbackPayload
	): Promise<void> {
		const prev = this.lastFeedback.get(dial.id);
		if (prev && feedbackPayloadEqual(prev, feedback)) return;
		this.lastFeedback.set(dial.id, feedback);
		await dial.setFeedback(feedback);
	}

	private async applyLayout(
		dial: DialAction<MusicCastDeviceSettings>
	): Promise<void> {
		try {
			await dial.setFeedbackLayout(LAYOUT);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.error(`Now playing layout failed: ${msg}`);
			throw e;
		}
	}

	private async refreshAlbumArt(
		dial: DialAction<MusicCastDeviceSettings>,
		settings: MusicCastDeviceSettings,
		client: MusicCastClient,
		info: NetPlayInfo
	): Promise<void> {
		if (this.powerOnByAction.get(dial.id) === false) return;
		const albumArtUri = await this.albumArtFromInfo(client, info);
		if (!albumArtUri || this.powerOnByAction.get(dial.id) === false) return;
		this.albumArtByAction.set(dial.id, albumArtUri);
		await this.showFeedback(
			dial,
			buildCurrentPlayingFeedback(settings, info, { albumArtUri })
		);
	}

	private async albumArtFromInfo(
		client: MusicCastClient,
		info: NetPlayInfo
	): Promise<string | undefined> {
		const url = this.albumArtUrlFromInfo(client, info);
		if (!url) return undefined;
		const cached = this.albumArtByUrl.get(url);
		if (cached) return cached;
		try {
			const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const bytes = Buffer.from(await res.arrayBuffer());
			const contentType = res.headers.get("content-type") ?? "image/jpeg";
			const dataUri = `data:${contentType};base64,${bytes.toString("base64")}`;
			this.albumArtByUrl.set(url, dataUri);
			return dataUri;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.warn(`Album art fetch failed: ${msg}`);
			return undefined;
		}
	}

	private albumArtUrl(client: MusicCastClient, raw: string): string {
		if (/^https?:\/\//i.test(raw)) return raw;
		return new URL(raw, `http://${client.host}`).toString();
	}

	private albumArtUrlFromInfo(
		client: MusicCastClient,
		info: NetPlayInfo
	): string | undefined {
		const raw =
			typeof info.albumart_url === "string" ? info.albumart_url.trim() : "";
		if (!raw) return undefined;
		return this.albumArtUrl(client, raw);
	}
}

function feedbackPayloadEqual(a: FeedbackPayload, b: FeedbackPayload): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

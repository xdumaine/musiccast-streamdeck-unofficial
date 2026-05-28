import {
	action,
	type DidReceiveSettingsEvent,
	type KeyAction,
	type KeyDownEvent,
	SingletonAction,
	streamDeck,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import type { NetPlayInfo } from "../musiccast/client.js";
import { MusicCastClient } from "../musiccast/client.js";
import { MusicCastSettingsCache } from "../musiccast/settings-cache.js";
import {
	clampPollSeconds,
	normalizeHost,
	type MusicCastDeviceSettings,
} from "../musiccast/settings.js";
import { onSharedSettingsChanged } from "../musiccast/shared-settings.js";
import { sourceKeyImage } from "../musiccast/source-icon.js";
import { resolveVolumeColors } from "../musiccast/volume-colors.js";

const UUID =
	"com.xander-dumaine-xanderxdumainecom.musiccast-unofficial.album-art";

function escapeXmlAttr(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function coverKeyImage(dataUri: string): string {
	const svg =
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72" width="72" height="72">` +
		`<defs><clipPath id="cover"><rect x="0" y="0" width="72" height="72" rx="13" ry="13"/></clipPath></defs>` +
		`<image x="0" y="0" width="72" height="72" href="${escapeXmlAttr(
			dataUri
		)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cover)"/>` +
		`</svg>`;
	return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

@action({ UUID })
export class AlbumArtKey extends SingletonAction<MusicCastDeviceSettings> {
	private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
	private readonly inFlight = new Set<string>();
	private readonly settingsCache = new MusicCastSettingsCache();
	private readonly artByAction = new Map<string, string | undefined>();
	private readonly artByUrl = new Map<string, string>();
	private readonly inputByAction = new Map<string, string | undefined>();
	private readonly activeKeys = new Map<string, KeyAction<MusicCastDeviceSettings>>();
	private readonly unsubscribeShared = onSharedSettingsChanged(() => {
		for (const key of this.activeKeys.values()) {
			void this.paint(key, this.settingsCache.get(key.id));
		}
	});

	override async onWillAppear(
		ev: WillAppearEvent<MusicCastDeviceSettings>
	): Promise<void> {
		if (!ev.action.isKey()) return;
		const key = ev.action;
		this.activeKeys.set(key.id, key);
		const settings = this.settingsCache.merge(key.id, ev.payload.settings);
		await key.setTitle("");
		await this.refresh(key, settings);
		this.startPoll(key);
	}

	override onWillDisappear(
		ev: WillDisappearEvent<MusicCastDeviceSettings>
	): void {
		const id = ev.action.id;
		this.stopPoll(id);
		this.inFlight.delete(id);
		this.settingsCache.delete(id);
		this.artByAction.delete(id);
		this.inputByAction.delete(id);
		this.activeKeys.delete(id);
	}

	override onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<MusicCastDeviceSettings>
	): void {
		if (!ev.action.isKey()) return;
		this.settingsCache.merge(ev.action.id, ev.payload.settings);
		this.startPoll(ev.action);
		void this.refresh(ev.action, this.settingsCache.get(ev.action.id));
	}

	override async onKeyDown(
		ev: KeyDownEvent<MusicCastDeviceSettings>
	): Promise<void> {
		if (!ev.action.isKey()) return;
		const settings = this.settingsCache.merge(ev.action.id, ev.payload.settings);
		await this.refresh(ev.action, settings);
	}

	private startPoll(key: KeyAction<MusicCastDeviceSettings>): void {
		this.stopPoll(key.id);
		const sec = clampPollSeconds(this.settingsCache.get(key.id).pollSeconds);
		const timer = setInterval(() => {
			void this.refresh(key, this.settingsCache.get(key.id));
		}, sec * 1000);
		this.timers.set(key.id, timer);
	}

	private stopPoll(actionId: string): void {
		const timer = this.timers.get(actionId);
		if (!timer) return;
		clearInterval(timer);
		this.timers.delete(actionId);
	}

	private async refresh(
		key: KeyAction<MusicCastDeviceSettings>,
		settings: MusicCastDeviceSettings
	): Promise<void> {
		if (this.inFlight.has(key.id)) return;
		this.inFlight.add(key.id);
		try {
			if (!normalizeHost(settings.host)) {
				this.artByAction.delete(key.id);
				this.inputByAction.delete(key.id);
				await this.paint(key, settings);
				return;
			}
			const client = MusicCastClient.fromSettings(settings);
			const info = await client.getNetPlayInfo();
			const art = await this.albumArtFromInfo(client, info);
			this.artByAction.set(key.id, art);
			this.inputByAction.set(key.id, info.input);
			await this.paint(key, settings);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.warn(`Album art key refresh: ${msg}`);
			await key.showAlert();
		} finally {
			this.inFlight.delete(key.id);
		}
	}

	private async paint(
		key: KeyAction<MusicCastDeviceSettings>,
		settings: MusicCastDeviceSettings
	): Promise<void> {
		const art = this.artByAction.get(key.id);
		if (art) {
			await key.setImage(coverKeyImage(art));
			await key.setTitle("");
			return;
		}
		const colors = resolveVolumeColors(settings);
		await key.setImage(
			sourceKeyImage(this.inputByAction.get(key.id), {
				background: colors.background,
				accent: colors.level,
				foreground: colors.number,
				muted: colors.subtitle,
			})
		);
		await key.setTitle("");
	}

	private async albumArtFromInfo(
		client: MusicCastClient,
		info: NetPlayInfo
	): Promise<string | undefined> {
		const raw =
			typeof info.albumart_url === "string" ? info.albumart_url.trim() : "";
		if (!raw) return undefined;
		const url = this.albumArtUrl(client, raw);
		const cached = this.artByUrl.get(url);
		if (cached) return cached;
		const res = await fetch(url, { signal: AbortSignal.timeout(3_000) });
		if (!res.ok) throw new Error(`Album art HTTP ${res.status}`);
		const bytes = Buffer.from(await res.arrayBuffer());
		const contentType = res.headers.get("content-type") ?? "image/jpeg";
		const dataUri = `data:${contentType};base64,${bytes.toString("base64")}`;
		this.artByUrl.set(url, dataUri);
		return dataUri;
	}

	private albumArtUrl(client: MusicCastClient, raw: string): string {
		if (/^https?:\/\//i.test(raw)) return raw;
		return new URL(raw, `http://${client.host}`).toString();
	}
}


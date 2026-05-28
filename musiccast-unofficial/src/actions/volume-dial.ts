import {
	action,
	type DialAction,
	type DialRotateEvent,
	type DidReceiveSettingsEvent,
	type DialUpEvent,
	type FeedbackPayload,
	SingletonAction,
	streamDeck,
	type TouchTapEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { MusicCastClient } from "../musiccast/client.js";
import { MusicCastSettingsCache } from "../musiccast/settings-cache.js";
import {
	clampPollSeconds,
	normalizeHost,
	type MusicCastDeviceSettings,
	volumeDialLayoutFile,
} from "../musiccast/settings.js";
import { onSharedSettingsChanged } from "../musiccast/shared-settings.js";
import {
	buildErrorFeedback,
	buildUnconfiguredFeedback,
	buildVolumeFeedback,
} from "../musiccast/volume-feedback.js";

const UUID = "com.xander-dumaine-xanderxdumainecom.musiccast-unofficial.volume";
const DEFAULT_MAX_VOLUME = 100;
/** Debounce property-inspector updates before restarting poll. */
const SETTINGS_DEBOUNCE_MS = 500;
/** Coalesce rapid getStatus syncs after dial rotation (display updates instantly). */
const SYNC_DEBOUNCE_MS = 120;
/** Max gap between dial pushes to count as double-press (power toggle). */
const DOUBLE_PRESS_MS = 400;

type CachedStatus = {
	vol?: number;
	max: number;
	muted: boolean;
	power: string;
};

type RefreshOpts = {
	settings?: MusicCastDeviceSettings;
	/** Background interval poll — honors pollSeconds. */
	poll?: boolean;
	/** User changed volume/mute/power — fetch now, skip poll interval. */
	immediate?: boolean;
};

@action({ UUID })
export class VolumeDial extends SingletonAction<MusicCastDeviceSettings> {
	private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
	private readonly inFlight = new Set<string>();
	private readonly pollGeneration = new Map<string, number>();
	private readonly lastFeedback = new Map<string, FeedbackPayload>();
	private readonly maxVolumeByAction = new Map<string, number>();
	private readonly lastFetchEndMs = new Map<string, number>();
	private readonly settingsCache = new MusicCastSettingsCache();
	private readonly activeDials = new Map<
		string,
		DialAction<MusicCastDeviceSettings>
	>();
	private readonly statusCache = new Map<string, CachedStatus>();
	private readonly pendingImmediate = new Set<string>();
	private readonly syncDebounce = new Map<
		string,
		ReturnType<typeof setTimeout>
	>();
	private readonly settingsDebounce = new Map<
		string,
		ReturnType<typeof setTimeout>
	>();
	private readonly volumeChain = new Map<string, Promise<void>>();
	private readonly layoutByAction = new Map<string, string>();
	/** Delayed single-press (mute); cancelled when a second press arrives in time. */
	private readonly singlePressTimer = new Map<
		string,
		ReturnType<typeof setTimeout>
	>();
	private readonly unsubscribeShared = onSharedSettingsChanged(() => {
		for (const dial of this.activeDials.values()) {
			this.paintFromCache(dial, this.settingsCache.get(dial.id));
		}
	});

	override async onWillAppear(
		ev: WillAppearEvent<MusicCastDeviceSettings>
	): Promise<void> {
		if (!ev.action.isDial()) return;
		const dial = ev.action;
		this.activeDials.set(dial.id, dial);
		const settings = this.settingsCache.merge(dial.id, ev.payload.settings);
		await this.applyLayout(dial, settings);
		await dial.setTriggerDescription({
			rotate: "Volume up / down",
			touch: "Refresh volume",
			push: "Mute · double-press power",
			longTouch: "Refresh volume",
		});
		void this.hydrateSettings(dial);
		this.startPoll(dial);
	}

	override onWillDisappear(
		ev: WillDisappearEvent<MusicCastDeviceSettings>
	): void {
		const id = ev.action.id;
		this.stopPoll(id);
		this.clearDebounce(id);
		this.inFlight.delete(id);
		this.pollGeneration.delete(id);
		this.lastFeedback.delete(id);
		this.maxVolumeByAction.delete(id);
		this.lastFetchEndMs.delete(id);
		this.settingsCache.delete(id);
		this.volumeChain.delete(id);
		this.layoutByAction.delete(id);
		this.statusCache.delete(id);
		this.pendingImmediate.delete(id);
		this.activeDials.delete(id);
	}

	override onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<MusicCastDeviceSettings>
	): void {
		if (!ev.action.isDial()) return;
		const dial = ev.action;
		const prev = this.settingsCache.get(dial.id);
		const hostChanged = this.settingsCache.hostChanged(
			dial.id,
			ev.payload.settings
		);
		if (hostChanged) {
			this.maxVolumeByAction.delete(dial.id);
		}
		const merged = this.settingsCache.get(dial.id);
		const layoutChanged =
			volumeDialLayoutFile(prev) !== volumeDialLayoutFile(merged);
		if (layoutChanged) {
			void this.applyLayout(dial, merged);
		}
		this.schedulePollRestart(dial);
	}

	override async onDialRotate(
		ev: DialRotateEvent<MusicCastDeviceSettings>
	): Promise<void> {
		if (!ev.action.isDial()) return;
		const dial = ev.action;
		const ticks = ev.payload.ticks;
		if (ticks === 0) return;

		const settings = this.settingsCache.merge(dial.id, ev.payload.settings);
		if (!normalizeHost(settings.host)) {
			await this.refresh(dial, { settings });
			return;
		}

		const direction = ticks > 0 ? "up" : "down";
		const steps = Math.min(Math.abs(ticks), 8);

		try {
			await this.enqueueVolumeStep(dial.id, settings, direction, steps);
			if (this.bumpVolumeCache(dial.id, direction, steps)) {
				this.paintFromCache(dial, settings);
			}
			this.scheduleImmediateSync(dial, settings);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.error(`Volume step: ${msg}`);
			await dial.showAlert();
		}
	}

	override onDialUp(ev: DialUpEvent<MusicCastDeviceSettings>): void {
		if (!ev.action.isDial()) return;
		const dial = ev.action;
		const settings = this.settingsCache.merge(dial.id, ev.payload.settings);

		const pending = this.singlePressTimer.get(dial.id);
		if (pending) {
			clearTimeout(pending);
			this.singlePressTimer.delete(dial.id);
			void this.togglePower(dial, settings);
			return;
		}

		const timer = setTimeout(() => {
			this.singlePressTimer.delete(dial.id);
			void this.toggleMute(dial, settings);
		}, DOUBLE_PRESS_MS);
		this.singlePressTimer.set(dial.id, timer);
	}

	private async toggleMute(
		dial: DialAction<MusicCastDeviceSettings>,
		settings: MusicCastDeviceSettings
	): Promise<void> {
		if (!normalizeHost(settings.host)) {
			await this.refresh(dial, { settings });
			return;
		}
		try {
			const client = MusicCastClient.fromSettings(settings);
			const status = await client.getZoneStatus();
			const muted = status.mute === true;
			this.updateStatusCache(dial.id, {
				muted: !muted,
				vol: typeof status.volume === "number" ? status.volume : undefined,
				power: (status.power ?? "").toString(),
			});
			this.paintFromCache(dial, settings);
			await client.setMute(!muted);
			await this.refresh(dial, { settings, immediate: true });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.error(`Mute toggle: ${msg}`);
			await dial.showAlert();
		}
	}

	private async togglePower(
		dial: DialAction<MusicCastDeviceSettings>,
		settings: MusicCastDeviceSettings
	): Promise<void> {
		if (!normalizeHost(settings.host)) {
			await this.refresh(dial, { settings });
			return;
		}
		try {
			const client = MusicCastClient.fromSettings(settings);
			await client.setPower("toggle");
			await this.refresh(dial, { settings, immediate: true });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.error(`Power toggle: ${msg}`);
			await dial.showAlert();
		}
	}

	override async onTouchTap(
		ev: TouchTapEvent<MusicCastDeviceSettings>
	): Promise<void> {
		if (!ev.action.isDial()) return;
		const settings = this.settingsCache.merge(
			ev.action.id,
			ev.payload.settings
		);
		await this.refresh(ev.action, { settings, immediate: true });
	}

	private clearDebounce(actionId: string): void {
		const r = this.syncDebounce.get(actionId);
		if (r) {
			clearTimeout(r);
			this.syncDebounce.delete(actionId);
		}
		const s = this.settingsDebounce.get(actionId);
		if (s) {
			clearTimeout(s);
			this.settingsDebounce.delete(actionId);
		}
		const p = this.singlePressTimer.get(actionId);
		if (p) {
			clearTimeout(p);
			this.singlePressTimer.delete(actionId);
		}
	}

	private scheduleImmediateSync(
		dial: DialAction<MusicCastDeviceSettings>,
		settings: MusicCastDeviceSettings
	): void {
		const existing = this.syncDebounce.get(dial.id);
		if (existing) clearTimeout(existing);
		const timer = setTimeout(() => {
			this.syncDebounce.delete(dial.id);
			void this.refresh(dial, { settings, immediate: true });
		}, SYNC_DEBOUNCE_MS);
		this.syncDebounce.set(dial.id, timer);
	}

	private updateStatusCache(
		actionId: string,
		partial: Partial<CachedStatus>
	): void {
		const prev = this.statusCache.get(actionId) ?? {
			max: this.maxVolumeByAction.get(actionId) ?? DEFAULT_MAX_VOLUME,
			muted: false,
			power: "",
		};
		const max =
			partial.max ??
			this.maxVolumeByAction.get(actionId) ??
			prev.max ??
			DEFAULT_MAX_VOLUME;
		this.statusCache.set(actionId, {
			vol: partial.vol ?? prev.vol,
			max,
			muted: partial.muted ?? prev.muted,
			power: partial.power ?? prev.power,
		});
	}

	private bumpVolumeCache(
		actionId: string,
		direction: "up" | "down",
		steps: number
	): boolean {
		const cached = this.statusCache.get(actionId);
		if (!cached || cached.vol === undefined) return false;
		const max = this.maxVolumeByAction.get(actionId) ?? cached.max;
		const delta = direction === "up" ? steps : -steps;
		const next = Math.max(0, Math.min(max, cached.vol + delta));
		this.statusCache.set(actionId, { ...cached, vol: next, max });
		return true;
	}

	private paintFromCache(
		dial: DialAction<MusicCastDeviceSettings>,
		settings: MusicCastDeviceSettings
	): void {
		const host = normalizeHost(settings.host);
		if (!host) return;
		const c = this.statusCache.get(dial.id);
		if (!c) return;
		void this.showFeedback(
			dial.id,
			dial,
			buildVolumeFeedback(settings, {
				host,
				vol: c.vol,
				max: c.max,
				muted: c.muted,
				power: c.power,
			})
		);
	}

	private schedulePollRestart(dial: DialAction<MusicCastDeviceSettings>): void {
		const existing = this.settingsDebounce.get(dial.id);
		if (existing) clearTimeout(existing);
		const timer = setTimeout(() => {
			this.settingsDebounce.delete(dial.id);
			const settings = this.settingsCache.get(dial.id);
			void this.applyLayout(dial, settings).then(() => {
				this.stopPoll(dial.id);
				this.startPoll(dial);
			});
		}, SETTINGS_DEBOUNCE_MS);
		this.settingsDebounce.set(dial.id, timer);
	}

	private async applyLayout(
		dial: DialAction<MusicCastDeviceSettings>,
		settings: MusicCastDeviceSettings
	): Promise<void> {
		const layout = volumeDialLayoutFile(settings);
		if (this.layoutByAction.get(dial.id) === layout) return;
		this.layoutByAction.set(dial.id, layout);
		this.lastFeedback.delete(dial.id);
		await dial.setFeedbackLayout(layout);
	}

	private async hydrateSettings(
		dial: DialAction<MusicCastDeviceSettings>
	): Promise<void> {
		try {
			const fromSd = await dial.getSettings();
			this.settingsCache.merge(dial.id, fromSd);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.warn(`getSettings failed: ${msg}`);
		}
	}

	private enqueueVolumeStep(
		actionId: string,
		settings: MusicCastDeviceSettings,
		direction: "up" | "down",
		steps: number
	): Promise<void> {
		const prev = this.volumeChain.get(actionId) ?? Promise.resolve();
		const next = prev
			.then(async () => {
				const client = MusicCastClient.fromSettings(settings);
				await client.setVolumeStep(direction, steps);
			})
			.catch((e) => {
				throw e;
			});
		this.volumeChain.set(
			actionId,
			next.catch(() => {
				/* swallow so chain continues */
			})
		);
		return next;
	}

	private stopPoll(actionId: string): void {
		const t = this.timers.get(actionId);
		if (t) {
			clearInterval(t);
			this.timers.delete(actionId);
		}
	}

	private startPoll(dial: DialAction<MusicCastDeviceSettings>): void {
		this.stopPoll(dial.id);
		const gen = (this.pollGeneration.get(dial.id) ?? 0) + 1;
		this.pollGeneration.set(dial.id, gen);

		const cached = this.lastFeedback.get(dial.id);
		if (cached) {
			void dial.setFeedback(cached);
		}
		void this.refresh(dial, {
			settings: this.settingsCache.get(dial.id),
			immediate: true,
		});

		void this.hydrateSettings(dial).then(() => {
			if (this.pollGeneration.get(dial.id) !== gen) return;
			const settings = this.settingsCache.get(dial.id);
			const sec = clampPollSeconds(settings.pollSeconds);
			const id = setInterval(() => {
				void this.refresh(dial, {
					settings: this.settingsCache.get(dial.id),
					poll: true,
				});
			}, sec * 1000);
			if (this.pollGeneration.get(dial.id) !== gen) {
				clearInterval(id);
				return;
			}
			this.timers.set(dial.id, id);
		});
	}

	private async refresh(
		dial: DialAction<MusicCastDeviceSettings>,
		opts?: RefreshOpts
	): Promise<void> {
		const immediate = opts?.immediate === true;
		const poll = opts?.poll === true;

		if (poll && !immediate) {
			const last = this.lastFetchEndMs.get(dial.id) ?? 0;
			const sec = clampPollSeconds(this.settingsCache.get(dial.id).pollSeconds);
			if (last > 0 && Date.now() - last < sec * 1000) return;
		}

		if (this.inFlight.has(dial.id)) {
			if (immediate) this.pendingImmediate.add(dial.id);
			return;
		}

		this.inFlight.add(dial.id);
		try {
			if (opts?.settings) {
				this.settingsCache.merge(dial.id, opts.settings);
			} else if (!normalizeHost(this.settingsCache.get(dial.id).host)) {
				await this.hydrateSettings(dial);
			}

			const settings = this.settingsCache.get(dial.id);
			await this.applyLayout(dial, settings);

			const host = normalizeHost(settings.host);
			if (!host) {
				await this.showFeedback(
					dial.id,
					dial,
					buildUnconfiguredFeedback(settings)
				);
				return;
			}

			const client = MusicCastClient.fromSettings(settings);
			await this.loadMaxVolume(dial.id, client);

			const status = await client.getZoneStatus();
			const max =
				this.maxVolumeByAction.get(dial.id) ??
				(typeof status.max_volume === "number"
					? status.max_volume
					: DEFAULT_MAX_VOLUME);
			const vol = typeof status.volume === "number" ? status.volume : undefined;
			const muted = status.mute === true;
			const power = (status.power ?? "").toString();

			this.updateStatusCache(dial.id, { vol, max, muted, power });
			await this.showFeedback(
				dial.id,
				dial,
				buildVolumeFeedback(settings, { host, vol, max, muted, power })
			);
			this.lastFetchEndMs.set(dial.id, Date.now());
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			const settings = this.settingsCache.get(dial.id);
			const host = normalizeHost(settings.host) ?? "?";
			streamDeck.logger.warn(`Volume dial refresh (${host}): ${msg}`);
			await this.showFeedback(
				dial.id,
				dial,
				buildErrorFeedback(settings, host, msg)
			);
		} finally {
			this.inFlight.delete(dial.id);
			if (this.pendingImmediate.delete(dial.id)) {
				void this.refresh(dial, {
					settings: this.settingsCache.get(dial.id),
					immediate: true,
				});
			}
		}
	}

	private async showFeedback(
		actionId: string,
		dial: DialAction<MusicCastDeviceSettings>,
		fb: FeedbackPayload
	): Promise<void> {
		this.lastFeedback.set(actionId, fb);
		await dial.setFeedback(fb);
	}

	private async loadMaxVolume(
		actionId: string,
		client: MusicCastClient
	): Promise<void> {
		if (this.maxVolumeByAction.has(actionId)) return;
		try {
			const features = await client.getFeatures();
			const max = features.volume?.max;
			if (typeof max === "number" && max > 0) {
				this.maxVolumeByAction.set(actionId, max);
			}
		} catch {
			// optional
		}
	}
}

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

import { MusicCastClient } from "../musiccast/client.js";
import { MusicCastSettingsCache } from "../musiccast/settings-cache.js";
import {
	clampPollSeconds,
	normalizeHost,
	sourceCycle,
	type MusicCastDeviceSettings,
} from "../musiccast/settings.js";
import {
	buildSourceErrorFeedback,
	buildSourceFeedback,
} from "../musiccast/source-feedback.js";
import { onSharedSettingsChanged } from "../musiccast/shared-settings.js";

const UUID =
	"com.xander-dumaine-xanderxdumainecom.musiccast-unofficial.source-dial";
const LAYOUT = "source-dial.json";

function nextSource(
	settings: MusicCastDeviceSettings,
	current: string | undefined,
	direction: "next" | "previous"
): string {
	const cycle = sourceCycle(settings);
	if (cycle.length === 0) {
		throw new Error("No source cycle configured");
	}
	const idx = cycle.indexOf((current ?? "").trim());
	if (idx < 0) return cycle[0];
	const delta = direction === "next" ? 1 : -1;
	return cycle[(idx + delta + cycle.length) % cycle.length] ?? cycle[0];
}

@action({ UUID })
export class SourceDial extends SingletonAction<MusicCastDeviceSettings> {
	private readonly timers = new Map<string, ReturnType<typeof setInterval>>();
	private readonly inFlight = new Set<string>();
	private readonly settingsCache = new MusicCastSettingsCache();
	private readonly inputCache = new Map<string, string>();
	private readonly lastFeedback = new Map<string, FeedbackPayload>();
	private readonly activeDials = new Map<string, DialAction<MusicCastDeviceSettings>>();
	private readonly unsubscribeShared = onSharedSettingsChanged(() => {
		for (const dial of this.activeDials.values()) {
			const input = this.inputCache.get(dial.id);
			void this.showFeedback(
				dial,
				buildSourceFeedback(this.settingsCache.get(dial.id), input)
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
		await dial.setFeedbackLayout(LAYOUT);
		await dial.setTriggerDescription({
			rotate: "Previous / next source",
			touch: "Refresh source",
			push: "Refresh source",
			longTouch: "Refresh source",
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
		this.inputCache.delete(id);
		this.lastFeedback.delete(id);
		this.activeDials.delete(id);
	}

	override onDidReceiveSettings(
		ev: DidReceiveSettingsEvent<MusicCastDeviceSettings>
	): void {
		if (!ev.action.isDial()) return;
		this.settingsCache.merge(ev.action.id, ev.payload.settings);
		this.startPoll(ev.action);
	}

	override async onDialRotate(
		ev: DialRotateEvent<MusicCastDeviceSettings>
	): Promise<void> {
		if (!ev.action.isDial()) return;
		const ticks = ev.payload.ticks;
		if (ticks === 0) return;

		const dial = ev.action;
		const settings = this.settingsCache.merge(dial.id, ev.payload.settings);
		if (!normalizeHost(settings.host)) {
			await this.showFeedback(
				dial,
				buildSourceErrorFeedback(settings, "Set device IP")
			);
			return;
		}

		try {
			const client = MusicCastClient.fromSettings(settings);
			const current =
				this.inputCache.get(dial.id) ??
				(await client.getZoneStatus()).input?.toString();
			const next = nextSource(
				settings,
				current,
				ticks > 0 ? "next" : "previous"
			);
			this.inputCache.set(dial.id, next);
			await this.showFeedback(dial, buildSourceFeedback(settings, next));
			await client.setInput(next);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.error(`Source dial rotate: ${msg}`);
			await dial.showAlert();
			await this.showFeedback(dial, buildSourceErrorFeedback(settings, msg));
		}
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
			streamDeck.logger.warn(`Source dial getSettings failed: ${msg}`);
		}
	}

	private startPoll(dial: DialAction<MusicCastDeviceSettings>): void {
		this.stopPoll(dial.id);
		const cached = this.lastFeedback.get(dial.id);
		if (cached) void dial.setFeedback(cached);

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
					buildSourceErrorFeedback(settings, "Set device IP")
				);
				return;
			}
			const client = MusicCastClient.fromSettings(settings);
			const status = await client.getZoneStatus();
			const input = (status.input ?? "").toString();
			this.inputCache.set(dial.id, input);
			await this.showFeedback(dial, buildSourceFeedback(settings, input));
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			streamDeck.logger.warn(`Source dial refresh: ${msg}`);
			await this.showFeedback(dial, buildSourceErrorFeedback(settings, msg));
		} finally {
			this.inFlight.delete(dial.id);
		}
	}

	private async showFeedback(
		dial: DialAction<MusicCastDeviceSettings>,
		feedback: FeedbackPayload
	): Promise<void> {
		this.lastFeedback.set(dial.id, feedback);
		await dial.setFeedback(feedback);
	}
}

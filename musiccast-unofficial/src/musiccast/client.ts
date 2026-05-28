import {
	normalizeHost,
	zoneFromSettings,
	type MusicCastDeviceSettings,
} from "./settings.js";

export type YxcResponse = {
	response_code: number;
	[key: string]: unknown;
};

export type ZoneStatus = YxcResponse & {
	power?: string;
	volume?: number;
	mute?: boolean;
	max_volume?: number;
	input?: string;
};

export type FeaturesResponse = YxcResponse & {
	volume?: {
		max?: number;
		step?: number;
	};
};

export type NetPlayInfo = YxcResponse & {
	playback?: string;
	play_time?: number;
	total_time?: number;
	input?: string;
	artist?: string;
	album?: string;
	track?: string;
	song?: string;
  title?: string;
	station?: string;
  service?: string;
  albumart_url?: string;
  albumart_id?: number | string;
};

const REQUEST_TIMEOUT_MS = 6_000;

export class MusicCastClient {
	readonly host: string;
	readonly zone: string;

	constructor(host: string, zone: string) {
		const normalized = normalizeHost(host);
		if (!normalized) {
			throw new Error("MusicCast host is not configured");
		}
		this.host = normalized;
		this.zone = zone || "main";
	}

	static fromSettings(settings: MusicCastDeviceSettings): MusicCastClient {
		const host = normalizeHost(settings.host);
		if (!host) {
			throw new Error("Set the device IP in action settings");
		}
		return new MusicCastClient(host, zoneFromSettings(settings));
	}

	private url(
		path: string,
		query?: Record<string, string | number | boolean>
	): string {
		const u = new URL(`http://${this.host}/YamahaExtendedControl/v1/${path}`);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				u.searchParams.set(key, String(value));
			}
		}
		return u.toString();
	}

	async request(
		path: string,
		query?: Record<string, string | number | boolean>
	): Promise<YxcResponse> {
		const res = await fetch(this.url(path, query), {
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		});
		const text = await res.text();
		if (!res.ok) {
			throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
		}
		let data: YxcResponse;
		try {
			data = JSON.parse(text) as YxcResponse;
		} catch {
			throw new Error(`Invalid JSON from device: ${text.slice(0, 120)}`);
		}
		if (data.response_code !== 0) {
			throw new Error(`Device returned response_code ${data.response_code}`);
		}
		return data;
	}

	getZoneStatus(): Promise<ZoneStatus> {
		return this.request(`${this.zone}/getStatus`) as Promise<ZoneStatus>;
	}

	getFeatures(): Promise<FeaturesResponse> {
		return this.request("system/getFeatures") as Promise<FeaturesResponse>;
	}

	getNetPlayInfo(): Promise<NetPlayInfo> {
		return this.request("netusb/getPlayInfo") as Promise<NetPlayInfo>;
	}

	setVolumeAbsolute(volume: number): Promise<YxcResponse> {
		return this.request(`${this.zone}/setVolume`, { volume });
	}

	setVolumeStep(direction: "up" | "down", step: number): Promise<YxcResponse> {
		return this.request(`${this.zone}/setVolume`, {
			volume: direction,
			step: Math.max(1, Math.min(step, 16)),
		});
	}

	setMute(enable: boolean): Promise<YxcResponse> {
		return this.request(`${this.zone}/setMute`, { enable });
	}

	setPower(power: "on" | "standby" | "toggle"): Promise<YxcResponse> {
		return this.request(`${this.zone}/setPower`, { power });
	}

	setInput(input: string): Promise<YxcResponse> {
		return this.request(`${this.zone}/setInput`, { input });
	}

	setNetPlayback(
		playback: "play" | "stop" | "previous" | "next" | "pause"
	): Promise<YxcResponse> {
		return this.request("netusb/setPlayback", { playback });
	}
}

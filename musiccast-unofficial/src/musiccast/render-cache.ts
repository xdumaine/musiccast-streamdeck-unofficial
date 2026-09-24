/**
 * Remembers the last image/feedback sent per action so unchanged repaints are
 * skipped. Every setImage/setFeedback makes the Stream Deck app re-rasterize
 * the SVG (including embedded album art), so identical updates are wasted work.
 */
export class RenderCache {
	private readonly byAction = new Map<string, string>();

	/** Returns `true` (and records `value`) when it differs from the last send. */
	changed(actionId: string, value: unknown): boolean {
		const serialized =
			typeof value === "string" ? value : JSON.stringify(value);
		if (this.byAction.get(actionId) === serialized) return false;
		this.byAction.set(actionId, serialized);
		return true;
	}

	delete(actionId: string): void {
		this.byAction.delete(actionId);
	}
}

/** Album art data URIs kept per action class; old tracks are evicted first. */
const MAX_ALBUM_ART_ENTRIES = 8;

export function rememberAlbumArt(
	cache: Map<string, string>,
	url: string,
	dataUri: string
): void {
	cache.delete(url);
	cache.set(url, dataUri);
	while (cache.size > MAX_ALBUM_ART_ENTRIES) {
		const oldest = cache.keys().next().value;
		if (oldest === undefined) break;
		cache.delete(oldest);
	}
}

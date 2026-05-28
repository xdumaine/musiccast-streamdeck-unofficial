import streamDeck, { type SingletonAction } from "@elgato/streamdeck";

import { AlbumArtKey } from "./actions/album-art-key.js";
import { CurrentPlayingDial } from "./actions/current-playing-dial.js";
import {
	PlayKey,
	PlayPauseToggleKey,
	StopKey,
	PreviousKey,
	NextKey,
	MuteToggleKey,
	PowerToggleKey,
} from "./actions/transport-keys.js";
import { SourceDial } from "./actions/source-dial.js";
import { SourceToggleKey } from "./actions/source-toggle.js";
import { VolumeDial } from "./actions/volume-dial.js";
import {
	hydrateSharedSettings,
	setSharedSettings,
	type MusicCastSharedSettings,
} from "./musiccast/shared-settings.js";

streamDeck.logger.setLevel("info");

streamDeck.settings.onDidReceiveGlobalSettings<MusicCastSharedSettings>(
	(ev) => {
		setSharedSettings(ev.settings);
	}
);

function registerAction(action: SingletonAction): void {
	try {
		streamDeck.actions.registerAction(action);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		streamDeck.logger.warn(`Skipping action registration: ${msg}`);
	}
}

registerAction(new VolumeDial());
registerAction(new CurrentPlayingDial());
registerAction(new AlbumArtKey());
registerAction(new SourceDial());
registerAction(new SourceToggleKey());
registerAction(new PlayKey());
registerAction(new PlayPauseToggleKey());
registerAction(new StopKey());
registerAction(new PreviousKey());
registerAction(new NextKey());
registerAction(new MuteToggleKey());
registerAction(new PowerToggleKey());

void streamDeck.connect().then(() => hydrateSharedSettings());

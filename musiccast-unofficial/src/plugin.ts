import streamDeck from "@elgato/streamdeck";

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

streamDeck.actions.registerAction(new VolumeDial());
streamDeck.actions.registerAction(new SourceDial());
streamDeck.actions.registerAction(new SourceToggleKey());
streamDeck.actions.registerAction(new PlayKey());
streamDeck.actions.registerAction(new PlayPauseToggleKey());
streamDeck.actions.registerAction(new StopKey());
streamDeck.actions.registerAction(new PreviousKey());
streamDeck.actions.registerAction(new NextKey());
streamDeck.actions.registerAction(new MuteToggleKey());
streamDeck.actions.registerAction(new PowerToggleKey());

void streamDeck.connect().then(() => hydrateSharedSettings());

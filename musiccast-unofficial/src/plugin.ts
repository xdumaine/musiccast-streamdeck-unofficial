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
import { SourceToggleKey } from "./actions/source-toggle.js";
import { VolumeDial } from "./actions/volume-dial.js";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new VolumeDial());
streamDeck.actions.registerAction(new SourceToggleKey());
streamDeck.actions.registerAction(new PlayKey());
streamDeck.actions.registerAction(new PlayPauseToggleKey());
streamDeck.actions.registerAction(new StopKey());
streamDeck.actions.registerAction(new PreviousKey());
streamDeck.actions.registerAction(new NextKey());
streamDeck.actions.registerAction(new MuteToggleKey());
streamDeck.actions.registerAction(new PowerToggleKey());

streamDeck.connect();

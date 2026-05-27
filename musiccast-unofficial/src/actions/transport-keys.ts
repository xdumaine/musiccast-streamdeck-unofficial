import { action } from "@elgato/streamdeck";

import { MusicCastKeyAction } from "../musiccast/base-key.js";
import type { MusicCastClient } from "../musiccast/client.js";

const UUID_PREFIX = "com.xander-dumaine-xanderxdumainecom.musiccast-unofficial";

@action({ UUID: `${UUID_PREFIX}.play` })
export class PlayKey extends MusicCastKeyAction {
  protected override label = "Play";

  protected override run(client: MusicCastClient): Promise<void> {
    return client.setNetPlayback("play").then(() => undefined);
  }
}

@action({ UUID: `${UUID_PREFIX}.play-pause-toggle` })
export class PlayPauseToggleKey extends MusicCastKeyAction {
  protected override label = "Play/Pause";

  protected override async run(client: MusicCastClient): Promise<void> {
    const info = await client.getNetPlayInfo();
    const playback = (info.playback ?? "").toLowerCase();
    await client.setNetPlayback(playback === "play" ? "pause" : "play");
  }
}

@action({ UUID: `${UUID_PREFIX}.stop` })
export class StopKey extends MusicCastKeyAction {
  protected override label = "Stop";

  protected override run(client: MusicCastClient): Promise<void> {
    return client.setNetPlayback("stop").then(() => undefined);
  }
}

@action({ UUID: `${UUID_PREFIX}.previous` })
export class PreviousKey extends MusicCastKeyAction {
  protected override label = "Prev";

  protected override run(client: MusicCastClient): Promise<void> {
    return client.setNetPlayback("previous").then(() => undefined);
  }
}

@action({ UUID: `${UUID_PREFIX}.next` })
export class NextKey extends MusicCastKeyAction {
  protected override label = "Next";

  protected override run(client: MusicCastClient): Promise<void> {
    return client.setNetPlayback("next").then(() => undefined);
  }
}

@action({ UUID: `${UUID_PREFIX}.mute-toggle` })
export class MuteToggleKey extends MusicCastKeyAction {
  protected override label = "Mute";

  protected override async run(client: MusicCastClient): Promise<void> {
    const status = await client.getZoneStatus();
    const muted = status.mute === true;
    await client.setMute(!muted);
  }
}

@action({ UUID: `${UUID_PREFIX}.power-toggle` })
export class PowerToggleKey extends MusicCastKeyAction {
  protected override label = "Power";

  protected override run(client: MusicCastClient): Promise<void> {
    return client.setPower("toggle").then(() => undefined);
  }
}

# musiccast-unofficial

Unofficial [Elgato Stream Deck](https://www.elgato.com/stream-deck) plugin for **Yamaha MusicCast** devices on your local network. Control volume, transport, mute, and power via the [Yamaha Extended Control (YXC) HTTP API](https://github.com/honnel/yamaha-commands).

> **Not affiliated with Yamaha or Elgato.** Use at your own risk. The MusicCast HTTP API has no authentication on most devices—only use on networks you trust.

## Requirements

- Stream Deck software **7.1+** with Node.js **24** plugin runtime
- Stream Deck or Stream Deck + (dial actions need a **+** or Neo dial)
- MusicCast device on a **fixed LAN IP**, reachable on **port 80**

## Install (development)

1. Clone this repository.
2. Build the plugin:

   ```bash
   cd musiccast-unofficial
   npm install
   npm run build
   ```

3. Link into Stream Deck:

   ```bash
   streamdeck link com.xander-dumaine-xanderxdumainecom.musiccast-unofficial.sdPlugin
   ```

   Requires the [Stream Deck CLI](https://docs.elgato.com/streamdeck/cli/intro) (`@elgato/cli`).

4. Add actions from the **musiccast-unofficial** category and set your device **IP** in any action’s settings. Device IP, zone, and shared colors apply across all actions.

For iterative work, run `npm run watch` to rebuild and restart the plugin on save.

## Actions

| Action                                         | Control                                                                     |
| ---------------------------------------------- | --------------------------------------------------------------------------- |
| **Volume** (dial)                              | Rotate: volume steps · Push: mute · **Double-push**: power · Touch: refresh |
| **Now Playing** (dial)                         | Shows `netusb/getPlayInfo`; push/touch/rotate refreshes                     |
| **Album Art**                                  | Key image shows current `albumart_url`; press refreshes                     |
| **Source Dial**                                | Rotate through configured inputs via `setInput`; push/touch refreshes       |
| **Source**                                     | Key action that cycles configured inputs; icon reflects `getStatus.input`   |
| **Play / Play-Pause / Stop / Previous / Next** | `netusb/setPlayback`; Play-Pause reads `netusb/getPlayInfo` first           |
| **Mute**                                       | Toggle `setMute`                                                            |
| **Power**                                      | `setPower?power=toggle`                                                     |

### Volume dial options

- **Display**: numeric level or **0–100% bar**
- **Show device IP** on the subtitle line
- **Background refresh** (default 10s)—slow polling when idle; rotation, mute, and power update the strip **immediately**
- **Shared colors**: primary/accent, muted, text, subtitle, error, bar track

## API reference

This plugin uses endpoints documented in Yamaha’s _MusicCast HTTP simplified API for Control Systems_. A text excerpt lives in [`docs/rough-docs.txt`](docs/rough-docs.txt). Community reference: [honnel/yamaha-commands](https://github.com/honnel/yamaha-commands).

Base URL pattern:

```http
http://<device-ip>/YamahaExtendedControl/v1/<zone>/getStatus
http://<device-ip>/YamahaExtendedControl/v1/<zone>/setVolume?volume=up&step=1
```

## Project layout

```
musiccast-streamdeck/
├── LICENSE
├── README.md
├── docs/
│   └── rough-docs.txt          # API excerpt (not the full Yamaha PDF)
└── musiccast-unofficial/       # Stream Deck plugin (TypeScript → .sdPlugin)
    ├── src/
    └── com.xander-dumaine-xanderxdumainecom.musiccast-unofficial.sdPlugin/
```

## Develop

```bash
cd musiccast-unofficial
npm install
npm run build    # compile to .sdPlugin/bin/plugin.js
npm run watch    # watch + streamdeck restart
```

## License

[MIT](LICENSE) — Copyright (c) 2026 xander dumaine

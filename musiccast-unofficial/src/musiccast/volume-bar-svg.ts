/** Touch-strip width for the volume bar (px). */
export const VOLUME_BAR_WIDTH = 184;
/** Vertical slot for the bar pixmap; SVG is centered inside. */
export const VOLUME_BAR_SLOT_HEIGHT = 28;
export const DEFAULT_BAR_THICKNESS = 10;
export const MIN_BAR_THICKNESS = 4;
export const MAX_BAR_THICKNESS = 28;
export const DEFAULT_BAR_RADIUS = 4;
export const DEFAULT_SQUIGGLE_AMPLITUDE = 6.5;
export const MIN_SQUIGGLE_AMPLITUDE = 0.5;
export const MAX_SQUIGGLE_AMPLITUDE = 12;
export const DEFAULT_SQUIGGLE_WAVELENGTH = 35;
export const MIN_SQUIGGLE_WAVELENGTH = 8;
export const MAX_SQUIGGLE_WAVELENGTH = 56;

export function clampBarThickness(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  const t = Number.isFinite(n) ? n : DEFAULT_BAR_THICKNESS;
  return Math.max(
    MIN_BAR_THICKNESS,
    Math.min(MAX_BAR_THICKNESS, Math.round(t))
  );
}

export function clampSquiggleAmplitude(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  const a = Number.isFinite(n) ? n : DEFAULT_SQUIGGLE_AMPLITUDE;
  return Math.max(MIN_SQUIGGLE_AMPLITUDE, Math.min(MAX_SQUIGGLE_AMPLITUDE, a));
}

export function clampSquiggleWavelength(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  const w = Number.isFinite(n) ? n : DEFAULT_SQUIGGLE_WAVELENGTH;
  return Math.max(
    MIN_SQUIGGLE_WAVELENGTH,
    Math.min(MAX_SQUIGGLE_WAVELENGTH, Math.round(w))
  );
}

export function escapeXmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wormPath(
  startX: number,
  width: number,
  centerY: number,
  amplitude: number,
  wavelength: number
): string {
  const span = Math.max(0, width - startX);
  if (span <= 0) return `M ${startX} ${centerY}`;

  // Sample the wave instead of clipping cubic segments. The envelope fades
  // the line to center at both ends so round caps finish cleanly.
  const step = Math.max(2, Math.min(5, wavelength / 6));
  let d = `M ${startX} ${centerY}`;
  for (let x = startX + step; x < width; x += step) {
    const t = (x - startX) / span;
    const envelope = Math.sin(Math.PI * t);
    const y =
      centerY +
      Math.sin(((x - startX) / wavelength) * Math.PI * 2) *
        amplitude *
        envelope;
    d += ` L ${x} ${y}`;
  }
  d += ` L ${width} ${centerY}`;
  return d;
}

/**
 * Rounded volume bar as an SVG data URI for a layout `pixmap` item.
 * Bar is vertically centered in {@link VOLUME_BAR_SLOT_HEIGHT}.
 */
export function volumeBarPixmapUri(opts: {
  percent: number;
  thickness: number;
  trackColor: string;
  fillColor: string;
  radius?: number;
  /** Render a static wavy "worm" fill instead of a solid rounded rect. */
  animated?: boolean;
  squiggleAmplitude?: number;
  squiggleWavelength?: number;
}): string {
  const w = VOLUME_BAR_WIDTH;
  const slotH = VOLUME_BAR_SLOT_HEIGHT;
  const h = clampBarThickness(opts.thickness);
  const r = Math.min(opts.radius ?? DEFAULT_BAR_RADIUS, h / 2, w / 2);
  const pct = Math.max(0, Math.min(100, opts.percent));
  const fillW = pct <= 0 ? 0 : Math.max(r * 2, Math.round((w * pct) / 100));
  const y = (slotH - h) / 2;
  const track = escapeXmlAttr(opts.trackColor);
  const fill = escapeXmlAttr(opts.fillColor);

  const trackRect = `<rect x="0" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${track}"/>`;
  const fillRect = (() => {
    if (fillW <= 0) return "";
    if (!opts.animated) {
      return `<rect x="0" y="${y}" width="${fillW}" height="${h}" rx="${r}" ry="${r}" fill="${fill}"/>`;
    }

    const centerY = y + h / 2;
    const strokeWidth = Math.max(3, h * 0.72);
    // In squiggle mode, amplitude is intentionally independent of bar
    // thickness: a thin line can still make a large wave inside the slot.
    const maxAmplitude = Math.max(0.5, (slotH - strokeWidth) / 2);
    const amplitude = Math.min(
      maxAmplitude,
      clampSquiggleAmplitude(opts.squiggleAmplitude)
    );
    const wavelength = clampSquiggleWavelength(opts.squiggleWavelength);
    const capRadius = strokeWidth / 2;
    if (fillW <= strokeWidth) {
      return `<circle cx="${fillW / 2}" cy="${centerY}" r="${Math.max(
        0.5,
        fillW / 2
      )}" fill="${fill}"/>`;
    }
    const startX = capRadius;
    const endX = Math.max(startX, fillW - capRadius);
    const d = wormPath(startX, endX, centerY, amplitude, wavelength);
    return `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  })();

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${slotH}" viewBox="0 0 ${w} ${slotH}">` +
    `${trackRect}${fillRect}</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

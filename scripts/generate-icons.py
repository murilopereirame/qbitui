#!/usr/bin/env python3
"""Generate the qbitUI application icon in every size the project needs.

The artwork is defined once, in normalised coordinates (0..1 of the icon
edge), and emitted twice: as a vector master (``public/icon.svg``, used by the
web UI) and as rasters for the platforms that cannot consume SVG (Next.js
favicons, electron-builder, Expo).

Usage:  python3 scripts/generate-icons.py       (requires Pillow)
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# --- Palette ---------------------------------------------------------------
GRADIENT_TOP = (0x5D, 0x9C, 0xF3)
GRADIENT_BOTTOM = (0x2C, 0x6C, 0xCB)
GLYPH = (0xFA, 0xFC, 0xFF)
WAVE = (0xA9, 0xCB, 0xF6)

# --- Geometry (fractions of the icon edge) ---------------------------------
CORNER_RADIUS = 0.205

RING_CENTER = (0.500, 0.505)
RING_RADIUS = 0.283          # centre-line radius of the stroke
RING_STROKE = 0.030

BOWL_RADIUS = 0.090          # centre-line radius of the q/b bowls
GLYPH_STROKE = 0.036
BOWL_Y = 0.505
Q_BOWL_X = 0.377
B_BOWL_X = 0.623
STEM_EXTENT = 0.150          # how far the q descender / b ascender reach

WAVES = (  # (centre-line radius, half angular span in degrees)
    (0.360, 27.0),
    (0.428, 31.0),
)
WAVE_STROKE = 0.034

# Favicon-sized renders enlarge the mark and drop detail: the waves go first,
# then the ring at the very smallest sizes.
COMPACT_ZOOM = 1.28
TINY_ZOOM = 1.75


@dataclass(frozen=True)
class Canvas:
    """Maps normalised coordinates onto a pixel canvas."""

    size: int

    def px(self, value: float) -> float:
        return value * self.size


def _vertical_gradient(size: int) -> Image.Image:
    """Diagonal-ish gradient: mostly top-to-bottom with a slight left lift."""
    gradient = Image.new("RGB", (size, size))
    pixels = gradient.load()
    for y in range(size):
        for x in range(size):
            t = min(1.0, max(0.0, (0.82 * y + 0.18 * x) / size))
            pixels[x, y] = tuple(
                round(top + (bottom - top) * t)
                for top, bottom in zip(GRADIENT_TOP, GRADIENT_BOTTOM)
            )
    return gradient


def _round_cap(draw: ImageDraw.ImageDraw, x: float, y: float, radius: float, fill) -> None:
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=fill)


def _arc_with_caps(
    draw: ImageDraw.ImageDraw,
    center: tuple[float, float],
    radius: float,
    start_deg: float,
    end_deg: float,
    width: float,
    fill,
) -> None:
    cx, cy = center
    outer = radius + width / 2
    box = (cx - outer, cy - outer, cx + outer, cy + outer)
    draw.arc(box, start_deg, end_deg, fill=fill, width=round(width))
    for angle in (start_deg, end_deg):
        rad = math.radians(angle)
        _round_cap(draw, cx + radius * math.cos(rad), cy + radius * math.sin(rad), width / 2, fill)


def _draw_glyph_bowl(draw: ImageDraw.ImageDraw, c: Canvas, bowl_x: float, zoom: float = 1.0) -> None:
    cx, cy = c.px(bowl_x), c.px(BOWL_Y)
    stroke = c.px(GLYPH_STROKE * zoom)
    r = c.px(BOWL_RADIUS * zoom) + stroke / 2
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=GLYPH, width=round(stroke))


def _draw_stem(
    draw: ImageDraw.ImageDraw, c: Canvas, x: float, top: float, bottom: float, zoom: float = 1.0
) -> None:
    half = c.px(GLYPH_STROKE * zoom) / 2
    draw.rectangle((c.px(x) - half, c.px(top), c.px(x) + half, c.px(bottom)), fill=GLYPH)


def render(size: int, zoom: float = 1.0, waves: bool = True, ring: bool = True) -> Image.Image:
    """Render the icon at ``size`` px, supersampled for smooth edges.

    ``zoom`` scales the mark inside the tile, and ``waves``/``ring`` can drop
    those elements; at favicon sizes the full artwork turns to mush, so the
    small entries use a larger, simpler mark.
    """
    scale = 4 if size <= 512 else 2
    c = Canvas(size * scale)
    s = c.size

    mask = Image.new("L", (s, s), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, s - 1, s - 1), radius=c.px(CORNER_RADIUS), fill=255
    )

    icon = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    icon.paste(_vertical_gradient(s).convert("RGBA"), (0, 0), mask)
    draw = ImageDraw.Draw(icon)

    # Sound waves flanking the ring.
    for radius, span in WAVES if waves else ():
        for center_angle in (0.0, 180.0):
            _arc_with_caps(
                draw,
                (c.px(RING_CENTER[0]), c.px(RING_CENTER[1])),
                c.px(radius),
                center_angle - span,
                center_angle + span,
                c.px(WAVE_STROKE),
                WAVE,
            )

    # Ring.
    if ring:
        ring_stroke = c.px(RING_STROKE * zoom)
        rcx, rcy = c.px(RING_CENTER[0]), c.px(RING_CENTER[1])
        rr = c.px(RING_RADIUS * zoom) + ring_stroke / 2
        draw.ellipse(
            (rcx - rr, rcy - rr, rcx + rr, rcy + rr), outline=GLYPH, width=round(ring_stroke)
        )

    # "qb": two bowls, a descender on the q and an ascender on the b.
    bowl = BOWL_RADIUS * zoom
    stem = STEM_EXTENT * zoom
    q_x = 0.5 - (0.5 - Q_BOWL_X) * zoom
    b_x = 0.5 + (B_BOWL_X - 0.5) * zoom
    _draw_glyph_bowl(draw, c, q_x, zoom)
    _draw_glyph_bowl(draw, c, b_x, zoom)
    _draw_stem(draw, c, q_x + bowl, BOWL_Y - bowl, BOWL_Y + bowl + stem, zoom)
    _draw_stem(draw, c, b_x - bowl, BOWL_Y - bowl - stem, BOWL_Y + bowl, zoom)

    return icon.resize((size, size), Image.LANCZOS)


def render_monochrome(size: int) -> Image.Image:
    """White-on-transparent variant for Android's monochrome (themed) icon."""
    source = render(size)
    flat = Image.new("RGBA", source.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(flat)
    c = Canvas(size)
    ring_stroke = c.px(RING_STROKE)
    rcx, rcy = c.px(RING_CENTER[0]), c.px(RING_CENTER[1])
    rr = c.px(RING_RADIUS) + ring_stroke / 2
    draw.ellipse((rcx - rr, rcy - rr, rcx + rr, rcy + rr), outline=(255, 255, 255, 255), width=max(1, round(ring_stroke)))
    for bowl_x in (Q_BOWL_X, B_BOWL_X):
        stroke = c.px(GLYPH_STROKE)
        cx, cy, r = c.px(bowl_x), c.px(BOWL_Y), c.px(BOWL_RADIUS) + stroke / 2
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 255, 255, 255), width=max(1, round(stroke)))
    half = c.px(GLYPH_STROKE) / 2
    draw.rectangle(
        (c.px(Q_BOWL_X + BOWL_RADIUS) - half, c.px(BOWL_Y - BOWL_RADIUS), c.px(Q_BOWL_X + BOWL_RADIUS) + half, c.px(BOWL_Y + BOWL_RADIUS + STEM_EXTENT)),
        fill=(255, 255, 255, 255),
    )
    draw.rectangle(
        (c.px(B_BOWL_X - BOWL_RADIUS) - half, c.px(BOWL_Y - BOWL_RADIUS - STEM_EXTENT), c.px(B_BOWL_X - BOWL_RADIUS) + half, c.px(BOWL_Y + BOWL_RADIUS)),
        fill=(255, 255, 255, 255),
    )
    return flat


def padded(image: Image.Image, inset: float) -> Image.Image:
    """Shrink ``image`` into a transparent square (Android adaptive icons)."""
    size = image.width
    inner = round(size * (1 - 2 * inset))
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(image.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2, (size - inner) // 2))
    return canvas


def svg() -> str:
    def pct(value: float) -> str:
        return f"{value * 1024:.2f}"

    ring_cx, ring_cy = RING_CENTER

    def wave_path(radius: float, span: float, center_angle: float) -> str:
        points = []
        for angle in (center_angle - span, center_angle + span):
            rad = math.radians(angle)
            points.append((ring_cx + radius * math.cos(rad), ring_cy + radius * math.sin(rad)))
        (x1, y1), (x2, y2) = points
        return (
            f'<path d="M {pct(x1)} {pct(y1)} A {pct(radius)} {pct(radius)} 0 0 1 {pct(x2)} {pct(y2)}" '
            f'stroke="#{WAVE[0]:02X}{WAVE[1]:02X}{WAVE[2]:02X}" stroke-width="{pct(WAVE_STROKE)}" '
            'stroke-linecap="round" fill="none"/>'
        )

    waves = "\n    ".join(
        wave_path(radius, span, angle) for radius, span in WAVES for angle in (0.0, 180.0)
    )
    glyph = f"#{GLYPH[0]:02X}{GLYPH[1]:02X}{GLYPH[2]:02X}"
    stem_w = pct(GLYPH_STROKE)

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-label="qbitUI">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#{GRADIENT_TOP[0]:02X}{GRADIENT_TOP[1]:02X}{GRADIENT_TOP[2]:02X}"/>
      <stop offset="1" stop-color="#{GRADIENT_BOTTOM[0]:02X}{GRADIENT_BOTTOM[1]:02X}{GRADIENT_BOTTOM[2]:02X}"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="1024" height="1024" rx="{pct(CORNER_RADIUS)}" fill="url(#bg)"/>
  <g>
    {waves}
  </g>
  <circle cx="{pct(ring_cx)}" cy="{pct(ring_cy)}" r="{pct(RING_RADIUS)}" fill="none" stroke="{glyph}" stroke-width="{pct(RING_STROKE)}"/>
  <circle cx="{pct(Q_BOWL_X)}" cy="{pct(BOWL_Y)}" r="{pct(BOWL_RADIUS)}" fill="none" stroke="{glyph}" stroke-width="{stem_w}"/>
  <circle cx="{pct(B_BOWL_X)}" cy="{pct(BOWL_Y)}" r="{pct(BOWL_RADIUS)}" fill="none" stroke="{glyph}" stroke-width="{stem_w}"/>
  <rect x="{pct(Q_BOWL_X + BOWL_RADIUS - GLYPH_STROKE / 2)}" y="{pct(BOWL_Y - BOWL_RADIUS)}"
    width="{stem_w}" height="{pct(2 * BOWL_RADIUS + STEM_EXTENT)}" fill="{glyph}"/>
  <rect x="{pct(B_BOWL_X - BOWL_RADIUS - GLYPH_STROKE / 2)}" y="{pct(BOWL_Y - BOWL_RADIUS - STEM_EXTENT)}"
    width="{stem_w}" height="{pct(2 * BOWL_RADIUS + STEM_EXTENT)}" fill="{glyph}"/>
</svg>
"""


def write_ico(path: str, images: list[Image.Image]) -> None:
    """Write a PNG-in-ICO, one entry per image (Pillow can only rescale one)."""
    import struct
    from io import BytesIO

    encoded = []
    for image in images:
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        encoded.append(buffer.getvalue())

    offset = 6 + 16 * len(encoded)
    header = struct.pack("<HHH", 0, 1, len(encoded))
    directory = b""
    for image, data in zip(images, encoded):
        directory += struct.pack(
            "<BBBBHHII",
            image.width if image.width < 256 else 0,
            image.height if image.height < 256 else 0,
            0,
            0,
            1,
            32,
            len(data),
            offset,
        )
        offset += len(data)

    with open(path, "wb") as handle:
        handle.write(header + directory + b"".join(encoded))


def write(path: str, image: Image.Image) -> None:
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    image.save(full)
    print(f"  {path} ({image.width}×{image.height})")


def main() -> None:
    print("Writing icon assets:")

    svg_path = os.path.join(ROOT, "public/icon.svg")
    with open(svg_path, "w", encoding="utf-8") as handle:
        handle.write(svg())
    print("  public/icon.svg")

    master = render(1024)

    # Next.js app icons (app/icon.png is picked up automatically as the favicon).
    write("app/icon.png", master.resize((512, 512), Image.LANCZOS))
    write("app/apple-icon.png", master.resize((180, 180), Image.LANCZOS))
    # Favicons: the small entries drop the waves and enlarge the mark so it
    # still reads at 16-32 px.
    favicon = os.path.join(ROOT, "app/favicon.ico")
    write_ico(
        favicon,
        [render(16, zoom=TINY_ZOOM, waves=False, ring=False)]
        + [render(size, zoom=COMPACT_ZOOM, waves=False) for size in (24, 32)]
        + [master.resize((size, size), Image.LANCZOS) for size in (48, 64, 128, 256)],
    )
    print("  app/favicon.ico")

    # electron-builder (referenced from package.json "build" config).
    write("electron/icon.png", master)
    write("public/icon-512.png", master.resize((512, 512), Image.LANCZOS))
    write("public/icon-192.png", master.resize((192, 192), Image.LANCZOS))

    # Expo (mobile/).
    write("mobile/assets/images/icon.png", master)
    write("mobile/assets/images/splash-icon.png", master.resize((512, 512), Image.LANCZOS))
    write("mobile/assets/images/favicon.png", master.resize((64, 64), Image.LANCZOS))
    write("mobile/assets/images/android-icon-foreground.png", padded(master, 0.16))
    background = Image.new("RGBA", (1024, 1024), (*GRADIENT_TOP, 255))
    background.paste(_vertical_gradient(1024).convert("RGBA"), (0, 0))
    write("mobile/assets/images/android-icon-background.png", background)
    write("mobile/assets/images/android-icon-monochrome.png", padded(render_monochrome(1024), 0.16))


if __name__ == "__main__":
    main()

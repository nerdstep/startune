"""Generate StarTune's logo files from the Geist font in node_modules.

The wordmark is set with HarfBuzz using the app's exact type settings, then converted to outlines,
so the SVGs look identical everywhere without Geist installed. Every value here mirrors the live
logo in src/components/shell.tsx (mark geometry, 24px mark, text 32px in) and the tokens in
src/styles.css; change them together.

    python brand/make_logo.py

Writes, next to this script:
    startune-logo.svg         for dark backgrounds (transparent, the in-app lockup)
    startune-logo-card.svg    the lockup on its own dark card; reads on any background (README)
    startune-logo-light.svg   for light backgrounds (mark on its Black Field tile, ink wordmark)
    startune-banner.svg       1280x180 README banner: the social card's field, logo and tagline
    startune-social.svg       1280x640 card (GitHub social preview); export a PNG from it, see README
"""

from __future__ import annotations

import io
import math
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = Path(__file__).resolve().parent
FONT = HERE.parent / "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2"

# Tokens (src/styles.css, src/lib/palette.ts)
LIME = "#c8ff3a"  # --primary
STARLIGHT = "#e8eae6"  # rendered --foreground
BLACK_FIELD = "#050607"  # --background
DUST = "#8d938f"  # --muted-foreground
HAIRLINE = "#23262a"  # --border
CLASS_COLOURS = {  # HEALTH_CHART, with a rough share of a typical library
    "thriving": ("#6ea8ff", 0.38),
    "active": ("#e9e4d4", 0.28),
    "quiet": ("#ffd84d", 0.06),
    "dormant": ("#ff9b42", 0.19),
    "archived": ("#ff5b4d", 0.09),
}

# The mark, on a 24-unit grid (keep in step with MARK_STAR / MARK_CORNERS in shell.tsx).
MARK_STAR = (
    "M12 6.48 13.61 10.36 17.8 10.7 14.61 13.43 15.59 17.52 12 15.33 8.41 17.52 9.39 13.43"
    " 6.2 10.7 10.39 10.36Z"
)
MARK_CORNERS = "M1 6.5V1h5.5M17.5 1H23v5.5M23 17.5V23h-5.5M6.5 23H1v-5.5"

# Wordmark, as measured in the browser on the rail logo.
WORD = "StarTune"
WORD_SIZE = 15.0
WORD_WEIGHT = 600
WORD_TRACK = -0.375  # letter-spacing (-0.025em), applied after every glyph
WORD_X = 32.0  # 24px mark + 8px gap
LINE_H = 22.5
LINE_TOP = 0.75
FEATURES = {"cv11": True, "ss01": True, "tnum": True}

TAGLINE = "Bring your stars into focus."  # PRODUCT.md


def num(v: float) -> str:
    return f"{v:.2f}".rstrip("0").rstrip(".")


class Geist:
    def __init__(self, path: Path):
        tt = TTFont(path)  # woff2 decompressed via brotli
        tt.flavor = None
        buf = io.BytesIO()
        tt.save(buf)
        self.face = hb.Face(buf.getvalue())
        self.upem = self.face.upem
        os2, hhea = tt["OS/2"], tt["hhea"]
        typo = bool(os2.fsSelection & (1 << 7))  # USE_TYPO_METRICS, as browsers honour
        self.asc = os2.sTypoAscender if typo else hhea.ascent
        self.desc = -os2.sTypoDescender if typo else -hhea.descent

    def baseline(self, size: float, line_h: float, top: float) -> float:
        """Where a browser puts the baseline in a line box of line_h starting at top."""
        s = size / self.upem
        return top + (line_h - (self.asc + self.desc) * s) / 2 + self.asc * s

    def text(
        self, text: str, size: float, weight: int, x: float, baseline: float, track: float = 0.0
    ) -> tuple[str, float]:
        """Outline `text` with its pen starting at (x, baseline). Returns (path data, ink width)."""
        font = hb.Font(self.face)
        font.scale = (self.upem, self.upem)
        font.set_variations({"wght": weight})
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(font, buf, FEATURES)
        s = size / self.upem
        parts, pen_x = [], x
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
            pen = SVGPathPen(None, ntos=num)
            at = (s, 0, 0, -s, pen_x + pos.x_offset * s, baseline - pos.y_offset * s)
            font.draw_glyph_with_pen(info.codepoint, TransformPen(pen, at))
            if d := pen.getCommands():
                parts.append(d)
            pen_x += pos.x_advance * s + track
        return " ".join(parts), pen_x - track - x


def mark(colour: str = LIME) -> str:
    return (
        f'<path d="{MARK_STAR}" fill="{colour}" stroke="{colour}" stroke-linejoin="round"/>'
        f'<path d="{MARK_CORNERS}" fill="none" stroke="{colour}" stroke-width="2"'
        ' stroke-linecap="round" stroke-linejoin="round"/>'
    )


def tile_mark() -> str:
    """The favicon: the mark inset on a Black Field tile (public/favicon.svg)."""
    return (
        f'<rect width="24" height="24" rx="4.5" fill="{BLACK_FIELD}"/>'
        f'<g transform="translate(2 2) scale(.8333)">'
        f'<path d="{MARK_STAR}" fill="{LIME}" stroke="{LIME}" stroke-linejoin="round"/>'
        f'<path d="{MARK_CORNERS}" fill="none" stroke="{LIME}" stroke-width="2.4"'
        ' stroke-linecap="round" stroke-linejoin="round"/></g>'
    )


def lockup(geist: Geist, word_fill: str, tile: bool = False) -> tuple[str, float]:
    """Mark + wordmark on the 24-unit row. Returns (svg body, width)."""
    base = geist.baseline(WORD_SIZE, LINE_H, LINE_TOP)
    d, w = geist.text(WORD, WORD_SIZE, WORD_WEIGHT, WORD_X, base, WORD_TRACK)
    body = (tile_mark() if tile else mark()) + f'<path d="{d}" fill="{word_fill}"/>'
    return body, math.ceil((WORD_X + w) * 10) / 10


def svg(view_w: float, view_h: float, body: str, px_w: float, px_h: float) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(view_w)} {num(view_h)}"'
        f' width="{num(px_w)}" height="{num(px_h)}" role="img" aria-label="StarTune">'
        f"<title>StarTune</title>{body}</svg>\n"
    )


def point_cloud(w: int, h: int, keep_out: tuple[float, float, float, float], n: int = 230) -> str:
    """A sparse, seeded field of class-coloured points (the product's star field), clear of the
    centred content ellipse (cx, cy, rx, ry). Archived stars are rings, as in the app."""
    seed = 20_260_901

    def rnd() -> float:
        nonlocal seed
        seed = (seed * 1_103_515_245 + 12_345) % 2**31
        return seed / 2**31

    cx, cy, rx, ry = keep_out
    classes = list(CLASS_COLOURS.items())
    out, placed = [], 0
    while placed < n:
        x, y = rnd() * w, rnd() * h
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1:
            continue
        pick, acc = rnd(), 0.0
        name, colour = classes[-1][0], classes[-1][1][0]
        for k, (c, share) in classes:
            acc += share
            if pick < acc:
                name, colour = k, c
                break
        near = rnd() ** 2.2  # most points far and small, a few near and large
        r = 0.7 + near * 2.6
        alpha = 0.22 + near * 0.6
        if name == "dormant":
            alpha *= 0.75
        if name == "archived":
            out.append(
                f'<circle cx="{num(x)}" cy="{num(y)}" r="{num(r + 0.6)}" fill="none"'
                f' stroke="{colour}" stroke-width="1" opacity="{num(alpha)}"/>'
            )
        else:
            out.append(
                f'<circle cx="{num(x)}" cy="{num(y)}" r="{num(r)}" fill="{colour}"'
                f' opacity="{num(alpha)}"/>'
            )
        placed += 1
    return "".join(out)


def social(geist: Geist) -> str:
    W, H, scale = 1280, 640, 5.0
    body, lw = lockup(geist, STARLIGHT)
    lx, ly = (W - lw * scale) / 2, 218.0  # lockup + tagline centred as a group
    tag_size = 34.0
    _, tw = geist.text(TAGLINE, tag_size, 400, 0, 0)
    tag_d, _ = geist.text(TAGLINE, tag_size, 400, (W - tw) / 2, ly + 24 * scale + 74)
    return svg(
        W,
        H,
        f'<rect width="{W}" height="{H}" fill="{BLACK_FIELD}"/>'
        + point_cloud(W, H, (W / 2, 296, 470, 190))
        + f'<g transform="translate({num(lx)} {num(ly)}) scale({num(scale)})">{body}</g>'
        + f'<path d="{tag_d}" fill="{DUST}"/>',
        W,
        H,
    )


def banner(geist: Geist) -> str:
    """The README banner: the social card's point cloud with the logo and tagline on one line, on
    its own Black Field with a hairline edge and rounded corners, so it reads on light and dark
    pages alike (see card() for why the README avoids theme switching)."""
    W, H, scale, radius = 1280, 180, 3.0, 16
    body, lw = lockup(geist, STARLIGHT)
    tag_size, gap = 26.0, 36  # gap either side of the divider
    _, tw = geist.text(TAGLINE, tag_size, 400, 0, 0)
    group_w = lw * scale + gap * 2 + tw
    lx = (W - group_w) / 2
    ly = (H - 24 * scale) / 2
    div_x = lx + lw * scale + gap
    # The tagline's baseline sits level with the wordmark's.
    word_base = geist.baseline(WORD_SIZE, LINE_H, LINE_TOP)
    tag_d, _ = geist.text(TAGLINE, tag_size, 400, div_x + gap, ly + word_base * scale)
    return svg(
        W,
        H,
        f'<defs><clipPath id="edge"><rect width="{W}" height="{H}" rx="{radius}"/></clipPath></defs>'
        f'<g clip-path="url(#edge)"><rect width="{W}" height="{H}" fill="{BLACK_FIELD}"/>'
        + point_cloud(W, H, (W / 2, H / 2, group_w / 2 + 70, 62), n=90)
        + "</g>"
        + f'<rect x=".5" y=".5" width="{W - 1}" height="{H - 1}" rx="{radius}" fill="none"'
        f' stroke="{HAIRLINE}"/>'
        + f'<g transform="translate({num(lx)} {num(ly)}) scale({num(scale)})">{body}</g>'
        + f'<path d="M{num(div_x)} {num(H / 2 - 22)}v44" stroke="{HAIRLINE}" stroke-width="1.5"/>'
        + f'<path d="{tag_d}" fill="{DUST}"/>',
        W,
        H,
    )


def card(geist: Geist, scale: float = 3.0) -> str:
    """The lockup on its own Black Field card with a hairline edge: reads the same on any page
    colour, so it needs no theme switching. (GitHub's <picture> switching follows the OS
    colour scheme, not GitHub's theme, so a light GitHub page on a dark OS gets the
    light-text logo on white.)"""
    pad_x, pad_y, radius = 16.0, 14.0, 8.0  # in lockup units (the mark is 24)
    body, lw = lockup(geist, STARLIGHT)
    w, h = lw + pad_x * 2, 24 + pad_y * 2
    edge = 1 / scale  # 1px at the default size
    return svg(
        w,
        h,
        f'<rect x="{num(edge / 2)}" y="{num(edge / 2)}" width="{num(w - edge)}"'
        f' height="{num(h - edge)}" rx="{num(radius)}" fill="{BLACK_FIELD}"'
        f' stroke="{HAIRLINE}" stroke-width="{num(edge)}"/>'
        f'<g transform="translate({num(pad_x)} {num(pad_y)})">{body}</g>',
        w * scale,
        h * scale,
    )


def main() -> None:
    geist = Geist(FONT)
    files = {}
    body, w = lockup(geist, STARLIGHT)
    files["startune-logo.svg"] = svg(w, 24, body, w * 4, 96)
    files["startune-logo-card.svg"] = card(geist)
    body, w = lockup(geist, BLACK_FIELD, tile=True)
    files["startune-logo-light.svg"] = svg(w, 24, body, w * 4, 96)
    files["startune-banner.svg"] = banner(geist)
    files["startune-social.svg"] = social(geist)
    for name, text in files.items():
        (HERE / name).write_text(text, encoding="utf-8", newline="\n")
        print(f"wrote brand/{name} ({len(text):,} bytes)")


if __name__ == "__main__":
    main()

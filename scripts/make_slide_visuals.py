"""Draw the two statement-slide visuals into docs/img/ (run with backend/.venv/bin/python).

  problem-stories.png  slide 2: three story cards
  ban-gap.png          slide 3: every 06–18 work hour in Aug–Sep 2025 at Dubai South,
                       black-flag hours (estimated WBGT ≥ 32 °C) inside vs outside the midday ban

The heat chart reads the cached backtest data in backend/.cache (same data and rules as docs/METHODS.md).
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from nabd.engine.backtest import WBGT_BLACK_FLAG, _in_ban, _wbgt  # noqa: E402

OUT = ROOT / "docs" / "img"
PAPER, SAND, INK, OXIDE, MUTED = "#F2EBE0", "#E4D6C0", "#171310", "#B4471F", "#6B5E52"
RED, CARD = "#C2261B", "#FBF7F0"
W, H = 1290, 1560

SUPP = "/System/Library/Fonts/Supplemental/"


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for path in (SUPP + name, "/System/Library/Fonts/" + name, "/Library/Fonts/" + name):
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


SERIF, SERIF_I = "Georgia.ttf", "Georgia Italic.ttf"
SANS, SANS_B = "Arial.ttf", "Arial Bold.ttf"


def wrap(draw: ImageDraw.ImageDraw, text: str, f, width: int) -> list[str]:
    lines, line = [], ""
    for word in text.split():
        test = f"{line} {word}".strip()
        if draw.textlength(test, font=f) <= width:
            line = test
        else:
            lines.append(line)
            line = word
    return lines + [line]


def text_block(draw, xy, text, f, width, fill, gap=8) -> int:
    x, y = xy
    for line in wrap(draw, text, f, width):
        draw.text((x, y), line, font=f, fill=fill)
        y += f.size + gap
    return y


# ── slide 2 ─────────────────────────────────────────────────────────────────

def icon_rain(d: ImageDraw.ImageDraw, cx: int, cy: int):
    d.ellipse((cx - 70, cy - 60, cx + 10, cy + 10), fill=INK)
    d.ellipse((cx - 20, cy - 80, cx + 70, cy + 10), fill=INK)
    d.rectangle((cx - 40, cy - 20, cx + 50, cy + 10), fill=INK)
    for dx in (-45, -5, 35):
        for dy in (35, 75):
            d.line((cx + dx + 8, cy + dy - 12, cx + dx, cy + dy + 8), fill=OXIDE, width=8)


def icon_sun(d: ImageDraw.ImageDraw, cx: int, cy: int):
    import math
    d.ellipse((cx - 38, cy - 38, cx + 38, cy + 38), fill=OXIDE)
    for k in range(12):
        a = k * math.pi / 6
        d.line((cx + 52 * math.cos(a), cy + 52 * math.sin(a), cx + 74 * math.cos(a), cy + 74 * math.sin(a)),
               fill=OXIDE, width=8)


def icon_doc(d: ImageDraw.ImageDraw, cx: int, cy: int):
    d.rounded_rectangle((cx - 52, cy - 70, cx + 52, cy + 70), radius=8, outline=INK, width=6, fill=CARD)
    for i, w in enumerate((70, 60, 70, 40)):
        d.line((cx - 34, cy - 40 + i * 22, cx - 34 + w, cy - 40 + i * 22), fill=MUTED, width=5)
    d.ellipse((cx + 4, cy + 22, cx + 60, cy + 78), outline=RED, width=6)
    d.text((cx + 32, cy + 50), "?", font=font(SANS_B, 34), fill=RED, anchor="mm")


def problem_stories() -> Path:
    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    cards = [
        (icon_rain, "16 APRIL 2024 · UAE", "254.8 mm", "of rain in under 24 h, the most since 1949",
         "Warnings went out in advance. People still drove into wadis; crews were still on site."),
        (icon_sun, "QATAR · 2009–2017", "200 of 571", "young Nepali workers' heart deaths could have been prevented",
         "Deaths rose with summer heat. Effective heat protection was the missing piece."),
        (icon_doc, "ACROSS THE GULF · EVERY YEAR", "“Natural causes”", "on more than half of up to 10,000 deaths",
         "Migrant workers' deaths are certified with no underlying cause, so heat never shows up."),
    ]
    gap, top = 36, 10
    ch = (H - 2 * top - 2 * gap) // 3
    for i, (icon, kick, big, sub, story) in enumerate(cards):
        y0 = top + i * (ch + gap)
        d.rounded_rectangle((10, y0, W - 10, y0 + ch), radius=28, fill=CARD, outline=SAND, width=4)
        d.rectangle((10, y0 + 28, 22, y0 + ch - 28), fill=OXIDE)
        icon(d, 150, y0 + ch // 2)
        x, tw = 280, W - 280 - 50
        y0 += 50
        d.text((x, y0 + 46), kick, font=font(SANS_B, 32), fill=OXIDE)
        bigf = font(SERIF_I if big.startswith("“") else SERIF, 92)
        d.text((x, y0 + 92), big, font=bigf, fill=INK)
        y = text_block(d, (x, y0 + 205), sub, font(SANS_B, 34), tw, INK, gap=6)
        text_block(d, (x, y + 10), story, font(SANS, 31), tw, MUTED, gap=6)
    path = OUT / "problem-stories.png"
    img.save(path)
    return path


# ── slide 3 ─────────────────────────────────────────────────────────────────

def ban_gap() -> Path:
    hours = range(6, 19)
    rows: list[tuple[str, list[tuple[float | None, bool]]]] = []
    for month in ("2025-08-01_2025-08-31", "2025-09-01_2025-09-30"):
        h = json.loads((ROOT / "backend" / ".cache" / f"backtest_dubai-south_{month}.json").read_text())
        by_day: dict[str, dict[int, tuple[float | None, bool]]] = {}
        for i, stamp in enumerate(h["time"]):
            if stamp[:10] < month[:10] or int(stamp[11:13]) not in hours:
                continue
            by_day.setdefault(stamp[:10], {})[int(stamp[11:13])] = (_wbgt(h, "", i), _in_ban(stamp))
        rows += [(day, [cells.get(hr, (None, False)) for hr in hours]) for day, cells in sorted(by_day.items())]

    flags = [(w, ban) for _, cells in rows for w, ban in cells if w is not None and w >= WBGT_BLACK_FLAG]
    outside = sum(1 for _, ban in flags if not ban)

    img = Image.new("RGB", (W, H), PAPER)
    d = ImageDraw.Draw(img)
    big, sub = font(SERIF, 96), font(SANS_B, 34)
    d.text((40, 20), f"{outside} of {len(flags)}", font=big, fill=RED)
    text_block(d, (40, 130), "black-flag work hours fell outside the midday ban", sub, W - 80, INK, gap=4)
    d.text((40, 222), "Dubai South · 1 Aug – 30 Sep 2025 · 06:00–18:00", font=font(SANS, 30), fill=MUTED)

    left, top, right, bottom = 190, 330, W - 40, H - 170
    cw = (right - left) / len(hours)
    rh = (bottom - top) / len(rows)
    for r, (day, cells) in enumerate(rows):
        y = top + r * rh
        for c, (w, ban) in enumerate(cells):
            x = left + c * cw
            if w is None:
                fill = PAPER
            elif w >= WBGT_BLACK_FLAG:
                fill = INK if ban else RED
            else:
                shade = max(0.0, min(1.0, (w - 24) / (WBGT_BLACK_FLAG - 24)))
                base, hot = (0xEA, 0xDF, 0xCF), (0xD9, 0xA2, 0x7E)
                fill = tuple(int(b + (h_ - b) * shade) for b, h_ in zip(base, hot))
            d.rectangle((x + 1, y + 0.5, x + cw - 1, y + rh - 0.5), fill=fill)
        d_ = date.fromisoformat(day)
        if d_.day in (1, 15):
            d.text((left - 16, y + rh / 2), d_.strftime("%-d %b"), font=font(SANS, 28), fill=INK, anchor="rm")
            d.line((left - 10, y, left, y), fill=MUTED, width=2)

    ban_rows = [r for r, (day, _) in enumerate(rows) if day <= "2025-09-15"]
    bx0, bx1 = left + (12.5 - 6) * cw, left + (15 - 6) * cw
    by0, by1 = top + ban_rows[0] * rh, top + (ban_rows[-1] + 1) * rh
    d.rectangle((bx0, by0, bx1, by1), outline=OXIDE, width=6)
    d.text(((bx0 + bx1) / 2, by0 - 14), "midday ban", font=font(SANS_B, 28), fill=OXIDE, anchor="mb")
    end = top + (ban_rows[-1] + 1) * rh
    d.line((left, end, right, end), fill=OXIDE, width=3)
    label, lf = "ban season ends 15 Sep", font(SANS_B, 24)
    lw = d.textlength(label, font=lf)
    d.rectangle((right - lw - 16, end + 4, right, end + 38), fill=PAPER)
    d.text((right - 8, end + 8), label, font=lf, fill=OXIDE, anchor="ra")

    for c, hr in enumerate(hours):
        if hr % 3 == 0:
            d.text((left + c * cw + cw / 2, bottom + 12), f"{hr:02d}:00", font=font(SANS, 26), fill=INK, anchor="mt")

    ly = H - 100
    items = [(RED, "black flag, outside the ban"), (INK, "black flag, inside the ban")]
    x = 40
    for color, label in items:
        d.rectangle((x, ly, x + 34, ly + 34), fill=color)
        d.text((x + 46, ly + 17), label, font=font(SANS, 28), fill=INK, anchor="lm")
        x += 70 + d.textlength(label, font=font(SANS, 28)) + 30
    d.text((40, ly + 56), "Estimated WBGT ≥ 32 °C from Open-Meteo model analysis (NABD backtest)",
           font=font(SANS, 22), fill=MUTED)
    path = OUT / "ban-gap.png"
    img.save(path)
    return path


if __name__ == "__main__":
    for p in (problem_stories(), ban_gap()):
        print("wrote", p.relative_to(ROOT))

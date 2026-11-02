"""Run the backtests and write docs/validation.json + docs/img/validation-*.svg.

    cd backend && .venv/bin/python -m scripts.validate
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path

from nabd.engine import backtest

DOCS = Path(__file__).resolve().parents[2] / "docs"
INK, PAPER, OXIDE, GULF, SUN, MUTED = "#14110e", "#f4ede2", "#b4471f", "#1f6f6b", "#d9a441", "#7a7066"


def flood_svg(r: dict) -> str:
    pts = r["chart"]
    W, H, L, R, T, B = 960, 380, 64, 64, 56, 56
    n = len(pts)
    x = lambda i: L + (W - L - R) * i / max(1, n - 1)
    rain_max = max(p["ref"] for p in pts) * 1.1
    yr = lambda v: H - B - (H - T - B) * v / rain_max
    yi = lambda v: H - B - (H - T - B) * v / 100
    ev = next(e for e in r["events"] if e["event"] in {p["time"] for p in pts} and e["lead_h"])
    ei = [p["time"] for p in pts].index(ev["event"])
    ai = [p["time"] for p in pts].index(ev["alarm_from"]) if ev["alarm_from"] in [p["time"] for p in pts] else 0
    bars = "".join(f'<rect x="{x(i) - 2:.1f}" y="{yr(p["ref"]):.1f}" width="4" height="{H - B - yr(p["ref"]):.1f}" fill="{GULF}" opacity="0.55"/>'
                   for i, p in enumerate(pts))
    ahead = " ".join(f"{x(i):.1f},{yi(max(p['index_now'], p['index_ahead'])):.1f}" for i, p in enumerate(pts))
    now = " ".join(f"{x(i):.1f},{yi(p['index_now']):.1f}" for i, p in enumerate(pts))
    ticks = "".join(f'<text x="{x(i):.1f}" y="{H - B + 20}" font-size="12" fill="{MUTED}" text-anchor="middle">{datetime.fromisoformat(p["time"]).strftime("%d %b")}</text>'
                    f'<line x1="{x(i):.1f}" x2="{x(i):.1f}" y1="{T}" y2="{H - B}" stroke="{INK}" opacity="0.06"/>'
                    for i, p in enumerate(pts) if p["time"].endswith("T00:00"))
    thr = yr(backtest.FLOOD_MM_6H)
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="Archivo, Helvetica, Arial, sans-serif">
<rect width="{W}" height="{H}" fill="{PAPER}"/>
<text x="{L}" y="28" font-size="18" font-weight="800" fill="{INK}">Hatta, 16 April 2024 — NABD flagged the flood {ev['lead_h']} h before the threshold</text>
<text x="{L}" y="46" font-size="12" fill="{MUTED}">Only forecasts already issued at each hour (Open-Meteo Previous Runs). Observation-only alarm: {ev['nowcast_lead_h']} h.</text>
<rect x="{x(ai):.1f}" y="{T}" width="{x(ei) - x(ai):.1f}" height="{H - T - B}" fill="{SUN}" opacity="0.16"/>
{ticks}{bars}
<line x1="{L}" x2="{W - R}" y1="{thr:.1f}" y2="{thr:.1f}" stroke="{GULF}" stroke-dasharray="5 4"/>
<text x="{W - R}" y="{thr - 6:.1f}" font-size="11" fill="{GULF}" text-anchor="end">6-h rain threshold {backtest.FLOOD_MM_6H:g} mm</text>
<line x1="{L}" x2="{W - R}" y1="{yi(backtest.ALARM_INDEX):.1f}" y2="{yi(backtest.ALARM_INDEX):.1f}" stroke="{OXIDE}" stroke-dasharray="2 4"/>
<polyline points="{now}" fill="none" stroke="{INK}" stroke-width="1.5" opacity="0.45"/>
<polyline points="{ahead}" fill="none" stroke="{OXIDE}" stroke-width="2.5"/>
<line x1="{x(ai):.1f}" x2="{x(ai):.1f}" y1="{T}" y2="{H - B}" stroke="{OXIDE}" stroke-width="2"/>
<text x="{x(ai) - 6:.1f}" y="{T + 14}" font-size="12" font-weight="800" fill="{OXIDE}" text-anchor="end">NABD alarm · {datetime.fromisoformat(ev['alarm_from']).strftime('%d %b %H:%M')}</text>
<line x1="{x(ei):.1f}" x2="{x(ei):.1f}" y1="{T}" y2="{H - B}" stroke="{GULF}" stroke-width="2"/>
<text x="{x(ei) - 6:.1f}" y="{T + 14}" font-size="12" font-weight="800" fill="{GULF}" text-anchor="end">threshold crossed · {datetime.fromisoformat(ev['event']).strftime('%d %b %H:%M')}</text>
<text x="{(x(ai) + x(ei)) / 2:.1f}" y="{T + 60}" font-size="30" font-weight="900" fill="{INK}" text-anchor="middle">{ev['lead_h']} h</text>
<text x="{L - 10}" y="{T + 4}" font-size="11" fill="{MUTED}" text-anchor="end">100</text>
<text x="{L - 10}" y="{H - B}" font-size="11" fill="{MUTED}" text-anchor="end">0</text>
<text x="{W - R + 10}" y="{T + 4}" font-size="11" fill="{GULF}">{rain_max:.0f} mm</text>
<g font-size="12" fill="{INK}" transform="translate({L},{H - 14})">
<rect width="14" height="4" y="-4" fill="{OXIDE}"/><text x="20">Nabd Index incl. issued forecasts</text>
<rect x="240" width="14" height="4" y="-4" fill="{INK}" opacity="0.45"/><text x="260">observations only</text>
<rect x="400" width="10" height="10" y="-9" fill="{GULF}" opacity="0.55"/><text x="416">6-h rain (mm, right axis)</text>
</g>
</svg>"""


def heat_svg(rs: list[dict]) -> str:
    W, H = 960, 300
    cards = []
    for k, r in enumerate(rs):
        s = r["summary"]
        x0 = 32 + k * 464
        days = r["days"]
        cw = 400 / len(days)
        cells = "".join(
            f'<rect x="{x0 + i * cw:.1f}" y="150" width="{cw - 2:.1f}" height="44" rx="3" '
            f'fill="{OXIDE if d["event"] and d["forecast_peak_index"] >= backtest.ALARM_INDEX else "#e3a08a" if d["event"] else SUN if d["forecast_peak_index"] >= backtest.ALARM_INDEX else "#d9d2c5"}"/>'
            for i, d in enumerate(days))
        cards.append(f"""<g>
<text x="{x0}" y="70" font-size="15" font-weight="800" fill="{INK}">{r['title']}</text>
<text x="{x0}" y="122" font-size="44" font-weight="900" fill="{OXIDE}">{s['restrict']['hit']}/{s['event_days']}</text>
<text x="{x0 + 120}" y="104" font-size="12" fill="{INK}">black-flag days flagged by 05:00</text>
<text x="{x0 + 120}" y="120" font-size="12" fill="{MUTED}">median {s['median_lead_h']:g} h ahead · false-alarm ratio {s['restrict']['far']:.2f}</text>
{cells}
<text x="{x0}" y="222" font-size="12" fill="{INK}"><tspan font-weight="800">{s['outside_midday_ban']} of {s['black_flag_hours']}</tspan> black-flag hours fell outside the 12:30–15:00 midday ban</text>
</g>""")
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="Archivo, Helvetica, Arial, sans-serif">
<rect width="{W}" height="{H}" fill="{PAPER}"/>
<text x="32" y="36" font-size="18" font-weight="800" fill="{INK}">Dubai South heat — one square per day, scored at 05:00 with forecasts issued by then</text>
{''.join(cards)}
<g font-size="11" fill="{INK}" transform="translate(32,268)">
<rect width="12" height="12" y="-10" fill="{OXIDE}"/><text x="18">flagged · black flag happened</text>
<rect x="210" width="12" height="12" y="-10" fill="{SUN}"/><text x="228">flagged · stayed below</text>
<rect x="390" width="12" height="12" y="-10" fill="#e3a08a"/><text x="408">missed</text>
<rect x="480" width="12" height="12" y="-10" fill="#d9d2c5"/><text x="498">quiet</text>
</g>
</svg>"""


async def main() -> None:
    results = await backtest.run_all()
    DOCS.mkdir(exist_ok=True)
    (DOCS / "img").mkdir(exist_ok=True)
    (DOCS / "validation.json").write_text(json.dumps(results, indent=1))
    by_id = {r["id"]: r for r in results}
    (DOCS / "img" / "validation-flood.svg").write_text(flood_svg(by_id["flood-2024"]))
    (DOCS / "img" / "validation-heat.svg").write_text(heat_svg([by_id["heat-aug-2025"], by_id["heat-sep-2025"]]))
    for r in results:
        print(r["title"], json.dumps(r["summary"]))


if __name__ == "__main__":
    asyncio.run(main())

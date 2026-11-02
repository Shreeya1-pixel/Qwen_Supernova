"""UAE calendar rules that change human risk: the midday work ban and Ramadan."""
from __future__ import annotations

from datetime import date, datetime, time

# MoHRE midday break: 15 June – 15 September, 12:30–15:00.
MIDDAY_BAN_START = (6, 15)
MIDDAY_BAN_END = (9, 15)
MIDDAY_BAN_HOURS = (time(12, 30), time(15, 0))

# Approximate Gregorian Ramadan windows (moon sighting can shift ±1 day).
RAMADAN = {
    2026: (date(2026, 2, 18), date(2026, 3, 19)),
    2027: (date(2027, 2, 8), date(2027, 3, 9)),
    2028: (date(2028, 1, 28), date(2028, 2, 26)),
}


def midday_ban_season(d: date) -> bool:
    return MIDDAY_BAN_START <= (d.month, d.day) <= MIDDAY_BAN_END


def midday_ban_active(dt: datetime) -> bool:
    start, end = MIDDAY_BAN_HOURS
    return midday_ban_season(dt.date()) and start <= dt.time() < end


def is_ramadan(d: date) -> bool:
    window = RAMADAN.get(d.year)
    return bool(window and window[0] <= d <= window[1])


def fasting_hours(dt: datetime) -> bool:
    """Roughly dawn (Fajr ≈ 04:45) to sunset (Maghrib ≈ 18:15) in the UAE."""
    return time(4, 45) <= dt.time() < time(18, 15)

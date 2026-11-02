"""Monitored UAE sites. Each one represents a different extreme environment."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Site:
    id: str
    name: str
    name_ar: str
    kind: str
    lat: float
    lon: float
    coastal: bool
    cohorts: tuple[str, ...]
    story: str


SITES: dict[str, Site] = {
    s.id: s
    for s in (
        Site(
            id="al-quaa",
            name="Al Qua'a",
            name_ar="القوع",
            kind="desert community",
            lat=23.51,
            lon=55.47,
            coastal=False,
            cohorts=("outdoor_workers", "camel_herders", "school_children", "new_arrivals"),
            story="Camel farms, a school and family businesses deep in the Al Ain desert.",
        ),
        Site(
            id="das-island",
            name="Das Island",
            name_ar="جزيرة داس",
            kind="offshore facility",
            lat=25.15,
            lon=52.87,
            coastal=True,
            cohorts=("offshore_crew", "outdoor_workers", "new_arrivals"),
            story="Offshore oil & gas island, 160 km from the mainland — help arrives by air.",
        ),
        Site(
            id="fujairah-coast",
            name="Fujairah coast",
            name_ar="ساحل الفجيرة",
            kind="desalination coast",
            lat=25.12,
            lon=56.36,
            coastal=True,
            cohorts=("town_residents", "outdoor_workers", "asthmatics"),
            story="Desalination intakes on the Gulf of Oman — where red tides have shut plants before.",
        ),
        Site(
            id="dubai-south",
            name="Dubai South",
            name_ar="دبي الجنوب",
            kind="mega construction site",
            lat=24.89,
            lon=55.16,
            coastal=False,
            cohorts=("outdoor_workers", "delivery_riders", "new_arrivals", "asthmatics"),
            story="Thousands of construction workers and riders under open sky.",
        ),
        Site(
            id="hatta",
            name="Hatta",
            name_ar="حتا",
            kind="mountain flash-flood zone",
            lat=24.80,
            lon=56.12,
            coastal=False,
            cohorts=("town_residents", "outdoor_workers", "school_children"),
            story="Wadis in the Hajar mountains — flash floods follow cloudbursts within hours.",
        ),
    )
}


@dataclass(frozen=True)
class Scenario:
    id: str
    site_id: str
    at: str  # local Asia/Dubai time
    title: str
    why: str


SCENARIOS: dict[str, Scenario] = {
    s.id: s
    for s in (
        Scenario("heat-peak", "dubai-south", "2025-07-15T13:00", "Peak summer, inside the midday ban",
                 "47°C on a construction site — the ban is doing its job; NABD shows who is still at risk."),
        Scenario("beyond-calendar", "dubai-south", "2025-09-20T11:00", "Five days after the ban ends",
                 "The calendar says work is fine. The wet-bulb says otherwise."),
        Scenario("offshore-august", "das-island", "2025-08-10T14:00", "Offshore island in August",
                 "Humid Gulf heat plus a 34°C+ sea — the crew is 160 km from a hospital."),
        Scenario("flood-2024", "hatta", "2024-04-16T12:00", "16 April 2024 storm",
                 "The UAE's heaviest rain in 75 years — access cut, standing water, isolation."),
    )
}


def get_site(site_id: str) -> Site:
    try:
        return SITES[site_id]
    except KeyError as exc:
        raise KeyError(f"unknown site '{site_id}'. Known: {', '.join(SITES)}") from exc

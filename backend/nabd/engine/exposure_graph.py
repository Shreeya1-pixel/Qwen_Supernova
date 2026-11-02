"""Exposure graph — how environmental stress reaches specific people.

Adapted from GeoTrade's event→market impact graph. Layers:

    HAZARD  →  PATHWAY  →  COHORT  →  OUTCOME

Shocks propagate breadth-first; every hop multiplies by the edge weight and a
damping factor. Multiple paths into the same node combine as a noisy-OR
(1 − Π(1 − pᵢ)), so two moderate exposures add up without exceeding 1.
Each cohort/outcome keeps its strongest path, which is what the UI explains.

Edge weights and DAMPING are tunable priors set by the team, not fitted parameters. The
links themselves follow published evidence (heat → heat illness and kidney injury: ISO 7243,
Kjellstrom et al. 2016; dust/AQI → respiratory: WHO air-quality guidelines 2021; warm sea →
algal bloom → desalination shutdown: the 2008–09 Gulf of Oman red tide, Richlen et al. 2010;
flood → standing water → dengue: the post-April-2024 UAE dengue alerts). The numbers on each
edge are what a site safety lead should calibrate with local incident data.
"""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

DAMPING = 0.9

NODES: dict[str, tuple[str, str]] = {
    # id: (layer, label)
    "heat": ("hazard", "Heat stress"),
    "dust": ("hazard", "Dust load"),
    "air": ("hazard", "Poor air"),
    "sea_warming": ("hazard", "Sea warming"),
    "uv": ("hazard", "UV"),
    "flood": ("hazard", "Flash-flood rain"),

    "thermal_load": ("pathway", "Thermal load on the body"),
    "inhalation": ("pathway", "Inhalation"),
    "fluid_loss": ("pathway", "Sweat & fluid loss"),
    "algal_bloom": ("pathway", "Algal bloom / red tide"),
    "desal_intake": ("pathway", "Desalination intake"),
    "standing_water": ("pathway", "Standing water & mosquitoes"),
    "livestock_stress": ("pathway", "Camel & livestock heat stress"),
    "skin_eyes": ("pathway", "Skin & eye exposure"),
    "access_cut": ("pathway", "Roads & access cut"),

    "outdoor_workers": ("cohort", "Outdoor workers"),
    "delivery_riders": ("cohort", "Delivery riders"),
    "offshore_crew": ("cohort", "Offshore crew"),
    "camel_herders": ("cohort", "Camel herders"),
    "school_children": ("cohort", "School children"),
    "asthmatics": ("cohort", "People with asthma"),
    "new_arrivals": ("cohort", "New arrivals (not acclimatised)"),
    "town_residents": ("cohort", "Town residents"),

    "heat_illness": ("outcome", "Heat exhaustion / heat stroke"),
    "respiratory": ("outcome", "Asthma & respiratory attacks"),
    "dehydration_kidney": ("outcome", "Dehydration & kidney injury"),
    "water_safety": ("outcome", "Drinking-water disruption"),
    "vector_disease": ("outcome", "Dengue / vector-borne disease"),
    "zoonotic": ("outcome", "Zoonotic risk (e.g. MERS)"),
    "trauma_isolation": ("outcome", "Injury & isolation from care"),
}

EDGES: list[tuple[str, str, float]] = [
    ("heat", "thermal_load", 1.0), ("heat", "fluid_loss", 0.85), ("heat", "livestock_stress", 0.7),
    ("heat", "algal_bloom", 0.25),
    ("dust", "inhalation", 0.95), ("dust", "skin_eyes", 0.4), ("dust", "access_cut", 0.25),
    ("air", "inhalation", 0.9),
    ("sea_warming", "algal_bloom", 0.85), ("sea_warming", "thermal_load", 0.3),
    ("algal_bloom", "desal_intake", 0.8),
    ("uv", "skin_eyes", 0.9), ("uv", "thermal_load", 0.2),
    ("flood", "standing_water", 0.85), ("flood", "access_cut", 0.9),

    ("thermal_load", "outdoor_workers", 1.0), ("thermal_load", "delivery_riders", 0.95),
    ("thermal_load", "offshore_crew", 0.9), ("thermal_load", "new_arrivals", 1.0),
    ("thermal_load", "school_children", 0.55), ("thermal_load", "camel_herders", 0.85),
    ("fluid_loss", "outdoor_workers", 0.9), ("fluid_loss", "new_arrivals", 0.9),
    ("fluid_loss", "delivery_riders", 0.85), ("fluid_loss", "offshore_crew", 0.8),
    ("inhalation", "asthmatics", 1.0), ("inhalation", "school_children", 0.7),
    ("inhalation", "outdoor_workers", 0.75), ("inhalation", "delivery_riders", 0.8),
    ("inhalation", "town_residents", 0.45),
    ("desal_intake", "town_residents", 0.9), ("desal_intake", "offshore_crew", 0.5),
    ("standing_water", "town_residents", 0.7), ("standing_water", "school_children", 0.6),
    ("livestock_stress", "camel_herders", 1.0),
    ("skin_eyes", "outdoor_workers", 0.5), ("skin_eyes", "delivery_riders", 0.5),
    ("access_cut", "town_residents", 0.8), ("access_cut", "offshore_crew", 0.4),

    ("outdoor_workers", "heat_illness", 0.9), ("delivery_riders", "heat_illness", 0.85),
    ("offshore_crew", "heat_illness", 0.8), ("new_arrivals", "heat_illness", 1.0),
    ("camel_herders", "heat_illness", 0.7), ("school_children", "heat_illness", 0.5),
    ("outdoor_workers", "dehydration_kidney", 0.75), ("new_arrivals", "dehydration_kidney", 0.8),
    ("delivery_riders", "dehydration_kidney", 0.7),
    ("asthmatics", "respiratory", 1.0), ("school_children", "respiratory", 0.6),
    ("outdoor_workers", "respiratory", 0.5), ("delivery_riders", "respiratory", 0.55),
    ("town_residents", "respiratory", 0.35),
    ("town_residents", "water_safety", 0.9), ("offshore_crew", "water_safety", 0.4),
    ("town_residents", "vector_disease", 0.6), ("school_children", "vector_disease", 0.5),
    ("camel_herders", "zoonotic", 0.6),
    ("town_residents", "trauma_isolation", 0.6), ("offshore_crew", "trauma_isolation", 0.4),
]

_OUT: dict[str, list[tuple[str, float]]] = defaultdict(list)
for _src, _dst, _w in EDGES:
    _OUT[_src].append((_dst, _w))
_LAYER_ORDER = ["hazard", "pathway", "cohort", "outcome"]


@dataclass
class Propagation:
    risk: dict[str, float]
    best_path: dict[str, list[str]]


def propagate(hazards: dict[str, float], cohorts: tuple[str, ...] | None = None) -> Propagation:
    """Push hazard intensities through the graph, layer by layer."""
    allowed = set(cohorts) if cohorts else None
    risk: dict[str, float] = {h: v for h, v in hazards.items() if h in NODES}
    best: dict[str, tuple[float, list[str]]] = {h: (v, [h]) for h, v in risk.items()}

    contributions: dict[str, dict[str, float]] = defaultdict(dict)
    for layer in _LAYER_ORDER[:-1]:
        # Two passes so pathway→pathway links (bloom → desal intake) settle before moving on.
        for _ in range(2):
            for node, value in list(risk.items()):
                if NODES[node][0] != layer or value <= 0:
                    continue
                for dst, weight in _OUT[node]:
                    if NODES[dst][0] == "cohort" and allowed is not None and dst not in allowed:
                        continue
                    contribution = value * weight * DAMPING
                    contributions[dst][node] = contribution
                    if contribution > best.get(dst, (0.0, []))[0]:
                        best[dst] = (contribution, best[node][1] + [dst])
                    survive = 1.0
                    for p in contributions[dst].values():
                        survive *= 1.0 - p
                    risk[dst] = 1.0 - survive

    return Propagation(risk={k: round(v, 4) for k, v in risk.items()},
                       best_path={k: v[1] for k, v in best.items()})


def explain(prop: Propagation, layer: str, top: int = 5) -> list[dict]:
    rows = [(n, v) for n, v in prop.risk.items() if NODES[n][0] == layer and v > 0.01]
    rows.sort(key=lambda r: r[1], reverse=True)
    return [{
        "id": n, "label": NODES[n][1], "risk": v,
        "path": [{"id": p, "label": NODES[p][1], "layer": NODES[p][0]} for p in prop.best_path.get(n, [])],
    } for n, v in rows[:top]]


def graph_payload(prop: Propagation) -> dict:
    """Nodes + weighted links for the frontend flow diagram."""
    nodes = [{"id": n, "layer": layer, "label": label, "risk": prop.risk.get(n, 0.0)}
             for n, (layer, label) in NODES.items() if prop.risk.get(n, 0.0) > 0.005]
    present = {n["id"] for n in nodes}
    links = [{"source": s, "target": d, "flow": round(prop.risk[s] * w * DAMPING, 4)}
             for s, d, w in EDGES if s in present and d in present]
    return {"nodes": nodes, "links": [l for l in links if l["flow"] > 0.005], "layers": _LAYER_ORDER}

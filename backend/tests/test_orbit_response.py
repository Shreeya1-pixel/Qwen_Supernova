"""Theme 04 · orbit flood + damage triage."""
from __future__ import annotations

from nabd.engine import orbit_response


def test_phases_expand_and_triage():
    phases = orbit_response.phases()
    assert [p["id"] for p in phases] == ["t0", "t4", "t6", "t12", "t24"]
    t0 = phases[0]
    t6 = next(p for p in phases if p["id"] == "t6")
    assert t0["kpis"]["flood_km2"] == 0
    assert t0["kpis"]["buildings_impacted"] == 0
    assert t6["kpis"]["flood_km2"] > 0
    assert t6["kpis"]["buildings_impacted"] >= 1
    assert any(r["status"] != "clear" for r in t6["roads"])
    assert t6["flood"]["features"]


def test_briefing_theme_04():
    b = orbit_response.briefing()
    assert "04" in b["event"]["theme"]
    assert b["advantage_hours"] == 42
    assert b["latency"]["orbit_damage_triage_h"] == 6
    assert len(b["deliverables"]) >= 3


def test_phase_lookup():
    out = orbit_response.overview("t12")
    assert out["phase"]["id"] == "t12"
    assert out["phase"]["kpis"]["zones_active"] == 2


def test_flood_mask_comes_from_stored_scene_ids():
    """Mask polygons must cite the same S1 scene IDs stored in provenance."""
    prov = orbit_response.flood_provenance()
    feats = orbit_response.load_flood_mask()["features"]
    assert feats and set(f["properties"]["before_scene_id"] for f in feats) | set(
        f["properties"]["after_scene_id"] for f in feats
    ) <= set(prov["scene_ids"])

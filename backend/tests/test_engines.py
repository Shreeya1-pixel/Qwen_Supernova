"""Offline tests for the deterministic engines (no network)."""
import math
import random
import time

from nabd.engine import early_warning, exposure_graph
from nabd.engine.council import Assessment, verify
from nabd.engine.hazards import estimate_wbgt
from nabd.engine.physiology import strain_index
from nabd.intake import codeswitch
from nabd.security.integrity import Guard, sign
from nabd.security.mirage import run_red_team


def _ar1_process(phis, n_per=60, seed=1):
    rng, x, out = random.Random(seed), 0.0, []
    for phi in phis:
        for _ in range(n_per):
            x = phi * x + rng.gauss(0, 1)
            out.append(x)
    return out


def test_critical_slowing_down_detected_when_recovery_slows():
    series = _ar1_process([0.1, 0.3, 0.5, 0.7, 0.85, 0.95])
    ew = early_warning.analyse("synthetic", series, window=48, period=1)
    assert ew.tau_ar1 > 0.4
    assert ew.status in {"watch", "approaching_transition"}


def test_stable_process_stays_stable():
    series = _ar1_process([0.2] * 6, seed=3)
    ew = early_warning.analyse("synthetic", series, window=48, period=1)
    assert ew.status == "stable"


def test_daily_cycle_alone_is_not_a_tipping_point():
    rng = random.Random(7)
    hours = 21 * 24
    amp = [4 + 6 * i / hours for i in range(hours)]  # a cycle that even grows over three weeks
    series = [30 + amp[i] * math.sin(2 * math.pi * (i % 24) / 24) + rng.gauss(0, 0.5) for i in range(hours)]
    raw_ar1 = early_warning.ar1(series[-72:])
    ew = early_warning.analyse("diurnal", series)
    assert raw_ar1 > 0.8  # what a naive AR(1) on raw data would report
    assert ew.status == "stable"


def test_backtest_never_sees_the_future():
    from nabd.engine import backtest

    n = 200
    h = {"time": [f"2024-04-{1 + i // 24:02d}T{i % 24:02d}:00" for i in range(n)]}
    for v in backtest.VARS:
        for suffix in ("", "_previous_day1", "_previous_day2"):
            h[f"{v}{suffix}"] = [1.0 if v == "precipitation" else 25.0] * n
    t = 120
    before = backtest._outlook(h, t)
    for v in backtest.VARS:
        for i in range(t + 1, n):
            h[v][i] = 99.0  # the observed future changes completely
    assert backtest._outlook(h, t) == before


def test_kendall_tau_bounds():
    assert early_warning.kendall_tau([1, 2, 3, 4]) == 1.0
    assert early_warning.kendall_tau([4, 3, 2, 1]) == -1.0


def test_exposure_graph_routes_heat_to_new_arrivals_first():
    prop = exposure_graph.propagate({"heat": 0.9})
    cohorts = exposure_graph.explain(prop, "cohort")
    assert cohorts[0]["id"] in {"new_arrivals", "outdoor_workers"}
    assert cohorts[0]["path"][0]["id"] == "heat"
    assert all(0 <= v <= 1 for v in prop.risk.values())


def test_sea_warming_reaches_drinking_water():
    prop = exposure_graph.propagate({"sea_warming": 1.0}, ("town_residents",))
    assert prop.risk["water_safety"] > 0.3
    assert "desal_intake" in prop.best_path["water_safety"]


def test_wbgt_and_strain_index_are_sane():
    assert 30 < estimate_wbgt(45, 28, 900, 5) < 40
    assert strain_index(70, 37.0, 70) == 0
    assert math.isclose(strain_index(180, 39.5, 70), 10)


def _packet(dev, ts, temp):
    return {"device_id": dev, "site_id": "t", "ts": ts, "nonce": f"{dev}-{ts}",
            "metrics": {"temperature": temp, "humidity": 40.0, "pm10": 90.0}}


def test_guard_accepts_honest_and_rejects_forgery_and_replay():
    g, now = Guard(), time.time()
    ok = g.verify(sign(_packet("p1", now, 40.1)), {"temperature": 40.0}, now=now)
    assert ok.accepted
    forged = {**_packet("p1", now + 60, 30.0), "sig": "00" * 32}
    assert "signature" in g.verify(forged, {"temperature": 40.0}, now=now + 60).failed
    replay = sign(_packet("p1", now, 40.1))
    assert "replay" in g.verify(replay, {"temperature": 40.0}, now=now + 61).failed


def test_guard_catches_abrupt_drop_and_clone_swarm():
    g, now = Guard(), time.time()
    g.verify(sign(_packet("p1", now, 40.0)), {"temperature": 40.0}, now=now)
    assert "rate" in g.verify(sign(_packet("p1", now + 60, 33.0)), {"temperature": 40.0}, now=now + 60).failed
    failed = set()
    for d in ("a", "b", "c"):
        failed |= set(g.verify(sign(_packet(d, now + 120, 35.0)), {"temperature": 40.0}, now=now + 120).failed)
    assert "swarm" in failed


def test_red_team_has_no_unmitigated_gaps():
    report = run_red_team("t", {"temperature": 41.0, "humidity": 35.0, "pm10": 140.0})
    assert report["evaded"] == 0
    assert report["protected_rate"] == 1.0


def test_council_never_auto_clears_untrusted_data():
    env = Assessment("environment", 0, 0.8, [])
    body = Assessment("physiology", 0, 0.8, [])
    integ = Assessment("integrity", 2, 0.3, [])
    decision = verify(env, body, integ, trusted=False)
    assert decision["state"] == "hold" and decision["level"] >= 2 and not decision["auto_execute"]


def test_council_diverged_goes_to_human():
    d = verify(Assessment("environment", 4, 0.9, []), Assessment("physiology", 0, 0.9, []),
               Assessment("integrity", 0, 1, []), trusted=True)
    assert d["state"] == "diverged" and not d["auto_execute"]


def test_code_switched_intake():
    p = codeswitch.parse("Bhai, sar ghoom raha hai, paani khatam")
    assert set(p["symptoms"]) == {"dizziness", "no_water"}
    assert p["language"] == "hi" and p["reply"]
    a = codeswitch.parse("mafi mai w rasi y3awerni")
    assert "no_water" in a["symptoms"] and "headache" in a["symptoms"] and a["language"] == "ar"
    assert codeswitch.parse("he fainted near the crane")["severity"] == "emergency"
    assert codeswitch.parse("all good boss")["symptoms"] == []


def test_sun_alert_is_bilingual_and_states_the_limit():
    from nabd.engine.exposure import sun_alert
    msg = sun_alert("hi", 52, 30, 31.2)
    assert "52" in msg and "30 min" in msg and "धूप" in msg
    assert "outdoors in the heat" in sun_alert("xx", 40, 15, 32.0, sun=False)


def test_whatsapp_is_a_dry_run_without_keys(monkeypatch):
    import asyncio
    from nabd.connectors import whatsapp
    monkeypatch.delenv("WHATSAPP_TOKEN", raising=False)
    monkeypatch.delenv("WHATSAPP_PHONE_NUMBER_ID", raising=False)
    out = asyncio.run(whatsapp.send_text("971501234567", "test"))
    assert out["dry_run"] and not out["sent"] and out["to"].endswith("567")

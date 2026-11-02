"""Early-warning signals of critical transitions ("critical slowing down").

Systems that are losing resilience recover more slowly from small shocks. In a
time series that shows up *before* the transition as:
  • rising lag-1 autocorrelation  (memory grows — the system "lingers")
  • rising variance               (fluctuations get larger)
(Scheffer et al., Nature 2009; Dakos et al., PLoS ONE 2012.)

Wet-bulb, dust and AQI all have a strong daily cycle, and AR(1) on raw hourly data
mostly measures that cycle. So, per series (21 days of hourly data):
  1. deseasonalise — fit and subtract the 24 h and 12 h harmonics, letting their
                    amplitude drift linearly over the record
  2. detrend      — subtract a Gaussian-kernel smooth (σ = 36 h), as in Dakos 2012,
                    so slow weather drift is not mistaken for rising memory
  3. rolling 72-h window AR(1) and variance on the residuals
  4. Kendall's τ of each indicator against time over the last 10 days
  5. significance — the same τ on 49 AR(1) surrogates with the residuals' own lag-1
     autocorrelation and variance; a rise only counts if it beats ≥ 95 % of them
  6. Population Stability Index between early and recent residuals, as context

Status comes only from steps 4–5. The council treats it as one extra level of caution,
never as the alarm itself; the backtest's lead times come from forecasts, not from this.
For wearables the same maths runs on HRV, but the evidence for critical slowing down in
human physiology is much thinner than for ecosystems, so those results are labelled
experimental and never change a decision.
"""
from __future__ import annotations

import math
import random
import zlib
from dataclasses import dataclass, field

TAU_ALERT = 0.4
P_ALERT = 0.05
PSI_ALERT = 0.2
WINDOW_H = 72
TREND_SIGMA_H = 36
TAU_SPAN_H = 240
STEP_H = 3
SURROGATES = 49
METHOD = ("24 h + 12 h harmonics (drifting amplitude) removed · Gaussian detrend σ={TREND_SIGMA_H} h · {WINDOW_H} h window · "
          f"Kendall τ over {TAU_SPAN_H // 24} d vs {SURROGATES} AR(1) surrogates")


def fill_gaps(x: list[float | None]) -> list[float]:
    """Linear interpolation over missing hours so the hour-of-day phase stays aligned."""
    known = [i for i, v in enumerate(x) if v is not None]
    if not known:
        return []
    out = [0.0] * len(x)
    for i in range(len(x)):
        if x[i] is not None:
            out[i] = x[i]
            continue
        left = max((k for k in known if k < i), default=None)
        right = min((k for k in known if k > i), default=None)
        if left is None or right is None:
            out[i] = x[left if left is not None else right]
        else:
            w = (i - left) / (right - left)
            out[i] = x[left] * (1 - w) + x[right] * w
    return out


def _solve(a: list[list[float]], b: list[float]) -> list[float]:
    n = len(b)
    m = [row[:] + [b[i]] for i, row in enumerate(a)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(m[r][c]))
        m[c], m[p] = m[p], m[c]
        if abs(m[c][c]) < 1e-12:
            continue
        for r in range(n):
            if r != c:
                f = m[r][c] / m[c][c]
                m[r] = [vr - f * vc for vr, vc in zip(m[r], m[c])]
    return [m[i][n] / m[i][i] if abs(m[i][i]) > 1e-12 else 0.0 for i in range(n)]


def deseasonalise(x: list[float], period: int = 24) -> list[float]:
    """Least-squares fit of the 24 h and 12 h harmonics with linearly drifting amplitude, plus a
    linear trend, over the whole record — so a daily cycle that strengthens or fades (clear days
    after cloudy ones) is removed too, with no edge bias in the most recent hours."""
    if period <= 1 or len(x) < 2 * period:
        mean = sum(x) / len(x) if x else 0.0
        return [v - mean for v in x]
    n = len(x)

    def feats(i: int) -> list[float]:
        t = i / n - 0.5
        row = [1.0, t]
        for k in (1, 2):
            s, c = math.sin(2 * math.pi * k * i / period), math.cos(2 * math.pi * k * i / period)
            row += [s, c, s * t, c * t]
        return row

    rows = [feats(i) for i in range(n)]
    p = len(rows[0])
    ata = [[sum(r[a] * r[b] for r in rows) for b in range(p)] for a in range(p)]
    atb = [sum(r[a] * v for r, v in zip(rows, x)) for a in range(p)]
    beta = _solve(ata, atb)
    return [v - sum(bj * fj for bj, fj in zip(beta, r)) for r, v in zip(rows, x)]


def gaussian_detrend(x: list[float], sigma: float = TREND_SIGMA_H) -> list[float]:
    reach = int(3 * sigma)
    kernel = [math.exp(-0.5 * (k / sigma) ** 2) for k in range(-reach, reach + 1)]
    out = []
    for i in range(len(x)):
        num = den = 0.0
        for k, w in enumerate(kernel):
            j = i + k - reach
            if 0 <= j < len(x):
                num += w * x[j]
                den += w
        out.append(x[i] - num / den)
    return out


def ar1(window: list[float]) -> float:
    n = len(window)
    if n < 3:
        return 0.0
    mean = sum(window) / n
    d = [v - mean for v in window]
    denom = sum(v * v for v in d)
    if denom == 0:
        return 0.0
    return sum(d[i] * d[i + 1] for i in range(n - 1)) / denom


def variance(window: list[float]) -> float:
    n = len(window)
    if n < 2:
        return 0.0
    mean = sum(window) / n
    return sum((v - mean) ** 2 for v in window) / (n - 1)


def kendall_tau(y: list[float]) -> float:
    """τ between the sequence and time (tau-a)."""
    n = len(y)
    if n < 3:
        return 0.0
    s = 0
    for i in range(n - 1):
        yi = y[i]
        for j in range(i + 1, n):
            s += (y[j] > yi) - (y[j] < yi)
    return s / (n * (n - 1) / 2)


def psi(baseline: list[float], current: list[float], bins: int = 8) -> float:
    if len(baseline) < bins or len(current) < bins:
        return 0.0
    lo, hi = min(baseline + current), max(baseline + current)
    if hi == lo:
        return 0.0
    width = (hi - lo) / bins

    def hist(values: list[float]) -> list[float]:
        counts = [0] * bins
        for v in values:
            counts[min(int((v - lo) / width), bins - 1)] += 1
        return [max(c / len(values), 1e-4) for c in counts]

    b, c = hist(baseline), hist(current)
    return sum((ci - bi) * math.log(ci / bi) for bi, ci in zip(b, c))


def _rising_for(values: list[float]) -> int:
    """Number of trailing steps since the indicator's last local minimum."""
    if len(values) < 2:
        return 0
    low = min(range(len(values)), key=lambda i: values[i])
    return len(values) - 1 - low


def _indicators(resid: list[float], window: int) -> tuple[list[float], list[float]]:
    ends = range(window, len(resid) + 1, STEP_H)
    return [ar1(resid[i - window:i]) for i in ends], [variance(resid[i - window:i]) for i in ends]


def _surrogate_p(resid: list[float], window: int, tau_ar: float, tau_var: float, span: int, seed: int) -> tuple[float, float]:
    """Share of AR(1) surrogates (same φ and variance, no trend) whose τ is at least as large."""
    phi = max(-0.99, min(0.99, ar1(resid)))
    sd = math.sqrt(variance(resid) * (1 - phi * phi)) or 1e-9
    rng = random.Random(seed)
    ge_ar = ge_var = 0
    for _ in range(SURROGATES):
        x, s = [], 0.0
        for _ in range(len(resid)):
            s = phi * s + rng.gauss(0, sd)
            x.append(s)
        ar, var = _indicators(x, window)
        ge_ar += kendall_tau(ar[-span:]) >= tau_ar
        ge_var += kendall_tau(var[-span:]) >= tau_var
    return (ge_ar + 1) / (SURROGATES + 1), (ge_var + 1) / (SURROGATES + 1)


@dataclass
class EarlyWarning:
    key: str
    status: str
    tau_ar1: float
    tau_variance: float
    p_ar1: float
    p_variance: float
    psi: float
    rising_hours: int
    explanation: str
    method: str = METHOD
    ar1: list[float] = field(default_factory=list)
    variance: list[float] = field(default_factory=list)
    residual: list[float] = field(default_factory=list)


def analyse(key: str, series: list[float | None], window: int = WINDOW_H, period: int = 24,
            surrogates: bool = True) -> EarlyWarning:
    clean = fill_gaps(series)
    resid = gaussian_detrend(deseasonalise(clean, period))
    if len(resid) < window + 8 * STEP_H:
        window = max(6, len(resid) // 2)
    ar, var = _indicators(resid, window)
    span = max(3, TAU_SPAN_H // STEP_H)
    t_ar, t_var = kendall_tau(ar[-span:]), kendall_tau(var[-span:])
    p_ar = p_var = 1.0
    if surrogates and (t_ar >= TAU_ALERT or t_var >= TAU_ALERT):
        p_ar, p_var = _surrogate_p(resid, window, t_ar, t_var, span, seed=zlib.crc32(key.encode()))
    half = len(resid) // 2
    drift = psi(resid[:half], resid[half:])

    up_ar = t_ar >= TAU_ALERT and p_ar <= P_ALERT
    up_var = t_var >= TAU_ALERT and p_var <= P_ALERT
    status = "approaching_transition" if up_ar and up_var else "watch" if up_ar or up_var else "stable"

    steps = (min(_rising_for(ar), _rising_for(var)) if status == "approaching_transition"
             else max(_rising_for(ar) if up_ar else 0, _rising_for(var) if up_var else 0))
    rising = steps * STEP_H

    parts = []
    if up_ar:
        parts.append(f"memory rising (τ={t_ar:.2f}, p={p_ar:.2f})")
    if up_var:
        parts.append(f"swings widening (τ={t_var:.2f}, p={p_var:.2f})")
    if parts:
        explanation = "; ".join(parts) + f" — building for ~{rising} h"
    elif t_ar >= TAU_ALERT or t_var >= TAU_ALERT:
        explanation = "indicators rising, but not beyond what random AR(1) noise produces"
    else:
        explanation = "recovers normally from fluctuations"
    if drift >= PSI_ALERT:
        explanation += f" (baseline also shifted, PSI={drift:.2f})"

    return EarlyWarning(key=key, status=status, tau_ar1=round(t_ar, 3), tau_variance=round(t_var, 3),
                        p_ar1=round(p_ar, 2), p_variance=round(p_var, 2), psi=round(drift, 3),
                        rising_hours=rising, explanation=explanation,
                        ar1=[round(v, 4) for v in ar], variance=[round(v, 4) for v in var],
                        residual=[round(v, 3) for v in resid[-WINDOW_H * 2:]])

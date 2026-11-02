# NABD — methods, validation and limits

## Validation (lead-time backtest)

Reproduce: `cd backend && .venv/bin/python -m scripts.validate`. Output: `docs/validation.json`, `docs/img/validation-*.svg|png`, `GET /api/validation`.

**No look-ahead.** For every hour *t*, NABD sees:
- the reference series up to *t*, from Open-Meteo analysis (the first hours of each model run);
- forecasts **already issued** by *t*, from the [Open-Meteo Previous Runs API](https://open-meteo.com/en/docs/previous-runs-api): the previous day's run for t+1…t+18, and the run from two days earlier for t+19…t+42.

The 6-hour margin covers model run and publication delay. `test_backtest_never_sees_the_future` changes every observed value after *t* and checks that the alarm at *t* doesn't move.

**Rules (fixed before scoring):**
- *Flood event:* reference 6-h rain ≥ 25 mm, the point where NABD's flood hazard saturates.
- *Heat event:* estimated WBGT ≥ 32 °C (black flag for heavy work) during the 06–18 shift.
- *Alarm:* the Nabd Index, run through observed plus issued-forecast data, reaches 65 (RESTRICT). Floods use "now or within 42 h". Heat is scored daily, at 05:00, for that day's shift.
- *Lead time:* the event hour minus the start of the alarm run that's still active at the event.

| Case | Result |
|---|---|
| Hatta, Mar–May 2024 (2,208 h) | 2/2 flood events flagged: 39 h (16 Apr) and 49 h (9 Mar) ahead. Observations alone: 3 h. 7 of 9 alarm periods were false. |
| Dubai South, Aug 2025 | 25/25 black-flag days flagged by 05:00, median 7 h. False-alarm ratio 0.19 (0.11 at the stop level). 65 of 113 black-flag hours fell outside the midday ban. |
| Dubai South, Sep 2025 | 14/14 days flagged, median 8 h. False-alarm ratio 0.53. 35 of 45 black-flag hours fell outside the ban. |

**What it shows:**
- The lead time comes from **public forecasts plus the index's memory**. The tipping-point statistics aren't the source.
- The reference is model analysis, not rain gauges or a globe thermometer.
- The sample is small: 2 flood events and 61 heat days.

## Tipping-point statistics (critical slowing down)

Wet-bulb, dust and AQI have strong daily cycles. AR(1) on raw hourly data mostly measures the cycle. Per series:

1. **21 days** of hourly data; gaps are linearly interpolated so the hour-of-day phase stays aligned.
2. **Deseasonalise:** a least-squares fit of the 24 h and 12 h harmonics with linearly drifting amplitude, plus a linear trend. This removes cycles that strengthen or fade (clear days after cloudy ones) without edge bias in the most recent hours.
3. **Detrend:** subtract a Gaussian-kernel smooth, σ = 36 h (Dakos et al. 2012).
4. **Indicators:** AR(1) and variance in a rolling **72 h** window, stepped every 3 h.
5. **Trend:** Kendall's τ over the last 10 days.
6. **Significance:** τ is compared with **49 AR(1) surrogates** that share the residuals' lag-1 autocorrelation and variance. A rise only counts if τ ≥ 0.4 and p ≤ 0.05.
7. **Context:** the Population Stability Index between the early and recent residuals.

**Tests:**
- A pure daily cycle that grows for three weeks stays `stable`; naive AR(1) on the raw series would read above 0.8.
- An AR(1) process whose φ rises from 0.1 to 0.95 is flagged.

**Use:** the signal adds at most one level of caution in the council, and never alarms alone. The same maths runs on wearable HRV, but evidence for critical slowing down in human physiology is much weaker than in ecosystems. Those results are marked `experimental` and never change a decision.

## Nabd Index

Each hazard keeps a "fast attack, slow release" memory, with half-lives of: heat 6 h, UV 3 h, air 12 h, dust 24 h, flood 48 h, sea warming 72 h. Hazards combine as a severity-weighted noisy-OR, and each hazard's share of −log(1 − index) is reported as a driver. Hazard scales:

- heat: WBGT 26 → 33 °C
- dust: PM10 100 → 500
- air: AQI 100 → 250
- sea warming: SST 31 → 36 °C
- UV: 8 → 12
- flood: 6-h rain 0 → 25 mm

## Exposure graph

Hazard → pathway → cohort → outcome, with breadth-first propagation, edge weight × damping 0.9, and noisy-OR combination. **Weights are tunable priors**, not fitted parameters. The links follow published evidence:
- heat → heat illness and kidney injury: ISO 7243; Kjellstrom et al. 2016
- dust/AQI → respiratory: WHO air-quality guidelines 2021
- warm sea → algal bloom → desalination shutdown: the 2008–09 Gulf of Oman red tide; Richlen et al. 2010
- flood → standing water → dengue

An early "warm sea → divers → decompression illness" path was dropped as a stretch.

## Personal thresholds

The Moran Physiological Strain Index (PSI) runs on simulated HR and core temperature driven by site WBGT. Each worker's line shifts with acclimatisation days, age and Ramadan fasting. A Beta(α, β) belief updates from supervisor feedback and is bounded, so feedback can't switch protection off.

## Scenario mode

Population comes from the WorldPop 2020 UN-adjusted 100 m grid, aggregated to about 200 m (`scripts/prep_population.py`). A zone's estimate is the sum of cells whose centre lies inside the polygon (Turf). Buildings are OpenStreetMap footprints via Overpass, counted if any vertex is inside the zone. Preset districts are approximate hand-drawn outlines. These are modelled estimates, not live occupancy, and the zone is a user-drawn footprint, not a detected flood extent.

## Off-grid relay

The 21-byte frame layout:

| Field | Size |
|---|---|
| Version/type | 1 B |
| Id | 3 B |
| TTL/hops | 1 B, zeroed before signing |
| Site, level, action | 3 B |
| Unix minutes | 4 B |
| Origin | 1 B |
| HMAC-SHA256 truncated | 8 B |

Each phone dedupes, relays once after 250–700 ms of jitter, and stores and forwards via "hello" frames.

## Full list of limits

- **Mesh, iOS:** iOS restricts background BLE advertising and scanning, so advertisement-only relay is reliable only in the foreground. BitChat and Briar mostly use connections. Android is the first target.
- **Mesh, keys:** one shared crew key and an 8-byte truncated signature, so anyone holding the key can forge alerts. Production needs per-device keys signed by the site office, with revocation.
- **Mesh, demo radio:** the demo radio is a browser `BroadcastChannel` with simulated range.
- **Wearables** are simulated from real site WBGT. **WBGT** is estimated from model weather.
- **Lead time** is forecast-driven; see Validation.
- **Weights** for the graph, index severities and thresholds are tunable priors.
- **Chlorophyll-a** (NOAA VIIRS DINEOF via ERDDAP) and **NDVI** (MODIS via ORNL) are verified as sources but not yet wired into the index.
- **Scenario-mode presets** are approximate. Population is unconstrained WorldPop, which spreads people across desert at low density.
- **Gemini** is optional and only writes the supervisor briefing. No decision depends on an LLM.

## Sources

Checked on 6 October 2026. Open each link again the morning of the pitch.

- **UAE storm, 16 April 2024:**
  - 254.8 mm at Khatm Al Shakla in under 24 h, the most since records began in 1949 ([WAM / NCM](https://www.wam.ae/en/article/13vbuq9-uae-witnesses-largest-rainfall-over-past-years), [BBC](https://www.bbc.com/news/world-middle-east-68831408)).
  - Four deaths by 19 April ([Reuters](https://www.reuters.com/world/middle-east/emirates-suspends-flights-transiting-through-dubai-after-storm-2024-04-19/)); later reports say five.
  - 1,244 flights cancelled and 41 diverted at DXB over two days ([The National](https://www.thenationalnews.com/news/uae/2024/04/18/dubai-airport-chief-says-normal-operations-to-resume-in-24-hours-following-storm-chaos/)).
  - *Still to confirm:* when and how the NCM warnings were worded.
- **Nepali workers in Qatar:** "as many as 200 of the 571 CVD deaths during 2009–2017 could have been prevented" ([Pradhan et al., *Cardiology* 2019](https://pubmed.ncbi.nlm.nih.gov/31302648/)).
- **Migrant deaths in the Gulf:** "as many as 10,000 migrant workers from south and southeast Asia die in the Gulf every year … more than 1 out of every 2 deaths is effectively unexplained" ([Vital Signs Partnership, 2022](https://vitalsignsproject.org/research/report-1/)).
- **ILO 2024:**
  - 22.85 million injuries and 18,970 deaths a year attributable to excessive heat ([*Ensuring safety and health at work in a changing climate*](https://www.ilo.org/sites/default/files/2024-07/ILO_SafeDay24_Report_r11.pdf)).
  - Arab States 83.6% exposed, against a 71% global average. Africa is higher at 92.9%, so don't say "highest" ([*Heat at work*](https://www.ilo.org/resource/news/more-workers-ever-are-losing-fight-against-heat-stress)).
- **ILO 2019:** 2.2% of working hours lost in 2030, equal to 80 million full-time jobs and US$2,400 billion. This is a conservative estimate that assumes work in the shade ([*Working on a warmer planet*](https://www.ilo.org/resource/news/increase-heat-stress-predicted-bring-productivity-loss-equivalent-80)).
- **UAE midday break 2025:** 12:30–15:00, 15 June–15 September. AED 5,000 per worker per breach, up to AED 50,000 when several workers are involved ([MoHRE](https://mohre.gov.ae/en/media-center/news/3/6/2025/mohre-to-implement-midday-break-for-the-21st-consecutive-year-from-15-june-to-15-september-2025)).
- **Survivability:**
  - Under RCP8.5, wet-bulb maxima in Abu Dhabi, Dubai, Doha, Dhahran and Bandar Abbas exceed 35 °C several times in 2071–2100 ([Pal & Eltahir, *Nature Climate Change* 2016](https://www.nature.com/articles/nclimate2833)).
  - Original threshold: Sherwood & Huber, *PNAS* 2010.
- **Red tide 2008–09:**
  - The bloom "forced desalination plants in Oman and the UAE to cease or modify operations" ([Richlen et al., *Harmful Algae* 2010](https://www.sciencedirect.com/science/article/abs/pii/S1568988309001048)).
  - The Ghalilah plant in Ras Al Khaimah stayed shut for over a month ([Gulf News](https://gulfnews.com/uae/desalination-plant-remains-shut-fewa-continues-to-provide-water-1.148897)).
- **Critical slowing down:** Scheffer et al., *Nature* 2009; Dakos et al., *PLoS ONE* 2012.

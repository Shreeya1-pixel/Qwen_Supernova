# NABD — speaker notes

The first part is a script for every app screen: what to click and what to say. The second part has notes for each slide of the [pitch deck](NABD_pitch.pdf), matching the speaker notes in PowerPoint's notes pane.

**Before you start**
- Backend running on `:8040` and frontend on `:3848`.
- Browser zoom at 100%.
- Language set to EN.
- Open `/scenario` once to warm the population cache.
- Open two or three `/relay?slot=N` windows next to `/alerts`.

**If the network fails:** the backend serves its last cached snapshot and says so on screen, and the off-grid relay needs no network at all.

---

## Part 1 · Demo, screen by screen

The full tour takes about 6 minutes. The 3-minute version is screens 1, 2, 3, 7, 5 and 6.

### 1. Overview (`/`) · 40 s
**Show:** the site rail on the left, the Nabd Index dial, the verdict stamp, the compact live map and the "crew over their line" list.

**Say:** "These are five real UAE sites: a Dubai South construction site, an offshore platform, Hatta, a desert farm and a coastal desalination area. Each number comes from live satellite and weather data. The dial is the Nabd Index, from 0 to 100. The stamp is the decision, and it only appears when three independent checks agree. Below, NABD lists who will cross their *own* limit in the next three hours. Not 'it's hot': 'Ravi, day three on site, needs shade by 11.'"

**Click:** a different site in the rail. Everything updates.

### 2. Live map (`/map`) · 40 s
**Show:** full-screen HD satellite with the live feels-like heat field over UAE land.

**Say:** "This heat field is live: about 130 Open-Meteo points, interpolated and clipped to land. Hover anywhere to read the wet-bulb temperature."

**Click:**
- Switch the layer to *NASA land temperature*, then *Dust (AOD)*: "That's today's NASA satellite pass."
- Click a site marker so the map flies in.
- Optionally tilt to 3D.

### 3. Signals (`/signals`) · 50 s
**Show:** the index trend, the hazards-now rings, the tipping-point table, the validation panel and the exposure graph.

**Say:**
- **Trend:** "The index has memory. Dust lingers for a day, a warm sea for three."
- **Tipping-point table:** "We test whether the land is recovering more slowly from small shocks. That's the classic warning sign before a tipping point. We remove the daily cycle first and test against random noise, and this signal can only add caution, never fire an alarm."
- **Validation panel:** "Does it work? We replayed history using only forecasts that had been published at each hour. On Hatta, April 2024, we had 39 hours of warning; observations alone gave 3. Every black-flag heat day in August and September 2025 was flagged by 5 a.m. And seven of nine flood alarm periods were false. We show that number on purpose."
- **Exposure graph:** "This graph is *who* it reaches and *how*: warm sea, algal bloom, desalination intake, drinking water."

### 4. Crew (`/crew`) · 30 s
**Show:** worker cards with their personal lines, acclimatisation days, and the strain forecast.

**Say:** "Day 3 in Dubai is not year 9. Each line moves with acclimatisation, age and fasting."

**Click:** toggle **Ramadan** in the top bar and watch the lines drop. "When a supervisor says 'he was fine', NABD learns from it, but within bounds. Feedback can never switch protection off."

### 5. Alerts (`/alerts`) and the relay phones · 50 s
**Show:** the playbook on the left (midday ban, WBGT work–rest cycles, WhatsApp, Jira, cooling cost) and the phone mesh.

**Click:** **Stop work**. Watch the frame hop between the phone windows. Each phone shows the alert in its owner's language, and "Got it" acknowledgements travel back.

**Say:** "This alert is 21 bytes, small enough for one Bluetooth advertisement. It's signed, each phone relays it once, and a phone that walks back into range catches up. No tower needed. Honest caveat: iOS restricts background Bluetooth, so Android comes first, and today the crew shares one key."

### 6. Messages (`/messages`) · 30 s
**Click:** send a code-switched message, e.g. `sar ghoom raha hai, paani khatam`.

**Say:** "That's Hinglish for 'my head is spinning, the water's finished'. NABD understands eight languages on the device, raises that worker's strain, fires the playbook, and replies in Hindi. No LLM is involved, so it works offline."

### 7. Scenario (`/scenario`) · 50 s
**Show:** street-level satellite imagery and the "Simulated scenario" banner.

**Click:**
- Flood is already selected.
- Pick the **Academic City** preset: its official OSM boundary, ~38,200 people, 12.98 km², at least 354 mapped buildings. Point at Silicon Oasis next door, marked outside the zone.
- Switch the overlay to **Population** to show the dots, and read the legend aloud.
- Scroll to **People in zone · exposure watch**. "Live conditions here give a safe limit of N minutes in the sun. These phones have opted in. Anyone past their limit gets a WhatsApp alert in their own language, automatically." If WhatsApp is connected, your own phone buzzes.
- Draw a circle somewhere else to show it's live.

**Say:** "Before a storm, a planner asks: if this floods, how many people are inside? This is WorldPop's modelled population and OpenStreetMap buildings. It's labelled as a simulation, not live occupancy."

### 8. Sensors (`/sensors`) · 30 s
**Click:** **Send honest probes**, then **Run the red team**.

**Say:** "Sensors are signed and checked for freshness, replay, physics and agreement with satellites. A ground sensor can raise risk, never lower it. Our own red team, Mirage, tries to fool it and reports honestly what got through."

### 9. Audit (`/audit`) · 20 s
**Say:** "Every warning and every action is in a hash-chained log. If anyone edits a line, the chain breaks. That's what an inspector or an insurer wants to see, and it's a big part of why a contractor would pay."

### 10. Replay (top bar) · 20 s, optional
**Click:** **Replay** and choose 16 April 2024.

**Say:** "This is the same engine on the real storm day."

### 11. Pitch story (`/story`) · use as a backup or a closer
**Say:** "This is the narrative version for non-technical audiences. It goes from a warm sea to an empty tap."

**Tip:** press **ع** on any screen to show the full Arabic, right-to-left interface.

---

## Part 2 · Slide notes

**1 · The land feels it first.**
Good morning. On 16 April 2024 the UAE had its heaviest rain in 75 years. On ordinary summer days, outdoor workers across the Gulf collapse from heat. In both cases the warning existed somewhere. It just didn't reach the person standing in the wadi, or on the scaffold, in a language they read, in time. NABD is the bridge between the forecast and that person.

**2 · The warning existed. It didn't reach the person.**
Three stories. First, April 2024: the heaviest rain in 75 years. The national weather centre issued warnings in advance, yet people still drove into wadis and crews were still on site. Second, a peer-reviewed study of Nepali workers in Qatar found deaths climbing with summer heat, and estimated around 200 of 571 could have been prevented. Third, across the Gulf as many as ten thousand migrant workers die each year, and more than half are written off as "natural causes" or "cardiac arrest". None of this is a lack of weather data. It's a last-mile problem.

**3 · Rules follow the calendar. Danger doesn't.**
The midday ban is a good law and it saves lives. But it is a date range and a time window. When we replayed August 2025 at Dubai South, more than half of the dangerous heat hours fell outside the ban window: mornings, late afternoons, September. Then three more gaps. Forecasts are regional, but decisions are per site. Alerts are in Arabic and English, but the crew isn't. And the places with the worst conditions often have no signal. NABD closes all four.

**4 · The Gulf is the planet's preview**
This isn't a niche. The ILO says over eighty percent of workers in the Arab States are exposed to excessive heat, well above the global average of seventy-one. Heat already causes close to nineteen thousand work deaths a year worldwide, and heat stress is projected to wipe out 2.2 percent of all working hours by 2030. That's a safety problem and an economic one. The Gulf is where it hits first.

**5 · From the land's signal to the person's phone**
Here's the whole system in one line. We take live satellite, weather and sensor data, check it hasn't been tampered with, compute a stress index with memory, and add forecasts. We work out which people are exposed and through which pathway. Three independent checks have to agree before anything automatic happens. Then the alert goes to the worker in their own language, and if there's no network it hops phone to phone.

**6 · Hatta, April 2024: flagged 39 hours before the flood threshold**
Judges always ask: does it work? So we replayed history. At every hour, NABD only saw the forecasts that had actually been published by then, and we have a unit test proving nothing from the future leaks in. On the Hatta storm, NABD's alarm came 39 hours before six-hour rain crossed 25 millimetres. Watching observations alone gives you three. For heat, it flagged every black-flag day in August and September 2025 by five in the morning, with a false-alarm ratio of 0.19 in August and 0.53 in September. And we're upfront about the weak spot: the flood alarm also fired seven times when nothing happened. For floods that trade-off is usually acceptable, because pre-positioning a crew is cheap and being caught in a wadi is not.

**7 · A number with memory, plus a check for lost resilience**
The first idea. A body remembers yesterday's heat, so our index remembers too, and every hazard fades at its own physical pace. On top of that we run the tipping-point test from ecology: when a system starts recovering more slowly from small shocks, it's losing resilience. We did this carefully: we strip out the daily cycle and test against random noise. It can raise caution by one step but never fires an alarm by itself. The forecast is what gives the lead time, and we say so.

**8 · Not "it's hot." Who gets hurt, and how.**
A temperature tells a supervisor nothing about who to protect. The exposure graph does. Heat reaches outdoor workers through thermal load. Dust reaches asthmatics through inhalation. And uniquely here, a warm sea reaches a whole town through algal blooms and desalination intakes. That really happened in 2008: the Ghalilah plant in Ras Al Khaimah stayed shut for over a month and residents relied on tankers. The weights are our priors, and we label them that way so a site can tune them.

**9 · Day 3 in Dubai is not year 9.**
The third idea: thresholds are personal. Someone who landed three days ago isn't acclimatised. Someone fasting in Ramadan dehydrates differently. NABD tracks each person's own line and shows who will cross it in the next three hours. When a worker types "sar ghoom raha hai, paani khatam", my head is spinning and the water's finished, NABD understands it, raises his risk, and answers in Hindi.

**10 · Draw the flood zone. See who is inside.**
Before a storm, an emergency planner's question is "if this area floods, how many people are we talking about?" Scenario mode answers it in one click. This is Academic City using its official OpenStreetMap boundary, not a shape we drew: about thirty-eight thousand modelled residents, and at least three hundred and fifty mapped buildings. OpenStreetMap misses some villas and dorms, so that's a floor, not a count. Each dot is about fifty people, placed randomly inside its grid cell, so read it as density, not addresses. Silicon Oasis next door is marked outside the zone. It's all labelled as a simulation, and it runs offline.

**11 · Works when the network doesn't, and when someone lies**
Two things make NABD trustworthy. First, it works off the grid: the alert is twenty-one bytes, small enough for one Bluetooth advertisement, and it hops between phones even with no tower. Second, it's hard to fool: sensor readings are signed and cross-checked against physics and satellites, and three independent checks have to agree before anything automatic happens. One honest caveat: iOS restricts background Bluetooth, so Android is our first target, and the demo uses one shared crew key.

**12 · Compliance, fewer incidents, more safe working hours**
Why would someone buy this? Three reasons. Compliance: the midday-ban fine is five thousand dirhams per worker, up to fifty thousand per case, and NABD gives you an audit trail that proves you acted on the warning. Fewer incidents: one heat stroke offshore means a helicopter evacuation and a stopped platform. Productivity: instead of losing a whole day, you shift the work to the safe hours the forecast shows. And because every data source is free, the cost to run a site stays low.

**13 · Who buys first, and how**
Our first buyers are the organisations that carry the liability: contractors, oil and gas, utilities and delivery fleets. Then government, where Scenario mode is a flood-planning tool. The model is a per-site subscription; our working hypothesis is around two and a half thousand dirhams per site per month. A single maximum fine covers about twenty months of that; even one per-worker fine covers two. We'd sell through HSE consultancies and insurers, who already talk to these buyers. Start with one contractor for one summer, prove zero fines and fewer incidents, then expand across the GCC.

**14 · Live data, simulated scenarios**
Six stops, about thirty seconds each. The weather, satellite and population data are live or archived; the wearables and the flood zone are simulations, and the screen labels them that way. If the Wi-Fi drops, the backend serves the last cached snapshot and says so on screen, and the off-grid relay works with no network at all. That's the point.

**15 · What we haven't proven yet**
We'd rather tell you our limits than have you find them. The lead time is forecast-driven. The alarms over-warn: in September about half the heat warnings were for days that never reached black flag. Wearables are simulated. The mesh has a real iOS limitation and uses a shared key for the demo. The graph weights are our priors. Each one has a concrete next step on the right, and the first is a pilot with one contractor and real wearables.

**16 · Listen to the land. Protect the person.**
The warning almost always exists. NABD makes sure it reaches the person, in time, in their language, even with no signal. Thank you.

---

## Likely judge questions

- **"Isn't this just a weather app?"** No. Weather apps stop at "it's hot in Dubai". NABD turns that into a per-site, per-worker action, explains who it reaches and how, delivers it in the worker's language, and works offline.
- **"Where does the lead time come from?"** Public forecasts plus the index's memory. The tipping-point statistics are context only. We say this on the validation slide.
- **"Too many false alarms?"** For floods, yes: 7 of 9 alarm periods. Pre-positioning a crew is cheap; the threshold is tunable per site. For heat, the false-alarm ratio was 0.19 in August.
- **"Why not use an LLM?"** Safety decisions have to be deterministic and auditable. Gemini only writes the optional supervisor briefing.
- **"Is the population real?"** It's WorldPop's modelled 100 m estimate, not live occupancy, and the screen says so.

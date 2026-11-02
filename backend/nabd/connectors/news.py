"""Live UAE weather news, English and Arabic, as a corroborating signal.

GeoTrade turned headlines into a decaying pressure score per risk factor; this
does the same for hazards. Google News RSS needs no key. Headlines are kept
only if they hit the weather lexicon (English "heat" also means war and sport)
and are about the UAE (Arabic queries pull in the whole region), then weighted
by age with a 48-hour half-life.

News corroborates; it never raises a warning level on its own.
"""
from __future__ import annotations

import asyncio
import math
import re
import time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

import httpx

RSS = "https://news.google.com/rss/search"
QUERIES = [
    ("en", "UAE weather OR NCM OR humidity OR sandstorm when:7d", "en-AE", "AE:en"),
    ("en", "UAE heat stress workers OR midday break when:7d", "en-AE", "AE:en"),
    ("ar", "طقس الإمارات OR غبار OR رطوبة OR أمطار when:7d", "ar", "AE:ar"),
]
LEXICON = {
    "heat": [r"\bheat ?wave\b", r"\bheat stress\b", r"\bheatstroke\b", r"\bmidday (break|ban)\b", r"\b(4[5-9]|5[0-2]) ?°?c\b",
             r"temperatures? (soar|rise|hit|reach)", "حرارة", "الحر", "درجات الحرارة", "ضربة شمس", "استراحة منتصف"],
    "humidity": [r"\bhumid", r"\bfog\b", "رطوبة", "ضباب"],
    "dust": [r"\bdust", r"\bsand ?storm", r"\bvisibility\b", "غبار", "عاصفة رملية", "رياح مثيرة", "مدى الرؤية"],
    "flood": [r"\bflood", r"\bheavy rain", r"\bthunderstorm", r"\bwadi", "أمطار", "سيول", "فيضان", "عواصف رعدية"],
    "sea_warming": [r"\bred tide\b", r"\balgal bloom", r"\bcoral bleach", r"\brough sea", "المد الأحمر", "اضطراب البحر"],
}
PATTERNS = {h: [re.compile(p, re.I) for p in ps] for h, ps in LEXICON.items()}
UAE_PLACES = re.compile(
    r"\b(uae|emirates|dubai|abu dhabi|sharjah|ajman|fujairah|ras al[- ]khaimah|umm al[- ]quwain|al ain|hatta|ncm)\b"
    r"|الإمارات|الامارات|دبي|أبوظبي|ابوظبي|الشارقة|عجمان|الفجيرة|رأس الخيمة|أم القيوين|العين|حتا|المركز الوطني للأرصاد",
    re.I)
UAE_OUTLETS = {"khaleej times", "gulf news", "the national", "sharjah24.ae", "wam", "gulf today", "emirates 24|7",
               "الإمارات اليوم", "صحيفة الخليج", "البيان", "الاتحاد", "وام", "الرؤية", "سكاي نيوز عربية"}


ELSEWHERE = re.compile(r"\b(egypt|iraq|jordan|saudi|kuwait|oman|qatar|bahrain|india|pakistan|iran)\b"
                       r"|مصر|العراق|الأردن|السعودية|الكويت|عمان|قطر|البحرين|الهند|باكستان|إيران", re.I)


def is_uae(title: str, source: str) -> bool:
    if UAE_PLACES.search(title):
        return True
    return source.strip().lower() in UAE_OUTLETS and not ELSEWHERE.search(title)
HALF_LIFE_H = 48
TTL = 1800
_cache: dict = {"at": 0.0, "data": None}


def tag(title: str) -> list[str]:
    return [h for h, ps in PATTERNS.items() if any(p.search(title) for p in ps)]


async def _fetch(client: httpx.AsyncClient, lang: str, q: str, hl: str, ceid: str) -> list[dict]:
    r = await client.get(RSS, params={"q": q, "hl": hl, "gl": "AE", "ceid": ceid})
    r.raise_for_status()
    items = []
    for it in ET.fromstring(r.content).iter("item"):
        title = (it.findtext("title") or "").strip()
        source = it.findtext("source") or ""
        if source and title.endswith(f" - {source}"):
            title = title[: -len(source) - 3]
        try:
            published = parsedate_to_datetime(it.findtext("pubDate") or "").timestamp()
        except (TypeError, ValueError):
            continue
        items.append({"title": title, "source": source, "link": it.findtext("link"), "lang": lang,
                      "published": published, "hazards": tag(title)})
    return items


async def signal() -> dict:
    if _cache["data"] and time.time() - _cache["at"] < TTL:
        return _cache["data"]
    try:
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": "Mozilla/5.0"}, follow_redirects=True) as client:
            batches = await asyncio.gather(*(_fetch(client, *q) for q in QUERIES))
    except (httpx.HTTPError, ET.ParseError):
        return _cache["data"] or {"pressure": {}, "articles": [], "stale": True}

    seen, articles = set(), []
    for item in sorted((i for b in batches for i in b), key=lambda i: -i["published"]):
        if item["hazards"] and item["title"] not in seen and is_uae(item["title"], item["source"]):
            seen.add(item["title"])
            articles.append(item)

    now = time.time()
    weight = {h: 0.0 for h in LEXICON}
    for a in articles:
        a["age_hours"] = round((now - a["published"]) / 3600, 1)
        w = 0.5 ** (a["age_hours"] / HALF_LIFE_H)
        for h in a["hazards"]:
            weight[h] += w
    pressure = {h: round(1 - math.exp(-w / 3), 3) for h, w in weight.items()}
    data = {"pressure": pressure, "articles": articles[:24], "stale": False,
            "source": "Google News RSS (en-AE, ar-AE)"}
    _cache.update(at=now, data=data)
    return data

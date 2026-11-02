"""Optional Gemini briefing. All risk decisions are made before this runs;
Gemini only rewrites the structured result as a short human briefing.
Without GEMINI_API_KEY a deterministic template is used instead."""
from __future__ import annotations

import json
import os
from pathlib import Path

import httpx

ENV_FILE = Path(__file__).resolve().parents[3] / ".env"
if ENV_FILE.exists():
    for _line in ENV_FILE.read_text().splitlines():
        _k, _, _v = _line.partition("=")
        if _k.strip() and _v.strip() and not _k.startswith("#"):
            os.environ.setdefault(_k.strip(), _v.strip().strip('"'))

MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def template_briefing(snapshot: dict) -> str:
    site = snapshot["site"]["name"]
    idx = snapshot["index"]
    decision = snapshot["council"]
    top = idx["drivers"][0]["label"].lower() if idx["drivers"] else "no single driver"
    warn = [w for w in snapshot["early_warning"] if w["status"] != "stable"]
    sentence = f"{site}: Nabd Index {idx['value']:.0f} ({idx['band']}), mostly {top}. "
    if warn:
        sentence += f"Early-warning signal on {warn[0]['key'].replace('_', ' ')}: {warn[0]['explanation']}. "
    sentence += decision["summary"]
    return sentence


async def briefing(snapshot: dict) -> dict:
    key = os.environ.get("GEMINI_API_KEY")
    fallback = template_briefing(snapshot)
    if not key:
        return {"text": fallback, "source": "template"}
    compact = {k: snapshot[k] for k in ("site", "index", "council") if k in snapshot}
    compact["early_warning"] = [{k: w[k] for k in ("key", "status", "explanation")} for w in snapshot["early_warning"]]
    prompt = ("You are a site safety officer in the UAE. In at most 3 short sentences, brief the supervisor. "
              "Use only these facts, keep numbers exact, no speculation:\n" + json.dumps(compact))
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            r = await client.post(URL.format(model=MODEL), params={"key": key},
                                  json={"contents": [{"parts": [{"text": prompt}]}]})
            r.raise_for_status()
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
            return {"text": text, "source": f"gemini:{MODEL}"}
    except (httpx.HTTPError, KeyError, IndexError):
        return {"text": fallback, "source": "template (gemini unavailable)"}

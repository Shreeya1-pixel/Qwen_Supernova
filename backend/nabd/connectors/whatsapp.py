"""WhatsApp Cloud API (Meta) — send one alert message.

Needs, in NABD/.env:
    WHATSAPP_TOKEN=            access token (temporary 24 h token, or a System User permanent token)
    WHATSAPP_PHONE_NUMBER_ID=  the sender's Phone number ID (not the phone number itself)
    WHATSAPP_TEST_TO=          optional: your own number in international format, digits only (9715XXXXXXXX)

Without the token and phone number ID every send is a dry run that returns the message it would have sent.
WhatsApp only delivers free-form text inside a 24 h window opened by the recipient messaging the business
number first; outside it the API returns error 131047 and we fall back to an approved template
(WHATSAPP_TEMPLATE, default Meta's "hello_world").
"""
from __future__ import annotations

import os

import httpx

GRAPH = "https://graph.facebook.com/v21.0"


def configured() -> bool:
    return bool(os.environ.get("WHATSAPP_TOKEN") and os.environ.get("WHATSAPP_PHONE_NUMBER_ID"))


def test_recipient() -> str | None:
    return os.environ.get("WHATSAPP_TEST_TO") or None


def mask(number: str) -> str:
    digits = "".join(c for c in number if c.isdigit())
    return f"+{digits[:3]}•••••{digits[-3:]}" if len(digits) > 6 else "•••"


async def send_text(to: str, body: str) -> dict:
    to = "".join(c for c in to if c.isdigit())
    if not configured():
        return {"sent": False, "dry_run": True, "to": mask(to)}
    url = f"{GRAPH}/{os.environ['WHATSAPP_PHONE_NUMBER_ID']}/messages"
    headers = {"Authorization": f"Bearer {os.environ['WHATSAPP_TOKEN']}"}
    text = {"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": body, "preview_url": False}}
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json=text, headers=headers)
        data = r.json()
        if r.is_success:
            return {"sent": True, "dry_run": False, "to": mask(to), "id": data["messages"][0]["id"], "kind": "text"}
        err = data.get("error", {})
        if err.get("code") in (131047, 131026, 470):
            template = {
                "messaging_product": "whatsapp", "to": to, "type": "template",
                "template": {"name": os.environ.get("WHATSAPP_TEMPLATE", "hello_world"),
                             "language": {"code": os.environ.get("WHATSAPP_TEMPLATE_LANG", "en_US")}},
            }
            r2 = await client.post(url, json=template, headers=headers)
            if r2.is_success:
                return {"sent": True, "dry_run": False, "to": mask(to), "id": r2.json()["messages"][0]["id"],
                        "kind": "template", "note": "outside the 24 h window: sent the approved template instead"}
            err = r2.json().get("error", err)
        return {"sent": False, "dry_run": False, "to": mask(to), "error": err.get("message", r.text[:200]),
                "code": err.get("code")}

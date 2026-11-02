"""Jira Cloud — open one incident ticket per escalated decision.

Needs, in NABD/.env:
    JIRA_BASE_URL=     https://<site>.atlassian.net
    JIRA_USER_EMAIL=   the Atlassian account the token belongs to
    JIRA_API_TOKEN=    id.atlassian.com → Security → API tokens
    JIRA_PROJECT_KEY=  e.g. KAN
    JIRA_ISSUE_TYPE=   optional, default "Task"

Without them every ticket is a dry run that returns what would have been filed.
"""
from __future__ import annotations

import os

import httpx

KEYS = ("JIRA_BASE_URL", "JIRA_USER_EMAIL", "JIRA_API_TOKEN", "JIRA_PROJECT_KEY")


def configured() -> bool:
    return all(os.environ.get(k) for k in KEYS)


def _base() -> str:
    return os.environ["JIRA_BASE_URL"].rstrip("/")


def _auth() -> tuple[str, str]:
    return os.environ["JIRA_USER_EMAIL"], os.environ["JIRA_API_TOKEN"]


def _adf(lines: list[str]) -> dict:
    return {"type": "doc", "version": 1,
            "content": [{"type": "paragraph", "content": [{"type": "text", "text": line}]} for line in lines if line]}


async def status() -> dict:
    if not configured():
        return {"configured": False, "ok": False, "project": None}
    async with httpx.AsyncClient(timeout=10, auth=_auth()) as client:
        r = await client.get(f"{_base()}/rest/api/3/project/{os.environ['JIRA_PROJECT_KEY']}")
    return {"configured": True, "ok": r.is_success, "project": os.environ["JIRA_PROJECT_KEY"],
            "site": _base(), "error": None if r.is_success else f"HTTP {r.status_code}"}


async def _issue_type(client: httpx.AsyncClient, project: str) -> str | None:
    r = await client.get(f"{_base()}/rest/api/3/issue/createmeta/{project}/issuetypes")
    if not r.is_success:
        return None
    types = [t for t in r.json().get("issueTypes", r.json().get("values", [])) if not t.get("subtask")]
    return types[0]["name"] if types else None


async def create_issue(summary: str, lines: list[str], labels: list[str] | None = None) -> dict:
    summary = summary[:250]
    if not configured():
        return {"sent": False, "dry_run": True, "summary": summary}
    project = os.environ["JIRA_PROJECT_KEY"]
    fields = {"project": {"key": project}, "summary": summary, "description": _adf(lines),
              "issuetype": {"name": os.environ.get("JIRA_ISSUE_TYPE", "Task")},
              "labels": labels or ["nabd"]}
    async with httpx.AsyncClient(timeout=15, auth=_auth()) as client:
        r = await client.post(f"{_base()}/rest/api/3/issue", json={"fields": fields})
        if not r.is_success and "issuetype" in r.text:
            fallback = await _issue_type(client, project)
            if fallback:
                fields["issuetype"] = {"name": fallback}
                r = await client.post(f"{_base()}/rest/api/3/issue", json={"fields": fields})
    if r.is_success:
        key = r.json()["key"]
        return {"sent": True, "dry_run": False, "key": key, "url": f"{_base()}/browse/{key}", "summary": summary}
    try:
        body = r.json()
        error = "; ".join(body.get("errorMessages", []) + [f"{k}: {v}" for k, v in body.get("errors", {}).items()])
    except ValueError:
        error = r.text[:200]
    return {"sent": False, "dry_run": False, "summary": summary, "error": error or f"HTTP {r.status_code}"}

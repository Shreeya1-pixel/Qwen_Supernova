#!/usr/bin/env python3
"""Have Gemini write one file from a spec, then type-check and self-repair.

    python tools/localcoder.py tools/specs/trust.md            # write + check
    python tools/localcoder.py tools/specs/trust.md --model gemini-2.5-pro

Key: GEMINI_API_KEY in the environment or in NABD/.env (free tier from aistudio.google.com).

Spec format (paths relative to NABD/):

    target: frontend/src/components/sections/trust.tsx
    context: frontend/src/lib/api.ts, frontend/src/components/sections/reach.tsx
    ---
    What to build, in plain words.

The model sees tools/STYLE.md, the context files, and the current target (if any).
Stdlib only, so it runs with any python3.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
RUNS = ROOT / "tools" / "runs"


def api_key() -> str:
    key = os.environ.get("GEMINI_API_KEY", "")
    env = ROOT / ".env"
    if not key and env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("GEMINI_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
    if not key:
        sys.exit("Set GEMINI_API_KEY (env or NABD/.env). Free key: https://aistudio.google.com/apikey")
    return key


def read_spec(path: Path) -> tuple[str, list[str], str]:
    head, _, body = path.read_text().partition("\n---\n")
    meta = dict(line.split(":", 1) for line in head.strip().splitlines() if ":" in line)
    context = [c.strip() for c in meta.get("context", "").split(",") if c.strip()]
    return meta["target"].strip(), context, body.strip()


def chat(model: str, messages: list[dict], key: str) -> str:
    system = next(m["content"] for m in messages if m["role"] == "system")
    contents = [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                for m in messages if m["role"] != "system"]
    payload = {"system_instruction": {"parts": [{"text": system}]}, "contents": contents,
               "generationConfig": {"temperature": 0.2}}
    req = urllib.request.Request(GEMINI.format(model=model), json.dumps(payload).encode(),
                                 {"content-type": "application/json", "x-goog-api-key": key})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                data = json.loads(r.read())
            return "".join(p.get("text", "") for p in data["candidates"][0]["content"]["parts"])
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 503) or attempt == 3:
                sys.exit(f"Gemini {exc.code}: {exc.read().decode()[:400]}")
            time.sleep(15 * (attempt + 1))
    raise RuntimeError("unreachable")


def extract_code(reply: str) -> str:
    blocks = re.findall(r"```[a-zA-Z]*\n(.*?)```", reply, re.S)
    return max(blocks, key=len).rstrip() + "\n" if blocks else reply.strip() + "\n"


def check(target: str) -> list[str]:
    """Errors that mention the target file only, so pre-existing noise elsewhere is ignored."""
    if target.endswith(".py"):
        r = subprocess.run([sys.executable, "-m", "py_compile", str(ROOT / target)], capture_output=True, text=True)
        return [r.stderr.strip()] if r.returncode else []
    r = subprocess.run(["npx", "tsc", "--noEmit", "--pretty", "false"], cwd=ROOT / "frontend",
                       capture_output=True, text=True)
    rel = target.removeprefix("frontend/")
    return [line for line in r.stdout.splitlines() if line.startswith(rel)]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("spec")
    ap.add_argument("--model", default="gemini-2.5-flash")
    ap.add_argument("--rounds", type=int, default=3)
    args = ap.parse_args()
    key = api_key()

    target, context, task = read_spec(Path(args.spec))
    style = (ROOT / "tools" / "STYLE.md").read_text()
    files = "\n\n".join(f"### {c}\n```\n{(ROOT / c).read_text()}\n```" for c in context)
    existing = (ROOT / target).read_text() if (ROOT / target).exists() else ""
    prompt = (f"{files}\n\n## Task\nWrite the complete file `{target}`.\n\n{task}\n\n"
              + (f"Current contents of the file:\n```\n{existing}\n```\n\n" if existing else "")
              + "Reply with ONE code block containing the whole file. No explanation.")
    messages = [{"role": "system", "content": style}, {"role": "user", "content": prompt}]

    RUNS.mkdir(parents=True, exist_ok=True)
    log = RUNS / f"{Path(args.spec).stem}.log"
    log.write_text(f"model={args.model} target={target}\n")
    for round_ in range(args.rounds + 1):
        t0 = time.time()
        reply = chat(args.model, messages, key)
        code = extract_code(reply)
        (ROOT / target).parent.mkdir(parents=True, exist_ok=True)
        (ROOT / target).write_text(code)
        errors = check(target)
        with log.open("a") as f:
            f.write(f"\n--- round {round_} ({time.time() - t0:.0f}s), {len(errors)} errors\n" + "\n".join(errors) + "\n")
        print(f"round {round_}: {len(code.splitlines())} lines, {len(errors)} errors, {time.time() - t0:.0f}s", flush=True)
        if not errors:
            return 0
        messages += [{"role": "assistant", "content": reply},
                     {"role": "user", "content": "TypeScript reports these errors in your file:\n" + "\n".join(errors[:25])
                      + "\n\nFix them. Reply with the whole corrected file in ONE code block."}]
    return 1


if __name__ == "__main__":
    sys.exit(main())

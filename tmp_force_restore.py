"""Force-write final transcript state for all tracked src files."""
from __future__ import annotations

import json
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\HP745G6\.cursor\projects\c-projet-dev-maquis-gestion\agent-transcripts\bb0e6a44-a746-4fd0-ac04-770e211aaf0e\bb0e6a44-a746-4fd0-ac04-770e211aaf0e.jsonl"
)
ROOT = Path(r"c:\projet-dev\maquis-gestion")
state: dict[str, str] = {}


def norm(path: str) -> str | None:
    p = path.replace("\\", "/")
    markers = ["c:/projet-dev/maquis-gestion/", "projet-dev/maquis-gestion/"]
    lower = p.lower()
    for m in markers:
        idx = lower.find(m)
        if idx >= 0:
            rel = p[idx + len(m) :]
            if rel.startswith("src/") or rel.startswith("public/"):
                return rel
            return None
    if p.startswith("src/") or p.startswith("public/"):
        return p
    return None


with TRANSCRIPT.open("r", encoding="utf-8") as f:
    for line in f:
        if "contents" not in line and "old_string" not in line and "Delete" not in line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        content = obj.get("message", {}).get("content")
        if not isinstance(content, list):
            continue
        for part in content:
            if part.get("type") != "tool_use":
                continue
            name = part.get("name")
            inp = part.get("input") or {}
            path = inp.get("path")
            if not isinstance(path, str):
                continue
            rel = norm(path)
            if not rel:
                continue
            if name == "Write" and isinstance(inp.get("contents"), str):
                state[rel] = inp["contents"]
            elif name == "StrReplace":
                old = inp.get("old_string")
                new = inp.get("new_string")
                if not isinstance(old, str) or not isinstance(new, str):
                    continue
                if rel not in state:
                    disk = ROOT / rel
                    if disk.exists():
                        state[rel] = disk.read_text(encoding="utf-8", errors="ignore")
                    else:
                        continue
                cur = state[rel]
                if old not in cur:
                    continue
                if inp.get("replace_all"):
                    state[rel] = cur.replace(old, new)
                else:
                    state[rel] = cur.replace(old, new, 1)
            elif name == "Delete":
                state.pop(rel, None)

# Also recover app/globals if under deleted root app - and src/app/globals
for rel, contents in state.items():
    dest = ROOT / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(contents, encoding="utf-8")

print(f"Force wrote {len(state)} files")

# Check critical paths
critical = [
    "src/lib/auth/post-login.ts",
    "src/lib/auth/roles.ts",
    "src/components/layout/application-shell.tsx",
    "src/components/admin/admin-shell.tsx",
    "src/lib/navigation/space-navigation.ts",
    "src/app/globals.css",
    "src/app/layout.tsx",
    "src/app/page.tsx",
]
for c in critical:
    p = ROOT / c
    print(f"{'OK' if p.exists() else 'MISSING'} {c} ({p.stat().st_size if p.exists() else 0})")

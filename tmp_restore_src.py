"""Restore missing src files from agent transcript Write + StrReplace history."""
from __future__ import annotations

import json
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\HP745G6\.cursor\projects\c-projet-dev-maquis-gestion\agent-transcripts\bb0e6a44-a746-4fd0-ac04-770e211aaf0e\bb0e6a44-a746-4fd0-ac04-770e211aaf0e.jsonl"
)
ROOT = Path(r"c:\projet-dev\maquis-gestion")

# path -> content built from writings/patches
state: dict[str, str] = {}
events = 0


def norm(path: str) -> str | None:
    p = path.replace("\\", "/")
    # Only project src (and related) files
    markers = [
        "c:/projet-dev/maquis-gestion/",
        "projet-dev/maquis-gestion/",
    ]
    lower = p.lower()
    for m in markers:
        idx = lower.find(m)
        if idx >= 0:
            rel = p[idx + len(m) :]
            if rel.startswith("src/") or rel.startswith("public/") or rel == "src":
                return rel
            return None
    if p.startswith("src/"):
        return p
    return None


with TRANSCRIPT.open("r", encoding="utf-8") as f:
    for line_no, line in enumerate(f, 1):
        if '"Write"' not in line and '"StrReplace"' not in line and '"Delete"' not in line:
            # Still parse if contents+path may appear without name string — skip cheaply
            if "contents" not in line and "old_string" not in line:
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
            events += 1
            if name == "Write" and isinstance(inp.get("contents"), str):
                state[rel] = inp["contents"]
            elif name == "StrReplace":
                old = inp.get("old_string")
                new = inp.get("new_string")
                if not isinstance(old, str) or not isinstance(new, str):
                    continue
                if rel not in state:
                    # seed from disk if present at restore time we'll handle later
                    disk = ROOT / rel
                    if disk.exists():
                        state[rel] = disk.read_text(encoding="utf-8")
                    else:
                        continue
                replace_all = bool(inp.get("replace_all"))
                cur = state[rel]
                if replace_all:
                    if old not in cur:
                        continue
                    state[rel] = cur.replace(old, new)
                else:
                    if old not in cur:
                        continue
                    state[rel] = cur.replace(old, new, 1)
            elif name == "Delete":
                state.pop(rel, None)

print(f"Processed events touching src: {events}")
print(f"Tracked files in final state: {len(state)}")

# Write only files that are missing on disk (or zero bytes)
restored = []
skipped_exist = []
for rel, contents in sorted(state.items()):
    dest = ROOT / rel
    if dest.exists() and dest.stat().st_size > 0:
        skipped_exist.append(rel)
        continue
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(contents, encoding="utf-8")
    restored.append(rel)

print(f"Restored missing: {len(restored)}")
for rel in restored:
    print(" +", rel)
print(f"Already present (kept): {len(skipped_exist)}")

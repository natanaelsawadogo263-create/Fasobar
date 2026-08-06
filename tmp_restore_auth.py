import json
import re
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\HP745G6\.cursor\projects\c-projet-dev-maquis-gestion\agent-transcripts\bb0e6a44-a746-4fd0-ac04-770e211aaf0e\bb0e6a44-a746-4fd0-ac04-770e211aaf0e.jsonl"
)
AUTH_DIR = Path(r"c:\projet-dev\maquis-gestion\src\lib\auth")

targets = {
    "post-login.ts": None,
    "roles.ts": None,
}

# Also find largest Write payloads for these paths
with TRANSCRIPT.open("r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        hit = False
        for name in targets:
            if name in line and ("contents" in line or "Write" in line):
                hit = True
                break
        if not hit:
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
            inp = part.get("input") or {}
            path = str(inp.get("path", "")).replace("\\", "/")
            contents = inp.get("contents")
            if not isinstance(contents, str):
                continue
            for name in targets:
                if path.endswith(f"auth/{name}") or path.endswith(f"auth\\{name}"):
                    prev = targets[name]
                    if prev is None or len(contents) >= len(prev[1]):
                        targets[name] = (i, contents)

print("Found in Write:")
for name, val in targets.items():
    print(f"  {name}: {None if val is None else (val[0], len(val[1]))}")

# List missing expected deps by scanning session/actions imports
missing_on_disk = []
for name in ["post-login.ts", "roles.ts"]:
    if not (AUTH_DIR / name).exists():
        missing_on_disk.append(name)
print("Missing on disk:", missing_on_disk)

for name, val in targets.items():
    if val and name in missing_on_disk:
        (AUTH_DIR / name).write_text(val[1], encoding="utf-8")
        print(f"Restored {name} from line {val[0]}")

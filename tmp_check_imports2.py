import re
from pathlib import Path

root = Path(r"c:\projet-dev\maquis-gestion\src")
pat = re.compile(r'''from\s+["'](@/[^"']+)["']|import\(\s*["'](@/[^"']+)["']\s*\)''')
missing = []
for path in list(root.rglob("*.ts")) + list(root.rglob("*.tsx")):
    text = path.read_text(encoding="utf-8", errors="ignore")
    for m in pat.finditer(text):
        alias = m.group(1) or m.group(2)
        rel = alias[2:]
        base = root / Path(rel)
        candidates = [
            Path(str(base) + ".ts"),
            Path(str(base) + ".tsx"),
            base / "index.ts",
            base / "index.tsx",
            base,
        ]
        if not any(c.exists() for c in candidates):
            missing.append((alias, str(path.relative_to(root.parent))))

uniq = sorted(set(m[0] for m in missing))
print("missing count", len(uniq))
for u in uniq:
    print(u)

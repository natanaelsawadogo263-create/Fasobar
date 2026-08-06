import re
from pathlib import Path

root = Path(r"c:\projet-dev\maquis-gestion\src")
pat = re.compile(r'''from\s+["'](@/[^"']+)["']|import\(["'](@/[^"']+)["']\)''')
missing = set()
checked = set()

for path in root.rglob("*.{ts,tsx}".replace("{ts,tsx}", "")):
    pass

for path in list(root.rglob("*.ts")) + list(root.rglob("*.tsx")):
    text = path.read_text(encoding="utf-8", errors="ignore")
    for m in pat.finditer(text):
        alias = m.group(1) or m.group(2)
        if not alias or alias in checked:
            continue
        checked.add(alias)
        rel = alias[2:]  # strip @/
        # try .ts .tsx /index
        candidates = [
            root.parent / "src" / f"{rel}.ts",
            root.parent / "src" / f"{rel}.tsx",
            root.parent / "src" / rel / "index.ts",
            root.parent / "src" / rel / "index.tsx",
        ]
        # alias is @/lib/... which maps to src/
        base = Path(r"c:\projet-dev\maquis-gestion") / "src" / rel.replace("/", "\\")
        candidates = [
            Path(str(base) + ".ts"),
            Path(str(base) + ".tsx"),
            base / "index.ts",
            base / "index.tsx",
            base,
        ]
        if not any(c.exists() for c in candidates):
            missing.add(alias)

print("Missing modules:")
for m in sorted(missing):
    print(" ", m)
print("count", len(missing))

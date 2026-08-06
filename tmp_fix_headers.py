from pathlib import Path

p2 = Path(r"c:\projet-dev\maquis-gestion\src\components\products\products-workspace.tsx")
t2 = p2.read_text(encoding="utf-8")
lines = t2.splitlines()
# Rebuild clean header if mangled
if not lines[0].strip() == '"use client";':
    # remove leading mangled lines until useTransition import area
    body_start = 0
    for i, line in enumerate(lines):
        if "createProductAction" in line or line.startswith("import { useState"):
            body_start = i
            break
    # Find first occurrence of createProductAction block and afterwards keep unique imports
    content = "\n".join(lines[body_start:])
    # Deduplicate consecutive duplicate AlertMessage/FormField imports after first block
    fixed = '"use client";\n\n'
    if not content.lstrip().startswith("import { useState"):
        # ensure react imports present
        if "useState" not in content.split("from")[0]:
            fixed += 'import { useState, useTransition } from "react";\n'
            fixed += 'import { useRouter } from "next/navigation";\n\n'
    # Remove duplicate consecutive identical import lines
    seen_block = []
    out_lines = []
    for line in content.splitlines():
        if line.startswith("import ") and line in out_lines:
            continue
        out_lines.append(line)
    p2.write_text(fixed + "\n".join(out_lines) + "\n", encoding="utf-8")
    print("rewrote products-workspace header")
else:
    print("products already ok")

# verify actions has needed import
p = Path(r"c:\projet-dev\maquis-gestion\src\lib\auth\actions.ts")
t = p.read_text(encoding="utf-8")
print("actions L1:", t.splitlines()[0])
print("uses userHasActiveOrganization:", "userHasActiveOrganization" in t)
print("imports session:", "@/lib/auth/session" in t)

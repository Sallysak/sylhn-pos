"""Replace new PrismaClient() with the singleton db import in 8 API routes."""
import re
from pathlib import Path

FILES = [
    "src/app/api/email/unread-count/route.ts",
    "src/app/api/email/sync/route.ts",
    "src/app/api/email/received/route.ts",
    "src/app/api/email/templates/route.ts",
    "src/app/api/email/receipt/route.ts",
    "src/app/api/email/daily-summary/route.ts",
    "src/app/api/email/low-stock-alert/route.ts",
    "src/app/api/business-chat/route.ts",
]

# Pattern: import { PrismaClient } from '@prisma/client'  (or with double quotes)
IMPORT_RE = re.compile(
    r"import\s*\{\s*PrismaClient\s*\}\s*from\s*['\"]@prisma/client['\"]\s*\n?",
    re.MULTILINE,
)

# Pattern: const prisma = new PrismaClient()
CONST_RE = re.compile(
    r"const\s+prisma\s*=\s*new\s+PrismaClient\(\s*\)\s*\n?",
    re.MULTILINE,
)

REPLACEMENT_IMPORT = "import { db } from '@/lib/db'\n"

base = Path("/home/z/my-project/sylhn-pos")
for rel in FILES:
    p = base / rel
    if not p.exists():
        print(f"MISSING: {rel}")
        continue
    content = p.read_text()
    original = content

    # Replace import
    content = IMPORT_RE.sub(REPLACEMENT_IMPORT, content)
    # Remove `const prisma = new PrismaClient()` line
    content = CONST_RE.sub("", content)
    # Replace all `prisma.` references with `db.`
    content = content.replace("prisma.", "db.")

    if content != original:
        p.write_text(content)
        # Count changes
        n_prisma_left = content.count("prisma.")
        print(f"FIXED: {rel}  (remaining `prisma.` refs: {n_prisma_left})")
    else:
        print(f"NO CHANGE: {rel}")

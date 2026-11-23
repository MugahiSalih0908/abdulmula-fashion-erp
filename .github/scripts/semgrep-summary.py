#!/usr/bin/env python3
"""Print aggregate Semgrep SARIF counts without exposing finding details."""

import json
import sys
from collections import Counter
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 2:
        print("Semgrep summary could not read its input.", file=sys.stderr)
        return 2

    sarif_path = Path(sys.argv[1])

    try:
        document = json.loads(sarif_path.read_text(encoding="utf-8"))
        runs = document.get("runs", [])
        results = [
            result
            for run in runs
            for result in run.get("results", [])
        ]
    except (OSError, UnicodeError, json.JSONDecodeError, TypeError, AttributeError):
        print("Semgrep SARIF summary is unavailable or invalid.", file=sys.stderr)
        return 2

    levels = Counter(
        str(result.get("level", "unclassified")).lower()
        for result in results
    )

    errors = levels.get("error", 0)
    warnings = levels.get("warning", 0)
    notes = levels.get("note", 0)
    other = len(results) - errors - warnings - notes

    print(
        "Semgrep findings (details withheld): "
        f"total={len(results)} "
        f"errors={errors} "
        f"warnings={warnings} "
        f"notes={notes} "
        f"other={other}"
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
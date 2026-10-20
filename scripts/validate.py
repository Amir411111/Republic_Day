#!/usr/bin/env python3
"""Check content/cards.json. Prints every problem, exits 1 if any.

Usage: python3 scripts/validate.py [--draft]
  --draft  treat missing verified_by as a warning, not an error
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARDS = ROOT / "content" / "cards.json"
LANGS = ("kk", "ru", "en")
REQUIRED_LANGS = ("kk", "ru")
L10N_FIELDS = ("place", "title", "explanation", "clue")
YEAR_RANGE = (1400, 2025)
LAT_RANGE = (40.5, 55.5)
LNG_RANGE = (46.5, 87.5)
PACKS = {"kz", "semey"}


def check_card(c, seen, draft):
    errors, warnings = [], []
    cid = c.get("id", "<no id>")

    if not c.get("id"):
        errors.append("missing id")
    elif cid in seen:
        errors.append("duplicate id")
    seen.add(cid)

    packs = c.get("pack")
    if not isinstance(packs, list) or not packs or not set(packs) <= PACKS:
        errors.append(f"pack must be a non-empty subset of {sorted(PACKS)}")

    year = c.get("year")
    if not isinstance(year, int) or not YEAR_RANGE[0] <= year <= YEAR_RANGE[1]:
        errors.append(f"year {year!r} not an integer in {YEAR_RANGE}")

    lat, lng = c.get("lat"), c.get("lng")
    if not isinstance(lat, (int, float)) or not LAT_RANGE[0] <= lat <= LAT_RANGE[1]:
        errors.append(f"lat {lat!r} outside Kazakhstan box {LAT_RANGE}")
    if not isinstance(lng, (int, float)) or not LNG_RANGE[0] <= lng <= LNG_RANGE[1]:
        errors.append(f"lng {lng!r} outside Kazakhstan box {LNG_RANGE}")

    for field in L10N_FIELDS:
        val = c.get(field)
        if not isinstance(val, dict):
            errors.append(f"{field} missing")
            continue
        for lang in REQUIRED_LANGS:
            text = (val.get(lang) or "").strip()
            if not text or "TODO" in text:
                errors.append(f"{field}.{lang} empty or TODO")
        if not (val.get("en") or "").strip():
            warnings.append(f"{field}.en empty")

    image = c.get("image") or ""
    if not image:
        errors.append("image missing")
    elif not image.startswith("http") and not (ROOT / "content" / image).is_file():
        errors.append(f"image file not found: content/{image}")

    credit = c.get("image_credit") or {}
    for key in ("author", "license", "source_url"):
        if not (credit.get(key) or "").strip():
            errors.append(f"image_credit.{key} empty")

    sources = c.get("sources")
    if not isinstance(sources, list) or not [s for s in sources if s.strip() and "TODO" not in s]:
        errors.append("sources empty")

    if c.get("difficulty") not in (1, 2, 3):
        errors.append("difficulty must be 1, 2 or 3")

    if not (c.get("verified_by") or "").strip():
        (warnings if draft else errors).append("verified_by empty (facts not checked by a human)")

    return cid, errors, warnings


def main():
    draft = "--draft" in sys.argv
    try:
        cards = json.loads(CARDS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"Cannot read {CARDS}: {e}")
        return 1

    seen, n_err, n_ok = set(), 0, 0
    for c in cards:
        cid, errors, warnings = check_card(c, seen, draft)
        if errors:
            n_err += 1
        else:
            n_ok += 1
        for e in errors:
            print(f"ERROR {cid}: {e}")
        for w in warnings:
            print(f"warn  {cid}: {w}")

    print(f"\n{len(cards)} cards: {n_ok} ok, {n_err} with errors")
    return 1 if n_err else 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Import the list of historical and cultural monuments from the open data portal
data.egov.kz (dataset respublikalyk_manyzy_bar_tarih, Kostanay region) into
content/monuments-kostanay.json. Only entries with coordinates are kept.

Usage: python3 scripts/import_monuments.py [version]   (default v11)

The portal's public API needs a personal key; this script reads the same table
the dataset page shows in a browser, so no key is required.
"""
import http.cookiejar
import json
import re
import sys
import time
import urllib.request
from pathlib import Path

INDEX = "respublikalyk_manyzy_bar_tarih"
VIEW = f"https://data.egov.kz/datasets/view?index={INDEX}"
OUT = Path(__file__).resolve().parent.parent / "content" / "monuments-kostanay.json"

# 50˚ 14′ 55,64″ N; 65˚ 17′ 15,99″ E  (degree, minute and second marks vary)
DMS = r"(\d+)\s*[˚°º]\s*(\d+)\s*[′'’`]\s*(\d+(?:[.,]\d+)?)\s*[″\"”′']*\s*"
COORDS = re.compile(DMS + r"(?:N|С)?[\s;,]*" + DMS + r"(?:E|В)?")


def fetch(version):
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.open(VIEW, timeout=30).read()
    rows, page = [], 1
    while True:
        req = urllib.request.Request(
            f"https://data.egov.kz/datasets/getdata?index={INDEX}&version={version}&page={page}&count=100",
            headers={"X-Requested-With": "XMLHttpRequest", "Referer": VIEW},
        )
        data = json.loads(opener.open(req, timeout=60).read())
        rows += data["elements"]
        if page >= int(data["totalPages"]):
            return rows
        page += 1
        time.sleep(0.5)


def clean(s):
    return re.sub(r"\s+", " ", s or "").strip()


def main():
    version = sys.argv[1] if len(sys.argv) > 1 else "v11"
    rows = fetch(version)
    out = []
    for r in rows:
        m = COORDS.search(f"{r.get('h', '')} {r.get('g', '')}")
        if not m:
            continue
        d = [float(x.replace(",", ".")) for x in m.groups()]
        lat, lng = d[0] + d[1] / 60 + d[2] / 3600, d[3] + d[4] / 60 + d[5] / 3600
        # Kostanay region bounding box; anything outside is a typo in the source
        if not (49 < lat < 54.5 and 59 < lng < 68):
            continue
        out.append({
            "id": len(out) + 1,
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "name": {"kk": clean(r.get("c")), "ru": clean(r.get("d"))},
            "type": {"kk": clean(r.get("e")), "ru": clean(r.get("f"))},
            "district": {"kk": clean(r.get("a")), "ru": clean(r.get("b"))},
        })
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(rows)} rows from data.egov.kz, {len(out)} with coordinates -> {OUT}")


if __name__ == "__main__":
    main()

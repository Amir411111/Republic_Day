#!/usr/bin/env python3
"""Import the monuments of Kostanay region from the open data portal data.egov.kz
(dataset respublikalyk_manyzy_bar_tarih: the region's list of monuments of history and culture)
into content/monuments-egov.json. Only entries with coordinates are kept.

Usage: python3 scripts/import_egov_monuments.py [version]   (default v11)

The portal's public API needs a personal key; this script reads the same table the dataset
page shows in a browser (session cookie + the page's own data request), so no key is required.
The portal can be slow: requests wait up to three minutes and are retried.
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
OUT = Path(__file__).resolve().parent.parent / "content" / "monuments-egov.json"
REGION = {"kk": "Қостанай облысы", "ru": "Костанайская область"}

# 50˚ 14′ 55,64″ N; 65˚ 17′ 15,99″ E  (degree, minute and second marks vary)
DMS = r"(\d+)\s*[˚°º]\s*(\d+)\s*[′'’`]\s*(\d+(?:[.,]\d+)?)\s*[″\"”′']*\s*"
COORDS = re.compile(DMS + r"(?:N|С)?[\s;,]*" + DMS + r"(?:E|В)?")

# classes as in scripts/import_monuments.py (Law on historical and cultural heritage)
KINDS = [
    ("archaeology", ("археолог",)),
    ("architecture", ("градостро", "архитект", "сәулет")),
    ("monumental", ("монумент",)),
    ("ensemble", ("ансамбл", "комплекс", "кешен")),
    ("sacral", ("сакрал", "киелі")),
    ("history", ("истори", "тарих")),
]


def kind_of(text):
    text = text.lower()
    return next((kind for kind, keys in KINDS if any(k in text for k in keys)), "other")


def fetch(version):
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.open(VIEW, timeout=180).read()
    rows, page = [], 1
    while True:
        for attempt in range(4):
            try:
                req = urllib.request.Request(
                    f"https://data.egov.kz/datasets/getdata?index={INDEX}&version={version}&page={page}&count=100",
                    headers={"X-Requested-With": "XMLHttpRequest", "Referer": VIEW},
                )
                data = json.loads(opener.open(req, timeout=180).read())
                break
            except OSError:
                time.sleep(5 * (attempt + 1))
        else:
            raise RuntimeError(f"data.egov.kz: page {page} failed")
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
        if d[1] >= 60 or d[2] >= 60 or d[4] >= 60 or d[5] >= 60:
            continue  # impossible minutes or seconds: a typo in the source
        lat, lng = d[0] + d[1] / 60 + d[2] / 3600, d[3] + d[4] / 60 + d[5] / 3600
        # Kostanay region bounding box; anything outside is a typo in the source
        if not (49 < lat < 54.5 and 59 < lng < 68):
            continue
        place_ru = re.sub(r"\s+[NEСВ]$", "", re.sub(COORDS, "", clean(r.get("h")))).strip(" ,;")
        place_kk = re.sub(r"\s+[NEСВ]$", "", re.sub(COORDS, "", clean(r.get("g")))).strip(" ,;")
        out.append({
            "id": f"egov-{len(out) + 1}",
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "approx": False,
            "how": "egov",
            "name": {"kk": clean(r.get("c")), "ru": clean(r.get("d"))},
            "type": {"kk": clean(r.get("e")), "ru": clean(r.get("f"))},
            "kind": kind_of(f"{r.get('f', '')} {r.get('e', '')}"),
            "place": {"kk": f"{clean(r.get('a'))}, {place_kk}".strip(" ,"), "ru": f"{clean(r.get('b'))}, {place_ru}".strip(" ,")},
            "region": REGION,
            "source": VIEW,
        })
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{len(rows)} rows from data.egov.kz, {len(out)} with coordinates -> {OUT}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Import the official regional lists of historical and cultural monuments into content/monuments.json.

Each region's akimat approves a "State list of monuments of history and culture of local
significance"; the acts are published in the Adilet legal database, and many give coordinates.
Adilet itself is a JavaScript app, so the text is read from its mirror zakon.uchet.kz, in Russian
and in Kazakh (the tables are row-for-row identical).

Only rows with coordinates that parse cleanly AND fall inside the right region are kept:
the source tables contain typos (e.g. 68º79´35.3 - 79 minutes), and a wrong point on a map
is worse than a missing one. Kostanay region comes from the data.egov.kz open dataset
(content/monuments-kostanay.json, scripts/import_monuments.py) and is merged in as is.

Usage: python3 scripts/import_monument_lists.py
"""
import html
import json
import re
import sys
import time
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "monuments.json"
# count and regions only: the landing page shows the number without loading every point
META = ROOT / "content" / "monuments-meta.json"
KOSTANAY = ROOT / "content" / "monuments-kostanay.json"
REGIONS_GEO = ROOT / "content" / "geo" / "kz-regions.geojson"
EGOV_URL = "https://data.egov.kz/datasets/view?index=respublikalyk_manyzy_bar_tarih"

# act code on adilet.zan.kz -> region ids in content/geo/kz-regions.geojson (pre-2022 division:
# Abai is inside "vostochno", Zhetysu inside "almaty", Ulytau inside "karaganda", Shymkent inside "turkestan")
ACTS = [
    {"code": "V20U0005804", "region": {"kk": "Түркістан облысы", "ru": "Туркестанская область"}, "geo": ["turkestan"]},
]

UA = {"User-Agent": "Mozilla/5.0 (TarihGuessr open-data import)"}


def fetch(url):
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers=UA)
            return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", errors="replace")
        except OSError:
            time.sleep(2 ** attempt)
    raise RuntimeError(f"cannot fetch {url}")


class Tables(HTMLParser):
    """Collects every table as a grid of cell texts, expanding rowspan and colspan."""

    def __init__(self):
        super().__init__()
        self.tables, self.stack = [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self.stack.append({"rows": [], "row": None, "cell": None})
        elif not self.stack:
            return
        elif tag == "tr":
            self.stack[-1]["row"] = []
        elif tag in ("td", "th"):
            t = self.stack[-1]
            if t["row"] is None:
                t["row"] = []
            t["cell"] = {"text": [], "rs": int(a.get("rowspan") or 1), "cs": int(a.get("colspan") or 1)}
        elif tag == "br" and self.stack[-1]["cell"] is not None:
            self.stack[-1]["cell"]["text"].append("\n")

    def handle_endtag(self, tag):
        if not self.stack:
            return
        t = self.stack[-1]
        if tag in ("td", "th") and t["cell"] is not None:
            t["row"].append(t["cell"])
            t["cell"] = None
        elif tag == "tr" and t["row"] is not None:
            t["rows"].append(t["row"])
            t["row"] = None
        elif tag == "table":
            self.tables.append(grid(self.stack.pop()["rows"]))

    def handle_data(self, data):
        if self.stack and self.stack[-1]["cell"] is not None:
            self.stack[-1]["cell"]["text"].append(data)


def clean(s):
    s = html.unescape(s).replace("\xa0", " ")
    return "\n".join(re.sub(r"[ \t]+", " ", line).strip() for line in s.split("\n")).strip()


def grid(rows):
    out, pending = [], {}  # pending[(row, col)] = text carried down by rowspan
    for r, row in enumerate(rows):
        cells, c = [], 0
        queue = list(row)
        while queue or (r, c) in pending:
            if (r, c) in pending:
                cells.append(pending.pop((r, c)))
                c += 1
                continue
            cell = queue.pop(0)
            text = clean("".join(cell["text"]))
            for k in range(cell["cs"]):
                cells.append(text if k == 0 else "")
                for down in range(1, cell["rs"]):
                    pending[(r + down, c + k)] = text
            c += cell["cs"]
        out.append(cells)
    return out


# --- coordinates ---------------------------------------------------------------------------

def norm(s):
    s = s.replace(",", ".")
    s = re.sub(r"[º˚°o]", "°", s)
    s = re.sub(r"[´′’‘`']", "'", s)
    s = re.sub(r"[″”\"]|''", '"', s)
    return s


DMS = re.compile(r"(\d{1,2})\s*°\s*(\d{1,2}(?:\.\d+)?)\s*'?\s*(?:(\d{1,3}(?:\.\d+)?)\s*\"?)?")


def parse_values(text):
    """All coordinate values in a cell, in order. None marks a value that is present but invalid."""
    vals = []
    for m in DMS.finditer(norm(text)):
        d, mnt, sec = int(m.group(1)), m.group(2), m.group(3)
        if sec and "." not in sec and len(sec) == 3 and "." not in mnt:
            # 42º14´710 is degrees and decimal minutes (42°14.710'), as in GPS readouts
            mnt, sec = f"{mnt}.{sec}", None
        mnt = float(mnt)
        sec = float(sec) if sec else 0.0
        vals.append(None if mnt >= 60 or sec >= 60 else d + mnt / 60 + sec / 3600)
    if not vals:
        for m in re.finditer(r"\b(\d{2}\.\d{3,})\b", text.replace(",", ".")):
            vals.append(float(m.group(1)))
    return vals


def first_point(text):
    vals = parse_values(text)
    if len(vals) < 2 or vals[0] is None or vals[1] is None:
        return None
    a, b = vals[0], vals[1]
    lat, lng = (a, b) if a < b else (b, a)  # in Kazakhstan longitude is always the larger number
    return round(lat, 5), round(lng, 5)


# --- geography -----------------------------------------------------------------------------

def rings(geom):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return [p[0] for p in polys]


def inside(lng, lat, ring):
    hit, j = False, len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (yj - yi) + xi:
            hit = not hit
        j = i
    return hit


def near(lng, lat, ring, tol=0.15):
    # within ~15 km of the boundary: regional borders in the geojson are generalised
    return any(abs(x - lng) < tol and abs(y - lat) < tol for x, y in ring)


REGION_RINGS = {
    f["properties"]["id"]: rings(f["geometry"])
    for f in json.loads(REGIONS_GEO.read_text(encoding="utf-8"))["features"]
}


def in_regions(lat, lng, ids):
    return any(inside(lng, lat, r) or near(lng, lat, r) for i in ids for r in REGION_RINGS.get(i, []))


# --- parsing one act -----------------------------------------------------------------------

def find_columns(header):
    cols = {}
    for i, h in enumerate(header):
        low = h.lower()
        if "координат" in low or "координат" in low.replace("ы", "") or "coordinat" in low:
            cols["coord"] = i
        elif "наименован" in low or "атау" in low:
            cols.setdefault("name", i)
        elif "вид" in low or "тип" in low or "түр" in low:
            cols.setdefault("type", i)
        elif "местонахожд" in low or "адрес" in low or "орналас" in low:
            cols.setdefault("place", i)
    return cols


def monument_rows(page):
    """Rows of the monuments table as dicts, with the current district from section rows."""
    parser = Tables()
    parser.feed(page)
    for table in parser.tables:
        for h, header in enumerate(table[:4]):
            cols = find_columns(header)
            if "name" in cols and "coord" in cols:
                break
        else:
            continue
        district, out = "", []
        for row in table[h + 1:]:
            texts = [c for c in row if c]
            if len(set(texts)) == 1 and len(row) >= 3 and not re.fullmatch(r"\d+", texts[0]):
                district = texts[0]  # a full-width row naming the district or city
                out.append(None)
                continue
            if len(row) <= max(cols.values()) or re.fullmatch(r"[\d\s]+", "".join(row)):
                out.append(None)
                continue
            out.append({
                "name": row[cols["name"]].replace("\n", " "),
                "type": row[cols["type"]].replace("\n", " ") if "type" in cols else "",
                "coord": row[cols["coord"]],
                "district": district,
            })
        return out
    return []


def import_act(act):
    url = f"https://zakon.uchet.kz/rus/docs/{act['code']}"
    ru = monument_rows(fetch(url))
    kk = monument_rows(fetch(f"https://zakon.uchet.kz/kaz/docs/{act['code']}"))
    paired = len(kk) == len(ru)
    kept, bad, nocoord = [], 0, 0
    for i, r in enumerate(ru):
        if r is None or not r["name"]:
            continue
        if not r["coord"].strip():
            nocoord += 1
            continue
        pt = first_point(r["coord"])
        if not pt or not in_regions(pt[0], pt[1], act["geo"]):
            bad += 1
            continue
        k = kk[i] if paired and kk[i] else None
        kept.append({
            "lat": pt[0],
            "lng": pt[1],
            "name": {"kk": k["name"] if k else "", "ru": r["name"]},
            "type": {"kk": k["type"] if k else "", "ru": r["type"]},
            "district": {"kk": k["district"] if k else "", "ru": r["district"]},
            "region": act["region"],
            "source": f"https://adilet.zan.kz/rus/docs/{act['code']}",
        })
    print(f"{act['code']} {act['region']['ru']}: {len(kept)} kept, {bad} bad or outside the region, "
          f"{nocoord} without coordinates, kk names {'paired' if paired else 'NOT paired'}")
    return kept


def main():
    out = []
    for act in ACTS:
        out += import_act(act)
        time.sleep(1)
    kostanay = json.loads(KOSTANAY.read_text(encoding="utf-8"))
    for m in kostanay:
        out.append({
            "lat": m["lat"], "lng": m["lng"], "name": m["name"], "type": m["type"], "district": m["district"],
            "region": {"kk": "Қостанай облысы", "ru": "Костанайская область"},
            "source": EGOV_URL,
        })
    # one point per place and name: some lists repeat a monument under two districts
    seen, unique = set(), []
    for m in out:
        key = (m["lat"], m["lng"], m["name"]["ru"])
        if key not in seen:
            seen.add(key)
            unique.append(m)
    for i, m in enumerate(unique, 1):
        m["id"] = i
    OUT.write_text(json.dumps(unique, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    regions = sorted({m["region"]["ru"] for m in unique})
    META.write_text(json.dumps({"count": len(unique), "regions": len(regions)}) + "\n", encoding="utf-8")
    print(f"{len(unique)} monuments -> {OUT}")


if __name__ == "__main__":
    sys.exit(main())

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

Most lists give no coordinates at all, only a description such as "12 km south-west of the
village of Sagiz". For those the monument is placed at that settlement, found in OpenStreetMap
(Nominatim), and marked approx: true; descriptions more than 15 km from the settlement are left
out. Lookups are cached in scripts/geocode-cache.json, so a rerun without --geocode needs no network
for them and gives the same result.

Usage: python3 scripts/import_monument_lists.py [--geocode]
"""
import html
import json
import math
import re
import sys
import time
import urllib.parse
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
    {"code": "V20B0007978", "region": {"kk": "Ақмола облысы", "ru": "Акмолинская область"}, "geo": ["akmola", "astana"]},
    {"code": "V20Z0006567", "region": {"kk": "Батыс Қазақстан облысы", "ru": "Западно-Казахстанская область"}, "geo": ["zapadno"]},
    {"code": "V20G0004665", "region": {"kk": "Жамбыл облысы", "ru": "Жамбылская область"}, "geo": ["zhambyl"]},
    {"code": "V20N0009107", "region": {"kk": "Қостанай облысы", "ru": "Костанайская область"}, "geo": ["kostanay"]},
    {"code": "V20L0007411", "region": {"kk": "Қызылорда облысы", "ru": "Кызылординская область"}, "geo": ["kyzylorda"]},
    {"code": "V20S0006296", "region": {"kk": "Солтүстік Қазақстан облысы", "ru": "Северо-Казахстанская область"}, "geo": ["severo"]},
    {"code": "V20U0005804", "region": {"kk": "Түркістан облысы", "ru": "Туркестанская область"}, "geo": ["turkestan"]},
    # lists without coordinates: placed by settlement, approximately
    {"code": "G26F000063A", "region": {"kk": "Абай облысы", "ru": "Область Абай"}, "geo": ["vostochno"]},
    {"code": "V20C0007334", "region": {"kk": "Ақтөбе облысы", "ru": "Актюбинская область"}, "geo": ["aktobe"]},
    {"code": "V24D0614905", "region": {"kk": "Алматы облысы", "ru": "Алматинская область"}, "geo": ["almaty"]},
    {"code": "V20T0004728", "region": {"kk": "Атырау облысы", "ru": "Атырауская область"}, "geo": ["atyrau"]},
    {"code": "V23V0892716", "region": {"kk": "Шығыс Қазақстан облысы", "ru": "Восточно-Казахстанская область"}, "geo": ["vostochno"]},
    {"code": "V24I0020219", "region": {"kk": "Жетісу облысы", "ru": "Область Жетісу"}, "geo": ["almaty"]},
    {"code": "V24K0663409", "region": {"kk": "Қарағанды облысы", "ru": "Карагандинская область"}, "geo": ["karaganda"]},
    {"code": "V20M0004310", "region": {"kk": "Маңғыстау облысы", "ru": "Мангистауская область"}, "geo": ["mangystau"]},
    {"code": "V20P0006840", "region": {"kk": "Павлодар облысы", "ru": "Павлодарская область"}, "geo": ["pavlodar"]},
    {"code": "G25H007801A", "region": {"kk": "Ұлытау облысы", "ru": "Область Ұлытау"}, "geo": ["karaganda"]},
    {"code": "V20A0001295", "region": {"kk": "Астана қаласы", "ru": "город Астана"}, "geo": ["astana", "akmola"], "city": "Астана"},
    {"code": "V21R0001693", "region": {"kk": "Алматы қаласы", "ru": "город Алматы"}, "geo": ["almaty-city", "almaty"], "city": "Алматы"},
    {"code": "V20E0000107", "region": {"kk": "Шымкент қаласы", "ru": "город Шымкент"}, "geo": ["turkestan"], "city": "Шымкент"},
]

UA = {"User-Agent": "Mozilla/5.0 (TarihGuessr open-data import)"}
NOMINATIM_UA = {"User-Agent": "TarihGuessr/1.0 (Republic Day hackathon; https://github.com/Amir411111/Republic_Day)"}
CACHE = ROOT / "scripts" / "geocode-cache.json"
MAX_KM_FROM_SETTLEMENT = 15


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


UTM = re.compile(r"\b(4[1-5])\s*([TUТУ])\s*(\d{6})\s*(\d{7})\b")


def utm_to_latlng(zone, easting, northing):
    """WGS84 UTM (northern hemisphere) to latitude/longitude, standard series expansion."""
    a, f, k0 = 6378137.0, 1 / 298.257223563, 0.9996
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)
    x, y = easting - 500000.0, northing
    m = y / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu) + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
            + (151 * e1**3 / 96) * math.sin(6 * mu) + (1097 * e1**4 / 512) * math.sin(8 * mu))
    n1 = a / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    t1 = math.tan(phi1) ** 2
    c1 = ep2 * math.cos(phi1) ** 2
    r1 = a * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = x / (n1 * k0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (d**2 / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * ep2) * d**4 / 24
                                            + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * ep2 - 3 * c1**2) * d**6 / 720)
    lng = (d - (1 + 2 * t1 + c1) * d**3 / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * ep2 + 24 * t1**2) * d**5 / 120) / math.cos(phi1)
    return math.degrees(lat), (zone - 1) * 6 - 180 + 3 + math.degrees(lng)


def first_point(text):
    u = UTM.search(text)
    if u:  # Zhambyl region gives grid coordinates such as "42 T 704246 4763153"
        return tuple(round(v, 5) for v in utm_to_latlng(int(u.group(1)), int(u.group(3)), int(u.group(4))))
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


# --- classes ------------------------------------------------------------------------------

# Types of monuments named in the Law "On the protection and use of historical and cultural heritage"
KINDS = [
    ("archaeology", ("археолог",)),
    ("architecture", ("градостро", "архитект", "сәулет")),
    ("monumental", ("монумент",)),
    ("ensemble", ("ансамбл", "комплекс", "кешен")),
    ("sacral", ("сакрал", "киелі")),
    ("history", ("истори", "тарих")),
]


def kind_of(type_ru, type_kk):
    text = f"{type_ru} {type_kk}".lower()
    for kind, keys in KINDS:
        if any(k in text for k in keys):
            return kind
    return "other"


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
        elif "местонахожд" in low or "место нахожд" in low or "адрес" in low or "орналас" in low:
            cols.setdefault("place", i)
    return cols


def monument_rows(page):
    """Rows of the monuments table as dicts, with the current district from section rows."""
    parser = Tables()
    parser.feed(page)
    for table in parser.tables:
        for h, header in enumerate(table[:4]):
            cols = find_columns(header)
            if "name" in cols and ("coord" in cols or "place" in cols):
                break
        else:
            continue
        district, out, width = "", [], len(header)
        for row in table[h + 1:]:
            texts = [c for c in row if c]
            if len(set(texts)) == 1 and len(row) >= 3 and not re.fullmatch(r"\d+", texts[0]):
                district = texts[0]  # a full-width row naming the district or city
                out.append(None)
                continue
            if len(row) <= max(cols.values()) or re.fullmatch(r"[\d\s]+", "".join(row)):
                out.append(None)
                continue
            name = re.sub(r"\s+", " ", row[cols["name"]]).strip()
            if not name or len(row) != width:
                # rows laid out differently from the header (merged cells): read them by content
                cells = [c for c in row if c.strip()]
                if cells and re.fullmatch(r"[\d.\-–)\s]+", cells[0]):
                    cells = cells[1:]
                if len(cells) < 2:
                    out.append(None)
                    continue
                kind_cell = next((c for c in cells[1:-1] if kind_of(c, "") != "other"), "")
                out.append({
                    "name": re.sub(r"\s+", " ", cells[0]).strip(),
                    "type": re.sub(r"\s+", " ", kind_cell).strip(),
                    "coord": cells[-1],
                    "district": district,
                })
                continue
            if name.lower().startswith(("исключ", "алып таст", "алынып")):
                out.append(None)  # rows removed from the list by a later amendment
                continue
            # most lists put the coordinates inside the location cell instead of a column of their own
            coord = row[cols["coord"]] if "coord" in cols else row[cols.get("place", cols["name"])]
            out.append({
                "name": name,
                "type": re.sub(r"\s+", " ", row[cols["type"]]).strip() if "type" in cols else "",
                "coord": coord,
                "district": district,
            })
        return out
    return []


# --- approximate placement by settlement ---------------------------------------------------

SETTLEMENT = re.compile(
    r"(?:села|селе|село|с\.|поселка|посёлка|поселке|пос\.|п\.|аула|ауле|аул|города|городе|город|г\.|станции|ст\.)"
    r"\s*([А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі\-]+(?:[ -](?:[А-ЯЁӘҒҚҢӨҰҮҺІ0-9][а-яёәғқңөұүһі\-]*))?)"
)
STREET = re.compile(r"(улица|ул\.|проспект|пр\.|переулок|бульвар|площадь|микрорайон|мкр)", re.I)
DISTANCE = re.compile(r"(\d+(?:[.,]\d+)?)\s*(км|километр\w*|м\b|метр\w*)")


def distance_km(text):
    """Largest distance mentioned in the description, in km (0 when none)."""
    best = 0.0
    for num, unit in DISTANCE.findall(text):
        v = float(num.replace(",", "."))
        best = max(best, v if unit.startswith("к") else v / 1000)
    return best


class Geocoder:
    def __init__(self, online):
        self.online = online
        self.cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
        self.asked = 0

    def lookup(self, query):
        if query not in self.cache:
            if not self.online:
                return None
            url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
                {"q": query, "countrycodes": "kz", "format": "json", "limit": 5, "accept-language": "ru"}
            )
            time.sleep(1.1)  # Nominatim usage policy: at most one request per second
            try:
                req = urllib.request.Request(url, headers=NOMINATIM_UA)
                hits = json.loads(urllib.request.urlopen(req, timeout=60).read())
            except OSError:
                return None
            self.cache[query] = [[float(h["lat"]), float(h["lon"]), h.get("class", ""), h.get("type", "")] for h in hits]
            self.asked += 1
            if self.asked % 50 == 0:
                self.save()
                print(f"  ... {self.asked} lookups", flush=True)
        return self.cache[query]

    def save(self):
        CACHE.write_text(json.dumps(self.cache, ensure_ascii=False, indent=0, sort_keys=True) + "\n", encoding="utf-8")

    def place(self, text, act):
        """Approximate point for a description, or None when it cannot be placed honestly."""
        flat = re.sub(r"\s+", " ", text)
        city = act.get("city")
        if city or (STREET.search(flat) and SETTLEMENT.search(flat) and "город" in flat.lower()):
            # a street address: geocode it inside its city
            town = city or SETTLEMENT.search(flat).group(1)
            addr = re.sub(r"\(.*?\)", "", flat).split(";")[0].strip(" ,.")
            queries = [f"{addr}, {town}", town] if STREET.search(flat) else [town]
        else:
            m = SETTLEMENT.search(flat)
            if not m or distance_km(flat) > MAX_KM_FROM_SETTLEMENT:
                return None
            queries = [f"{m.group(1)}, {act['region']['ru']}", m.group(1)]
        for q in queries:
            for lat, lng, cls, typ in self.lookup(q) or []:
                if cls in ("place", "boundary", "highway", "building", "amenity", "tourism", "historic", "landuse") \
                        and in_regions(lat, lng, act["geo"]):
                    return round(lat, 5), round(lng, 5)
        return None


def import_act(act, geo):
    url = f"https://zakon.uchet.kz/rus/docs/{act['code']}"
    ru = monument_rows(fetch(url))
    kk = monument_rows(fetch(f"https://zakon.uchet.kz/kaz/docs/{act['code']}"))
    paired = len(kk) == len(ru)
    kept, bad, nocoord, approx = [], 0, 0, 0
    for i, r in enumerate(ru):
        if r is None or not r["name"]:
            continue
        pt = first_point(r["coord"])
        is_approx = False
        if pt and not in_regions(pt[0], pt[1], act["geo"]):
            bad += 1
            continue
        if not pt:
            if parse_values(r["coord"]) or UTM.search(r["coord"]):
                bad += 1  # coordinates are given but wrong: do not guess around them
                continue
            pt = geo.place(r["coord"], act)
            if not pt:
                nocoord += 1
                continue
            is_approx = True
            approx += 1
        k = kk[i] if paired and kk[i] else None
        kept.append({
            "lat": pt[0],
            "lng": pt[1],
            "approx": is_approx,
            "name": {"kk": k["name"] if k else "", "ru": r["name"]},
            "type": {"kk": k["type"] if k else "", "ru": r["type"]},
            "district": {"kk": k["district"] if k else "", "ru": r["district"]},
            "place": {"kk": re.sub(r"\s+", " ", k["coord"]).strip() if k else "", "ru": re.sub(r"\s+", " ", r["coord"]).strip()},
            "region": act["region"],
            "source": f"https://adilet.zan.kz/rus/docs/{act['code']}",
        })
    print(f"{act['code']} {act['region']['ru']}: {len(kept)} kept ({approx} placed by settlement), "
          f"{bad} with wrong coordinates, {nocoord} could not be placed, kk names {'paired' if paired else 'NOT paired'}",
          flush=True)
    return kept


def name_key(name):
    return re.sub(r"[^0-9a-zа-яёәғқңөұүһі]", "", name.lower())[:18]


def main():
    # data.egov.kz first: it is the open-data source for Kostanay; the act for the same region
    # then only adds monuments the dataset lacks coordinates for
    out = []
    for m in json.loads(KOSTANAY.read_text(encoding="utf-8")):
        out.append({
            "lat": m["lat"], "lng": m["lng"], "approx": False, "name": m["name"], "type": m["type"],
            "district": m["district"], "place": {"kk": "", "ru": ""},
            "region": {"kk": "Қостанай облысы", "ru": "Костанайская область"},
            "source": EGOV_URL,
        })
    geo = Geocoder(online="--geocode" in sys.argv)
    try:
        for act in ACTS:
            out += import_act(act, geo)
            time.sleep(1)
    finally:
        geo.save()

    # one point per monument: the same name within ~500 m is a duplicate
    unique, buckets = [], {}
    for m in out:
        key = name_key(m["name"]["ru"])
        cell = (round(m["lat"], 1), round(m["lng"], 1))
        near_same = [
            u for dx in (-0.1, 0, 0.1) for dy in (-0.1, 0, 0.1)
            for u in buckets.get((round(cell[0] + dx, 1), round(cell[1] + dy, 1)), [])
            if u[0] == key and abs(u[1] - m["lat"]) < 0.005 and abs(u[2] - m["lng"]) < 0.007
        ]
        if near_same:
            continue
        buckets.setdefault(cell, []).append((key, m["lat"], m["lng"]))
        unique.append(m)
    for i, m in enumerate(unique, 1):
        m["id"] = i
        m["kind"] = kind_of(m["type"]["ru"], m["type"]["kk"])
    OUT.write_text(json.dumps(unique, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    regions = sorted({m["region"]["ru"] for m in unique})
    kinds = {}
    for m in unique:
        kinds[m["kind"]] = kinds.get(m["kind"], 0) + 1
    exact = sum(not m["approx"] for m in unique)
    META.write_text(json.dumps({"count": len(unique), "exact": exact, "regions": len(regions), "kinds": kinds}) + "\n",
                    encoding="utf-8")
    print(f"{len(unique)} monuments ({len(out) - len(unique)} duplicates dropped) -> {OUT}")


if __name__ == "__main__":
    sys.exit(main())

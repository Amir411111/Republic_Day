#!/usr/bin/env python3
"""Import the State list of monuments of history and culture of REPUBLICAN significance into
content/monuments.json: the ~276 monuments the state itself ranks as the country's most important.

The list is the order of the Minister of Culture and Information of 11.07.2025 No. 318-НҚ
(Adilet code G25KS000318). Adilet is a JavaScript app, so the text is read from its mirror
zakon.uchet.kz, in Russian and in Kazakh. The list gives addresses, not coordinates, so each
monument is placed with OpenStreetMap (Nominatim), in this order:
  1. osm        - an object of a historic/tourist/building kind with the monument's name, in its region;
  2. address    - the street address, for monuments in towns (approximate);
  3. settlement - the settlement named in the description ("12 km south of the village of X"),
                  only when it is within 15 km (approximate).
Anything else is left off the map and reported.

Usage: python3 scripts/import_monuments.py [--geocode]
  --geocode  ask Nominatim (1 request per second) for anything not in scripts/geocode-cache.json yet.
The cache is committed, so a rerun without --geocode gives the same result with no lookups.
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "monuments.json"
# count and classes only: the landing page shows the number without loading every point
META = ROOT / "content" / "monuments-meta.json"
REGIONS_GEO = ROOT / "content" / "geo" / "kz-regions.geojson"
CACHE = ROOT / "scripts" / "geocode-cache.json"
CODE = "G25KS000318"
SOURCE = f"https://adilet.zan.kz/rus/docs/{CODE}"
UA = {"User-Agent": "Mozilla/5.0 (TarihGuessr open-data import)"}
NOMINATIM_UA = {"User-Agent": "TarihGuessr/1.0 (Republic Day hackathon; https://github.com/Amir411111/Republic_Day)"}
MAX_KM_FROM_SETTLEMENT = 15

# section heading in the list -> region names and region ids in content/geo/kz-regions.geojson
# (that file has the pre-2022 division: Abai is inside "vostochno", Zhetysu inside "almaty", Ulytau inside "karaganda")
SECTIONS = {
    "город Астана": ({"kk": "Астана қаласы", "ru": "город Астана"}, ["astana", "akmola"], "Астана"),
    "город Алматы": ({"kk": "Алматы қаласы", "ru": "город Алматы"}, ["almaty-city", "almaty"], "Алматы"),
    "город Шымкент": ({"kk": "Шымкент қаласы", "ru": "город Шымкент"}, ["turkestan"], "Шымкент"),
    "область Абай": ({"kk": "Абай облысы", "ru": "область Абай"}, ["vostochno"], None),
    "Акмолинская область": ({"kk": "Ақмола облысы", "ru": "Акмолинская область"}, ["akmola", "astana"], None),
    "Актюбинская область": ({"kk": "Ақтөбе облысы", "ru": "Актюбинская область"}, ["aktobe"], None),
    "Алматинская область": ({"kk": "Алматы облысы", "ru": "Алматинская область"}, ["almaty", "almaty-city"], None),
    "Атырауская область": ({"kk": "Атырау облысы", "ru": "Атырауская область"}, ["atyrau"], None),
    "Западно-Казахстанская область": ({"kk": "Батыс Қазақстан облысы", "ru": "Западно-Казахстанская область"}, ["zapadno"], None),
    "Жамбылская область": ({"kk": "Жамбыл облысы", "ru": "Жамбылская область"}, ["zhambyl"], None),
    "область Жетісу": ({"kk": "Жетісу облысы", "ru": "область Жетісу"}, ["almaty"], None),
    "Карагандинская область": ({"kk": "Қарағанды облысы", "ru": "Карагандинская область"}, ["karaganda"], None),
    "Костанайская область": ({"kk": "Қостанай облысы", "ru": "Костанайская область"}, ["kostanay"], None),
    "Кызылординская область": ({"kk": "Қызылорда облысы", "ru": "Кызылординская область"}, ["kyzylorda"], None),
    "Мангистауская область": ({"kk": "Маңғыстау облысы", "ru": "Мангистауская область"}, ["mangystau"], None),
    "Павлодарская область": ({"kk": "Павлодар облысы", "ru": "Павлодарская область"}, ["pavlodar"], None),
    "Северо-Казахстанская область": ({"kk": "Солтүстік Қазақстан облысы", "ru": "Северо-Казахстанская область"}, ["severo"], None),
    "Туркестанская область": ({"kk": "Түркістан облысы", "ru": "Туркестанская область"}, ["turkestan"], None),
    "область Ұлытау": ({"kk": "Ұлытау облысы", "ru": "область Ұлытау"}, ["karaganda"], None),
    "Восточно-Казахстанская область": ({"kk": "Шығыс Қазақстан облысы", "ru": "Восточно-Казахстанская область"}, ["vostochno"], None),
}


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

# --- classes ------------------------------------------------------------------------------

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


# --- placing by address or settlement ------------------------------------------------------

# "села Сагиз", "поселка Айтеке би", "города Форт-Шевченко"; a following "...ского района" is not part of the name
SETTLEMENT = re.compile(
    r"(?:села|селе|село|с\.|поселка|посёлка|поселке|пос\.|п\.|аула|ауле|аул|города|городе|город|г\.|станции|станция|ст\.)"
    r"\s*([А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+(?:-[А-ЯЁӘҒҚҢӨҰҮҺІа-яёәғқңөұүһі][а-яёәғқңөұүһі]*)*"
    r"(?: (?!\w+(?:ского|ский|ской|ского района)\b)[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+)?)"
)
# the street part of an address: "улица Б. Маяулы, 7"
STREET_PART = re.compile(r"((?:улица|ул\.|проспект|пр\.|переулок|бульвар|площадь|микрорайон|мкр)[^,;]*(?:,\s*№?\s*\d+[\w/]*)?)", re.I)
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
            self.cache[query] = [[float(h["lat"]), float(h["lon"]), h.get("class", ""), h.get("type", ""), h.get("name", "")] for h in hits]
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
            street = STREET_PART.search(re.sub(r"\(.*?\)", "", flat))
            queries = [f"{street.group(1).strip(' ,.')}, {town}", town] if street else [town]
        else:
            m = SETTLEMENT.search(flat)
            if not m or distance_km(flat) > MAX_KM_FROM_SETTLEMENT:
                return None
            queries = [f"{m.group(1)}, {act['region']['ru']}", m.group(1)]
        for q in queries:
            for lat, lng, cls, typ, *_ in self.lookup(q) or []:
                if cls in ("place", "boundary", "highway", "building", "amenity", "tourism", "historic", "landuse") \
                        and in_regions(lat, lng, act["geo"]):
                    return round(lat, 5), round(lng, 5)
        return None


# --- the list -----------------------------------------------------------------------------

def list_rows(page):
    """{number: {name, type, place, section}} for every monument row of the list."""
    parser = Tables()
    parser.feed(page)
    table = max(parser.tables, key=len)
    rows, section = {}, ""
    for row in table:
        first = row[0].strip()
        if first and not any(c.strip() for c in row[1:]) and not re.match(r"(Итого|Всего|Барлығы|Жиыны)", first):
            section = first
        elif re.fullmatch(r"\d+", first) and len(row) >= 4 and row[1].strip() not in ("", "2"):
            rows[int(first)] = {
                "name": re.sub(r"\s+", " ", row[1]).strip(),
                "type": re.sub(r"\s+", " ", row[2]).strip(),
                "place": re.sub(r"\s+", " ", row[3]).strip(),
                "section": section,
            }
    return rows


KZ_TO_RU = str.maketrans("әғқңөұүһіӘҒҚҢӨҰҮҺІ", "агкноуухиАГКНОУУХИ")
# generic words that say what an object is, not which one
STOP = {
    "мавзолей", "мавзолея", "городище", "здание", "памятник", "памятника", "комплекс", "ансамбль", "бывший",
    "бывшее", "жилой", "музей", "музея", "мечеть", "мечети", "церковь", "собор", "курган", "курганы", "могильник",
    "поселение", "стоянка", "некрополь", "дворец", "школа", "училище", "гимназия", "место", "захоронения",
    "могила", "архитекторы", "архитектор", "скульптор", "мастера", "города", "город", "улица", "годы", "года",
    "века", "век", "имени", "казахской", "республики", "казахстан", "казахстана", "государственный", "наскальные",
    "изображения", "петроглифы", "купца", "церкви", "дома",
}


def search_name(name):
    """The object's own name, without the date, the architect and its present use."""
    s = re.split(r",|\(|\bныне\b|–|—", name)[0]
    s = re.sub(r"[«»\"“”]", "", s)
    return re.sub(r"\s+", " ", s).strip()


def tokens(text):
    words = re.findall(r"[а-яёa-z0-9-]{4,}", text.lower().translate(KZ_TO_RU).replace("ё", "е"))
    return {w[:5] for w in words if w not in STOP}


OSM_OBJECT = {"historic", "tourism", "building", "amenity", "man_made", "leisure", "heritage"}


# lowercase words that belong to a proper name: "Қорқыт ата", "Жұбан ана", "Айтеke би"
NAME_TAILS = {"ата", "ана", "апа", "би", "хан", "хана", "баба", "әулие", "аулие", "батыр", "ишан", "ишана"}


def distinct_name(name):
    """Only the words that name this object: "Подземная мечеть Бекет-ата ..." -> "Бекет-ата"."""
    words = search_name(name).split()[1:]  # the first word says what the object is
    keep = [w for w in words if (w[0].isupper() or "-" in w or w.lower() in NAME_TAILS) and w.lower() not in STOP]
    return " ".join(keep)


def from_osm(names, region_ru, geo_ids, geo):
    """An OpenStreetMap object named like the monument (Russian or Kazakh name), inside its region."""
    want = set().union(*(tokens(search_name(n)) for n in names if n))
    if not want:
        return None
    queries = []
    for n in names:
        if n:
            queries += [f"{search_name(n)}, {region_ru}", distinct_name(n)]
    for q in dict.fromkeys(q for q in queries if q.strip(", ")):
        for lat, lng, cls, typ, *rest in geo.lookup(q) or []:
            hit_name = rest[0] if rest else ""
            # necropolises are mapped as cemeteries, remote sites as named localities
            kind_ok = cls in OSM_OBJECT or (cls, typ) in {("landuse", "cemetery"), ("place", "locality")}
            if kind_ok and in_regions(lat, lng, geo_ids) and tokens(hit_name) & want:
                return round(lat, 5), round(lng, 5)
    return None


def main():
    ru = list_rows(fetch(f"https://zakon.uchet.kz/rus/docs/{CODE}"))
    kk = list_rows(fetch(f"https://zakon.uchet.kz/kaz/docs/{CODE}"))
    geo = Geocoder(online="--geocode" in sys.argv)
    out, missed, how_count = [], [], {}
    try:
        for num, r in sorted(ru.items()):
            if r["section"] not in SECTIONS:
                missed.append((num, r["name"], f"unknown section {r['section']!r}"))
                continue
            region, geo_ids, city = SECTIONS[r["section"]]
            k = kk.get(num, {})
            entry = {
                "id": num,
                "name": {"kk": k.get("name", ""), "ru": r["name"]},
                "type": {"kk": k.get("type", ""), "ru": r["type"]},
                "kind": kind_of(r["type"], k.get("type", "")),
                "place": {"kk": k.get("place", ""), "ru": r["place"]},
                "region": region,
                "source": SOURCE,
            }
            how = None
            # the Kazakh name keeps letters like қ and ұ, which OpenStreetMap names often use
            o = from_osm([r["name"], k.get("name", "")], region["ru"], geo_ids, geo)
            if o:
                (lat, lng), approx, how = o, False, "osm"
            else:
                p = geo.place(r["place"], {"region": region, "geo": geo_ids, "city": city})
                if p:
                    (lat, lng), approx = p, True
                    how = "address" if STREET.search(r["place"]) else "settlement"
            if not how:
                missed.append((num, r["name"], r["place"]))
                continue
            how_count[how] = how_count.get(how, 0) + 1
            entry.update({"lat": lat, "lng": lng, "approx": approx, "how": how})
            out.append(entry)
    finally:
        geo.save()

    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    kinds = {}
    for m in out:
        kinds[m["kind"]] = kinds.get(m["kind"], 0) + 1
    META.write_text(json.dumps({"count": len(out), "listed": len(ru), "exact": sum(not m["approx"] for m in out),
                                "kinds": kinds}) + "\n", encoding="utf-8")
    print(f"{len(ru)} in the list, {len(out)} placed {how_count}, {len(missed)} left off the map:")
    for num, name, why in missed:
        print(f"  {num}. {name[:70]} | {why[:90]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

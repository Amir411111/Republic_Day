#!/usr/bin/env python3
"""Download a Wikimedia Commons image (1200px wide) into content/images
and print a ready image_credit block.

Usage: python3 scripts/fetch_commons.py "File:Some name.jpg" [output-name.jpg]
"""
import json
import re
import sys
import urllib.parse
import urllib.request
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "content" / "images"
API = "https://commons.wikimedia.org/w/api.php"
# Wikimedia requires a descriptive User-Agent
UA = "TarihGuessr/0.1 (hackathon project; educational use)"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def strip_html(s):
    return unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def fetch(title, out_name=None):
    if not title.startswith("File:"):
        title = "File:" + title
    params = {
        "action": "query",
        "format": "json",
        "titles": title,
        "prop": "imageinfo",
        "iiprop": "url|extmetadata",
        "iiurlwidth": "1200",
    }
    data = json.loads(get(API + "?" + urllib.parse.urlencode(params)))
    page = next(iter(data["query"]["pages"].values()))
    if "imageinfo" not in page:
        raise SystemExit(f"Not found on Commons: {title}")
    info = page["imageinfo"][0]
    meta = info.get("extmetadata", {})

    src = info.get("thumburl") or info["url"]
    ext = Path(urllib.parse.urlparse(src).path).suffix.lower() or ".jpg"
    if not out_name:
        stem = re.sub(r"[^a-z0-9]+", "-", Path(title[5:]).stem.lower()).strip("-")
        out_name = stem + ext
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / out_name).write_bytes(get(src))

    credit = {
        "author": strip_html(meta.get("Artist", {}).get("value")) or "Unknown",
        "license": strip_html(meta.get("LicenseShortName", {}).get("value")),
        "source_url": info["descriptionurl"],
    }
    print(json.dumps({"image": f"images/{out_name}", "image_credit": credit}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    fetch(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)

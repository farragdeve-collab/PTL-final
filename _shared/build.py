#!/usr/bin/env python3
"""Build the three PTL site versions.

  python3 _shared/build.py

Templates live in _src/<version>/ and extend _shared/templates/base.j2.
Output goes to <version-folder>/ next to this directory. Every element with
data-i18n gets the Arabic text pre-filled, so the page reads correctly even
before JavaScript runs; core.js swaps in the visitor's language.
"""
import html
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

from jinja2 import Environment, FileSystemLoader

ROOT = Path(__file__).resolve().parent.parent
SHARED = ROOT / "_shared"
ASSETS = SHARED / "assets"

VERSIONS = [
    {"id": "v1", "out": "v1-chrome", "name": "Chrome", "theme": "dark", "variant": "ring"},
    {"id": "v1", "out": "v1-chrome-grid", "name": "Chrome (B)", "theme": "dark", "variant": "grid"},
    {"id": "v1", "out": "v4-final", "name": "Final", "theme": "dark", "variant": "grid", "final": True},
    {"id": "v2", "out": "v2-editorial", "name": "Editorial", "theme": "light"},
    {"id": "v3", "out": "v3-globe", "name": "Globe", "theme": "dark"},
]

PAGES = ["index", "about", "contact"]

content = json.loads(subprocess.check_output(
    ["node", "-e", "global.window={};require(process.argv[1]);"
     "process.stdout.write(JSON.stringify({c:window.PTL_CONTENT,k:window.PTL_CONTACT}))",
     str(SHARED / "content.js")]))
AR = content["c"]["ar"]
CONTACT = content["k"]

DATA = {
    "services": [
        {"k": "svc1", "img": "ship-sea", "icon": "globe"},
        {"k": "svc2", "img": "docs", "icon": "stamp"},
        {"k": "svc3", "img": "port-ship", "icon": "crane"},
        {"k": "svc4", "img": "truck-road", "icon": "truck"},
        {"k": "svc5", "img": "handshake", "icon": "chat"},
        {"k": "svc6", "img": "containers-wall", "icon": "box"},
    ],
    "process": ["p1", "p2", "p3", "p4", "p5", "p6"],
    "values": [
        {"k": "v1", "img": "plane-ground"},
        {"k": "v2", "img": "port-yard"},
        {"k": "v3", "img": "warehouse"},
    ],
    "cargo": ["c%d" % i for i in range(1, 11)],
    "regions": [
        {"k": "asia", "n": 9},
        {"k": "europe", "n": 9},
        {"k": "gulf", "n": 4},
        {"k": "americas", "n": 6},
        {"k": "africa", "n": None},
    ],
    "reviews": ["r1", "r2", "r3"],
    "faqs": ["q1", "q2", "q3", "q4"],
    "journey": [
        {"k": "j1", "img": "warehouse-aisle"},
        {"k": "j2", "img": "port-ship"},
        {"k": "j3", "img": "ship-sea"},
        {"k": "j4", "img": "plane-sky"},
        {"k": "j5", "img": "docs"},
        {"k": "j6", "img": "truck-road"},
    ],
    "modes": [
        {"k": "land", "img": "truck-mountain"},
        {"k": "sea", "img": "containers-aerial"},
        {"k": "air", "img": "plane-ground"},
        {"k": "post", "img": "parcels"},
    ],
    "langs": [("ar", "ع", "العربية"), ("en", "EN", "English"), ("fr", "FR", "Français"), ("zh", "中", "中文")],
    "contact": CONTACT,
}

I18N_EMPTY = re.compile(r'(<(\w+)\b[^>]*?\sdata-i18n="([^"]+)"[^>]*>)(\s*)(</\2>)')
I18N_PH = re.compile(r'data-i18n-ph="([^"]+)"')


def prefill(markup: str) -> str:
    def fill(m):
        key = m.group(3)
        if key not in AR:
            raise KeyError(f"missing translation key: {key}")
        return m.group(1) + html.escape(AR[key], quote=False) + m.group(5)
    markup = I18N_EMPTY.sub(fill, markup)
    markup = I18N_PH.sub(lambda m: f'{m.group(0)} placeholder="{html.escape(AR[m.group(1)])}"', markup)
    return markup


def build(only=None):
    for v in VERSIONS:
        if only and v["id"] not in only and v["out"] not in only:
            continue
        src = ROOT / "_src" / v["id"]
        out = ROOT / v["out"]
        if out.exists():
            shutil.rmtree(out)
        (out / "assets").mkdir(parents=True)
        env = Environment(loader=FileSystemLoader([str(src), str(SHARED / "templates")]),
                          trim_blocks=True, lstrip_blocks=True)
        env.globals.update(DATA, ar=AR, version=v)
        used = set()
        for page in PAGES:
            markup = env.get_template(f"{page}.j2").render(page=page)
            markup = prefill(markup)
            used.update(re.findall(r'assets/([\w.-]+\.(?:jpg|png|webp))', markup.replace('srcset="', 'src="')))
            (out / f"{page}.html").write_text(markup, encoding="utf-8")
        for f in ["content.js", "core.js"]:
            shutil.copy(SHARED / f, out / f)
        for f in src.iterdir():
            if f.suffix in (".css", ".js"):
                shutil.copy(f, out / f.name)
                used.update(re.findall(r'assets/([\w.-]+\.(?:jpg|png|webp))', f.read_text(encoding="utf-8")))
        for name in sorted(used):
            shutil.copy(ASSETS / name, out / "assets" / name)
        print(f"{v['out']}: {len(PAGES)} pages, {len(used)} assets")

    chooser = Environment(loader=FileSystemLoader(str(SHARED / "templates"))).get_template("chooser.j2")
    (ROOT / "index.html").write_text(chooser.render(versions=VERSIONS), encoding="utf-8")
    for name in ["logo-color.png", "favicon.png"]:
        (ROOT / "_chooser").mkdir(exist_ok=True)
        shutil.copy(ASSETS / name, ROOT / "_chooser" / name)


if __name__ == "__main__":
    build(sys.argv[1:])

#!/usr/bin/env python3
"""Generate design/latte-cpanel.figcraft with FigCraft's command API.

Usage:  python3 design/build/build_design.py > latte.jsonl
        figcraft-cli run latte.jsonl --out design/latte-cpanel.figcraft

The file has two pages:
- Desktop (1440x900): the cPanel-style shell with the customer list, an edit form and the
  empty, loading and error states. Light frames on the left, dark frames on the right.
- Mobile (390x844): the list and the edit form at phone width, light and dark.

Every colour is a variable in the Theme collection with two modes (Light, Dark), so a
screen switches theme by switching its mode. Colour values come from Latte's CSS tokens
in src/index.css; the dark values are derived for the same contrast.
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

steps = []
_n = 0

MODES = ["Light", "Dark"]
TOKENS = {
    "bg": ("#F7F8F5", "#121512"),
    "surface": ("#FFFFFF", "#1B1F1B"),
    "text": ("#3F453F", "#E4E8E2"),
    "textStrong": ("#101510", "#F5F7F3"),
    "muted": ("#667064", "#A3ADA0"),
    "border": ("#DFE4DC", "#2F362F"),
    "accent": ("#31795F", "#6CC4A1"),
    "accentText": ("#FFFFFF", "#0E1510"),
    "accentSoft": ("#E7F3EE", "#1F3A30"),
    "danger": ("#B42318", "#F97066"),
}
FONT = "Inter"
STYLES = {"regular": "Regular", "semibold": "SemiBold", "bold": "Bold"}


def S(command, params, ref=True):
    global _n
    step = {"command": command, "params": params}
    name = None
    if ref:
        _n += 1
        name = f"n{_n}"
        step["as"] = name
    steps.append(step)
    return {"$ref": name} if name else None


def col(name):
    return {"$var": f"color/{name}"} if name else None


def setup_variables():
    S("variable.createCollection", {"name": "Theme", "modes": MODES}, ref=False)
    for key, (light, dark) in TOKENS.items():
        S("variable.create", {"collection": "Theme", "name": f"color/{key}", "type": "color",
                              "values": {"Light": light, "Dark": dark}}, ref=False)


def F(parent, name, layout=None, w=None, h=None, x=None, y=None, fill=None, stroke=None, **p):
    """A frame. Fill and stroke are variable names; sizing defaults to fixed when a size is given."""
    props = {}
    if layout:
        props["layout"] = layout
    for k in ("gap", "padding", "cornerRadius", "mainAlign", "crossAlign", "clip", "strokeWeight"):
        if k in p:
            props[k] = p[k]
    props["fill"] = col(fill)
    if stroke:
        props["stroke"] = col(stroke)
    props["sizingH"] = p.get("sH", "fixed" if w else "hug")
    props["sizingV"] = p.get("sV", "fixed" if h else "hug")
    params = {"type": "frame", "name": name, "props": props, "select": False}
    if parent is not None:
        params["parent"] = parent
    for key, value in (("width", w), ("height", h), ("x", x), ("y", y)):
        if value is not None:
            params[key] = value
    return S("node.create", params)


def T(parent, text, size=15, weight="regular", color="text", fill_width=False, name=None):
    props = {"fontFamily": FONT, "fontStyle": STYLES[weight], "fontSize": size, "fill": col(color)}
    if fill_width:
        props["sizingH"] = "fill"
        props["textAutoResize"] = "height"
    params = {"type": "text", "parent": parent, "text": text, "props": props, "select": False}
    if name:
        params["name"] = name
    return S("node.create", params)


def rect(parent, name, h, fill, radius=8):
    """A flat bar used for skeleton lines and dividers."""
    return F(parent, name, h=h, fill=fill, cornerRadius=radius, sH="fill")


def button(parent, label, primary=True):
    extra = {} if primary else {"stroke": "border", "strokeWeight": 1}
    b = F(parent, f"button/{label}", layout="horizontal", h=40, padding=[0, 18, 0, 18], cornerRadius=10,
          fill="accent" if primary else "surface", crossAlign="center", **extra)
    T(b, label, 15, "semibold", "accentText" if primary else "text")
    return b


def status_pill(parent, label, active):
    pill = F(parent, f"status/{label}", layout="horizontal", padding=[4, 10, 4, 10], cornerRadius=999,
             fill="accentSoft" if active else "bg", crossAlign="center")
    T(pill, label, 13, "semibold", "accent" if active else "muted")


def screen(name, x, y, w, h, mode):
    frame = F(None, name, layout="horizontal", w=w, h=h, x=x, y=y, fill="bg")
    S("variable.setMode", {"ids": [frame], "collection": "Theme", "mode": mode}, ref=False)
    return frame


# ---------------------------------------------------------------- logo and icons
# The logo is the Latte wordmark (design/logo/latte-logo.svg). Its fills map to theme tokens:
# the letters use the navy text colour, and the cut-outs (the drop in the a, the small drop in
# the e) use the surface colour, so they read as holes on either theme.
SVG_NS = "{http://www.w3.org/2000/svg}"
LOGO_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "logo", "latte-logo.svg")
LOGO_FILLS = {"#14395C": "textStrong", "#F5F8FB": "surface"}
ICONS = {
    "menu": ["M4 6h16", "M4 12h16", "M4 18h16"],
    "chevronLeft": ["M15 18l-6-6 6-6"],
}
_num = re.compile(r"[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?")


def scale_path(d, k):
    """Scale SVG path data by k. Arc flags and rotation stay as they are."""
    out, cmd, argi = [], None, 0
    for token in _num.findall(d):
        if token.isalpha():
            cmd, argi = token, 0
            out.append(token)
            continue
        value = float(token)
        if cmd in "aA" and argi % 7 in (2, 3, 4):
            out.append(token)
        else:
            out.append(f"{value * k:.3f}")
        argi += 1
    return " ".join(out)


def stroke_paths(parent, name, paths, size, view, color, weight):
    box = F(parent, name, w=size, h=size)
    k = size / view
    for d in paths:
        S("node.create", {"type": "vector", "parent": box, "x": 0, "y": 0, "path": scale_path(d, k),
                          "select": False,
                          "props": {"fill": None, "stroke": col(color), "strokeWeight": round(weight * k, 2),
                                    "strokeCap": "round", "strokeJoin": "round"}}, ref=False)
    return box


def logo(parent, width):
    """The wordmark at the given width, with its height taken from the SVG's viewBox."""
    root = ET.parse(LOGO_FILE).getroot()
    _, _, view_w, view_h = (float(v) for v in root.get("viewBox").split())
    k = width / view_w
    box = F(parent, "logo", w=round(width, 2), h=round(view_h * k, 2))
    for el in root.iter(f"{SVG_NS}path"):
        path = scale_path(el.get("d"), k)
        fill_token = LOGO_FILLS.get(el.get("fill", "").upper())
        stroke_token = LOGO_FILLS.get(el.get("stroke", "").upper())
        if fill_token:
            props = {"fill": col(fill_token)}
        elif stroke_token:
            # Stroke-only paths, such as the reflection in the a, keep their weight and caps.
            props = {
                "fill": None,
                "stroke": col(stroke_token),
                "strokeWeight": round(float(el.get("stroke-width", "1")) * k, 2),
                "strokeCap": "round" if el.get("stroke-linecap") == "round" else "butt",
            }
        else:
            continue
        S("node.create", {"type": "vector", "parent": box, "x": 0, "y": 0, "path": path,
                          "select": False, "props": props}, ref=False)
    return box


def icon(parent, key, size, color):
    return stroke_paths(parent, f"icon/{key}", ICONS[key], size, 24, color, 2)


CUSTOMERS = [
    ("Mara Lopez", "mara@example.com", "Active", "2 Nov 2026"),
    ("Tom Reilly", "tom@example.com", "Active", "28 Oct 2026"),
    ("Priya Shah", "priya@example.com", "Paused", "14 Oct 2026"),
    ("Jonas Berg", "jonas@example.com", "Active", "9 Oct 2026"),
    ("Aisha Khan", "aisha@example.com", "Paused", "2 Oct 2026"),
]
NAV = ["Customers", "Products", "Orders", "Settings"]


def sidebar(parent):
    side = F(parent, "Sidebar", layout="vertical", w=240, fill="surface", padding=20, gap=6, sV="fill")
    logo(side, 168)
    rect(side, "spacer", 16, "bg", radius=0)
    for item in NAV:
        active = item == "Customers"
        row = F(side, f"nav/{item}", layout="horizontal", padding=[10, 12, 10, 12], cornerRadius=10,
                fill="accentSoft" if active else None, crossAlign="center", sH="fill")
        T(row, item, 15, "semibold" if active else "regular", "accent" if active else "text")


def topbar(parent, compact=False, back=False):
    """Desktop: organization name and user. Phone: a menu button (or back on a form) beside the logo."""
    pad = 16 if compact else 32
    bar = F(parent, "Topbar", layout="horizontal", h=64, fill="surface", padding=[0, pad, 0, pad],
            mainAlign="spaceBetween", crossAlign="center", sH="fill")
    left = F(bar, "Navigation", layout="horizontal", gap=12, crossAlign="center")
    if compact:
        icon(left, "chevronLeft" if back else "menu", 24, "text")
        logo(left, 112)
    else:
        T(left, "Acme Co", 14, "semibold", "muted")
    user = F(bar, "User", layout="horizontal", gap=10, crossAlign="center")
    if not compact:
        T(user, "Admin", 14, "regular", "muted")
    F(user, "avatar", w=32, h=32, fill="accent", cornerRadius=16)


def page_button(parent, label, active=False, disabled=False):
    color = "accentText" if active else "muted" if disabled else "text"
    b = F(parent, f"page/{label}", layout="horizontal", h=36, padding=[0, 12, 0, 12], cornerRadius=8,
          fill="accent" if active else "surface", stroke="border", strokeWeight=1, crossAlign="center")
    T(b, label, 14, "semibold", color)


def pager(parent, compact=False):
    bar = F(parent, "Pagination", layout="horizontal", gap=8, crossAlign="center", mainAlign="spaceBetween",
            sH="fill")
    T(bar, "Page 1 of 9" if compact else "Showing 1–5 of 42 customers", 13, "regular", "muted")
    controls = F(bar, "Controls", layout="horizontal", gap=8, crossAlign="center")
    page_button(controls, "Previous", disabled=True)
    if not compact:
        for number in ("1", "2", "3"):
            page_button(controls, number, active=number == "1")
        T(controls, "…", 14, "regular", "muted")
        page_button(controls, "9")
    page_button(controls, "Next")


def content(parent, name, padding=32):
    return F(parent, name, layout="vertical", gap=24, padding=padding, sH="fill", sV="fill")


def customer_table(parent, compact=False):
    table = F(parent, "Table", layout="vertical", fill="surface", stroke="border", strokeWeight=1,
              cornerRadius=14, sH="fill")
    if not compact:
        header = F(table, "Header", layout="horizontal", padding=[12, 20, 12, 20], gap=16, sH="fill")
        for label in ("Name", "Email", "Status", "Updated"):
            T(header, label, 13, "semibold", "muted", fill_width=True)
    for name, email, status, updated in CUSTOMERS:
        row = F(table, f"row/{name}", layout="horizontal", padding=[14, 20, 14, 20], gap=16,
                crossAlign="center", sH="fill", stroke="border", strokeWeight=1)
        T(row, name, 15, "semibold", "textStrong", fill_width=True)
        T(row, email, 14, "regular", "text", fill_width=True)
        if compact:
            status_pill(row, status, status == "Active")
        else:
            cell = F(row, "cell/status", layout="horizontal", crossAlign="center", sH="fill")
            status_pill(cell, status, status == "Active")
            T(row, updated, 14, "regular", "muted", fill_width=True)


def list_screen(parent, compact=False):
    c = content(parent, "Customers", padding=16 if compact else 32)
    head = F(c, "Heading", layout="horizontal", mainAlign="spaceBetween", crossAlign="center", sH="fill")
    T(head, "Customers", 24 if compact else 28, "bold", "textStrong")
    button(head, "New customer")
    if not compact:
        toolbar = F(c, "Toolbar", layout="horizontal", gap=12, crossAlign="center", sH="fill")
        search = F(toolbar, "Search", layout="horizontal", w=360, h=40, fill="surface", stroke="border",
                   strokeWeight=1, cornerRadius=10, padding=[0, 14, 0, 14], crossAlign="center")
        T(search, "Search customers", 15, "regular", "muted")
    customer_table(c, compact=compact)
    pager(c, compact=compact)


def field(parent, label, value):
    group = F(parent, f"field/{label}", layout="vertical", gap=6, sH="fill")
    T(group, label, 14, "semibold", "text")
    box = F(group, "input", layout="horizontal", h=44, padding=[0, 12, 0, 12], fill="surface", stroke="border",
            strokeWeight=1, cornerRadius=10, crossAlign="center", sH="fill")
    T(box, value, 15, "regular", "textStrong")


def edit_screen(parent, compact=False):
    c = content(parent, "Edit customer", padding=16 if compact else 32)
    T(c, "Edit customer", 24 if compact else 28, "bold", "textStrong")
    card = F(c, "Form", layout="vertical", gap=18, padding=20 if compact else 24, fill="surface", stroke="border",
             strokeWeight=1, cornerRadius=14, w=None if compact else 720, sH="fill" if compact else "fixed")
    for label, value in [("Name", "Mara Lopez"), ("Email", "mara@example.com"), ("Plan", "Pro")]:
        field(card, label, value)
    T(card, "Email is already used by another customer.", 14, "regular", "danger", fill_width=True)
    actions = F(card, "Actions", layout="horizontal", gap=12, crossAlign="center")
    button(actions, "Save changes")
    button(actions, "Cancel", primary=False)


def states_screen(parent):
    c = content(parent, "States")
    T(c, "Empty", 13, "semibold", "muted")
    empty = F(c, "Empty state", layout="vertical", gap=12, padding=40, fill="surface", stroke="border",
              strokeWeight=1, cornerRadius=14, crossAlign="center", sH="fill")
    T(empty, "No customers yet", 20, "bold", "textStrong")
    T(empty, "Add your first customer to get started.", 15, "regular", "muted")
    button(empty, "New customer")
    T(c, "Loading", 13, "semibold", "muted")
    skeleton = F(c, "Loading state", layout="vertical", gap=14, padding=24, fill="surface", stroke="border",
                 strokeWeight=1, cornerRadius=14, sH="fill")
    for i in range(3):
        rect(skeleton, f"skeleton/{i + 1}", 16, "border")
    T(c, "Error", 13, "semibold", "muted")
    banner = F(c, "Error state", layout="horizontal", padding=16, fill="surface", stroke="danger",
               strokeWeight=1, cornerRadius=10, sH="fill")
    T(banner, "Could not load customers. Try again.", 15, "semibold", "danger")


def desktop_page():
    for row, (label, build) in enumerate([("Customers", list_screen), ("Edit customer", edit_screen),
                                          ("States", states_screen)]):
        for mode, x in (("Light", 0), ("Dark", 1520)):
            frame = screen(f"Desktop / {mode} / {label}", x, row * 960, 1440, 900, mode)
            sidebar(frame)
            main = F(frame, "Main", layout="vertical", sH="fill", sV="fill", fill="bg")
            topbar(main)
            build(main)


def mobile_page():
    for row, (label, build) in enumerate([("Customers", list_screen), ("Edit customer", edit_screen)]):
        for mode, x in (("Light", 0), ("Dark", 430)):
            frame = screen(f"Mobile / {mode} / {label}", x, row * 900, 390, 844, mode)
            page = F(frame, "Screen", layout="vertical", sH="fill", sV="fill", fill="bg")
            topbar(page, compact=True, back=label == "Edit customer")
            build(page, compact=True)


def main():
    setup_variables()
    S("page.rename", {"name": "Desktop"}, ref=False)
    desktop_page()
    mobile = S("page.add", {"name": "Mobile"})
    S("page.select", {"id": mobile}, ref=False)
    mobile_page()
    S("page.select", {"index": 0}, ref=False)
    for step in steps:
        print(json.dumps(step, ensure_ascii=False))


if __name__ == "__main__":
    sys.exit(main())

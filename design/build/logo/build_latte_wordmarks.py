#!/usr/bin/env python3
"""Latte wordmarks where the drop closes or surrounds the word, in azure/navy.
Letters are converted to vector outlines with fontTools, so the drops can sit exactly on the glyphs.
Usage: python3 build_latte_wordmarks.py <fonts-node_modules> > wm.jsonl"""
import json, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

FD = sys.argv[1] + "/@expo-google-fonts"
steps = []; _n = 0
def S(c, p, ref=True):
    global _n
    st = {"command": c, "params": p}
    if ref: _n += 1; st["as"] = f"n{_n}"
    steps.append(st); return {"$ref": st["as"]} if ref else None
def F(parent, name, layout=None, w=None, h=None, x=None, y=None, fill=None, **p):
    props = {"fill": fill}
    if layout: props["layout"] = layout
    for k in ("gap", "padding", "cornerRadius", "mainAlign", "crossAlign", "wrap", "crossGap", "stroke", "strokeWeight"):
        if k in p: props[k] = p[k]
    props["sizingH"] = p.get("sH", "fixed" if w else "hug"); props["sizingV"] = p.get("sV", "fixed" if h else "hug")
    q = {"type": "frame", "name": name, "props": props, "select": False}
    for k, v in (("parent", parent), ("width", w), ("height", h), ("x", x), ("y", y)):
        if v is not None: q[k] = v
    return S("node.create", q)
def T(parent, text, size, font, color, fill=False, lh=None):
    props = {"fontFamily": font[0], "fontStyle": font[1], "fontSize": size, "fill": color}
    if lh: props["lineHeight"] = lh
    if fill: props["sizingH"] = "fill"; props["textAutoResize"] = "height"
    return S("node.create", {"type": "text", "parent": parent, "text": text, "props": props, "select": False})
def grow(r): S("node.set", {"ids": [r], "props": {"sizingH": "fill"}}, ref=False)

INTER_B, INTER_R = ("Inter", "Bold"), ("Inter", "Regular")
AZURE, NAVY, SKY, BG, MUTED, WHITE, INK = "#3A86C8", "#14395C", "#BFDDF5", "#F5F8FB", "#5E6B78", "#FFFFFF", "#0F1D2B"

FONTS = {
    "fredoka": f"{FD}/fredoka/600SemiBold/Fredoka_600SemiBold.ttf",
    "fredoka-b": f"{FD}/fredoka/700Bold/Fredoka_700Bold.ttf",
    "pacifico": f"{FD}/pacifico/400Regular/Pacifico_400Regular.ttf",
    "leckerli": f"{FD}/leckerli-one/400Regular/LeckerliOne_400Regular.ttf",
}
_cache = {}
def font(key):
    if key not in _cache: _cache[key] = TTFont(FONTS[key])
    return _cache[key]

def glyphs(key, text, size, x0, base, track=0.0):
    """Outline of `text` with the baseline at y=base. Returns (path, bounds)."""
    f = font(key); gs = f.getGlyphSet(); cmap = f.getBestCmap(); k = size / f["head"].unitsPerEm
    hmtx = f["hmtx"]; x = x0; cmds = []; bp = BoundsPen(gs)
    for ch in text:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}")
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x, base)))
        gs[g].draw(TransformPen(bp, (k, 0, 0, -k, x, base)))
        cmds.append(pen.getCommands())
        x += hmtx[g][0] * k + track * size
    return " ".join(cmds), bp.bounds

def xheight(key, size):
    f = font(key); return f["OS/2"].sxHeight * size / f["head"].unitsPerEm

def drop(cx, bottom, h):
    """The Goccia drop (64-grid, x 11..53, y 4..62) placed by centre-x and bottom."""
    k = h / 58; ox, oy = cx - 32 * k, bottom - 62 * k
    P = lambda x, y: f"{ox + x * k:.2f} {oy + y * k:.2f}"
    r = 21 * k
    return (f"M{P(32, 4)} C{P(32, 4)} {P(11, 29)} {P(11, 41)} A{r:.2f} {r:.2f} 0 0 0 {P(53, 41)} "
            f"C{P(53, 29)} {P(32, 4)} {P(32, 4)} Z"), (cx - 21 * k, bottom - h, cx + 21 * k, bottom)

def shine(cx, bottom, h):
    k = h / 58; ox, oy = cx - 32 * k, bottom - 62 * k
    P = lambda x, y: f"{ox + x * k:.2f} {oy + y * k:.2f}"
    return f"M{P(21.5, 41)} A{10 * k:.2f} {10 * k:.2f} 0 0 0 {P(28, 51)}", 4.5 * k

def union(*bs):
    return (min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs))

# Each concept: f(s, c, ox, oy) -> (elements, bounds); s = type size, c = colours.
# Elements: ("fill", path, colour) or ("stroke", path, colour, width).
def chiusa(s, c, ox=0, oy=0):
    """Fredoka 'latte' closed by a drop, like a full stop."""
    base = oy + s
    d, b = glyphs("fredoka", "latte", s, ox, base, track=-0.01)
    h = xheight("fredoka", s) * 1.32; cx = b[2] + s * 0.13 + h * 0.36
    dp, db = drop(cx, base, h); sp, sw = shine(cx, base, h)
    return [("fill", d, c["text"]), ("fill", dp, c["drop"]), ("stroke", sp, c["shine"], sw)], union(b, db)

def racchiusa(s, c, ox=0, oy=0):
    """'Latte' in Pacifico, held inside a big drop."""
    h = s * 3.1; cx = ox + h * 0.37; bottom = oy + h
    dp, db = drop(cx, bottom, h)
    ts = s * 0.74
    d0, b0 = glyphs("pacifico", "Latte", ts, 0, 0)
    w = b0[2] - b0[0]
    base = bottom - h * 0.27
    d, b = glyphs("pacifico", "Latte", ts, cx - w / 2 - b0[0], base)
    return [("fill", dp, c["drop"]), ("fill", d, c["on_drop"])], db

def splash(s, c, ox=0, oy=0):
    """Leckerli 'Latte' on a swoosh of milk that ends in a flying drop."""
    base = oy + s * 1.05
    d, b = glyphs("leckerli", "Latte", s, ox + s * 0.05, base)
    x0, x1 = b[0] - s * 0.04, b[2] + s * 0.02
    y0 = base + s * 0.2
    sw = s * 0.1
    curve = (f"M{x0:.2f} {y0:.2f} C{x0 + (x1 - x0) * 0.35:.2f} {base + s * 0.42:.2f} "
             f"{x1 - s * 0.05:.2f} {base + s * 0.36:.2f} {x1 + s * 0.22:.2f} {base - s * 0.05:.2f}")
    h = s * 0.42; cx = x1 + s * 0.36
    dp, db = drop(cx, base - s * 0.22, h)
    bb = union(b, db, (x0 - sw, y0 - sw, x1 + s * 0.3, base + s * 0.42 + sw / 2))
    return [("fill", d, c["text"]), ("stroke", curve, c["drop"], sw), ("fill", dp, c["drop"])], bb

def etichetta(s, c, ox=0, oy=0):
    """A dairy-style label: 'latte' framed, with the drop sitting on the frame and breaking it."""
    pad_x, pad_y = s * 0.42, s * 0.36; sw = s * 0.07
    d0, b0 = glyphs("fredoka-b", "latte", s, 0, 0, track=0.02)
    tw, th = b0[2] - b0[0], b0[3] - b0[1]
    top = oy + s * 0.55
    W, H = tw + 2 * pad_x, th + 2 * pad_y
    x, y, r = ox + sw / 2, top, H / 2
    rect = (f"M{x + r:.2f} {y:.2f} H{x + W - r:.2f} A{r:.2f} {r:.2f} 0 0 1 {x + W - r:.2f} {y + H:.2f} "
            f"H{x + r:.2f} A{r:.2f} {r:.2f} 0 0 1 {x + r:.2f} {y:.2f} Z")
    d, b = glyphs("fredoka-b", "latte", s, x + pad_x - b0[0], y + pad_y - b0[1], track=0.02)
    h = s * 0.78; cx = x + W / 2
    halo, _ = drop(cx, y + h * 0.42 + sw * 1.6, h + sw * 3.2)
    dp, db = drop(cx, y + h * 0.42, h)
    sp, ssw = shine(cx, y + h * 0.42, h)
    bb = union((x - sw, y - sw, x + W + sw, y + H + sw), db)
    return [("stroke", rect, c["drop"], sw), ("fill", d, c["text"]), ("fill", halo, c["bg"]),
            ("fill", dp, c["drop"]), ("stroke", sp, c["shine"], ssw)], bb

def place(parent, fn, s, c, name="Wordmark", pad=4):
    _, b = fn(s, c)
    els, b = fn(s, c, -b[0] + pad, -b[1] + pad)
    fr = F(parent, name, w=round(b[2] + pad), h=round(b[3] + pad))
    for e in els:
        props = ({"fill": e[2], "stroke": None} if e[0] == "fill" else
                 {"fill": None, "stroke": e[2], "strokeWeight": round(e[3], 2), "strokeCap": "round", "strokeJoin": "round"})
        S("node.create", {"type": "vector", "parent": fr, "x": 0, "y": 0, "path": e[1], "select": False, "props": props}, ref=False)
    return fr

# App icons: one per concept, built from the same parts.
def icon_l_drop(s, c, ox=0, oy=0):
    base = oy + s
    d, b = glyphs("fredoka", "l", s, ox, base)
    h = xheight("fredoka", s) * 1.32; cx = b[2] + s * 0.07 + h * 0.36
    dp, db = drop(cx, base, h)
    return [("fill", d, c["text"]), ("fill", dp, c["drop"])], union(b, db)
def icon_badge(s, c, ox=0, oy=0):
    h = s * 3.1; cx = ox + h * 0.37; bottom = oy + h
    dp, db = drop(cx, bottom, h)
    d0, b0 = glyphs("pacifico", "L", s * 1.5, 0, 0); w = b0[2] - b0[0]
    d, _ = glyphs("pacifico", "L", s * 1.5, cx - w / 2 - b0[0] - s * 0.05, bottom - h * 0.24)
    return [("fill", dp, c["drop"]), ("fill", d, c["on_drop"])], db
def icon_splash(s, c, ox=0, oy=0):
    base = oy + s * 1.05
    d, b = glyphs("leckerli", "L", s, ox + s * 0.05, base)
    x0, x1 = b[0] - s * 0.04, b[2] + s * 0.02; sw = s * 0.12
    curve = f"M{x0:.2f} {base + s * 0.2:.2f} C{x0 + (x1 - x0) * 0.4:.2f} {base + s * 0.4:.2f} {x1:.2f} {base + s * 0.34:.2f} {x1 + s * 0.2:.2f} {base - s * 0.05:.2f}"
    h = s * 0.45; cx = x1 + s * 0.34
    dp, db = drop(cx, base - s * 0.22, h)
    return [("fill", d, c["text"]), ("stroke", curve, c["drop"], sw), ("fill", dp, c["drop"])], union(b, db, (x0 - sw, base, x1, base + s * 0.4 + sw))
def icon_label(s, c, ox=0, oy=0):
    sw = s * 0.1; W, H = s * 1.5, s * 0.62; x, y = ox + sw, oy + s * 0.9; r = H / 2
    rect = (f"M{x + r:.2f} {y:.2f} H{x + W - r:.2f} A{r:.2f} {r:.2f} 0 0 1 {x + W - r:.2f} {y + H:.2f} "
            f"H{x + r:.2f} A{r:.2f} {r:.2f} 0 0 1 {x + r:.2f} {y:.2f} Z")
    h = s * 1.15; cx = x + W / 2
    halo, _ = drop(cx, y + h * 0.35 + sw * 1.6, h + sw * 3.2)
    dp, db = drop(cx, y + h * 0.35, h)
    return [("stroke", rect, c["drop"], sw), ("fill", halo, c["bg"]), ("fill", dp, c["drop"])], union(db, (x - sw, y - sw, x + W + sw, y + H + sw))

LIGHT = {"text": NAVY, "drop": AZURE, "shine": WHITE, "on_drop": WHITE, "bg": BG}
DARK = {"text": WHITE, "drop": SKY, "shine": INK, "on_drop": INK, "bg": INK}
TILE = {"text": WHITE, "drop": WHITE, "shine": AZURE, "on_drop": AZURE, "bg": AZURE}

CONCEPTS = [
    ("E · Chiusa", "The drop closes the word, like a full stop. Fredoka: round and soft, friendly at any size.", chiusa, 60, 34, icon_l_drop, 46),
    ("F · Racchiusa", "The word held inside a drop of milk, like a label on a bottle. Pacifico, white on azure.", racchiusa, 46, 26, icon_badge, 22),
    ("G · Schizzo", "A swoosh of milk under the word that splashes out into a drop. Leckerli One, a thick, playful script.", splash, 60, 34, icon_splash, 40),
    ("H · Etichetta", "A dairy label: the word framed, with the drop sitting on the frame and breaking it. Fredoka Bold.", etichetta, 52, 30, icon_label, 44),
]

def tile(parent, fn, s, size):
    t = F(parent, f"App icon {size}", layout="horizontal", w=size, h=size, cornerRadius=round(size * 0.23), fill=AZURE, mainAlign="center", crossAlign="center")
    place(t, fn, s * size / 120, TILE, "Mark", pad=0)
    return t

def card(parent, title, note, fn, s_hero, s_dark, ifn, s_icon):
    c = F(parent, title, layout="vertical", gap=26, w=690, padding=34, cornerRadius=28, fill=WHITE, sV="hug", stroke="#DCE4EC", strokeWeight=1)
    hd = F(c, "Header", layout="vertical", gap=6); grow(hd)
    T(hd, title, 24, INTER_B, INK); T(hd, note, 15, INTER_R, MUTED, fill=True, lh=22)
    hero = F(c, "Logo", layout="horizontal", h=220, cornerRadius=20, fill=BG, mainAlign="center", crossAlign="center", sV="fixed"); grow(hero)
    place(hero, fn, s_hero, LIGHT)
    row = F(c, "Variants", layout="horizontal", gap=18, crossAlign="center"); grow(row)
    tile(row, ifn, s_icon, 120)
    sm = F(row, "Small", layout="vertical", gap=12, crossAlign="center"); tile(sm, ifn, s_icon, 52); tile(sm, ifn, s_icon, 26)
    dark = F(row, "On dark", layout="horizontal", h=120, cornerRadius=20, fill=INK, mainAlign="center", crossAlign="center", sV="fixed"); grow(dark)
    place(dark, fn, s_dark, DARK)

def main():
    for f in ["inter/400Regular/Inter_400Regular", "inter/700Bold/Inter_700Bold"]:
        S("text.loadFont", {"path": f"{FD}/{f}.ttf"}, ref=False)
    S("page.rename", {"name": "Wordmarks"}, ref=False)
    b = F(None, "Latte · wordmarks in blue", layout="vertical", gap=28, w=1500, x=0, y=0, padding=48, fill=BG, sV="hug")
    h = F(b, "Header", layout="vertical", gap=8)
    T(h, "Latte · wordmarks in blue", 38, INTER_B, INK)
    T(h, "The drop closes or surrounds the word. Azure drop, navy letters; each concept has its own display font, the app keeps Inter.", 17, INTER_R, MUTED)
    g = F(b, "Grid", layout="horizontal", gap=24, wrap=True, crossGap=24); grow(g)
    for cpt in CONCEPTS: card(g, *cpt)
    for st in steps: print(json.dumps(st, ensure_ascii=False))

if __name__ == "__main__": main()

#!/usr/bin/env python3
"""Latte in Pacifico with the letter counters (a, t, t, e) turned into real drops; no outer drop.
Usage: python3 build_latte_counters.py <fonts-node_modules> > logo.jsonl"""
import math, json
import build_latte_wordmarks as W
from build_latte_wordmarks import F, T, S, grow, INTER_B, INTER_R, AZURE, NAVY, SKY, BG, MUTED, WHITE, INK
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.areaPen import AreaPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

# Unit drop: round bottom of radius 1 centred at (0,0), tip at (0,-2.3).
K = 0.5523
UNIT = [("M", [(0, -2.3)]), ("C", [(0.12, -1.75), (1, -0.95), (1, 0)]), ("C", [(1, K), (K, 1), (0, 1)]),
        ("C", [(-K, 1), (-1, K), (-1, 0)]), ("C", [(-1, -0.95), (-0.12, -1.75), (0, -2.3)])]
def drop_path(cx, cy, half_w, half_len, ang):
    """Drop whose extent along its axis is 2*half_len, centred at (cx, cy); ang = tilt from vertical (rad, + leans right)."""
    sy = 2 * half_len / 3.3; sx = half_w
    mid = (-2.3 + 1) / 2  # axis midpoint in unit coords
    ca, sa = math.cos(ang), math.sin(ang)
    def P(x, y):
        x, y = x * sx, (y - mid) * sy
        return f"{cx + x * ca - y * sa:.2f} {cy + x * sa + y * ca:.2f}"
    return " ".join(op + " ".join(P(*p) for p in pts) for op, pts in UNIT) + " Z"

def contours(glyph, gs):
    rp = RecordingPen(); glyph.draw(rp); out, cur = [], []
    for op, a in rp.value:
        cur.append((op, a))
        if op in ("closePath", "endPath"): out.append(cur); cur = []
    return out

# Hand-placed in glyph units (Pacifico, 1000 upm): drop = (round centre, radius, tip).
DROPS = {"a": ("goccia", (226, 184), 88, (0.2, 0.98)), "e": ((222, 316), 46, (162, 226), 0), }
# Reflections: quadratic strokes (start, control, end) along the thick parts of each letter.
SHINES = {
    "L": [((236, 650), (282, 768), (384, 800)), ((214, 470), (205, 400), (196, 320)), ((6, 96), (22, 150), (72, 172))],
    "a": [((82, 120), (82, 330), (214, 410))],
    "t": [((128, 390), (120, 300), (128, 190)), ((150, 560), (175, 700), (240, 790))],
    "e": [((62, 140), (48, 330), (176, 404))],
}

def word(text, size, x0, base, holes, scale=1.0, shine=False, track=0.0, drop_shine_on=False):
    """Returns (outer_path, [drop paths], [shine paths], stroke width, bounds)."""
    f = W.font("pacifico"); gs = f.getGlyphSet(); cmap = f.getBestCmap(); k = size / 1000; x = x0
    outer, drops, shines, dshines = [], [], [], []; xs, ys = [], []
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]; cs = contours(gs[g], gs)
        areas = []
        for c in cs:
            ap = AreaPen()
            for op, a in c: getattr(ap, op)(*a)
            areas.append(ap.value)
        main_sign = math.copysign(1, max(areas, key=abs))
        tf = lambda p, x=x: (x + p[0] * k, base - p[1] * k)
        for c, ar in zip(cs, areas):
            if math.copysign(1, ar) != main_sign and i in holes and ch in DROPS: continue
            pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}"); tp = TransformPen(pen, (k, 0, 0, -k, x, base))
            for op, a in c: getattr(tp, op)(*a)
            outer.append(pen.getCommands())
            pts = [tf(p) for op, a in c for p in a]; xs += [p[0] for p in pts]; ys += [p[1] for p in pts]
        if i in holes and ch in DROPS:
            spec = DROPS[ch]
            if spec[0] == "goccia":
                _, cc, r, (dx, dy) = spec; c0, rr, dd = tf(cc), r * k * scale, (dx, -dy)
                drops.append(goccia_from(c0, rr, dd))
            else:
                cc, r, tip, soft = spec; c0, rr = tf(cc), r * k * scale; t0 = tf(tip); dd = (t0[0] - c0[0], t0[1] - c0[1])
                drops.append(drop_from(c0, rr, t0, soft))
            if drop_shine_on and ch == "a": dshines.append(drop_shine(c0, rr, dd))
        if shine:
            for a, b, c2 in SHINES.get(ch, []):
                pa, pb, pc = tf(a), tf(b), tf(c2)
                shines.append(f"M{pa[0]:.2f} {pa[1]:.2f} Q{pb[0]:.2f} {pb[1]:.2f} {pc[0]:.2f} {pc[1]:.2f}")
        x += f["hmtx"][g][0] * k + track * size
    return " ".join(outer), drops, shines, 20 * k, (min(xs), min(ys), max(xs), max(ys)), dshines

from fontTools.pens.basePen import BasePen
class Flat(BasePen):
    def __init__(s, tf): super().__init__(None); s.pts = []; s.tf = tf; s.cur = None
    def _moveTo(s, p): s.cur = p; s.pts.append(s.tf(p))
    def _lineTo(s, p): s.cur = p; s.pts.append(s.tf(p))
    def _qCurveToOne(s, c, p):
        a = s.cur
        for i in range(1, 9):
            t = i / 8; s.pts.append(s.tf(((1-t)**2*a[0] + 2*(1-t)*t*c[0] + t*t*p[0], (1-t)**2*a[1] + 2*(1-t)*t*c[1] + t*t*p[1])))
        s.cur = p
    def _curveToOne(s, c1, c2, p):
        a = s.cur
        for i in range(1, 9):
            t = i / 8; u = 1 - t
            s.pts.append(s.tf((u**3*a[0] + 3*u*u*t*c1[0] + 3*u*t*t*c2[0] + t**3*p[0], u**3*a[1] + 3*u*u*t*c1[1] + 3*u*t*t*c2[1] + t**3*p[1])))
        s.cur = p
    def _closePath(s): pass

def drop_shine(c, r, dirn, side=-1):
    """The original drop's reflection: a short curve inside the round end, on the far side from the tip."""
    L = math.hypot(*dirn); ux, uy = dirn[0] / L, dirn[1] / L; nx, ny = -uy, ux; q = r / 21
    P = lambda a, b: f"{c[0] + (ux * a + nx * b):.2f} {c[1] + (uy * a + ny * b):.2f}"
    return f"M{P(0, side * 10.5 * q)} Q{P(-9.5 * q, side * 10 * q)} {P(-10 * q, side * 3 * q)}", 4.5 * q

def goccia_from(c, r, dirn):
    L = math.hypot(*dirn); ux, uy = dirn[0] / L, dirn[1] / L; nx, ny = -uy, ux; q = r / 21; k = 0.5523 * r
    P = lambda a, b: f"{c[0] + (ux * a + nx * b):.2f} {c[1] + (uy * a + ny * b):.2f}"
    a = lambda v: v * q
    return (f"M{P(a(37), 0)} C{P(a(37), 0)} {P(a(12), -r)} {P(0, -r)} C{P(-k, -r)} {P(-r, -k)} {P(-r, 0)} "
            f"C{P(-r, k)} {P(-k, r)} {P(0, r)} C{P(a(12), r)} {P(a(37), 0)} {P(a(37), 0)} Z")

def drop_from(c, r, tip, soft=0.0):
    """Drop with a round end of radius r at c and its point at tip."""
    dx, dy = tip[0] - c[0], tip[1] - c[1]; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    def P(a, b):  # a along the axis (towards tip), b across
        return f"{c[0] + ux * a + nx * b:.2f} {c[1] + uy * a + ny * b:.2f}"
    k = 0.5523 * r; t = L
    if soft:  # rounded tip: leave the point perpendicular to the axis
        return (f"M{P(t, 0)} C{P(t, r * soft)} {P(r * 1.15, r * 1.0)} {P(0, r)} "
                f"C{P(-k, r)} {P(-r, k)} {P(-r, 0)} C{P(-r, -k)} {P(-k, -r)} {P(0, -r)} "
                f"C{P(r * 1.15, -r * 1.0)} {P(t, -r * soft)} {P(t, 0)} Z")
    return (f"M{P(t, 0)} C{P(t - 0.25 * (t - r * 0.4), r * 0.12)} {P(r * 0.9, r * 1.0)} {P(0, r)} "
            f"C{P(-k, r)} {P(-r, k)} {P(-r, 0)} C{P(-r, -k)} {P(-k, -r)} {P(0, -r)} "
            f"C{P(r * 0.9, -r * 1.0)} {P(t - 0.25 * (t - r * 0.4), -r * 0.12)} {P(t, 0)} Z")

def place(parent, text, size, fg, bg, holes, scale, shine=False, hl=WHITE, name="Wordmark", pad=6, dshine=False):
    b = word(text, size, 0, 0, holes, scale, shine)[4]
    o, ds, sh, sw, _, dsh = word(text, size, -b[0] + pad, -b[1] + pad, holes, scale, shine, drop_shine_on=dshine)
    fr = F(parent, name, w=round(b[2] - b[0] + 2 * pad), h=round(b[3] - b[1] + 2 * pad))
    V = lambda d, props: S("node.create", {"type": "vector", "parent": fr, "x": 0, "y": 0, "path": d, "select": False, "props": props}, ref=False)
    V(o, {"fill": fg, "stroke": None})
    for d in ds: V(d, {"fill": bg, "stroke": None})
    for d in sh: V(d, {"fill": None, "stroke": hl, "strokeWeight": round(sw, 2), "strokeCap": "round", "opacity": 0.9})
    for d, w in dsh: V(d, {"fill": None, "stroke": fg, "strokeWeight": round(w, 2), "strokeCap": "round"})
    return fr

ALL = {1, 2, 3, 4}
CONCEPTS = [
    ("Latte · logo", "Pacifico, navy and azure. The a holds the fat drop from the original F logo, with its reflection; the e keeps a small drop; the t loops stay as Pacifico draws them.", {1, 4}, True),
]

def tile(parent, text, s, holes, shine, size):
    t = F(parent, f"App icon {size}", layout="horizontal", w=size, h=size, cornerRadius=round(size * 0.23), fill=AZURE, mainAlign="center", crossAlign="center")
    place(t, text, s * size / 120, WHITE, AZURE, holes, 1.0, False, AZURE, name="Mark", pad=0, dshine=shine)

def card(parent, title, note, holes, shine):
    c = F(parent, title, layout="vertical", gap=26, w=1404, padding=34, cornerRadius=28, fill=WHITE, sV="hug", stroke="#DCE4EC", strokeWeight=1)
    hd = F(c, "Header", layout="vertical", gap=6); grow(hd)
    T(hd, title, 24, INTER_B, INK); T(hd, note, 15, INTER_R, MUTED, fill=True, lh=22)
    row = F(c, "Row", layout="horizontal", gap=18, crossAlign="center"); grow(row)
    hero = F(row, "On light", layout="horizontal", h=230, cornerRadius=20, fill=BG, mainAlign="center", crossAlign="center", sV="fixed"); grow(hero)
    place(hero, "Latte", 118, NAVY, BG, holes, 1.0, False, WHITE, dshine=shine)
    blue = F(row, "On azure", layout="horizontal", h=230, cornerRadius=20, fill=AZURE, mainAlign="center", crossAlign="center", sV="fixed"); grow(blue)
    place(blue, "Latte", 104, WHITE, AZURE, holes, 1.0, False, AZURE, dshine=shine)
    dark = F(row, "On dark", layout="horizontal", h=230, cornerRadius=20, fill=INK, mainAlign="center", crossAlign="center", sV="fixed"); grow(dark)
    place(dark, "Latte", 80, WHITE, INK, holes, 1.0, False, INK, dshine=shine)
    icons = F(row, "Icons", layout="vertical", gap=14, crossAlign="center")
    tile(icons, "a", 150, {0}, shine, 120)
    sm = F(icons, "Small", layout="horizontal", gap=12, crossAlign="center"); tile(sm, "a", 150, {0}, shine, 52); tile(sm, "a", 150, {0}, shine, 26)

def main():
    for f in ["inter/400Regular/Inter_400Regular", "inter/700Bold/Inter_700Bold"]:
        S("text.loadFont", {"path": f"{W.FD}/{f}.ttf"}, ref=False)
    S("page.rename", {"name": "Racchiusa"}, ref=False)
    b = F(None, "Latte · logo", layout="vertical", gap=24, w=1500, x=0, y=0, padding=48, fill=BG, sV="hug")
    h = F(b, "Header", layout="vertical", gap=8)
    T(h, "Latte · logo", 38, INTER_B, INK)
    T(h, "From F · Racchiusa: the drop moved inside the letters. Light, blue and dark versions, plus the app icon.", 17, INTER_R, MUTED)
    for cpt in CONCEPTS: card(b, *cpt)
    for st in W.steps: print(json.dumps(st, ensure_ascii=False))

if __name__ == "__main__": main()

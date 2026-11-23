#!/usr/bin/python3
"""Dump the real board geometry from dual_laser_pbm.kicad_pcb to JSON for the 3D viewer.

    /usr/bin/python3 export_viewer_data.py            -> viewer/board.json

Coordinates are board-local millimetres (origin = top-left corner of the board,
+x right, +y down as in KiCad), rounded to 0.01 mm. Zone and silkscreen polygons are
simplified (Douglas-Peucker: zones 0.04 mm, silk 0.01 mm) to keep the file small.
"""
import json
import math
import os
import sys

import pcbnew

HERE = os.path.dirname(os.path.abspath(__file__))
PCB = os.path.join(HERE, "dual_laser_pbm.kicad_pcb")
OUT = os.path.join(HERE, "viewer", "board.json")
OX, OY = 100.0, 100.0
TOL = 0.04   # zone simplification (copper under mask, visual only)

def r2(v):
    return round(v, 2)

def xy(v):
    return [r2(pcbnew.ToMM(v.x) - OX), r2(pcbnew.ToMM(v.y) - OY)]

def dp(pts, tol):
    """Douglas-Peucker for a closed ring given as list of [x, y]."""
    if len(pts) < 5:
        return pts
    def rec(a, b):
        ax, ay = pts[a]; bx, by = pts[b]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy) or 1e-9
        best, bi = -1.0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            d = abs(dy * (px - ax) - dx * (py - ay)) / L
            if d > best:
                best, bi = d, i
        if best > tol:
            return rec(a, bi)[:-1] + rec(bi, b)
        return [pts[a], pts[b]]
    # split ring at the point farthest from the first
    far = max(range(len(pts)), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    out = rec(0, far)[:-1] + rec(far, len(pts) - 1)
    return out[:-1] if out[0] == out[-1] else out

def chain_pts(ch):
    return [xy(ch.CPoint(i)) for i in range(ch.PointCount())]

def polyset(ps, tol=TOL):
    out = []
    for i in range(ps.OutlineCount()):
        rings = [dp(chain_pts(ps.Outline(i)), tol)]
        for j in range(ps.HoleCount(i)):
            rings.append(dp(chain_pts(ps.Hole(i, j)), tol))
        out.append([[c for p in r for c in p] for r in rings])   # flat [x0,y0,x1,y1,...]
    return out

def strokes(shape, width, segs, fills):
    """Flatten a KiCad SHAPE (compound/segment/arc/circle/simple) into strokes and filled polys."""
    c = shape.Cast() if hasattr(shape, "Cast") else shape
    name = type(c).__name__
    if name == "SHAPE_COMPOUND":
        for sub in c.GetSubshapes():
            strokes(sub, width, segs, fills)
    elif name == "SHAPE_SEGMENT":
        sg = c.GetSeg()
        segs.append(xy(sg.A) + xy(sg.B) + [r2(pcbnew.ToMM(c.GetWidth()) or width)])
    elif name == "SHAPE_ARC":
        w = r2(pcbnew.ToMM(c.GetWidth()) or width)
        ch = c.ConvertToPolyline(pcbnew.FromMM(0.02))
        pts = chain_pts(ch)
        for p, q in zip(pts, pts[1:]):
            segs.append(p + q + [w])
    elif name == "SHAPE_CIRCLE":
        cx, cy = xy(c.GetCenter()); rr = pcbnew.ToMM(c.GetRadius())
        n = max(16, int(rr * 12))
        pts = [[r2(cx + rr * math.cos(2 * math.pi * k / n)), r2(cy + rr * math.sin(2 * math.pi * k / n))] for k in range(n + 1)]
        for p, q in zip(pts, pts[1:]):
            segs.append(p + q + [width])
    elif name in ("SHAPE_SIMPLE", "SHAPE_LINE_CHAIN"):
        ch = c.Vertices() if name == "SHAPE_SIMPLE" else c
        pts = chain_pts(ch)
        fills.append([v for p in pts for v in p])
    elif name == "SHAPE_RECT":
        o = xy(c.GetPosition()); w, h = pcbnew.ToMM(c.GetWidth()), pcbnew.ToMM(c.GetHeight())
        fills.append([o[0], o[1], r2(o[0] + w), o[1], r2(o[0] + w), r2(o[1] + h), o[0], r2(o[1] + h)])
    else:
        print("  unhandled silk shape", name, file=sys.stderr)

def item_width(it):
    try:
        return r2(pcbnew.ToMM(it.GetWidth()))
    except Exception:
        return 0.12

LIBTYPE = [
    ("USB_C", "usbc"), ("SOIC-8", "soic8"), ("TSSOP-20", "tssop20"), ("SOT-23-5", "sot23_5"),
    ("SOT-23", "sot23"), ("R_1206", "chip1206"), ("C_1206", "chip1206"), ("Fuse_1206", "chip1206"),
    ("C_0805", "chip0805"), ("R_0603", "chip0603"), ("C_0603", "chip0603"), ("LED_0603", "led0603"),
    ("D_SOD-323", "sod323"), ("D_SOD-123F", "sod123f"), ("TL3342", "tact"), ("JST_PH", "jst_ph2"),
    ("PinHeader_1x05", "header1x5"), ("LaserDiode_TO56", "to56"), ("TestPoint", "testpoint"),
    ("Fiducial", "fiducial"), ("MountingHole", "mhole"),
]

def main():
    b = pcbnew.LoadBoard(PCB)
    nets = sorted({n for n in (t.GetNetname() for t in b.GetTracks()) if n} |
                  {p.GetNetname() for fp in b.GetFootprints() for p in fp.Pads() if p.GetNetname()})
    nidx = {n: i for i, n in enumerate(nets)}
    ni = lambda n: nidx.get(n, -1)

    # outline: chain the Edge.Cuts shapes into one polygon
    eps = pcbnew.SHAPE_POLY_SET()
    b.GetBoardPolygonOutlines(eps)
    outline = polyset(eps, 0.005)[0][0]

    tracks, vias = [], []
    for t in b.GetTracks():
        if t.GetClass() == "PCB_VIA":
            vias.append(xy(t.GetPosition()) + [r2(pcbnew.ToMM(t.GetWidth())), r2(pcbnew.ToMM(t.GetDrillValue())), ni(t.GetNetname())])
        else:
            tracks.append(xy(t.GetStart()) + xy(t.GetEnd()) +
                          [r2(pcbnew.ToMM(t.GetWidth())), 0 if t.GetLayer() == pcbnew.F_Cu else 1, ni(t.GetNetname())])

    pads, fps = [], []
    shapes = {pcbnew.PAD_SHAPE_CIRCLE: "circle", pcbnew.PAD_SHAPE_OVAL: "oval",
              pcbnew.PAD_SHAPE_RECT: "rect", pcbnew.PAD_SHAPE_ROUNDRECT: "roundrect"}
    for fp in b.GetFootprints():
        ref = fp.GetReference()
        lib = fp.GetFPID().GetUniStringLibItemName()
        typ = next((t for k, t in LIBTYPE if k in lib), "other")
        fp.BuildCourtyardCaches()
        cy = fp.GetCourtyard(pcbnew.F_CrtYd)
        bb = cy.BBox() if cy.OutlineCount() else fp.GetBoundingBox(False, False)
        fps.append({
            "ref": ref, "value": fp.GetValue(), "type": typ, "lib": fp.GetFPID().GetUniStringLibId(),
            "x": xy(fp.GetPosition())[0], "y": xy(fp.GetPosition())[1],
            "rot": r2(fp.GetOrientationDegrees()),
            "side": "B" if fp.IsFlipped() else "F",
            "bbox": xy(bb.GetOrigin()) + xy(bb.GetEnd()),
            "purpose": fp.GetProperty("Purpose") if fp.HasProperty("Purpose") else "",
        })
        for p in fp.Pads():
            sz = p.GetSize()
            tht = p.GetAttribute() in (pcbnew.PAD_ATTRIB_PTH, pcbnew.PAD_ATTRIB_NPTH)
            pads.append([ref, p.GetNumber()] + xy(p.GetPosition()) +
                        [r2(pcbnew.ToMM(sz.x)), r2(pcbnew.ToMM(sz.y)), r2(p.GetOrientationDegrees()),
                         shapes.get(p.GetShape(), "rect"),
                         "FB" if tht else ("F" if p.IsOnLayer(pcbnew.F_Cu) else "B"),
                         r2(pcbnew.ToMM(p.GetDrillSizeX())) if tht else 0,
                         r2(pcbnew.ToMM(p.GetDrillSizeY())) if tht else 0,
                         ni(p.GetNetname()),
                         1 if p.GetAttribute() == pcbnew.PAD_ATTRIB_NPTH else 0])

    zones = {"F": [], "B": []}
    for z in b.Zones():
        for L, key in ((pcbnew.F_Cu, "F"), (pcbnew.B_Cu, "B")):
            if z.IsOnLayer(L):
                zones[key] += polyset(z.GetFilledPolysList(L))

    silk = {"F": {"s": [], "p": []}, "B": {"s": [], "p": []}}
    for L, key in ((pcbnew.F_SilkS, "F"), (pcbnew.B_SilkS, "B")):
        S, F = silk[key]["s"], silk[key]["p"]
        for d in b.GetDrawings():
            if d.GetLayer() == L:
                if d.GetClass() == "PCB_TEXT":
                    strokes(d.GetEffectiveTextShape(), 0.15, S, F)
                else:
                    strokes(d.GetEffectiveShape(), item_width(d), S, F)
        for fp in b.GetFootprints():
            for g in fp.GraphicalItems():
                if g.GetLayer() != L:
                    continue
                if g.GetClass() == "FP_TEXT":
                    if g.IsVisible():
                        strokes(g.GetEffectiveTextShape(), 0.15, S, F)
                else:
                    strokes(g.GetEffectiveShape(), item_width(g), S, F)
            for t in (fp.Reference(), fp.Value()):
                if t.GetLayer() == L and t.IsVisible():
                    strokes(t.GetEffectiveTextShape(), 0.15, S, F)

    # chain strokes that share endpoints into polylines: [w, x0, y0, x1, y1, ...]
    for key in ("F", "B"):
        segs = silk[key]["s"]
        lines = []
        for x1, y1, x2, y2, w in segs:
            if lines and lines[-1][0] == w and lines[-1][-2:] == [x1, y1]:
                lines[-1] += [x2, y2]
            else:
                lines.append([w, x1, y1, x2, y2])
        silk[key]["s"] = lines

    data = {
        "name": "dual_laser_pbm", "units": "mm", "mock": True,
        "board": {"w": 58.0, "h": 38.0, "thickness": 1.6, "outline": outline},
        "nets": nets, "tracks": tracks, "vias": vias, "pads": pads,
        "zones": zones, "silk": silk, "footprints": fps,
        "padFields": ["ref", "num", "x", "y", "w", "h", "rot", "shape", "layers", "drillX", "drillY", "net", "npth"],
        "trackFields": ["x1", "y1", "x2", "y2", "w", "layer(0=F,1=B)", "net"],
        "viaFields": ["x", "y", "d", "drill", "net"],
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    s = json.dumps(data, separators=(",", ":"))
    open(OUT, "w").write(s)
    print(f"wrote {OUT}: {len(s)/1024:.1f} KB  tracks={len(tracks)} vias={len(vias)} pads={len(pads)} "
          f"zones F/B={len(zones['F'])}/{len(zones['B'])} silk strokes F/B={len(silk['F']['s'])}/{len(silk['B']['s'])} nets={len(nets)}")
    for k in ("tracks", "pads", "zones", "silk", "footprints"):
        print(f"   {k}: {len(json.dumps(data[k], separators=(',', ':')))/1024:.1f} KB")

if __name__ == "__main__":
    main()

#!/usr/bin/python3
"""Realistic top/bottom 2D renders (SVG + PNG) from viewer/board.json.

    /usr/bin/python3 render_2d.py      -> renders/board-top.{svg,png}, renders/board-bottom.{svg,png}

Uses the exact geometry exported from the KiCad board (export_viewer_data.py):
green solder mask over copper (copper shows as lighter green), ENIG pads, white silk.
PNG conversion needs rsvg-convert (librsvg2-bin).
"""
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
D = json.load(open(os.path.join(HERE, "viewer", "board.json")))
OUT = os.path.join(HERE, "renders")
os.makedirs(OUT, exist_ok=True)

C = dict(bg="#15181b", fr4="#1e5a36", cu="#3d8c55", pad="#d8b25a", hole="#0d0f10",
         silk="#f2f2ea", via="#4a9a62", edge="#0f2a19")
M = 2.0  # margin mm

def pts(flat):
    return " ".join(f"{flat[i]:.2f},{flat[i+1]:.2f}" for i in range(0, len(flat), 2))

def path_rings(rings):
    d = ""
    for r in rings:
        d += "M" + " L".join(f"{r[i]:.2f},{r[i+1]:.2f}" for i in range(0, len(r), 2)) + "Z"
    return d

def pad_svg(p, fill):
    ref, num, x, y, w, h, rot, shape, layers, dx, dy, net, npth = p
    if npth:
        return ""
    if shape == "circle":
        return f'<circle cx="{x}" cy="{y}" r="{w/2}" fill="{fill}"/>'
    rx = min(w, h) / 2 if shape == "oval" else (min(w, h) * 0.25 if shape == "roundrect" else 0)
    return (f'<rect x="{-w/2}" y="{-h/2}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" '
            f'transform="translate({x} {y}) rotate({-rot})"/>')

def hole_svg(p):
    ref, num, x, y, w, h, rot, shape, layers, dx, dy, net, npth = p
    if not dx:
        return ""
    if abs(dx - dy) < 1e-3:
        return f'<circle cx="{x}" cy="{y}" r="{dx/2}" fill="{C["hole"]}"/>'
    a, b = max(dx, dy), min(dx, dy)
    return (f'<rect x="{-dx/2}" y="{-dy/2}" width="{dx}" height="{dy}" rx="{b/2}" fill="{C["hole"]}" '
            f'transform="translate({x} {y}) rotate({-rot})"/>')

def render(side):
    W, H = D["board"]["w"], D["board"]["h"]
    L = 0 if side == "F" else 1
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{-M} {-M} {W+2*M} {H+2*M}" '
           f'width="{(W+2*M)*40}" height="{(H+2*M)*40}">',
           f'<rect x="{-M}" y="{-M}" width="{W+2*M}" height="{H+2*M}" fill="{C["bg"]}"/>']
    g = f'<g transform="translate({W} 0) scale(-1 1)">' if side == "B" else "<g>"
    out.append(g)
    out.append(f'<polygon points="{pts(D["board"]["outline"])}" fill="{C["fr4"]}" stroke="{C["edge"]}" stroke-width="0.1"/>')
    for poly in D["zones"][side]:
        out.append(f'<path d="{path_rings(poly)}" fill="{C["cu"]}" fill-rule="evenodd"/>')
    for x1, y1, x2, y2, w, layer, net in D["tracks"]:
        if layer == L:
            out.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{C["cu"]}" stroke-width="{w}" stroke-linecap="round"/>')
    for x, y, d, dr, net in D["vias"]:
        out.append(f'<circle cx="{x}" cy="{y}" r="{d/2}" fill="{C["via"]}"/>')
    # silk first, then pads on top (silk is clipped by mask openings in the Gerbers)
    for line in D["silk"][side]["s"]:
        w = line[0]
        out.append(f'<polyline points="{pts(line[1:])}" fill="none" stroke="{C["silk"]}" stroke-width="{w}" '
                   f'stroke-linecap="round" stroke-linejoin="round"/>')
    for f in D["silk"][side]["p"]:
        out.append(f'<polygon points="{pts(f)}" fill="{C["silk"]}"/>')
    for p in D["pads"]:
        if side in p[8]:
            out.append(pad_svg(p, C["pad"]))
    for p in D["pads"]:
        out.append(hole_svg(p))
    for x, y, d, dr, net in D["vias"]:
        out.append(f'<circle cx="{x}" cy="{y}" r="{dr/2}" fill="{C["hole"]}"/>')
    out.append("</g></svg>")
    name = os.path.join(OUT, f"board-{'top' if side == 'F' else 'bottom'}")
    open(name + ".svg", "w").write("\n".join(out))
    subprocess.run(["rsvg-convert", "-w", "2400", name + ".svg", "-o", name + ".png"], check=True)
    print("wrote", name + ".svg/.png")

render("F")
render("B")

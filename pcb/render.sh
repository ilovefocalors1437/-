#!/bin/sh
# Raw KiCad (kicad-cli) SVG plots of each side, for reference next to the styled renders.
# Note: kicad-cli 7 draws B.SilkS beneath the B.Cu pour in the bottom plot, so the bottom
# silkscreen is better checked in renders/board-bottom.png (render_2d.py) or the Gerber.
set -e
cd "$(dirname "$0")"
OUT=${1:-renders}
mkdir -p "$OUT"
PCB=dual_laser_pbm.kicad_pcb
kicad-cli pcb export svg --exclude-drawing-sheet --page-size-mode 2 \
  -l F.Cu,F.Mask,F.SilkS,Edge.Cuts -o "$OUT/kicad-top.svg" "$PCB" >/dev/null
kicad-cli pcb export svg --exclude-drawing-sheet --page-size-mode 2 --mirror \
  -l B.Cu,B.Mask,B.SilkS,Edge.Cuts -o "$OUT/kicad-bottom.svg" "$PCB" >/dev/null
rsvg-convert -w 2400 -b '#ffffff' "$OUT/kicad-top.svg" -o "$OUT/kicad-top.png"
echo "kicad-cli plots in $OUT"

#!/bin/sh
# Export 2D renders (SVG -> PNG) of the board, top and bottom.
# Usage: ./render.sh [outdir]   (default: renders/)
set -e
cd "$(dirname "$0")"
OUT=${1:-renders}
mkdir -p "$OUT"
PCB=dual_laser_pbm.kicad_pcb
kicad-cli pcb export svg --exclude-drawing-sheet --page-size-mode 2 \
  -l F.Cu,F.Mask,F.SilkS,Edge.Cuts,F.Fab -o "$OUT/board-top.svg" "$PCB" >/dev/null
kicad-cli pcb export svg --exclude-drawing-sheet --page-size-mode 2 --mirror \
  -l B.Cu,B.Mask,B.SilkS,Edge.Cuts -o "$OUT/board-bottom.svg" "$PCB" >/dev/null
for s in top bottom; do
  rsvg-convert -w 2400 -b '#ffffff' "$OUT/board-$s.svg" -o "$OUT/board-$s.png"
done
echo "renders in $OUT"

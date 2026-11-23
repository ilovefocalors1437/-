#!/bin/sh
# Gerbers + Excellon drill + pick-and-place for dual_laser_pbm.kicad_pcb (KiCad 7 kicad-cli)
set -e
cd "$(dirname "$0")"
rm -rf fab && mkdir -p fab
PCB=dual_laser_pbm.kicad_pcb
kicad-cli pcb export gerbers --subtract-soldermask --no-x2 \
  -l F.Cu,B.Cu,F.Mask,B.Mask,F.SilkS,B.SilkS,F.Paste,B.Paste,Edge.Cuts -o fab/ "$PCB"
kicad-cli pcb export drill --format excellon --excellon-units mm --generate-map --map-format gerberx2 -o fab/ "$PCB"
kicad-cli pcb export pos --format csv --units mm --side both -o fab/dual_laser_pbm-pos.csv "$PCB"
ls -l fab

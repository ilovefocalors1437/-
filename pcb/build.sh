#!/bin/sh
# Full rebuild: board -> DRC -> fab outputs -> viewer data -> 2D renders.
set -e
cd "$(dirname "$0")"
/usr/bin/python3 generate_board.py
./export_fab.sh
/usr/bin/python3 export_viewer_data.py
/usr/bin/python3 render_2d.py
./render.sh

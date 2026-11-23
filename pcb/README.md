# Dual-laser PBM head, REV 0.1 MOCK

This is a **mock reconstruction**. It stands in for the original design file, which is on another laptop. The schematic is not known, so this is a plausible, electrically sensible board built from scratch. It is not a copy of the original and may differ from it in every detail. The silkscreen says `REV 0.1 MOCK` on both sides.

It is a 2-layer KiCad 7 board for a photobiomodulation head with two laser diodes aimed at the foot fascia:

- **LD1, 660 nm (red):** the shallower channel. Design intent: help local blood flow.
- **LD2, 850 nm (near-IR):** the deeper channel, aimed at the fascia itself. Design intent: help loosen the hyaluronan (HA) layer in densified fascia.

Both are the user's design intent, not established clinical effects.

## Files

| Path | What |
|---|---|
| `dual_laser_pbm.kicad_pcb`, `.kicad_pro` | The board (KiCad 7.0). There is no schematic file; nets are assigned in the script. |
| `generate_board.py` | Builds the board with the pcbnew API: placement table, a small grid A* router with rip-up/retry, GND pours, stitching vias, silkscreen, DRC. |
| `drc_report.txt` | KiCad DRC output for the generated board. |
| `fab/` | Gerbers (F/B Cu, mask, silk, paste, Edge.Cuts), Excellon drill + drill map, pick-and-place CSV. |
| `renders/board-top.png`, `board-bottom.png` (+ `.svg`) | 2D renders from the real geometry (bottom is mirrored, as seen from below). |
| `renders/kicad-top.*`, `kicad-bottom.svg` | Raw `kicad-cli` SVG plots for reference. kicad-cli 7 draws bottom silk under the pour, so use `board-bottom.png` or the Gerber for bottom silk. |
| `export_viewer_data.py` → `viewer/board.json` | Board geometry for the 3D viewer: outline, drills, tracks, vias, pads, filled zones, silk, footprints. |
| `viewer/dual-laser-3d.html` | Interactive three.js viewer. Loads `board.json` from the same folder. |
| `renders/viewer-*.png` | Viewer screenshots (desktop and phone, light and dark, lasers on, bottom, net highlight, exploded). |

## Regenerate

Needs Ubuntu 24.04 with `kicad` 7.0.x, `kicad-footprints` and `librsvg2-bin`, and the system Python (`/usr/bin/python3`, which has `pcbnew`).

```sh
./build.sh     # board + DRC, fab outputs, viewer/board.json, 2D renders
```

The router is deterministic (the script pins `PYTHONHASHSEED`), so a rebuild gives the same geometry. Item UUIDs in the `.kicad_pcb` differ between runs. For the DRC footprint-vs-library check, KiCad needs a global `fp-lib-table` (copy `/usr/share/kicad/template/fp-lib-table` to `~/.config/kicad/7.0/`).

## Blocks

- **Power in:** J1 USB-C 6-pin power-only receptacle, R1/R2 5.1 k CC pull-downs, F1 500 mA PTC, D1 SMF5.0A TVS, C1 22 µF → +5V. U1 AP2112K-3.3 LDO (C2/C3) → +3V3 for the MCU.
- **MCU:** U2 STM32G030F6P6 (TSSOP-20), C4/C5 decoupling, C6 on NRST. J3 1×5 2.54 mm SWD header (3V3, SWCLK, GND, SWDIO, NRST). SW1 button on PA0. Status LEDs: D2 power (on +3V3), D3 660 active (PA2), D4 850 active (PA3).
- **Laser rail switch and interlock:** Q1 AO3401A P-FET switches +5V → VLD. R6 holds it off. Q2 2N7002 pulls Q1's gate down, but Q2's source only reaches GND through the J2 interlock loop, so VLD needs **MCU LASER_EN (PA12) AND a closed loop**. R7 keeps LASER_EN low during reset. The MCU reads the loop on PA11 (internal pull-up). D5 amber LED + R9 hang off VLD itself, so it is lit whenever the laser supply is live, whatever the firmware does. C7 10 µF on VLD.
- **Two constant-current channels** (ch1 = LD1, ch2 = LD2), one half of U3 MCP6002 each:
  MCU PWM (PA7 / PA6, TIM3) → 10 k / 1 k divider + 1 µF filter (R14/R15/C12, R19/R20/C14) → 0–0.30 V setpoint at IN+ → op-amp → 100 Ω gate resistor (R12/R17) → AO3400A sink (Q3/Q4) → 2.2 Ω 1206 sense (R11/R16) fed back to IN− through 1 k (R13/R18), 1 nF compensation from OUT to IN− (C11/C13). Full scale 0.30 V / 2.2 Ω = 136 mA. TP3/TP4 expose the sense voltages.
- **Laser protection:** each diode has a reverse Schottky (D6/D7, BAT60A) and 100 nF (C9/C10) across it.
- **Temperature:** TH1 10 k NTC (0603) between the cans, R10 10 k to +3V3, read on PA5 (ADC).
- **Lasers:** LD1/LD2 TO-56 (5.6 mm) 3-pin cans, KiCad `OptoDevice:LaserDiode_TO56-3`, 14 mm apart on the right edge, with a via-free ring around each can for a lens holder and a ring of GND thermal vias outside it.

## Design choices that differ from the brief

- Board is **58 × 38 mm** (brief: ~56 × 36) to give the router room. 4 × M2.5 plated holes on GND, 3 fiducials, 4 test points.
- The lasers are **14 mm apart** (brief: ~12) so two lens holders and the NTC fit between them.
- **No hardware interlock pull-up resistor.** The MCU's internal pull-up on PA11 does that job. This leaves a gap at R8 in the reference numbering.
- **Monitor photodiode unused:** pin 3 of each TO-56 (PD anode, assumed common-anode pinout) is tied to pin 2, which shorts the PD. Pinouts vary between laser diode vendors. Check the real part.
- Design rules: netclass clearance 0.15 mm, tracks 0.25 mm signal / 0.3 mm +3V3 / 0.6 mm for VBUS, +5V, VLD, LD cathodes and sense nodes, vias 0.6/0.3 mm, copper-to-edge 0.3 mm. The router aims for 0.2 mm, and the board also passes DRC with the clearance raised to 0.2 mm.
- MCU pins: PA0 BTN, PA2 LED_660, PA3 LED_850, PA5 NTC, PA6 PWM_850, PA7 PWM_660, PA11 interlock sense, PA12 LASER_EN, PA13/PA14 SWD. Unused pins (1, 2, 3, 8, 11, 15, 20) have no net, nor does U1 pin 4 (NC).

## Bill of materials

| Ref | Value | Footprint (KiCad 7 library) | Purpose |
|---|---|---|---|
| J1 | USB-C 6P power only | USB_C_Receptacle_GCT_USB4125-xx-x_6P_TopMnt_Horizontal | 5 V input |
| R1, R2 | 5.1k | R_0603_1608Metric | CC pull-downs (USB-C sink) |
| F1 | PTC 500 mA | Fuse_1206_3216Metric | Resettable input fuse |
| D1 | SMF5.0A | D_SOD-123F | TVS on +5V |
| C1 | 22 µF 10 V | C_1206_3216Metric | +5V bulk |
| U1 | AP2112K-3.3 | SOT-23-5 | 3.3 V LDO |
| C2, C3 | 1 µF | C_0603_1608Metric | LDO in/out |
| U2 | STM32G030F6P6 | TSSOP-20_4.4x6.5mm_P0.65mm | MCU |
| C4 / C5 / C6 | 100 nF / 1 µF / 100 nF | C_0603_1608Metric | MCU decoupling, NRST filter |
| J3 | SWD 1×5 | PinHeader_1x05_P2.54mm_Vertical | Programming header |
| SW1 | TL3342 | SW_SPST_TL3342 | Start/stop button |
| D2 / D3 / D4 | green / red / orange | LED_0603_1608Metric | Power / 660 active / 850 active |
| R3, R4, R5 | 1k | R_0603_1608Metric | Status LED resistors |
| Q1 | AO3401A | SOT-23 | High-side laser rail switch |
| R6 | 100k | R_0603_1608Metric | Q1 gate pull-up (off by default) |
| Q2 | 2N7002 | SOT-23 | Enable, sourced through the interlock |
| R7 | 100k | R_0603_1608Metric | LASER_EN pull-down |
| J2 | JST PH 2-pin | JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical | Interlock loop |
| D5 | amber | LED_0603_1608Metric | Emission indicator on VLD |
| R9 | 1k | R_0603_1608Metric | Emission LED resistor |
| C7 | 10 µF | C_0805_2012Metric | VLD reservoir |
| U3 | MCP6002 | SOIC-8_3.9x4.9mm_P1.27mm | Dual op-amp, one loop per channel |
| C8 | 100 nF | C_0603_1608Metric | Op-amp decoupling |
| LD1 | 660 nm laser diode | LaserDiode_TO56-3 | Red channel |
| LD2 | 850 nm laser diode | LaserDiode_TO56-3 | Near-IR channel |
| Q3, Q4 | AO3400A | SOT-23 | Current sinks |
| R11, R16 | 2.2 Ω 1 % | R_1206_3216Metric | Current sense |
| R12, R17 | 100 Ω | R_0603_1608Metric | Gate resistors |
| R13, R18 | 1k | R_0603_1608Metric | Feedback resistors |
| C11, C13 | 1 nF | C_0603_1608Metric | Loop compensation |
| R14, R19 | 10k | R_0603_1608Metric | PWM divider top |
| R15, R20 | 1k | R_0603_1608Metric | PWM divider bottom |
| C12, C14 | 1 µF | C_0603_1608Metric | PWM filter |
| D6, D7 | BAT60A | D_SOD-323 | Reverse Schottky across each diode |
| C9, C10 | 100 nF | C_0603_1608Metric | Cap across each diode |
| TH1 | NTC 10k | R_0603_1608Metric | Temperature between the cans |
| R10 | 10k | R_0603_1608Metric | NTC divider |
| TP1–TP4 | +5V, +3V3, ISENSE1, ISENSE2 | TestPoint_Pad_D1.0mm | Test points |
| FID1–FID3 | | Fiducial_1mm_Mask2mm | Assembly fiducials |
| H1–H4 | M2.5 | MountingHole_2.7mm_M2.5_Pad | Mounting holes (GND) |

55 placed parts plus 4 test points, 3 fiducials and 4 holes (66 footprints).

## Nets (35)

Power: `VBUS` (J1 → F1), `+5V` (11 pads), `+3V3` (9), `VLD` (switched laser rail, 11), `GND` (36 pads; both layers poured and stitched).
Per laser channel n = 1, 2: `PWM_660`/`PWM_850`, `SETn`, `FBn`, `OUTn`, `GATEn`, `ISENSEn`, `LDn_K`.
Control: `LASER_EN`, `VLD_G`, `INTLK_LO`, `NTC_ADC`, `BTN`, `NRST`, `SWDIO`, `SWCLK`, `CC1`, `CC2`, `LED_660`, `LED_850`, `LEDA_PWR`, `LEDA_660`, `LEDA_850`, `LEDA_EMIT`.

Board stats: 539 track segments, 112 vias (routing + GND fanout + stitching), GND zones on F.Cu and B.Cu.

## What was verified, and what was not

Verified:
- KiCad 7 DRC (`pcbnew.WriteDRCReport`, all checks, zones filled): **0 violations, 0 unconnected pads, 0 footprint errors.** Also 0 clearance violations with the netclass clearance raised to 0.2 mm.
- Every net is routed. The connectivity check reports 0 unconnected items.
- Renders checked by eye: parts sit on their pads, there are no overlapping courtyards, and no silk sits on pads.

Not verified:
- No schematic, ERC, SPICE simulation or prototype. Values are textbook choices, not tuned.
- Q3/Q4 dissipate about 0.35 W each at full current from 5 V. That should be within an AO3400A's rating with this copper, but it was not thermally analysed.
- Footprint pinouts are taken from the KiCad libraries. The TO-56 pin assignment (which pin is common, whether the PD is common-anode) depends on the real laser part.
- Routing is machine-made. It is DRC-clean, but some signal runs are longer or more diagonal than a human would draw them, and +5V crosses under U2.
- Firmware does not exist. The PWM, interlock and NTC behaviour described here is what the hardware allows.

## Laser safety

A ~100 mW-class laser diode is Class 3B: direct or mirror-reflected beams can injure the eye. 850 nm is invisible, so there is no blink reflex and no visible cue that it is on. That is why this board has a hardware interlock, a hardware emission LED and current limits. A real device also needs wavelength-rated eyewear for anyone nearby, and a regulatory review (IEC 60825-1, plus medical-device rules if it is used on people) before use.

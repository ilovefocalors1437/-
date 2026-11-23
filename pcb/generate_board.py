#!/usr/bin/python3
"""Generate dual_laser_pbm.kicad_pcb (KiCad 7) from scratch.

MOCK RECONSTRUCTION: a plausible stand-in for a dual 660 nm / 850 nm
photobiomodulation laser head. Not the original design file.

Run with the system Python that has KiCad's pcbnew module:
    /usr/bin/python3 generate_board.py

Everything is deterministic: placement is a fixed table, routing is done by
a small grid A* router in this file, and the result is written as explicit
track/via coordinates into the board file.
"""
import heapq
import math
import os
import sys

import numpy as np

os.environ.setdefault("KICAD7_FOOTPRINT_DIR", "/usr/share/kicad/footprints")
import pcbnew  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "dual_laser_pbm.kicad_pcb")
LIB = "/usr/share/kicad/footprints/"

# ----------------------------------------------------------------- geometry
W, H = 58.0, 38.0          # board size, mm
CORNER_R = 2.0
OX, OY = 100.0, 100.0      # board origin inside the KiCad sheet

def mm(v):
    return pcbnew.FromMM(v)

def P(x, y):
    return pcbnew.VECTOR2I(mm(OX + x), mm(OY + y))

def unP(v):
    return pcbnew.ToMM(v.x) - OX, pcbnew.ToMM(v.y) - OY

# ------------------------------------------------------------- the circuit
# Net names
GND, VBUS, V5, V3, VLD = "GND", "VBUS", "+5V", "+3V3", "VLD"

# Track width per net (mm); anything not listed is 0.25
WIDTH = {
    VBUS: 0.8, V5: 0.6, VLD: 0.6, V3: 0.3,
    "LD1_K": 0.6, "LD2_K": 0.6, "ISENSE1": 0.6, "ISENSE2": 0.6,
}

R0603 = ("Resistor_SMD", "R_0603_1608Metric")
C0603 = ("Capacitor_SMD", "C_0603_1608Metric")
L0603 = ("LED_SMD", "LED_0603_1608Metric")
SOT23 = ("Package_TO_SOT_SMD", "SOT-23")

# (ref, footprint, value, x, y, rot, {pad: net}, purpose)
# LEDs / diodes: pad 1 = cathode, pad 2 = anode.
# SOT-23 MOSFETs: 1 = G, 2 = S, 3 = D.
PARTS = [
    # --- USB-C power input --------------------------------------------
    ("J1", ("Connector_USB", "USB_C_Receptacle_GCT_USB4125-xx-x_6P_TopMnt_Horizontal"),
     "USB-C 6P (power only)", 2.825, 19.0, 270,
     {"A9": VBUS, "B9": VBUS, "A12": GND, "B12": GND, "A5": "CC1", "B5": "CC2", "S1": GND},
     "5 V input. Power-only USB-C receptacle, no data lines."),
    ("R1", R0603, "5.1k", 8.6, 14.3, 90, {"1": "CC1", "2": GND},
     "CC1 pull-down: identifies the board as a USB-C sink so the source turns on 5 V."),
    ("R2", R0603, "5.1k", 8.6, 23.7, 90, {"1": GND, "2": "CC2"},
     "CC2 pull-down (same job as R1 for the flipped plug orientation)."),
    ("F1", ("Fuse", "Fuse_1206_3216Metric"), "PTC 500mA", 11.2, 19.0, 90,
     {"1": VBUS, "2": V5}, "Resettable fuse on the USB 5 V input."),
    ("D1", ("Diode_SMD", "D_SOD-123F"), "SMF5.0A", 13.8, 23.8, 90,
     {"1": V5, "2": GND}, "TVS clamp on the 5 V rail against ESD and hot-plug spikes."),
    ("C1", ("Capacitor_SMD", "C_1206_3216Metric"), "22uF 10V", 13.6, 13.6, 0,
     {"1": GND, "2": V5}, "Bulk capacitor on the 5 V rail."),
    ("U1", ("Package_TO_SOT_SMD", "SOT-23-5"), "AP2112K-3.3", 12.0, 9.0, 0,
     {"1": V5, "2": GND, "3": V5, "5": V3},
     "3.3 V LDO regulator for the microcontroller (pin 4 is NC)."),
    ("C2", C0603, "1uF", 9.1, 9.0, 90, {"1": GND, "2": V5}, "LDO input capacitor."),
    ("C3", C0603, "1uF", 14.9, 9.0, 90, {"1": GND, "2": V3}, "LDO output capacitor."),
    # --- MCU -------------------------------------------------------------
    ("U2", ("Package_SO", "TSSOP-20_4.4x6.5mm_P0.65mm"), "STM32G030F6P6", 21.5, 19.0, 0,
     {"4": V3, "5": GND, "6": "NRST", "7": "BTN", "9": "LED_660", "10": "LED_850",
      "12": "NTC_ADC", "13": "PWM_850", "14": "PWM_660",
      "16": "INTLK_LO", "17": "LASER_EN", "18": "SWDIO", "19": "SWCLK"},
     "Microcontroller: generates both PWM current setpoints, reads the button, "
     "interlock and NTC, drives the status LEDs and the laser-rail enable."),
    ("C4", C0603, "100nF", 16.6, 18.4, 90, {"1": GND, "2": V3}, "MCU decoupling."),
    ("C5", C0603, "1uF", 15.0, 18.4, 90, {"1": GND, "2": V3}, "MCU bulk decoupling."),
    ("C6", C0603, "100nF", 16.6, 21.6, 90, {"1": GND, "2": "NRST"}, "Reset pin filter."),
    ("J3", ("Connector_PinHeader_2.54mm", "PinHeader_1x05_P2.54mm_Vertical"),
     "SWD 1x5", 14.2, 2.9, 90,
     {"1": V3, "2": "SWCLK", "3": GND, "4": "SWDIO", "5": "NRST"},
     "SWD programming header: 3V3, SWCLK, GND, SWDIO, NRST."),
    ("SW1", ("Button_Switch_SMD", "SW_SPST_TL3342"), "TL3342", 11.0, 33.4, 0,
     {"1": "BTN", "2": GND}, "Start/stop button (MCU input with internal pull-up)."),
    ("D2", L0603, "green", 19.2, 35.1, 90, {"1": GND, "2": "LEDA_PWR"}, "Power LED (3.3 V present)."),
    ("R3", R0603, "1k", 19.2, 31.8, 90, {"1": "LEDA_PWR", "2": V3}, "Power LED resistor."),
    ("D3", L0603, "red", 22.0, 35.1, 90, {"1": GND, "2": "LEDA_660"}, "Status: 660 nm channel active (firmware)."),
    ("R4", R0603, "1k", 22.0, 31.8, 90, {"1": "LEDA_660", "2": "LED_660"}, "660 nm status LED resistor."),
    ("D4", L0603, "orange", 24.8, 35.1, 90, {"1": GND, "2": "LEDA_850"}, "Status: 850 nm channel active (firmware)."),
    ("R5", R0603, "1k", 24.8, 31.8, 90, {"1": "LEDA_850", "2": "LED_850"}, "850 nm status LED resistor."),
    # --- laser rail switch + interlock ---------------------------------
    ("Q1", SOT23, "AO3401A", 41.0, 19.0, 0, {"1": "VLD_G", "2": V5, "3": VLD},
     "High-side P-MOSFET: switches the 5 V laser supply rail VLD on and off."),
    ("R6", R0603, "100k", 38.0, 19.0, 270, {"1": "VLD_G", "2": V5},
     "Keeps Q1 off (gate pulled to 5 V) unless Q2 pulls it down."),
    ("Q2", SOT23, "2N7002", 28.0, 9.0, 0, {"1": "LASER_EN", "2": "INTLK_LO", "3": "VLD_G"},
     "Enable switch. Its source returns to GND only through the interlock loop, "
     "so the laser rail needs MCU enable AND a closed interlock."),
    ("R7", R0603, "100k", 25.2, 9.0, 90, {"1": GND, "2": "LASER_EN"},
     "Holds LASER_EN low while the MCU is in reset."),
    ("J2", ("Connector_JST", "JST_PH_B2B-PH-K_1x02_P2.00mm_Vertical"), "INTERLOCK",
     29.0, 2.9, 0, {"1": "INTLK_LO", "2": GND},
     "Interlock loop (e.g. skin-contact or key switch). Open loop = lasers cannot power."),
    ("D5", ("LED_SMD", "LED_0603_1608Metric"), "amber", 43.0, 35.1, 90,
     {"1": GND, "2": "LEDA_EMIT"},
     "Emission indicator, powered from the switched VLD rail itself, so it is lit "
     "whenever the laser supply is live regardless of firmware."),
    ("R9", R0603, "1k", 43.0, 31.8, 90, {"1": "LEDA_EMIT", "2": VLD}, "Emission LED resistor."),
    ("C7", ("Capacitor_SMD", "C_0805_2012Metric"), "10uF", 44.6, 19.0, 90,
     {"1": GND, "2": VLD}, "Local reservoir on the switched laser rail."),
    # --- op-amp ----------------------------------------------------------
    ("U3", ("Package_SO", "SOIC-8_3.9x4.9mm_P1.27mm"), "MCP6002", 33.6, 19.0, 270,
     {"1": "OUT1", "2": "FB1", "3": "SET1", "4": GND,
      "5": "SET2", "6": "FB2", "7": "OUT2", "8": V5},
     "Dual rail-to-rail op-amp: one constant-current loop per laser channel."),
    ("C8", C0603, "100nF", 37.6, 23.6, 0, {"1": V5, "2": GND}, "Op-amp decoupling."),
    # --- thermistor --------------------------------------------------------
    ("TH1", R0603, "NTC 10k", 49.0, 19.0, 0, {"1": "NTC_ADC", "2": GND},
     "NTC between the two diodes; the MCU derates or shuts down when hot."),
    ("R10", R0603, "10k", 27.2, 22.6, 90, {"1": "NTC_ADC", "2": V3}, "NTC divider top resistor."),
    # --- test points -------------------------------------------------------
    ("TP1", ("TestPoint", "TestPoint_Pad_D1.0mm"), "+5V", 9.6, 27.6, 0, {"1": V5}, "Test point: 5 V rail."),
    ("TP2", ("TestPoint", "TestPoint_Pad_D1.0mm"), "+3V3", 18.0, 12.0, 0, {"1": V3}, "Test point: 3.3 V rail."),
    ("TP3", ("TestPoint", "TestPoint_Pad_D1.0mm"), "ISENSE1", 35.0, 9.5, 0, {"1": "ISENSE1"},
     "Test point: 660 nm sense voltage (I = V / 2.2 ohm)."),
    ("TP4", ("TestPoint", "TestPoint_Pad_D1.0mm"), "ISENSE2", 35.0, 28.5, 0, {"1": "ISENSE2"},
     "Test point: 850 nm sense voltage (I = V / 2.2 ohm)."),
    # --- fiducials / holes -------------------------------------------------
    ("FID1", ("Fiducial", "Fiducial_1mm_Mask2mm"), "FID", 5.0, 28.0, 0, {}, "Assembly fiducial."),
    ("FID2", ("Fiducial", "Fiducial_1mm_Mask2mm"), "FID", 48.0, 2.4, 0, {}, "Assembly fiducial."),
    ("FID3", ("Fiducial", "Fiducial_1mm_Mask2mm"), "FID", 30.0, 36.0, 0, {}, "Assembly fiducial."),
    ("H1", ("MountingHole", "MountingHole_2.7mm_M2.5_Pad"), "M2.5", 3.5, 3.5, 0, {"1": GND}, "M2.5 mounting hole (GND)."),
    ("H2", ("MountingHole", "MountingHole_2.7mm_M2.5_Pad"), "M2.5", 54.5, 3.5, 0, {"1": GND}, "M2.5 mounting hole (GND)."),
    ("H3", ("MountingHole", "MountingHole_2.7mm_M2.5_Pad"), "M2.5", 3.5, 34.5, 0, {"1": GND}, "M2.5 mounting hole (GND)."),
    ("H4", ("MountingHole", "MountingHole_2.7mm_M2.5_Pad"), "M2.5", 54.5, 34.5, 0, {"1": GND}, "M2.5 mounting hole (GND)."),
]

# One constant-current channel per laser. ch 1 = 660 nm (upper), ch 2 = 850 nm (lower).
def channel(n, yc, sgn, wl, pwm):
    """sgn = -1 builds the channel above the op-amp, +1 below (mirrored)."""
    y = lambda d: yc + sgn * d
    k, s = f"LD{n}_K", f"ISENSE{n}"
    flip = 90 if sgn < 0 else 270
    ld_y = y(7.0)
    return [
        (f"LD{n}", ("OptoDevice", "LaserDiode_TO56-3"), f"{wl} nm LD", 48.0, ld_y, 0,
         {"1": k, "2": VLD, "3": VLD},
         f"{wl} nm laser diode, TO-56 can. Pin 2 = common (LD anode / PD cathode) on VLD, "
         f"pin 1 = LD cathode to the current sink. Pin 3 (monitor PD anode) is tied to "
         f"pin 2, so the monitor photodiode is unused in this mock."),
        (f"D{5 + n}", ("Diode_SMD", "D_SOD-323"), "BAT60A", 43.2, y(4.8), flip,
         {"1": VLD, "2": k}, f"Schottky antiparallel across LD{n}: clamps reverse voltage."),
        (f"C{8 + n}", C0603, "100nF", 43.2, y(8.6), flip,
         {"1": k, "2": VLD}, f"Small cap across LD{n} to absorb fast transients."),
        (f"Q{2 + n}", SOT23, "AO3400A", 39.4, y(12.0), 0,
         {"1": f"GATE{n}", "2": s, "3": k},
         f"N-MOSFET current sink for LD{n}, controlled by the op-amp."),
        (f"R{6 + 5*n}", ("Resistor_SMD", "R_1206_3216Metric"), "2.2R 1%", 39.4, y(8.0), 0,
         {"1": s, "2": GND}, f"Current sense resistor, LD{n}: 0.30 V full scale = 136 mA."),
        (f"R{7 + 5*n}", R0603, "100R", 36.2, y(12.0), 90 if sgn < 0 else 270,
         {"1": f"OUT{n}", "2": f"GATE{n}"}, f"Gate resistor, Q{2 + n}."),
        (f"R{8 + 5*n}", R0603, "1k", 35.2, y(6.6), flip,
         {"1": f"FB{n}", "2": s}, f"Feedback resistor: sense voltage into op-amp inverting input."),
        (f"C{10 + 2*n - 1}", C0603, "1nF", 33.3, y(6.6), flip,
         {"1": f"OUT{n}", "2": f"FB{n}"}, f"Compensation cap, keeps the ch{n} current loop stable."),
        (f"R{9 + 5*n}", R0603, "10k", 27.6, y(6.6), flip,
         {"1": pwm, "2": f"SET{n}"}, f"PWM filter / divider top, ch{n}."),
        (f"R{10 + 5*n}", R0603, "1k", 29.5, y(6.6), flip,
         {"1": f"SET{n}", "2": GND}, f"Divider bottom: scales 3.3 V PWM to 0.30 V full scale."),
        (f"C{10 + 2*n}", C0603, "1uF", 31.4, y(6.6), flip,
         {"1": f"SET{n}", "2": GND}, f"PWM filter capacitor: turns duty cycle into a DC setpoint."),
    ]

PARTS += channel(1, 19.0, -1, 660, "PWM_660")
PARTS += channel(2, 19.0, +1, 850, "PWM_850")

# ------------------------------------------------------------ router setup
G = 0.1                     # routing grid (mm)
NX, NY = int(round(W / G)) + 1, int(round(H / G)) + 1
CLR = 0.20                  # target clearance used by the router
MARGIN = 0.05               # grid discretisation allowance
RULE_CLR = 0.15             # board design-rule clearance (DRC)
EDGE_CLR = 0.45
VIA_D, VIA_DRILL = 0.6, 0.3
VIA_COST = 14.0
BOTTOM_MULT = 1.6           # keep the bottom mostly for the GND pour
TURN = [0.0, 0.35, 1.6, 5.0, 9.0]

XS = np.arange(NX) * G
YS = np.arange(NY) * G

class Item:
    __slots__ = ("net", "layers", "kind", "g", "smd", "obj")
    def __init__(self, net, layers, kind, g, smd=False, obj=None):
        self.net, self.layers, self.kind, self.g, self.smd = net, layers, kind, g, smd
        self.obj = obj
    def bbox(self):
        k, g = self.kind, self.g
        if k == "rect":
            cx, cy, hw, hh = g; return cx - hw, cy - hh, cx + hw, cy + hh
        if k == "circle":
            cx, cy, r = g; return cx - r, cy - r, cx + r, cy + r
        x1, y1, x2, y2, hw = g
        return min(x1, x2) - hw, min(y1, y2) - hw, max(x1, x2) + hw, max(y1, y2) + hw
    def dist(self, X, Y):
        k, g = self.kind, self.g
        if k == "rect":
            cx, cy, hw, hh = g
            dx = np.abs(X - cx) - hw; dy = np.abs(Y - cy) - hh
            return np.hypot(np.maximum(dx, 0), np.maximum(dy, 0)) + np.minimum(np.maximum(dx, dy), 0)
        if k == "circle":
            cx, cy, r = g
            return np.hypot(X - cx, Y - cy) - r
        x1, y1, x2, y2, hw = g
        vx, vy = x2 - x1, y2 - y1
        L2 = vx * vx + vy * vy
        if L2 < 1e-12:
            return np.hypot(X - x1, Y - y1) - hw
        t = np.clip(((X - x1) * vx + (Y - y1) * vy) / L2, 0, 1)
        return np.hypot(X - (x1 + t * vx), Y - (y1 + t * vy)) - hw
    def contains(self, x, y, shrink=0.0):
        return float(self.dist(np.array([x]), np.array([y]))[0]) <= -shrink

def raster(item, infl, out):
    """OR into out[NX,NY] the cells whose centre is closer than infl to item."""
    x0, y0, x1, y1 = item.bbox()
    i0 = max(0, int(math.floor((x0 - infl) / G))); i1 = min(NX - 1, int(math.ceil((x1 + infl) / G)))
    j0 = max(0, int(math.floor((y0 - infl) / G))); j1 = min(NY - 1, int(math.ceil((y1 + infl) / G)))
    if i0 > i1 or j0 > j1:
        return
    X, Y = np.meshgrid(XS[i0:i1 + 1], YS[j0:j1 + 1], indexing="ij")
    out[i0:i1 + 1, j0:j1 + 1] |= item.dist(X, Y) < infl

def edge_signed_dist():
    X, Y = np.meshgrid(XS, YS, indexing="ij")
    qx = np.abs(X - W / 2) - (W / 2 - CORNER_R)
    qy = np.abs(Y - H / 2) - (H / 2 - CORNER_R)
    out = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - CORNER_R
    return out   # negative inside the board

EDGE_SD = edge_signed_dist()

def pad_item(pad, net):
    x, y = unP(pad.GetPosition())
    bb = pad.GetBoundingBox()
    w, h = pcbnew.ToMM(bb.GetWidth()), pcbnew.ToMM(bb.GetHeight())
    tht = pad.GetAttribute() in (pcbnew.PAD_ATTRIB_PTH, pcbnew.PAD_ATTRIB_NPTH)
    layers = (0, 1) if tht else (0,)
    shape = pad.GetShape()
    if shape == pcbnew.PAD_SHAPE_CIRCLE:
        it = Item(net, layers, "circle", (x, y, w / 2))
    elif shape == pcbnew.PAD_SHAPE_OVAL:
        if w > h:
            it = Item(net, layers, "seg", (x - (w - h) / 2, y, x + (w - h) / 2, y, h / 2))
        else:
            it = Item(net, layers, "seg", (x, y - (h - w) / 2, x, y + (h - w) / 2, w / 2))
    else:
        it = Item(net, layers, "rect", (x, y, w / 2, h / 2))
    it.smd = not tht
    return it

# ------------------------------------------------------------- build board
board = pcbnew.BOARD()
ds = board.GetDesignSettings()
ds.SetCopperLayerCount(2)
board.SetCopperLayerCount(2)
nc = ds.m_NetSettings.m_DefaultNetClass
nc.SetClearance(mm(RULE_CLR)); nc.SetTrackWidth(mm(0.25))
nc.SetViaDiameter(mm(VIA_D)); nc.SetViaDrill(mm(VIA_DRILL))
ds.m_MinClearance = mm(RULE_CLR)
ds.m_TrackMinWidth = mm(0.2)
ds.m_ViasMinSize = mm(0.5)
ds.m_MinThroughDrill = mm(0.3)
ds.m_CopperEdgeClearance = mm(0.3)
ds.m_HoleToHoleMin = mm(0.25)
ds.m_SilkClearance = mm(0.0)
ds.m_MinSilkTextHeight = mm(0.6)
ds.m_MinSilkTextThickness = mm(0.1)
ds.SetBoardThickness(mm(1.6))

NETS = {}
def net(name):
    if name not in NETS:
        ni = pcbnew.NETINFO_ITEM(board, name)
        board.Add(ni)
        NETS[name] = ni
    return NETS[name]

# Board outline (rounded rectangle) on Edge.Cuts
def edge_line(a, b):
    s = pcbnew.PCB_SHAPE(board); s.SetShape(pcbnew.SHAPE_T_SEGMENT)
    s.SetStart(P(*a)); s.SetEnd(P(*b)); s.SetLayer(pcbnew.Edge_Cuts); s.SetWidth(mm(0.1))
    board.Add(s)

def edge_arc(c, a0):
    s = pcbnew.PCB_SHAPE(board); s.SetShape(pcbnew.SHAPE_T_ARC)
    pts = [(c[0] + CORNER_R * math.cos(math.radians(a)), c[1] + CORNER_R * math.sin(math.radians(a)))
           for a in (a0, a0 + 45, a0 + 90)]
    s.SetArcGeometry(P(*pts[0]), P(*pts[1]), P(*pts[2]))
    s.SetLayer(pcbnew.Edge_Cuts); s.SetWidth(mm(0.1)); board.Add(s)

r = CORNER_R
edge_line((r, 0), (W - r, 0)); edge_line((W, r), (W, H - r))
edge_line((W - r, H), (r, H)); edge_line((0, H - r), (0, r))
edge_arc((W - r, r), 270); edge_arc((W - r, H - r), 0)
edge_arc((r, H - r), 90); edge_arc((r, r), 180)

FOOTPRINTS = {}
for ref, (lib, name), value, x, y, rot, pads, purpose in PARTS:
    fp = pcbnew.FootprintLoad(LIB + lib + ".pretty", name)
    if fp is None:
        sys.exit(f"footprint not found: {lib}:{name}")
    fp.SetFPID(pcbnew.LIB_ID(lib, name))
    fp.SetReference(ref)
    fp.SetValue(value)
    fp.SetProperty("Purpose", purpose)
    fp.SetProperty("Library", f"{lib}:{name}")
    board.Add(fp)
    fp.SetPosition(P(x, y))
    fp.SetOrientationDegrees(rot)
    for pad in fp.Pads():
        n = pads.get(pad.GetNumber())
        if n:
            pad.SetNet(net(n))
    FOOTPRINTS[ref] = fp

missing = [(r, p.GetNumber()) for r, fp in FOOTPRINTS.items() for p in fp.Pads()
           if p.GetNetname() == "" and p.GetNumber() != "" and not r.startswith("FID")]
print("pads intentionally without net:", missing)

# Copper obstacle list
ITEMS = []
PADS_BY_NET = {}
for ref, fp in FOOTPRINTS.items():
    for pad in fp.Pads():
        n = pad.GetNetname()
        it = pad_item(pad, n)
        ITEMS.append(it)
        if n:
            PADS_BY_NET.setdefault(n, []).append((ref, pad, it))
        if pad.GetAttribute() == pcbnew.PAD_ATTRIB_NPTH or pad.GetDrillSizeX() > 0:
            dx = pcbnew.ToMM(pad.GetDrillSizeX()) / 2
            x, y = unP(pad.GetPosition())
            ITEMS.append(Item(n, (0, 1), "circle", (x, y, dx + 0.1)))

TRACKS, VIAS = [], []   # bookkeeping: (net, layer, x1,y1,x2,y2,w) / (net, x, y)

def add_track(n, layer, a, b, w):
    if math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-4:
        return
    t = pcbnew.PCB_TRACK(board)
    t.SetStart(P(*a)); t.SetEnd(P(*b)); t.SetWidth(mm(w))
    t.SetLayer(pcbnew.F_Cu if layer == 0 else pcbnew.B_Cu)
    t.SetNet(net(n)); board.Add(t)
    TRACKS.append((n, layer, a[0], a[1], b[0], b[1], w))
    ITEMS.append(Item(n, (layer,), "seg", (a[0], a[1], b[0], b[1], w / 2), obj=t))

def add_via(n, x, y):
    v = pcbnew.PCB_VIA(board)
    v.SetPosition(P(x, y)); v.SetWidth(mm(VIA_D)); v.SetDrill(mm(VIA_DRILL))
    v.SetViaType(pcbnew.VIATYPE_THROUGH); v.SetLayerPair(pcbnew.F_Cu, pcbnew.B_Cu)
    v.SetNet(net(n)); board.Add(v)
    VIAS.append((n, x, y))
    ITEMS.append(Item(n, (0, 1), "circle", (x, y, VIA_D / 2), obj=v))

def obstacle_maps(n, w):
    blk = np.zeros((2, NX, NY), bool)
    vblk = np.zeros((NX, NY), bool)
    infl_t = CLR + MARGIN + w / 2
    infl_v = CLR + MARGIN + VIA_D / 2
    for it in ITEMS:
        if it.net == n and n:
            if it.smd or it.kind == "circle" and it.g[2] > VIA_D:  # no via-in-pad
                raster(it, VIA_D / 2 + 0.1, vblk)
            elif it.kind == "circle":                # keep same-net vias apart
                raster(it, VIA_D / 2 + 0.35, vblk)
            continue
        for l in it.layers:
            raster(it, infl_t, blk[l])
        raster(it, infl_v, vblk)
    edge = EDGE_SD > -(EDGE_CLR + w / 2)
    blk[0] |= edge; blk[1] |= edge
    vblk |= EDGE_SD > -(EDGE_CLR + VIA_D / 2)
    for k in KEEPOUT_VIA:
        raster(k, VIA_D / 2, vblk)
    return blk, vblk

KEEPOUT_VIA = []

def cells_of(item, layers, blk):
    out = []
    x0, y0, x1, y1 = item.bbox()
    for i in range(max(0, int(x0 / G) - 1), min(NX, int(x1 / G) + 2)):
        for j in range(max(0, int(y0 / G) - 1), min(NY, int(y1 / G) + 2)):
            if item.contains(i * G, j * G, shrink=0.02):
                for l in layers:
                    out.append((l, i, j))
    return out

DIRS = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]

def astar(blk, vblk, sources, targets, tpts, free_sw, box):
    """sources: list of (l,i,j); targets: set of (l,i,j); tpts: [(i,j)] for heuristic."""
    i0, j0, i1, j1 = box
    gcost, parent, pdir = {}, {}, {}
    heap = []
    def h(i, j):
        best = 1e9
        for ti, tj in tpts:
            dx, dy = abs(i - ti), abs(j - tj)
            d = max(dx, dy) + 0.414 * min(dx, dy)
            if d < best:
                best = d
        return best
    for s in sources:
        l, i, j = s
        if blk[l, i, j] and s not in targets:
            # source cells inside own copper may sit in another net's halo; allow
            pass
        gcost[s] = 0.0; parent[s] = None; pdir[s] = -1
        heapq.heappush(heap, (h(i, j), 0.0, s))
    closed = set()
    while heap:
        f, gc, node = heapq.heappop(heap)
        if node in closed:
            continue
        closed.add(node)
        if node in targets:
            path = []
            while node is not None:
                path.append(node); node = parent[node]
            return path[::-1]
        l, i, j = node
        d0 = pdir[node]
        mult = BOTTOM_MULT if l == 1 else 1.0
        for di, (dx, dy) in enumerate(DIRS):
            ni, nj = i + dx, j + dy
            if ni < i0 or nj < j0 or ni > i1 or nj > j1:
                continue
            nn = (l, ni, nj)
            if nn in closed:
                continue
            if blk[l, ni, nj] and nn not in targets:
                continue
            step = 1.4142 if dx and dy else 1.0
            c = gc + step * mult
            if d0 >= 0:
                k = abs(di - d0) % 8
                c += TURN[min(k, 8 - k)]
            if c < gcost.get(nn, 1e18):
                gcost[nn] = c; parent[nn] = node; pdir[nn] = di
                heapq.heappush(heap, (c + h(ni, nj), c, nn))
        # layer change
        nn = (1 - l, i, j)
        if nn not in closed:
            if (i, j) in free_sw:
                c = gc + 0.01
            elif not vblk[i, j] and not blk[1 - l, i, j]:
                c = gc + VIA_COST
            else:
                c = None
            if c is not None and c < gcost.get(nn, 1e18):
                gcost[nn] = c; parent[nn] = node; pdir[nn] = d0
                heapq.heappush(heap, (c + h(i, j), c, nn))
    return None

def emit_path(n, path, w, start_pad, end_pad, free_sw):
    """Turn a cell path into tracks/vias. start_pad/end_pad: Item or None."""
    pts = [(l, i * G, j * G) for l, i, j in path]
    segs = []   # (layer, [points])
    cur_l, cur = pts[0][0], [(pts[0][1], pts[0][2])]
    for l, x, y in pts[1:]:
        if l != cur_l:
            segs.append((cur_l, cur))
            if (int(round(x / G)), int(round(y / G))) not in free_sw:
                add_via(n, x, y)
            cur_l, cur = l, [(x, y)]
        else:
            cur.append((x, y))
    segs.append((cur_l, cur))
    for si, (l, ptsl) in enumerate(segs):
        # collapse collinear points
        simp = [ptsl[0]]
        for k in range(1, len(ptsl) - 1):
            ax, ay = simp[-1]; bx, by = ptsl[k]; cx, cy = ptsl[k + 1]
            if abs((bx - ax) * (cy - by) - (by - ay) * (cx - bx)) > 1e-9:
                simp.append(ptsl[k])
        if len(ptsl) > 1:
            simp.append(ptsl[-1])
        if si == 0 and start_pad is not None and l in start_pad.layers:
            c = pad_center(start_pad)
            simp.insert(0, c)
        if si == len(segs) - 1 and end_pad is not None and l in end_pad.layers:
            simp.append(pad_center(end_pad))
        for a, b in zip(simp, simp[1:]):
            add_track(n, l, a, b, w)

def pad_center(it):
    if it.kind == "seg":
        return ((it.g[0] + it.g[2]) / 2, (it.g[1] + it.g[3]) / 2)
    return (it.g[0], it.g[1])

FAILED = []

def route_net(n, order=None):
    w = WIDTH.get(n, 0.25)
    pads = PADS_BY_NET[n]
    # merge pads that are the same physical point (e.g. duplicated switch pads stay separate)
    blk, vblk = obstacle_maps(n, w)
    free_sw = set()
    pad_cells = []
    for ref, pad, it in pads:
        cs = cells_of(it, it.layers, blk)
        if len(it.layers) == 2:
            for l, i, j in cs:
                free_sw.add((i, j))
        pad_cells.append(cs)
    if order:
        idx = sorted(range(len(pads)), key=lambda k: order.index(pads[k][0]) if pads[k][0] in order else 99)
    else:
        idx = list(range(len(pads)))
    tree = set(pad_cells[idx[0]])
    pad_of_tree = {c: pads[idx[0]][2] for c in pad_cells[idx[0]]}
    todo = idx[1:]
    while todo:
        targets = {}
        for k in todo:
            for c in pad_cells[k]:
                targets[c] = k
        if not targets:
            print("  ! no target cells for", n); FAILED.append(n); return
        tpts = list({(c[1], c[2]) for c in targets})
        allc = list(tree) + list(targets)
        bi0 = min(c[1] for c in allc); bi1 = max(c[1] for c in allc)
        bj0 = min(c[2] for c in allc); bj1 = max(c[2] for c in allc)
        path = None
        for pad_mm in (5.0, 12.0, 100.0):
            p = int(pad_mm / G)
            box = (max(0, bi0 - p), max(0, bj0 - p), min(NX - 1, bi1 + p), min(NY - 1, bj1 + p))
            # restrict heuristic points to nearest few
            path = astar(blk, vblk, list(tree), set(targets), tpts[:: max(1, len(tpts) // 40)], free_sw, box)
            if path:
                break
        if not path:
            print(f"  ! failed {n}: {[pads[k][0] for k in todo]}")
            FAILED.append(n); return
        k = targets[path[-1]]
        start_pad = pad_of_tree.get(path[0])
        emit_path(n, path, w, start_pad, pads[k][2], free_sw)
        # update maps: new copper of own net does not block own net, so only tree grows
        for c in path:
            tree.add(c)
        for c in pad_cells[k]:
            tree.add(c); pad_of_tree[c] = pads[k][2]
        todo.remove(k)

def fanout_gnd():
    """Give every SMD GND pad a short track to a via into the bottom pour."""
    n = GND; w = 0.4
    for ref, pad, it in PADS_BY_NET[GND]:
        if not it.smd:
            continue
        blk, vblk = obstacle_maps(n, w)
        cx, cy = pad_center(it)
        src = [(0, i, j) for (l, i, j) in cells_of(it, (0,), blk)]
        # Dijkstra on top layer until a via-able cell >= 0.75 mm from pad centre
        dist = {s: 0.0 for s in src}; par = {s: None for s in src}
        heap = [(0.0, s) for s in src]; heapq.heapify(heap)
        found = None
        while heap:
            d, node = heapq.heappop(heap)
            if d > dist.get(node, 1e9) + 1e-9:
                continue
            _, i, j = node
            if not vblk[i, j] and not it.contains(i * G, j * G, -0.35):
                found = node; break
            if d > 40:
                break
            for dx, dy in DIRS:
                ni, nj = i + dx, j + dy
                if not (0 <= ni < NX and 0 <= nj < NY) or blk[0, ni, nj]:
                    continue
                nd = d + (1.4142 if dx and dy else 1.0)
                if nd < dist.get((0, ni, nj), 1e9):
                    dist[(0, ni, nj)] = nd; par[(0, ni, nj)] = node
                    heapq.heappush(heap, (nd, (0, ni, nj)))
        if not found:
            print("  ! no GND fanout for", ref, pad.GetNumber()); continue
        path = []
        node = found
        while node is not None:
            path.append(node); node = par[node]
        path = path[::-1]
        emit_path(n, path, w, it, None, set())
        add_via(n, found[1] * G, found[2] * G)

# Keep vias out from under the laser cans' glass/lens-holder seat
for ref in ("LD1", "LD2"):
    x, y = unP(FOOTPRINTS[ref].GetPosition())
    KEEPOUT_VIA.append(Item("", (0, 1), "circle", (x + 1.0, y, 3.2)))

ROUTE_ORDER = [
    ("SWDIO", None), ("SWCLK", None), ("NTC_ADC", None), ("BTN", ["SW1"]),
    ("LD1_K", None), ("LD2_K", None), ("ISENSE1", None), ("ISENSE2", None),
    (VLD, ["Q1"]), (VBUS, ["F1"]), (V5, ["F1"]), (V3, ["U1"]),
    ("CC1", None), ("CC2", None),
    ("GATE1", None), ("GATE2", None), ("OUT1", None), ("OUT2", None),
    ("FB1", None), ("FB2", None), ("SET1", None), ("SET2", None),
    ("PWM_660", None), ("PWM_850", None),
    ("VLD_G", None), ("LASER_EN", None), ("INTLK_LO", ["J2"]),
    ("NRST", None),
    ("LED_660", None), ("LED_850", None), ("LEDA_PWR", None), ("LEDA_660", None),
    ("LEDA_850", None), ("LEDA_EMIT", None),
]

# ------------------------------------------------------- rip-up & retry
def rip(nets):
    keep = []
    for it in ITEMS:
        if it.obj is not None and it.net in nets:
            board.Remove(it.obj)
        else:
            keep.append(it)
    ITEMS[:] = keep
    TRACKS[:] = [t for t in TRACKS if t[0] not in nets]
    VIAS[:] = [v for v in VIAS if v[0] not in nets]

def route_all():
    orders = dict(ROUTE_ORDER)
    for n, order in ROUTE_ORDER:
        if n in PADS_BY_NET:
            route_net(n, order)
    for attempt in range(8):
        if not FAILED:
            break
        failed = list(dict.fromkeys(FAILED)); FAILED.clear()
        print(f"rip-up pass {attempt + 1}: {failed}", flush=True)
        for f in failed:
            pts = [pad_center(it) for _, _, it in PADS_BY_NET[f]]
            x0 = min(p[0] for p in pts) - 1.0; x1 = max(p[0] for p in pts) + 1.0
            y0 = min(p[1] for p in pts) - 1.0; y1 = max(p[1] for p in pts) + 1.0
            victims = set()
            for it in ITEMS:
                if it.obj is None or it.net in (f, GND):
                    continue
                bx0, by0, bx1, by1 = it.bbox()
                if bx1 >= x0 and bx0 <= x1 and by1 >= y0 and by0 <= y1:
                    victims.add(it.net)
            # big power nets are expensive to move; only rip them on later passes
            if attempt < 3:
                victims -= {V5, VBUS, VLD, V3}
            victims = sorted(victims, key=lambda n: len(PADS_BY_NET[n]))
            rip([f] + victims)
            route_net(f, orders.get(f))
            for v in victims:
                route_net(v, orders.get(v))

# ------------------------------------------------------------- GND links
def route_subset(n, pads_wanted, w):
    """Route a short dedicated track between specific pads of one net."""
    keep = PADS_BY_NET[n]
    sub = [t for t in keep if (t[0], t[1].GetNumber()) in pads_wanted]
    PADS_BY_NET[n] = sub
    old = WIDTH.get(n)
    WIDTH[n] = w
    try:
        route_net(n)
    finally:
        PADS_BY_NET[n] = keep
        if old is None:
            WIDTH.pop(n, None)
        else:
            WIDTH[n] = old

GND_LINKS = [
    [("U2", "5"), ("C4", "1")],
    [("U3", "4"), ("C8", "2")],
    [("C2", "1"), ("U1", "2")],
    [("C3", "1"), ("U1", "2")],
    [("J1", "A12"), ("J1", "S1")],
    [("J1", "B12"), ("J1", "S1")],
]

# ------------------------------------------------------------ silkscreen
TEXT_BOXES = {0: [], 1: []}   # placed silk text boxes per side (x0,y0,x1,y1)

def add_text(txt, x, y, h, layer=pcbnew.F_SilkS, angle=0, thick=None, bold=False):
    t = pcbnew.PCB_TEXT(board)
    t.SetText(txt); t.SetPosition(P(x, y)); t.SetLayer(layer)
    t.SetTextSize(pcbnew.VECTOR2I(mm(h), mm(h)))
    t.SetTextThickness(mm(thick or max(0.15, h * 0.15)))
    t.SetTextAngle(pcbnew.EDA_ANGLE(angle, pcbnew.DEGREES_T))
    t.SetHorizJustify(pcbnew.GR_TEXT_H_ALIGN_CENTER)
    if layer == pcbnew.B_SilkS:
        t.SetMirrored(True)
    board.Add(t)
    bb = t.GetBoundingBox()
    x0, y0 = unP(bb.GetOrigin()); x1, y1 = unP(bb.GetEnd())
    TEXT_BOXES[0 if layer == pcbnew.F_SilkS else 1].append((x0, y0, x1, y1))
    return t

def overlaps(a, b, m=0.0):
    return not (a[2] + m <= b[0] or b[2] + m <= a[0] or a[3] + m <= b[1] or b[3] + m <= a[1])

def place_refs():
    obst = []
    for ref, fp in FOOTPRINTS.items():
        for pad in fp.Pads():
            if pad.GetAttribute() == pcbnew.PAD_ATTRIB_SMD and not pad.IsOnLayer(pcbnew.F_Cu):
                continue
            bb = pad.GetBoundingBox()
            x0, y0 = unP(bb.GetOrigin()); x1, y1 = unP(bb.GetEnd())
            obst.append((x0 - 0.2, y0 - 0.2, x1 + 0.2, y1 + 0.2))
    for n, x, y in VIAS:
        obst.append((x - 0.35, y - 0.35, x + 0.35, y + 0.35))
    for fp in FOOTPRINTS.values():
        for g in fp.GraphicalItems():
            if g.GetLayer() == pcbnew.F_SilkS and g.GetClass() != "PCB_TEXT" and g.GetClass() != "FP_TEXT":
                bb = g.GetBoundingBox()
                x0, y0 = unP(bb.GetOrigin()); x1, y1 = unP(bb.GetEnd())
                obst.append((x0 - 0.1, y0 - 0.1, x1 + 0.1, y1 + 0.1))
    bodies = {}
    for ref, fp in FOOTPRINTS.items():
        fp.BuildCourtyardCaches()
        cy = fp.GetCourtyard(pcbnew.F_CrtYd)
        bb = cy.BBox() if cy.OutlineCount() else fp.GetBoundingBox(False, False)
        x0, y0 = unP(bb.GetOrigin()); x1, y1 = unP(bb.GetEnd())
        bodies[ref] = (x0, y0, x1, y1)
    hidden = []
    order = sorted(FOOTPRINTS, key=lambda r: (bodies[r][2] - bodies[r][0]) * (bodies[r][3] - bodies[r][1]))
    for ref in order:
        fp = FOOTPRINTS[ref]
        t = fp.Reference()
        if ref.startswith(("H", "FID")):
            t.SetVisible(False); continue
        t.SetTextSize(pcbnew.VECTOR2I(mm(0.8), mm(0.8)))
        t.SetTextThickness(mm(0.15))
        x0, y0, x1, y1 = bodies[ref]
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        placed = False
        cands = []
        for ang in (0, 90):
            for d in (-0.3, 0.0, 0.4, 0.9, 1.5):
                cands += [(ang, cx, y0 - 0.5 - d), (ang, cx, y1 + 0.5 + d),
                          (ang, x0 - 0.6 - d, cy), (ang, x1 + 0.6 + d, cy),
                          (ang, x0 - 0.6 - d, y0 - 0.5 - d), (ang, x1 + 0.6 + d, y0 - 0.5 - d),
                          (ang, x0 - 0.6 - d, y1 + 0.5 + d), (ang, x1 + 0.6 + d, y1 + 0.5 + d)]
        best = None
        big = (x1 - x0) * (y1 - y0) > 14
        sizes = [(0.8, 0.15, cands), (0.6, 0.12, cands)]
        if big:
            sizes.append((0.8, 0.15, [(0, cx, cy), (90, cx, cy)]))
        for hh, th, cl in sizes:
          t.SetTextSize(pcbnew.VECTOR2I(mm(hh), mm(hh))); t.SetTextThickness(mm(th))
          for ang, x, y in cl:
            t.SetTextAngle(pcbnew.EDA_ANGLE(ang, pcbnew.DEGREES_T))
            t.SetPosition(P(x, y))
            bb = t.GetBoundingBox()
            bx0, by0 = unP(bb.GetOrigin()); bx1, by1 = unP(bb.GetEnd())
            box = (bx0, by0, bx1, by1)
            if bx0 < 0.6 or by0 < 0.6 or bx1 > W - 0.6 or by1 > H - 0.6:
                continue
            if any(overlaps(box, o) for o in obst):
                continue
            if any(overlaps(box, o, 0.15) for o in TEXT_BOXES[0]):
                continue
            if any(overlaps(box, bodies[r2]) for r2 in bodies if r2 != ref and not r2.startswith("FID")):
                continue
            best = (ang, x, y, box, hh, th); break
          if best:
              break
        if best is None:
            t.SetVisible(False); hidden.append(ref); continue
        ang, x, y, box, hh, th = best
        t.SetTextSize(pcbnew.VECTOR2I(mm(hh), mm(hh))); t.SetTextThickness(mm(th))
        t.SetTextAngle(pcbnew.EDA_ANGLE(ang, pcbnew.DEGREES_T)); t.SetPosition(P(x, y))
        TEXT_BOXES[0].append(box)
    return hidden

# ----------------------------------------------------------------- zones
def add_zone(layer):
    z = pcbnew.ZONE(board)
    z.SetLayer(layer); z.SetNet(net(GND))
    o = z.Outline(); o.NewOutline()
    for x, y in ((0, 0), (W, 0), (W, H), (0, H)):
        o.Append(mm(OX + x), mm(OY + y))
    z.SetLocalClearance(mm(0.3))
    z.SetMinThickness(mm(0.25))
    z.SetPadConnection(pcbnew.ZONE_CONNECTION_THERMAL)
    z.SetThermalReliefGap(mm(0.3))
    z.SetThermalReliefSpokeWidth(mm(0.4))
    z.SetIslandRemovalMode(pcbnew.ISLAND_REMOVAL_MODE_ALWAYS)
    z.SetZoneName("GND_" + ("TOP" if layer == pcbnew.F_Cu else "BOT"))
    board.Add(z)
    return z

STITCH = []
def stitch_vias():
    clr = 0.55
    vb = np.zeros((NX, NY), bool)
    for it in ITEMS:
        if it.net == GND:
            infl = VIA_D / 2 + 0.25 if (it.kind == "circle" and it.g[2] <= VIA_D) else VIA_D / 2 + 0.6
            raster(it, infl, vb)
        else:
            raster(it, clr + VIA_D / 2, vb)
    vb |= EDGE_SD > -(1.0 + VIA_D / 2)
    for k in KEEPOUT_VIA:
        raster(k, VIA_D / 2 + 0.2, vb)
    for side in (0, 1):
        for (x0, y0, x1, y1) in TEXT_BOXES[side]:
            raster(Item("", (0,), "rect", ((x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2)), VIA_D / 2 + 0.1, vb)
    cand = []
    # ring of thermal vias around each laser can
    for ref in ("LD1", "LD2"):
        x, y = unP(FOOTPRINTS[ref].GetPosition()); x += 1.0
        for k in range(16):
            a = 2 * math.pi * k / 16
            cand.append((x + 4.3 * math.cos(a), y + 4.3 * math.sin(a)))
    pitch = 3.0
    for gx in np.arange(1.5, W, pitch):
        for gy in np.arange(1.5, H, pitch):
            cand.append((gx, gy))
    for x, y in cand:
        i, j = int(round(x / G)), int(round(y / G))
        if 0 <= i < NX and 0 <= j < NY and not vb[i, j]:
            xg, yg = i * G, j * G
            add_via(GND, xg, yg); STITCH.append((xg, yg))
            raster(Item(GND, (0, 1), "circle", (xg, yg, VIA_D / 2)), VIA_D + 0.8, vb)

def fill_zones():
    filler = pcbnew.ZONE_FILLER(board)
    zs = board.Zones()
    filler.Fill(zs)

def prune_stitch():
    """Remove stitching vias that are not inside the GND fill on both layers."""
    zones = {z.GetLayer(): z for z in board.Zones()}
    removed = 0
    for v in list(board.GetTracks()):
        if v.GetClass() != "PCB_VIA" or v.GetNetname() != GND:
            continue
        x, y = unP(v.GetPosition())
        if (round(x, 3), round(y, 3)) not in {(round(a, 3), round(b, 3)) for a, b in STITCH}:
            continue
        ok = all(zones[l].GetFilledPolysList(l).Contains(v.GetPosition()) for l in (pcbnew.F_Cu, pcbnew.B_Cu))
        if not ok:
            board.Remove(v); removed += 1
    return removed

def fix_islands():
    """Drop a via into any GND fill piece on either layer that has no via or THT pad."""
    vb = np.zeros((NX, NY), bool)
    for it in ITEMS:
        if it.net != GND:
            raster(it, CLR + MARGIN + VIA_D / 2, vb)
        else:
            raster(it, VIA_D / 2 + (0.1 if it.smd else 0.3), vb)
    vb |= EDGE_SD > -(0.6 + VIA_D / 2)
    zones = {z.GetLayer(): z for z in board.Zones()}
    anchors = [pcbnew.VECTOR2I(mm(OX + x), mm(OY + y)) for n, x, y in VIAS if n == GND]
    for fp in board.GetFootprints():
        for p in fp.Pads():
            if p.GetNetname() == GND and p.GetAttribute() == pcbnew.PAD_ATTRIB_PTH:
                anchors.append(p.GetPosition())
    added = 0
    for L in (pcbnew.F_Cu, pcbnew.B_Cu):
        other = pcbnew.B_Cu if L == pcbnew.F_Cu else pcbnew.F_Cu
        polys = zones[L].GetFilledPolysList(L)
        for k in range(polys.OutlineCount()):
            ol = polys.Outline(k)
            if any(ol.PointInside(a) for a in anchors):
                continue
            bb = ol.BBox()
            x0, y0 = unP(bb.GetOrigin()); x1, y1 = unP(bb.GetEnd())
            done = False
            for x in np.arange(x0, x1, G):
                for y in np.arange(y0, y1, G):
                    i, j = int(round(x / G)), int(round(y / G))
                    if not (0 <= i < NX and 0 <= j < NY) or vb[i, j]:
                        continue
                    pt = P(i * G, j * G)
                    if ol.PointInside(pt) and zones[other].GetFilledPolysList(other).Contains(pt):
                        add_via(GND, i * G, j * G); anchors.append(pt); added += 1
                        raster(Item(GND, (0, 1), "circle", (i * G, j * G, VIA_D / 2)), VIA_D + 0.4, vb)
                        done = True; break
                if done:
                    break
            if not done and not any(abs(x0 - hx) < 3.5 and abs(y0 - hy) < 3.5 for hx, hy in ((0.3, 0.3), (54.9, 0.3), (0.3, 34.9), (54.9, 34.9))):
                print(f"  ! GND island on layer {L} near ({x0:.1f},{y0:.1f}) has no room for a via")
    return added

def board_texts():
    add_text("LD1 660nm", 56.2, 12.0, 1.0, angle=90)
    add_text("LD2 850nm", 56.2, 26.0, 1.0, angle=90)
    add_text("REV 0.1 MOCK", 37.2, 36.7, 0.9)
    B = pcbnew.B_SilkS
    add_text("DUAL-LASER PBM HEAD 660/850", 29.0, 7.8, 1.3, layer=B)
    add_text("LASER RADIATION - AVOID EYE EXPOSURE", 29.0, 30.6, 1.0, layer=B)
    add_text("CLASS 3B - 850nm IS INVISIBLE", 29.0, 32.4, 1.0, layer=B)
    add_text("REV 0.1 MOCK - NOT THE ORIGINAL DESIGN", 29.0, 34.4, 0.9, layer=B)
    add_text("660nm", 49.0, 5.6, 1.0, layer=B)
    add_text("850nm", 49.0, 32.4, 1.0, layer=B)
    add_text("USB-C 5V", 9.0, 12.0, 1.0, layer=B, angle=90)

def drc_and_report():
    rpt = os.path.join(HERE, "drc_report.txt")
    board.BuildConnectivity()
    unconnected = board.GetConnectivity().GetUnconnectedCount(False)
    ok = pcbnew.WriteDRCReport(board, rpt, pcbnew.EDA_UNITS_MILLIMETRES, True)
    print("DRC report written:", ok, "| unconnected (connectivity):", unconnected)

if __name__ == "__main__":
    route_all()
    for link in GND_LINKS:
        route_subset(GND, link, 0.3)
    print("GND fanout", flush=True)
    fanout_gnd()
    board_texts()
    hidden = place_refs()
    print("refs hidden (no room):", hidden)
    stitch_vias()
    for z in (pcbnew.F_Cu, pcbnew.B_Cu):
        add_zone(z)
    print("FAILED:", FAILED)
    board.Save(OUT)
    # zone filling is only reliable on a board loaded from disk
    board = pcbnew.LoadBoard(OUT)
    fill_zones()
    print("pruned stitching vias:", prune_stitch())
    fill_zones()
    for _ in range(3):
        n_isl = fix_islands()
        print("island vias added:", n_isl)
        if not n_isl:
            break
        fill_zones()
    print(f"tracks {len(TRACKS)}  vias {sum(1 for t in board.GetTracks() if t.GetClass() == 'PCB_VIA')}")
    board.Save(OUT)
    print("saved", OUT)
    drc_and_report()

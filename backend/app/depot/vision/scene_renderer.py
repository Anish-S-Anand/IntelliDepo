

"""
Depot Vision ? Realistic CCTV Scene Renderer
6 unique warehouse scenes rendered with cv2. Each scene has:
- Realistic perspective, lighting, depth
- Animated objects (forklifts, trucks, people, pallets)
- Scene-specific content matching the camera label
"""
import math
import time
import numpy as np

try:
    import cv2
    _HAS_CV2 = True
except ImportError:
    _HAS_CV2 = False

def _apply_theme(frame, theme):
    if theme == 'light':
        import numpy as _np
        frame = _np.clip(frame.astype('int16') + 110, 0, 255).astype('uint8')
        frame[:, :, 2] = _np.clip(frame[:, :, 2].astype('int16') + 20, 0, 255).astype('uint8')
        frame[:, :, 0] = _np.clip(frame[:, :, 0].astype('int16') - 8, 0, 255).astype('uint8')
    return frame



def render_scene(scene_idx: int, frame_num: int, theme: str = 'dark') -> np.ndarray:
    if not _HAS_CV2:
        # cv2 unavailable — return a plain solid-color frame
        h, w = 480, 854
        palettes = [
            (28, 32, 28), (20, 20, 25), (30, 28, 22),
            (8, 18, 8),   (28, 26, 32), (32, 30, 25),
        ]
        bg = palettes[scene_idx % len(palettes)]
        frame = np.full((h, w, 3), bg, dtype=np.uint8)
        return _apply_theme(frame, theme)
    t = time.time() + frame_num * 0.04
    h, w = 480, 854
    if scene_idx == 0:
        return _scene_gate_entry(h, w, t, theme)
    elif scene_idx == 1:
        return _scene_zone_overhead(h, w, t, theme)
    elif scene_idx == 2:
        return _scene_loading_bay(h, w, t, theme)
    elif scene_idx == 3:
        return _scene_perimeter(h, w, t, theme)
    elif scene_idx == 4:
        return _scene_gate_exit(h, w, t, theme)
    else:
        return _scene_yard_overview(h, w, t, theme)


def _sky_ground(frame, h, w, sky_col, ground_col, horizon=0.45):
    hp = int(h * horizon)
    for y in range(h):
        if y < hp:
            alpha = y / hp
            c = tuple(int(sky_col[i] * (1 - alpha * 0.3)) for i in range(3))
        else:
            alpha = (y - hp) / (h - hp)
            c = tuple(int(ground_col[i] * (1 - alpha * 0.2)) for i in range(3))
        frame[y, :] = c


def _draw_person(frame, cx, cy, scale=1.0, color=(55, 95, 55)):
    if not _HAS_CV2:
        return
    s = scale
    cv2.circle(frame, (cx, int(cy - 22*s)), int(8*s), color, -1)
    cv2.rectangle(frame, (int(cx-6*s), int(cy-14*s)), (int(cx+6*s), int(cy+12*s)), color, -1)
    cv2.rectangle(frame, (int(cx-8*s), int(cy-14*s)), (int(cx+8*s), int(cy-10*s)), (color[0]+20, color[1]+20, color[2]+20), -1)
    leg = int(4*s*math.sin(cy * 0.3 + time.time() * 3))
    cv2.line(frame, (int(cx-3*s), int(cy+12*s)), (int(cx-3*s+leg), int(cy+28*s)), color, int(3*s))
    cv2.line(frame, (int(cx+3*s), int(cy+12*s)), (int(cx+3*s-leg), int(cy+28*s)), color, int(3*s))


def _draw_forklift(frame, cx, cy, scale=1.0, facing_right=True):
    if not _HAS_CV2:
        return
    s = scale
    d = 1 if facing_right else -1
    body_col = (60, 100, 140)
    cv2.rectangle(frame, (int(cx-20*s), int(cy-15*s)), (int(cx+20*s), int(cy+15*s)), body_col, -1)
    cv2.rectangle(frame, (int(cx-20*s), int(cy-15*s)), (int(cx+20*s), int(cy+15*s)), (80, 120, 160), 2)
    mast_x = int(cx + d*18*s)
    mast_h = int(35*s)
    cv2.rectangle(frame, (mast_x-int(3*s), int(cy-15*s)-mast_h), (mast_x+int(3*s), int(cy-15*s)), (80, 110, 140), -1)
    fork_y = int(cy - 5*s)
    cv2.rectangle(frame, (mast_x, fork_y-int(2*s)), (mast_x+d*int(18*s), fork_y), (100, 130, 160), -1)
    cv2.circle(frame, (int(cx-12*s), int(cy+15*s)), int(6*s), (30, 30, 30), -1)
    cv2.circle(frame, (int(cx+12*s), int(cy+15*s)), int(6*s), (30, 30, 30), -1)
    cv2.circle(frame, (int(cx-12*s), int(cy+15*s)), int(3*s), (60, 60, 60), -1)
    cv2.circle(frame, (int(cx+12*s), int(cy+15*s)), int(3*s), (60, 60, 60), -1)


def _draw_truck(frame, cx, cy, scale=1.0):
    if not _HAS_CV2:
        return
    s = scale
    cv2.rectangle(frame, (int(cx-55*s), int(cy-20*s)), (int(cx+55*s), int(cy+25*s)), (55, 65, 55), -1)
    cv2.rectangle(frame, (int(cx+20*s), int(cy-40*s)), (int(cx+55*s), int(cy-20*s)), (48, 58, 48), -1)
    cv2.rectangle(frame, (int(cx+25*s), int(cy-38*s)), (int(cx+52*s), int(cy-22*s)), (80, 100, 120), -1)
    cv2.circle(frame, (int(cx-35*s), int(cy+25*s)), int(10*s), (25, 25, 25), -1)
    cv2.circle(frame, (int(cx+35*s), int(cy+25*s)), int(10*s), (25, 25, 25), -1)
    cv2.circle(frame, (int(cx-35*s), int(cy+25*s)), int(5*s), (50, 50, 50), -1)
    cv2.circle(frame, (int(cx+35*s), int(cy+25*s)), int(5*s), (50, 50, 50), -1)
    cv2.rectangle(frame, (int(cx-55*s), int(cy-20*s)), (int(cx+55*s), int(cy-16*s)), (75, 85, 75), -1)


def _draw_shelf_rack(frame, x, y, w_rack, h_rack, levels=4):
    if not _HAS_CV2:
        return
    cv2.rectangle(frame, (x, y), (x+w_rack, y+h_rack), (35, 30, 25), -1)
    level_h = h_rack // levels
    for i in range(levels):
        shelf_y = y + i * level_h
        cv2.rectangle(frame, (x, shelf_y), (x+w_rack, shelf_y+4), (55, 48, 38), -1)
        box_colors = [(45, 35, 25), (25, 45, 35), (35, 25, 50), (50, 40, 20), (20, 35, 50)]
        bw = max(12, w_rack // 6)
        for j in range(min(5, w_rack // (bw+2))):
            bx = x + 3 + j*(bw+2)
            bc = box_colors[(i+j) % len(box_colors)]
            cv2.rectangle(frame, (bx, shelf_y+5), (bx+bw, shelf_y+level_h-2), bc, -1)
            cv2.rectangle(frame, (bx, shelf_y+5), (bx+bw, shelf_y+8), (bc[0]+15, bc[1]+15, bc[2]+15), -1)


def _draw_pallet(frame, cx, cy, scale=1.0, col=(55, 45, 30)):
    if not _HAS_CV2:
        return
    s = scale
    cv2.rectangle(frame, (int(cx-18*s), int(cy-8*s)), (int(cx+18*s), int(cy+8*s)), col, -1)
    cv2.rectangle(frame, (int(cx-18*s), int(cy-8*s)), (int(cx+18*s), int(cy-5*s)), (col[0]+15, col[1]+15, col[2]+15), -1)
    for i in range(3):
        lx = int(cx - 12*s + i*12*s)
        cv2.line(frame, (lx, int(cy-8*s)), (lx, int(cy+8*s)), (col[0]-10, col[1]-10, col[2]-10), 1)
    cv2.rectangle(frame, (int(cx-15*s), int(cy-18*s)), (int(cx+15*s), int(cy-8*s)), (col[0]+5, col[1]+5, col[2]+5), -1)


def _perspective_floor(frame, h, w, horizon_y, col1=(42, 40, 36), col2=(38, 36, 32)):
    if not _HAS_CV2:
        return
    for y in range(horizon_y, h):
        prog = (y - horizon_y) / (h - horizon_y)
        c = tuple(int(col1[i] * (1-prog*0.15)) for i in range(3))
        frame[y, :] = c
    vp_x = w // 2
    for i in range(-8, 9):
        gx = vp_x + i * 60
        cv2.line(frame, (vp_x, horizon_y), (gx, h), (col2[0], col2[1], col2[2]), 1)
    for y in range(horizon_y, h, int((h-horizon_y)/6)):
        prog = (y - horizon_y) / (h - horizon_y)
        lw = max(1, int(prog * 2))
        cv2.line(frame, (0, y), (w, y), col2, lw)


def _scene_gate_entry(h, w, t, theme='dark'):
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    _light = (theme == 'light')
    _sky_ground(frame, h, w, (45, 50, 42), (38, 36, 32), 0.42)
    _perspective_floor(frame, h, w, int(h*0.42))
    wall_y = int(h * 0.42)
    cv2.rectangle(frame, (0, 0), (w, wall_y), (40, 42, 38), -1)
    cv2.rectangle(frame, (0, wall_y-3), (w, wall_y+3), (55, 58, 50), -1)
    for gx in [w//2-120, w//2+120]:
        cv2.rectangle(frame, (gx-8, wall_y-80), (gx+8, wall_y+30), (60, 58, 52), -1)
    barrier_open = 0.6 + 0.4*math.sin(t*0.5)
    bx1, by1 = w//2-112, wall_y-60
    bx2 = int(bx1 + 100*math.cos(barrier_open*1.2))
    by2 = int(by1 - 100*math.sin(barrier_open*1.2))
    cv2.line(frame, (bx1, by1), (bx2, by2), (220, 60, 30), 5)
    cv2.line(frame, (w//2+112, wall_y-60), (w//2+112+100, wall_y-60), (220, 60, 30), 5)
    tx = int(w*0.62 + w*0.12*math.sin(t*0.2))
    ty = int(h*0.52)
    scale = 0.7 + 0.1*math.sin(t*0.15)
    _draw_truck(frame, tx, ty, scale)
    px = int(w*0.48 + 8*math.sin(t*0.8))
    _draw_person(frame, px, int(h*0.50), 0.85)
    _draw_person(frame, int(w*0.38), int(h*0.52), 0.75)
    for i, (px2, py2) in enumerate([(int(w*0.15), int(h*0.58)), (int(w*0.25), int(h*0.60))]):
        _draw_pallet(frame, px2, py2, 0.8)
    cv2.rectangle(frame, (w-180, 30), (w-10, 75), (0,0,0), -1)
    cv2.putText(frame, "GATE: OPEN", (w-175, 52), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (34, 211, 160), 1)
    cv2.putText(frame, "VEHICLES: 1", (w-175, 68), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (200, 200, 200), 1)
    return _apply_theme(frame, theme)


def _scene_zone_overhead(h, w, t, theme='dark'):
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    _light = (theme == 'light')
    for y in range(h):
        shade = int(22 + y/h*8)
        frame[y, :] = (shade, shade, shade-2)
    for gy in range(0, h, 50):
        for gx in range(0, w, 50):
            shade = 26 if ((gx//50)+(gy//50)) % 2 == 0 else 22
            cv2.rectangle(frame, (gx, gy), (gx+49, gy+49), (shade, shade, shade-2), -1)
    for ri, rx in enumerate([20, 220, 440, 640]):
        for ry in range(20, h-60, 80):
            _draw_shelf_rack(frame, rx, ry, 160, 70, 3)
    aisle_col = (32, 30, 28)
    cv2.rectangle(frame, (190, 0), (210, h), aisle_col, -1)
    cv2.rectangle(frame, (410, 0), (430, h), aisle_col, -1)
    cv2.rectangle(frame, (620, 0), (640, h), aisle_col, -1)
    fkx = int(w*0.52 + w*0.18*math.sin(t*0.3))
    fky = int(h*0.55 + h*0.08*math.sin(t*0.2))
    _draw_forklift(frame, fkx, fky, 0.9, math.sin(t*0.3) > 0)
    for i in range(3):
        px = int(w*0.3 + i*w*0.2 + 15*math.sin(t*0.4+i))
        py = int(h*0.75 + 10*math.cos(t*0.3+i))
        _draw_person(frame, px, py, 0.7)
    cv2.rectangle(frame, (10, 30), (200, 70), (0,0,0), -1)
    cv2.putText(frame, "ZONE-A  OVERHEAD", (14, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (34, 211, 160), 1)
    cv2.putText(frame, "PALLETS: 124  UTIL: 81%", (14, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (200, 200, 200), 1)
    return _apply_theme(frame, theme)


def _scene_loading_bay(h, w, t, theme='dark'):
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    _light = (theme == 'light')
    _sky_ground(frame, h, w, (38, 36, 32), (42, 40, 36), 0.40)
    _perspective_floor(frame, h, w, int(h*0.40))
    wall_y = int(h*0.40)
    cv2.rectangle(frame, (0, 0), (w, wall_y), (48, 46, 42), -1)
    for dx in [w//2-100, w//2+20]:
        cv2.rectangle(frame, (dx, wall_y-90), (dx+80, wall_y), (18, 16, 14), -1)
        cv2.rectangle(frame, (dx, wall_y-90), (dx+80, wall_y), (65, 62, 55), 2)
        cv2.rectangle(frame, (dx, wall_y-8), (dx+80, wall_y+8), (55, 52, 45), -1)
    truck_y = int(h*0.32 + h*0.04*math.sin(t*0.25))
    _draw_truck(frame, w//2-60, truck_y, 0.85)
    if int(t*3) % 2:
        cv2.circle(frame, (w//2-105, truck_y+20), 5, (200, 200, 200), -1)
        cv2.circle(frame, (w//2-15, truck_y+20), 5, (200, 200, 200), -1)
    fkx = int(w*0.72 + 20*math.sin(t*0.4))
    fky = int(h*0.58)
    _draw_forklift(frame, fkx, fky, 0.9, True)
    for i, (px, py) in enumerate([(int(w*0.18), int(h*0.55)), (int(w*0.28), int(h*0.57))]):
        _draw_pallet(frame, px, py, 0.9)
    _draw_person(frame, int(w*0.42), int(h*0.54), 0.85)
    _draw_person(frame, int(w*0.58 + 5*math.sin(t)), int(h*0.56), 0.8)
    cv2.rectangle(frame, (10, 30), (220, 70), (0,0,0), -1)
    cv2.putText(frame, "LOADING BAY 1-4", (14, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (34, 211, 160), 1)
    cv2.putText(frame, "DOCK: OCCUPIED  TRUCK IN", (14, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (245, 166, 35), 1)
    return _apply_theme(frame, theme)


def _scene_perimeter(h, w, t, theme='dark'):
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    _light = (theme == 'light')
    for y in range(h):
        g = int(8 + y/h*18)
        frame[y, :] = (g//3, g, g//3)
    horizon_y = int(h*0.45)
    for y in range(horizon_y, h):
        prog = (y-horizon_y)/(h-horizon_y)
        g = int(12 + prog*20)
        frame[y, :] = (g//3, g, g//3)
    for fx in range(0, w+80, 80):
        cv2.line(frame, (fx, horizon_y-70), (fx, horizon_y+25), (25, 60, 25), 3)
        for wy in range(horizon_y-65, horizon_y+20, 18):
            cv2.line(frame, (fx, wy), (min(w, fx+80), wy), (18, 45, 18), 1)
    px = int(w*0.15 + w*0.65*((t*0.06) % 1.0))
    py = horizon_y - 5
    _draw_person(frame, px, py, 0.9, (35, 110, 35))
    cv2.rectangle(frame, (px-14, py-35), (px+14, py+32), (0, 50, 200), 2)
    cv2.rectangle(frame, (px-14, py-50), (px+80, py-35), (0, 50, 200), -1)
    cv2.putText(frame, "INTRUDER 91%", (px-12, py-37), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (255,255,255), 1)
    cv2.putText(frame, "NV-MODE  IR", (w-120, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (35, 180, 35), 1)
    cv2.circle(frame, (w-130, 30), 5, (35, 180, 35), -1)
    cv2.rectangle(frame, (10, 30), (220, 70), (0,0,0), -1)
    cv2.putText(frame, "ZONE-C PERIMETER", (14, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (35, 200, 35), 1)
    cv2.putText(frame, "ALERT: MOTION DETECTED", (14, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (0, 60, 220), 1)
    return _apply_theme(frame, theme) if theme == 'light' else frame


def _scene_gate_exit(h, w, t, theme='dark'):
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    _light = (theme == 'light')
    _sky_ground(frame, h, w, (42, 44, 40), (40, 38, 34), 0.43)
    _perspective_floor(frame, h, w, int(h*0.43))
    wall_y = int(h*0.43)
    cv2.rectangle(frame, (0, 0), (w, wall_y), (44, 46, 42), -1)
    for gx in [w//2-100, w//2+100]:
        cv2.rectangle(frame, (gx-8, wall_y-70), (gx+8, wall_y+20), (58, 56, 50), -1)
    cv2.line(frame, (w//2-92, wall_y-55), (w//2+92, wall_y-55), (220, 60, 30), 5)
    vx = int(w*0.35 + w*0.3*((t*0.1) % 1.0))
    vy = int(h*0.50)
    scale = 0.65 + 0.05*math.sin(t*0.2)
    _draw_truck(frame, vx, vy, scale)
    plate_x, plate_y = vx-20, vy+12
    cv2.rectangle(frame, (plate_x, plate_y), (plate_x+50, plate_y+14), (210, 210, 180), -1)
    cv2.putText(frame, "TN04AB1234", (plate_x+2, plate_y+11), cv2.FONT_HERSHEY_SIMPLEX, 0.26, (20,20,20), 1)
    cv2.rectangle(frame, (plate_x-2, plate_y-2), (plate_x+52, plate_y+16), (59, 246, 130), 2)
    cv2.rectangle(frame, (10, 30), (240, 85), (0,0,0), -1)
    cv2.putText(frame, "GATE EXIT SOUTH", (14, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (34, 211, 160), 1)
    cv2.putText(frame, "LPR: TN04AB1234", (14, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (59, 246, 130), 1)
    cv2.putText(frame, "STATUS: APPROVED", (14, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (34, 211, 160), 1)
    return _apply_theme(frame, theme)


def _scene_yard_overview(h, w, t, theme='dark'):
    frame = np.zeros((h, w, 3), dtype=np.uint8)
    _light = (theme == 'light')
    _sky_ground(frame, h, w, (40, 42, 38), (42, 40, 36), 0.38)
    _perspective_floor(frame, h, w, int(h*0.38))
    wall_y = int(h*0.38)
    cv2.rectangle(frame, (0, 0), (w, wall_y), (50, 48, 44), -1)
    cv2.rectangle(frame, (0, wall_y-4), (w, wall_y), (65, 62, 55), -1)
    for dx in [60, 220, 380, 540, 700]:
        cv2.rectangle(frame, (dx, wall_y-80), (dx+70, wall_y), (20, 18, 16), -1)
        cv2.rectangle(frame, (dx, wall_y-80), (dx+70, wall_y), (62, 58, 52), 2)
    trucks = [(80, 0.18), (280, 0.22), (500, 0.15), (680, 0.20)]
    for ti, (tx, spd) in enumerate(trucks):
        offset = int(12*math.sin(t*spd + ti*1.5))
        ty = int(h*0.52) + offset
        _draw_truck(frame, tx, ty, 0.65)
    for wi in range(4):
        wpx = int(w*(0.15+wi*0.22) + 20*math.sin(t*0.4+wi*1.2))
        wpy = int(h*0.65 + wi*8)
        _draw_person(frame, wpx, wpy, 0.75)
    for i, (ppx, ppy) in enumerate([(150, int(h*0.70)), (350, int(h*0.68)), (600, int(h*0.72))]):
        _draw_pallet(frame, ppx, ppy, 0.8)
    cv2.rectangle(frame, (10, 30), (240, 85), (0,0,0), -1)
    cv2.putText(frame, "YARD OVERVIEW", (14, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (34, 211, 160), 1)
    cv2.putText(frame, "VEHICLES: 4  PERSONS: 4", (14, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1)
    cv2.putText(frame, "YARD CAPACITY: 68%", (14, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.32, (245, 166, 35), 1)
    return _apply_theme(frame, theme)
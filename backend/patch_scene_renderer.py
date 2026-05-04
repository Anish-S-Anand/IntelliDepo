"""Patch scene_renderer.py to support light/dark theme."""
import re

path = "/app/app/depot/vision/scene_renderer.py"
src = open(path).read()

# 1. Add theme param to render_scene
src = src.replace(
    "def render_scene(scene_idx: int, frame_num: int) -> np.ndarray:",
    "def render_scene(scene_idx: int, frame_num: int, theme: str = 'dark') -> np.ndarray:"
)

# 2. Pass theme to each scene function call
for fn in ["_scene_gate_entry", "_scene_zone_overhead", "_scene_loading_bay",
           "_scene_perimeter", "_scene_gate_exit", "_scene_yard_overview"]:
    src = src.replace(f"return {fn}(h, w, t)", f"return {fn}(h, w, t, theme)")

# 3. Add theme param to each scene function definition
for fn in ["_scene_gate_entry", "_scene_zone_overhead", "_scene_loading_bay",
           "_scene_perimeter", "_scene_gate_exit", "_scene_yard_overview"]:
    src = src.replace(f"def {fn}(h, w, t):", f"def {fn}(h, w, t, theme='dark'):")

# 4. Inject theme-aware color multiplier at start of each scene function body
# We'll add a helper call right after the frame = np.zeros line
LIGHT_PATCH = """
    # Theme: light = bright daylight, dark = CCTV night
    _light = (theme == 'light')
"""

# Insert after the np.zeros line in each scene
src = src.replace(
    "    frame = np.zeros((h, w, 3), dtype=np.uint8)\n    _sky_ground",
    "    frame = np.zeros((h, w, 3), dtype=np.uint8)\n    _light = (theme == 'light')\n    _sky_ground"
)
src = src.replace(
    "    frame = np.zeros((h, w, 3), dtype=np.uint8)\n    for y in range(h):\n        shade",
    "    frame = np.zeros((h, w, 3), dtype=np.uint8)\n    _light = (theme == 'light')\n    for y in range(h):\n        shade"
)
src = src.replace(
    "    frame = np.zeros((h, w, 3), dtype=np.uint8)\n    for y in range(h):\n        g",
    "    frame = np.zeros((h, w, 3), dtype=np.uint8)\n    _light = (theme == 'light')\n    for y in range(h):\n        g"
)

# 5. Add _apply_theme helper before render_scene
HELPER = '''
def _apply_theme(frame: np.ndarray, theme: str) -> np.ndarray:
    """Apply light/dark theme to a rendered scene frame."""
    if theme == 'light':
        # Bright daylight: boost all channels significantly
        frame = np.clip(frame.astype('int16') + 110, 0, 255).astype('uint8')
        # Warm tint
        frame[:, :, 2] = np.clip(frame[:, :, 2].astype('int16') + 20, 0, 255).astype('uint8')
        frame[:, :, 0] = np.clip(frame[:, :, 0].astype('int16') - 8, 0, 255).astype('uint8')
    return frame

'''

src = HELPER + src

# 6. Apply theme at end of each scene (before return frame)
for fn in ["_scene_gate_entry", "_scene_zone_overhead", "_scene_loading_bay",
           "_scene_gate_exit", "_scene_yard_overview"]:
    src = src.replace(
        f"    return frame\n\n\ndef _{fn.split('_scene_')[1] if '_scene_' in fn else fn}",
        f"    return _apply_theme(frame, theme)\n\n\ndef _{fn.split('_scene_')[1] if '_scene_' in fn else fn}"
    )

# Handle last function (yard_overview) and perimeter separately
src = re.sub(
    r'(def _scene_perimeter.*?)(    return frame\n)',
    lambda m: m.group(1) + "    return _apply_theme(frame, theme) if theme == 'light' else frame\n",
    src, flags=re.DOTALL, count=1
)

# Simpler: just replace all "    return frame\n" at end of scene functions
# by adding theme application
src = src.replace("    return frame\n\n\ndef _scene_", "    return _apply_theme(frame, theme)\n\n\ndef _scene_")
# Last function
src = src.rstrip()
if src.endswith("    return frame"):
    src = src[:-len("    return frame")] + "    return _apply_theme(frame, theme)"

open(path, "w").write(src)
print("Patched OK, size:", len(src))

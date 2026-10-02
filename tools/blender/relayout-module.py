"""Re-place and re-route the pluggable module's board to engineering layout rules (design review 10/01/2026).

Run once after convert-module-twin.py / complete-module-lpo.py (it moves parts, so it is not idempotent: start
from the GLB those scripts export, e.g. git show 84a05ff:public/models/osfp-module-runtime.glb):
  blender --background --factory-startup --python tools/blender/relayout-module.py

What changes (all representative, "as drawn"; no teardown of this module is public):
- The DSP sits right behind the edge connector's breakout, so the 16 host pairs run about 3 mm, straight in.
  (They ran 2.7 cm through the power section, between the switching inductors and their controllers.)
- The point-of-load power stage (two controllers, four inductors) moves beside the DSP's line-side edge, outboard
  of a compressed line-side bus that keeps 1.3 mm from every inductor, then fans out to the driver and TIA.
- On the photonic chip the lasers move to the chip's host-side edge, between the bond pads of the lanes they feed,
  and the Mach-Zehnder modulators move up to the driver: the RF line from each driver bond pad to its modulator
  electrode is 3.4 mm (was 6 mm, running beside the lasers and crossed by the laser feeds). Each RF line lands on
  the electrode on the arm away from its laser feed, so no laser waveguide crosses an RF line.
Metadata routes, anchors and analog anchors are updated with the geometry; contacts and optics are unchanged.
"""
import bpy, bmesh, json, math, struct
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'public/models/osfp-module-runtime.glb'
raw = TARGET.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + size])
meta = next(json.loads(n['extras']['ifx']) for n in doc['nodes'] if n.get('extras', {}).get('ifx'))
routes = {r['name']: r for r in meta['routes']}

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(TARGET))
root = bpy.data.objects['IFX_OSFP']

def B(p):  # glTF metres -> Blender metres
    return Vector((p[0], -p[2], p[1]))
def G(v):  # Blender metres -> glTF metres
    return (v.x, v.z, -v.y)
CM = .01
def descendants(name):
    o = bpy.data.objects[name]
    return [c for c in o.children_recursive if c.type == 'MESH']
def edit_verts(o, fn):
    mw = o.matrix_world; inv = mw.inverted()
    for v in o.data.vertices:
        g = G(mw @ v.co); n = fn(g)
        if n is not None: v.co = inv @ B(n)
    o.data.update()
def inbox(g, x0, x1, z0, z1):
    return x0 * CM <= g[0] <= x1 * CM and z0 * CM <= g[2] <= z1 * CM

# ---- 1. DSP, its marking, underfill and gap pad: right behind the connector breakout ----
DSP_DX = -1.75 * CM
for name in ['SHARED_PART_DSP', 'SHARED_03_THERMAL']:
    for o in descendants(name): edit_verts(o, lambda g: (g[0] + DSP_DX, g[1], g[2]))

# ---- 2. Power stage beside the DSP's line-side edge, outboard of the line bus ----
moves = [  # (x0, x1, z0, z1) region in cm, (dx, dz) in cm
    ((-4.07, -3.73, -0.16, 0.16), (1.55, 0.58)),    # controller -> (-2.35, +0.58)
    ((-3.17, -2.83, -0.16, 0.16), (0.65, -0.58)),   # controller -> (-2.35, -0.58)
    ((-3.77, -3.43, 0.37, 0.73), (1.65, 0.03)),     # inductor   -> (-1.95, +0.58)
    ((-3.77, -3.43, -0.73, -0.37), (1.65, -0.03)),  # inductor   -> (-1.95, -0.58)
    ((-3.27, -2.93, 0.37, 0.73), (1.60, 0.03)),     # inductor   -> (-1.50, +0.58)
    ((-3.27, -2.93, -0.73, -0.37), (1.60, -0.03)),  # inductor   -> (-1.50, -0.58)
    ((-2.80, -2.36, -0.93, -0.61), (1.98, 0.05)),   # controller IC under the old DSP corner -> (-0.60, -0.72)
]
for o in descendants('PART_DCDC'):
    def mv(g):
        for (x0, x1, z0, z1), (dx, dz) in moves:
            if inbox(g, x0, x1, z0, z1): return (g[0] + dx * CM, g[1], g[2] + dz * CM)
        return None
    edit_verts(o, mv)

# ---- 3. Lasers to the photonic chip's host-side edge, shortened to 1.3 mm ----
L0, L1, N0 = 1.538, 1.723, 1.445          # old x span, new start (cm); new length 1.3 mm
for o in descendants('PART_LASERS'):
    edit_verts(o, lambda g: (( N0 + (g[0] / CM - L0) * (0.13 / (L1 - L0))) * CM, g[1], g[2]))

# ---- 4. Routes ----
MZ_DX = -0.26 * CM                        # modulators move up to the driver
Y = .00273
lane = lambda i, rx: (-.001 - i * .00079) if rx else (.00665 - i * .00079)
K = .4                                     # line-side bus compression (outboard space for the power stage)
for i in range(8):
    zl = lane(i, False); k = i // 2; zm = (lane(2 * k, False) + lane(2 * k + 1, False)) / 2; s = 1 if i % 2 == 0 else -1
    num = f'{i + 1:02d}'
    for arm in ['-1', '1']:
        r = routes[f'TX {num} MZM arm {arm}']
        r['points'] = [[p[0] + MZ_DX if p[0] < .03 else p[0], p[1], p[2]] for p in r['points']]
    rf = routes[f'TX RF feed {i + 1}']; y_rf = rf['points'][0][1]
    rf['points'] = [[.0140, y_rf, zl], [.0145, y_rf, zl + s * .0003], [.0174, y_rf, zl + s * .0003]]
    for h in [0, 1]:
        if 2 * k + h == i:
            cw = routes[f'CW feed {k} {h}']; y0, y1 = cw['points'][0][1], cw['points'][-1][1]
            cw['points'] = [[.01575, y0, zm], [.0159, y1, zm], [.01612, y1, zl], [.0163, y1, zl]]
    for rx in [False, True]:
        prefix = 'RX' if rx else 'TX'; z = lane(i, rx)
        for sign in [-1, 1]:
            zp = z + sign * .000072; zb = z * K + sign * .000072
            host = routes[f'{prefix} host copper {i} {sign}']
            bankz = host['points'][7][2]
            host['points'] = host['points'][:8] + [[-.0410, Y, bankz]]
            routes[f'{prefix} engine copper {i} {sign}']['points'] = [[-.0260, Y, zb], [-.0245, Y, zb], [.0030, Y, zb], [.0060, Y, zp], [.008450001, Y, zp]]
            lpo = routes[f'{prefix} LPO copper {i} {sign}']
            lpo['points'] = lpo['points'][:8] + [[-.0395, Y, zb], [.0030, Y, zb], [.0060, Y, zp], [.008450001, Y, zp]]

# Rebuild the route conductors from the metadata (same tube profile as convert-module-twin.py).
mats = {m.name.split(' | ')[0]: m for m in bpy.data.materials if ' | ' in m.name}
SIDES = 6
parts = {}
def tube(parent, mat, points, radius):
    vs, fs = parts.setdefault((parent, mat), ([], []))
    for a, b in zip(points, points[1:]):
        a, b = B(a), B(b); d = b - a
        if d.length < 1e-10: continue
        d.normalize(); u = d.cross(Vector((0, 0, 1)))
        if u.length < .1: u = d.cross(Vector((0, 1, 0)))
        u.normalize(); v = d.cross(u); base = len(vs)
        for p in [a, b]:
            for k in range(SIDES): vs.append(tuple(p + radius * (math.cos(k * math.tau / SIDES) * u + math.sin(k * math.tau / SIDES) * v)))
        for k in range(SIDES): n = (k + 1) % SIDES; fs.append((base + k, base + n, base + SIDES + n, base + SIDES + k))
        fs.extend([tuple(base + k for k in range(SIDES - 1, -1, -1)), tuple(base + SIDES + k for k in range(SIDES))])
for group in ['PART_OPTICAL_ROUTES', 'PART_DSP_TRACES', 'LPO_BYPASS']:
    for o in list(bpy.data.objects[group].children): bpy.data.objects.remove(o, do_unlink=True)
for name, r in routes.items():
    pts = r['points']
    if ' host copper ' in name or ' engine copper ' in name: tube('PART_DSP_TRACES', '06', pts, .000028)
    elif ' LPO copper ' in name: tube('LPO_BYPASS', '06', pts, .000028)
    elif name.startswith('TX RF feed'): tube('PART_OPTICAL_ROUTES', '06', pts, .000012)
    elif name.startswith('CW feed'): tube('PART_OPTICAL_ROUTES', '15', pts, .00003)
    elif 'glass fiber' in name: tube('PART_OPTICAL_ROUTES', '13' if name.startswith('TX') else '14', pts, .000035)
    elif 'MZM arm' in name: tube('PART_OPTICAL_ROUTES', '13', pts, .000028)
    elif 'waveguide' in name: tube('PART_OPTICAL_ROUTES', '14', pts, .000028)
for (parent, mat), (vs, fs) in parts.items():
    mesh = bpy.data.meshes.new('Authored routes'); mesh.from_pydata(vs, [], fs); mesh.update()
    o = bpy.data.objects.new(f'{parent} {mats[mat].name}', mesh); bpy.context.collection.objects.link(o)
    o.parent = bpy.data.objects[parent]; o.data.materials.append(mats[mat]); o['authoredStatic'] = True

# ---- 5. Transmit metal on the photonic chip: bond pad, then the electrodes along both modulator arms ----
pic_gold = bpy.data.objects['PART_PIC__05']
bm = bmesh.new(); bm.from_mesh(pic_gold.data); mw = pic_gold.matrix_world
doomed = [f for f in bm.faces if G(mw @ f.calc_center_median())[2] > .0005]
bmesh.ops.delete(bm, geom=doomed, context='FACES'); bm.to_mesh(pic_gold.data); bm.free()
gv, gf = [], []
def flat(x0, x1, z0, z1, y0, y1):
    b = len(gv)
    for y in [y0, y1]:
        for x, z in [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]: gv.append(tuple(B((x, y, z))))
    gf.extend([(b, b + 1, b + 2, b + 3), (b + 7, b + 6, b + 5, b + 4), (b, b + 4, b + 5, b + 1), (b + 1, b + 5, b + 6, b + 2), (b + 2, b + 6, b + 7, b + 3), (b + 3, b + 7, b + 4, b)])
for i in range(8):
    zl = lane(i, False)
    flat(.01395, .01435, zl - .00008, zl + .00008, .00360, .00369)                    # driver bond pad
    for e in [-1, 1]: flat(.0174, .0232, zl + e * .00028 - .00004, zl + e * .00028 + .00004, .00360, .00367)   # electrodes
mesh = bpy.data.meshes.new('Transmit electrodes'); mesh.from_pydata(gv, [], gf); mesh.update()
o = bpy.data.objects.new('PART_PIC transmit electrodes', mesh); bpy.context.collection.objects.link(o)
o.parent = bpy.data.objects['PART_PIC']; o.data.materials.append(mats['05']); o['authoredStatic'] = True

# ---- 6. Anchors ----
def shift(name, dx=0, dz=0, x=None):
    p = meta['anchors'][name]['position']
    meta['anchors'][name]['position'] = [x if x is not None else p[0] + dx, p[1], p[2] + dz]
shift('dsp', dx=DSP_DX)
meta['anchors']['dcdc']['position'] = [-.0195, .0044, .0058]
shift('lasers', x=.0151)
shift('mzm', dx=MZ_DX)
meta['analogAnchors'] = [{key: meta['anchors'][key]['position'] for key in ['driver', 'tia', 'lasers', 'mzm', 'pd']}]
meta['routes'] = list(routes.values())
meta['layout'] = ('Design review 10/01/2026, as drawn: DSP right behind the connector breakout (host pairs about 3 mm); '
                  'point-of-load stage outboard of a compressed line-side bus (1.3 mm clearance); lasers at the photonic '
                  'chip edge between the pads of the lanes they feed; 3.4 mm RF lines from driver pad to modulator electrode.')
root['ifx'] = json.dumps(meta, separators=(',', ':'))

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'tools/blender/osfp-module-complete.blend'))
staged = TARGET.with_name(TARGET.stem + '.staged.glb')
bpy.ops.export_scene.gltf(filepath=str(staged), export_format='GLB', export_yup=True, export_extras=True, export_cameras=False, export_lights=False)
staged.replace(TARGET)
print('RELAYOUT MODULE', TARGET.stat().st_size)

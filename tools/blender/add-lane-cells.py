"""Draw every lane's own analog cell, so each stage of the module shows eight per direction (Reed, 10/03/2026).

Before this the transmit driver and the receive TIA were each one plain die with eight bond wires, and each
Mach-Zehnder modulator was a hairline pair of arms between two electrodes, so at the overview distance the
module read as four modulators against eight TIAs. The route data already carried 8 + 8 lanes; this adds the
geometry the eye counts:
  - DRIVER channel cells: eight raised output stages on the driver die, one per transmit lane
  - TIA channel cells: eight raised input stages on the TIA die, one per receive lane
  - MZM modulator bodies: eight cladded phase-shifter slabs, one per transmit lane, under the arm pair
  - PD: the eight photodiode pads and packages already in PART_PIC__05 / __07 are unchanged
Eight lanes each way are four per DR4 engine; the four lasers stay shared, each feeding two modulators.
Placement is representative (no teardown of this module is public).

Run once, on the GLB that relayout-module.py exported (it is idempotent: earlier cells are removed first):
  blender --background --factory-startup --python tools/blender/add-lane-cells.py
"""
import bpy, json, struct
from pathlib import Path
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / 'public/models/osfp-module-runtime.glb'
raw = TARGET.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
doc = json.loads(raw[20:20 + size])
meta = next(json.loads(n['extras']['ifx']) for n in doc['nodes'] if n.get('extras', {}).get('ifx'))

bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(TARGET))
root = bpy.data.objects['IFX_OSFP']
mats = {m.name.split(' | ')[0]: m for m in bpy.data.materials if ' | ' in m.name}
NAMES = ['DRIVER channel cells', 'TIA channel cells', 'MZM modulator bodies']
for o in list(bpy.data.objects):
    if any(o.name.startswith(n) for n in NAMES): bpy.data.objects.remove(o, do_unlink=True)

def B(x, y, z):  # glTF metres -> Blender metres
    return (x, -z, y)
def box(vs, fs, x0, x1, y0, y1, z0, z1):
    b = len(vs)
    for y in (y0, y1):
        for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1)): vs.append(B(x, y, z))
    # outward-facing top and four sides; no bottom (it would sit coplanar on the die or chip face)
    fs.extend([(b + 7, b + 6, b + 5, b + 4), (b + 4, b + 5, b + 1, b), (b + 5, b + 6, b + 2, b + 1),
               (b + 6, b + 7, b + 3, b + 2), (b + 7, b + 4, b, b + 3)])
def emit(name, parent, mat, vs, fs):
    me = bpy.data.meshes.new(name); me.from_pydata(vs, [], fs); me.update()
    o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    o.data.materials.append(mats[mat]); o.parent = bpy.data.objects[parent]; o.matrix_world = Matrix.Identity(4); o['authoredStatic'] = True
    for p in me.polygons: p.use_smooth = False
    return o

mm = .001
tx = lambda i: .00665 - i * .00079
rx = lambda i: -.001 - i * .00079
# driver / TIA die top is y = 3.55 mm; cells are 1.9 mm x 0.52 mm x 30 um, clear of the die marking (x 9.6 to 11.2 mm)
dv, df, tv, tf, mv, mf = [], [], [], [], [], []
for i in range(8):
    box(dv, df, 11.40 * mm, 13.30 * mm, 3.550 * mm, 3.580 * mm, tx(i) - .26 * mm, tx(i) + .26 * mm)
    box(tv, tf, 11.40 * mm, 13.30 * mm, 3.550 * mm, 3.580 * mm, rx(i) - .26 * mm, rx(i) + .26 * mm)
    # cladding slab under the arm pair (arms +/-0.18 mm, electrodes +/-0.28 mm, body +/-0.33 mm inside the 0.79 mm lane pitch): 40 um proud of the chip face
    box(mv, mf, 17.20 * mm, 23.40 * mm, 3.600 * mm, 3.616 * mm, tx(i) - .33 * mm, tx(i) + .33 * mm)
emit('DRIVER channel cells', 'PART_DRIVER', '07', dv, df)
emit('TIA channel cells', 'PART_TIA', '07', tv, tf)
emit('MZM modulator bodies', 'PART_PIC', '03', mv, mf)

meta['laneCells'] = {'perDirection': 8, 'perEngine': 4, 'driverCells': 8, 'tiaCells': 8, 'modulators': 8, 'photodiodes': 8, 'lasers': 4,
                     'lasersShared': 'four CW lasers, each feeding two modulators (one per lane pair)'}
root['ifx'] = json.dumps(meta, separators=(',', ':'))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'tools/blender/osfp-module-complete.blend'))
staged = TARGET.with_name(TARGET.stem + '.staged.glb')
bpy.ops.export_scene.gltf(filepath=str(staged), export_format='GLB', export_yup=True, export_extras=True, export_cameras=False, export_lights=False)
staged.replace(TARGET)
print('LANE CELLS', TARGET.stat().st_size)

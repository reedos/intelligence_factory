"""Replace the pluggable module's OSFP shell and pull tab with the same correct parts the
coherent pluggable draws (osfp_parts.py), so both share one shell and one pull tab shape and
differ only in color code, label and internals (Reed, 10/02/2026).

Before this fix the module's '04_COVER' drew its own body (a different shape from the
coherent pluggable's OSFP shell) and '05_PULL_TAB' was a yellow loop roughly twice the OSFP
MSA's 116 mm maximum length with a pull tab (its tip reached 14.6 mm past the nose, not the
~8 mm a real pull tab adds). Yellow itself is correct: OSFP MSA rev 5.22 Table 3-3 gives
yellow (Pantone 107U) for 1310 nm, up to 500 m solutions (DR4), which is this module's PMD
(side-module.js, lane-math.test.ts).

Run after the module's own internals are rebuilt (relayout-module.py / convert-module-twin.py
/ complete-module-lpo.py): blender --background --python tools/blender/build-module-shell.py
"""
import bpy
import sys
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
import osfp_parts

ROOT = HERE.parent.parent
TARGET = ROOT / 'public' / 'models' / 'osfp-module-runtime.glb'

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(TARGET))

cover = bpy.data.objects['04_COVER']
pull = bpy.data.objects['05_PULL_TAB']
# The existing shell and tab's own measured envelope (inspect-module.py, 10/02/2026) sets
# where the new parts land, so they still meet the board, connectors and dies without a gap:
# cover x [-46.9, 53.9] mm, y (width) +/-11.29 mm, z (height) [5.35, 13.0] mm (the OSFP MSA's
# 13.0 mm max); the nose (fiber end, +x) sits at x = 53.9 mm, matching the coherent
# pluggable's own x_nose constant exactly (both are the same 107.8 x 22.58 x 13.0 mm OSFP
# envelope: ascentoptics-osfp-form-factor, src/data.js osfpSize).
for o in list(cover.children) + list(pull.children):
    bpy.data.objects.remove(o, do_unlink=True)

# Module-local box/xyz/mat in the same (length, height, width) input convention osfp_parts.py
# expects, mapped onto this asset's own (already Blender-native after glTF import) axes:
# Blender X = length, Y = width, Z = height, all in metres. cm input -> metres, with the
# caller's y (height) and z (width) swapped onto this asset's Y/Z (both housing and tab are
# left/right symmetric, so the width axis's sign does not matter).
def xyz(pos):
    x, y, z = pos
    return (x * .01, z * .01, y * .01)


def mat(name, color, metallic, roughness, alpha=1):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*color, alpha)
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Alpha'].default_value = alpha
    if alpha < 1:
        m.surface_render_method = 'DITHERED'
    return m


def box(name, pos, size, material, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(pos))
    o = bpy.context.object
    o.name = name
    x, y, z = size
    o.dimensions = (x * .01, z * .01, y * .01)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        b = o.modifiers.new('Manufactured edge radius', 'BEVEL')
        b.width = min(bevel, min(size) * .42) * .01
        b.segments = 3
        bpy.ops.object.modifier_apply(modifier=b.name)
        w = o.modifiers.new('Face weighted normals', 'WEIGHTED_NORMAL')
        w.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=w.name)
    for p in o.data.polygons:
        p.use_smooth = True
    o.parent = cover
    o['authoredStatic'] = True
    return o


mats = {
    'lid': mat('Satin nickel aluminium', (.48, .52, .58), .82, .3),
    'edge': mat('Machined edge highlights', (.72, .76, .81), .86, .23),
    'dark': mat('Dark anodized metal', (.055, .072, .09), .5, .44),
}
# cy = 0.535 cm (the existing cover's own bottom, measured) + .045 so osfp_parts' own
# `b = cy - .045` lands back on that bottom; cx = 0 so the shell is centred the same as the
# board (02_BOARD spans -5.39 to +5.37 cm) and fully encloses it, not offset the way the old
# cover was. height reaches the OSFP MSA's 13.0 mm max body height exactly from that bottom
# (side-module-blender.test.ts checks the assembled 01_BASE+02_BOARD+03_THERMAL+04_COVER
# envelope against 10.78 x 1.3 x 2.258 cm).
osfp_parts.osfp_top_housing(box, '04_COVER', cx=0, cy=.58, cz=0, length=10.78, width=2.258, mats=mats, height=1.3 - .535)

# the molded pull tab, now parented under 05_PULL_TAB, in yellow (OSFP MSA rev 5.22 Table
# 3-3: 1310 nm, up to 500 m, DR4 -- this module's PMD)
def tab_box(name, pos, size, material, bevel=.025):
    o = box(name, pos, size, material, bevel)
    o.parent = pull
    return o


osfp_parts.osfp_pull_tab(tab_box, xyz, mat, mats, (.90, .70, .05), 'yellow (OSFP MSA rev 5.22 Table 3-3: DR4, 1310 nm up to 500 m)')
for o in bpy.data.objects:
    if o.name == 'OSFP release pull tab':
        o.parent = pull

bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'tools' / 'blender' / 'osfp-module-complete.blend'))
bpy.ops.export_scene.gltf(filepath=str(TARGET), export_format='GLB', export_yup=True, export_extras=True, export_cameras=False, export_lights=False)
print('MODULE SHELL REBUILT', TARGET, TARGET.stat().st_size)

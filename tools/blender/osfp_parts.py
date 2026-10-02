"""Shared OSFP shell and pull-tab builder (Reed, 10/02/2026).

Both the coherent pluggable (build-links.py) and the pluggable module (build-module-shell.py)
are OSFP MSA modules at the same 107.8 x 22.58 x 13.0 mm envelope (OSFP body, reported:
ascentoptics-osfp-form-factor, restating the OSFP MSA). They draw one correct shell and one
correct pull tab from here; only the label, pull-tab color code (OSFP MSA rev 5.22 sec. 3.8,
Table 3-3) and internals differ between them.

Every distance below is in the CALLER's own unit (whatever `box_fn`/`xyz_fn` expect); callers
pass their own `box`, `xyz` and `mat` so this stays free of any one script's coordinate
convention or Blender-import state.
"""
import bpy
import math


def reweight(o):
    # A boolean leaves smooth-shaded n-gons whose vertex normals lean toward the side walls,
    # which reads as a sloped frustum. Re-weight by face area.
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    w = o.modifiers.new('Face weighted normals', 'WEIGHTED_NORMAL')
    w.keep_sharp = True
    w.weight = 100
    bpy.ops.object.modifier_apply(modifier=w.name)


def cut_away(target, cutters):
    for c in cutters:
        mod = target.modifiers.new('Cast pocket', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = c
        bpy.context.view_layer.objects.active = target
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(c, do_unlink=True)
    reweight(target)


def osfp_top_housing(box_fn, name, cx, cy, cz, length, width, mats, height=.6):
    """Die-cast OSFP top housing with an integrated closed-top heat sink: a ceiling plate,
    longitudinal fins running the whole length, and a flat top skin, so air can pass along the
    module (OSFP MSA Rev 5.0 sec. 3.3, "Heat Sink, Closed Top"). The channels stay open at
    both ends. Fin count, pitch and heights are representative; the MSA gives example designs,
    not this one. `height` is the housing's own total rise above `cy - .045`; callers set it so
    the assembled stack reaches the OSFP MSA's 13.0 mm max body height exactly.
    """
    b = cy - .045
    H = height
    skin = .08
    wall = .1
    ceiling = box_fn(name + '_ceiling plate', (cx, b + .05, cz), (length, .1, width), mats['lid'], .04)
    # Host end: the upper lip of the nose, without fins, with ventilation slots (OSFP MSA Rev
    # 5.0 sec. 3.2, Fig. 3-11); slot sizes are representative.
    nose = .6
    x0 = cx - length / 2
    cut_away(ceiling, [box_fn('cut', (x0 + .3, b + .05, cz + k * .26), (.3, .2, .12), mats['lid'], 0) for k in range(-3, 4)])
    for s in [-1, 1]:
        box_fn(name + '_side wall', (cx, b + .1 + (H - .1) / 2, cz + s * (width / 2 - wall / 2)), (length, H - .1, wall), mats['lid'], .03)
        box_fn(name + '_parting seam', (cx, b + .012, cz + s * (width / 2 - .004)), (length - .12, .012, .01), mats['dark'], .003)
    for x in [-1, 1]:
        box_fn(name + '_parting seam', (cx + x * (length / 2 - .004), b + .012, cz), (.01, .012, width - .12), mats['dark'], .003)
    n = 11
    span = width - 2 * wall - .16
    for i in range(n):
        z = cz - span / 2 + i * span / (n - 1)
        box_fn(name + '_heat sink fin', (cx + nose / 2, b + .1 + (H - .1 - skin) / 2, z), (length - nose - .02, H - .1 - skin, .05), mats['edge'], .012)
    # Inset the skin between the side walls (not flush with their outer face): a full-width skin's own top and
    # side faces would sit exactly coplanar with the walls' own top cap and outer face, a z-fighting seam the
    # coplanar gate (tools/coplanar.mjs) catches.
    top = box_fn(name + '_top skin', (cx + nose / 2, b + H - skin / 2, cz), (length - nose, skin, width - 2 * wall), mats['lid'], .04)
    # A shallow label recess where OSFP MSA rev 5.22 Fig. 3-4 recommends the label: 15 x 20 mm
    # on the top face at the fiber end (+x here).
    cut = box_fn('Temporary cover label pocket', (cx + length / 2 - 1.25, b + H, cz), (1.56, .03, 2.06), mats['lid'], .01)
    pocket = top.modifiers.new('Label recess', 'BOOLEAN')
    pocket.operation = 'DIFFERENCE'
    pocket.object = cut
    bpy.context.view_layer.objects.active = top
    bpy.ops.object.modifier_apply(modifier=pocket.name)
    bpy.data.objects.remove(cut, do_unlink=True)
    reweight(top)


def osfp_pull_tab(box_fn, xyz_fn, mat_fn, mats, color, color_name, x_nose=5.39, reach=.8):
    """Molded pull tab: a rounded tongue with an oval finger hole reaching about 8 mm past the
    nose, joined by a crossbar to two arms that run back along the side walls to the latch.
    With it the model stays within the 116 mm maximum Cisco lists for its OSFP 800G modules
    with pull tab. `color`/`color_name` set the OSFP MSA color code (rev 5.22 sec. 3.8, Table
    3-3): e.g. white for 1550 nm modules up to 80 km (no coherent row, nearest entry), yellow
    for 1310 nm DR4 up to 500 m. Shape and arm routing are representative, shared with every
    other OSFP part drawn from this file so only the color and label differ.
    """
    mats['tab'] = mat_fn('Pull tab ' + color_name, color, 0, .55)
    y, t = .30, .15
    hw = .55
    cx = x_nose + reach - hw
    outline = [(x_nose - .06, -1.14), (x_nose + .12, -1.14), (x_nose + .28, -hw)]
    outline += [(cx + hw * math.cos(a), hw * math.sin(a)) for a in [-math.pi / 2 + i * math.pi / 20 for i in range(21)]]
    outline += [(x_nose + .28, hw), (x_nose + .12, 1.14), (x_nose - .06, 1.14)]
    verts = [xyz_fn((x, y + d, z)) for d in [-t / 2, t / 2] for x, z in outline]
    n = len(outline)
    faces = [tuple(range(n))[::-1], tuple(range(n, 2 * n))] + [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    mesh = bpy.data.meshes.new('OSFP release pull tab')
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    tab = bpy.data.objects.new('OSFP release pull tab', mesh)
    bpy.context.collection.objects.link(tab)
    mesh.materials.append(mats['tab'])
    bpy.ops.object.select_all(action='DESELECT')
    tab.select_set(True)
    bpy.context.view_layer.objects.active = tab
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=.01, depth=.01, location=xyz_fn((cx + .02, y, 0)))
    hole = bpy.context.object
    hole.scale = (.24, .34, t * 3)
    mod = tab.modifiers.new('Finger hole', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = hole
    bpy.context.view_layer.objects.active = tab
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(hole, do_unlink=True)
    b = tab.modifiers.new('Molded edge', 'BEVEL')
    b.width = .0003
    b.segments = 2
    b.limit_method = 'ANGLE'
    bpy.ops.object.modifier_apply(modifier=b.name)
    for p in tab.data.polygons:
        p.use_smooth = False
    for s in [-1, 1]:
        box_fn('OSFP release pull arm', ((1.85 + x_nose) / 2, y, s * 1.12), (x_nose - 1.85, .16, .04), mats['tab'], .012)
    return tab

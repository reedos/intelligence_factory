"""Shared OSFP shell and pull tab (Reed, 10/02/2026, revised after review).

Reed's own call on the pluggable module's shell and pull tab (public/models/osfp-module-runtime.glb,
its '04_COVER' and '05_PULL_TAB' groups) is correct as drawn and is not rebuilt here. The coherent
pluggable (build-links.py) is brought into the same family by importing those same two groups
directly from the module's GLB -- the same finned shell with a flat label section, and the same
rectangular pull tab shape -- rather than by a second, separately authored shell. Both are the same
107.8 x 22.58 x 13.0 mm OSFP envelope (OSFP body, reported: ascentoptics-osfp-form-factor, restating
the OSFP MSA; checked directly against product photos -- NVIDIA's MMS4X00-NM16 finned-top twin-port
OSFP, networking-docs.nvidia.com/mms4x00nm16, and Coherent's 800G OSFP 800ZR/ZR+ transceiver,
coherent.com/networking/transceivers/telecom/FTCE3L27E1PCL -- both show a finned shell with a flat
label field and a loop-style tab; Reed's call keeps the module's own rectangular tab style for both
rather than switching to a loop), so the import needs no rescaling, only a recolor of the pull tab
(OSFP MSA rev 5.22 sec. 3.8, Table 3-3) and a vertical shift onto the caller's own lid height.
"""
import bpy


def import_module_shell(glb_path, cx, cy, mats, tab_color, tab_color_name, cover_name='OSFP lifted cover', pull_name='OSFP release pull tab'):
    """Import the pluggable module's own '04_COVER' and '05_PULL_TAB' groups from its GLB
    (glb_path) into the current scene, discarding everything else in that file, and:
      - shift them so the cover's own bottom face lands at the caller's `cy - .045` (the same
        datum osfp_top_housing used to use), at `cx` along the length;
      - reassign the shell's own main material to the caller's mats['lid'] (so raycasting that
        matches a mesh's material name against /lifted cover/i, as side-links-blender.js does to
        find the cover and place the label, still finds it) and its edge/seam materials to
        mats['edge']/mats['dark'] where present;
      - recolor the pull tab to `tab_color` (an OSFP MSA Table 3-3 color code), leaving its own
        dark trim pieces alone.
    Returns (cover, pull) root objects.
    """
    before = set(bpy.data.objects.keys())
    bpy.ops.import_scene.gltf(filepath=str(glb_path))
    imported = [o for o in bpy.data.objects if o.name not in before]
    cover_root = next(o for o in imported if o.name == '04_COVER')
    pull_root = next(o for o in imported if o.name == '05_PULL_TAB')
    keep = {cover_root, pull_root} | set(cover_root.children_recursive) | set(pull_root.children_recursive)
    for o in imported:
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)

    # Shift onto the caller's own lid datum and length position. The module's own cover already
    # sits in the same length (X) and width (Y) range the caller's own `length`/`width` box calls
    # use (same OSFP envelope, same convention: +X the fiber end), so only height (Z, up) and a
    # length offset (if the caller centres its own body somewhere other than the module's x = 0)
    # need to move.
    cover_bottom = min(v[2] for m in cover_root.children_recursive if m.type == 'MESH' for v in [m.matrix_world @ c.co for c in m.data.vertices])
    dz = (cy - .045) * .01 - cover_bottom
    dx = cx * .01
    for root in (cover_root, pull_root):
        root.location.x += dx
        root.location.z += dz
    cover_root.name = cover_name
    pull_root.name = pull_name

    def recolor(root, mapping, default=None):
        for m in root.children_recursive:
            if m.type != 'MESH' or not m.data.materials:
                continue
            for slot, mat in enumerate(m.data.materials):
                if mat is None:
                    continue
                key = next((k for k in mapping if k in mat.name), None)
                m.data.materials[slot] = mapping[key] if key else (default if default is not None else mat)
                if (key or default is not None) and 'lifted cover' not in m.name and 'release pull' not in m.name:
                    m.name = (cover_name if root is cover_root else pull_name) + ' ' + m.name

    recolor(cover_root, {'Satin nickel aluminium': mats['lid'], 'Machined edge highlights': mats.get('edge'), 'Label stock': mats['lid'], 'solder mask': mats.get('dark', mats['lid'])}, default=mats['lid'])
    tab_mat = None
    for m in pull_root.children_recursive:
        if m.type == 'MESH' and m.data.materials:
            for mat in m.data.materials:
                if mat and 'Pull tab' in mat.name:
                    if tab_mat is None:
                        tab_mat = bpy.data.materials.new('Pull tab ' + tab_color_name)
                        tab_mat.use_nodes = True
                        tab_mat.diffuse_color = (*tab_color, 1)
                        p = tab_mat.node_tree.nodes.get('Principled BSDF')
                        p.inputs['Base Color'].default_value = (*tab_color, 1)
                        p.inputs['Metallic'].default_value = 0
                        p.inputs['Roughness'].default_value = .55
                        mats['tab'] = tab_mat
                    for slot, slot_mat in enumerate(m.data.materials):
                        if slot_mat is mat:
                            m.data.materials[slot] = tab_mat
                    if 'release pull' not in m.name:
                        m.name = pull_name + ' ' + m.name
    return cover_root, pull_root

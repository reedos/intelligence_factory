"""Shared Blender-authored solder geometry; runtime instancing preserves grids.
Two reflowed shapes: the BGA ball (12x8) and a lighter C4 bump (8x6), both
flattened top and bottom where they wet their pads. Exported as one GLB with
two named meshes; compute-blender.js picks the bump mesh for the C4 field.
Run: blender -b --factory-startup --python tools/blender/build-compute-solder.py
"""
import bpy, bmesh
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
m=bpy.data.materials.new('Satin SAC solder');m.use_nodes=True
p=m.node_tree.nodes.get('Principled BSDF')
# SAC solder is a dull satin grey (#b8bcc0), less mirror-like than polished metal.
p.inputs['Base Color'].default_value=(.48,.51,.53,1);p.inputs['Metallic'].default_value=1.0;p.inputs['Roughness'].default_value=.38

def reflowed(name,segments,rings,cut=.8,squash=.85):
    # Unit-radius sphere truncated where it meets the pads (|z|=0.8r leaves a
    # flat land of radius 0.6r), then squashed to the reflowed profile.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1)
    o=bpy.context.object;o.name=name
    bm=bmesh.new();bm.from_mesh(o.data)
    for sign in [1,-1]:
        geom=bm.verts[:]+bm.edges[:]+bm.faces[:]
        r=bmesh.ops.bisect_plane(bm,geom=geom,plane_co=Vector((0,0,sign*cut)),plane_no=Vector((0,0,sign)),clear_outer=True)
        edges=[e for e in r['geom_cut'] if isinstance(e,bmesh.types.BMEdge)]
        bmesh.ops.contextual_create(bm,geom=edges)
    for v in bm.verts:v.co.z*=squash
    bm.to_mesh(o.data);bm.free()
    for f in o.data.polygons:f.use_smooth=abs(f.normal.z)<.99
    o.data.materials.append(m)
    return o

reflowed('Authored reflowed solder ball',12,8)
bump=reflowed('Authored C4 bump',8,6);bump.location.x=3
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'compute-solder.blend'))
bpy.ops.export_scene.gltf(filepath=str(HERE.parents[1]/'public/models/compute-solder.glb'),export_format='GLB',export_yup=True)

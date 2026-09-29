"""Shared Blender-authored solder geometry; runtime instancing preserves grids."""
import bpy
from pathlib import Path
HERE=Path(__file__).resolve().parent
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,radius=1)
o=bpy.context.object;o.name='Authored reflowed solder ball'
for f in o.data.polygons:f.use_smooth=True
m=bpy.data.materials.new('Satin solder alloy');m.use_nodes=True
p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.52,.58,.63,1);p.inputs['Metallic'].default_value=.82;p.inputs['Roughness'].default_value=.31
o.data.materials.append(m)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'compute-solder.blend'))
bpy.ops.export_scene.gltf(filepath=str(HERE.parents[1]/'public/models/compute-solder.glb'),export_format='GLB',export_yup=True)

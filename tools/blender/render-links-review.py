"""Geometry review only: actual authored copper hardware in Blender Cycles.
Interactive signal overlays are rendered by Three.js, not in this contact sheet.
"""
import bpy
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'tools/blender/copper-hardware.blend'))
for o in bpy.context.scene.objects:
    if o.type!='MESH':continue
    if '_cover_' in o.name:
        for slot in o.material_slots:
            slot.material=slot.material.copy()
            slot.material.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.12
            slot.material.surface_render_method='DITHERED'
def area(name,position,power,size,color):
    data=bpy.data.lights.new(name,'AREA');data.energy=power*.035;data.shape='DISK';data.size=size;data.color=color
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=position
    o.rotation_euler=(Vector((0,.01,0))-o.location).to_track_quat('-Z','Y').to_euler()
area('Softbox key',(-.12,-.07,.19),9,.19,(.76,.85,1))
area('Warm edge',(.14,.05,.08),7,.12,(1,.75,.5))
area('Top reflection',(.0,.18,.17),12,.17,(.65,.84,1))
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,-.004))
floor=bpy.context.object;floor.name='REVIEW_ONLY floor'
m=bpy.data.materials.new('Review charcoal');m.diffuse_color=(.016,.022,.032,1);m.use_nodes=True
m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.016,.022,.032,1)
m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.35
floor.data.materials.append(m)
bpy.ops.object.camera_add(location=(.055,-.175,.175));camera=bpy.context.object
camera.rotation_euler=(Vector((0,.012,.010))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=.17
s=bpy.context.scene;s.camera=camera;s.render.engine='CYCLES';s.cycles.samples=48;s.cycles.use_denoising=True
s.world.color=(.16,.16,.16);s.render.resolution_x=1400;s.render.resolution_y=1050;s.render.resolution_percentage=100
s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.filepath=str(ROOT/'research/copper-redesign-review.png')
bpy.ops.render.render(write_still=True)

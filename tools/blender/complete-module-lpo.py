"""Complete the module's static asset with its alternate LPO copper layout.

Run after regenerating osfp-module-runtime.glb. All input routing comes from the
asset's reviewed public-layout metadata; no proprietary geometry is inferred.
The process is idempotent and saves an editable Blender source alongside GLB.
"""
import bpy
import json
import struct
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[2]
TARGET=ROOT/'public'/'models'/'osfp-module-runtime.glb'
raw=TARGET.read_bytes();size=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+size]);metadata=next(json.loads(n['extras']['ifx']) for n in doc['nodes'] if n.get('extras',{}).get('ifx'))
routes={r['name']:r for r in metadata['routes']}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(TARGET))
for o in list(bpy.data.objects):
    if o.name.startswith('LPO_BYPASS'):bpy.data.objects.remove(o,do_unlink=True)
board=bpy.data.objects.get('02_BOARD')
assert board is not None
material=bpy.data.materials.new('LPO authored copper');material.diffuse_color=(.305,.117,.012,1);material.use_nodes=True
p=material.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=material.diffuse_color
p.inputs['Metallic'].default_value=.66;p.inputs['Roughness'].default_value=.35
verts=[];faces=[]
for i in range(8):
    for prefix in ['TX','RX']:
        for sign in [-1,1]:
            host=routes[f'{prefix} host copper {i} {sign}']['points'];engine=routes[f'{prefix} engine copper {i} {sign}']['points']
            points=routes.get(f'{prefix} LPO copper {i} {sign}',{}).get('points') or [host[0],host[1],[-.004,host[0][1],host[0][2]],*engine[-2:]]
            for a,b in zip(points,points[1:]):
                a=Vector((a[0],-a[2],a[1]));b=Vector((b[0],-b[2],b[1]));d=b-a
                if d.length<1e-8:continue
                bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=.000028,depth=d.length,location=(a+b)*.5)
                o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.name='LPO_BYPASS_segment';o.data.materials.append(material)
parts=[o for o in bpy.data.objects if o.name.startswith('LPO_BYPASS_segment')]
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join()
o=bpy.context.object;o.name='LPO_BYPASS';world=o.matrix_world.copy();o.parent=board;o.matrix_world=world
o['authoredStatic']=True;o['basis']='Representative alternate copper traces. Same direct host-to-driver/TIA paths as the audited LPO diagram.'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools'/'blender'/'osfp-module-complete.blend'))
bpy.ops.export_scene.gltf(filepath=str(TARGET),export_format='GLB',export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_meshopt_compression_enable=True)
print('COMPLETE MODULE',TARGET.stat().st_size)

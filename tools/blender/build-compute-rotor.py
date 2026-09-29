"""Reusable authored rotor. Unit radius; runtime instancing supplies size and spin."""
import bpy,math
from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
m=bpy.data.materials.new('Molded fan graphite');m.use_nodes=True
p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.035,.045,.055,1);p.inputs['Metallic'].default_value=.25;p.inputs['Roughness'].default_value=.42
verts=[];faces=[]
for blade in range(7):
    base=len(verts)
    for layer in [-1,1]:
        for i in range(7):
            r=.18+i*.125;a=blade*math.tau/7+.38*(i/6)**1.3
            for edge in [-1,1]:
                aa=a+edge*(.2-.05*i/6);y=.06*edge*i/6+layer*.016
                verts.append((r*math.cos(aa),-r*math.sin(aa),y))
    for i in range(6):
        j=base+i*2;k=j+14
        faces += [(j,j+2,j+3,j+1),(k+1,k+3,k+2,k),(j,k,k+2,j+2),(j+3,k+3,k+1,j+1)]
    faces += [(base,base+1,base+15,base+14),(base+12,base+26,base+27,base+13)]
mesh=bpy.data.meshes.new('Swept seven-blade rotor');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('Blender compute rotor',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(m)
bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.18,depth=.115);hub=bpy.context.object;hub.data.materials.append(m)
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=o;bpy.ops.object.join()
mod=o.modifiers.new('Molded blade edges','BEVEL');mod.width=.008;mod.segments=2
o.modifiers.new('Weighted rotor normals','WEIGHTED_NORMAL')
bpy.ops.wm.save_as_mainfile(filepath=str(P/'compute-rotor.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public'/'models'/'compute-rotor.glb'),export_format='GLB',export_apply=True,export_extras=True,export_yup=True)

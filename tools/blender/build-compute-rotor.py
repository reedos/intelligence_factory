"""Reusable authored rotor. Unit radius; runtime instancing supplies size and spin.
Representative server-fan impeller (blade count and profile are not published):
seven broad, overlapping blades with pitch falling from ~30 deg at the root to
~18 deg at the tip, a swept leading edge and slight camber, on a hub about 0.42
of the tip radius with a recessed label disc. Molded black PBT.
Run: blender -b -P tools/blender/build-compute-rotor.py
"""
import bpy,math
from pathlib import Path
P=Path(__file__).resolve().parent;ROOT=P.parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
m=bpy.data.materials.new('Molded fan PBT');m.use_nodes=True
p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.010,.011,.013,1);p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.5

HUB=.42;TIP=.98;NB=7;NR=9;NC=9;T=.018
verts=[];faces=[]
for blade in range(NB):
    base=len(verts)
    for i in range(NR):
        u=i/(NR-1);r=HUB-.01+u*(TIP-HUB+.01)
        pitch=math.radians(30-12*u)
        ang_chord=(2*math.pi/NB)*(1.10-.45*u)          # root overlaps its neighbour by ~10%
        c=ang_chord*r/math.cos(pitch)
        centre=blade*2*math.pi/NB+.30*u**1.4             # swept blade
        for side in [-1,1]:
            for j in range(NC):
                v=j/(NC-1);s=(v-.5)*c
                phi=centre+s*math.cos(pitch)/r
                camber=.05*c*(1-(2*v-1)**2)
                thick=T*(1-.55*u)*(.35+.65*math.sin(math.pi*min(1,max(0,v*1.02))))
                z=s*math.sin(pitch)+camber+side*thick/2
                verts.append((r*math.cos(phi),r*math.sin(phi),z))
    idx=lambda i,side,j:base+i*2*NC+(0 if side<0 else NC)+j
    for i in range(NR-1):
        for j in range(NC-1):
            faces.append((idx(i,1,j),idx(i,1,j+1),idx(i+1,1,j+1),idx(i+1,1,j)))
            faces.append((idx(i,-1,j),idx(i+1,-1,j),idx(i+1,-1,j+1),idx(i,-1,j+1)))
        for j,flip in [(0,False),(NC-1,True)]:
            f=(idx(i,-1,j),idx(i,1,j),idx(i+1,1,j),idx(i+1,-1,j))
            faces.append(f[::-1] if flip else f)
    for j in range(NC-1):
        i=NR-1;faces.append((idx(i,-1,j),idx(i,1,j),idx(i,1,j+1),idx(i,-1,j+1)))
mesh=bpy.data.meshes.new('Seven-blade pitched impeller');mesh.from_pydata(verts,[],faces);mesh.update()
for f in mesh.polygons:f.use_smooth=True
o=bpy.data.objects.new('Blender compute rotor',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(m)
# hub: .42 of tip radius, .24 deep, with a shallow recessed label disc on the inlet face
bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=HUB,depth=.24);hub=bpy.context.object;hub.data.materials.append(m)
bev=hub.modifiers.new('Molded hub edge','BEVEL');bev.width=.02;bev.segments=2
bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=HUB*.7,depth=.01,location=(0,0,.118));disc=bpy.context.object;disc.data.materials.append(m)
bpy.ops.object.select_all(action='DESELECT')
for x in [hub,disc]:
    x.select_set(True);bpy.context.view_layer.objects.active=x;bpy.ops.object.modifier_apply(modifier=x.modifiers[0].name) if x.modifiers else None;x.select_set(False)
for x in [o,hub,disc]:x.select_set(True)
bpy.context.view_layer.objects.active=o;bpy.ops.object.join()
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
o.modifiers.new('Weighted rotor normals','WEIGHTED_NORMAL')
bpy.ops.wm.save_as_mainfile(filepath=str(P/'compute-rotor.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public'/'models'/'compute-rotor.glb'),export_format='GLB',export_apply=True,export_extras=True,export_yup=True)

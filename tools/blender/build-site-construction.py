"""Blender-authored construction module library for scenario-assembled site models.
These are reusable construction meshes, not semantic equipment redesigns.
"""
import bpy,math,pathlib,json
from mathutils import Vector
HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parent.parent
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
S=bpy.context.scene
mat=bpy.data.materials.new('Construction neutral');mat.diffuse_color=(.5,.5,.5,1)
def finish(o,n):
 o.name=n;o.data.materials.append(mat);bpy.ops.object.transform_apply(location=True,rotation=True,scale=True);return o
def custom(n,verts,faces,uv=False):
 m=bpy.data.meshes.new(n);m.from_pydata(verts,[],faces);m.update();o=bpy.data.objects.new(n,m);S.collection.objects.link(o);m.materials.append(mat)
 if uv:
  m.uv_layers.new(name='UVMap')
  for poly in m.polygons:
   for li in poly.loop_indices:
    co=m.vertices[m.loops[li].vertex_index].co;m.uv_layers.active.data[li].uv=(co.x+.5,co.z+.5)
 return o
# glTF converts Blender Z to viewer Y. Construction modules are centered.
bpy.ops.mesh.primitive_cube_add(size=1);finish(bpy.context.object,'BOX')
bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name='ROUNDED_BOX';q=o.modifiers.new('Folded corner radius','BEVEL');q.width=.025;q.segments=3;bpy.ops.object.modifier_apply(modifier=q.name);finish(o,'ROUNDED_BOX')
# Faces separately authored and UV-mapped so BoxGeometry's six material slots survive.
faces=[('PX',[(.5,-.5,-.5),(.5,-.5,.5),(.5,.5,.5),(.5,.5,-.5)]),('NX',[(-.5,.5,-.5),(-.5,.5,.5),(-.5,-.5,.5),(-.5,-.5,-.5)]),('PY',[(-.5,-.5,.5),(-.5,.5,.5),(.5,.5,.5),(.5,-.5,.5)]),('NY',[(-.5,.5,-.5),(-.5,-.5,-.5),(.5,-.5,-.5),(.5,.5,-.5)]),('PZ',[(-.5,-.5,-.5),(-.5,-.5,.5),(.5,-.5,.5),(.5,-.5,-.5)]),('NZ',[(.5,.5,-.5),(.5,.5,.5),(-.5,.5,.5),(-.5,.5,-.5)])]
for name,v in faces:
 o=custom('FACE_'+name,v,[(3,2,1,0)]);m=o.data;m.uv_layers.new(name='UVMap')
 for poly in m.polygons:
  for li in poly.loop_indices:m.uv_layers.active.data[li].uv=[(0,0),(0,1),(1,1),(1,0)][m.loops[li].vertex_index]
bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=1,depth=1);finish(bpy.context.object,'CYLINDER')
bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=1,radius2=1.3/1.85,depth=1);finish(bpy.context.object,'TAPERED_CYLINDER')
bpy.ops.mesh.primitive_cone_add(vertices=24,radius1=1,radius2=0,depth=1);finish(bpy.context.object,'CONE')
# Authored cable topology, deformed along scenario cable curves in the viewer.
v=[];f=[];N=8
for j in range(33):
 for i in range(N):a=i/N*2*math.pi;v.append((math.cos(a),-math.sin(a),j/32))
for j in range(32):
 for i in range(N):n=j*N+i;nn=j*N+(i+1)%N;f.append((n,nn,nn+N,n+N))
custom('TUBE',v,f)
bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=1);finish(bpy.context.object,'SPHERE')
# Plane matches Three's XY plane; source normal Blender -Y -> viewer +Z.
custom('PLANE',[(-.5,0,-.5),(.5,0,-.5),(.5,0,.5),(-.5,0,.5)],[(0,1,2,3)],True)
# Ground ridge profile exported once; runtime scales radial extent only.
v=[];f=[];N=160
for i in range(N+1):
 a=i/N*2*math.pi;h=65+30*math.sin(a*5+1)+18*math.sin(a*11)+9*math.sin(a*23)
 for r,y in [(2950,-1),(3500,h),(4200,10)]:v.append((math.cos(a)*r,-math.sin(a)*r,y))
 if i<N:
  for j in range(2):n=i*3+j;f.append((n,n+3,n+4,n+1))
custom('RIDGE',v,f)
# Cooling-tower shell uses the same representative hyperboloid envelope as the map.
v=[];f=[];N=32;steps=20
for j in range(steps+1):
 y=j/steps*34;waist=34*.62;r=9+(15-9)*((waist-y)/waist)**2 if y<=waist else 9+(12-9)*((y-waist)/(34-waist))**2
 for i in range(N):a=i/N*2*math.pi;v.append((math.cos(a)*r,-math.sin(a)*r,y))
for j in range(steps):
 for i in range(N):n=j*N+i;nn=j*N+(i+1)%N;f.append((n,nn,nn+N,n+N))
custom('COOLING_TOWER',v,f)
# Upper hemisphere for planted berms.
v=[];f=[];N=24;rows=8
for j in range(rows+1):
 theta=j/rows*math.pi/2
 for i in range(N):a=i/N*2*math.pi;v.append((math.sin(theta)*math.cos(a),-math.sin(theta)*math.sin(a),math.cos(theta)))
for j in range(rows):
 for i in range(N):n=j*N+i;nn=j*N+(i+1)%N;f.append((n,nn,nn+N,n+N))
custom('DOME',v,f)
# Recalculate consistently outward normals, smooth curved modules.
import bmesh
for o in S.objects:
 if o.type!='MESH':continue
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(o.data);bm.free()
 if o.name in ['SPHERE','DOME','COOLING_TOWER']:
  for p in o.data.polygons:p.use_smooth=True
 o['ifxConstructionModule']=o.name
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'site-construction.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/site-construction.glb'),export_format='GLB',export_yup=True,export_extras=True)

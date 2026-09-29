"""Blender-authored infrastructure symbols for the regional map, 9/28/2026.
Cartographic dimensions are deliberately exaggerated; these are not plant CAD.
Runtime places the assets at the existing illustrative plant/route coordinates.
"""
import bpy, math, json, pathlib
from mathutils import Vector
HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parent.parent
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
S=bpy.context.scene;S.unit_settings.system='METRIC'
def mat(n,c,metal=0,rough=.4):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1)
 p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 return m
pearl=mat('Ceramic metal casing',(.42,.5,.56),.5,.4)
dark=mat('Graphite recess',(.035,.055,.075),.4,.4)
steel=mat('Brushed structural steel',(.3,.38,.45),.75,.34)
concrete=mat('Satin concrete',(.38,.40,.42),.05,.72)
glass=mat('Photovoltaic glazing',(.015,.07,.12),.55,.22)
names=['MAP_SURFACE','GAS_PLANT','NUCLEAR_PLANT','WIND_MAST','WIND_ROTOR','SOLAR_ROW','GRID_PYLON']
groups={}
for n in names:
 g=bpy.data.objects.new(n,None);S.collection.objects.link(g);groups[n]=g
def pt(p):return(p[0],-p[2],p[1])
def mesh(n,v,f,m,g,bevel=0):
 me=bpy.data.meshes.new(n);me.from_pydata([pt(p) for p in v],[],f);me.update()
 o=bpy.data.objects.new(n,me);S.collection.objects.link(o);o.parent=groups[g];me.materials.append(m)
 if bevel:
  q=o.modifiers.new('Manufactured radius','BEVEL');q.width=bevel;q.segments=2
  o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def box(n,p,d,m,g,b=.04):
 v=[(p[0]+x*d[0]/2,p[1]+y*d[1]/2,p[2]+z*d[2]/2) for z in [-1,1] for y in [-1,1] for x in [-1,1]]
 return mesh(n,v,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],m,g,b)
def lathe(n,profile,m,g,seg=24):
 v=[(r*math.cos(k*math.tau/seg),y,r*math.sin(k*math.tau/seg)) for y,r in profile for k in range(seg)]
 f=[(j*seg+k,(j+1)*seg+k,(j+1)*seg+(k+1)%seg,j*seg+(k+1)%seg) for j in range(len(profile)-1) for k in range(seg)]
 return mesh(n,v,f,m,g)
def cyl(n,p,r,h,m,g,seg=16):
 o=lathe(n,[(-h/2,r),(h/2,r)],m,g,seg);o.location=pt(p);return o
def beam(n,a,b,r,m,g):
 A=Vector(a);B=Vector(b);d=B-A;q=d.to_track_quat('Y','Z');v=[]
 for p in [A,B]:
  for k in range(6):v.append(p+q@Vector((r*math.cos(k*math.tau/6),0,r*math.sin(k*math.tau/6))))
 f=[(k,k+6,(k+1)%6+6,(k+1)%6) for k in range(6)]
 return mesh(n,v,f,m,g)
# Map is a Blender-authored UV surface. Public geographic data remains a map
# texture generated at runtime, just as the explanatory labels do.
o=mesh('Geographic map surface',[(-.5,0,-.5),(-.5,0,.5),(.5,0,.5),(.5,0,-.5)],[(0,1,2,3)],concrete,'MAP_SURFACE')
uv=o.data.uv_layers.new(name='Map coordinates')
for loop in o.data.loops:
 # glTF flips V on export; retain the original Three CanvasTexture convention.
 co=o.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(co.x+.5,.5-co.y)
# Gas generation: turbine hall, roof machinery, intake bays, two stacks.
g='GAS_PLANT';box('Turbine hall',(0,3.5,0),(20,7,13),dark,g,.22)
box('Standing seam roof',(0,7.08,0),(20.5,.3,13.5),pearl,g,.14)
for x in [-8,-4,0,4,8]:
 box('Intake bay',(x,3.2,6.55),(3.1,5.1,.24),steel,g,.08)
 for y in [1.2,1.8,2.4,3,3.6,4.2,4.8]:box('Vent louver',(x,y,6.72),(2.9,.13,.18),pearl,g,.025)
for x in [-4.5,4.5]:
 o=lathe('Tapered exhaust stack',[(0,1.85),(23.8,1.3),(24,1.5)],concrete,g);o.location=pt((x,0,0))
 for y in [8,16,23.7]:cyl('Stack reinforcement collar',(x,y,0),1.7-y*.014,.18,steel,g)
# Nuclear generation: open hyperboloid cooling towers and containment cylinder.
g='NUCLEAR_PLANT'
profile=[]
for i in range(19):
 y=34*i/18;waist=34*.62
 r=9+(15-9)*((waist-y)/waist)**2 if y<=waist else 9+(12-9)*((y-waist)/(34-waist))**2
 profile.append((y,r))
for x in [-17,17]:
 o=lathe('Cooling tower shell',profile,concrete,g,32);o.location=pt((x,0,0))
 o=lathe('Tower rim',[(33.7,11.9),(34,12.15),(34,11.65),(33.7,11.45)],pearl,g,32);o.location=pt((x,0,0))
cyl('Containment cylinder',(1,7.5,19),7,15,pearl,g,24)
o=lathe('Containment dome',[(15+5*math.sin(i*math.pi/24),7*math.cos(i*math.pi/24)) for i in range(13)],pearl,g,24);o.location=pt((1,0,19))
# Wind mast and a three-bladed swept rotor, normalized for native animation.
g='WIND_MAST';o=lathe('Tapered wind tower',[(0,.65),(16,.35)],pearl,g,16)
box('Nacelle',(0,16.5,-.3),(1.6,1.1,2.2),pearl,g,.28)
g='WIND_ROTOR';cyl('Spinner hub',(0,0,0),.12,.18,pearl,g)
for i in range(3):
 a=i*math.tau/3
 poly=[(.1,-.07),(.28,-.095),(.7,-.052),(1,-.012),(1,.02),(.6,.07),(.23,.055)]
 v=[]
 for y in [-.015,.015]:
  for x,z in poly:v.append((x*math.cos(a)-z*math.sin(a),y+x*.025,x*math.sin(a)+z*math.cos(a)))
 l=len(poly);f=[tuple(range(l-1,-1,-1)),tuple(range(l,l*2))]+[(j,(j+1)%l,(j+1)%l+l,j+l) for j in range(l)]
 mesh('Swept turbine blade',v,f,pearl,g,.006)
# One tilted solar row. Scenario repeats it without changing the row count.
g='SOLAR_ROW';box('PV row',(0,0,0),(60,.4,3),glass,g,.045)
for x in [-30+i*3 for i in range(21)]:box('PV panel divider',(x,.215,0),(.055,.035,3),steel,g,.007)
for z in [-1.49,1.49]:box('PV frame',(0,.21,z),(60,.06,.07),pearl,g,.012)
# Transmission pylon symbol: tapered four-leg truss with two crossarms.
g='GRID_PYLON'
for x in [-1,1]:
 for z in [-1,1]:beam('Pylon leg',(x*.9,0,z*.7),(x*.22,6,z*.22),.09,steel,g)
for y in [0,1.5,3,4.5]:
 w0=.9*(1-y/8);w1=.9*(1-(y+1.5)/8)
 for z in [-1,1]:
  beam('Pylon diagonal',(-w0,y,z*w0*.8),(w1,y+1.5,z*w1*.8),.055,steel,g)
  beam('Pylon diagonal',(w0,y,z*w0*.8),(-w1,y+1.5,z*w1*.8),.055,steel,g)
for y,w in [(4.5,3.2),(6,4)]:box('Pylon crossarm',(0,y,0),(w,.18,.25),steel,g,.035)
# Bake modifiers, merge by semantic asset/material, then write reusable assets.
for o in list(S.objects):
 if o.type=='MESH':
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
  for m in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=m.name)
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for parent in groups.values():
 batches={}
 for o in list(parent.children):batches.setdefault(o.data.materials[0].name,[]).append(o)
 for n,obs in batches.items():
  if len(obs)>1:
   bpy.ops.object.select_all(action='DESELECT')
   for o in obs:o.select_set(True)
   bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join()
  obs[0].name=parent.name+'__'+n
root=bpy.data.objects.new('IFX_ACROSS_INFRASTRUCTURE',None);S.collection.objects.link(root)
root['ifx']=json.dumps({'version':1,'authoredIn':'Blender','representative':True,'units':'exaggerated cartographic symbols','assets':names,'windBlades':3})
for g in groups.values():g.parent=root
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'across-infrastructure.blend'))
out=ROOT/'public/models/across-infrastructure.glb'
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_extras=True,export_yup=True)
print('ACROSS_ASSET',out.stat().st_size)

"""Blender-authored infrastructure symbols for the regional map, 9/28/2026.
Cartographic dimensions are deliberately exaggerated; these are not plant CAD.
Runtime places the assets at the existing illustrative plant/route coordinates.
"""
import bpy, math, json, pathlib
from mathutils import Vector
HERE=pathlib.Path(__file__).resolve().parent;ROOT=HERE.parent.parent
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
S=bpy.context.scene;S.unit_settings.system='METRIC'
def mat(n,c,metal=0,rough=.4,emission=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1)
 p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emission
 return m
pearl=mat('Ceramic metal casing',(.42,.5,.56),.5,.4)
dark=mat('Graphite recess',(.035,.055,.075),.4,.4)
steel=mat('Brushed structural steel',(.3,.38,.45),.75,.34)
concrete=mat('Satin concrete',(.38,.40,.42),.05,.72)
glass=mat('Photovoltaic glazing',(.015,.07,.12),.55,.22)
names=['MAP_SURFACE','GAS_PLANT','NUCLEAR_PLANT','WIND_MAST','WIND_ROTOR','SOLAR_ROW','GRID_PYLON','MAP_SUBSTATION']
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
# Gas generation: a 2x1 combined-cycle symbol. Turbine hall facing +z, a transition
# duct and heat-recovery steam generator (HRSG) behind each gas turbine, and a steel
# exhaust stack at the far (downstream) end of each HRSG, where combined-cycle
# stacks stand. Step-up transformers and a small gantry on +x, where the HV line
# leaves. Representative proportions (stacks exaggerated), not one plant's CAD.
g='GAS_PLANT'
stackSteel=mat('Stack steel',(.30,.33,.35),.6,.45)
soot=mat('Stack soot band',(.05,.05,.055),.3,.7)
casing=mat('HRSG casing',(.36,.4,.42),.55,.42)
eave=mat('Hall eave lights',(1,.81,.54),0,.5,.7)
cladding=mat('Turbine hall cladding',(.3,.34,.37),.45,.5)
redlight=mat('Obstruction light',(1,.12,.08),0,.5,8)
box('Turbine hall',(0,4.25,3),(20,8.5,7),cladding,g,.22)
box('Standing seam roof',(0,8.6,3),(20.5,.3,7.5),pearl,g,.14)
for x in [-8,-4,0,4,8]:
 box('Intake bay',(x,3.4,6.55),(3.1,5.6,.24),steel,g,.08)
 for y in [1.2,1.8,2.4,3,3.6,4.2,4.8,5.4]:box('Vent louver',(x,y,6.72),(2.9,.13,.18),pearl,g,.025)
box('Eave light strip',(0,7.75,6.62),(19,.22,.12),eave,g,.02)
for x in [-5,5]:
 # transition duct: flares from the turbine exhaust (hall back wall) to the HRSG inlet
 a0,a1=(1.3,1.6),(1.6,2.75);z0,z1=-.5,-3.1
 v=[(x+sx*w,h0+sy*hh,z) for z,(w,hh),h0 in [(z0,a0,3.2),(z1,a1,2.9)] for sy in [-1,1] for sx in [-1,1]]
 mesh('Transition duct',v,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],casing,g)
 box('HRSG casing',(x,2.9,-7.6),(3.2,5.8,9),casing,g,.12)
 for z in [-4.4,-7.6,-10.8]:box('HRSG stiffener',(x,2.95,z),(3.45,5.95,.22),steel,g,.03)
 box('HRSG roof walkway',(x,5.9,-7.6),(3.5,.14,9.3),steel,g,.02)
 box('Breeching duct',(x,2.6,-12.6),(2.3,3.4,1.4),casing,g,.08)
 o=lathe('Steel exhaust stack',[(0,1.3),(17.4,1.15),(18,1.15)],stackSteel,g,20);o.location=pt((x,0,-13.6))
 o=lathe('Stack soot band',[(17.4,1.18),(18.02,1.18)],soot,g,20);o.location=pt((x,0,-13.6))
 o=lathe('Stack platform',[(12.5,1.2),(12.5,1.9),(12.65,1.9),(12.65,1.2)],steel,g,20);o.location=pt((x,0,-13.6))
 box('CEMS gallery',(x,13.3,-12.1),(1.1,1.2,.8),pearl,g,.05)
 cyl('Stack obstruction light',(x,18.15,-13.6),.22,.3,redlight,g,8)
# generator step-up transformers and the line gantry the HV route leaves from
for z in [1,5]:
 box('GSU transformer',(13,1.6,z),(3,3.2,2.6),steel,g,.12)
 for i in range(4):box('GSU radiator',(11.3,1.4,z-.9+i*.6),(.35,2.4,.4),steel,g,.02)
 for dz in [-.7,0,.7]:cyl('GSU bushing',(13.5,3.9,z+dz),.13,1.4,pearl,g,8)
for z in [.6,5.4]:beam('Line gantry post',(16,0,z),(16,7,z),.14,steel,g)
box('Line gantry beam',(16,7,3),(.3,.3,5.4),steel,g,.02)
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
# Campus substation symbol: where the regional HV lines end, beside each campus
# plinth. A representative yard (gantry, two step-down transformers, control
# house, fence), not any one campus's single-line diagram. Origin = yard center;
# the incoming lines land on the gantry at (-4.5, 6, 0).
g='MAP_SUBSTATION'
gravel=mat('Crushed rock yard',(.13,.14,.15),0,.95)
porcelain=mat('Bushing porcelain',(.5,.36,.26),.05,.35)
tank=mat('Transformer tank grey',(.26,.3,.31),.45,.5)
hvbus=mat('Energized bus glow',(.71,.61,1),0,.5,4.5)
box('Substation gravel pad',(0,.1,0),(15,.2,17),gravel,g,.05)
for z in [-8.3,8.3]:box('Yard fence rail',(0,1.05,z),(14.6,.08,.08),steel,g,.0)
for x in [-7.3,7.3]:box('Yard fence rail',(x,1.05,0),(.08,.08,16.6),steel,g,.0)
for i in range(8):
 for z in [-8.3,8.3]:box('Yard fence post',(-7.3+i*14.6/7,.6,z),(.1,1,.1),steel,g,.0)
 for x in [-7.3,7.3]:box('Yard fence post',(x,.6,-8.3+i*16.6/7),(.1,1,.1),steel,g,.0)
# dead-end gantry: two lattice posts and a crossbeam carrying three phases
for z in [-4,4]:
 for dx in [-.35,.35]:
  for dz in [-.35,.35]:beam('Gantry leg',(-4.5+dx,.2,z+dz),(-4.5+dx*.5,7,z+dz*.5),.07,steel,g)
 for y in [1.5,3,4.5,6]:beam('Gantry lacing',(-4.85,y-1.3,z-.3),(-4.3,y,z+.3),.04,steel,g)
box('Gantry crossbeam',(-4.5,7,0),(.4,.35,8.8),steel,g,.04)
for z in [-2.6,0,2.6]:
 cyl('Strain insulator',(-4.5,6.45,z),.14,1,porcelain,g,10)
 beam('Phase conductor drop',(-4.5,5.9,z),(1.2,5.3,z),.06,hvbus,g)
beam('Rigid HV bus',(1.2,5.3,-5.3),(1.2,5.3,5.3),.09,hvbus,g)
# two step-down transformers with radiator banks and HV bushings
for z in [-4.2,4.2]:
 box('Transformer tank',(2.2,1.85,z),(4.2,3.3,3.2),tank,g,.12)
 box('Conservator tank',(2.2,3.95,z-1),(3,.7,.7),tank,g,.25)
 for i in range(5):box('Radiator fin bank',(0.6+i*.8,1.7,z+1.95),(.5,2.6,.7),tank,g,.03)
 for dz in [-.9,0,.9]:cyl('HV bushing',(1.2,4.45,z+dz*.9),.16,1.9,porcelain,g,10)
box('Control house',(4.4,1.3,0),(2.6,2.2,4.6),pearl,g,.12)
box('Control house roof',(4.4,2.5,0),(2.9,.2,4.9),steel,g,.05)
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

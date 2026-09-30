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
names=['MAP_SURFACE','GAS_PLANT','NUCLEAR_PLANT','WIND_MAST','WIND_ROTOR','SOLAR_ROW','SOLAR_SKID','SOLAR_ROAD','GRID_PYLON','HUT_SITE','TERMINAL_TRIM']
groups={}
for n in names:
 g=bpy.data.objects.new(n,None);S.collection.objects.link(g);groups[n]=g
def pt(p):return(p[0],-p[2],p[1])
def mesh(n,v,f,m,g,bevel=0,smooth=False):
 me=bpy.data.meshes.new(n);me.from_pydata([pt(p) for p in v],[],f);me.update()
 if smooth:
  for poly in me.polygons:poly.use_smooth=True
 o=bpy.data.objects.new(n,me);S.collection.objects.link(o);o.parent=groups[g];me.materials.append(m)
 if bevel:
  q=o.modifiers.new('Manufactured radius','BEVEL');q.width=bevel;q.segments=2
  o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def box(n,p,d,m,g,b=.04):
 v=[(p[0]+x*d[0]/2,p[1]+y*d[1]/2,p[2]+z*d[2]/2) for z in [-1,1] for y in [-1,1] for x in [-1,1]]
 return mesh(n,v,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],m,g,b)
def lathe(n,profile,m,g,seg=24,smooth=False,inward=False):
 v=[(r*math.cos(k*math.tau/seg),y,r*math.sin(k*math.tau/seg)) for y,r in profile for k in range(seg)]
 f=[(j*seg+k,(j+1)*seg+k,(j+1)*seg+(k+1)%seg,j*seg+(k+1)%seg) for j in range(len(profile)-1) for k in range(seg)]
 if inward:f=[tuple(reversed(q)) for q in f]
 return mesh(n,v,f,m,g,smooth=smooth)
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
stackSteel=steel;soot=dark;casing=steel
eave=mat('Hall eave lights',(1,.81,.54),0,.5,.7)
cladding=mat('Turbine hall cladding',(.3,.34,.37),.45,.5)
redlight=mat('Obstruction light',(1,.12,.08),0,.5,8)
box('Turbine hall',(0,4.25,3),(20,8.5,7),cladding,g,.22)
box('Standing seam roof',(0,8.6,3),(20.5,.3,7.5),pearl,g,.14)
for x in [-8,-4,0,4,8]:
 box('Intake bay',(x,3.4,6.55),(3.1,5.6,.24),steel,g,.08)
 for y in [1.2,1.8,2.4,3,3.6,4.2,4.8,5.4]:box('Vent louver',(x,y,6.72),(2.9,.13,.18),pearl,g,0)
box('Eave light strip',(0,7.75,6.62),(19,.22,.12),eave,g,.02)
for x in [-5,5]:
 # transition duct: flares from the turbine exhaust (hall back wall) to the HRSG inlet
 a0,a1=(1.3,1.6),(1.6,2.75);z0,z1=-.5,-3.1
 v=[(x+sx*w,h0+sy*hh,z) for z,(w,hh),h0 in [(z0,a0,3.2),(z1,a1,2.9)] for sy in [-1,1] for sx in [-1,1]]
 mesh('Transition duct',v,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],casing,g)
 box('HRSG casing',(x,2.9,-7.6),(3.2,5.8,9),casing,g,.12)
 for z in [-4.4,-7.6,-10.8]:box('HRSG stiffener',(x,2.95,z),(3.45,5.95,.22),steel,g,0)
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
 for i in range(4):box('GSU radiator',(11.3,1.4,z-.9+i*.6),(.35,2.4,.4),steel,g,0)
 for dz in [-.7,0,.7]:cyl('GSU bushing',(13.5,3.9,z+dz),.13,1.4,pearl,g,8)
for z in [.6,5.4]:beam('Line gantry post',(16,0,z),(16,7,z),.14,steel,g)
box('Line gantry beam',(16,7,3),(.3,.3,5.4),steel,g,.02)
# Nuclear generation: two natural-draft cooling towers standing on a ring of
# X-braced columns (the open air inlet), a containment building beside them, a
# turbine hall and a switchyard where the HV line leaves. Tower proportions follow
# the usual hyperboloid (height about 1.1x base diameter); representative, not
# any one plant.
g='NUCLEAR_PLANT'
towerConcrete=mat('Tower concrete',(.55,.55,.52),.02,.85)
towerInside=dark
nuc=mat('Nuclear aviation light',(1,.1,.06),0,.5,6)
H2=34;lip=H2*.06;waist=H2*.62
def tr(y):return 9+(15-9)*((waist-y)/waist)**2 if y<=waist else 9+(12-9)*((y-waist)/(H2-waist))**2
profile=[(lip+(H2-lip)*i/22,tr(lip+(H2-lip)*i/22)) for i in range(23)]
for x in [-17,17]:
 o=lathe('Cooling tower shell',profile,towerConcrete,g,48,smooth=True);o.location=pt((x,0,0))
 o=lathe('Tower shell interior',[(y,r-.35) for y,r in profile[8:]],towerInside,g,48,smooth=True,inward=True);o.location=pt((x,0,0))
 o=lathe('Tower rim',[(33.7,11.9),(34,12.15),(34,11.65),(33.7,11.45)],pearl,g,48);o.location=pt((x,0,0))
 cyl('Tower basin',(x,.2,0),tr(lip)-.3,.4,towerInside,g,32)
 rb=tr(lip)-.25;n=28
 for k in range(n):
  a0=k*math.tau/n;a1=(k+1)*math.tau/n
  p0=(x+rb*math.cos(a0),0,rb*math.sin(a0));p1=(x+rb*math.cos(a1),0,rb*math.sin(a1))
  q0=(x+rb*math.cos(a0),lip+.1,rb*math.sin(a0));q1=(x+rb*math.cos(a1),lip+.1,rb*math.sin(a1))
  beam('Inlet column',p0,q1,.16,towerConcrete,g);beam('Inlet column',p1,q0,.16,towerConcrete,g)
 for a in [0,2.1,4.2]:cyl('Tower rim light',(x+12*math.cos(a),34.15,12*math.sin(a)),.2,.25,nuc,g,8)
# reactor island beside the towers: containment, turbine hall, switchyard
cyl('Containment cylinder',(42,7.5,-2),7,15,pearl,g,32)
o=lathe('Containment dome',[(15+5*math.sin(i*math.pi/40),7*math.cos(i*math.pi/40)) for i in range(21)],pearl,g,32,smooth=True);o.location=pt((42,0,-2))
box('Turbine building',(42,3.2,12),(12,6.4,14),cladding,g,.15)
box('Turbine building roof',(42,6.5,12),(12.4,.25,14.4),pearl,g,.05)
for z in [9,15]:
 box('Main transformer',(51,1.5,z),(3,3,2.4),steel,g,.1)
 for dz in [-.6,0,.6]:cyl('Transformer bushing',(51.4,3.7,z+dz),.12,1.3,pearl,g,8)
for z in [9.5,14.5]:beam('Switchyard gantry post',(55,0,z),(55,6.5,z),.13,steel,g)
box('Switchyard gantry beam',(55,6.5,12),(.3,.3,5.6),steel,g,.02)
# Wind mast and a three-bladed rotor, normalized to blade radius 1 for native
# animation (runtime scales it to R=10 on a 16.5 hub: rotor diameter about 1.2x
# hub height, near the US 2023 average of 133.8 m on 103.4 m hubs, LBNL).
# Slender blades, an ogive spinner, a tapered tower and a nacelle with a cooler
# and an aviation light. The rotor turns about local +y, which faces upwind.
bladeWhite=mat('Turbine off-white',(.78,.8,.8),0,.45)
aviation=mat('Aviation light',(1,.1,.06),0,.5,6)
g='WIND_MAST';o=lathe('Tapered wind tower',[(0,.35),(15.9,.22)],bladeWhite,g,16)
box('Nacelle',(0,16.5,-.35),(1.15,1.1,2.5),bladeWhite,g,.34)
box('Nacelle cooler',(0,17.14,-1.15),(.75,.24,.55),bladeWhite,g,.05)
cyl('Nacelle aviation light',(0,17.12,.1),.13,.16,aviation,g,8)
g='WIND_ROTOR'
o=lathe('Ogive spinner',[(-.03,.062),(.03,.06),(.07,.05),(.1,.034),(.125,.016),(.14,.003)],bladeWhite,g,16)
cone=math.tan(math.radians(3.5))
# plan form: x = span (0..1), z = chord; a round root to 5% span, max chord about
# 0.075 R near a quarter span, tapering to about 0.02 R at the tip
poly=[(.02,-.034),(.05,-.034),(.12,-.032),(.24,-.03),(.45,-.024),(.7,-.015),(.9,-.009),(1,-.005),
      (1,.011),(.9,.016),(.7,.024),(.45,.035),(.24,.045),(.12,.04),(.05,.034),(.02,.034)]
for i in range(3):
 a=i*math.tau/3
 v=[]
 for side in [-1,1]:
  for x,z in poly:
   t=(.02-.014*x)*side;z2=z-.02*x*x
   v.append((x*math.cos(a)-z2*math.sin(a),t+x*cone,x*math.sin(a)+z2*math.cos(a)))
 l=len(poly);f=[tuple(range(l-1,-1,-1)),tuple(range(l,l*2))]+[(j,(j+1)%l,(j+1)%l+l,j+l) for j in range(l)]
 mesh('Slender turbine blade',v,f,bladeWhite,g)
# One single-axis tracker row, running north-south (runtime z) with its modules
# turned about the row axis toward the west. Nearly all new US utility-scale PV
# tracks on one axis (LBNL). Two modules in portrait (2.6 wide) across a torque
# tube on driven piles, one slew drive at mid-row, 32 long. Runtime sets rows at a
# 6.5 pitch (ground coverage ratio 0.4) in blocks of ten between gravel roads.
g='SOLAR_ROW'
pvGlass=mat('Tracker module glass',(.03,.1,.19),.3,.08,.45)
pvFrame=mat('Module frame aluminum',(.62,.66,.7),.8,.3)
TILT=math.radians(15);AX=1.0;RL=32;RW=2.6
def tbox(n,c,d,m,g):
 # a box turned about the row axis (z) through (0, AX)
 v=[]
 for z in [-1,1]:
  for y in [-1,1]:
   for x in [-1,1]:
    px,py=c[0]+x*d[0]/2,c[1]+y*d[1]/2-AX
    v.append((px*math.cos(TILT)-py*math.sin(TILT),AX+px*math.sin(TILT)+py*math.cos(TILT),c[2]+z*d[2]/2))
 return mesh(n,v,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],m,g)
tbox('Module plane',(0,AX+.12,0),(RW,.05,RL),pvGlass,g)
for z in [-RL/2+i*1.6 for i in range(1,20)]:tbox('Module seam',(0,AX+.15,z),(RW,.01,.05),pvFrame,g)
tbox('Portrait gap',(0,AX+.15,0),(.04,.01,RL),pvFrame,g)
for x in [-RW/2,RW/2]:tbox('Module frame edge',(x,AX+.13,0),(.06,.04,RL),pvFrame,g)
beam('Torque tube',(0,AX,-RL/2),(0,AX,RL/2),.07,steel,g)
for z in [-RL/2+i*4 for i in range(9)]:box('Driven pile',(0,AX/2,z),(.1,AX,.1),steel,g,0)
box('Slew drive',(0,AX-.04,0),(.3,.3,.35),steel,g,0)
# Inverter skid, one per block: a concrete pad, two central inverters, a pad-mount
# medium-voltage transformer with cooling fins and a small work light. Representative.
g='SOLAR_SKID'
skidLamp=mat('Skid work lamp',(1,.78,.45),0,.5,5)
box('Skid pad',(0,.12,0),(5.2,.24,2.6),concrete,g,.03)
for x in [-1.6,-.2]:box('Central inverter',(x,.95,0),(1.2,1.4,1.6),pearl,g,.05)
box('MV transformer',(1.55,.85,0),(1.3,1.2,1.4),steel,g,.05)
for z in [-.8,.8]:box('Transformer fins',(1.55,.8,z),(1.1,.95,.2),steel,g,0)
cyl('Skid lamp',(0,1.75,1.05),.12,.14,skidLamp,g,8)
# Gravel access road, a unit strip the runtime stretches to each road's length.
g='SOLAR_ROAD'
gravel=mat('Access road gravel',(.3,.29,.26),0,.95)
box('Gravel road',(0,.05,0),(1,.06,1),gravel,g,0)
# Transmission pylon symbol: tapered four-leg lattice braced on all four faces,
# two crossarms with three insulator strings a side, shield-wire peaks. Runtime
# turns each tower square to its line and hangs the line from an insulator tip.
g='GRID_PYLON'
galv=mat('Galvanized lattice',(.45,.48,.5),.6,.55)
glassIns=mat('Insulator glass',(.36,.5,.46),.1,.25)
for x in [-1,1]:
 for z in [-1,1]:beam('Pylon leg',(x*.9,0,z*.7),(x*.22,6,z*.22),.09,galv,g)
hx=lambda y:.9-(.9-.22)*y/6;hz=lambda y:.7-(.7-.22)*y/6
for y in [0,3]:
 y1=y+3
 for s2 in [-1,1]:
  beam('Pylon diagonal',(-hx(y),y,s2*hz(y)),(hx(y1),y1,s2*hz(y1)),.05,galv,g)
  beam('Pylon diagonal',(hx(y),y,s2*hz(y)),(-hx(y1),y1,s2*hz(y1)),.05,galv,g)
  beam('Pylon diagonal',(s2*hx(y),y,-hz(y)),(s2*hx(y1),y1,hz(y1)),.05,galv,g)
  beam('Pylon diagonal',(s2*hx(y),y,hz(y)),(s2*hx(y1),y1,-hz(y1)),.05,galv,g)
for y,w in [(4.5,3.2),(6,4)]:
 box('Pylon crossarm',(0,y,0),(w,.18,.25),galv,g,0)
 for sx in [-1,1]:
  for k in range(3):
   x=sx*(w/2-.12-k*.52)
   if k==0 and w==4:x=sx*1.6
   beam('Insulator string',(x,y,0),(x,y-.7,0),.08,glassIns,g)
for sx in [-1,1]:beam('Shield-wire peak',(sx*.22,6,0),(sx*.8,7.1,0),.06,galv,g)
# The regional HV lines now end at the substation yard built into the campus
# catalog's MAP_CAMPUS symbol, so this file no longer authors its own.
gravel=mat('Crushed rock yard',(.13,.14,.15),0,.95)
# Amplifier hut site dressing, placed with each shared MAP_HUT shelter: a gravel
# apron and a chain-link fence around it, a wall-pack HVAC unit on the -x end, a
# door lamp and a small roof beacon. Representative, not one carrier's standard.
g='HUT_SITE'
hutLamp=mat('Hut door lamp',(1,.83,.36),0,.5,3)
for c,d in [((0,.08,3.1),(9,.12,.9)),((0,.08,-3.1),(9,.12,.9)),((4,.08,0),(1,.12,5.3)),((-4,.08,0),(1,.12,5.3))]:box('Gravel apron',c,d,gravel,g,0)
for i in range(10):
 for z in [-3.5,3.5]:box('Fence post',(-4.5+i,.5,z),(.07,1,.07),steel,g,0)
for i in range(8):
 for x in [-4.5,4.5]:box('Fence post',(x,.5,-3.5+i),(.07,1,.07),steel,g,0)
for y in [.35,.95]:
 for z in [-3.5,3.5]:box('Fence rail',(0,y,z),(9,.04,.04),steel,g,0)
 for x in [-4.5,4.5]:box('Fence rail',(x,y,0),(.04,.04,7),steel,g,0)
box('Wall-pack HVAC',(-3.28,1.7,0),(.5,1.4,1.2),pearl,g,.05)
o=lathe('HVAC fan grille',[(0,.42),(.04,.42)],steel,g,16);o.rotation_euler.y=math.pi/2;o.location=pt((-3.55,1.7,0))
box('Door lamp',(1.5,2.92,2.1),(1.1,.09,.12),hutLamp,g,0)
cyl('Roof beacon mast',(2.4,3.5,1.5),.1,.35,steel,g,8)
cyl('Roof beacon',(2.4,3.74,1.5),.16,.14,hutLamp,g,10)
# Line terminal trim, placed with each shared MAP_TERMINAL: a lit fiber-entrance
# vault on the east wall, where the DWDM route ends. (The gold crown fixture is
# now part of MAP_TERMINAL itself in the campus catalog.)
g='TERMINAL_TRIM'
goldLamp=mat('Fiber gold lamp',(1,.83,.36),0,.5,4)
box('Fiber entrance vault',(5.3,.18,0),(.9,.36,1.1),dark,g,.04)
box('Vault gold rim',(5.3,.39,0),(1.0,.08,1.2),goldLamp,g,0)
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

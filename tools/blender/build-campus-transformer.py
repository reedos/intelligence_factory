"""Representative main-transformer mechanical packaging, metres.
Existing viewer bushings and utility paths remain authoritative; this replaces
only the tank, cooling banks, conservator, skid and operating cabinet geometry.
"""
import pathlib
HERE=pathlib.Path(__file__).resolve().parent
exec((HERE/'build-campus-architecture.py').read_text().split('# Full opaque building envelope.')[0])
for g in list(groups.values()):bpy.data.objects.remove(g,do_unlink=True)
groups={}
g='MAIN_TRANSFORMER';groups[g]=bpy.data.objects.new(g,None);S.collection.objects.link(groups[g])
paint=mat('Transformer enamel gray',(.32,.39,.39),.25,.47)
edge=mat('Machined zinc hardware',(.40,.46,.47),.72,.3)
dark=mat('Deep mechanical recess',(.025,.043,.05),.1,.6)
fin=mat('Radiator coated steel',(.20,.29,.30),.45,.51)
label=mat('Transformer etched nameplate',(.16,.21,.22),.6,.36)
def cyl(n,p,r,h,m,axis='y',segments=24):
 bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=r,depth=h,location=pt(p));o=bpy.context.object;o.name=n;o.parent=groups[g];o.data.materials.append(m)
 if axis=='z':o.rotation_euler.x=math.pi/2
 if axis=='x':o.rotation_euler.y=math.pi/2
 q=o.modifiers.new('Turned lip','BEVEL');q.width=min(r*.10,h*.12);q.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
box('Cast transport skid',(0,.77,0),(6.8,.74,10.2),dark,g,.08)
for x in [-2.6,2.6]:box('Continuous bearing runner',(x,.59,0),(.48,.4,10.0),edge,g,.05)
box('Welded transformer main tank',(0,3.8,0),(6,6,9.5),paint,g,.18)
box('Bolted tank cover',(0,7.02,0),(6.42,.46,9.92),paint,g,.10)
box('Cover gasket seam',(0,6.81,0),(6.34,.035,9.84),dark,g,.018)
for x in [-2.93,2.93]:
 for z in [-4.35+i*.73 for i in range(13)]:
  cyl('Captive cover stud',(x,7.29,z),.064,.10,edge)
  box('Sidewall reinforcement rib',(x*1.027,3.65,z),(.12,5.3,.12),paint,g,.024)
for z in [-4.91,4.91]:
 for x in [-2.6+i*.65 for i in range(9)]:cyl('End cover stud',(x,7.29,z),.064,.1,edge)
for side in [-1,1]:
 rz=side*6.5
 for i in range(10):
  x=-2.4+i*.52
  box('Pressed radiator fin',(x,3.5,rz),(.075,4.6,1.3),fin,g,.032)
  for zz in [-.51,.51]:box('Rolled radiator fin edge',(x,3.5,rz+zz),(.095,4.46,.035),edge,g,.01)
 for y in [1.2,5.9]:
  cyl('Radiator header',(0,y,rz),.14,5.3,paint,'x')
  cyl('Radiator oil connection',(0,y,side*5.575),.14,1.95,paint,'z')
 for x in [-1.8,0,1.8]:
  cyl('Axial cooling fan frame',(x,1.40,side*7.25),.72,.29,paint,'z')
  cyl('Recessed fan grille',(x,1.40,side*7.41),.62,.035,dark,'z')
  cyl('Fan motor hub',(x,1.40,side*7.44),.13,.05,edge,'z')
  for k in range(6):
   a=k*math.pi/3;beam('Fan grille spoke',(x,1.40,side*7.45),(x+.60*math.cos(a),1.40+.60*math.sin(a),side*7.45),.025,.025,edge,g)
# Conservator shifted inward to clear all fixed MV bushing sheds.
cyl('Rounded conservator tank',(1.0,9.4,0),.9,7,paint,'z',32)
for z in [-3.5,3.5]:cyl('Conservator welded end ring',(1.0,9.4,z),.918,.12,edge,'z',32)
for z in [-2.5,2.5]:
 box('Conservator saddle',(1.0,8.7,z),(1.45,.24,.45),paint,g,.04)
 beam('Conservator pedestal',(1.0,7.3,z),(1.0,8.6,z),.23,.3,paint,g)
# Cover sockets fit original HV, neutral and MV bushing roots.
for x,zs in [(-2.2,[-2.6,0,2.6,4]),(2.6,[-2,0,2])]:
 for z in zs:cyl('Bushing cover flange',(x,7.24,z),.40,.1,edge)
box('Operating cabinet',(3.5,1.8,3.8),(1.2,2,.9),paint,g,.065)
box('Recessed operating door',(3.5,1.8,4.27),(1.03,1.75,.05),edge,g,.034)
box('Operating door handle',(3.88,1.83,4.315),(.045,.38,.06),dark,g,.012)
box('Etched identification plate',(-3.065,4.0,0),(.025,.65,1.25),label,g,.005)
for z in [-.43,-.23,-.03,.17,.37]:box('Nameplate engraving',(-3.081,4.03,z),(.003,.27,.027),edge,g,.001)
# Editable physical assembly, batched by material for instancing three units.
for o in list(S.objects):
 if o.type!='MESH':continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for m in list(bpy.data.materials):
 obs=[o for o in groups[g].children if o.type=='MESH' and o.data.materials[0]==m]
 if len(obs)>1:
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=g+' '+m.name
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'campus-transformer.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/campus-transformer.glb'),export_format='GLB',export_yup=True,export_extras=True)

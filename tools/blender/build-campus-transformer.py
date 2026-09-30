"""Representative main-transformer mechanical packaging, metres.
The tank, ONAF radiator banks and fans, conservator, Buchholz relay, breather, OLTC compartment,
cabinet, ladder and the bushings (at the site wiring's terminal positions and heights). Utility
paths stay in the viewer. Radiator/fan counts and OLTC position are representative.
Run Blender --background --python tools/blender/build-campus-transformer.py.
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
# cover studs: plain 8-sided pins (they were 24-segment bevelled studs, a third of the old triangle count)
def rod(n,a,b,r,m):
 A=Vector(pt(a));B=Vector(pt(b));d=B-A
 bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=r,depth=d.length,location=(A+B)/2);o=bpy.context.object;o.name=n
 o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.parent=groups[g];o.data.materials.append(m);return o
def pin(n,p,r,h,m):
 bpy.ops.mesh.primitive_cylinder_add(vertices=8,radius=r,depth=h,location=pt(p));o=bpy.context.object;o.name=n;o.parent=groups[g];o.data.materials.append(m);return o
for x in [-2.93,2.93]:
 for z in [-4.35+i*.73 for i in range(13)]:pin('Captive cover stud',(x,7.29,z),.064,.10,edge)
for z in [-4.91,4.91]:
 for x in [-2.6+i*.65 for i in range(9)]:pin('End cover stud',(x,7.29,z),.064,.1,edge)
for z in [-4.35+i*.87 for i in range(11)]:
 for x in [-3.06,3.06]:box('Sidewall reinforcement rib',(x,3.65,z),(.12,5.3,.12),paint,g,.024)
# ONAF cooling: two detachable pressed-panel radiator banks on each long side, hung off upper and lower
# headers with flanged oil pipes and valve blocks; fans on brackets at the bank base blow horizontally
# through the panel gaps. Bank count, panel count and positions are representative.
for sx in [-1,1]:
 for bz in [-2.55,2.55]:
  for i in range(9):
   z=bz-2.08+i*.52
   box('Pressed radiator panel',(sx*3.95,3.6,z),(1.1,4.0,.08),fin,g,0)
   box('Panel rolled edge',(sx*4.52,3.6,z),(.035,3.9,.1),edge,g,0)
  for y in [1.45,5.75]:
   cyl('Radiator header',(sx*3.95,y,bz),.11,4.5,paint,'z',12)
   cyl('Flanged oil pipe',(sx*3.3,y,bz),.1,.62,paint,'x',12)
   cyl('Pipe flange',(sx*3.12,y,bz),.17,.05,edge,'x',12)
   box('Butterfly valve block',(sx*3.46,y,bz),(.16,.26,.26),edge,g,.02)
  for fz in [-1.15,1.15]:
   x=sx*4.78;z=bz+fz
   box('Fan bracket',(sx*4.63,1.6,z),(.3,.08,.9),dark,g,0)
   cyl('Fan guard ring',(x,2.45,z),.56,.05,edge,'x',20)
   cyl('Fan guard hub ring',(x,2.45,z),.2,.05,edge,'x',12)
   for k in range(8):
    a=k*math.pi/4;rod('Fan guard wire',(x,2.45+.2*math.sin(a),z+.2*math.cos(a)),(x,2.45+.56*math.sin(a),z+.56*math.cos(a)),.016,edge)
   cyl('Fan blade disc',(sx*4.7,2.45,z),.52,.03,dark,'x',16)
   cyl('Fan motor',(sx*4.55,2.45,z),.16,.28,dark,'x',12)
# Conservator shifted inward to clear all fixed MV bushing sheds.
cyl('Rounded conservator tank',(1.0,9.4,0),.9,7,paint,'z',32)
for z in [-3.5,3.5]:cyl('Conservator welded end ring',(1.0,9.4,z),.918,.12,edge,'z',32)
for z in [-2.5,2.5]:
 box('Conservator saddle',(1.0,8.7,z),(1.45,.24,.45),paint,g,.04)
 beam('Conservator pedestal',(1.0,7.3,z),(1.0,8.6,z),.23,.3,paint,g)
# Buchholz relay in the conservator pipe, and a dehydrating breather hanging off the conservator end
beam('Buchholz pipe riser',(1.0,8.5,-.8),(1.0,7.3,-.8),.1,.1,paint,g)
box('Buchholz relay',(1.0,7.95,-.8),(.3,.3,.42),edge,g,.02)
beam('Breather pipe',(1.0,9.4,3.55),(1.0,8.0,3.9),.06,.06,paint,g)
cyl('Dehydrating breather',(1.0,7.7,3.9),.14,.55,label,'y',12)
# OLTC compartment on the -Z end wall; operating cabinet and a ladder on the +Z end
box('OLTC compartment',(-1.2,4.2,-5.1),(2.4,3.6,.8),paint,g,.06)
box('OLTC drive cabinet',(-1.2,1.6,-5.2),(.9,1.3,.5),paint,g,.04)
box('Operating cabinet',(1.6,1.95,5.2),(1.3,2.1,.8),paint,g,.065)
box('Recessed operating door',(1.6,1.95,5.62),(1.1,1.85,.05),edge,g,.034)
box('Operating door handle',(2.02,1.98,5.665),(.045,.38,.06),dark,g,.012)
for x in [-.9,-.3]:box('Ladder rail',(x,4.2,4.9),(.06,6.2,.06),edge,g,0)
for y in [1.4+i*.35 for i in range(16)]:box('Ladder rung',(-.6,y,4.9),(.62,.04,.04),edge,g,0)
box('Etched identification plate',(-1.2,4.0,4.765),(1.25,.65,.025),label,g,.005)
for x in [-1.63,-1.43,-1.23,-1.03,-.83]:box('Nameplate engraving',(x,4.03,4.781),(.027,.27,.003),edge,g,.001)
# Bushings: smooth tapered cores with alternating large/small sheds, a mounting flange and a top terminal,
# at the positions and terminal heights the site wiring uses. Grey composite; HV phases get a corona ring
# and a surge arrester on the cover beside them.
shed=mat('Grey composite bushing',(.34,.36,.37),0,.42)
def lathe(n,prof,x,z,m,segments=12):
 v=[];f=[]
 for j,(r,y) in enumerate(prof):
  for i in range(segments):a=i/segments*2*math.pi;v.append((x+r*math.cos(a),y,z+r*math.sin(a)))
 for j in range(len(prof)-1):
  for i in range(segments):
   a=j*segments+i;b=j*segments+(i+1)%segments;f.append((a,b,b+segments,a+segments))
 o=mesh(n,v,f,m,g)
 for q in o.data.polygons:q.use_smooth=True
 return o
def bushing(n,x,z,y0,h,r0,big,small,pitch,ring=False):
 y0+=.06  # seat the base clear of the cover flange top
 prof=[(0,y0),(r0*2.6,y0),(r0*2.6,y0+.1),(r0*1.3,y0+.12)]
 y=y0+.3;k=0
 while y<y0+h-.35:
  rr=big if k%2==0 else small
  prof+= [(r0,y),(rr,y+.02),(rr*.92,y+.06),(r0,y+pitch*.55)];y+=pitch;k+=1
 prof+=[(r0*.85,y0+h-.3),(r0*1.25,y0+h-.25),(r0*1.25,y0+h-.08),(0,y0+h-.05)]
 lathe(n,prof,x,z,shed)
 box(n+' terminal pad',(x,y0+h,z),(.14,.12,.14),edge,g,0)
 if ring:
  bpy.ops.mesh.primitive_torus_add(major_radius=.36,minor_radius=.05,major_segments=20,minor_segments=6,location=pt((x,y0+h-.4,z)))
  o=bpy.context.object;o.name='Corona ring';o.parent=groups[g];o.data.materials.append(edge)
for dz in [-2.6,0,2.6]:
 bushing('HV bushing',-2.2,dz,7.3,5.2,.13,.3,.22,.2,True)
 bushing('HV surge arrester',-2.75,dz+1.0,7.3,2.2,.1,.2,.16,.14)
bushing('Neutral bushing',-2.2,4.0,7.3,2.4,.1,.21,.16,.14)
for dz in [-2,0,2]:bushing('MV bushing',2.6,dz,7.3,1.8,.11,.23,.17,.14)
for x,zs in [(-2.2,[-2.6,0,2.6,4]),(2.6,[-2,0,2])]:
 for z in zs:cyl('Bushing cover flange',(x,7.24,z),.40,.1,edge,'y',16)
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

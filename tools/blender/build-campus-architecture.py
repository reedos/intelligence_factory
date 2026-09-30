"""Blender campus flagship architecture. Metres, representative original concept.
The engineering layout owns hall count, envelope length and roof plant. Exported
shell is instanced/stretched along length by the viewer; office width stays fixed.
Run Blender --background --python tools/blender/build-campus-architecture.py.
"""
import bpy, math, json, pathlib
from mathutils import Vector
HERE=pathlib.Path(__file__).resolve().parent; ROOT=HERE.parent.parent
for o in list(bpy.data.objects): bpy.data.objects.remove(o,do_unlink=True)
S=bpy.context.scene; S.unit_settings.system='METRIC'
def mat(name,c,metal=0,rough=.4,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*c,1)
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 if emission:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emission
 return m
pearl=mat('Ceramic-coated pearl aluminum',(.48,.55,.58),.48,.42)
shadow=mat('Recessed graphite panels',(.035,.075,.095),.55,.38)
bronze=mat('Champagne anodized reveals',(.38,.26,.14),.75,.29)
glass=mat('Office coated architectural glass',(.036,.115,.155),.72,.13)
roof=mat('Standing-seam titanium roof',(.2,.29,.34),.55,.47)
base=mat('Honed concrete plinth',(.27,.33,.35),.05,.72)
lamp=mat('Warm white recessed fixtures',(1,.67,.35),.05,.3,2.2)
black=mat('Service recess',(.014,.025,.032),.1,.7)
groups={}
for n in ['HALL','OFFICE']:
 g=bpy.data.objects.new(n,None);S.collection.objects.link(g);groups[n]=g
# Viewer X/Y-up/Z becomes Blender X/Y=-Z/Z=Y. glTF transforms back to Y-up.
def pt(p):return(p[0],-p[2],p[1])
def mesh(name,v,f,m,group,bevel=0):
 me=bpy.data.meshes.new(name);me.from_pydata([pt(p) for p in v],[],f);me.update()
 o=bpy.data.objects.new(name,me);S.collection.objects.link(o);o.parent=groups[group];me.materials.append(m)
 if bevel:
  q=o.modifiers.new('Manufactured edge radii','BEVEL');q.width=bevel;q.segments=3
  o.modifiers.new('Weighted architectural normals','WEIGHTED_NORMAL')
 return o
def box(n,p,d,m,g,b=.04):
 v=[(p[0]+x*d[0]/2,p[1]+y*d[1]/2,p[2]+z*d[2]/2) for z in [-1,1] for y in [-1,1] for x in [-1,1]]
 return mesh(n,v,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)],m,g,b)
def prism(n,outline,y0,y1,m,g,b=.08):
 v=[(x,y,z) for y in [y0,y1] for x,z in outline];l=len(outline)
 # roundrect runs counterclockwise in X/Z. With Y up, its forward
 # winding points down: use it for the bottom, reverse it for the top.
 f=[tuple(range(l)),tuple(range(2*l-1,l-1,-1))]+[(i,i+l,(i+1)%l+l,(i+1)%l) for i in range(l)]
 return mesh(n,v,f,m,g,b)
def roundrect(w,d,r,steps=8):
 return [(sx*(w/2-r)+r*math.cos(a),sz*(d/2-r)+r*math.sin(a)) for sx,sz,start in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)] for a in [math.radians(start+i*90/steps) for i in range(steps+1)]]
def beam(n,a,b,w,d,m,g):
 A=Vector(pt(a));B=Vector(pt(b));mid=(A+B)/2
 bpy.ops.mesh.primitive_cube_add(size=1,location=mid);o=bpy.context.object;o.name=n;o.dimensions=(w,d,(B-A).length);o.rotation_euler=(B-A).to_track_quat('Z','Y').to_euler();bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=groups[g];o.data.materials.append(m)
 q=o.modifiers.new('Rounded structural edge','BEVEL');q.width=min(w,d)*.18;q.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
# Full opaque building envelope. No transparent server-hall walls.
# Hall-only materials: the graphite panels are lifted so the sun-away faces keep their form, and the roof
# reads as a single-ply membrane (seams, walkway pads, drains) rather than one flat plate.
hallGraphite=mat('Hall graphite wall panels',(.075,.1,.12),.35,.45)
membrane=mat('Hall roof membrane',(.26,.29,.3),0,.72)
seamMat=mat('Hall membrane seam',(.36,.39,.4),0,.6)
padMat=mat('Hall roof walkway pad',(.46,.46,.44),0,.85)
box('Opaque compute hall envelope',(0,11.15,0),(260,22,90),hallGraphite,'HALL',.18)
box('Continuous concrete plinth',(0,1.0,0),(260.5,1.7,90.5),base,'HALL',.12)
box('Visible roof deck',(0,22.23,0),(259,.16,89),membrane,'HALL',.04)
for i in range(129):box('Membrane seam',(-129+2*i+.5,22.335,0),(.06,.05,88.6),seamMat,'HALL',0)
for z in [-11.5,11.5]:box('Roof walkway pad',(0,22.36,z),(252,.1,1.2),padMat,'HALL',0)
for x in range(-104,105,26):
 for z in [-34,34]:box('Roof drain',(x,22.345,z),(.6,.07,.6),black,'HALL',0)
# Long facade: deep structural blade portals and faceted folded shells. Intentionally
# dramatic silhouette, yet every crown remains below the existing 25.12m fan outlet.
for sign in [-1,1]:
 z=sign*45.2
 for i in range(10):
  x=-130+i*26
  # Polygon is a cantilevering sculpted portal; solid bevelled volume, not thin lines.
  outline=[(x,2,z),(x+2.7,2,z),(x+7.3,18.4,z+sign*1.6),(x+23.5,21.65,z+sign*2.6),(x+26,23.25,z+sign*1.4),(x+6.1,22.35,z+sign*.5)]
  v=outline+[(a,b,c+sign*.55) for a,b,c in outline];l=len(outline)
  f=[tuple(range(l)),tuple(range(l,2*l))]+[(j,(j+1)%l,(j+1)%l+l,j+l) for j in range(l)]
  mesh('Folded structural portal',v,f,pearl,'HALL',.13)
  beam('Champagne portal reveal',(x+2.9,2.5,z+sign*.58),(x+7.5,18.2,z+sign*2.17),.17,.2,bronze,'HALL')
  # Upper dark ventilation screen stays recessed; no new cooling-capacity assertion.
  for y in [14.7+j*.75 for j in range(7)]:box('Recessed facade louver',(x+15.5,y,z-.06*sign),(17,.13,.3),roof,'HALL',0)
  if i in (1,5,8):
   # recessed personnel door with a small canopy and a door light
   box('Personnel door',(x+15.2,1.1+1.15,z+.2*sign),(1.1,2.3,.06),black,'HALL',0)
   box('Door canopy',(x+15.2,3.75,z+.75*sign),(1.9,.12,1.1),pearl,'HALL',.03)
   box('Door light',(x+15.2,3.62,z+.45*sign),(.4,.06,.14),lamp,'HALL',0)
  box('Ground-level insulated facade bay',(x+15.2,7.4,z+.03*sign),(17.2,10.8,.18),pearl,'HALL',.035)
  for xx in [x+10,x+15.5,x+21]:box('Panel expansion reveal',(xx,7.4,z+.14*sign),(.045,10.6,.035),shadow,'HALL',.008)
  # Warm luminaires contained under the folded overhang, not signal traces.
  beam('Recessed soffit fixture',(x+9,19.0,z+sign*2.0),(x+23.2,21.45,z+sign*2.65),.11,.11,lamp,'HALL')
 # Clear roof-edge coping, below fan plane and outside plant rows.
 box('Folded perimeter coping',(0,23.02,sign*44.7),(260,.45,1.0),pearl,'HALL',.12)
# East end: service wall with deep reveals; original four dock doors stay authoritative.
for z in [-38,-30,15,23,31,39]:
 box('East facade folded pier',(130.25,11.2,z),(1.0,20.7,1.25),pearl,'HALL',.12)
box('East facade crown',(130.6,22.55,0),(2.1,1.25,90),pearl,'HALL',.18)
# Office is an independently placed fixed 28x60m, three-story volume. Rounded corners,
# deep roof sails and vertical mullions create a visibly new flagship entrance.
# Curtain wall: reflective (not near-black matte) glass, with lit rooms grouped per floor behind it so the
# operations center reads as occupied at dusk. Representative architecture.
officeGlass=mat('Office curtain-wall glass',(.1,.17,.21),.55,.07)
roomLit=mat('Office lit interior',(.62,.42,.22),0,.6,.45)
prism('Three-story office glazing',roundrect(28,60,4),.3,16.3,officeGlass,'OFFICE',.04)
for row,(y0,y1) in enumerate([(.9,5.3),(6.15,10.55),(11.4,15.8)]):
 for col in range(16):
  if (col//3+row*2)%5<2:
   z=-22.5+col*3
   box('Lit office bay',(-14.06,(y0+y1)/2,z),(.02,y1-y0,2.6),roomLit,'OFFICE',0)
 for col in range(6):
  if (col+row)%3==0:
   x=-7.5+col*3
   for sz in [-1,1]:box('Lit office bay',(x,(y0+y1)/2,sz*30.06),(2.6,y1-y0,.02),roomLit,'OFFICE',0)
for y in [.28,5.55,10.8,16.25]:
 prism('Office continuous floor fascia',roundrect(29.2,61.2,4.2),y,y+.38,pearl,'OFFICE',.09)
# Roof canopy is supported, not a floating extra floor.
prism('Aerodynamic office roof sail',roundrect(32,64,6),18.7,19.4,pearl,'OFFICE',.23)
prism('Dark canopy underside',roundrect(30.6,62.6,5.6),18.58,18.7,shadow,'OFFICE',.07)
prism('Roof fascia light line',roundrect(32.2,64.2,6.05),18.98,19.06,lamp,'OFFICE',0)
for z in [-25,25]:
 for x in [-10,10]:beam('Roof sail supports',(x,16.5,z),(x-1.2,18.65,z),.32,.32,bronze,'OFFICE')
for z in range(-24,25,3):
 for x in [-14.04,14.04]:box('Office curtain-wall mullion',(x,8.35,z),(.22,15.6,.16),bronze,'OFFICE',.035)
for x in range(-9,10,3):
 for z in [-30.04,30.04]:box('Office end mullion',(x,8.35,z),(.16,15.6,.22),bronze,'OFFICE',.035)
# Two lower entry canopies stay within prior porch extent west of the office.
for z in [-21,21]:
 # glazed entrance vestibule with a door, tied back to the facade by the canopy beams
 box('Entrance vestibule glass',(-15.6,1.85,z),(3.2,3.1,5.2),officeGlass,'OFFICE',.02)
 box('Vestibule frame',(-15.6,3.47,z),(3.3,.14,5.3),bronze,'OFFICE',.02)
 box('Entrance door',(-17.23,1.4,z),(.04,2.2,1.8),black,'OFFICE',0)
 for dz in [-2.6,2.6]:beam('Canopy tie beam',(-21.5,4.85,z+dz),(-14.1,4.85,z+dz),.22,.3,bronze,'OFFICE')
 prism('Entry canopy',roundrect(10,11,2),4.65,5.05,pearl,'OFFICE',.12).location.x=-17.5
 for dz in [-4,4]:beam('Entry canopy support',(-21,.2,z+dz),(-21,4.65,z+dz),.28,.28,bronze,'OFFICE')
 # canopy prism above is centered before this local offset.
 o=bpy.context.scene.objects.get('Entry canopy' if z==-21 else 'Entry canopy.001')
 if o:o.location.y=-z
 box('Entry fixture',(-17.5,4.6,z),(7,.08,.18),lamp,'OFFICE',.03)
# Apply modifiers and batch by semantic group/material. Root transforms remain zero.
bpy.ops.object.select_all(action='DESELECT')
for o in list(S.objects):
 if o.type=='MESH':
  bpy.context.view_layer.objects.active=o;o.select_set(True)
  for m in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=m.name)
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  o.select_set(False)
for g in groups.values():
 for m in list(bpy.data.materials):
  obs=[o for o in list(g.children) if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
  if len(obs)>1:
   bpy.ops.object.select_all(action='DESELECT')
   for o in obs:o.select_set(True)
   bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=g.name+' '+m.name
root=bpy.data.objects.new('IFX_CAMPUS_ARCHITECTURE',None);S.collection.objects.link(root)
root['ifx']=json.dumps({'version':1,'units':'m','representative':True,'hallEnvelope':[260,22,90],'officeEnvelope':[28,16,60],'maxFacadeHeight':23.4,'authoredIn':'Blender'})
for g in groups.values():g.parent=root
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'campus-architecture.blend'))
path=ROOT/'public/models/campus-architecture.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,export_extras=True)
print('CAMPUS_ASSET',path.stat().st_size,'bytes',sum(len(o.data.polygons) for o in S.objects if o.type=='MESH'),'polygons')

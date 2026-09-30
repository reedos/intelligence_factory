"""Tesla-inspired campus fleet, authored in Blender from public exterior references.
Viewer metres: +X forward, +Y up, wheels touch Y=0. No manufacturer CAD used.
Model 3/Y use published body length/height; Cybercab/Robovan scale is representative.
"""
import bpy, math, json, sys
from pathlib import Path
from mathutils import Vector
import bmesh
ROOT=Path(__file__).resolve().parents[2]
for o in list(bpy.data.objects):bpy.data.objects.remove(o,do_unlink=True)
S=bpy.context.scene;S.unit_settings.system='METRIC'
def mat(n,c,metal=0,rough=.3,emit=0):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
 p.inputs['Coat Weight'].default_value=.7;p.inputs['Coat Roughness'].default_value=.2
 if emit:p.inputs['Emission Color'].default_value=(*c,1);p.inputs['Emission Strength'].default_value=emit
 return m
white=mat('Pearl white multi-coat',(.78,.83,.85),.3,.24);blue=mat('Deep blue metallic',(.027,.095,.24),.65,.25)
gold=mat('Cybercab satin gold',(.65,.39,.15),.75,.28);silver=mat('Robovan champagne silver',(.64,.65,.59),.72,.29)
glass=mat('Smoked automotive glass',(.008,.020,.029),.5,.13);black=mat('Black exterior trim',(.009,.014,.019),.2,.39)
tire=mat('Tire rubber',(.010,.014,.016),0,.8);alloy=mat('Machined aero wheel',(.3,.34,.37),.83,.27)
light=mat('Unlit pale LED lens',(.62,.78,.88),.1,.23,.25);red=mat('Red rear light lens',(.42,.013,.018),.2,.24,.15)
groups={}
for n in ['MODEL_3','MODEL_Y','CYBERCAB','ROBOVAN']:
 g=bpy.data.objects.new(n,None);S.collection.objects.link(g);groups[n]=g
def pt(p):return(p[0],-p[2],p[1])
def mesh(n,v,f,m,g,smooth=True):
 me=bpy.data.meshes.new(n);me.from_pydata([pt(p)for p in v],[],f);me.update();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
 o=bpy.data.objects.new(n,me);S.collection.objects.link(o);o.parent=groups[g];me.materials.append(m)
 for p in me.polygons:p.use_smooth=smooth
 return o
def loft(n,sections,m,g,steps=32,capdepth=0,crown_power=.72):
 # Cross sections give genuine curved bodywork and beltline shoulders. Each is
 # (longitudinal X, half width, underside, shoulder, crown), all metres.
 sections=refine(sections);v=[]
 for x,w,low,belt,top in sections:
  for k in range(steps):
   a=k*2*math.pi/steps;z=w*math.sin(a);c=math.cos(a)
   y=belt+(top-belt)*c**crown_power if c>=0 else belt-(belt-low)*(-c)**.28
   v.append((x,y,z))
 f=[] if capdepth else [tuple(reversed(range(steps))),tuple(range((len(sections)-1)*steps,len(sections)*steps))]
 for j in range(len(sections)-1):
  for k in range(steps):a=j*steps+k;b=j*steps+(k+1)%steps;f.append((a,b,b+steps,a+steps))
 if capdepth:
  # Curved bumper end surfaces replace flat polygon caps. Rings make the shape
  # and highlights continuous instead of merely smoothing a flat front face.
  for sign,start,sec in [(-1,0,sections[0]),(1,(len(sections)-1)*steps,sections[-1])]:
   centerY=(sec[2]+sec[4])/2;prev=[start+k for k in range(steps)]
   for row in range(1,6):
    r=1-row/6;ring=[]
    for k in range(steps):
     p=v[start+k];ring.append(len(v));v.append((sec[0]+sign*capdepth*(1-r*r),centerY+(p[1]-centerY)*r,p[2]*r))
    for k in range(steps):f.append((prev[k],prev[(k+1)%steps],ring[(k+1)%steps],ring[k]))
    prev=ring
   c=len(v);v.append((sec[0]+sign*capdepth,centerY,0))
   for k in range(steps):f.append((prev[k],prev[(k+1)%steps],c))
 return mesh(n,v,f,m,g)
def refine(sections):
 out=[]
 for i in range(len(sections)-1):
  a,b=sections[i],sections[i+1];p=sections[max(0,i-1)];q=sections[min(len(sections)-1,i+2)]
  for k in range(4):
   t=k/4
   out.append(tuple(a[j]+(b[j]-a[j])*t if j==0 else max(min(a[j],b[j]),min(max(a[j],b[j]),.5*((2*a[j])+(-p[j]+b[j])*t+(2*p[j]-5*a[j]+4*b[j]-q[j])*t*t+(-p[j]+3*a[j]-3*b[j]+q[j])*t*t*t))) for j in range(5)))
 return out+[sections[-1]]
def surface(sections,x,z):
 arr=refine(sections)
 for a,b in zip(arr,arr[1:]):
  if a[0]-1e-5<=x<=b[0]+1e-5:
   t=(x-a[0])/(b[0]-a[0]);w,lo,be,to=[a[j]+(b[j]-a[j])*t for j in range(1,5)]
   return be+(to-be)*max(0,1-(z/w)**2)**.36
 return sections[-1][4]
def glass_patch(n,sections,xs,us,m,g):
 v=[]
 for x in xs:
  arr=refine(sections);a,b=next((a,b)for a,b in zip(arr,arr[1:])if a[0]-1e-5<=x<=b[0]+1e-5);t=(x-a[0])/(b[0]-a[0]);w=a[1]+(b[1]-a[1])*t
  for u in us:z=w*u;v.append((x,surface(sections,x,z)+.01,z))
 f=[];nU=len(us)
 for i in range(len(xs)-1):
  for j in range(nU-1):a=i*nU+j;f.append((a,a+1,a+1+nU,a+nU))
 return mesh(n,v,f,m,g)
def path(n,points,r,m,g):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.resolution_u=6;c.bevel_depth=r;c.bevel_resolution=1
 sp=c.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for p,co in zip(sp.bezier_points,points):p.co=pt(co);p.handle_left_type=p.handle_right_type='AUTO'
 o=bpy.data.objects.new(n,c);S.collection.objects.link(o);o.parent=groups[g];c.materials.append(m);return o
def wheel(n,x,r,z,width,m,g):
 bpy.ops.mesh.primitive_cylinder_add(vertices=28,radius=r,depth=width,location=pt((x,r,z)),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name=n;o.parent=groups[g];o.data.materials.append(m)
 b=o.modifiers.new('Sidewall shoulder','BEVEL');b.width=min(.032,width*.22);b.segments=2;o.modifiers.new('Weighted wheel normals','WEIGHTED_NORMAL')
 for p in o.data.polygons:p.use_smooth=True
 return o
def arch(body,x,r,g):
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r+.035,depth=3,location=pt((x,r,0)),rotation=(math.pi/2,0,0));c=bpy.context.object
 bpy.context.view_layer.objects.active=body;q=body.modifiers.new('Real wheel arch cutout','BOOLEAN');q.operation='DIFFERENCE';q.solver='EXACT';q.object=c;bpy.ops.object.modifier_apply(modifier=q.name);bpy.data.objects.remove(c,do_unlink=True)
def wheels(body,xs,w,r,g,covered=False):
 for x in xs:
  arch(body,x,r,g)
  for s in [-1,1]:
   z=s*(w/2-.12);wheel('Road tire',x,r,z,.21,tire,g)
   # Full gold covers distinguish Cybercab; ordinary cars get aerodynamic spokes.
   wheel('Closed gold aero cover' if covered else 'Aero wheel face',x,r*.77,z+s*.111,.025,gold if covered else black,g).location.z=r
   if not covered:
    for k in range(5):
     a=k*math.tau/5
     path('Swept wheel spoke',[(x+.03*math.cos(a),r+.03*math.sin(a),z+s*.128),(x+r*.54*math.cos(a+.13),r+r*.54*math.sin(a+.13),z+s*.129),(x+r*.74*math.cos(a+.24),r+r*.74*math.sin(a+.24),z+s*.128)],.026,alloy,g)
   wheel('Wheel center cap',x,r*.13,z+s*.137,.027,gold if covered else alloy,g).location.z=r
def side_seams(g,L,W,H,roofRear=-1.3,roofFront=.95):
 for s in [-1,1]:
  z=s*(W/2+.002)
  # Flush handles and door shut-lines add scale without logos or branded texture.
  path('Door opening seam',[(roofRear,.88,z),(-1.05,.35,z),(-.1,.28,z),(.2,.36,z),(.24,.94,z)],.0045,black,g)
  path('Front door seam',[(.24,.94,z),(.2,.36,z),(1.1,.3,z),(1.3,.85,z)],.0045,black,g)
  for x in [-.7,.6]:path('Flush door handle',[(x,.88,z+s*.006),(x+.18,.88,z+s*.006)],.011,black,g)
def sedan(g,L,W,H,paint,y=False):
 hl=L/2;r=.365 if y else .335
 # Independent sedan/crossover body profiles, instead of stretching one slab.
 # Hood, beltline and fastback heights are interpreted from public photographs.
 if y:
  sec=[(-hl,.73,.31,.78,.99),(-hl+.13,.88,.20,.91,1.06),(-1.5,.955,.18,.96,1.11),(-.7,.96,.18,.95,1.10),(.4,.96,.18,.93,1.06),(1.3,.95,.19,.89,1.02),(1.85,.91,.22,.84,.95),(hl-.10,.81,.28,.73,.80),(hl,.72,.36,.64,.72)]
  cab=[(-1.91,.61,.94,1.00,1.08),(-1.5,.72,.98,1.10,1.34),(-.9,.76,.99,1.12,1.56),(-.25,.78,1.00,1.13,H),(.3,.79,1.00,1.12,H-.035),(.75,.79,.98,1.10,1.43),(1.19,.79,.92,1.00,1.08)]
 else:
  sec=[(-hl,.68,.28,.70,.84),(-hl+.12,.83,.18,.83,.91),(-1.5,.92,.15,.91,.99),(-.7,.925,.15,.90,.98),(.4,.925,.15,.87,.96),(1.35,.92,.17,.83,.92),(1.86,.86,.19,.75,.82),(hl-.11,.77,.24,.64,.71),(hl,.66,.30,.54,.62)]
  cab=[(-1.77,.57,.84,.90,.96),(-1.3,.70,.86,.96,1.15),(-.78,.74,.87,.98,1.36),(-.23,.75,.88,.98,H),(.28,.76,.88,.97,H-.02),(.70,.77,.86,.95,1.27),(1.18,.76,.82,.89,.96)]
 body=loft('Refreshed Model Y rounded fastback body' if y else 'Highland smooth sedan body',sec,paint,g,48,.065)
 loft('Painted roof rails and pillars',cab,paint,g,48,crown_power=.36)
 def cabpt(x,a,offset=.010):
  arr=refine(cab);aa,bb=next((aa,bb)for aa,bb in zip(arr,arr[1:])if aa[0]-1e-5<=x<=bb[0]+1e-5);t=(x-aa[0])/(bb[0]-aa[0]);w,low,belt,top=[aa[j]+(bb[j]-aa[j])*t for j in range(1,5)]
  return(x,belt+(top-belt)*max(0,math.cos(a))**.36+offset,w*math.sin(a)+offset*math.sin(a))
 def pane(n,rows,m=glass):
  # Curved glass stays consistently outside the painted shell, with visible
  # body-colored rails and pillars between windscreen, roof and side windows.
  dense=[]
  for ra,rb in zip(rows,rows[1:]):
   count=max(2,math.ceil(abs(rb[0]-ra[0])/.035))
   for j in range(count):dense.append(tuple(ra[k]+(rb[k]-ra[k])*j/count for k in range(3)))
  dense.append(rows[-1]);rows=dense
  v=[];N=32
  for x,a,b in rows:
   for j in range(N+1):v.append(cabpt(x,a+(b-a)*j/N))
  f=[]
  for i in range(len(rows)-1):
   for j in range(N):q=i*(N+1)+j;f.append((q,q+1,q+N+2,q+N+1))
  return mesh(n,v,f,m,g)
 def band(n,x0,x1,a,b):pane(n,[(x0+(x1-x0)*i/18,a,b)for i in range(19)])
 band('Curved front windshield',.32,1.13,-.96,.96)
 band('Panoramic roof glass',-.82,.32,-.96,.96)
 band('Fastback rear glass',-1.85 if y else -1.60,-.82,-.96,.96)
 for s in [-1,1]:
  # Side glazing follows the roof curvature and tapers to closed corner points.
  rows=[(-1.78 if y else -1.54,1.32,1.39),(-1.35,1.14,1.46),(-.92,1.04,1.48),(-.45,1.02,1.48),(.15,1.02,1.48),(.58,1.05,1.47),(.91,1.28,1.44),(1.00,1.35,1.38)]
  pane('Fitted side window',[(x,s*a,s*b)for x,a,b in rows])
  pane('Satin B pillar',[(-.23,s*1.02,s*1.49),(-.17,s*1.02,s*1.49)],black)
  path('Black window surround',[cabpt(x,s*a,.008)for x,a,b in rows]+[cabpt(x,s*b,.008)for x,a,b in reversed(rows)],.009,black,g)
  # Mirrors retain the exact extended-mirror envelope, with a short black stem.
  my=.13 if y else 0
  path('Mirror mounting stem',[(.86,1.01+my,s*.79),(.90,1.01+my,s*.92)],.025,black,g)
  loft('Body colored mirror shell',[(.79,.025,1.00+my,1.035+my,1.065+my),(.90,.13,.99+my,1.04+my,1.08+my),(1.04,.065,1.00+my,1.035+my,1.07+my)],paint,g).location.y=-s*(.9345 if y else .9145)
 if y:
  points=[(hl-.075,surface(sec,hl-.075,z)+.012,z)for z in [-.69,-.5,-.3,0,.3,.5,.69]]
  path('Model Y dark lightbar surround',points,.031,black,g)
  path('Refreshed Y full width front light bar',[(x,yy+.030,z)for x,yy,z in points],.013,light,g)
  for s in [-1,1]:path('Lower Y projector housing',[(hl-.055,.57,s*.51),(hl-.14,.57,s*.69)],.036,black,g)
  path('Refreshed Y indirect rear light bar',[(-hl+.02,surface(sec,-hl+.02,z)+.009,z)for z in [-.75,-.4,0,.4,.75]],.017,red,g)
 else:
  for s in [-1,1]:
   pts=[(hl-.13,s*.42),(hl-.23,s*.62),(hl-.45,s*.78),(hl-.64,s*.78),(hl-.45,s*.68)]
   mesh('Highland swept headlamp housing',[(x,surface(sec,x,z)+.012,z)for x,z in pts],[(0,1,2,3,4)],black,g)
   path('Slim Highland separate LED',[(x,surface(sec,x,z)+.025,z)for x,z in pts[:3]],.012,light,g)
   path('Model 3 rear C lamp',[(-hl+.03,.715,s*.62),(-hl+.03,.715,s*.72),(-hl+.03,.64,s*.72)],.016,red,g)
 path('Lower front intake',[(hl-.08,.36,-.50),(hl-.01,.34,0),(hl-.08,.36,.50)],.048,black,g)
 # Hood shut lines and continuous side sill establish actual panels and scale.
 def sidept(x,yy,s):
  arr=refine(sec);aa,bb=next((aa,bb)for aa,bb in zip(arr,arr[1:])if aa[0]-1e-5<=x<=bb[0]+1e-5);t=(x-aa[0])/(bb[0]-aa[0]);w,lo,be,to=[aa[j]+(bb[j]-aa[j])*t for j in range(1,5)]
  c=max(0,min(1,(be-yy)/(be-lo)))**(1/.28) if yy<=be else max(0,min(1,(yy-be)/(to-be)))**(1/.72)
  return(x,yy,s*(w*math.sqrt(1-c*c)+.006))
 for s in [-1,1]:
  path('Hood shut line',[(x,surface(sec,x,z)+.006,z)for x,z in [(1.14,s*.67),(1.46,s*.59),(1.83,s*.54),(hl-.15,s*.43)]],.0035,black,g)
  path('Lower door sill',[(-1.10,.22,s*(W*.48)),(0,.21,s*(W*.485)),(1.15,.22,s*(W*.48))],.025,black,g)
  dh=.10 if y else 0
  for points in [[(-1.17,.86+dh),(-.98,.69),(-.95,.39),(-.83,.28),(-.18,.27),(-.17,.87+dh)],[(-.17,.87+dh),(-.18,.27),(.85,.28),(1.08,.38),(1.10,.84+dh)]]:
   path('Door panel gap',[sidept(x,yy,s)for x,yy in points],.0035,black,g)
  for x in [-.76,.48]:path('Flush door handle',[sidept(x,.84+dh,s),sidept(x+.15,.84+dh,s)],.009,black,g)
  if y:
   # Current Model Y's dark rocker and wheel-arch cladding establish the taller
   # crossover stance without changing its published height or overall envelope.
   verts=[sidept(x,yy,s)for x in [-1.02,-.5,0,.5,1.1]for yy in [.20,.32]]
   mesh('Model Y dark lower rocker',verts,[(j,j+1,j+3,j+2)for j in range(0,8,2)],black,g)
   for wx in [-1.335,1.555]:
    path('Model Y wheel arch cladding',[(wx+(r+.038)*math.cos(a),r+(r+.038)*math.sin(a),s*(W/2-.007))for a in [i*math.pi/24 for i in range(25)]],.018,black,g)
 wheels(body,[-1.335,1.555]if y else[-1.383,1.492],W,r,g)
 edge=body.modifiers.new('Soft bumper and fender edge radii','BEVEL');edge.width=.035;edge.segments=3;edge.limit_method='ANGLE';edge.angle_limit=.5

sedan('MODEL_3',4.720,1.850,1.440,white)
sedan('MODEL_Y',4.790,1.920,1.624,white,True)
# Two-seat fastback coupe (public descriptions: two seats, butterfly doors, sloped roofline, matte gold,
# oversized covered wheels, no rear window): short low nose with a full-width light bar, one continuous
# slope from the windshield over the roof into a fastback that ends at a sharp horizontal tail with a
# full-width rear light bar. Proportions are representative.
g='CYBERCAB'
satin=mat('Cybercab satin gold',(.6,.37,.15),.7,.45);satin.node_tree.nodes.get('Principled BSDF').inputs['Coat Weight'].default_value=0
cyber=[(-2.24,.80,.30,.70,.80),(-2.1,.92,.20,.76,.95),(-1.5,.96,.16,.79,1.14),(-.75,.97,.15,.81,1.33),(-.05,.96,.15,.80,1.36),
       (.7,.94,.16,.78,1.12),(1.3,.92,.18,.78,.95),(1.85,.86,.2,.72,.8),(2.2,.74,.26,.6,.66)]
body=loft('Cybercab fastback body',cyber,satin,g,40)
body.data.materials.append(glass)
for poly in body.data.polygons:
 if poly.index<2:continue
 k=(poly.index-2)%40;crown=math.cos((k+.5)*math.tau/40);cx=poly.center.x
 # greenhouse: windshield and the side glass ahead of the fastback; the fastback itself stays gold (no rear window)
 if crown>.2 and -.55<cx<1.2:poly.material_index=1
for sgn in [-1,1]:
 path('Butterfly door shut line',[(.62,1.02,sgn*.955),(.2,.42,sgn*.975),(-.9,.42,sgn*.975),(-1.02,.95,sgn*.965)],.0045,black,g)
path('Cybercab front light bar',[(2.19,.62,-.7),(2.235,.63,0),(2.19,.62,.7)],.018,light,g)
path('Cybercab rear light bar',[(-2.235,.77,-.76),(-2.26,.775,0),(-2.235,.77,.76)],.02,red,g)
wheels(body,[-1.42,1.38],1.94,.36,g,True)
g='ROBOVAN'
body=loft('Robovan streamlined pod',[(-3.25,.72,.20,.80,1.45),(-3.08,1.05,.13,1.28,2.25),(-2.60,1.25,.12,1.60,2.79),(-1.80,1.275,.12,1.70,2.9),(0,1.275,.12,1.72,2.9),(1.8,1.275,.12,1.70,2.9),(2.6,1.25,.12,1.60,2.79),(3.08,1.05,.13,1.28,2.25),(3.25,.72,.20,.80,1.45)],silver,g,48)
# The public concept has a continuous low skirt, not exposed circular wheel
# openings. This separate black lower fairing encloses the small running wheels.
loft('Robovan low wheel-concealing skirt',[(-3.08,.92,.10,.27,.46),(-2.6,1.25,.08,.31,.50),(-1.8,1.27,.08,.31,.50),(0,1.27,.08,.31,.50),(1.8,1.27,.08,.31,.50),(2.6,1.25,.08,.31,.50),(3.08,.92,.10,.27,.46)],black,g,48)
# Tall central doors and multiple horizontal body fins match the public concept's
# distinctive side view. Low concealed wheels keep its smooth skirt silhouette.
for s in [-1,1]:
 z=s*1.278
 mesh('Robovan central black door',[(-1.20,.22,z),(-.88,2.32,z),(-.61,2.57,z),(.61,2.57,z),(.88,2.32,z),(1.20,.22,z)],[(0,1,2,3,4,5)],glass,g)
 path('Robovan door light outline',[(-1.20,.25,z+s*.012),(-.86,2.32,z+s*.012),(-.61,2.55,z+s*.012),(.61,2.55,z+s*.012),(.86,2.32,z+s*.012),(1.20,.25,z+s*.012)],.012,light,g)
 for k in range(5):
  yy=1.2+k*.105
  for a,b in [(-3.02,-.98),(.98,3.02)]:path('Robovan horizontal fin',[(a,yy,s*(1.12 if abs(a)>2 else 1.285)),((a+b)/2,yy,s*1.288),(b,yy,s*(1.12 if abs(b)>2 else 1.285))],.017,black,g)
 for x in [-2.15,2.15]:wheel('Concealed Robovan wheel',x,.31,s*1.07,.23,tire,g)
for end,m in [(1,light),(-1,red)]:
 for k in range(4):path('Robovan wraparound end light',[(end*3.08,1.12+k*.10,-.97),(end*3.27,1.12+k*.1,0),(end*3.08,1.12+k*.10,.97)],.018,m,g)

# Convert curves and bake modifiers, then batch each vehicle by material.
for o in list(S.objects):
 if o.type not in ['MESH','CURVE']:continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 if o.type=='CURVE':bpy.ops.object.convert(target='MESH');o=bpy.context.object
 for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
# Fit the complete production-car envelope, including glazing offsets and lamps,
# to published length / mirror width / height. Concepts remain representative.
for n,L,W,H in [('MODEL_3',4.720,2.089,1.440),('MODEL_Y',4.790,2.129,1.624)]:
 vertices=[v for o in groups[n].children if o.type=='MESH' for v in o.data.vertices]
 low=[min(v.co[k]for v in vertices)for k in range(3)];high=[max(v.co[k]for v in vertices)for k in range(3)]
 for v in vertices:
  for k,target in enumerate([L,W,H]):v.co[k]=(v.co[k]-(low[k]if k==2 else (low[k]+high[k])/2))*target/(high[k]-low[k])
for g in groups.values():
 for m in list(bpy.data.materials):
  obs=[o for o in g.children if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
  if not obs:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in obs:o.select_set(True)
  bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();bpy.context.object.name=g.name+'__'+m.name
root=bpy.data.objects.new('IFX_CAMPUS_VEHICLES',None);S.collection.objects.link(root)
root['ifx']=json.dumps({'version':1,'units':'m','forward':'+X','groundY':0,'representative':True,'assets':list(groups),'scope':'Public-photo-inspired exterior silhouettes; not manufacturer CAD. Cybercab and Robovan dimensions assumed for illustration. Model3 and ModelY use published length and height; exterior details simplified.'})
for g in groups.values():g.parent=root
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools/blender/campus-vehicles.blend'))
out=ROOT/'public/models/campus-vehicles.glb';bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('VEHICLES',out.stat().st_size,'bytes')
if '--render' in sys.argv:
 # Review-only contact sheet. Asset origin/positions were saved before staging.
 for n,p in [('MODEL_3',(-3.5,0,3.1)),('MODEL_Y',(3.3,0,3.1)),('CYBERCAB',(-3.5,0,-1.0)),('ROBOVAN',(3.3,0,-2.2))]:groups[n].location=pt(p)
 floor=mat('Studio floor',(.075,.09,.11),.1,.65)
 bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.data.materials.append(floor);bpy.context.object.location.z=-.02
 S.world.color=(.16,.18,.22)
 for p,power,size in [((3,-6,12),2200,8),((-8,-3,7),1700,7),((4,8,10),2500,6)]:
  bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,0))-o.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=(14,-20,18));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=18;S.camera=cam
 S.render.engine='CYCLES';S.cycles.samples=24;S.cycles.use_denoising=True;S.render.resolution_x=1400;S.render.resolution_y=1000;S.render.resolution_percentage=100;S.render.image_settings.file_format='PNG';S.render.filepath=str(ROOT/'tools/blender/campus-vehicles-review.png');bpy.ops.render.render(write_still=True)
 # Closer front-three-quarter review of the requested white production cars.
 for n in ['CYBERCAB','ROBOVAN']:
  for o in groups[n].children:o.hide_render=True
 groups['MODEL_3'].location=pt((-3,0,0));groups['MODEL_Y'].location=pt((3,0,0))
 cam.location=(10,-15,8);cam.rotation_euler=(Vector((0,0,.65))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=12
 S.render.filepath=str(ROOT/'tools/blender/campus-tesla-white-review.png');bpy.ops.render.render(write_still=True)

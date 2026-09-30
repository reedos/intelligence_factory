"""Blender campus mechanical and landscape catalog, representative engineering envelopes."""
import pathlib
HERE=pathlib.Path(__file__).resolve().parent
exec((HERE/'build-campus-architecture.py').read_text().split('# Full opaque building envelope.')[0])
import random
for g in list(groups.values()):bpy.data.objects.remove(g,do_unlink=True)
groups={}
for name in ['COOLER','UNITSUB','GENSET','BESS','CAR','TRUCK','TREE0','TREE1','TREE2','FAN','HALL_RACK','HALL_CABINET','MAP_CAMPUS','MAP_HUT','MAP_TERMINAL','WALKER','EHOUSE','CTRL_HOUSE','SHELTER','GATEHOUSE','TOWER_CELL','BESS_PCS','SUB_BREAKER','SUB_POST','SUB_ARRESTER','SUB_CVT','SUB_DISCONNECT','SUB_STRING','FUEL_TANK','FUEL_TANK_ACCESS']:
 g=bpy.data.objects.new(name,None);S.collection.objects.link(g);groups[name]=g
steel=mat('Mechanical brushed steel',(.34,.42,.46),.8,.35)
white=mat('Equipment ceramic white',(.72,.77,.76),.3,.39)
rubber=mat('EPDM and tire rubber',(.012,.018,.022),0,.82)
leaf=[mat('Foliage '+str(i),c,0,.86) for i,c in enumerate([(.045,.12,.073),(.08,.18,.11),(.13,.23,.15)])]
wood=mat('Tree bark',(.12,.09,.055),0,.95)
def cyl(n,p,r,h,m,g,axis='y',segments=24):
 bpy.ops.mesh.primitive_cylinder_add(vertices=segments,radius=r,depth=h,location=pt(p));o=bpy.context.object;o.name=n;o.parent=groups[g];o.data.materials.append(m)
 if axis=='x':o.rotation_euler.y=math.pi/2
 if axis=='z':o.rotation_euler.x=math.pi/2
 q=o.modifiers.new('Turned edge','BEVEL');q.width=min(r,h)*.08;q.segments=2;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def ring(n,p,r,minor,m,g,major=32,minor_seg=8):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=minor,major_segments=major,minor_segments=minor_seg,location=pt(p));o=bpy.context.object;o.name=n;o.parent=groups[g];o.data.materials.append(m);return o
def open_throat(n,p,outer,inner,h,m,g,segments=32):
 # Hollow fan shroud: annular lips and inner/outer walls, no solid disk
 # underneath the aperture that would close the intended air passage.
 v=[(p[0]+r*math.cos(i*2*math.pi/segments),p[1]+y,p[2]+r*math.sin(i*2*math.pi/segments)) for r,y in [(outer,-h/2),(outer,h/2),(inner,-h/2),(inner,h/2)] for i in range(segments)]
 f=[]
 for i in range(segments):
  j=(i+1)%segments;a=i;b=segments+i;c=2*segments+i;d=3*segments+i
  f.extend([(a,b,segments+j,j),(c,2*segments+j,3*segments+j,d),(b,d,3*segments+j,segments+j),(a,j,2*segments+j,c)])
 return mesh(n,v,f,m,g)
# Six-fan V-type dry-cooler cassette. Original footprint and rotor anchors retained. Each side is one coil
# panel leaning about 10 degrees inward with unbevelled fin lines (the 96 bevelled fin boxes cost ~20k
# triangles for sub-pixel detail), wire guards over the fan throats, header stubs and an EC control box.
def obox(n,c,d,rx,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pt(c));o=bpy.context.object;o.name=n;o.parent=groups[g];o.data.materials.append(m)
 o.scale=(d[0],d[2],d[1]);o.rotation_euler=(math.radians(rx),0,0);return o
g='COOLER';box('Structural skid',(0,.15,0),(11.6,.3,2.3),steel,g,.04)
for sz in [-1,1]:
 obox('V-coil casing',(0,1.2,sz*.9),(11.6,1.85,.13),sz*10,shadow)
 for i in range(28):obox('Coil fin line',(-5.4+i*.4,1.2,sz*.965),(.03,1.7,.03),sz*10,steel)
 for x in [-5.72,5.72]:obox('Coil end frame',(x,1.2,sz*.92),(.14,1.85,.2),sz*10,steel)
box('Fan deck',(0,2.2,0),(11.6,.2,2.4),white,g,.04)
for i in range(6):
 x=-4.9+i*1.96;open_throat('Fan throat',(x,2.43,0),.9,.78,.28,steel,g);ring('Rolled fan bellmouth',(x,2.57,0),.84,.055,white,g,24,6)
 cyl('Fan aperture',(x,2.585,0),.78,.016,black,g)
 # wire fan guard above the rotor: outer and inner rings with eight radial wires
 ring('Fan guard ring',(x,2.8,0),.8,.018,steel,g,24,4);ring('Fan guard ring',(x,2.8,0),.45,.014,steel,g,16,4)
 for k in range(8):
  a=k*math.pi/4;A=Vector(pt((x+.12*math.cos(a),2.8,.12*math.sin(a))));B=Vector(pt((x+.8*math.cos(a),2.8,.8*math.sin(a))))
  bpy.ops.mesh.primitive_cylinder_add(vertices=4,radius=.012,depth=(B-A).length,location=(A+B)/2);o=bpy.context.object;o.name='Fan guard wire'
  o.rotation_euler=(B-A).to_track_quat('Z','Y').to_euler();o.parent=groups[g];o.data.materials.append(steel)
 for dz in [-.85,.85]:box('Guard standoff',(x,2.69,dz),(.03,.22,.03),steel,g,0)
for x in [-5.6,5.6]:
 for z in [-1,1]:box('Cooler support',(x,-.2,z),(.15,.4,.15),steel,g,0)
# inlet/outlet header stubs with flanges on the -X end, and the EC fan control box
for z,yy in [(-.55,.75),(.55,1.55)]:
 cyl('Header stub',(-6.05,yy,z),.12,.5,steel,g,'x');cyl('Header flange',(-6.3,yy,z),.2,.05,steel,g,'x')
box('EC control box',(5.95,1.1,.6),(.25,.7,.5),white,g,.02)
# Axial fan rotor, normalized radius 1 for the runtime spinners (blades in the XZ plane, spinning about Y).
# Five twisted, cambered airfoil blades (about 18 degrees pitch at the root easing to 8 at the tip) on a hub.
# One material, because the viewer takes the rotor as a single geometry.
g='FAN'
rotor=mat('Rotor FRP grey',(.13,.14,.15),.25,.5)
bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.17,depth=.14,location=(0,0,0));o=bpy.context.object;o.name='Rotor hub';o.parent=groups[g];o.data.materials.append(rotor)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=6,radius=.17,location=(0,0,.07));o=bpy.context.object;o.name='Rotor hub cap';o.scale=(1,1,.45);o.parent=groups[g];o.data.materials.append(rotor)
stations=[.15,.3,.45,.6,.75,.88,.97];chord=lambda r:.24-.1*r;pitch=lambda r:math.radians(18-10*(r-.15)/.82)
for k in range(5):
 a0=k*2*math.pi/5;v=[];f=[];cols=5
 for r in stations:
  c=chord(r);ph=pitch(r)
  for side in [1,-1]:
   for j in range(cols):
    u=j/(cols-1)-.5;cam=.035*c*(1-4*u*u);t=.012*(1-4*u*u)*side
    x=u*c;y=cam+t
    # twist about the radial axis, then place at radius r, rotated to blade angle a0
    yy=x*math.sin(ph)+y*math.cos(ph);xx=x*math.cos(ph)-y*math.sin(ph)
    px=r*math.cos(a0)-xx*math.sin(a0);pz=r*math.sin(a0)+xx*math.cos(a0)
    v.append((px,yy,pz))
 n=len(stations);row=2*cols
 for i in range(n-1):
  for j in range(cols-1):
   a_=i*row+j;b_=(i+1)*row+j
   f.append((a_,a_+1,b_+1,b_));f.append((a_+cols+1,a_+cols,b_+cols,b_+cols+1))
 for i in range(n-1):
  for j in [0,cols-1]:
   a_=i*row+j;b_=(i+1)*row+j;f.append((a_,b_,b_+cols,a_+cols) if j==0 else (a_,a_+cols,b_+cols,b_))
 last=(n-1)*row;f.append(tuple(last+j for j in range(cols))+tuple(last+cols+j for j in reversed(range(cols))))
 o=mesh('Twisted airfoil blade',v,f,rotor,g)
 for q in o.data.polygons:q.use_smooth=True
# Pad-mounted unit substation, 2500 kVA class, local +Z faces the road. Proportions follow published
# 2500 kVA pad-mount data (about 72 in W x 99 in D x 73 in H): a 1.85 m wide tank with the HV (left) and
# LV (right) compartments in front behind lockable doors, radiators on the sides and back projecting no
# more than 0.6 m, lifting lugs, a nameplate and a hazard label. ANSI 70 light grey enamel.
g='UNITSUB'
a61=mat('Pad-mount ANSI 70 light grey enamel',(.45,.49,.5),.15,.5)
rad=mat('Pad-mount radiator steel',(.2,.23,.24),.35,.55)
warn=mat('Hazard label yellow',(.8,.62,.04),0,.5)
box('Concrete foundation',(0,.15,0),(3.4,.3,4.0),base,g,.05)
box('Transformer tank',(0,.3+.925,-.3),(1.85,1.85,1.9),a61,g,.04)
box('Front terminal compartment',(0,.3+.85,.95),(1.85,1.7,.6),a61,g,.03)
box('Tank cover',(0,2.19,-.3),(1.95,.08,2.0),a61,g,.02)
for x in [-.8,.8]:
 for z in [-1.18,.58]:box('Lifting lug',(x,2.3,z),(.06,.16,.14),a61,g,0)
for x,label in [(-.46,'HV'),(.46,'LV')]:
 box('Compartment door '+label,(x,1.12,1.262),(.88,1.55,.03),a61,g,.01)
 box('Door latch handle',(x+math.copysign(.34,x),1.1,1.285),(.05,.26,.04),steel,g,0)
 cyl('Pentahead bolt',(x+math.copysign(.34,x),1.36,1.285),.025,.03,steel,g,'z',8)
 box('Hazard label',(x,1.55,1.279),(.24,.16,.005),warn,g,0)
box('Door parting seam',(0,1.12,1.265),(.02,1.55,.03),shadow,g,0)
box('Nameplate',(-.6,1.55,-1.262),(.3,.2,.01),bronze,g,0)
# tube-and-fin style radiator panels welded to headers, sides and back
for sx in [-1,1]:
 for i in range(4):box('Radiator panel',(sx*(.925+.27),1.15,-1.0+i*.3),(.52,1.3,.05),rad,g,0)
 for y in [.55,1.75]:cyl('Radiator header',(sx*(.925+.27),y,-.55),.04,1.05,rad,g,'z',8)
for i in range(4):box('Radiator panel',(-.45+i*.3,1.15,-1.25-.27),(.05,1.3,.52),rad,g,0)
for y in [.55,1.75]:cyl('Radiator header',(0,y,-1.25-.27),.04,1.05,rad,g,'x',8)
# Standby generators: same 13 x 3.8 m footprint. A 0.7 m double-wall sub-base fuel tank under the acoustic
# enclosure, recessed louvered intake hoods at the generator end and a discharge hood at the radiator end,
# a high-temperature black silencer with the stack on its outlet and a flapper rain cap, lifting eyes and a
# breaker cabinet by the step-up transformer. Enclosure details are representative.
g='GENSET'
hot=mat('High-temperature black paint',(.03,.032,.035),.3,.6)
box('Generator foundation',(0,.2,0),(13,.4,3.8),base,g,.05)
box('Sub-base fuel tank',(0,.75,0),(12.4,.7,3.1),shadow,g,.03)
for x in [-5.2,5.2]:cyl('Sub-base fill port',(x,1.14,1.1),.08,.08,steel,g,'y',10)
box('Acoustic enclosure',(0,2.55,0),(12.2,2.9,3),white,g,.06)
for z in [-1.52,1.52]:
 for x in [-4.5,-1.5,1.5]:
  box('Flush acoustic door',(x,2.55,z),(2.84,2.63,.035),pearl,g,.02)
  box('Recessed latch',(x+.9,2.5,z+math.copysign(.025,z)),(.06,.3,.035),shadow,g,0)
 # recessed louvered intake hood at the generator end
 box('Intake hood',(4.5,2.55,z+math.copysign(.12,z)),(2.6,2.2,.24),pearl,g,.02)
 box('Intake louver recess',(4.5,2.4,z+math.copysign(.245,z)),(2.3,1.7,.02),black,g,0)
 for y in [1.7+i*.2 for i in range(9)]:box('Intake louver blade',(4.5,y,z+math.copysign(.25,z)),(2.25,.05,.05),steel,g,0)
box('Radiator discharge hood',(4.3,4.65,0),(3.2,1.3,2.8),steel,g,.06)
for z in [-.7,.7]:ring('Radiator fan rim',(4.3,5.32,z),.62,.055,white,g,24,6);cyl('Radiator aperture',(4.3,5.32,z),.56,.04,black,g,'y',20)
for x in [-5.9,5.9]:
 for z in [-1.4,1.4]:ring('Lifting eye',(x,4.08,z),.08,.02,steel,g,12,4)
cyl('Silencer',(-2.5,4.5,0),.45,2.6,hot,g,'x')
for x in [-3.7,-1.3]:cyl('Silencer flange ring',(x,4.5,0),.5,.06,hot,g,'x')
cyl('Exhaust stack',(-3.55,5.3,0),.24,1.2,hot,g)
box('Flapper rain cap',(-3.5,5.93,0),(.52,.03,.5),hot,g,0)
box('Generator transformer',(-7.4,1.3,0),(1.2,1.8,1.6),white,g,.04)
box('Breaker cabinet',(-6.55,1.3,1.2),(.5,1.4,.7),pearl,g,.02)
# Battery container, no implied individual cell layout/capacity. A 20 ft-class steel enclosure (small edge
# radius, not a molded look), ribbed side panels between gasketed service doors, a roof thermal-management
# unit with fan grilles, end grilles and hazard placards. Generic, not a named product.
g='BESS'
placard=mat('Hazard placard white',(.8,.8,.78),0,.5)
box('Container foundation',(0,.15,0),(6.5,.3,3.2),base,g,.05);box('Battery enclosure',(0,1.6,0),(6.06,2.6,2.44),white,g,.03)
for z in [-1.235,1.235]:
 for x in [-2.15,-.72,.72,2.15]:
  box('Battery service door',(x,1.6,z),(1.3,2.3,.025),pearl,g,.01);box('Battery latch',(x+.46,1.6,z+math.copysign(.028,z)),(.045,.22,.05),steel,g,0)
  for y in [.43,2.77]:box('Door gasket seam',(x,y,z+math.copysign(.015,z)),(1.34,.025,.02),shadow,g,0)
  for dx in [-.665,.665]:box('Door gasket seam',(x+dx,1.6,z+math.copysign(.015,z)),(.025,2.36,.02),shadow,g,0)
 for x in [-2.86,-1.435,0,1.435,2.86]:box('Side panel rib',(x,1.6,z+math.copysign(.03,z)),(.09,2.5,.05),white,g,0)
 box('Hazard placard',(1.435,2.2,z+math.copysign(.06,z)),(.28,.28,.01),placard,g,0)
 box('Placard stripe band',(1.435,2.29,z+math.copysign(.066,z)),(.28,.1,.01),shadow,g,0)
for x in [-3.2,3.2]:
 box('Thermal management endcap',(x,1.5,0),(.4,1.8,1.8),shadow,g,.03)
 for y in [.75+i*.16 for i in range(10)]:box('Endcap grille',(x+math.copysign(.22,x),y,0),(.03,.035,1.55),steel,g,0)
box('Roof thermal unit',(1.2,3.1,0),(2.6,.4,1.9),pearl,g,.03)
for dx in [.55,1.85]:
 cyl('Roof fan grille',(dx,3.31,0),.42,.03,black,g,'y',16);ring('Roof fan guard',(dx,3.33,0),.42,.025,steel,g)
# Power conversion (PCS/inverter) cabinet paired with each container row's pad-mount transformer.
g='BESS_PCS'
box('PCS skid',(0,.1,0),(4.2,.2,2.6),shadow,g,0)
box('PCS cabinet',(0,1.3,0),(4.0,2.2,2.3),pearl,g,.03)
for x in [-1.35,0,1.35]:
 box('PCS door',(x,1.25,1.165),(1.2,1.9,.02),white,g,.01)
 box('PCS door handle',(x+.45,1.25,1.19),(.04,.25,.04),steel,g,0)
 for y in [1.85+i*.09 for i in range(4)]:box('PCS louver',(x,y,1.18),(1.0,.04,.02),shadow,g,0)
box('PCS roof',(0,2.45,0),(4.2,.1,2.5),steel,g,0)
box('PCS hazard label',(-1.35,.62,1.18),(.3,.2,.01),warn,g,0)
# Vehicles are styled representative silhouettes, not branded or operator-specific.
g='CAR';prism('Sculpted car body',[(-2.2,-.7),(-1.85,-.9),(1.7,-.9),(2.2,-.65),(2.2,.65),(1.7,.9),(-1.85,.9),(-2.2,.7)],.3,1.0,pearl,g,.15)
prism('Glazed passenger cabin',[(-1.4,-.65),(.75,-.65),(1.1,-.4),(1.1,.4),(.75,.65),(-1.4,.65)],1.0,1.57,glass,g,.18)
for x in [-1.35,1.35]:
 for z in [-.95,.95]:cyl('Road tire',(x,.36,z),.34,.22,rubber,g,'z');cyl('Alloy wheel',(x,.36,z+math.copysign(.115,z)),.23,.018,steel,g,'z',16)
for z in [-.6,.6]:box('Vehicle headlamp',(2.19,.72,z),(.055,.12,.34),lamp,g,.03)
# Generic freight truck, cab facing -X (the viewer turns it to drive cab-first): a conventional day-cab
# tractor with hood, grille, bumper, mirrors, side fuel tanks, a steer axle and a tandem drive axle on duals,
# then a 12 m box trailer on the fifth wheel with landing gear, a tandem axle on duals, side skirts and a
# rear underride guard. Representative, no make.
g='TRUCK'
def wheelset(x,z,r=.5,w=.3):
 cyl('Truck tire',(x,r,z),r,w,rubber,g,'z',16);cyl('Truck wheel',(x,r,z+math.copysign(w/2+.005,z)),r*.62,.02,steel,g,'z',12)
box('Tractor frame rails',(-6.1,.95,0),(6.2,.3,1.0),shadow,g,0)
box('Hood',(-8.4,1.55,0),(1.6,1.2,2.2),pearl,g,.12)
box('Grille',(-9.21,1.5,0),(.04,.9,1.2),shadow,g,0)
box('Front bumper',(-9.15,.62,0),(.3,.35,2.45),steel,g,.04)
for z in [-.8,.8]:box('Headlamp',(-9.12,1.25,z),(.06,.18,.34),lamp,g,0)
box('Day cab',(-6.5,2.15,0),(2.2,2.1,2.45),pearl,g,.14)
box('Windscreen',(-7.61,2.7,0),(.04,.8,2.1),glass,g,0)
for z in [-1.23,1.23]:
 box('Side window',(-7.0,2.65,z),(1.0,.75,.03),glass,g,0)
 box('Mirror arm',(-7.55,2.4,z*1.12),(.05,.05,.35),steel,g,0);box('Mirror head',(-7.6,2.35,z*1.24),(.12,.45,.14),shadow,g,0)
 cyl('Side fuel tank',(-6.4,.85,z*.9),.33,1.4,steel,g,'x',16)
 box('Cab step',(-7.1,.72,z*1.02),(.5,.06,.3),steel,g,0)
cyl('Exhaust stack',(-5.25,3.0,1.0),.09,2.2,steel,g,'y',10)
box('Fifth wheel plate',(-4.3,1.2,0),(1.1,.12,1.0),shadow,g,0)
for z in [-1.0,1.0]:wheelset(-8.3,z)
for x in [-4.9,-3.6]:
 for z in [-1.1,-.78,.78,1.1]:wheelset(x,z,.5,.28)
box('Box trailer',(1.4,2.6,0),(12.0,2.75,2.55),white,g,.05)
for x in [-4.2+i*1.2 for i in range(10)]:
 for z in [-1.28,1.28]:box('Trailer post',(x,2.6,z),(.06,2.7,.04),steel,g,0)
box('Trailer floor rail',(1.4,1.2,0),(12.0,.14,2.5),shadow,g,0)
for z in [-.9,.9]:box('Landing gear leg',(-2.6,.75,z),(.12,.9,.12),steel,g,0)
box('Landing gear foot',(-2.6,.3,0),(.3,.06,2.0),steel,g,0)
for z in [-1.27,1.27]:box('Side skirt',(1.2,.8,z),(5.6,.7,.03),shadow,g,0)
for x in [4.9,6.1]:
 for z in [-1.1,-.78,.78,1.1]:wheelset(x,z,.5,.28)
box('Rear underride guard',(7.25,.6,0),(.12,.15,2.3),steel,g,0)
for z in [-.3,.3]:box('Guard strut',(7.05,.95,z),(.4,.55,.08),steel,g,0)
box('Rear door seam',(7.41,2.6,0),(.02,2.6,.03),shadow,g,0)
for z in [-1.1,1.1]:box('Tail light',(7.42,1.45,z),(.03,.12,.22),lamp,g,0)
# Three authored trees with branches and tapered clusters, low-poly enough for instancing.
for k in range(3):
 g='TREE'+str(k);rng=random.Random(71+k);cyl('Tapered trunk',(0,2.9,0),.22,5.8,wood,g,segments=8)
 for i in range(13):
  a=i*2.399+k;r=1.3+rng.random()*2.3;x=math.cos(a)*r;z=math.sin(a)*r;y=5.7+rng.random()*3.1+k*.4
  beam('Branch',(0,3+rng.random(),0),(x,y,z),.1,.1,wood,g)
  bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=pt((x,y,z)));o=bpy.context.object;o.name='Irregular foliage crown';o.parent=groups[g];o.scale=(1.25+rng.random(),1.05+rng.random()*.7,1.5+rng.random());o.data.materials.append(leaf[i%3])
  for v in o.data.vertices:v.co*=1+.13*math.sin(v.co.x*11+v.co.y*7)*math.cos(v.co.z*13)
# Hall rack shell: full 0.58 x 2.3 x 1.2m authored case with recessed front aperture.
g='HALL_RACK'
box('Rack bottom plinth',(0,.065,0),(.58,.13,1.2),shadow,g,.016)
box('Rack roof',(0,2.27,0),(.58,.06,1.2),steel,g,.013)
for x in [-.278,.278]:
 box('Folded side panel',(x,1.17,0),(.025,2.18,1.16),shadow,g,.01)
 box('Brushed front stile',(x,1.17,.597),(.031,2.18,.034),steel,g,.007)
 for y in [.22,2.1]:box('Captive latch',(x,y,.621),(.017,.066,.018),bronze,g,.004)
box('Rack rear panel',(0,1.17,-.587),(.55,2.18,.025),shadow,g,.008)
for y in [.17,2.2]:box('Recessed front cross rail',(0,y,.604),(.54,.026,.025),steel,g,.005)
# Unit cabinet casing, sized by runtime placement. Front graphic is a separate label plane.
g='HALL_CABINET'
box('Cabinet body',(0,.5,0),(1,1,1),white,g,.025)
for x in [-.47,.47]:box('Folded door stile',(x,.51,.512),(.035,.93,.035),steel,g,.008)
box('Cabinet plinth',(0,.025,0),(.96,.05,.94),shadow,g,.01)
# Cartographic facilities: complete authored silhouettes, intentionally exaggerated.
g='MAP_CAMPUS'
box('Campus symbol plinth',(0,.3,0),(34,.6,26),base,g,.2)
for z in [-6,6]:
 box('Campus symbol hall',(2,3.1,z),(24,5,8),shadow,g,.2)
 box('Folded symbol roof',(2,5.73,z),(24.8,.35,8.4),pearl,g,.13)
 for i in range(6):
  x=-9+i*4.3
  beam('Symbol structural portal',(x,.7,z+4.05),(x+1.7,5.3,z+4.65),.43,.43,pearl,g)
  box('Symbol bay',(x+2,2.5,z+4.03),(2.4,3.4,.12),pearl,g,.06)
 box('Symbol roof edge light',(2,5.78,z+4.2),(22,.12,.12),lamp,g,.03)
box('Campus symbol service wing',(-14,2.1,0),(6,3,10),steel,g,.15)
g='MAP_HUT'
box('Fiber shelter plinth',(0,.15,0),(6.5,.3,4.5),base,g,.12)
box('Fiber shelter casing',(0,1.65,0),(6,3,4),white,g,.2)
box('Fiber shelter folded roof',(0,3.2,0),(6.5,.28,4.5),steel,g,.12)
box('Shelter recessed door',(1.5,1.55,2.015),(1.2,2.35,.06),shadow,g,.035)
box('Shelter door handle',(1.91,1.55,2.075),(.06,.43,.08),bronze,g,.014)
for y in [.75+i*.21 for i in range(9)]:box('Shelter ventilation louver',(-1.2,y,2.04),(1.9,.09,.13),steel,g,.025)
for x in [-2.7,2.7]:box('Shelter corner extrusion',(x,1.65,2.06),(.15,2.85,.18),pearl,g,.04)
g='MAP_TERMINAL'
box('Line terminal foundation',(0,.2,0),(8.8,.4,6.8),base,g,.15)
box('Line terminal enclosure',(0,2.2,0),(8,4,6),shadow,g,.2)
box('Line terminal crown',(0,4.28,0),(8.6,.35,6.6),pearl,g,.14)
for x in [-3,-1,1,3]:box('Terminal face panel',(x,2.2,3.04),(1.75,3.45,.16),white,g,.035)
box('Terminal entrance',(0,1.5,3.16),(1.1,2.55,.1),steel,g,.04)
box('Terminal fixture',(0,4.03,3.24),(7,.08,.12),lamp,g,.02)

# Walking human scale cue, 1.75 m, facing +X (the direction fx.movers travels), mid-stride.
# Dark work clothes under a muted hi-vis vest with a retro-reflective band, boots and a hard hat.
def tube(n,a,b,r,m,g,r2=None,segments=8):
 A=Vector(pt(a));B=Vector(pt(b));d=B-A
 bpy.ops.mesh.primitive_cone_add(vertices=segments,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(A+B)/2)
 o=bpy.context.object;o.name=n;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.parent=groups[g];o.data.materials.append(m)
 for p in o.data.polygons:p.use_smooth=True
 return o
def blob(n,p,sc,m,g,segments=12,rings=8):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=pt(p));o=bpy.context.object;o.name=n;o.parent=groups[g];o.scale=sc;o.data.materials.append(m)
 for q in o.data.polygons:q.use_smooth=True
 return o
g='WALKER'
shirt=mat('Walker work shirt',(.022,.04,.07),0,.85)
trousers=mat('Walker work trousers',(.028,.03,.034),0,.9)
vest=mat('Walker hi-vis vest',(.42,.5,.06),0,.6)
band=mat('Walker reflective band',(.5,.52,.53),.3,.35)
skin=mat('Walker skin',(.48,.31,.22),0,.84)
hat=mat('Walker hard hat',(.78,.76,.7),0,.45)
# legs: right (+Z) forward, left back, knees slightly bent
for hip,knee,ankle,boot in [((0,.93,.1),(.11,.5,.1),(.17,.09,.1),(.21,.055,.1)),((0,.93,-.1),(-.06,.5,-.1),(-.17,.12,-.1),(-.13,.075,-.1))]:
 tube('Walker thigh',hip,knee,.075,trousers,g,.065);tube('Walker shin',knee,ankle,.062,trousers,g,.052)
 box('Walker boot',boot,(.28,.11,.12),rubber,g,.03)
box('Walker hips',(0,.93,0),(.21,.16,.34),trousers,g,.05)
# torso: flattened taper wide at the shoulders; vest shell and band over it
o=tube('Walker torso',(0,.94,0),(0,1.5,0),.15,shirt,g,.2,12);o.scale=(.62,1,1)
o=tube('Walker vest',(0,1.03,0),(0,1.48,0),.165,vest,g,.205,12);o.scale=(.66,1,1)
o=tube('Walker reflective band',(0,1.1,0),(0,1.15,0),.172,band,g,.176,12);o.scale=(.69,1,1)
# arms swing against the legs
for sh,el,wr in [((0,1.44,.215),(-.09,1.18,.245),(-.12,.94,.235)),((0,1.44,-.215),(.09,1.18,-.245),(.21,.98,-.225))]:
 tube('Walker upper arm',sh,el,.052,shirt,g,.046);tube('Walker forearm',el,wr,.044,shirt,g,.038)
 blob('Walker hand',wr,(.045,.045,.05),skin,g,8,6)
tube('Walker neck',(0,1.49,0),(0,1.57,0),.048,skin,g)
blob('Walker head',(0,1.645,0),(.1,.095,.118),skin,g)
blob('Walker hard hat shell',(.01,1.715,0),(.13,.12,.075),hat,g)
tube('Walker hard hat brim',(.02,1.675,0),(.02,1.69,0),.155,hat,g,.15,16)
# Prefabricated equipment buildings (e-houses, control house, telecom shelters): one representative kit,
# length along Z, width along X, origin at the bottom of the steel skid. Ribbed steel wall panels, a
# standing-seam roof, double personnel doors with landings and handrails at the ends, wall-pack HVAC on one
# long side, a cable-entry skirt and door lights. Layouts vary by vendor; nothing here is a product.
panel=mat('Prefab ribbed wall panel',(.5,.53,.53),.3,.52)
rib=mat('Prefab panel rib',(.42,.45,.45),.35,.48)
seam=mat('Prefab standing-seam roof',(.3,.33,.34),.45,.5)
skid=mat('Prefab steel skid',(.05,.055,.06),.6,.55)
door=mat('Prefab door leaf',(.16,.2,.23),.35,.45)
hvac=mat('Prefab HVAC casing',(.62,.64,.62),.2,.5)
grille=mat('Prefab HVAC grille',(.02,.025,.03),.3,.7)
def prefab(g,L,W,H,hvac_side=1,hvac_n=4,end_doors=(1,-1),side_doors=0):
 box('Steel skid',(0,.2,0),(W+.25,.4,L+.25),skid,g,0)
 box('Wall panel body',(0,.4+H/2,0),(W,H,L),panel,g,0)
 n=int(L/.3)
 for sx in [-1,1]:
  for i in range(n):box('Wall panel rib',(sx*(W/2+.02),.4+H/2,-L/2+.15+i*L/n),(.04,H-.1,.07),rib,g,0)
 for sz in [-1,1]:
  for i in range(int(W/.3)):box('Wall panel rib',(-W/2+.15+i*W/int(W/.3),.4+H/2,sz*(L/2+.02)),(.07,H-.1,.04),rib,g,0)
 box('Roof deck',(0,.4+H+.1,0),(W+.5,.2,L+.5),seam,g,.03)
 for i in range(int((L+.4)/.6)):box('Standing seam',(0,.4+H+.24,-L/2-.2+.3+i*.6),(W+.46,.08,.04),seam,g,0)
 box('Cable entry skirt',(-hvac_side*(W/2+.07),.62,0),(.14,.45,L-1),skid,g,0)
 for sz in end_doors:
  z=sz*(L/2+.03)
  for dx in [-.52,.52]:box('Personnel door leaf',(dx,.4+1.15,z),(1.0,2.2,.05),door,g,0)
  box('Door light',(0,.4+2.55,sz*(L/2+.12)),(.4,.12,.16),lamp,g,.02)
  box('Steel landing',(0,.36,sz*(L/2+.8)),(2.4,.08,1.5),rib,g,0)
  for k in range(3):box('Landing step',(0,.3-k*.12,sz*(L/2+1.8+k*.28)),(1.2,.05,.28),rib,g,0)
  for dx in [-1.2,1.2]:
   for zz in [L/2+.1,L/2+1.5]:box('Handrail post',(dx,.8,sz*zz),(.05,.9,.05),rib,g,0)
   box('Handrail',(dx,1.25,sz*(L/2+.8)),(.05,.05,1.45),rib,g,0)
 for i in range(side_doors):
  z=-L/2+L*(i+.5)/side_doors
  box('Side door leaf',(-hvac_side*(W/2+.03),.4+1.15,z),(.05,2.2,1.0),door,g,0)
 for i in range(hvac_n):
  z=-L/2+L*(i+.5)/hvac_n;x=hvac_side*(W/2+.38)
  box('Wall-pack HVAC',(x,.4+H*.6,z),(.7,1.5,1.1),hvac,g,.03)
  for k in range(5):box('HVAC grille slat',(x+hvac_side*.36,.4+H*.6-.5+k*.25,z),(.02,.06,.9),grille,g,0)
g='EHOUSE';prefab(g,34,8,4.2,hvac_side=1,hvac_n=4,side_doors=6)
g='CTRL_HOUSE';prefab(g,22,10,4.6,hvac_side=1,hvac_n=3,side_doors=2)
g='SHELTER';prefab(g,12,7,3.2,hvac_side=1,hvac_n=2,end_doors=(-1,))
# Staffed gatehouse: glazed on all four sides above a 1 m sill, a door on the lane side, a roof with overhang.
g='GATEHOUSE'
booth=mat('Gatehouse glazing',(.07,.11,.13),.1,.06)
box('Gatehouse skid',(0,.15,0),(8.2,.3,5.2),skid,g,0)
box('Gatehouse sill wall',(0,.3+.5,0),(8,1.0,5),panel,g,.02)
box('Gatehouse glazing band',(0,1.3+.95,0),(7.9,1.9,4.9),booth,g,0)
box('Warm interior ceiling glow',(0,3.05,0),(7.7,.08,4.7),lamp,g,0)
for x in [-4,-1.33,1.33,4]:
 for z in [-2.5,2.5]:box('Gatehouse mullion',(x,2.25,z),(.12,1.9,.12),rib,g,0)
for z in [-2.5,-.8,.8,2.5]:
 for x in [-4,4]:box('Gatehouse mullion',(x,2.25,z),(.12,1.9,.12),rib,g,0)
box('Gatehouse head band',(0,3.35,0),(8,.5,5),panel,g,.02)
box('Gatehouse roof',(0,3.7,0),(9.4,.2,6.4),seam,g,.04)
box('Gatehouse door',(-4.03,1.4,1.4),(.05,2.2,1.0),door,g,0)
box('Gatehouse door light',(-4.12,2.95,1.4),(.12,.1,.4),lamp,g,.02)
# Counterflow cooling-tower cell (representative type), 11.4 x 11 m plan, origin at grade. Ribbed FRP casing,
# 45-degree air-inlet louvers on all four sides over dark fill, a fan deck with handrail, a smooth eased-inlet
# fan stack with a flared top (the runtime rotor turns 0.8 m below its rim), a motor and driveshaft, a caged
# ladder and a hot-water riser. The card does not name the tower type, so counterflow is representative.
g='TOWER_CELL'
frp=mat('Tower FRP casing',(.44,.46,.45),0,.62)
frpr=mat('Tower FRP rib',(.38,.4,.39),0,.6)
fillm=mat('Tower wet fill recess',(.012,.016,.018),0,.9)
louv=mat('Tower inlet louver',(.1,.11,.11),0,.7)
deck=mat('Tower deck grating',(.16,.17,.17),.4,.6)
W,D=11.4,11.0
box('Basin curb',(0,.45,0),(W+.4,.6,D+.4),base,g,.04)
box('Fill recess',(0,1.9,0),(W-.3,2.3,D-.3),fillm,g,0)
def slat(n,c,length,axis,m):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pt(c));o=bpy.context.object;o.name=n;o.parent=groups[g];o.data.materials.append(m)
 if axis=='x':o.scale=(length,.36,.035);o.rotation_euler=(math.radians(45),0,0)
 else:o.scale=(.36,length,.035);o.rotation_euler=(0,math.radians(45),0)
 return o
for y in [1.0+i*.3 for i in range(7)]:
 for sz in [-1,1]:slat('Air inlet louver',(0,y,sz*(D/2-.05)),W-.4,'x',louv)
 for sx in [-1,1]:slat('Air inlet louver',(sx*(W/2-.05),y,0),D-.4,'z',louv)
for sx in [-1,1]:
 for sz in [-1,1]:box('Casing corner post',(sx*(W/2-.1),1.9,sz*(D/2-.1)),(.25,2.3,.25),frpr,g,0)
box('FRP casing',(0,5.6,0),(W,5.1,D),frp,g,.03)
for i in range(int(W/.6)):
 for sz in [-1,1]:box('Casing rib',(-W/2+.3+i*W/int(W/.6),5.6,sz*(D/2+.02)),(.08,5.0,.05),frpr,g,0)
for i in range(int(D/.6)):
 for sx in [-1,1]:box('Casing rib',(sx*(W/2+.02),5.6,-D/2+.3+i*D/int(D/.6)),(.05,5.0,.08),frpr,g,0)
box('Fan deck',(0,8.27,0),(W+.2,.25,D+.2),deck,g,.02)
# handrail round the deck edge
for sx in [-1,1]:
 for zz in [-5.4,-2.7,0,2.7,5.4]:box('Handrail post',(sx*5.6,8.95,zz),(.05,1.1,.05),steel,g,0)
 box('Handrail',(sx*5.6,9.5,0),(.05,.05,D),steel,g,0)
for sz in [-1,1]:
 for xx in [-5.6,-2.8,0,2.8,5.6]:box('Handrail post',(xx,8.95,sz*5.4),(.05,1.1,.05),steel,g,0)
 box('Handrail',(0,9.5,sz*5.4),(W,.05,.05),steel,g,0)
# eased-inlet fan stack: outer skin up, lip, inner skin down so the throat reads from above
prof=[(4.75,8.4),(4.45,8.55),(4.2,8.85),(4.08,9.25),(4.05,10.2),(4.05,11.4),(4.12,11.8),(4.3,12.1),(4.38,12.18),
      (4.3,12.2),(4.2,12.12),(4.0,11.8),(3.95,11.4),(3.95,10.2),(3.98,9.25),(4.1,8.85),(4.35,8.55),(4.6,8.42)]
v=[];f=[];seg=48
for j,(r,y) in enumerate(prof):
 for i in range(seg):a=i/seg*2*math.pi;v.append((r*math.cos(a),y,r*math.sin(a)))
for j in range(len(prof)-1):
 for i in range(seg):
  a=j*seg+i;b=j*seg+(i+1)%seg;f.append((a,b,b+seg,a+seg))
o=mesh('Eased-inlet fan stack',v,f,frp,g)
for q in o.data.polygons:q.use_smooth=True
# gearbox under the rotor on a bridge beam, driveshaft out through the stack to a motor on the deck
box('Fan bridge beam',(0,10.55,0),(8.0,.3,.35),steel,g,0)
cyl('Speed reducer',(0,10.85,0),.42,.55,steel,g,'y',16)
cyl('Driveshaft',(3.3,10.95,0),.09,4.9,steel,g,'x',8)
box('Fan motor',(6.1,9.35,0),(1.1,.8,.8),steel,g,.04)
# caged ladder on the +Z face and a hot-water riser on the -Z face
for x in [4.1,4.6]:box('Ladder rail',(x,4.6,D/2+.35),(.06,8.0,.06),steel,g,0)
for y in [.9+i*.35 for i in range(22)]:box('Ladder rung',(4.35,y,D/2+.35),(.5,.035,.035),steel,g,0)
for y in [3.0+i*.9 for i in range(7)]:
 bpy.ops.mesh.primitive_torus_add(major_radius=.42,minor_radius=.025,major_segments=16,minor_segments=4,location=pt((4.35,y,D/2+.5)));o=bpy.context.object;o.name='Ladder cage hoop';o.parent=groups[g];o.data.materials.append(steel)
cyl('Hot water riser',(-3.0,4.2,-D/2-.45),.35,8.4,steel,g,'y',16)
cyl('Riser elbow',(-3.0,8.2,-D/2+.1),.35,1.1,steel,g,'z',16)
# Substation yard kit. Insulators are turned profiles: a tapered core with tightly spaced alternating
# large/small sheds (pitch about 0.6 x shed radius), not stacked washers. Grey porcelain and composite.
# The dead-tank breaker carries six roof bushings with bushing CTs (Larson 345 kV dead-tank listing); the
# V splay, mechanism cabinet position and other fittings are representative.
porc=mat('Station porcelain grey',(.36,.38,.38),0,.3)
comp=mat('Composite insulator grey',(.27,.29,.3),0,.5)
galvm=mat('Galvanized steel',(.42,.45,.47),.8,.42)
def insul(n,base,h,r0,big,small,m,axis=(0,1,0),top_ring=0,segments=12):
 # base: viewer point, axis: unit direction in viewer coords
 ax=Vector(axis).normalized();up=Vector((0,1,0))
 q=up.rotation_difference(ax)
 prof=[(r0*2.2,0),(r0*2.2,.08),(r0*1.2,.1)];y=.18;k=0;pitch=big*.6
 while y<h-.2:
  rr=big if k%2==0 else small
  prof+=[(r0,y),(rr,y+.015),(rr*.9,y+.045),(r0,y+pitch*.55)];y+=pitch;k+=1
 prof+=[(r0,h-.12),(r0*1.6,h-.1),(r0*1.6,h),(0,h+.01)]
 v=[];f=[]
 for j,(r,yy) in enumerate(prof):
  for i in range(segments):
   a=i/segments*2*math.pi;p=q@Vector((r*math.cos(a),yy,r*math.sin(a)));v.append((base[0]+p.x,base[1]+p.y,base[2]+p.z))
 for j in range(len(prof)-1):
  for i in range(segments):
   a_=j*segments+i;b_=j*segments+(i+1)%segments;f.append((a_,b_,b_+segments,a_+segments))
 o=mesh(n,v,f,m,g)
 for pp in o.data.polygons:pp.use_smooth=True
 if top_ring:
  c=q@Vector((0,h-.25,0))
  bpy.ops.mesh.primitive_torus_add(major_radius=top_ring,minor_radius=.04,major_segments=20,minor_segments=5,location=pt((base[0]+c.x,base[1]+c.y,base[2]+c.z)))
  o2=bpy.context.object;o2.name=n+' grading ring';o2.parent=groups[g];o2.data.materials.append(steel)
  o2.rotation_euler=Vector(pt(tuple(ax))).to_track_quat('Z','Y').to_euler()
 return o
g='SUB_BREAKER'
box('Breaker support frame',(0,1.1,0),(4.5,2.2,4.2),galvm,g,.02)
for dz in [-1.4,0,1.4]:
 cyl('SF6 pole tank',(0,3.0,dz),.55,3.4,galvm,g,'x',20)
 for sx in [-1,1]:
  ax=(sx*math.sin(math.radians(17)),math.cos(math.radians(17)),0)
  cyl('Bushing CT housing',(sx*1.2,3.55,dz),.3,.35,galvm,g,'y',16)
  insul('Roof bushing',(sx*1.2,3.7,dz),2.85,.1,.2,.15,comp,ax)
box('Mechanism cabinet',(3.2,.9,1.5),(1.4,1.8,1.0),galvm,g,.03)
box('Cabinet door',(3.91,.9,1.5),(.02,1.6,.85),steel,g,0)
g='SUB_POST';insul('Station post insulator',(0,0,0),4.3,.1,.22,.17,porc,top_ring=0)
box('Bus clamp',(0,4.35,0),(.3,.12,.3),steel,g,0)
g='SUB_ARRESTER';insul('Surge arrester',(0,0,0),3.6,.13,.26,.2,porc,top_ring=.45)
cyl('Arrester counter',(0,-.6,.33),.09,.12,steel,g,'z',12)
g='SUB_CVT';cyl('CVT base tank',(0,.35,0),.42,.7,galvm,g,'y',20)
insul('CVT capacitor stack',(0,.7,0),3.5,.15,.3,.23,porc,top_ring=.5)
g='SUB_DISCONNECT'
for dz in [-1.5,1.5]:
 cyl('Rotating base',(0,.1,dz),.25,.2,galvm,g,'y',16)
 insul('Rotating insulator column',(0,.2,dz),2.6,.1,.22,.17,porc)
box('Center-break blade',(0,2.87,0),(.1,.1,3.4),galvm,g,0)
box('Blade contact',(0,2.87,0),(.18,.18,.3),steel,g,0)
for dz in [-.25,.25]:
 A=Vector(pt((0,2.92,dz)));B=Vector(pt((0,3.42,dz*2.2)))
 bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.02,depth=(B-A).length,location=(A+B)/2);o=bpy.context.object;o.name='Arcing horn'
 o.rotation_euler=(B-A).to_track_quat('Z','Y').to_euler();o.parent=groups[g];o.data.materials.append(steel)
g='SUB_STRING';insul('Dead-end polymer string',(0,0,0),3.0,.05,.14,.1,comp,(1,0,0))
# Horizontal double-wall bulk fuel tank (UL 142 style), axis along Z, origin on the pad top. A smooth shell with
# dished heads and weld seams on steel saddles, a manway, a pressure-vacuum vent, an emergency vent, a fill box
# with spill container, a level gauge and a low containment curb. FUEL_TANK_ACCESS adds a ladder and top
# platform (one tank per pair). The card gives only the total volume; fittings are representative.
tankPaint=mat('Fuel tank white enamel',(.62,.64,.62),.1,.45)
for gname in ['FUEL_TANK','FUEL_TANK_ACCESS']:
 g=gname;R=2.2;Lh=13.5/2-.35
 prof=[(0,-Lh-.5),(1.0,-Lh-.45),(1.7,-Lh-.3),(2.05,-Lh-.12),(R,-Lh),(R,Lh),(2.05,Lh+.12),(1.7,Lh+.3),(1.0,Lh+.45),(0,Lh+.5)]
 v=[];f=[];seg=40
 for r,zz in prof:
  for i in range(seg):a=i/seg*2*math.pi;v.append((r*math.cos(a),3.45+r*math.sin(a),zz))
 for j in range(len(prof)-1):
  for i in range(seg):
   a_=j*seg+i;b_=j*seg+(i+1)%seg;f.append((a_,a_+seg,b_+seg,b_))
 o=mesh('Double-wall tank shell',v,f,tankPaint,g)
 for q in o.data.polygons:q.use_smooth=True
 for zz in [-Lh+2.2,0,Lh-2.2]:cyl('Weld seam band',(0,3.45,zz),R+.012,.05,tankPaint,g,'z',40)
 for zz in [-3.6,3.6]:
  box('Steel saddle web',(0,.65,zz),(3.2,1.3,.12),steel,g,0)
  box('Saddle base plate',(0,.04,zz),(3.4,.08,.5),steel,g,0)
 box('Containment curb',(0,.2,-7.8),(11.6,.4,.3),base,g,0);box('Containment curb',(0,.2,7.8),(11.6,.4,.3),base,g,0)
 box('Containment curb',(-5.8,.2,0),(.3,.4,15.9),base,g,0);box('Containment curb',(5.8,.2,0),(.3,.4,15.9),base,g,0)
 cyl('Manway',(0,5.75,-1.5),.38,.25,steel,g,'y',20)
 cyl('PV vent pipe',(0,6.3,2.2),.05,1.3,steel,g,'y',8);cyl('PV vent cap',(0,7.0,2.2),.14,.14,steel,g,'y',12)
 cyl('Emergency vent',(0,5.8,.6),.22,.3,steel,g,'y',16)
 box('Fill box and spill container',(.9,5.75,4.0),(.6,.35,.6),shadow,g,.02)
 box('Level gauge',(R+.05,3.45,-5.0),(.08,.35,.25),steel,g,0)
 if gname=='FUEL_TANK_ACCESS':
  for zz in [5.2,5.7]:box('Ladder rail',(R+.4,3.0,zz),(.05,5.9,.05),steel,g,0)
  for y in [.4+i*.35 for i in range(16)]:box('Ladder rung',(R+.4,y,5.45),(.04,.035,.5),steel,g,0)
  box('Top platform grating',(0,5.72,4.8),(1.8,.06,1.6),shadow,g,0)
  for x in [-.9,.9]:
   for zz in [4.0,5.6]:box('Platform rail post',(x,6.25,zz),(.04,1.0,.04),steel,g,0)
   box('Platform rail',(x,6.75,4.8),(.04,.04,1.64),steel,g,0)
# Bake modifiers/transforms and one mesh per material within each asset.
bpy.ops.object.select_all(action='DESELECT')
for o in list(S.objects):
 if o.type=='MESH':
  bpy.context.view_layer.objects.active=o;o.select_set(True)
  for mod in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
  bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
  o.select_set(False)
for g in groups.values():
 for m in list(bpy.data.materials):
  obs=[o for o in list(g.children) if o.type=='MESH' and o.data.materials and o.data.materials[0]==m]
  if len(obs)>1:
   bpy.ops.object.select_all(action='DESELECT')
   for o in obs:o.select_set(True)
   bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=g.name+' '+m.name
root=bpy.data.objects.new('IFX_CAMPUS_CATALOG',None);S.collection.objects.link(root);root['ifx']=json.dumps({'version':1,'units':'m','representative':True,'assets':list(groups)})
for g in groups.values():g.parent=root
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'campus-catalog.blend'))
path=ROOT/'public/models/campus-catalog.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',export_yup=True,export_extras=True)
print('CATALOG_BYTES',path.stat().st_size)

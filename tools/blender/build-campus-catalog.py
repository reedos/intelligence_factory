"""Blender campus mechanical and landscape catalog, representative engineering envelopes."""
import pathlib
HERE=pathlib.Path(__file__).resolve().parent
exec((HERE/'build-campus-architecture.py').read_text().split('# Full opaque building envelope.')[0])
import random
for g in list(groups.values()):bpy.data.objects.remove(g,do_unlink=True)
groups={}
for name in ['COOLER','UNITSUB','GENSET','BESS','CAR','TRUCK','TREE0','TREE1','TREE2','FAN','HALL_RACK','HALL_CABINET','MAP_CAMPUS','MAP_HUT','MAP_TERMINAL','WALKER','EHOUSE','CTRL_HOUSE','SHELTER','GATEHOUSE']:
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
def ring(n,p,r,minor,m,g):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=minor,major_segments=32,minor_segments=8,location=pt(p));o=bpy.context.object;o.name=n;o.parent=groups[g];o.data.materials.append(m);return o
def open_throat(n,p,outer,inner,h,m,g,segments=32):
 # Hollow fan shroud: annular lips and inner/outer walls, no solid disk
 # underneath the aperture that would close the intended air passage.
 v=[(p[0]+r*math.cos(i*2*math.pi/segments),p[1]+y,p[2]+r*math.sin(i*2*math.pi/segments)) for r,y in [(outer,-h/2),(outer,h/2),(inner,-h/2),(inner,h/2)] for i in range(segments)]
 f=[]
 for i in range(segments):
  j=(i+1)%segments;a=i;b=segments+i;c=2*segments+i;d=3*segments+i
  f.extend([(a,b,segments+j,j),(c,2*segments+j,3*segments+j,d),(b,d,3*segments+j,segments+j),(a,j,2*segments+j,c)])
 return mesh(n,v,f,m,g)
# Six-fan dry-cooler cassette. Original footprint/rotor anchors retained.
g='COOLER';box('Structural skid',(0,.15,0),(11.6,.3,2.3),steel,g,.08)
for z in [-.95,.95]:
 box('V-coil casing',(0,1.2,z),(11.6,1.8,.13),shadow,g,.035)
 for i in range(48):box('Coil-fin edge',(-5.6+i*.237,1.15,z+(1 if z>0 else -1)*.08),(.028,1.62,.12),steel,g,.008)
box('Fan deck',(0,2.2,0),(11.6,.2,2.4),white,g,.09)
for i in range(6):
 x=-4.9+i*1.96;open_throat('Fan throat',(x,2.43,0),.9,.78,.28,steel,g);ring('Rolled fan bellmouth',(x,2.57,0),.84,.055,white,g)
 # dark opening remains below native/exported rotor surface.
 cyl('Fan aperture',(x,2.585,0),.78,.016,black,g)
for x in [-5.6,5.6]:
 for z in [-1,1]:box('Cooler support',(x,-.2,z),(.15,.4,.15),steel,g,.025)
# Five swept fan blades, normalized radius1, for existing animation transforms.
g='FAN';cyl('Rotor hub',(0,0,0),.16,.12,steel,g)
for i in range(5):
 a=i*2*math.pi/5
 outline=[(.15,-.01,-.07),(.48,.018,-.1),(.94,.06,.02),(.9,.09,.2),(.43,.06,.17)]
 v=[]
 for dy in [-.015,.015]:
  for x,y,z in outline:v.append((x*math.cos(a)-z*math.sin(a),y+dy,x*math.sin(a)+z*math.cos(a)))
 mesh('Swept axial blade',v,[(0,1,2,3,4),(5,9,8,7,6)]+[(j,(j+1)%5,(j+1)%5+5,j+5) for j in range(5)],steel,g,.012)
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
# Standby generators: same footprint, two radiator fans and stack anchors.
g='GENSET';box('Generator foundation',(0,.2,0),(13,.4,3.8),base,g,.1);box('Acoustic enclosure',(0,1.85,0),(12.2,2.9,3),white,g,.16)
for z in [-1.52,1.52]:
 for x in [-4.5,-1.5,1.5,4.5]:
  box('Flush acoustic door',(x,1.85,z),(2.84,2.63,.035),pearl,g,.035)
  box('Recessed latch',(x+.9,1.8,z+math.copysign(.025,z)),(.06,.3,.035),shadow,g,.018)
  for y in [.7+i*.14 for i in range(8)]:box('Louver slit',(x,y,z+math.copysign(.035,z)),(2.35,.035,.026),shadow,g,.008)
box('Radiator plenum',(4.3,3.95,0),(3.2,1.3,2.8),steel,g,.14)
for z in [-.7,.7]:ring('Radiator fan rim',(4.3,4.62,z),.62,.055,white,g);cyl('Radiator aperture',(4.3,4.62,z),.56,.04,black,g)
cyl('Silencer',(-2.5,3.8,0),.45,2.6,steel,g,'x');cyl('Exhaust stack',(-1.2,4.6,0),.26,2.8,shadow,g)
box('Generator transformer',(-7.4,1.3,0),(1.2,1.8,1.6),white,g,.08)
# Battery container, no implied individual cell layout/capacity.
g='BESS';box('Container foundation',(0,.15,0),(6.5,.3,3.2),base,g,.08);box('Battery enclosure',(0,1.6,0),(6.06,2.6,2.44),white,g,.13)
for z in [-1.235,1.235]:
 for x in [-2.15,-.72,.72,2.15]:
  box('Battery service door',(x,1.6,z),(1.36,2.36,.025),pearl,g,.035);box('Battery latch',(x+.46,1.6,z+math.copysign(.028,z)),(.045,.22,.05),steel,g,.012)
for x in [-3.2,3.2]:
 box('Thermal management endcap',(x,1.5,0),(.4,1.8,1.8),shadow,g,.08)
 for y in [.75+i*.16 for i in range(10)]:box('Endcap grille',(x+math.copysign(.22,x),y,0),(.03,.035,1.55),steel,g,.008)
# Vehicles are styled representative silhouettes, not branded or operator-specific.
g='CAR';prism('Sculpted car body',[(-2.2,-.7),(-1.85,-.9),(1.7,-.9),(2.2,-.65),(2.2,.65),(1.7,.9),(-1.85,.9),(-2.2,.7)],.3,1.0,pearl,g,.15)
prism('Glazed passenger cabin',[(-1.4,-.65),(.75,-.65),(1.1,-.4),(1.1,.4),(.75,.65),(-1.4,.65)],1.0,1.57,glass,g,.18)
for x in [-1.35,1.35]:
 for z in [-.95,.95]:cyl('Road tire',(x,.36,z),.34,.22,rubber,g,'z');cyl('Alloy wheel',(x,.36,z+math.copysign(.115,z)),.23,.018,steel,g,'z',16)
for z in [-.6,.6]:box('Vehicle headlamp',(2.19,.72,z),(.055,.12,.34),lamp,g,.03)
g='TRUCK';box('Truck cab',(-3.7,1.5,0),(2.5,2.5,2.4),pearl,g,.24);box('Cab windscreen',(-4.965,2.15,0),(.04,1.06,2.05),glass,g,.08);box('Box trailer',(2,1.8,0),(7.6,3,2.5),white,g,.1)
for z in [-1.27,1.27]:
 for x in [-1.5+i*.7 for i in range(11)]:box('Trailer rib',(x,1.8,z),(.04,2.74,.06),steel,g,.015)
for x in [-3.7,-1.2,1.4,4.6]:
 for z in [-1.25,1.25]:cyl('Truck tire',(x,.46,z),.46,.3,rubber,g,'z');cyl('Truck wheel',(x,.46,z+math.copysign(.16,z)),.3,.03,steel,g,'z',16)
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

"""Hall architectural and cabinet finish, representative physical construction.
No added equipment, network ports or services. All dimensions in metres.
"""
import pathlib
HERE=pathlib.Path(__file__).resolve().parent
exec((HERE/'build-campus-architecture.py').read_text().split('# Full opaque building envelope.')[0])
for g in list(groups.values()):bpy.data.objects.remove(g,do_unlink=True)
groups={}
for n in ['SERVICE_WALL','LUMINAIRE','NVL_FACE','H100_FACE','HALL_CDU','HALL_INROW','CDU_PORT']:
 g=bpy.data.objects.new(n,None);S.collection.objects.link(g);groups[n]=g
ceramic=mat('Soft satin architectural panel',(.30,.38,.43),.25,.45)
alloy=mat('Anodized champagne edge',(.31,.29,.23),.8,.3)
graphite=mat('Precision folded graphite',(.028,.045,.06),.48,.4)
steel=mat('Satin cabinet hardware',(.32,.4,.46),.7,.33)
fixture=mat('Recessed neutral diffuser',(.73,.81,.88),.05,.4,.7)
walllight=mat('Warm indirect architectural light',(.85,.66,.44),.05,.4,.65)
g='SERVICE_WALL'
box('Full insulated service wall',(0,3.75,0),(60.6,7.5,.3),graphite,g,.025)
box('Continuous plinth',(0,.21,.18),(60.6,.42,.17),steel,g,.028)
for i in range(20):
 x=-28.5+i*3
 box('Lower removable wall panel',(x,1.58,.18),(2.85,2.62,.11),ceramic,g,.026)
 # High acoustic cassette remains above the floor service equipment.
 box('Recessed upper wall cassette',(x,5.11,.21),(2.76,4.0,.13),graphite,g,.032)
 for j in range(7):box('Vertical acoustic folded fin',(x-1.16+j*.386,5.1,.36),(.075,3.62,.27),steel,g,.018)
 box('Upper reveal',(x,7.08,.23),(2.87,.045,.16),alloy,g,.01)
for x in [-30+i*6 for i in range(11)]:
 # End at the crown underside (7.37m), below the wall's 7.50m top.
 # The former pier tops coincided with the wall top and flickered in cutaway views.
 box('Backwall structural pier',(x,3.785,.28),(.22,7.17,.5),ceramic,g,.034)
 # Short cutaway roof brackets, all above existing bus/fiber runs.
 beam('Tapered cutaway roof bracket',(x,6.6,.48),(x,7.08,1.15),.2,.25,ceramic,g)
 box('Bracket indirect light',(x,6.90,.82),(.08,.04,.65),walllight,g,.007)
box('Folded wall crown',(0,7.45,.42),(60.6,.16,1.03),ceramic,g,.03)
# Fixture housing replaces a fullbright plane; only the underside emits.
g='LUMINAIRE'
box('Folded luminaire housing',(0,0,0),(1.3,.075,.19),graphite,g,.028)
box('Anodized luminaire cap',(0,.027,0),(1.28,.026,.175),steel,g,.017)
box('Recessed opal diffuser',(0,-.038,0),(1.16,.012,.09),fixture,g,.005)
for x in [-.51,.51]:box('Luminaire suspension boss',(x,.058,0),(.07,.065,.055),steel,g,.01)
def cyl(n,p,r,h,m,g,axis='y',v=20,r2=None):
 # Viewer-space cylinder: axis 'y' is up, 'x' across, 'z' toward the viewer.
 if r2 is None:bpy.ops.mesh.primitive_cylinder_add(vertices=v,radius=r,depth=h,location=pt(p))
 else:bpy.ops.mesh.primitive_cone_add(vertices=v,radius1=r,radius2=r2,depth=h,location=pt(p))
 o=bpy.context.object;o.name=n
 if axis=='x':o.rotation_euler=(0,math.pi/2,0)
 elif axis=='z':o.rotation_euler=(math.pi/2,0,0)
 o.parent=groups[g];o.data.materials.append(m)
 bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
 return o
# ---- CDU / in-row cooler: representative cabinet, 0.8 m row slot x 1.2 m deep x 2.3 m ----
# Real CDUs are larger (Vertiv CoolChip CDU 1350: 900 mm wide; CDU 2300: 1200 x 1200 x 2400 mm);
# this keeps the hall's 0.8 m slot and is labelled representative. Door, HMI, louvre and port
# positions are not published and are representative.
powder=mat('RAL 9003-like white powder coat',(.66,.68,.68),0,.45)
powderDark=mat('Graphite powder coat',(.05,.058,.066),.1,.5)
hmi=mat('CDU touchscreen HMI',(.03,.16,.36),.05,.25,1.1)
uiCyan=mat('HMI status bars cyan',(.25,.78,1.0),0,.4,2.4)
uiGreen=mat('HMI status bars green',(.3,.95,.5),0,.4,2.4)
brushed=mat('Brushed stainless handle',(.62,.64,.66),.9,.28)
def cdu(g,body,full_louvre):
 box('Recessed plinth',(0,.044,0),(.72,.088,1.1),graphite,g,.006)
 box('Painted cabinet body',(0,1.18,0),(.76,2.18,1.15),body,g,.018)
 box('Door-frame shadow recess',(0,1.18,.573),(.72,2.1,.01),powderDark,g,0)
 for sx in [-1,1]:
  x=sx*.181
  box('Front door leaf',(x,1.18,.587),(.352,2.06,.012),body,g,.004)
  y0,y1=(.24,2.02) if full_louvre else (.24,1.08)
  box('Louvre recess',(x,(y0+y1)/2,.5975),(.3,y1-y0,.003),powderDark,g,0)
  n=int((y1-y0)/.056)
  for i in range(n):box('Formed door louvre',(x,y0+.03+i*.056,.606),(.29,.02,.008),body,g,0)
  # rear service door: full-height louvres onto the hot aisle
  box('Rear louvre recess',(x,1.13,-.5785),(.3,1.8,.003),powderDark,g,0)
  for i in range(30):box('Rear door louvre',(x,.26+i*.06,-.586),(.29,.022,.008),body,g,0)
  box('Side panel seam',(sx*.3835,1.18,.18),(.003,2.08,.006),powderDark,g,0)
  box('Side panel seam',(sx*.3835,1.18,-.2),(.003,2.08,.006),powderDark,g,0)
 box('Centre astragal',(0,1.18,.595),(.018,2.02,.01),powderDark,g,0)
 # HMI at ~1.5 m on the right leaf
 box('HMI bezel',(.181,1.53,.603),(.25,.17,.012),powderDark,g,.004)
 box('HMI screen',(.181,1.53,.6105),(.215,.13,.002),hmi,g,0)
 box('HMI flow bar',(.15,1.565,.613),(.1,.012,.002),uiCyan,g,0)
 box('HMI temperature bar',(.13,1.54,.613),(.06,.012,.002),uiGreen,g,0)
 box('HMI pump bar',(.2,1.51,.613),(.13,.008,.002),uiCyan,g,0)
 # handle and keyed latch beside the astragal
 box('Door handle',(.05,1.1,.607),(.022,.24,.018),brushed,g,.004)
 for y in [.99,1.21]:box('Handle standoff',(.05,y,.597),(.018,.02,.012),brushed,g,0)
 cyl('Keyed latch',(.05,.94,.597),.012,.012,brushed,g,'z',12)
 box('Nameplate',(-.181,1.82,.5965),(.15,.045,.003),brushed,g,0)
 box('Status lamp',(-.3,2.1,.597),(.014,.014,.004),uiGreen,g,0)
 box('Roof service plate',(0,2.2825,0),(.62,.021,.95),powderDark,g,.004)
cdu('HALL_CDU',powder,False)
cdu('HALL_INROW',powderDark,True)
# One roof port at facility-pipe size (0.07 m pipe radius); secondary ports reuse it at half scale.
g='CDU_PORT'
valve=mat('Painted ductile-iron valve body',(.11,.13,.15),.35,.45)
lever=mat('Safety-yellow valve lever grip',(.78,.55,.05),0,.55)
cyl('Roof boss',(0,0,0),.13,.03,graphite,g,'y',24)
cyl('Weld-neck flange',(0,.045,0),.115,.03,steel,g,'y',24)
cyl('Ball-valve body',(0,.13,0),.1,.13,valve,g,'y',24)
cyl('Upper flange',(0,.21,0),.115,.03,steel,g,'y',24)
cyl('Valve stem',(0,.13,.12),.018,.07,steel,g,'z',10)
box('Lever',(0,.13,.26),(.03,.018,.22),steel,g,0)
box('Lever grip',(0,.13,.33),(.036,.026,.09),lever,g,.004)
# Face relief follows existing rack texture rows, not an invented tray count.
# Canonical cabinet envelope .58 wide x2.3 high, front z=.6.
def drawer(g,top,height,pull=False):
 y=2.25-(top+height/2)*2.2/48
 box('Recessed service drawer',(0,y,.615),(.468,height*2.2/48-.008,.022),graphite,g,.007)
 box('Drawer upper rolled edge',(0,y+height*2.2/96-.008,.631),(.472,.011,.018),steel,g,.004)
 if pull:
  for x in [-.211,.211]:box('Captive service pull',(x,y,.65),(.018,max(.018,height*2.2/48-.018),.035),alloy,g,.006)
g='NVL_FACE'
# Same authoritative bottom-up34 rows as scene3:18compute,9switch,6power,1management.
layout=['power']*3+['compute']*8+['switch']*9+['compute']*10+['power']*3+['management']
for i,kind in enumerate(layout):
 center=.12+i*.04445+.022225
 top=(2.25-center-.022225)*48/2.2
 drawer(g,top,.04445*48/2.2,kind in ['power','compute'])
groups[g]['ifxDrawerCounts']='18 compute;9 switch;6 power;1 management;34 total'
g='H100_FACE'
for i in range(4):
 # Four existing8U servers. Open skeletal frame leaves fan texture visible.
 y=.05+(3+i*8.2+4)*2.2/48
 for yy in [y-8*2.2/96,y+8*2.2/96]:box('HGX drawer rolled edge',(0,yy,.622),(.48,.014,.023),steel,g,.004)
 for x in [-.228,.228]:box('HGX captive pull',(x,y,.641),(.018,.18,.036),alloy,g,.006)
# The center of every face remains open to retain original status/vent graphics.
# The native graphics will be relocated a few millimetres beyond the relief base.
for o in list(S.objects):
 if o.type!='MESH':continue
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 for mod in list(o.modifiers):
  if o.parent and o.parent.name in ['NVL_FACE','H100_FACE'] and mod.type=='BEVEL':mod.segments=1
  bpy.ops.object.modifier_apply(modifier=mod.name)
 bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for g in groups.values():
 for material in list(bpy.data.materials):
  obs=[o for o in g.children if o.type=='MESH' and o.data.materials and o.data.materials[0]==material]
  if len(obs)>1:
   bpy.ops.object.select_all(action='DESELECT')
   for o in obs:o.select_set(True)
   bpy.context.view_layer.objects.active=obs[0];bpy.ops.object.join();obs[0].name=g.name+' '+material.name
root=bpy.data.objects.new('IFX_HALL_FINISH',None);S.collection.objects.link(root)
root['representative']=True;root['purpose']='Physical architectural finish, existing cabinet face relief and a representative CDU/in-row cabinet with roof valve ports; no added equipment or services.'
for g in groups.values():g.parent=root
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'hall-finish.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/hall-finish.glb'),export_format='GLB',export_yup=True,export_extras=True)

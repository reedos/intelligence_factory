"""Hall architectural and cabinet finish, representative physical construction.
No added equipment, network ports or services. All dimensions in metres.
"""
import pathlib
HERE=pathlib.Path(__file__).resolve().parent
exec((HERE/'build-campus-architecture.py').read_text().split('# Full opaque building envelope.')[0])
for g in list(groups.values()):bpy.data.objects.remove(g,do_unlink=True)
groups={}
for n in ['SERVICE_WALL','LUMINAIRE','NVL_FACE','H100_FACE']:
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
 box('Backwall structural pier',(x,3.85,.28),(.22,7.3,.5),ceramic,g,.034)
 # Short cutaway roof brackets, all above existing bus/fiber runs.
 beam('Tapered cutaway roof bracket',(x,6.6,.48),(x,7.08,1.15),.2,.25,ceramic,g)
 box('Bracket indirect light',(x,6.90,.82),(.08,.04,.65),walllight,g,.007)
box('Folded wall crown',(0,7.42,.42),(60.6,.16,1.03),ceramic,g,.03)
# Fixture housing replaces a fullbright plane; only the underside emits.
g='LUMINAIRE'
box('Folded luminaire housing',(0,0,0),(1.3,.075,.19),graphite,g,.028)
box('Anodized luminaire cap',(0,.027,0),(1.28,.026,.175),steel,g,.017)
box('Recessed opal diffuser',(0,-.038,0),(1.16,.012,.09),fixture,g,.005)
for x in [-.51,.51]:box('Luminaire suspension boss',(x,.058,0),(.07,.065,.055),steel,g,.01)
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
root['representative']=True;root['purpose']='Physical architectural finish and existing cabinet face relief; no added equipment or services.'
for g in groups.values():g.parent=root
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'hall-finish.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/models/hall-finish.glb'),export_format='GLB',export_yup=True,export_extras=True)

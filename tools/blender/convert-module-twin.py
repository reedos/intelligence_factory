"""Re-author the representative twin-port internals while preserving the reviewed OSFP exterior.
Two independent ports are documented; the separate DSP/PIC packages here are an
explicit representative implementation, not a vendor teardown. SI metres, glTF Y up.
Run with Blender --background --python tools/blender/convert-module-twin.py.
"""
import bpy,json,struct,math,shutil
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
TARGET=ROOT/'public/models/osfp-module-runtime.glb'
REF=ROOT/'tools/blender/osfp-module-single-engine-reference.glb'
if not REF.exists():shutil.copy2(TARGET,REF)
b=REF.read_bytes();doc=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
meta=next(json.loads(n['extras']['ifx']) for n in doc['nodes'] if n.get('extras',{}).get('ifx'))
old={r['name']:r for r in meta['routes']}
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(REF))
board=bpy.data.objects['02_BOARD'];root=bpy.data.objects['IFX_OSFP']
M={int(m.name.split(' | ')[0]):m for m in bpy.data.materials if ' | ' in m.name}
def B(p):return Vector((p[0],-p[2],p[1]))
def G(p):return (p.x,p.z,-p.y)
def group(name,parent=board):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;return o
def remove_children(g):
 for o in list(g.children_recursive):bpy.data.objects.remove(o,do_unlink=True)
def box(name,p,d,m,parent,bevel=.000035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=B(p));o=bpy.context.object;o.name=name;o.dimensions=(d[0],d[2],d[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(m)
 if bevel:
  mod=o.modifiers.new('Manufactured edge radius','BEVEL');mod.width=bevel;mod.segments=3
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world;o['authoredStatic']=True
 return o
def clone_transform(source,parent,fn):
 for o in list(source.children_recursive):
  if o.type!='MESH':continue
  n=bpy.data.objects.new(o.name+' twin',o.data.copy());bpy.context.collection.objects.link(n);n.parent=parent
  for v in n.data.vertices:v.co=B(fn(G(o.matrix_world@v.co)))
  n['authoredStatic']=True
# Separate engine packages retain the original fine silicon and package geometry.
for name,center,scale in [('PART_DSP',(0,0),(.75,.60)),('03_THERMAL',(0,0),(.75,.60)),('PART_DRIVER',(.0111,.003885),(1,.44)),('PART_TIA',(.0111,-.003765),(1,.44))]:
 source=bpy.data.objects[name];tmp=group('temporary source')
 for o in list(source.children):world=o.matrix_world.copy();o.parent=tmp;o.matrix_world=world
 for e,s in enumerate([1,-1]):
  dest=group(f'ENGINE_{e+1}_{name}',source)
  if name in ['PART_DSP','03_THERMAL']:
   fn=lambda p,s=s:(-.016+(p[0]+.016)*scale[0],p[1],s*.00525+p[2]*scale[1])
  else:
   znew=(.0077 if name=='PART_DRIVER' else .00315) if e==0 else (-.00315 if name=='PART_DRIVER' else -.0077)
   fn=lambda p,s=s,znew=znew,center=center,scale=scale:(p[0],p[1],znew+s*(p[2]-center[1])*scale[1])
  clone_transform(tmp,dest,fn)
 remove_children(tmp);bpy.data.objects.remove(tmp,do_unlink=True)
for name in ['PART_PIC','PART_LASERS','PART_BONDS','PART_DSP_TRACES','PART_OPTICAL_ROUTES']:
 remove_children(bpy.data.objects[name])
for o in list(bpy.data.objects):
 if o.name.startswith('LPO_BYPASS'):bpy.data.objects.remove(o,do_unlink=True)
lpo=group('LPO_BYPASS');pic=bpy.data.objects['PART_PIC'];lasers=bpy.data.objects['PART_LASERS'];bonds=bpy.data.objects['PART_BONDS'];traces=bpy.data.objects['PART_DSP_TRACES'];optics=bpy.data.objects['PART_OPTICAL_ROUTES']
# Independent silicon dies, edge seal, fiber attach blocks and photodiode/electrode detail.
for e,s in enumerate([1,-1]):
 pg=group(f'ENGINE_{e+1}_PIC',pic)
 box('Silicon photonics die',( .023275,.00315,s*.00525),(.01885,.00085,.0088),M[8],pg)
 for z in [s*.00525-.0043,s*.00525+.0043]:box('PIC perimeter seal',(.023275,.003595,z),(.0184,.000022,.00004),M[5],pg,.000006)
 box('Eight-fiber attach',( .0331,.0039,s*.00525),(.0011,.00055,.0079),M[10],pg)
 for j in range(4):
  tx=(.00875-j*.0007) if e==0 else (-.0021-j*.0007);rx=(.0042-j*.0007) if e==0 else (-.00665-j*.0007)
  box('Photodiode',(.0145,.00366,rx),(.0007,.00012,.00025),M[8],pg,.00002)
  for x in [.0140,.0200,.0260]:box('MZM electrode pad',(x,.00367,tx),(.00038,.000035,.00018),M[5],pg,.000006)
  for off in [-.00027,.00027]:box('MZM travelling electrode',(.023,.00366,tx+off),(.006,.000028,.00006),M[6],pg,.000006)
 for k in range(2):
  z=(.0084-k*.0014) if e==0 else (-.00245-k*.0014)
  box('Laser submount',(.0163,.00371,z),(.0019,.00024,.00062),M[5],lasers)
  box('CW laser die',(.0166,.00393,z),(.00115,.0003,.00032),M[8],lasers,.000018)
# Build physical conductors and metadata together: electrical and light never exchange materials.
routes=[];parts={}
def route(name,points,mat,radius,parent,engine=None):
 points=[list(p) for p in points];r={'name':name,'assembly':'02_BOARD','points':points}
 if engine is not None:r['engine']=engine+1
 routes.append(r)
 vs,fs=parts.setdefault((parent.name,mat.name),([],[]))
 for a,b in zip(points,points[1:]):
  a,b=B(a),B(b);d=b-a
  if d.length<1e-10:continue
  d.normalize();u=d.cross(Vector((0,0,1)))
  if u.length<.1:u=d.cross(Vector((0,1,0)))
  u.normalize();v=d.cross(u);base=len(vs)
  for p in [a,b]:
   for k in range(8):vs.append(tuple(p+radius*(math.cos(k*math.tau/8)*u+math.sin(k*math.tau/8)*v)))
  for k in range(8):n=(k+1)%8;fs.append((base+k,base+n,base+8+n,base+8+k))
  fs.extend([tuple(base+k for k in range(7,-1,-1)),tuple(base+8+k for k in range(8))])
for i in range(8):
 e=i//4;s=1 if e==0 else -1;j=i%4;tx=(.00875-j*.0007) if e==0 else (-.0021-j*.0007);rx=(.0042-j*.0007) if e==0 else (-.00665-j*.0007);num=f'{i+1:02d}'
 for prefix,z in [('TX',tx),('RX',rx)]:
  oldz=(.00665-i*.00079) if prefix=='TX' else (-.001-i*.00079)
  names=[f'TX {num} MZM arm -1',f'TX {num} MZM arm 1',f'Driver bond {i+1}',f'TX RF feed {i+1}'] if prefix=='TX' else [f'RX {num} waveguide',f'TIA bond {i+1}']
  for name in names:
   points=[[p[0],p[1],z+s*(p[2]-oldz)] for p in old[name]['points']]
   optical=('MZM arm' in name or 'waveguide' in name)
   route(name,points,M[13 if prefix=='TX' else 14] if optical else M[5 if 'bond' in name else 6],.000028 if optical else .000012,bonds if 'bond' in name else optics,e)
  # Smooth fibers preserve the exact MPO-12 fiber positions; each engine feeds its own port only.
  previous=old[f'{prefix} glass fiber {num}']['points'];start=[.0334,.00395,z];end=previous[-1]
  points=[]
  for k in range(25):
   t=k/24;u=t*t*(3-2*t);points.append([start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*u+.00055*math.sin(math.pi*t),start[2]+(end[2]-start[2])*u])
  route(f'{prefix} glass fiber {num}',points,M[13 if prefix=='TX' else 14],.000035,optics,e)
  # These sampled traces begin after omitted contact fan-out. Pair spacing is preserved.
  for sign in [-1,1]:
   zp=z+s*sign*.000072;y=.00273
   host=[[-.0273,y,zp],[-.0255,y,zp],[-.021625,y,zp]]
   engine=[[-.010375,y,zp],[-.001,y,zp],[.006,y,zp],[.008450001,y,zp]]
   route(f'{prefix} host copper {i} {sign}',host,M[6],.000028,traces,e)
   route(f'{prefix} engine copper {i} {sign}',engine,M[6],.000028,traces,e)
   route(f'{prefix} LPO copper {i} {sign}',[host[0],host[1],[-.004,y,zp],*engine[-2:]],M[6],.000028,lpo,e)
 k=i//2;h=i%2;laserZ=(.0084-(j//2)*.0014) if e==0 else (-.00245-(j//2)*.0014)
 route(f'CW feed {k} {h}',[[.017175,.004035,laserZ],[.0179,.003605,laserZ],[.01835,.003605,tx],[.0189,.003605,tx]],M[15],.00003,optics,e)
for (parent,mat),(vs,fs) in parts.items():
 mesh=bpy.data.meshes.new('Authored routes');mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new(parent+' '+mat,mesh);bpy.context.collection.objects.link(o);o.parent=bpy.data.objects[parent];o.data.materials.append(bpy.data.materials[mat]);o['authoredStatic']=True
# Batch manufacturable details per engine/material, retaining meaningful assembly groups.
for parent in [o for o in list(bpy.data.objects) if o.type=='EMPTY']:
 meshes=[o for o in parent.children if o.type=='MESH']
 mats=set(o.data.materials[0] for o in meshes if len(o.data.materials)==1)
 for mat in mats:
  same=[o for o in parent.children if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==mat]
  if len(same)<2:continue
  bpy.ops.object.select_all(action='DESELECT')
  for o in same:o.select_set(True)
  bpy.context.view_layer.objects.active=same[0];bpy.ops.object.join();bpy.context.object.name=parent.name+' '+mat.name
meta['routes']=routes;meta['engineCount']=2;meta['lanesPerEngine']=4
meta['implementation']='Two independent 800G ports; separate DSP/PIC packages and PCB fan-out are representative, not a teardown.'
meta['engineAnchors']=[]
for e,s in enumerate([1,-1]):
 a={'dsp':[-.016,.00406,s*.00525],'driver':[.0111,.00356,.0077 if e==0 else -.00315],'tia':[.0111,.00356,.00315 if e==0 else -.0077],'lasers':[.0166,.00408,.0084 if e==0 else -.00245],'mzm':[.023,.003605,.0077 if e==0 else -.00315],'pd':[.0143,.0037,.00315 if e==0 else -.0077]}
 meta['engineAnchors'].append(a)
for key,p in meta['engineAnchors'][0].items():meta['anchors'][key]['position']=p
root['ifx']=json.dumps(meta,separators=(',',':'));root['authoredStatic']=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools/blender/osfp-module-twin.blend'))
bpy.ops.export_scene.gltf(filepath=str(TARGET),export_format='GLB',export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
print('TWIN MODULE',TARGET.stat().st_size)

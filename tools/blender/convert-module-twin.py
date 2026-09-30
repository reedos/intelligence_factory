"""Re-author the representative twin-port internals while preserving the reviewed OSFP exterior.
Two optical ports share one eight-lane 1.6T DSP and a representative PIC.
Eight TX lanes occupy one bank, eight RX lanes the other; analog ICs and
placement are representative, not a vendor teardown. SI metres, glTF Y up.
Run with Blender --background --python tools/blender/convert-module-twin.py.
"""
import bpy,bmesh,json,struct,math,shutil
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

# Representative passive terminations originally ran only 5 micrometres below
# overlapping ceramic tops. Recess their upper skin to avoid overview depth
# ambiguity; these component internals carry no dimensional claim.
caps=bpy.data.objects['PART_DCDC__02']; inv_caps=caps.matrix_world.inverted()
for v in caps.data.vertices:
 p=list(G(caps.matrix_world@v.co))
 if .00315 <= p[1] <= .003170001:
  p[1]=.00315+(p[1]-.00315)*.25
  v.co=inv_caps@B(p)
# Clear two visible signal corridors between the center controllers and inductors.
# Move the representative small passives, including their solder terminations,
# from +/-3 mm to the spare outer rows; keep the actual contact assignments intact.
for o in bpy.data.objects['PART_DCDC'].children_recursive:
 if o.type!='MESH':continue
 inv=o.matrix_world.inverted()
 for v in o.data.vertices:
  p=list(G(o.matrix_world@v.co))
  if -.042 < p[0] < -.023 and .0026 < abs(p[2]) < .0034:
   if p[2]<0 and p[0]>-.0285:p[0]-=.001575;p[2]+=.0108
   else:p[2]+=math.copysign(.0048,p[2])
   v.co=inv@B(p)
# Replace the old decorative fan-out vias with the vias used by the complete nets.
for name in ['PART_BOARD__05','PART_BOARD__07']:
 if name in bpy.data.objects:bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)

# Twin MPO receptacles: 10.0 mm centre pitch (MSA Fig 14-48), vertical MT
# ferrule 6.4 x 2.5 mm with 12 fibre positions at 0.25 mm. Body depth and shape
# are representative; no receptacle internals are published.
MPO_Z=[.005,-.005];MPO_Y=.00705;MPO_PITCH=.00025;MPO_FERRULE_BACK=.0470;MPO_FERRULE_FACE=.0503
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
# Reveal only the connector breakout in the data diagram. The rest of the
# laminate stays opaque, so buried routing is readable without a floating overlay.
laminate=bpy.data.objects['PART_BOARD__04']
window_mat=bpy.data.materials.new('PCB breakout laminate, revealed layers');window_mat.use_nodes=True
bsdf=window_mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(.018,.12,.075,1);bsdf.inputs['Alpha'].default_value=.08;bsdf.inputs['Roughness'].default_value=.75
window_mat.diffuse_color=(.018,.12,.075,.08)
for side in [-1,1]:
 center=(-.0471,.0022,side*.0048);dimensions=(.0064,.001,.008)
 cutter=box('Temporary breakout cut',center,(.0064,.0015,.008),M[4],board,0)
 bpy.context.view_layer.objects.active=laminate
 mod=laminate.modifiers.new('Connector breakout section','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cutter
 bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cutter,do_unlink=True)
 patch=box('PCB_BREAKOUT_WINDOW',center,dimensions,window_mat,board,0);patch['pcbBreakoutWindow']=True

def clone_transform(source,parent,fn,replace_dsp_marking=False):
 for o in list(source.children_recursive):
  if o.type!='MESH':continue
  # Replace the reference engraving with the explicit shared-DSP capacity marking.
  if replace_dsp_marking and M[9] in list(o.data.materials):continue
  n=bpy.data.objects.new(o.name+' twin',o.data.copy());bpy.context.collection.objects.link(n);n.parent=parent
  for v in n.data.vertices:v.co=B(fn(G(o.matrix_world@v.co)))
  n['authoredStatic']=True
# Preserve the reference's single PIC and eight-channel driver/TIA packages:
# all TX channels lie on +Z, all RX on -Z. The two MPOs remain separate ports.
for name in ['PART_DSP', '03_THERMAL']:
 source=bpy.data.objects[name];tmp=group('temporary source')
 for o in list(source.children):world=o.matrix_world.copy();o.parent=tmp;o.matrix_world=world
 dest=group(f'SHARED_{name}',source)
 clone_transform(tmp,dest,lambda p:p,name=='PART_DSP')
 remove_children(tmp);bpy.data.objects.remove(tmp,do_unlink=True)
for name in ['PART_BONDS','PART_DSP_TRACES','PART_OPTICAL_ROUTES']:
 remove_children(bpy.data.objects[name])
for o in list(bpy.data.objects):
 if o.name.startswith('LPO_BYPASS'):bpy.data.objects.remove(o,do_unlink=True)
lpo=group('LPO_BYPASS');bonds=bpy.data.objects['PART_BONDS'];traces=bpy.data.objects['PART_DSP_TRACES'];optics=bpy.data.objects['PART_OPTICAL_ROUTES']
# Build physical conductors and metadata together: electrical and light never exchange materials.
routes=[];parts={};contacts={c['signal']:c for c in meta['contacts']};host_vias=[]
via_group=group('HOST_SIGNAL_VIAS')
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
 e=i//4;tx=.00665-i*.00079;rx=-.001-i*.00079;num=f'{i+1:02d}'
 for prefix,z in [('TX',tx),('RX',rx)]:
  names=[f'TX {num} MZM arm -1',f'TX {num} MZM arm 1',f'Driver bond {i+1}',f'TX RF feed {i+1}'] if prefix=='TX' else [f'RX {num} waveguide',f'TIA bond {i+1}']
  for name in names:
   points=old[name]['points']
   optical=('MZM arm' in name or 'waveguide' in name)
   route(name,points,M[13 if prefix=='TX' else 14] if optical else M[5 if 'bond' in name else 6],.000028 if optical else .000012,bonds if 'bond' in name else optics,e)
  # Smooth fiber banks fan out to each port. RX arches above TX so crossings
  # in plan view remain separate glass strands, never optical junctions.
  # Vertical MT ferrules, OSFP MSA Rev 5.22 Fig 14-48: connector 1 (+Z, left
  # from the front) carries RX1-4 at the top and TX1-4 at the bottom; connector 2
  # carries TX5-8 at the top and RX5-8 at the bottom. The four middle positions stay dark.
  k=(i if prefix=='RX' else 11-i) if e==0 else (i-4 if prefix=='TX' else 15-i)
  start=[.0334,.00395,z];end=[MPO_FERRULE_BACK,MPO_Y+(5.5-k)*MPO_PITCH,MPO_Z[e]]
  points=[]
  for k in range(25):
   t=k/24;u=t*t*(3-2*t);points.append([start[0]+(end[0]-start[0])*t,start[1]+(end[1]-start[1])*u+(.00055 if prefix=='TX' else .0020)*math.sin(math.pi*t),start[2]+(end[2]-start[2])*u])
  route(f'{prefix} glass fiber {num}',points,M[13 if prefix=='TX' else 14],.000035,optics,e)
  # Every conductor starts on its assigned OSFP contact. A short multilayer
  # breakout preserves lane numbers and polarity despite the two-sided pinout.
  # The eight representative PCB routing layers are exposed only at their vias;
  # all long runs through the power section use the two clear top-side corridors.
  for sign in [-1,1]:
   zp=z+sign*.000072;y=.00273;dspz=zp*.7
   polarity='p' if sign==(1 if prefix=='TX' else -1) else 'n'
   contact=contacts[f'{prefix}{i+1}{polarity}'];start=contact['position']
   layer=.00180+i*.00010
   bankz=(.00352-i*.00024 if prefix=='TX' else -.00184-i*.00024)+sign*.000072
   heelz=start[2]+(.00020 if start[1]<.002 else 0)
   heel=[-.0500,start[1],heelz];via=[-.0442,y,bankz]
   breakout=[start,heel,[-.0500,layer,heelz],[-.0488,layer,heelz],[-.0452,layer,bankz],[-.0442,layer,bankz],via]
   host=[*breakout,[-.0428,y,bankz],[-.0281,y,bankz],[-.0245,y,dspz],[-.0235,y,dspz]]
   engine=[[-.0085,y,dspz],[-.0065,y,dspz],[-.002,y,zp],[.006,y,zp],[.008450001,y,zp]]
   route(f'{prefix} host copper {i} {sign}',host,M[6],.000028,traces,e)
   routes[-1].update(hostSignal=contact['signal'],hostPin=contact['pins'][0],pcbLayer=i+1)
   route(f'{prefix} engine copper {i} {sign}',engine,M[6],.000028,traces,e)
   bypass=[*breakout,[-.0428,y,bankz],[-.023,y,bankz],[-.019,y,zp],[-.004,y,zp],*engine[-2:]]
   route(f'{prefix} LPO copper {i} {sign}',bypass,M[6],.000028,lpo,e)
   routes[-1].update(hostSignal=contact['signal'],hostPin=contact['pins'][0],pcbLayer=i+1)
   host_vias.extend([heel,via])
 k=i//2;h=i%2
 route(f'CW feed {k} {h}',old[f'CW feed {k} {h}']['points'],M[15],.00003,optics,e)
# Plated annuli surround the actual layer transitions, rather than orphan dots.
for index,p in enumerate(host_vias):
 vs=[];fs=[]
 for radius in [.000065,.000033]:
  for k in range(16):
   t=k*math.tau/16;vs.append(tuple(B((p[0]+radius*math.cos(t),p[1],p[2]+radius*math.sin(t)))))
 for k in range(16):j=(k+1)%16;fs.append((k,j,16+j,16+k))
 mesh=bpy.data.meshes.new('Plated signal via');mesh.from_pydata(vs,[],fs);mesh.update()
 obj=bpy.data.objects.new(f'Signal via {index+1}',mesh);bpy.context.collection.objects.link(obj);obj.parent=via_group;obj.data.materials.append(M[5]);obj['authoredStatic']=True
for (parent,mat),(vs,fs) in parts.items():
 mesh=bpy.data.meshes.new('Authored routes');mesh.from_pydata(vs,[],fs);mesh.update();o=bpy.data.objects.new(parent+' '+mat,mesh);bpy.context.collection.objects.link(o);o.parent=bpy.data.objects[parent];o.data.materials.append(bpy.data.materials[mat]);o['authoredStatic']=True
# ---- Optical nose: full-height IHS nose with a saddle, twin vertical MPO receptacles.
# NVIDIA MMS4A00 datasheet p.16 (Option 2) shows the 13.00 mm body continuing over
# the nose after a concave saddle, and a port view with two vertical ferrules.
# Saddle depth/width, wall thickness and bezel shape are representative.
def mesh_obj(name,verts,faces,mat,parent,recalc=True):
 me=bpy.data.meshes.new(name);me.from_pydata([tuple(B(v)) for v in verts],[],faces);me.update()
 if recalc:bm=bmesh.new();bm.from_mesh(me);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(me);bm.free()
 o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(mat);o['authoredStatic']=True
 return o
def extrude_profile(name,profile,z0,z1,mat,parent):
 n=len(profile);verts=[(x,y,z0) for x,y in profile]+[(x,y,z1) for x,y in profile]
 faces=[tuple(range(n)),tuple(range(2*n-1,n-1,-1))]+[(k,(k+1)%n,n+(k+1)%n,n+k) for k in range(n)]
 return mesh_obj(name,verts,faces,mat,parent)
def cut(target,center,dims):
 c=box('Temporary cut',center,dims,M[4],target.parent,0)
 bpy.context.view_layer.objects.active=target
 mod=target.modifiers.new('cut','BOOLEAN');mod.operation='DIFFERENCE';mod.object=c;mod.solver='EXACT'
 bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(c,do_unlink=True)
def bevel(o,width,segments=2):
 bpy.context.view_layer.objects.active=o
 mod=o.modifiers.new('Manufactured edge radius','BEVEL');mod.width=width;mod.segments=segments;mod.limit_method='ANGLE'
 bpy.ops.object.modifier_apply(modifier=mod.name)
def disc(verts,faces,x,y,z,r,n=12):
 b=len(verts)
 for k in range(n):t=k*math.tau/n;verts.append((x,y+r*math.sin(t),z-r*math.cos(t)))
 faces.append(tuple(b+k for k in range(n)))
NOSE_START=.0259;SADDLE_END=.0351;NOSE_END=.0539;TOP=.0130;HALF=.01129
# Retire the reference's low nose plate: collapse its vertices into the new
# nose solid, then merge the resulting zero-area faces away.
cover=bpy.data.objects['04_COVER']
for o in [c for c in cover.children if c.type=='MESH']:
 mats=[m.name for m in o.data.materials]
 if any(n.startswith('03 |') for n in mats):bpy.data.objects.remove(o,do_unlink=True);continue
 if any(n.startswith(('07 |','17 |')) for n in mats):continue
 inv=o.matrix_world.inverted();moved=set()
 for v in o.data.vertices:
  q=list(G(o.matrix_world@v.co))
  if q[0]>.0275:q[0]=.0262;v.co=inv@B(q);moved.add(v.index)
 if moved:
  # Faces wholly in the old nose go; long rails keep their rear part, ending inside the new nose.
  bm=bmesh.new();bm.from_mesh(o.data);bm.verts.ensure_lookup_table()
  bmesh.ops.delete(bm,geom=[f for f in bm.faces if all(v.index in moved for v in f.verts)],context='FACES')
  bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
  bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-7)
  bmesh.ops.dissolve_degenerate(bm,edges=bm.edges,dist=1e-7);bm.to_mesh(o.data);bm.free()
# Label and its printing move onto the raised nose (A5 re-sets the text).
for o in [c for c in cover.children if c.type=='MESH' and any(m.name.startswith(('07 |','17 |')) for m in c.data.materials)]:
 inv=o.matrix_world.inverted()
 for v in o.data.vertices:
  q=list(G(o.matrix_world@v.co));q=[.0445+(q[0]-.0413)*.8,TOP-.00013+(q[1]-.00837),q[2]*.8];v.co=inv@B(q)
profile=[(NOSE_END,.00535),(NOSE_START,.00535),(NOSE_START,TOP-.00005)]
for k in range(1,24):
 s_=k/24;x=NOSE_START+(SADDLE_END-NOSE_START)*s_;profile.append((x,TOP-.0040*(1-(2*s_-1)**2)**1.4))
profile+= [(SADDLE_END,TOP),(NOSE_END-.0004,TOP),(NOSE_END,TOP-.0004)]
nose=extrude_profile('04_COVER optical nose',profile,-HALF,HALF,M[1],cover)
cut(nose,(.0445,TOP,0),(.0164,.0003,.0134))  # label recess, 0.15 mm deep
cut(nose,((SADDLE_END+.0005+.056)/2,.0085,0),(.056-SADDLE_END-.0005,.0066,2*(HALF-.0007)))
bevel(nose,.00022)
# Fin field: the reference's 21 fins at 0.96 mm pitch alias into moire at the
# overview distance. Re-cut 16 fins at 1.3 mm pitch, 0.5 mm thick, rounded tips,
# rooted 7.32 mm up like the reference fins, on the same 13.0 mm envelope.
# Fin count and pitch are representative (not published).
removed=0
for fins_src in [c for c in cover.children if c.type=='MESH' and c.data.materials[0].name.startswith('01 |')]:
 bm=bmesh.new();bm.from_mesh(fins_src.data);mw=fins_src.matrix_world;doomed=[]
 for f in bm.faces:
  ps=[G(mw@q.co) for q in f.verts]
  if all(abs(p[2])<=.009805 and -.04402<=p[0]<=.02502 for p in ps) and max(p[1] for p in ps)>.01005:doomed.append(f)
 bmesh.ops.delete(bm,geom=doomed,context='FACES');bm.to_mesh(fins_src.data);bm.free();removed+=len(doomed)
print('FINS REMOVED FACES',removed)
for k in range(16):
 fin=box('Heat sink fin',(-.0095,.01016,-.00975+k*.0013),(.069,.00568,.0005),M[1],cover,0)
 bevel(fin,.00015,2)
# Gap pad: one 1.0 mm silicone slab with rounded edges over the 10.3 mm die, replacing
# the reference's 2.24 mm two-tone block. Thickness and colour are representative.
pad_group=bpy.data.objects['SHARED_03_THERMAL']
for o in [c for c in pad_group.children if c.type=='MESH']:bpy.data.objects.remove(o,do_unlink=True)
pad_mat=M[16];pm=pad_mat.node_tree.nodes.get('Principled BSDF')
pm.inputs['Base Color'].default_value=(.105,.115,.16,1);pm.inputs['Roughness'].default_value=.85;pad_mat.diffuse_color=(.105,.115,.16,1)
pad=box('Thermal gap pad',(-.016,.00456,0),(.0108,.0010,.0108),pad_mat,pad_group,0);bevel(pad,.0002,3)
for f in pad.data.polygons:f.use_smooth=True
# Receptacles, ferrules and bezel ride with the board, where the old ports sat.
mpo=bpy.data.objects['PART_MPO']
for o in [c for c in mpo.children if c.type=='MESH']:
 mats=[m.name for m in o.data.materials]
 if any(n.startswith('10 |') for n in mats):
  bm=bmesh.new();bm.from_mesh(o.data);mw=o.matrix_world
  far=[v for v in bm.verts if G(mw@v.co)[0]>.040];bmesh.ops.delete(bm,geom=far,context='VERTS');bm.to_mesh(o.data);bm.free()
 else:bpy.data.objects.remove(o,do_unlink=True)
port=M[11];pn=port.node_tree.nodes.get('Principled BSDF')
pn.inputs['Base Color'].default_value=(.028,.029,.033,1);pn.inputs['Roughness'].default_value=.55;port.diffuse_color=(.028,.029,.033,1)
hole=bpy.data.materials.new('18 | Unlit fibre positions');hole.use_nodes=True
hn=hole.node_tree.nodes.get('Principled BSDF');hn.inputs['Base Color'].default_value=(.012,.012,.014,1);hn.inputs['Roughness'].default_value=.6;hole.diffuse_color=(.012,.012,.014,1)
bez=box('MPO bezel',(.05345,.0065,0),(.0005,.0104,.0212),port,mpo,0)
for e,zc in enumerate(MPO_Z):
 body=box(f'MPO receptacle {e+1}',(.04875,.007175,zc),(.0085,.00885,.0086),port,mpo,0)
 cut(body,(.0515,MPO_Y,zc),(.0040,.0074,.0060))
 bevel(body,.00018)
 cut(bez,(.05345,MPO_Y,zc),(.0012,.0074,.0060))
 cut(bez,(.05370,.01135,zc),(.0004,.0006,.0024))
 box(f'MT ferrule {e+1}',((MPO_FERRULE_BACK+MPO_FERRULE_FACE)/2,MPO_Y,zc),(MPO_FERRULE_FACE-MPO_FERRULE_BACK,.0064,.0025),M[10],mpo,.00006)
 # Representative alignment sleeve around the ferrule and a latch arm on each side of the opening.
 sleeve=box(f'MPO sleeve {e+1}',(.05005,MPO_Y,zc),(.0011,.0074,.0038),M[7],mpo,0)
 cut(sleeve,(.05005,MPO_Y,zc),(.0014,.0066,.0027));bevel(sleeve,.00008)
 for side in [-1,1]:box(f'MPO latch arm {e+1}',(.0514,MPO_Y,zc+side*.00282),(.0026,.0050,.00022),M[2],mpo,.00004)
 lit={13:([],[]),14:([],[]),18:([],[])}
 for k in range(12):
  if 4<=k<8:key=18
  elif e==0:key=14 if k<4 else 13
  else:key=13 if k<4 else 14
  disc(*lit[key],MPO_FERRULE_FACE+.00002,MPO_Y+(5.5-k)*MPO_PITCH,zc,.00009)
 for sy in [-1,1]:disc(*lit[18],MPO_FERRULE_FACE+.00002,MPO_Y+sy*.0023,zc,.00035,16)
 for key,(vs,fs) in lit.items():
  mesh_obj(f'MPO face {e+1} {key}',vs,fs,hole if key==18 else M[key],mpo,False)
bevel(bez,.00012)
# Pull tab: NVIDIA MMS4A00 Option 2 drawing (datasheet p.16) gives 24.65 mm reach
# beyond the nose, 18.58 mm outer width and a raised grip end (14.11 mm); single-mode
# yellow per p.22. The swept strap section and the S-rise profile are representative.
tab=bpy.data.objects['05_PULL_TAB']
for o in [c for c in tab.children if c.type=='MESH' and c.data.materials[0].name.startswith('12 |')]:bpy.data.objects.remove(o,do_unlink=True)
ochre=M[12];on=ochre.node_tree.nodes.get('Principled BSDF')
on.inputs['Base Color'].default_value=(.85,.72,.08,1);on.inputs['Roughness'].default_value=.5;on.inputs['Metallic'].default_value=0;ochre.diffuse_color=(.85,.72,.08,1)
W_,T_=.0022,.0012;ZA=.01858/2-W_/2;TIP=NOSE_END+.02465;CX=TIP-W_/2-ZA;Y0,Y1=.0035,.0124
def rise(x):
 s_=min(1,max(0,(x-.0565)/(CX-.0565)));return Y0+(Y1-Y0)*s_*s_*(3-2*s_)
path=[]
for k in range(25):x=.0515+(CX-.0515)*k/24;path.append(Vector((x,rise(x),ZA)))
for k in range(1,24):a_=math.pi/2-math.pi*k/24;path.append(Vector((CX+ZA*math.cos(a_),Y1,ZA*math.sin(a_))))
for k in range(24,-1,-1):x=.0515+(CX-.0515)*k/24;path.append(Vector((x,rise(x),-ZA)))
ring=[];R_=.0003
for cx_,cy_ in [(1,1),(-1,1),(-1,-1),(1,-1)]:
 for k in range(3):a_=math.atan2(cy_,cx_)-math.pi/4+k*math.pi/4;ring.append((cx_*(W_/2-R_)+R_*math.cos(a_),cy_*(T_/2-R_)+R_*math.sin(a_)))
verts=[];faces=[];n_=len(ring)
for i,p_ in enumerate(path):
 t_=(path[min(i+1,len(path)-1)]-path[max(i-1,0)]).normalized();w_=Vector((0,1,0)).cross(t_).normalized();u_=t_.cross(w_).normalized()
 for a_,b_ in ring:verts.append(tuple(p_+w_*a_+u_*b_))
 if i:faces+=[((i-1)*n_+k,(i-1)*n_+(k+1)%n_,i*n_+(k+1)%n_,i*n_+k) for k in range(n_)]
faces+=[tuple(range(n_-1,-1,-1)),tuple(range((len(path)-1)*n_,len(path)*n_))]
strap=mesh_obj('05_PULL_TAB swept strap',verts,faces,ochre,tab)
for f in strap.data.polygons[:-2]:f.use_smooth=True
meta['opticalPorts']={'pitchMm':10.0,'orientation':'vertical','ferruleMm':[6.4,2.5],'positions':12,'mapping':'MSA Rev 5.22 Fig 14-48'}
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
marking='DSP\n8 × 200G\n1.6T'
curve=bpy.data.curves.new('Shared DSP capacity marking','FONT')
curve.body=marking;curve.align_x='CENTER';curve.align_y='CENTER';curve.size=.0013;curve.space_line=1.15;curve.extrude=.000002
obj=bpy.data.objects.new('SHARED_DSP_CAPACITY',curve);bpy.context.collection.objects.link(obj)
obj.location=B((-.016,.004075,0));obj.data.materials.append(M[9])
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
world=obj.matrix_world.copy();obj.parent=bpy.data.objects['SHARED_PART_DSP'];obj.matrix_world=world
obj['authoredStatic']=True;obj['capacityMarking']=marking;obj['lanesPerDirection']=8;obj['nominalLaneGbps']=200
meta['routes']=routes;meta['portCount']=2;meta['lanesPerPort']=4;meta['picCount']=1
meta['laneBanks']={'TX':'+Z','RX':'-Z'}
meta['hostRouting']='All 32 signal conductors connect to their named OSFP contact. Short multilayer breakout and top-side routing corridors are representative, not a production PCB layout.'
meta['dspCount']=1;meta['dspLanesPerDirection']=8
meta['nominalLaneGbps']=200;meta['nominalCapacityGbpsPerDirection']=1600
meta['implementation']='One shared eight-lane 1.6T DSP and PIC; eight TX channels on +Z and eight RX on -Z; two 800G optical ports. Analog ICs, placement and PCB fan-out are representative, not a teardown.'
meta['analogAnchors']=[{key:meta['anchors'][key]['position'] for key in ['driver','tia','lasers','mzm','pd']}]
root['ifx']=json.dumps(meta,separators=(',',':'));root['authoredStatic']=True
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools/blender/osfp-module-twin.blend'))
staged=TARGET.with_name(TARGET.stem+'.staged.glb')
bpy.ops.export_scene.gltf(filepath=str(staged),export_format='GLB',export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
staged.replace(TARGET)
print('TWIN MODULE',TARGET.stat().st_size)

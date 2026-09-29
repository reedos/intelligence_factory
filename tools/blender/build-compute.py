"""Blender authoring for complete compute hardware scenes.
Reference GLBs preserve audited technical positions; Blender owns the shipped
static geometry. Native Three.js is retained only for overlays and animation.
Run after export-native-reference.mjs --compute.
"""
import bpy, bmesh, math, json, sys
import importlib.util
from pathlib import Path
from mathutils import Vector

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
OUT=ROOT/'public'/'models'; OUT.mkdir(parents=True,exist_ok=True)

def material(name,color,metal=.7,rough=.38):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m

def p3(p,u):return (p[0]*u,-p[2]*u,p[1]*u)

def box(name,p,d,m,u,bevel=.012):
    x,y,z=d[0]*u/2,d[2]*u/2,d[1]*u/2
    verts=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=p3(p,u)
    o.data.materials.append(m)
    if bevel:
        mod=o.modifiers.new('Precision edge radius','BEVEL');mod.width=min(bevel,min(d)*.38)*u;mod.segments=3
    mod=o.modifiers.new('Face weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    for f in o.data.polygons:f.use_smooth=True
    return o

def cylinder(name,p,r,h,m,u,axis='y'):
    n=20;verts=[(math.cos(i*math.tau/n)*r*u,math.sin(i*math.tau/n)*r*u,s*h*u/2) for s in [-1,1] for i in range(n)]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=p3(p,u);o.data.materials.append(m)
    if axis=='z':o.rotation_euler.x=math.pi/2
    if axis=='x':o.rotation_euler.y=math.pi/2
    mod=o.modifiers.new('Turned edge','BEVEL');mod.width=min(r*.12,h*.2)*u;mod.segments=2
    o.modifiers.new('Machined normals','WEIGHTED_NORMAL')
    return o

def screw(p,r,m,u):
    cylinder('Captive service screw',p,r,.011,m['bright'],u)
    box('Recessed screw drive',(p[0],p[1]+.006,p[2]),(r*1.25,.0015,r*.25),m['dark'],u,.0005)

def bounds(o):
    points=[o.matrix_world@Vector(c) for c in o.bound_box]
    return tuple(min(v[i] for v in points) for i in range(3)),tuple(max(v[i] for v in points) for i in range(3))

def remove_tray_mechanics(o):
    # Delete only disconnected native cold-plate/case reference pieces. Signals,
    # boards, silicon, coolant routes and fittings stay at their audited positions.
    if o.type!='MESH':return
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);seen=set();remove=[]
    for start in bm.verts:
        if start in seen:continue
        group=set([start]);stack=[start];seen.add(start)
        while stack:
            v=stack.pop()
            for e in v.link_edges:
                other=e.other_vert(v)
                if other not in seen:seen.add(other);group.add(other);stack.append(other)
        points=[o.matrix_world@v.co for v in group]
        lo=[min(p[i] for p in points) for i in range(3)];hi=[max(p[i] for p in points) for i in range(3)]
        # Convert Blender metres to native tray x/y/z (unit=10 cm).
        xmin,xmax=lo[0]*10,hi[0]*10;ymin,ymax=lo[2]*10,hi[2]*10;zmin,zmax=-hi[1]*10,-lo[1]*10
        w,h,d=xmax-xmin,ymax-ymin,zmax-zmin
        shell=(w>4.3 and d>8.9 and ymax<.05) or (w<.07 and d>8.85 and abs((xmin+xmax)/2)>2.16) or (w>4.3 and d<.08 and abs((zmin+zmax)/2)>4.45)
        plate=False
        for x in [-1.1,1.1]:
            for z,s in [(1.75,.66),(.2,.9),(-1.55,.9)]:
                if xmin>=x-s*.52 and xmax<=x+s*.52 and zmin>=z-s*.52 and zmax<=z+s*.52 and ymin>.635 and ymax<.80:plate=True
        if shell or plate:remove.extend(group)
    if remove:bmesh.ops.delete(bm,geom=remove,context='VERTS')
    bm.to_mesh(o.data);bm.free()

def refine_reference(kind,accel):
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':continue
        if kind=='rack':
            # The old adjacent context rack hid the hero cabinet's side cover.
            # Remove only that disconnected decorative enclosure; the single
            # inspected rack and every functional component stay untouched.
            bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);seen=set();remove=[]
            for start in bm.verts:
                if start in seen:continue
                group={start};stack=[start];seen.add(start)
                while stack:
                    v=stack.pop()
                    for e in v.link_edges:
                        other=e.other_vert(v)
                        if other not in seen:seen.add(other);group.add(other);stack.append(other)
                ps=[o.matrix_world@v.co for v in group];lo=[min(p[i] for p in ps) for i in range(3)];hi=[max(p[i] for p in ps) for i in range(3)]
                if hi[0]<-.31 and hi[0]-lo[0]>.58 and hi[2]-lo[2]>2.20 and hi[1]-lo[1]>1.0:remove.extend(group)
            if remove:bmesh.ops.delete(bm,geom=remove,context='VERTS')
            bm.to_mesh(o.data);bm.free()
        if kind=='tray' and accel in ['gb200','gb300']:remove_tray_mechanics(o)
        if len(o.data.vertices)==0:bpy.data.objects.remove(o,do_unlink=True);continue
        # Weld reference face splits, then add genuine manufacturing edge radii.
        # Curved cables and spheres keep their existing shape; bevel only sharp edges.
        bm=bmesh.new();bm.from_mesh(o.data)
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7)
        bm.to_mesh(o.data);bm.free()
        # Rack references already have rounded enclosure/cable cross-sections.
        # Re-beveling those small repeated curves adds export weight without
        # a visible silhouette improvement at rack inspection distances.
        if kind=='rack':continue
        mod=o.modifiers.new('Blender manufactured edge finish','BEVEL')
        mod.width={'rack':.00035,'tray':.00022,'chip':.000025}[kind]
        mod.segments=2;mod.limit_method='ANGLE';mod.angle_limit=.65;mod.use_clamp_overlap=True
        o.modifiers.new('Precision surface normals','WEIGHTED_NORMAL')

def tray_hardware(accel,m):
    if accel=='rubin':
        rubin_hardware(m)
        return
    u=.1;H=3.56 if accel=='h100' else .42
    if accel!='h100':
        box('Formed aluminum chassis',(0,.014,0),(4.4,.028,9),m['shell'],u,.007)
        for x in [-2.2,2.2]:
            box('Folded outer wall',(x,H/2,0),(.038,H,9),m['shell'],u,.014)
            box('Rolled upper return',(x,H-.012,0),(.095,.024,8.94),m['bright'],u,.01)
            box('Dark longitudinal reveal',(x+(.022 if x>0 else -.022),H*.6,0),(.006,.045,8.5),m['dark'],u,.002)
            for z in [-4.1,-2.8,-1.5,0,1.5,2.8,4.1]:screw((x,H+.005,z),.022,m,u)
        # Skeleton front bezel leaves original four optical cages and four drives
        # physically exposed. No fictional port texture or additional I/O count.
        for y in [.035,H-.025]:box('Bezel folded cross member',(0,y,4.5),(4.4,.055,.075),m['graphite'],u,.02)
        for x in [-2.12,-.94,-.62,-.06,2.11]:box('Bezel structural separator',(x,H/2,4.5),(.055,H-.08,.075),m['graphite'],u,.017)
        for x in [-2.27,2.27]:
            box('Machined mounting ear',(x,H/2,4.53),(.18,H*.86,.10),m['shell'],u,.025)
            cylinder('Captive front fastener',(x,H/2,4.59),.048,.017,m['bright'],u,'z')
            for y in [.08,.34]:box('Handle standoff',(x,y,4.65),(.05,.045,.13),m['bright'],u,.015)
            box('Recessed pull handle',(x,H/2,4.735),(.065,.28,.065),m['graphite'],u,.027)
        for bx in [-1.1,1.1]:
            for z,s in [(1.75,.66),(.2,.9),(-1.55,.9)]:
                box('Copper contact plate',(bx,.68,z),(s,.08,s),m['copper'],u,.026)
                box('Cold plate pressure seal',(bx,.727,z),(s*.9,.016,s*.9),m['dark'],u,.025)
                box('Milled nickel cold plate lid',(bx,.75,z),(s*.82,.06,s*.82),m['shell'],u,.027)
                for sx in [-1,1]:
                    for sz in [-1,1]:screw((bx+sx*s*.31,.786,z+sz*s*.31),.029,m,u)
                for k in range(5):box('Milled lid identification',(bx-.11+k*.047,.7808,z+.18*s),(.018,.0012,.07),m['etch'],u,.0003)
                # Fine lid ribs reinforce a manufactured surface, not coolant paths.
                for sz in [-1,1]:box('Lid milled shoulder',(bx,.776,z+sz*s*.24),(s*.39,.015,.018),m['bright'],u,.005)
    else:
        for x in [-2.2,2.2]:
            for z in [-4.2,-2.1,0,2.1,4.2]:
                box('Folded service edge',(x,.035,z),(.1,.045,.52),m['bright'],u,.015)
                screw((x,.065,z),.032,m,u)
    # Actual manufactured heat-sink fins over existing NIC footprints (not new NICs).
    if accel!='h100':
        for x in [.2,.7,1.2,1.7]:
            for j in range(7):box('NIC precision fin',(x-.126+j*.042,.40,3.3),(.015,.11,.47),m['shell'],u,.004)

def rubin_hardware(m):
    # NVIDIA public Figure18: independent compute/rear and networking/front bays.
    # Exact mechanical dimensions and channel routing remain representative.
    u=.1
    for x in [-2.16,2.16]:
        box('Rubin continuous titanium runner',(x,.40,0),(.10,.10,8.85),m['shell'],u,.025)
        for z in [-4.1,-2.7,-1.1,1.1,2.8,4.1]:screw((x,.46,z),.028,m,u)
    for x in [-1.1,1.1]:
        for sx in [-1,1]:
            box('Superchip independent service rail',(x+sx*.99,.12,-1.52),(.035,.08,4.88),m['bright'],u,.008)
        box('Superchip latch relief',(x,.14,.87),(.35,.055,.14),m['dark'],u,.014)
        box('Superchip captive lever',(x,.18,.87),(.24,.035,.11),m['shell'],u,.01)
    box('Midplane service bridge',(0,.40,1.10),(4.1,.075,.24),m['graphite'],u,.024)
    for x in [-1.6,-1.04,1.04,1.6]:
        # Contacts below the bridge, with empty passage above for schematic lanes.
        for i in range(6):box('Midplane gold land',(x-.11+i*.044,.36,1.235),(.022,.022,.012),m['copper'],u,.003)
    for x,w in [(-1.35,1.35),(0,.85),(1.35,1.35)]:
        for sx in [-1,1]:box('Independent IO cartridge rail',(x+sx*w*.5,.20,2.85),(.03,.12,2.12),m['shell'],u,.008)
        box('IO cartridge latch',(x,.26,1.82),(.26,.08,.15),m['graphite'],u,.02)
    for x in [-1.66,-1.04,1.04,1.66]:
        for y in [.16,.34]:
            for sx in [-1,1]:box('Rubin optical cage cheek',(x+sx*.147,y,4.235),(.018,.13,.44),m['bright'],u,.005)
            for sy in [-1,1]:box('Rubin optical cage lip',(x,y+sy*.064,4.46),(.29,.018,.028),m['bright'],u,.005)
    # Split front handles and broad unvented service fascia, matching the fanless bay.
    box('Rubin front fascia',(0,.07,4.50),(4.36,.09,.065),m['shell'],u,.018)
    box('Rubin upper bezel',(0,.455,4.50),(4.36,.065,.065),m['shell'],u,.018)
    for x in [-.65,.65]:
        for sx in [-1,1]:box('Rubin handle standoff',(x+sx*.43,.07,4.63),(.08,.09,.20),m['shell'],u,.024)
        box('Rubin broad service pull',(x,.07,4.75),(.88,.09,.075),m['graphite'],u,.035)
    # Fine pressure seals and machining on the exact nine native cold-plate footprints.
    plates=[(x,-2.7,.88,1.0) for x in [-1.6,-.62,.62,1.6]]+[(x,-.65,.80,.85) for x in [-1.1,1.1]]+[(x,2.85,1.08,1.65) for x in [-1.35,1.35]]+[(0,2.85,.76,1.65)]
    for x,z,w,d in plates:
        for sx in [-1,1]:box('Rubin plate machined rail',(x+sx*w*.38,.747,z),(.045,.015,d*.78),m['bright'],u,.006)
        for sz in [-1,1]:box('Rubin plate seal',(x,.695,z+sz*d*.485),(w*.94,.026,.015),m['dark'],u,.003)
        for i in range(5):box('Rubin plate service etch',(x-.12+i*.055,.739,z+.15),(.018,.001,.075),m['etch'],u,.0002)

def rack_hardware(accel,m):
    u=1
    # Contoured external stiles and repeating vent relief: no extra chassis or port.
    for x in [-.289,.289]:
        box('Extruded cabinet stile',(x,1.15,.526),(.016,2.12,.04),m['graphite'],u,.005)
        box('Stile polished inner edge',(x,1.15,.548),(.004,2.10,.008),m['bright'],u,.002)
    box('Cast cabinet base',(0,.042,0),(.62,.055,1.09),m['graphite'],u,.014)
    box('Precision top cap',(0,2.258,0),(.598,.022,1.06),m['shell'],u,.007)
    if accel!='h100':
        for i in range(34):
            if i in [15,24]:continue
            y=.12+i*.04445+.022225
            for x in [-.205,.185]:
                box('Folded service handle',(x,y,.485),(.009,.026,.013),m['bright'],u,.003)
            for k in range(0 if accel=='rubin' else 17):box('Vent grille relief',(-.186+k*.0075,y,.469),(.002,.019,.005),m['graphite'],u,0)

def chip_hardware(accel,m):
    u=.01
    # Precision package stiffener shoulders and substrate registration marks.
    for side in [-1,1]:
        box('Stiffener machined shoulder',(0,1.415,side*4.065),(8.14,.026,.055),m['bright'],u,.009)
        box('Stiffener machined shoulder',(side*4.065,1.415,0),(.055,.026,8.03),m['bright'],u,.009)
    for x in [-3.77,3.77]:
        for z in [-3.77,3.77]:
            cylinder('Substrate registration pad',(x,1.237,z),.065,.004,m['copper'],u)
            cylinder('Registration pad opening',(x,1.24,z),.035,.002,m['dark'],u)
    # A chamfered plate outline supplements the teaching x-ray heat-spreader.
    for side in [-1,1]:
        box('IHS machined perimeter',(0,4.79,side*3.47),(7.16,.035,.055),m['shell'],u,.015)
        box('IHS machined perimeter',(side*3.57,4.79,0),(.055,.035,6.92),m['shell'],u,.015)

def export_variant(kind,accel):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(HERE/'references'/f'{kind}-{accel}.glb'))
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and o.data.users>1:o.data=o.data.copy()
    # Imported parent scale is already meters; applying it makes bevel radius real.
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    # GLTF instancing expands solder balls into hundreds of Blender objects.
    # Batch those reference instances before modifier evaluation; geometry and
    # world positions remain unchanged, avoiding quadratic scene-graph work.
    imported_batches={}
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH':imported_batches.setdefault(tuple(m.name for m in o.data.materials),[]).append(o)
    for objects in imported_batches.values():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
    refine_reference(kind,accel)
    m={
      'shell':material('Authored satin nickel',(.48,.56,.62),.76,.4),
      'bright':material('Machined precision edge',(.66,.72,.76),.82,.3),
      'graphite':material('Fine graphite anodizing',(.055,.075,.095),.5,.42),
      'dark':material('Recessed mechanical separation',(.008,.014,.02),.15,.58),
      'copper':material('Copper contact surface',(.48,.23,.105),.82,.38),
      'etch':material('Laser etched service mark',(.13,.18,.21),.5,.5),
    }
    {'tray':tray_hardware,'rack':rack_hardware,'chip':chip_hardware}[kind](accel,m)
    spec=importlib.util.spec_from_file_location('compute_hero',HERE/'compute-hero-detail.py')
    hero=importlib.util.module_from_spec(spec);spec.loader.exec_module(hero)
    hero.enhance(kind,accel,m,box,cylinder,p3,material)
    root=bpy.data.objects.new('IFX_BLENDER_COMPUTE',None);bpy.context.collection.objects.link(root)
    root['ifxCompute']=json.dumps({'scene':kind,'accel':accel,'units':'m','fullStaticHardware':True,'basis':'Representative authored mechanics; technical layout and overlays retained.'})
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/f'compute-{kind}-{accel}.blend'))
    # Editable .blend keeps separate parts. Runtime GLB batches matching material
    # groups after modifiers to avoid one draw call per screw or milled rib.
    bpy.ops.object.select_all(action='DESELECT')
    authored_meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for o in authored_meshes:o.select_set(True)
    bpy.context.view_layer.objects.active=authored_meshes[0]
    bpy.ops.object.convert(target='MESH')
    batches={}
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':continue
        key=tuple(m.name for m in o.data.materials)
        batches.setdefault(key,[]).append(o)
    for key,objects in batches.items():
        if len(objects)<2:continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
        bpy.context.object.name='Blender hardware '+key[0]
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'compute-{kind}-{accel}.glb'),export_format='GLB',export_yup=True,export_extras=True,export_apply=True,export_cameras=False,export_lights=False)
    print('COMPUTE_EXPORTED',kind,accel,(OUT/f'compute-{kind}-{accel}.glb').stat().st_size)

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for kind in ['tray','rack','chip']:
    if args and kind not in args:continue
    variants=['gb200','gb300','rubin','h100']
    for accel in variants:
        if any(a in ['gb200','gb300','rubin','h100'] for a in args) and accel not in args:continue
        export_variant(kind,accel)

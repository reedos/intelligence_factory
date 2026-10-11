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
# The tray's front/rear interface, the OSFP cage envelope and the rack's tray rows, written by export-native-reference.mjs
# from the constants tray.js / tray-rubin.js / osfp-size.js / nvl72-layout.js build the scenes from (tray units, 10 cm).
LAY=json.loads((HERE/'references'/'rack-tray-layout.json').read_text())
OS=LAY['osfp']
OUT=ROOT/'public'/'models'; OUT.mkdir(parents=True,exist_ok=True)

def material(name,color,metal=.7,rough=.38):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough
    return m

def p3(p,u):return (p[0]*u,-p[2]*u,p[1]*u)

def edge_segments(width):
    # Round-edge segments by the radius in metres: a sub-2 mm radius is a pixel or two at every camera that sees it (rack
    # latches at 2 m, tray screws at 10-30 cm), so one chamfer catches the same highlight; three only on 5 mm and up.
    return 1 if width<.002 else 2 if width<.005 else 3

def box(name,p,d,m,u,bevel=.012):
    x,y,z=d[0]*u/2,d[2]*u/2,d[1]*u/2
    verts=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.location=p3(p,u)
    o.data.materials.append(m)
    if bevel:
        w=min(bevel,min(d)*.38)*u;mod=o.modifiers.new('Precision edge radius','BEVEL');mod.width=w;mod.segments=edge_segments(w)
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
    w=min(r*.12,h*.2)*u;mod=o.modifiers.new('Turned edge','BEVEL');mod.width=w;mod.segments=1 if w<.001 else 2
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

def decimate(o,tris,target):
    # Planar dissolve first (straight runs carry most of a swept tube's rings), then collapse to the target share.
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Planar run dissolve','DECIMATE');mod.decimate_type='DISSOLVE';mod.angle_limit=math.radians(4)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.calc_loop_triangles();after=len(o.data.loop_triangles)
    if after>tris*target:
        mod=o.modifiers.new('Viewing distance collapse','DECIMATE');mod.decimate_type='COLLAPSE';mod.ratio=tris*target/after
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.calc_loop_triangles();print('DECIMATED',o.name,tris,'->',len(o.data.loop_triangles))

HERO_BEVEL={'tray':.0006,'chip':.0002}

def split_hero_parts(kind,accel):
    # The parts the close-up cameras fill (d4-gpu at 77 px/cm, d5-dies at 117 px/cm): the GPU package (substrate, interposer,
    # dies, HBM stacks, stiffener and lid), and at the tray the Grace/Vera package and the GPU and CPU cold plates over them.
    # Each such disconnected part moves to an object of its own, tagged ifxHero, so refine_reference gives it a radius that
    # catches light at that range. Same faces, materials and positions; the export joins them back by material.
    pkg=json.loads((HERE/'references'/'gpu-package.json').read_text()).get(accel)
    if not pkg:return
    cm=.01;feet=[(pkg['substrate']['w'],pkg['substrate']['d']),(pkg['interposer']['w'],pkg['interposer']['d']),
        (pkg['dies'][0]['w'],pkg['dies'][0]['d']),(pkg['hbm']['w'],pkg['hbm']['d']),(pkg['stiffener']['w'],pkg['stiffener']['d']),(pkg['lid']['w'],pkg['lid']['d'])]
    def near(a,b,t=.0006):return abs(a-b)<t
    def foot(sx,sy,w,d):return (near(sx,w*cm) and near(sy,d*cm)) or (near(sx,d*cm) and near(sy,w*cm))
    # Cold plates (tray units, references/rack-tray-layout.json): the GPU and CPU plates and every package part under one
    # that is at least half the plate's footprint (the Grace package and its lid ring, the plate base, recess and cap).
    plates=[]
    if kind=='tray':
        src=LAY['rubin']['plates'] if accel=='rubin' else LAY['nvl']['plates'] if accel!='h100' else []
        plates=[(p['x']*.1,-p['z']*.1,p['w']*.1,p['d']*.1) for p in src if p['kind'] in ['gpu','cpu']]
    def opaque(m):
        q=m and m.use_nodes and m.node_tree.nodes.get('Principled BSDF')
        return not q or (not q.inputs['Alpha'].is_linked and q.inputs['Alpha'].default_value>=1)
    def hero(lo,hi,mats):
        sx,sy,sz=(hi[i]-lo[i] for i in range(3))
        if not(.0005<=sz<.009) or not all(opaque(m) for m in mats):return False
        if sz<.006 and any(foot(sx,sy,w,d) for w,d in feet):return True
        cx,cy=(lo[0]+hi[0])/2,(lo[1]+hi[1])/2
        return any(abs(cx-x)<w/2 and abs(cy-y)<d/2 and w*.5<=sx<=w*1.02 and d*.5<=sy<=d*1.02 for x,y,w,d in plates)
    split=0
    for o in [o for o in bpy.context.scene.objects if o.type=='MESH']:
        bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-7);mw=o.matrix_world
        seen=set();keep=set()
        for s in bm.verts:
            if s in seen:continue
            g={s};st=[s]
            while st:
                v=st.pop()
                for e in v.link_edges:
                    w=e.other_vert(v)
                    if w not in g:g.add(w);st.append(w)
            seen|=g;ps=[mw@v.co for v in g]
            faces={f for v in g for f in v.link_faces}
            mats=[o.data.materials[f.material_index] for f in faces if f.material_index<len(o.data.materials)]
            if faces and hero([min(q[i] for q in ps) for i in range(3)],[max(q[i] for q in ps) for i in range(3)],mats):keep|=faces;split+=1
        if not keep:bm.free();continue
        if len(keep)==len(bm.faces):bm.to_mesh(o.data);bm.free();o['ifxHero']=1;continue
        bm.faces.index_update();rest=[f for f in bm.faces if f not in keep]
        part=bm.copy();part.faces.ensure_lookup_table();bm.faces.ensure_lookup_table()
        bmesh.ops.delete(part,geom=[part.faces[f.index] for f in rest],context='FACES')
        bmesh.ops.delete(bm,geom=list(keep),context='FACES')
        me=o.data.copy();part.to_mesh(me);part.free();bm.to_mesh(o.data);bm.free()
        h=o.copy();h.data=me;h['ifxHero']=1
        for c in o.users_collection:c.objects.link(h)
    print('HERO_PARTS',kind,accel,split)

def refine_reference(kind,accel):
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':continue
        if kind=='rack':
            # The old adjacent context rack hid the hero cabinet's side cover.
            # Remove only that disconnected decorative enclosure; the single
            # inspected rack and every functional component stay untouched.
            # Also drop the hall floor's tile seams (16 m strips at floor level, merged into the dark-steel batch): they are
            # room dressing, not rack hardware, and stretched the rack's bounds to the whole floor. The single floor plane
            # (a 2-triangle mesh of its own) stays: compute-blender.js removes rack.js's native floor in its favor.
            floor_plane=len(o.data.polygons)<=2
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
                elif not floor_plane and hi[2]<.012 and max(hi[0]-lo[0],hi[1]-lo[1])>1.5:remove.extend(group)
            if remove:bmesh.ops.delete(bm,geom=remove,context='VERTS')
            bm.to_mesh(o.data);bm.free()
        if kind=='tray' and accel in ['gb200','gb300']:remove_tray_mechanics(o)
        if len(o.data.vertices)==0:bpy.data.objects.remove(o,do_unlink=True);continue
    if kind in ['tray','chip']:split_hero_parts(kind,accel)
    for o in list(bpy.context.scene.objects):
        if o.type!='MESH':continue
        # Weld reference face splits, then add genuine manufacturing edge radii.
        # Curved cables and spheres keep their existing shape; bevel only sharp edges.
        bm=bmesh.new();bm.from_mesh(o.data)
        # Racks weld at 10 um so coplanar seams of the native boxes join (cleaner cabinet shading, fewer vertices).
        bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-5 if kind=='rack' else 1e-7)
        tris=sum(len(f.verts)-2 for f in bm.faces)
        if o.get('ifxHero'):
            # Hero parts: a 0.6 mm (tray) or 0.2 mm (chip) two-segment radius, 4-5 px of edge highlight at the close-up
            # cameras, over smooth shading; the weighted normals keep the broad faces flat.
            for e in bm.edges:e.smooth=True
            for f in bm.faces:f.smooth=True
            bm.to_mesh(o.data);bm.free()
            mod=o.modifiers.new('Blender manufactured edge finish','BEVEL');mod.width=HERO_BEVEL[kind]
            mod.segments=2;mod.limit_method='ANGLE';mod.angle_limit=.65;mod.use_clamp_overlap=True
            o.modifiers.new('Precision surface normals','WEIGHTED_NORMAL').keep_sharp=True
            continue
        if kind=='rack' or (kind=='tray' and tris>=3000):
            # Smooth by angle for the unbeveled meshes: box edges stay crisp, cable and hose sections shade round.
            for e in bm.edges:e.smooth=not(len(e.link_faces)==2 and e.calc_face_angle(0)>math.radians(30))
            for f in bm.faces:f.smooth=True
        bm.to_mesh(o.data);bm.free()
        # Rack references already have rounded enclosure/cable cross-sections.
        # Re-beveling those small repeated curves adds export weight without
        # a visible silhouette improvement at rack inspection distances.
        if kind=='rack':
            # The overhead and side optical patch bundle is the heaviest rack mesh (76-148k triangles) and is seen at
            # about 300 px: planar dissolve along the straight runs, then collapse to about 30% of the original.
            # The front handles and latches (300-triangle rounded parts, 23 mm, about 7 px at the rack camera; 48-53k triangles in
            # one mesh) collapse to about 40%.
            if tris>20000:decimate(o,tris,.3 if any(m and 'patch cable jacket' in m.name for m in o.data.materials) else .4)
            o.modifiers.new('Precision surface normals','WEIGHTED_NORMAL').keep_sharp=True
            continue
        # Dense repeated parts (heat-sink fins, pin rows, 1,000+ small boxes) gain nothing visible from a 0.2 mm radius
        # but grew about 9x under it (the H100 tray's fin stack: 5.7k to 51k triangles).
        if kind=='tray' and tris>=3000:
            o.modifiers.new('Precision surface normals','WEIGHTED_NORMAL').keep_sharp=True;continue
        # Swept twinax ribbons already have a rounded, lobed section, and 0402/0201
        # passives are a millimetre long: an angle bevel only folds sub-millimetre
        # slivers and triples their triangles.
        if any(m and (m.name.startswith('Twinax flyover jacket') or m.name.startswith('PCB passive')) for m in o.data.materials):
            o.modifiers.new('Precision surface normals','WEIGHTED_NORMAL');continue
        mod=o.modifiers.new('Blender manufactured edge finish','BEVEL')
        mod.width={'rack':.00035,'tray':.00022,'chip':.000025}[kind]
        # Everything but the hero parts (split_hero_parts): 0.22 mm (tray) and 25 um (chip), one chamfer segment.
        mod.segments=1;mod.limit_method='ANGLE';mod.angle_limit=.65;mod.use_clamp_overlap=True
        o.modifiers.new('Precision surface normals','WEIGHTED_NORMAL')

def tray_hardware(accel,m):
    if accel=='rubin':
        rubin_hardware(m)
        return
    u=.1;H=3.56 if accel=='h100' else .42
    if accel!='h100':
        box('Formed aluminum chassis',(0,.014,0),(4.4,.028,9),m['shell'],u,.007)
        for x in [-2.2,2.2]:
            box('Folded outer wall',(x,(H-.014)/2,0),(.038,H-.014,9),m['shell'],u,.014)
            box('Rolled upper return',(x,H-.012,0),(.095,.024,8.94),m['bright'],u,.01)
            box('Dark longitudinal reveal',(x+(.022 if x>0 else -.022),H*.6,0),(.006,.045,8.5),m['dark'],u,.002)
            for z in [-4.1,-2.8,-1.5,0,1.5,2.8,4.1]:screw((x,H+.005,z),.022,m,u)
        # Skeleton front bezel leaves original four optical cages and four drives
        # physically exposed. No fictional port texture or additional I/O count.
        for y in [.035,H-.025]:box('Bezel folded cross member',(0,y,4.5),(4.4,.055,.075),m['graphite'],u,.02)
        for x in LAY['nvl']['front'][accel]['bezelX']:box('Bezel structural separator',(x,H/2,4.5),(.055,H-.08,.075),m['graphite'],u,.017)
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
        h100_chassis_detail(m,u)
    # Actual manufactured heat-sink fins over existing NIC footprints (not new NICs).
    if accel!='h100':
        for x in LAY['nvl']['front'][accel]['cageX']:
            for j in range(7):box('NIC precision fin',(x-.126+j*.042,.40,3.3),(.015,.11,.47),m['shell'],u,.004)

def h100_chassis_detail(m,u):
    # DGX H100 (8U): detail on the large plain sheet-metal planes. Pressed
    # stiffening ribs, rack-rail fastener rows and a blank service-label field
    # on the intact far wall; no logos, part numbers or extra I/O.
    xi=-2.2+.015
    for y in [1.22,2.42]:box('Pressed wall stiffener rib',(xi+.008,y,0),(.018,.05,8.3),m['shell'],u,.022)
    for y in [.2,3.3]:
        for i in range(17):box('Rack rail fastener hole',(xi+.0015,y,-4.0+i*.5),(.004,.045,.07),m['dark'],u,0)
    box('Service label field',(xi+.0025,1.82,2.9),(.004,.42,.95),m['etch'],u,.004)
    for k in range(4):box('Service label rule',(xi+.002,1.72+k*.07,2.9),(.008,.012,.8),m['graphite'],u,0)   # proud of the label field by 0.15 mm and sunk 0.25 mm behind it into the wall: clear of the depth buffer at the rack's distance
    # Six rear power supplies across the bottom (6 x 3.3 kW, NVIDIA DGX H100 user
    # guide rear figure): perforated exhaust beside the C20 inlet, a pull handle
    # along the bottom edge and a release latch at the right.
    ZB=-4.5
    for i in range(6):
        px=-1.825+i*.73
        for r in range(4):
            for c in range(4):box('PSU grille perforation',(px+.06+c*.07,.12+r*.075,ZB-.004),(.045,.045,.006),m['dark'],u,0)
        for sy in [-1,1]:box('PSU inlet frame',(px-.15,.27+sy*.092,ZB-.03),(.22,.016,.02),m['graphite'],u,.004)
        for sx in [-1,1]:box('PSU inlet frame',(px-.15+sx*.102,.27,ZB-.03),(.016,.2,.02),m['graphite'],u,.004)
        for sx in [-1,1]:box('PSU handle standoff',(px+sx*.25,.07,ZB-.04),(.04,.04,.08),m['graphite'],u,.01)
        box('PSU pull handle',(px,.07,ZB-.085),(.54,.035,.035),m['graphite'],u,.014)
        box('PSU release latch',(px+.315,.24,ZB-.02),(.04,.12,.03),m['bright'],u,.008)
    # Folded mouths on the four OSFP cages in the motherboard tray; apertures stay open.
    cy=LAY['h100']['cageY']
    for x in LAY['h100']['cageX']:
        for sy in [-1,1]:box('OSFP cage folded mouth',(x,cy+sy*(OS['cageH']/2+.007),ZB-.005),(.25,.014,.03),m['bright'],u,.005)
        for sx in [-1,1]:box('OSFP cage folded mouth',(x+sx*(OS['cageW']/2+.0065),cy,ZB-.005),(.013,OS['cageH'],.03),m['bright'],u,.005)
    # Rear service hardware: the GPU tray's two captive thumbscrews (center, low)
    # and the motherboard tray's ejection levers on both sides, which engage the
    # midplane connectors (service manual). Shapes are representative.
    for x in [-.09,.09]:
        cylinder('GPU tray captive thumbscrew',(x,1.62,ZB-.03),.045,.05,m['bright'],u,'z')
        box('Thumbscrew drive slot',(x,1.62,ZB-.058),(.05,.008,.006),m['dark'],u,0)
    for x in [-1.98,1.98]:
        box('Motherboard tray ejection lever',(x,.95,ZB-.04),(.12,.62,.04),m['graphite'],u,.015)
        cylinder('Lever captive screw',(x,1.2,ZB-.07),.03,.03,m['bright'],u,'z')
    # Riser card brackets: two screws each and a vent slot row between the ports.
    for sx in [-1,1]:
        for y in [.93,1.17]:
            for dx in [-.55,.55]:cylinder('Bracket screw',(sx*1.42+dx,y+.12,ZB-.0),.016,.02,m['bright'],u,'z')
            for k in range(8):box('Bracket vent slot',(sx*1.42+.2+k*.045,y+.08,ZB+.019),(.02,.1,.006),m['dark'],u,0)
    # U.2 drive carriers: release paddle and a ribbed front, on the eight native carriers.
    for x in [-1.68,-.88,.87,1.67]:
        for y in [.35,.185]:
            box('Drive carrier paddle',(x-.05,y,4.51),(.5,.08,.02),m['graphite'],u,.01)
            for k in range(6):box('Drive carrier vent rib',(x+.24+k*.02,y,4.506),(.008,.1,.012),m['dark'],u,0)
    # Front console board: two USB 3.1 ports, VGA, ambient sensor (user guide front figure).
    cylinder('Ambient temperature sensor window',(.02,.32,4.506),.02,.01,m['dark'],u,'z')

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
    RF=LAY['rubin']['front']
    for x in RF['cageX']:
        for y in RF['cageY']:
            for sx in [-1,1]:box('Rubin optical cage cheek',(x+sx*(OS['cageW']/2+.009),y,4.235),(.018,OS['cageH']-.018,.44),m['bright'],u,.005)
            for sy in [-1,1]:box('Rubin optical cage lip',(x,y+sy*(OS['cageH']/2-.005),4.46),(OS['cageW'],.018,.028),m['bright'],u,.005)
    # Split front handles and broad unvented service fascia, matching the fanless bay.
    box('Rubin front fascia',(0,.07,4.50),(4.36,.09,.065),m['shell'],u,.018)
    box('Rubin upper bezel',(0,.455,4.50),(4.36,.065,.065),m['shell'],u,.018)
    for x in [-.65,.65]:
        for sx in [-1,1]:box('Rubin handle standoff',(x+sx*.43,.07,4.63),(.08,.09,.20),m['shell'],u,.024)
        box('Rubin broad service pull',(x,.07,4.75),(.88,.09,.075),m['graphite'],u,.035)
    # Folded cage mouths and extraction bails on the eight native optical cages.
    for x in RF['cageX']:
        for y in RF['cageY']:
            for sy in [-1,1]:box('Rubin cage folded mouth',(x,y+sy*(OS['cageH']/2+.007),4.452),(OS['cageW']+.02,.014,.024),m['bright'],u,.006)
            for sx in [-1,1]:box('Rubin cage folded mouth',(x+sx*(OS['cageW']/2+.006),y,4.452),(.014,OS['innerH'],.024),m['bright'],u,.006)
            # The bail clears the seated module's nose (native, to z=4.566).
            arm=OS['w']/2+.0105
            for sx in [-1,1]:box('Rubin module bail arm',(x+sx*arm,y-.035,4.515),(.012,.012,.12),m['graphite'],u,.004)
            box('Rubin module bail',(x,y-.035,4.578),(2*arm+.012,.014,.012),m['graphite'],u,.005)
    # Machined bosses on the nine native cold-plate caps (cap top y=.729): a
    # raised inlet/outlet pair with an O-ring groove, plus a service etch.
    plates=[(x,-2.7,.88,1.0) for x in [-1.6,-.62,.62,1.6]]+[(x,-.65,.80,.85) for x in [-1.1,1.1]]+[(x,2.85,1.08,1.65) for x in [-1.35,1.35]]+[(0,2.85,.76,1.65)]
    for x,z,w,d in plates:
        for sz in [-1,1]:
            cylinder('Rubin plate coolant boss',(x,.743,z+sz*d*.3),.042,.028,m['shell'],u)
            cylinder('Rubin boss O-ring groove',(x,.7305,z+sz*d*.3),.05,.003,m['dark'],u)
        for i in range(5):box('Rubin plate service etch',(x-.12+i*.055,.7305,z+.12),(.018,.003,.075),m['etch'],u,.0002)   # stands 0.3 mm off the cap (.729), clear of the depth buffer at the rack's distance

def tray_specular_finish():
    # Tray cameras sit 10-30 cm from broad flat metal (chassis walls, runners,
    # cold-plate lids, IHS lids, connector shrouds). A directional key mirrored
    # in a smooth lid produced a highlight far above the bloom threshold and
    # washed labels to white. Satin (bead-blast / brushed) roughness spreads
    # that highlight; colors, shapes and positions are unchanged.
    seen=set()
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        for mat in o.data.materials:
            if not mat or mat.name in seen or not mat.use_nodes:continue
            seen.add(mat.name)
            p=mat.node_tree.nodes.get('Principled BSDF')
            if not p:continue
            metal,rough=p.inputs['Metallic'],p.inputs['Roughness']
            if metal.is_linked or rough.is_linked:continue
            if metal.default_value>=.5 and rough.default_value<.6:
                rough.default_value=.6+(rough.default_value-.2)*.15
                # Pale polished trim reads as a white line at 10 cm; keep it a
                # machined grey so it still catches light without clipping.
                c=p.inputs['Base Color']
                if not c.is_linked and sum(c.default_value[:3])/3>.6:
                    c.default_value=(*[v*.78 for v in c.default_value[:3]],1)
            elif metal.default_value>=.35 and rough.default_value<.45:
                rough.default_value=.45

def dedupe_materials(keep_names=False):
    # The reference import creates one material per native mesh ("Physical 10",
    # "Physical 10.001" ...), so identical surfaces never shared a batch. Map
    # every slot to one canonical material per visible look, then the export
    # join groups them: fewer draw calls, identical pixels.
    def key(mat):
        if not mat or not mat.use_nodes:return ('raw',mat.name if mat else '')
        p=mat.node_tree.nodes.get('Principled BSDF')
        if not p:return ('custom',mat.name)
        def val(name):
            i=p.inputs[name]
            if i.is_linked:
                n=i.links[0].from_node
                return ('tex',getattr(getattr(n,'image',None),'name',n.name))
            v=i.default_value
            return tuple(round(x,4) for x in v) if hasattr(v,'__len__') else round(v,4)
        # keep_names (racks): a named material ("Cable manager steel", "Inserted flat top OSFP shell") only merges with its
        # own .001 copies, never into a look-alike "Physical N": tools/tray-parts.mjs tells rack-owned parts by name.
        name=mat.name.split('.')[0]
        group=name if keep_names and not name.startswith('Physical') else ''
        return (val('Base Color'),val('Metallic'),val('Roughness'),val('Emission Color'),val('Emission Strength'),val('Alpha'),mat.blend_method,tuple(sorted(mat.keys())),group)
    canon={}
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        for slot in o.material_slots:
            if not slot.material:continue
            k=key(slot.material)
            canon.setdefault(k,slot.material)
            if canon[k]!=slot.material:slot.material=canon[k]

def lift_image(img,k):
    # Lift a dark face texture toward mid-grey: v' = 1-(1-v)^k on the stored (sRGB) values. Darks rise about k times,
    # highlights (LEDs, labels) barely move, so the drawing stays the same and only reads lighter.
    px=list(img.pixels)
    for i in range(len(px)):
        if i%4!=3:px[i]=1-(1-px[i])**k
    img.pixels[:]=px;img.pack()

def rack_front_finish(accel):
    # The NVL72 front reads as bands: power shelves lightest, compute trays mid, NVLink switch trays darkest (plus the
    # blanking panels, which read as a black slab over the upper front). The faces are rack.js's canvas drawings, lifted
    # per kind; each kind's instances import as one joined object, its lowest tray naming the kind (nvl72-layout.js).
    # The free units over the management switches (1U cable manager, then blanking panels: rack.js, ASSUMPTIONS
    # 'rack-elevation-fill') lift to the power shelves' light finish (#1b base to about the shelves' #3b-at-2.4), so the top
    # of the rack reads as a closed light band instead of a dark cavity. No PSU or device is drawn there.
    lift={'ps':2.4,'compute':1.8,'switch':1.35,'mgmt':1.35,'blank':5.5}
    RK=LAY['rack'];done=set()
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        for mat in o.data.materials:
            if not mat or not mat.use_nodes:continue
            p=mat.node_tree.nodes.get('Principled BSDF');bc=p and p.inputs['Base Color']
            if not bc or not bc.is_linked:continue
            img=getattr(bc.links[0].from_node,'image',None)
            if not img or img.name in done:continue
            k=None
            if mat.name.startswith('Snap-in blanking panel') or mat.name.startswith('Brush-strip cable manager'):k=lift['blank']
            elif accel!='h100' and len(o.data.materials)>=6 and abs((max(v.co.x for v in o.data.vertices)-min(v.co.x for v in o.data.vertices))-.44)<.002:
                zmin=min((o.matrix_world@v.co).z for v in o.data.vertices)
                row=int((zmin-RK['base'])/RK['pitch']+.5)
                if 0<=row<len(RK['layout']):k=lift.get(RK['layout'][row])
            if k:lift_image(img,k);done.add(img.name)
    # Near-black cabinet and tray-side finishes (0.04-0.09 albedo) melted into the dark stage: lift them to about 0.15,
    # keeping their hue. Cables, hoses and named parts keep their colors.
    seen=set()
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        for mat in o.data.materials:
            if not mat or mat.name in seen or not mat.use_nodes or not mat.name.startswith('Physical'):continue
            seen.add(mat.name);p=mat.node_tree.nodes.get('Principled BSDF')
            if not p or p.inputs['Base Color'].is_linked:continue
            c=p.inputs['Base Color'].default_value[:3]
            if .035<max(c)<.10 and min(c)>.03:
                s=.17/max(c);p.inputs['Base Color'].default_value=(*[v*s for v in c],1);mat.diffuse_color=(*[v*s for v in c],1)
    # The NVLink spine's copper cartridges on the rear (rack.js) were 0.02-albedo sheet steel, invisible under the data view's
    # glow: the same lift to graphite, so the four cartridges read as hardware behind it.
    for mat in bpy.data.materials:
        if mat.name.startswith('NVLink cartridge sheet steel') and mat.use_nodes:
            p=mat.node_tree.nodes.get('Principled BSDF');c=p.inputs['Base Color'].default_value[:3];s=.15/max(c)
            p.inputs['Base Color'].default_value=(*[v*s for v in c],1);mat.diffuse_color=(*[v*s for v in c],1)

def tray_package_finish(accel):
    # The tray's GPU packages in the chip level's finishes (chip.js, compute-chip-*.glb), so the tray close-up and level 6
    # draw one part: blue-grey polished silicon dies with a near-black sidewall, the organic CoWoS-L interposer near-black
    # (it read as a light frame around dark, recessed-looking dies), and each HBM stack a dark molded top over the lighter
    # DRAM die edges, so the eight stacks stand apart from the interposer instead of reading as black blocks. Faces are
    # reassigned by footprint (references/gpu-package.json, the descriptor both levels build from); no geometry changes.
    pkg=json.loads((HERE/'references'/'gpu-package.json').read_text()).get(accel)
    if not pkg:return
    cm=.01;die=pkg['dies'][0];ip=pkg['interposer'];hb=pkg['hbm']
    top=material('GPU die silicon backside',(.0685,.0844,.1221),.35,.3)
    p=top.node_tree.nodes.get('Principled BSDF')
    p.inputs['Coat Weight'].default_value=1;p.inputs['Coat Roughness'].default_value=.06
    p.inputs['Emission Color'].default_value=(.159,.686,1,1);p.inputs['Emission Strength'].default_value=.08   # level 6's resting power glow
    finish={'die_top':top,'die_side':material('GPU die sidewall',(.0103,.0123,.0176),.3,.4),
            'interposer':material('CoWoS-L organic redistribution interposer',(.0116,.0103,.0103),.1,.5),
            'hbm_top':material('HBM molded top',(.035,.038,.045),.05,.5),'hbm_side':material('HBM DRAM die edge',(.0999,.1195,.15),.35,.3),
            # The substrate's top is the chip level's solder mask (chip.js 'Substrate solder mask', #0f2420 under its via and
            # trace canvas, which compute-blender.js paints on at runtime); its laminate sides keep the board black.
            'substrate_top':material('GPU package substrate solder mask',(.0048,.0176,.0144),.05,.45)}
    def near(a,b,t=.0006):return abs(a-b)<t
    def foot(sx,sy,w,d):return (near(sx,w*cm) and near(sy,d*cm)) or (near(sx,d*cm) and near(sy,w*cm))
    def dark(o,f):
        m=o.data.materials[f.material_index] if f.material_index<len(o.data.materials) else None
        q=m and m.use_nodes and m.node_tree.nodes.get('Principled BSDF')
        return bool(q) and not q.inputs['Base Color'].is_linked and max(q.inputs['Base Color'].default_value[:3])<.06
    count={}
    for o in bpy.context.scene.objects:
        if o.type!='MESH' or not o.data.materials:continue
        bm=bmesh.new();bm.from_mesh(o.data);mw=o.matrix_world;rot=mw.to_3x3();seen=set();assign=[]
        for s in bm.verts:
            if s in seen:continue
            g={s};st=[s]
            while st:
                v=st.pop()
                for e in v.link_edges:
                    w=e.other_vert(v)
                    if w not in g:g.add(w);st.append(w)
            seen|=g;ps=[mw@v.co for v in g]
            sx,sy,sz=(max(q[i] for q in ps)-min(q[i] for q in ps) for i in range(3))
            faces={f for v in g for f in v.link_faces}
            if foot(sx,sy,die['w'],die['d']) and sz<.0025:kind='die'   # the die body and its printed top skin
            elif pkg['id']!='h100' and foot(sx,sy,ip['w'],ip['d']) and sz<.003:kind='interposer'
            elif foot(sx,sy,hb['w'],hb['d']) and .002<sz<.006 and all(dark(o,f) for f in faces):kind='hbm'   # not the H100's blank silicon spacer
            elif foot(sx,sy,pkg['substrate']['w'],pkg['substrate']['d']) and .002<sz<.006:kind='substrate'
            else:continue
            count[kind]=count.get(kind,0)+1
            for f in faces:
                up=(rot@f.normal).normalized().z>.9
                if kind=='substrate' and not up:continue
                assign.append((f.index,finish[kind if kind=='interposer' else kind+('_top' if up else '_side')]))
        bm.free()
        for i,m in assign:
            slots=list(o.data.materials)
            if m not in slots:o.data.materials.append(m);slots.append(m)
            o.data.polygons[i].material_index=slots.index(m)
    print('TRAY_PACKAGE_FINISH',accel,count)

def rack_hardware(accel,m):
    u=1
    # Rack scale only: satin nickel faces up at the studio softbox and bloomed
    # to white on the pulled trays. A duller satin keeps the parts readable.
    for key,rough,color in [('shell',.56,(.36,.42,.47)),('bright',.42,(.55,.6,.64))]:
        p=m[key].node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=rough
        p.inputs['Base Color'].default_value=(*color,1);m[key].diffuse_color=(*color,1)
    # The cabinet's graphite (0.055-0.095 albedo) melted into the dark stage; about 0.15 keeps it graphite but legible.
    m['graphite'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.13,.15,.17,1);m['graphite'].diffuse_color=(.13,.15,.17,1)
    # Contoured external stiles and repeating vent relief: no extra chassis or port.
    for x in [-.289,.289]:
        box('Extruded cabinet stile',(x,1.15,.526),(.016,2.12,.04),m['graphite'],u,.005)
        box('Stile polished inner edge',(x,1.15,.548),(.004,2.10,.008),m['bright'],u,.002)
    box('Cast cabinet base',(0,.042,0),(.62,.055,1.09),m['graphite'],u,.014)
    box('Black powder-coat top cap',(0,2.258,0),(.598,.022,1.06),m['graphite'],u,.007)
    if accel!='h100':
        # rows follow src/scenes/nvl72-layout.js (references/rack-tray-layout.json): ps 0-3, compute 4-11, switch 12-20, compute 21-30, ps 31-34, mgmt 35-36
        RK=LAY['rack']
        for i in range(35):
            if i in [RK['switchPulled'],RK['pulled']]:continue  # pulled trays; the management switches (35, 36) have no tray handles
            # the switch trays already have their gold bent pull handles (rack.js serviceFace), at nearly the same x: a second
            # folded handle on top of one shared its -x face with it (the coplanar gate's long-standing REFERENCE_rack-gb200_0037)
            if RK['layout'][i]=='switch':continue
            y=RK['base']+i*RK['pitch']+RK['pitch']/2
            for x in [-.205,.185]:
                box('Folded service handle',(x,y,.485),(.009,.026,.013),m['bright'],u,.003)

def rounded_rect(half,r,n=6,half_d=None):
    # Counter-clockwise outline of a rectangle with radiused corners (half-width, radius in native units; half_d is the half-depth, the half-width again for a square).
    pts=[];hd=half if half_d is None else half_d
    for cx,cz,a0 in [(half-r,hd-r,0),(-(half-r),hd-r,90),(-(half-r),-(hd-r),180),(half-r,-(hd-r),270)]:
        for i in range(n+1):
            a=math.radians(a0+90*i/n);pts.append((cx+r*math.cos(a),cz+r*math.sin(a)))
    return pts

def stiffener_ring(name,y,outer,band,thick,r_out,r_in,mat,u,outer_d=None):
    # One continuous ring: radiused outer and inner corners, flat top, bonded to
    # the substrate. Built as a single watertight mesh, not butt-jointed rails.
    od=outer if outer_d is None else outer_d
    o_pts=rounded_rect(outer/2,r_out,half_d=od/2);i_pts=rounded_rect(outer/2-band,r_in,half_d=od/2-band)
    n=len(o_pts);verts=[]
    for yy in [y,y+thick]:
        for x,z in o_pts:verts.append(p3((x,yy,z),u))
        for x,z in i_pts:verts.append(p3((x,yy,z),u))
    ob,ib,ot,it=0,n,2*n,3*n;faces=[]
    for k in range(n):
        j=(k+1)%n
        faces.append((ot+k,ot+j,it+j,it+k))      # top
        faces.append((ob+k,ib+k,ib+j,ob+j))      # bottom
        faces.append((ob+k,ob+j,ot+j,ot+k))      # outer wall
        faces.append((ib+k,it+k,it+j,ib+j))      # inner wall
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
    mod=o.modifiers.new('Top edge chamfer','BEVEL');mod.width=.015*u;mod.segments=2;mod.limit_method='ANGLE';mod.angle_limit=math.radians(60)
    mod=o.modifiers.new('Face weighted normals','WEIGHTED_NORMAL');mod.keep_sharp=True
    for f in o.data.polygons:f.use_smooth=True
    return o

def chip_hardware(accel,m):
    u=.01
    # One flat nickel-plated steel stiffener ring bonded to the substrate top,
    # the usual lidless large flip-chip arrangement; the laminate edge stays
    # exposed. Ring width, thickness and radii are representative.
    # Ring and fiducial sizes come from the one GPU package descriptor (src/scenes/gpu-package.js, written to
    # references/gpu-package.json by export-native-reference.mjs), the same numbers chip.js and tray.js build from.
    pkg=json.loads((HERE/'references'/'gpu-package.json').read_text())[accel]
    st=pkg['stiffener']
    ring=material('Nickel plated steel stiffener',(.62,.66,.70),.9,.34)
    stiffener_ring('Package stiffener ring',1.235,st['w'],st['band'],.07,.1,.2,ring,u,outer_d=st['d'])
    # Copper fiducials sit inside the ring opening, clear of the capacitor rows.
    fx,fz=pkg['fiducial']
    for x in [-fx,fx]:
        for z in [-fz,fz]:
            cylinder('Substrate registration pad',(x,1.237,z),.065,.004,m['copper'],u)
            cylinder('Registration pad opening',(x,1.24,z),.035,.002,m['dark'],u)
    # The heat layer's heat spreader (or, on H100, heat sink base) is authored natively in chip.js.

def dedupe_reference_materials():
    # The reference export clones every material per mesh (Physical N, .001 ...).
    # Each clone carries the index of the native material it came from; share
    # one Blender material per source so identical surfaces batch together.
    canon={}
    for o in bpy.context.scene.objects:
        if o.type!='MESH':continue
        for slot in o.material_slots:
            m=slot.material
            if m is None or m.get('ifxSourceMaterial') is None:continue
            key=int(m['ifxSourceMaterial'])
            if key not in canon:canon[key]=m
            elif canon[key] is not m:slot.material=canon[key]
    for m in list(bpy.data.materials):
        if m.users==0:bpy.data.materials.remove(m)

def separate_coplanar(kind):
    # Same-facing coplanar faces of two different parts z-fight (a connector's base flush with its board's underside, a
    # duplicated boot, a trace flush with the mask). Where one part's face overlaps a larger part's, in the same plane and
    # facing the same way, move the smaller part's face out along its normal: 0.05 mm at the tray and chip, 0.3 mm at the
    # rack's distance. Positions otherwise stay as audited; translucent surfaces are left alone.
    off={'rack':.0003,'tray':.00005,'chip':.00005}[kind]
    def opaque(m):
        q=m and m.use_nodes and m.node_tree.nodes.get('Principled BSDF')
        return not q or (not q.inputs['Alpha'].is_linked and q.inputs['Alpha'].default_value>=1)
    buckets={};meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    for oi,o in enumerate(meshes):
        me=o.data;mw=o.matrix_world;rot=mw.to_3x3();ok=[opaque(m) for m in me.materials] or [True]
        world=[mw@v.co for v in me.vertices]
        parent=list(range(len(me.vertices)))
        def find(a):
            while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
            return a
        for e in me.edges:
            a,b=find(e.vertices[0]),find(e.vertices[1])
            if a!=b:parent[b]=a
        for f in me.polygons:
            if not ok[min(f.material_index,len(ok)-1)]:continue
            n=(rot@f.normal).normalized();ax=next((i for i in range(3) if abs(n[i])>.9999),None)
            if ax is None:continue
            u,v=(ax+1)%3,(ax+2)%3;pts=[(world[i][u],world[i][v]) for i in f.vertices];plane=world[f.vertices[0]][ax]
            key=(ax,n[ax]>0,round(plane*1e5))
            buckets.setdefault(key,{}).setdefault((oi,find(f.vertices[0])),[]).append((f.index,pts,f.area))
    def inside(pt,poly,t=1e-5):
        # strictly inside a convex face, at least 10 um from its edges (parts that only touch along an edge stay put)
        sgn=0
        for i in range(len(poly)):
            (x0,y0),(x1,y1)=poly[i],poly[(i+1)%len(poly)]
            L=math.hypot(x1-x0,y1-y0)
            if L<1e-9:continue
            c=((x1-x0)*(pt[1]-y0)-(y1-y0)*(pt[0]-x0))/L
            if abs(c)<=t:return False
            if sgn==0:sgn=1 if c>0 else -1
            elif (c>0)!=(sgn>0):return False
        return True
    def box2(polys):
        xs=[x for _,p,_ in polys for x,_ in p];ys=[y for _,p,_ in polys for _,y in p];return min(xs),max(xs),min(ys),max(ys)
    move={}
    for (ax,pos,_),groups in buckets.items():
        if len(groups)<2:continue
        order=sorted(groups.items(),key=lambda kv:-sum(a for _,_,a in kv[1]));kept=[]
        for (oi,isl),faces in order:
            bx=box2(faces)
            for f,pts,_ in faces:
                cx=sum(x for x,_ in pts)/len(pts);cy=sum(y for _,y in pts)/len(pts)
                for kb,kfaces in kept:
                    if kb[0]>bx[1] or kb[1]<bx[0] or kb[2]>bx[3] or kb[3]<bx[2]:continue
                    if any(any(inside(q,kp) for q in pts+[(cx,cy)]) or any(inside(r,pts) for r in kp) for _,kp,_ in kfaces):
                        d=[0,0,0];d[ax]=off if pos else -off;move.setdefault(oi,{})[f]=d;break
            kept.append((bx,faces))
    moved=0
    for oi,faces in move.items():
        o=meshes[oi];inv=o.matrix_world.inverted().to_3x3();dv={}
        for fi,d in faces.items():
            for vi in o.data.polygons[fi].vertices:
                acc=dv.setdefault(vi,[0,0,0])
                for i in range(3):
                    if d[i]:acc[i]=d[i]
        for vi,d in dv.items():o.data.vertices[vi].co+=inv@Vector(d)
        moved+=len(faces)
    print('COPLANAR_SEPARATED',kind,moved,'faces')

def cull_covered_passive_faces(kind):
    # SMD passives are hundreds of small boxes (tray: 0402-class parts, about 21k triangles of terminations; chip: the
    # package's MLCCs). Each box's underside sits on its board and each termination's inner end sits against its body,
    # so a third of their faces can never be seen. Delete a face when a point 10 um outside it lies inside another solid
    # (the board, the substrate, the body). Nothing visible changes and no part moves.
    names={'tray':('PCB passive',),'chip':('MLCC',)}.get(kind)
    if not names:return
    from mathutils.bvhtree import BVHTree
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.polygons]
    def tree(o):
        mw=o.matrix_world;return BVHTree.FromPolygons([mw@v.co for v in o.data.vertices],[tuple(p.vertices) for p in o.data.polygons])
    trees={o:tree(o) for o in meshes}
    culled=0
    for o in meshes:
        if not any(m and m.name.startswith(names) for m in o.data.materials):continue
        others=[t for k,t in trees.items() if k is not o];mw=o.matrix_world;rot=mw.to_3x3()
        doomed=[]
        for f in o.data.polygons:
            n=(rot@f.normal).normalized();p=mw@f.center+n*1e-5
            for t in others:
                hit=t.find_nearest(p,5e-5)
                if hit[0] is not None and (p-hit[0]).dot(hit[1])<0:doomed.append(f.index);break
        if doomed:
            bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table()
            bmesh.ops.delete(bm,geom=[bm.faces[i] for i in doomed],context='FACES_ONLY');bm.to_mesh(o.data);bm.free()
            culled+=len(doomed)
    print('PASSIVE_FACES_CULLED',kind,culled)

def export_variant(kind,accel):
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(HERE/'references'/f'{kind}-{accel}.glb'))
    for o in list(bpy.context.scene.objects):
        if o.type=='MESH' and o.data.users>1:o.data=o.data.copy()
    # Imported parent scale is already meters; applying it makes bevel radius real.
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if kind=='chip':dedupe_reference_materials()
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
    if kind=='tray':tray_specular_finish();tray_package_finish(accel);dedupe_materials()
    if kind=='rack':
        spec=importlib.util.spec_from_file_location('rack_inspection',HERE/'rack-inspection-detail.py')
        inspection=importlib.util.module_from_spec(spec);spec.loader.exec_module(inspection)
        inspection.enhance(accel,m,box,cylinder,material)
        rack_front_finish(accel);dedupe_materials(keep_names=True)
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
    cull_covered_passive_faces(kind)
    separate_coplanar(kind)
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
    # Every exported node and mesh named after its material ('Blender hardware Copper contact surface'), not REFERENCE_*_00xx /
    # Mesh_N; nothing reads these names (src and tools/tray-parts.mjs go by material), they are for debugging and picking.
    for o in bpy.context.scene.objects:
        if o.type=='MESH' and o.data.materials and o.data.polygons:
            o.name='Blender hardware '+o.data.materials[o.data.polygons[0].material_index].name;o.data.name=o.name
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'compute-{kind}-{accel}.glb'),export_format='GLB',export_yup=True,export_extras=True,export_apply=True,export_cameras=False,export_lights=False)
    print('COMPUTE_EXPORTED',kind,accel,(OUT/f'compute-{kind}-{accel}.glb').stat().st_size)

args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
for kind in ['tray','rack','chip']:
    if args and kind not in args:continue
    variants=['gb200','gb300','rubin','h100']
    for accel in variants:
        if any(a in ['gb200','gb300','rubin','h100'] for a in args) and accel not in args:continue
        export_variant(kind,accel)

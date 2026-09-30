"""Representative CPO mechanics, aligned to the existing cm-scale technical diagram.
Run: blender --background --python tools/blender/build-cpo.py
(needs node/npx on PATH: the export is quantized with @gltf-transform/cli)
Reference: NVIDIA's public Quantum-X Photonics package imagery, not a production CAD model.
All static hardware is authored here. Runtime JS retains only animated signals,
labels, selection guides, and the reviewed path/anchor contract.
"""
import bpy, math, json, pathlib
from mathutils import Matrix, Vector

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
LAYOUT = json.loads((HERE / 'link-layout.json').read_text())
assert LAYOUT['units'] == 'cm' and len(LAYOUT['engines']) == 18
CM = .01
S = bpy.context.scene
for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
S.unit_settings.system = 'METRIC'
S.unit_settings.scale_length = 1

def material(name, color, metal=0, rough=.4, alpha=1):
    m = bpy.data.materials.new(name); m.use_nodes = True
    m.diffuse_color = (*color, alpha)
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = rough
    p.inputs['Alpha'].default_value = alpha
    if alpha < 1: m.surface_render_method = 'DITHERED'
    return m

# Materials named in UV_MATERIALS keep a 0-1 top-face UV; side-cpo-blender.js
# paints their face textures at runtime (no embedded images in the GLB).
UV_MATERIALS={'Electronic die face','Transmit ribbon','Receive ribbon','Switch ASIC silicon','Midnight laminate'}

nickel = material('Satin nickel retainers', (.5,.57,.62), .82,.29)
edge = material('Polished screw heads', (.68,.73,.76), .9,.22)
dark = material('Anodized recess', (.025,.038,.048), .65,.37)
pcb = material('Midnight laminate', (.018,.061,.054), .12,.49)
laminate = material('Exposed laminate edge', (.09,.14,.105), .1,.7)
black = material('Connector molding', (.026,.037,.043), .06,.49)
silk = material('Silkscreen', (.5,.66,.63), .05,.58)
copper = material('Cold plate brushed nickel', (.43,.49,.53), .86,.28)
ceramic = material('Package ceramic', (.055,.076,.09), .3,.38)
ghost = material('Cutaway cold plate', (.45,.5,.55), .35,.35,.055)
silicon = material('Polished silicon', (.025,.045,.075), .78,.20)
asic = material('Switch ASIC silicon', (1,1,1), .35,.22)
asic.node_tree.nodes.get('Principled BSDF').inputs['Emission Color'].default_value=(1,.15,.015,1)
asic.node_tree.nodes.get('Principled BSDF').inputs['Emission Strength'].default_value=0
eic = material('Electronic die passivation', (.035,.055,.085), .5,.3)
pic = material('Photonic die passivation', (.08,.11,.16), .15,.26)
gold = material('Gold bond pads', (.67,.43,.15), .8,.28)
traceCu = material('Electrical copper', (.55,.29,.10), .82,.3)
glass = material('Glass ferrule', (.55,.76,.86), 0,.12,.32)
fiberTx = material('Transmit glass', (.37,.80,.90), 0,.2)
fiberRx = material('Receive glass', (.82,.37,.66), 0,.2)
fiberCw = material('Laser glass', (.90,.55,.20), 0,.2)
for m in [fiberTx,fiberRx,fiberCw]:
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Emission Color'].default_value=m.diffuse_color
    p.inputs['Emission Strength'].default_value=.18
eicFace = material('Electronic die face', (.03,.045,.07), .1,.25)
# Package data fibers are drawn as two flat 8-fiber ribbons per engine in a matte
# coating; the runtime paints one stripe per fiber across the ribbon (UV u).
ribbonTx = material('Transmit ribbon', (.37,.80,.90), 0,.5)
ribbonRx = material('Receive ribbon', (.82,.37,.66), 0,.5)
bondLine = material('Hybrid bond interface', (.015,.016,.02), .2,.5)
# Exploded-detail finishes: its own photonic-die material, lit ring
# modulators so they read at the rings hotspot, matte labels that do not smear.
detailPic = material('Detail photonic die cladding', (.08,.11,.16), .15,.26)
ringGlow = material('Ring modulator rim', (.37,.80,.90), 0,.25)
labelTx = material('Detail label transmit', (.37,.80,.90), 0,.6)
labelRx = material('Detail label receive', (.82,.37,.66), 0,.6)
for m,k in [(ringGlow,3.0),(labelTx,.18),(labelRx,.18)]:
    b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Emission Color'].default_value=m.diffuse_color; b.inputs['Emission Strength'].default_value=k
vgroove = material('Fiber array V-groove block', (.04,.05,.06), .1,.35)
lidGlass = material('Fiber array lid glass', (.6,.8,.95), 0,.05,.25)
epoxy = material('Fiber array epoxy', (.12,.07,.02), 0,.5)
boot = material('Connector strain relief boot', (.02,.022,.025), 0,.7)
pinSteel = material('Guide pin steel', (.42,.44,.47), .85,.5)
# Small interface cheeks are bead-blasted: polished nickel at this size only
# caught pin-point key-light glints that bloomed into white bars.
cheek = material('Bead-blasted interface cheeks', (.36,.41,.45), .7,.55)
driver = material('Driver schematic regions', (.05,.19,.24), .45,.32)
tia = material('TIA schematic regions', (.20,.07,.15), .45,.32)
blue = material('Supply coolant pipe', (.025,.20,.36), .38,.28)
red = material('Return coolant pipe', (.38,.07,.035), .38,.28)

def group(name):
    o = bpy.data.objects.new(name, None); S.collection.objects.link(o); return o

groups = {name: group(name) for name in ['CPO_BOARD','CPO_PACKAGE','CPO_RETAINERS','CPO_INTERFACES','CPO_ELS','CPO_COLDPLATE','CPO_DETAIL','CPO_DIES','CPO_CONDUCTORS','CPO_FIBERS']}

def world(p): return (p[0]*CM, -p[2]*CM, p[1]*CM)

def box(name, p, d, mat, role, bevel=.02, angle=0, uv_top=False):
    # Work in native scene coordinates then convert to Blender Z-up meters.
    verts = []
    for z in [-1,1]:
        for y in [-1,1]:
            for x in [-1,1]:
                u,v = x*d[0]/2, z*d[2]/2
                xx,zz = u*math.cos(angle)-v*math.sin(angle), u*math.sin(angle)+v*math.cos(angle)
                verts.append(world((p[0]+xx,p[1]+y*d[1]/2,p[2]+zz)))
    faces = [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    if uv_top:
        # Top face (+Y native) spans the texture; other faces sample its dark rim.
        uv=mesh.uv_layers.new(name='UVMap')
        for poly in mesh.polygons:
            for li in poly.loop_indices:
                vi=mesh.loops[li].vertex_index
                uv.data[li].uv=((vi&1),(vi>>2)&1) if poly.index==3 else (.002,.002)
    o=bpy.data.objects.new(name,mesh); S.collection.objects.link(o); o.parent=groups[role]; mesh.materials.append(mat)
    # Sub-0.15 mm parts get no bevel and thin parts a single chamfer: their
    # rounding is sub-pixel at every app camera but tripled the triangle count.
    if bevel and min(d)>=.015:
        mod=o.modifiers.new('Manufactured edge radius','BEVEL'); mod.width=min(bevel,min(d)*.45)*CM; mod.segments=1 if min(d)<.05 else 3
        mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); mod.keep_sharp=True
    return o

def screw(x,y,z,role,r=.08):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r*CM,depth=.025*CM,location=world((x,y,z)))
    o=bpy.context.object; o.name='Captive fastener'; o.parent=groups[role]; o.data.materials.append(edge)
    box('Fastener recess',(x,y+.014,z),(r*1.2,.005,r*.22),dark,role,.002)

def cylinder(name, p, radius, height, mat, role, segments=24):
    small=radius<.05
    bpy.ops.mesh.primitive_cylinder_add(vertices=min(segments,8) if small else segments,radius=radius*CM,depth=height*CM,location=world(p))
    o=bpy.context.object; o.name=name; o.parent=groups[role]; o.data.materials.append(mat)
    if not small:
        b=o.modifiers.new('Turned edge radius','BEVEL'); b.width=.015*CM; b.segments=2
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return o

# Board and lower stiffener remain underneath the existing package substrate.
box('Motherboard',(0,0,0),(13.6,.14,13.6),pcb,'CPO_BOARD',.06,uv_top=True)
for y in [-.054,-.012,.035]:
    for z in [-6.795,6.795]: box('Laminate edge',(0,y,z),(13.45,.007,.009),laminate,'CPO_BOARD',.002)
for x in [-6.15,6.15]:
    for z in [-6.15,6.15]:
        # Corner clamp stays outside the optical fiber perimeter corridor.
        box('Corner clamp',(x,.075,z),(.62,.12,.62),nickel,'CPO_BOARD',.05)
        screw(x,.152,z,'CPO_BOARD',.17)

# The exact native substrate envelope, with representative machined support
# below it. None of this mechanical layer creates a signal-bearing trace.
box('Package substrate',(0,.9,0),(10.4,.28,10.4),ceramic,'CPO_PACKAGE',.045)
box('Lower socket stiffener',(0,.48,0),(10.65,.24,10.65),dark,'CPO_PACKAGE',.11)
for z in [-5.12,5.12]: box('Socket edge lip',(0,.62,z),(10.15,.06,.1),nickel,'CPO_PACKAGE',.02)
for x in [-5.12,5.12]: box('Socket edge lip',(x,.62,0),(.1,.06,10.15),nickel,'CPO_PACKAGE',.02)
for x in [-4.72,4.72]:
    for z in [-4.72,4.72]:
        box('Socket clamp',(x,1.105,z),(.52,.11,.52),nickel,'CPO_PACKAGE',.065)
        screw(x,1.177,z,'CPO_PACKAGE',.10)
box('Shared silicon interposer',(0,1.45,0),(9.0,.1,9.0),pic,'CPO_PACKAGE',.02)
# Underfill (representative) skirts the bare die on the interposer; there is
# no published lid or stiffener around it, so none is drawn.
underfill = material('Underfill epoxy', (.14,.08,.03), 0,.5)
for z in [-1.235,1.235]: box('Underfill fillet',(0,1.54,z),(2.53,.07,.06),underfill,'CPO_PACKAGE',.02)
for x in [-1.235,1.235]: box('Underfill fillet',(x,1.539,0),(.06,.068,2.4),underfill,'CPO_PACKAGE',.02)

# Six open retainers, three engines each. Their central apertures expose the
# reviewed EIC/PIC surfaces. Front/back walls stay below fiber attachment height.
for side,t0 in LAYOUT['subassemblies']:
    out=[(1,0),(0,1),(-1,0),(0,-1)][side]; tan=(-out[1],out[0])
    cx,cz=out[0]*3.35+tan[0]*t0,out[1]*3.35+tan[1]*t0
    angle=side*math.pi/2
    def pos(radial,tangent,y): return (cx+out[0]*radial+tan[0]*tangent,y+.15,cz+out[1]*radial+tan[1]*tangent)
    box('Subassembly carrier',pos(0,0,1.415),(1.64,.1,3.5),dark,'CPO_RETAINERS',.035,angle)
    for r in [-.94,.94]:
        railY=1.25 if r>0 else 1.38
        box('Machined retainer rail',pos(r,0,railY),(.40,.16,3.42),nickel,'CPO_RETAINERS',.045,angle)
        box('Retainer underside seam',pos(r,0,railY-.095),(.38,.025,3.32),dark,'CPO_RETAINERS',.008,angle)
    for t in [-1.62,1.62]:
        box('Retainer end bridge',pos(0,t,1.37),(1.82,.14,.16),nickel,'CPO_RETAINERS',.035,angle)
        for r in [-.93,.93]:
            p=pos(r,t,1.35 if r>0 else 1.48); screw(*p,'CPO_RETAINERS',r=.095)

# Mechanical ferrule supports surround the native glass interfaces. Clearances
# above the drawn fibers stay open; these are not additional optical ports.
for e,conn in zip(LAYOUT['engines'],LAYOUT['connectors']):
    out=e['out']; tan=e['tan']; angle=e['side']*math.pi/2
    def ip(r,t,y): return (e['x']+out[0]*r+tan[0]*t,y+.15,e['z']+out[1]*r+tan[1]*t)
    for t in [-.43,.43]: box('Ferrule side cheek',ip(.83,t,1.56),(.36,.23,.045),cheek,'CPO_INTERFACES',.012,angle)
    box('Ferrule lower seat',ip(.83,0,1.375),(.37,.03,.82),black,'CPO_INTERFACES',.008,angle)
    for t in [-.5,.5]:
        p=(conn[0]+tan[0]*t,1.22,conn[1]+tan[1]*t)
        box('Connector guide cheek',p,(.35,.27,.035),cheek,'CPO_INTERFACES',.009,angle)

# External laser sources as front-panel pluggables (enclosure shape
# representative: the sources give counts and serviceability, not a form
# factor). Each slim body stands in a front-panel bezel, heat-sink fins on its
# rear half, a pull tab and label outside, and a receptacle frame around the
# laser exit on its inward (-X) face. Nothing crosses that exit.
elsBody = material('Laser module anodized body', (.2,.21,.23), .8,.34)
elsFin = material('Laser module heat-sink fins', (.42,.44,.47), .85,.3)
bezel = material('Front panel bezel', (.1,.11,.12), .7,.4)
for i in range(5):
    z=-4.4+i*2.2
    box('External laser case',(8.48,1.5,z),(2.4,.6,1.0),elsBody,'CPO_ELS',.04)
    for k in range(7): box('Laser heat-sink fin',(9.05,1.86,z-.39+k*.13),(1.15,.12,.035),elsFin,'CPO_ELS',0)
    box('Laser module seam',(7.75,1.5,z),(.02,.605,1.005),dark,'CPO_ELS',0)
    # Pull tab (bail) and label plate on the outward face.
    for dz in [-.26,.26]: box('Laser pull tab',(9.86,1.34,z+dz),(.36,.04,.04),black,'CPO_ELS',0)
    box('Laser pull tab',(10.02,1.34,z),(.04,.05,.56),black,'CPO_ELS',0)
    box('Laser module label',(9.685,1.62,z),(.01,.2,.62),silk,'CPO_ELS',0)
    # Receptacle frame around the aperture; the laser exit itself stays open.
    for dy in [-.13,.13]: box('Laser receptacle',(7.2,1.5+dy,z),(.16,.05,.62),black,'CPO_ELS',0)
    for dz in [-.29,.29]: box('Laser receptacle',(7.2,1.5,z+dz),(.16,.21,.04),black,'CPO_ELS',0)
# Front-panel bezel strip: the modules plug through it, outside the package.
for i in range(6):
    z0=-5.5 if i==0 else -4.4+(i-1)*2.2+.52; z1=5.5 if i==5 else -4.4+i*2.2-.52
    box('Front panel bezel',(9.35,1.0,(z0+z1)/2),(.2,1.86,z1-z0),bezel,'CPO_ELS',.02)
for i in range(5):
    z=-4.4+i*2.2
    box('Front panel bezel',(9.35,.585,z),(.2,1.03,1.04),bezel,'CPO_ELS',.02)
    box('Front panel bezel',(9.35,1.97,z),(.2,.06,1.04),bezel,'CPO_ELS',0)

# A lifted, open-center cold-plate study. The translucent center is explicitly
# an x-ray cutaway; opaque perimeter and fittings supply mechanical edge cues.
for z in [-4.77,4.77]: box('Cold plate perimeter',(0,4.2,z),(9.8,.35,.26),copper,'CPO_COLDPLATE',.06)
for x in [-4.77,4.77]: box('Cold plate perimeter',(x,4.2,0),(.26,.35,9.28),copper,'CPO_COLDPLATE',.06)
box('X ray center',(0,4.2,0),(9.27,.32,9.27),ghost,'CPO_COLDPLATE',.03)
for x in [-4.65,4.65]:
    for z in [-4.65,4.65]: screw(x,4.395,z,'CPO_COLDPLATE',.10)
# Representative skived-fin microchannels inside the x-rayed center. They follow
# the drawn coolant path: down the supply leg (x=-1.4), across at z=3, back up
# the return leg (x=+1.4). Fins run parallel to the flow; none sits on a flow line.
supplyFin = material('Cold plate supply channels', (.08,.34,.9), .2,.3,.32)
returnFin = material('Cold plate return channels', (.95,.32,.08), .2,.3,.32)
for m in [supplyFin,returnFin]:
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Emission Color'].default_value=m.diffuse_color
    p.inputs['Emission Strength'].default_value=.9
for sx,m in [(-1,supplyFin),(1,returnFin)]:
    for k in range(10):
        x=sx*(.28+k*.25)
        if abs(abs(x)-1.4)<.06: continue
        box('Microchannel fin',(x,4.2,-.72),(.028,.14,7.0),m,'CPO_COLDPLATE',0)
for k in range(7):
    box('Microchannel fin',(0,4.2,2.72+k*.16),(5.3,.14,.028),returnFin,'CPO_COLDPLATE',0)
for x in [-1.4,1.4]:
    cylinder('Coolant fitting flange',(x,4.45,-4.2),.43,.16,nickel,'CPO_COLDPLATE')
    cylinder('Coolant hex nut',(x,4.57,-4.2),.36,.17,edge,'CPO_COLDPLATE',6)
    for y in [4.69,4.83,4.97]: cylinder('Fitting collar',(x,y,-4.2),.305,.055,nickel,'CPO_COLDPLATE')

# The exploded 2.5x engine is a separate diagram. A subtle backing gives the
# photonic die a finished edge without changing its waveguides or bond guides.
box('Detail die backing',(-11.4,1.245,-8.4),(3.50,.15,2.49),ceramic,'CPO_DETAIL',.04)

# Complete physical internals. Path locations match side-cpo.js, while the
# close-up PIC topology is now actual Blender geometry instead of a flat map.
def segment(name,a,b,r,mat,role,n=8):
    a,b=Vector(world(a)),Vector(world(b)); d=b-a
    if d.length<1e-9:return
    q=d.to_track_quat('Z','Y'); verts=[]
    for center in [a,b]:
        for k in range(n):verts.append(center+q@Vector((r*CM*math.cos(k*math.tau/n),r*CM*math.sin(k*math.tau/n),0)))
    faces=[tuple(reversed(range(n))),tuple(range(n,n*2))]
    faces.extend((k,(k+1)%n,(k+1)%n+n,k+n) for k in range(n))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);S.collection.objects.link(o)
    o.parent=groups[role];o.data.materials.append(mat)
    return o

def path(name,pts,r,mat,role,n=8):
    for a,b in zip(pts,pts[1:]):segment(name,a,b,r,mat,role,n)

def round_corners(pts,keep=lambda k,n:False,radius=.3,steps=6):
    # Identical to roundCorners() in side-cpo.js: the animated light rides this path.
    out=[pts[0]]
    for k in range(1,len(pts)-1):
        p,a,b=pts[k],pts[k-1],pts[k+1]
        if keep(k,len(pts)): out.append(p); continue
        la=math.dist(a,p); lb=math.dist(b,p); d=min(radius,la*.45,lb*.45)
        p1=[v+(a[j]-v)/la*d for j,v in enumerate(p)]; p2=[v+(b[j]-v)/lb*d for j,v in enumerate(p)]
        for st in range(steps+1):
            t=st/steps; u=1-t
            out.append([u*u*p1[j]+2*u*t*v+t*t*p2[j] for j,v in enumerate(p)])
    out.append(pts[-1]); return out

def keep_cw(k,n): return k==1 or k==n-2

def tube(name,pts,r,mat,role,n=6):
    # One continuous tube (shared rings, end caps only) along a rounded path.
    P=[Vector(world(p)) for p in pts]; verts=[]; ref=None
    for i,c in enumerate(P):
        d=(P[min(len(P)-1,i+1)]-P[max(0,i-1)]).normalized()
        if ref is None: ref=d.orthogonal().normalized()
        u=(ref-d*ref.dot(d)).normalized(); v=d.cross(u); ref=u
        for k in range(n):
            a=k*math.tau/n; verts.append(c+(u*math.cos(a)+v*math.sin(a))*r*CM)
    faces=[tuple(reversed(range(n))),tuple(range(n*(len(P)-1),n*len(P)))]
    for i in range(len(P)-1):
        for k in range(n): faces.append((i*n+k,i*n+(k+1)%n,(i+1)*n+(k+1)%n,(i+1)*n+k))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    for f in mesh.polygons: f.use_smooth=True
    o=bpy.data.objects.new(name,mesh);S.collection.objects.link(o);o.parent=groups[role];mesh.materials.append(mat)
    return o

def ribbon(name,lanes,mat,role,half=.127,thick=.006):
    # One flat ribbon over parallel lanes (identical shapes offset sideways).
    rounded=[round_corners(l) for l in lanes]
    center=[[sum(r[i][j] for r in rounded)/len(rounded) for j in range(3)] for i in range(len(rounded[0]))]
    side=Vector(rounded[-1][0])-Vector(rounded[0][0]); side.normalize()
    verts=[];uvs=[];n=len(center)
    for i,c in enumerate(center):
        a=Vector(center[max(0,i-1)]); b=Vector(center[min(n-1,i+1)]); d=(b-a).normalized()
        nrm=d.cross(side).normalized()
        if nrm.y<0: nrm=-nrm
        c=Vector(c)
        for sw,sn in [(-1,1),(1,1),(1,-1),(-1,-1)]:
            q=c+side*(sw*half)+nrm*(sn*thick/2); verts.append(world(tuple(q)))
    faces=[];uv=[]
    for i in range(n-1):
        o,m=4*i,4*i+4
        for k in range(4):
            k2=(k+1)%4; faces.append((o+k,o+k2,m+k2,m+k))
    faces.append((0,3,2,1)); faces.append((4*(n-1),4*(n-1)+1,4*(n-1)+2,4*(n-1)+3))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    layer=mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            vi=mesh.loops[li].vertex_index; corner=vi%4
            layer.data[li].uv=((0 if corner in (0,3) else 1),(vi//4)/(n-1))
    o=bpy.data.objects.new(name,mesh);S.collection.objects.link(o);o.parent=groups[role];mesh.materials.append(mat)
    return o

def flat_trace(a,b,y,width,role):
    dx,dz=b[0]-a[0],b[1]-a[1]
    box('Copper substrate trace',((a[0]+b[0])/2,y,(a[1]+b[1])/2),
        (math.hypot(dx,dz),.004,width),traceCu,role,0,math.atan2(dz,dx))

box('Bare switch ASIC',(0,1.62,0),(2.4,.1,2.4),asic,'CPO_DIES',.02,uv_top=True)
for z in [-5.2,5.2]:
    for y in [.82,.94]:box('Substrate laminate',(0,y,z),(10.4,.012,.012),laminate,'CPO_PACKAGE',.002)
for x in [-5.2,5.2]:
    for y in [.82,.94]:box('Substrate laminate',(x,y,0),(.012,.012,10.4),laminate,'CPO_PACKAGE',.002)

def photonic_die(cx,cy,cz,scale,angle,exploded=False):
    role='CPO_DETAIL' if exploded else 'CPO_DIES'
    pw,pd=1.35*scale,.95*scale
    def w(x,y,z):return(cx+x*math.cos(angle)-z*math.sin(angle),cy+y,cz+x*math.sin(angle)+z*math.cos(angle))
    def px(v):return -pw/2+v/512*pw
    def pz(v):return -pd/2+v/384*pd
    box('Photonic PIC',w(0,0,0),(pw,.15 if exploded else .06,pd),detailPic if exploded else pic,role,.005*scale,angle)
    ey=.95 if exploded else .073
    # In the package the EIC sits back from the fiber edge so the photonic die's
    # fiber-array landing shows, on a thin dark hybrid-bond line (representative).
    ex0=0 if exploded else -.05
    box('Electronic EIC',w(ex0,ey,0),(1.23*scale,.12 if exploded else .07,.902*scale),eic if exploded else eicFace,role,.005*scale,angle,uv_top=not exploded)
    if not exploded: box('Hybrid bond line',w(ex0,.0340,0),(1.21,.007,.88),bondLine,role,0,angle)
    if not exploded: return
    # Regions are schematic functional blocks, not a photographed die floorplan.
    for i in range(8):
        ex=-1.23*scale/2+(23+i*29)/256*(1.23*scale)
        for z,m in [(-.198*scale,driver),(.227*scale,tia)]:
            box('Driver' if m==driver else 'TIA',w(ex,ey+.062,z),(.106*scale,.004,.324*scale),m,role,0,angle)
    for words,z,mat in [('TX DRIVERS',-.198*scale,labelTx),('RX TIAs',.227*scale,labelRx)]:
        curve=bpy.data.curves.new(words,'FONT');curve.body=words;curve.size=.16*CM
        curve.align_x='CENTER';curve.align_y='CENTER';curve.extrude=0
        obj=bpy.data.objects.new(words,curve);S.collection.objects.link(obj)
        obj.location=world(w(0,ey+.071,z));obj.rotation_euler[2]=math.pi-angle
        obj.parent=groups[role];curve.materials.append(mat)
        bpy.context.view_layer.objects.active=obj;obj.select_set(True)
        bpy.ops.object.convert(target='MESH');obj.select_set(False)
    top=.082;radius=.0045
    path('CW bus',[w(px(512),top,pz(24)),w(px(24),top,pz(24)),w(px(24),top,pz(190))],radius,fiberCw,role)
    for i in range(8):
        row=50+i*20;rx=110+i*40;ringz=row-10;rxrow=214+i*20
        path('CW branch',[w(px(24),top,pz(row)),w(px(rx-14),top,pz(row))],radius,fiberCw,role)
        path('TX waveguide',[w(px(rx-14),top,pz(row)),w(px(512),top,pz(row))],radius,fiberTx,role)
        pts=[w(px(rx+6*math.cos(k*math.tau/32)),top,pz(ringz+6*math.sin(k*math.tau/32))) for k in range(33)]
        tube('Ring modulator',pts,.0065,ringGlow,role,6)
        path('RX waveguide',[w(px(512),top,pz(rxrow)),w(px(90),top,pz(rxrow))],radius,fiberRx,role)
        box('Photodiode',w(px(77),top,pz(rxrow)),(26/512*pw,.012,12/384*pd),tia,role,.004,angle)
        for bx,bz,br in [(px(rx),pz(row-12-4-4.5),.020),(px(77),pz(rxrow),.033)]:
            for by in [.09,.88]:cylinder('Face bonding pad',w(bx,by,bz),br,.025,gold,role,12)
    box('Glass fiber attach',w(pw/2+.2,.1,0),(.4,.4,pd-.2),glass,role,.01,angle)
    for i in range(8):
        for ry,zz,m in [(.1,pz(50+i*20),fiberTx),(.14,pz(214+i*20),fiberRx)]:
            path('Detail fiber',[w(pw/2+.4,ry,zz),w(pw/2+2.6,ry,zz)],.02,m,role)
    for d in [-.07,.07]:path('Detail laser fiber',[w(pw/2+.4,.1,pz(24)+d),w(pw/2+2.6,.1,pz(24)+d)],.02,fiberCw,role)
    for j in range(6):box('Detail electrical trace',w(-1.23*scale/2-.8,.95,-.55+j*.22),(1.6,.01,.05),traceCu,role,.002,angle)

for i,(e,conn) in enumerate(zip(LAYOUT['engines'],LAYOUT['connectors'])):
    x,z=e['x'],e['z'];out,tan=e['out'],e['tan'];angle=e['rot']
    photonic_die(x,1.65,z,1,angle)
    # Fiber-array unit (representative): a V-groove block holds each lane under
    # a clear lid, epoxied to the photonic die's edge.
    def fp(r,t,y): return (x+out[0]*r+tan[0]*t,y,z+out[1]*r+tan[1]*t)
    box('Fiber array V-groove block',fp(.83,0,1.675),(.3,.09,.8),vgroove,'CPO_INTERFACES',.008,angle)
    box('Engine glass ferrule',fp(.83,0,1.777),(.3,.111,.8),lidGlass,'CPO_INTERFACES',.008,angle)
    box('Fiber array epoxy fillet',fp(.66,0,1.70),(.04,.08,.78),epoxy,'CPO_INTERFACES',0,angle)
    for j in range(16):
        box('Fiber in groove',fp(.83,(j-7.5)*.034,1.726),(.3,.007,.012),fiberTx if j<8 else fiberRx,'CPO_INTERFACES',0,angle)
    for j in range(2):
        box('Fiber in groove',fp(.83,.305+j*.028,1.726),(.3,.007,.012),fiberCw,'CPO_INTERFACES',0,angle)
    # asicTap clamps the tangential coordinate to the 24 mm die's SerDes edge.
    t=max(-1,min(1,e['t']*.6));a=(out[0]*1.2+tan[0]*t,out[1]*1.2+tan[1]*t)
    b=(x-out[0]*.62,z-out[1]*.62)
    for j in range(4):
        o=(j-1.5)*.09
        flat_trace((a[0]+tan[0]*o,a[1]+tan[1]*o),(b[0]+tan[0]*o,b[1]+tan[1]*o),1.041,.03,'CPO_CONDUCTORS')
    ex,ez=conn
    routes=LAYOUT['fiberRoutes'][i]
    ribbon('Engine tx ribbon',routes['tx'],ribbonTx,'CPO_FIBERS')
    ribbon('Engine rx ribbon',routes['rx'],ribbonRx,'CPO_FIBERS')
    for points in routes['cw']:tube('Engine cw fiber',round_corners(points,keep_cw,.25),.008,fiberCw,'CPO_FIBERS')
    # MT-style ferrule connector at the package edge (representative geometry):
    # molded body, two steel guide pins beside the fiber rows, boot and latch.
    def cp(r,t,y): return (ex+out[0]*r+tan[0]*t,y,ez+out[1]*r+tan[1]*t)
    box('Package fiber guide',cp(0,0,1.2),(.36,.22,.9),black,'CPO_INTERFACES',.03,angle)
    box('Connector latch',cp(-.02,0,1.325),(.14,.04,.2),black,'CPO_INTERFACES',.012,angle)
    box('Connector strain relief boot',cp(.22,0,1.2),(.08,.13,.66),boot,'CPO_INTERFACES',.02,angle)
    for t in [-.4,.4]: segment('Connector guide pin',cp(.17,t,1.2),cp(.3,t,1.2),.035,pinSteel,'CPO_INTERFACES',8)

photonic_die(-11.4,1.4,-8.4,2.5,math.pi,True)
for i in range(5):box('Laser aperture',(7.24,1.5,-4.4+i*2.2),(.04,.18,.5),fiberCw,'CPO_ELS',.004)
for x,m in [(-1.4,blue),(1.4,red)]:cylinder('Coolant pipe',(x,5.5,-4.2),.28,2.6,m,'CPO_COLDPLATE')

# Bake and batch per semantic assembly/material. glTF converts Z-up to Y-up.
bpy.context.view_layer.update(); deps=bpy.context.evaluated_depsgraph_get()
for o in list(S.objects):
    if o.type=='MESH':
        baked=bpy.data.meshes.new_from_object(o.evaluated_get(deps)); o.modifiers.clear(); o.data=baked
# Only textured materials keep UVs; the rest export position + normal only.
for o in S.objects:
    if o.type=='MESH' and not any(m and m.name in UV_MATERIALS for m in o.data.materials):
        while o.data.uv_layers: o.data.uv_layers.remove(o.data.uv_layers[0])
for parent in groups.values():
    batches={}
    for o in list(parent.children):
        if o.type=='MESH': batches.setdefault(o.data.materials[0].name,[]).append(o)
    for matname,objects in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
        bpy.context.object.name=parent.name+'__'+matname
root=group('IFX_CPO_HARDWARE')
for o in groups.values():o.parent=root
root['ifx']=json.dumps({'version':5,'units':'m','coordinates':'gltf-root-rest','representative':True,
    'engineCount':len(LAYOUT['engines']),'subassemblyCount':len(LAYOUT['subassemblies']),
    'interposerCm':[9.0,.1,9.0], 'interposerCenterCm':[0,1.45,0],
    'enginesCm':[[e['x'],1.65,e['z']] for e in LAYOUT['engines']],
    'scope':'all static physical geometry; runtime owns animated overlays, labels and selection guides',
    'physicalMeshes':'Blender authored', 'fiberRoutesCm':LAYOUT['fiberRoutes'], 'detailRingCount':8,'txFibersPerEngine':8,'rxFibersPerEngine':8,'laserFibersPerEngine':2})
out=ROOT/'public/models/cpo-hardware.glb'; out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'cpo-hardware.blend'))
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
# Quantize positions/normals (KHR_mesh_quantization, decoded natively by three's
# GLTFLoader; no decoder library needed). Extras, names and materials survive.
import subprocess
subprocess.run(f'npx -y @gltf-transform/cli@4.5.1 quantize "{out}" "{out}" --quantize-position 16 --quantize-normal 10',
    shell=True, check=True, cwd=str(ROOT))
print('IFX_CPO_EXPORTED',out, out.stat().st_size)

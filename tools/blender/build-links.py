"""Complete Blender-authored coherent/copper hardware with audited signal layout.
Native references carry the reviewed circuit geometry into Blender; this script
refines its manufactured surfaces and adds representative mechanical details.
Runtime Three.js owns only animated teaching flows, captions and interaction.
Run Blender headlessly: blender -b --python tools/blender/build-links.py
Author dimensions below in native centimetres; GLB is metres, Y-up after export.
"""
import bpy
import math
import sys
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public' / 'models'
OUT.mkdir(parents=True, exist_ok=True)

def mat(name, color, metallic, roughness, alpha=1):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, alpha)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, alpha)
    p.inputs['Metallic'].default_value = metallic
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Alpha'].default_value = alpha
    if alpha < 1: m.surface_render_method = 'DITHERED'
    return m

def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    return {
        'shell': mat('Satin die-cast nickel', (.31,.38,.44), .83, .3),
        'edge': mat('Machined edge highlights', (.58,.66,.71), .86, .23),
        'dark': mat('Recessed mechanical seams', (.028,.038,.05), .5, .44),
        'lid': mat('Satin nickel lifted cover', (.38,.46,.52), .82, .32),
        'fin': mat('Machined lifted fins', (.50,.58,.64), .84, .29),
        'ceramic': mat('Package ceramic', (.17,.22,.26), .18, .47),
        'seal': mat('Metallized package seal', (.45,.51,.52), .72, .31),
        'package': mat('Molded active package', (.026,.04,.053), .12, .39),
        'mark': mat('Laser etched identification', (.23,.29,.32), .5, .5),
        'pull': mat('Molded release pull tab', (.36,.43,.48), .08, .38),
        'boot': mat('Molded black cable boot', (.018,.023,.027), .05, .52),
    }

def xyz(pos):
    x,y,z = pos
    return (x*.01,-z*.01,y*.01)

def box(name, pos, size, material, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=xyz(pos))
    o = bpy.context.object; o.name = name
    x,y,z = size; o.dimensions = (x*.01,z*.01,y*.01)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    if bevel:
        b = o.modifiers.new('Manufactured edge radius', 'BEVEL'); b.width = min(bevel, min(size)*.42)*.01; b.segments = 3
        bpy.ops.object.modifier_apply(modifier=b.name)
        w = o.modifiers.new('Face weighted normals', 'WEIGHTED_NORMAL'); w.keep_sharp = True
        bpy.ops.object.modifier_apply(modifier=w.name)
    for p in o.data.polygons: p.use_smooth = True
    return o

def screw(name, x, y, z, mats, r=.058):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=r*.01, depth=.019*.01, location=xyz((x,y,z)))
    o = bpy.context.object; o.name = name; o.data.materials.append(mats['edge'])
    b = o.modifiers.new('Head radius','BEVEL'); b.width=.006*.01; b.segments=2
    bpy.ops.object.modifier_apply(modifier=b.name)
    box(name+'_slot', (x,y+.010,z), (r*1.2,.002,r*.22), mats['dark'], .001)

def osfp_top_housing(name, cx, cy, cz, length, width, mats):
    # Die-cast OSFP top housing with an integrated closed-top heat sink: a
    # ceiling plate, longitudinal fins running the whole length, and a flat top
    # skin, so air can pass along the module (OSFP MSA Rev 5.0 sec. 3.3). The
    # channels stay open at both ends. Fin count, pitch and heights are
    # representative; the MSA gives example designs, not this one.
    b=cy-.045; H=.6; skin=.08; wall=.1
    box(name+'_ceiling plate',(cx,b+.05,cz),(length,.1,width),mats['lid'],.04)
    for s in [-1,1]:
        box(name+'_side wall',(cx,b+.1+(H-.1)/2,cz+s*(width/2-wall/2)),(length,H-.1,wall),mats['lid'],.03)
        box(name+'_parting seam',(cx,b+.012,cz+s*(width/2-.004)),(length-.12,.012,.01),mats['dark'],.003)
    for x in [-1,1]:
        box(name+'_parting seam',(cx+x*(length/2-.004),b+.012,cz),(.01,.012,width-.12),mats['dark'],.003)
    n=11; span=width-2*wall-.16
    for i in range(n):
        z=cz-span/2+i*span/(n-1)
        box(name+'_heat sink fin',(cx,b+.1+(H-.1-skin)/2,z),(length-.02,H-.1-skin,.05),mats['edge'],.012)
    top=box(name+'_top skin',(cx,b+H-skin/2,cz),(length,skin,width),mats['lid'],.04)
    # A shallow label recess (OSFP MSA Fig. 3-4 gives a recommended label area).
    cut=box('Temporary cover label pocket',(cx-.6,b+H,cz),(4.2,.03,1.5),mats['lid'],.01)
    pocket=top.modifiers.new('Label recess','BOOLEAN');pocket.operation='DIFFERENCE';pocket.object=cut
    bpy.context.view_layer.objects.active=top;bpy.ops.object.modifier_apply(modifier=pocket.name)
    bpy.data.objects.remove(cut,do_unlink=True)

def lid(name, cx, cy, cz, length, width, along_x, mats):
    # Opaque metal, lifted for inspection. The UI can hide the cover entirely.
    if along_x:
        osfp_top_housing(name,cx,cy,cz,length,width,mats)
        return
    dims=(width,.09,length)
    box(name+'_cutaway', (cx,cy,cz), dims, mats['lid'], .035)
    for x in [-width/2+.05,width/2-.05]: box(name+'_fold', (cx+x,cy,cz), (.1,.12,length), mats['edge'])
    for z in [-length/2+.09,length/2-.09]: box(name+'_end', (cx,cy,cz+z), (width-.2,.12,.18), mats['shell'])
    # Flat QSFP-style clamshell: no invented cooling ribs. The shallow rear
    # shoulder and inset label landing follow the public QSFP112 DAC photo.
    box(name+'_rear shoulder', (cx,cy+.065,cz-length/2+.58), (width-.14,.13,1.0), mats['lid'], .065)
    box(name+'_label landing', (cx,cy+.048,cz+.35), (width-.65,.008,2.3), mats['shell'], .045)

def cable_cutaway(name, cx, mats):
    # Lower half-shell of the boot and jacket: sectioned through the upper half
    # so the modeled conductors remain visible. Not transparent polymer.
    stations=[(-3.18,.68),(-3.42,.68),(-3.58,.59),(-4.12,.55),(-4.30,.52),(-6.22,.52)]
    n=32;verts=[]
    for z,r in stations:
        for radius in [r,r-.08]:
            for i in range(n+1):
                a=math.pi+i*math.pi/n
                verts.append(xyz((cx+radius*math.cos(a),.9+radius*math.sin(a),z)))
    faces=[];stride=2*(n+1)
    for j in range(len(stations)-1):
        for i in range(n):
            a=j*stride+i;b=a+stride
            faces.extend([(a,a+1,b+1,b),(a+n+1,b+n+1,b+n+2,a+n+2)])
        for i in [0,n]:
            a=j*stride+i;b=a+stride
            faces.append((a,b,b+n+1,a+n+1))
    for j in [0,len(stations)-1]:
        for i in range(n):
            a=j*stride+i;faces.append((a,a+n+1,a+n+2,a+1))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(mats['boot'])
    # Recalculate outward normals on this closed, physically thick section.
    bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
    for p in mesh.polygons:p.use_smooth=True
    # Narrow molded grip lands belong to the remaining side walls only.
    for z in [-3.6,-3.82,-4.04]:
        for s in [-1,1]:box(name+' side grip',(cx+s*.565,.68,z),(.07,.22,.075),mats['boot'],.028)

def copper_pull(name, cx, mats):
    # Low, rounded rectangular pull surrounding the cable, connected to the two
    # side release rails. Photo-inspired thermoplastic, not a finned metal lid.
    for s in [-1,1]:
        box(name+' side arm',(cx+s*.93,.24,-3.61),(.18,.12,2.6),mats['boot'],.055)
        box(name+' latch linkage',(cx+s*1.055,.29,-1.58),(.08,.16,1.6),mats['edge'],.02)
    box(name+' grip',(cx,.24,-4.93),(2.04,.12,.26),mats['boot'],.085)
    for i in range(7):box(name+' grip texture',(cx-.60+i*.2,.307,-4.94),(.065,.012,.15),mats['dark'],.01)

def annulus(name, center, outer, inner, depth, axis, material):
    # A real opening, never a solid cylinder laid across an optical/electrical path.
    verts=[]; n=40
    for d in [-depth/2,depth/2]:
        for r in [outer,inner]:
            for i in range(n):
                a=i*2*math.pi/n; u,v=r*math.cos(a),r*math.sin(a)
                p=(center[0]+d,center[1]+u,center[2]+v) if axis=='x' else (center[0]+u,center[1]+v,center[2]+d)
                verts.append(xyz(p))
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces += [(i,j,n+j,n+i),(2*n+j,2*n+i,3*n+i,3*n+j),(i,2*n+i,2*n+j,j),(n+j,3*n+j,3*n+i,n+i)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(material)
    return o

def pull_loop(name, origin, along_x, material):
    # Photo-inspired open release loop. It is a mechanical handle, never a
    # signal path. Dimensions beyond the shell are representative.
    outer=[(0,-1.04),(2.45,-1.04),(2.78,-.72),(2.92,0),(2.78,.72),(2.45,1.04),(0,1.04)]
    inner=[(.18,-.86),(2.35,-.86),(2.59,-.59),(2.70,0),(2.59,.59),(2.35,.86),(.18,.86)]
    verts=[]
    for y in [-.055,.055]:
        for ring in [outer,inner]:
            for u,v in ring:
                x,z=(origin[0]+u,origin[2]+v) if along_x else (origin[0]+v,origin[2]-u)
                verts.append(xyz((x,origin[1]+y,z)))
    n=len(outer);faces=[]
    for i in range(n):
        j=(i+1)%n
        faces += [(i,j,n+j,n+i),(2*n+j,2*n+i,3*n+i,3*n+j),(i,2*n+i,2*n+j,j),(n+j,3*n+j,3*n+i,n+i)]
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(material)
    bpy.context.view_layer.objects.active=o
    b=o.modifiers.new('Soft molded release edges','BEVEL');b.width=.00012;b.segments=3
    bpy.ops.object.modifier_apply(modifier=b.name)
    return o

def internals(kind):
    source=ROOT/'tools'/'blender'/'references'/(kind+'-internals.glb')
    before=set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(source))
    imported=[o for o in bpy.context.scene.objects if o not in before]
    for o in imported:
        if o.type!='MESH':continue
        world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
        bpy.context.view_layer.objects.active=o
        bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        o.name=o.name.replace('REFERENCE_', 'BLENDER_')
        o['authoredStatic']=True
        # Sub-pixel edge radii refine box-built packages without moving any
        # conductor centerline or touching the active circuit topology.
        b=o.modifiers.new('Manufactured micro edge','BEVEL');b.width=.000015;b.segments=2;b.limit_method='ANGLE'
        bpy.ops.object.modifier_apply(modifier=b.name)
        w=o.modifiers.new('Weighted manufactured normals','WEIGHTED_NORMAL');w.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=w.name)
        for m in o.data.materials:
            if not m or not m.use_nodes:continue
            p=m.node_tree.nodes.get('Principled BSDF')
            if not p:continue
            c=p.inputs['Base Color'].default_value
            # Solder mask has a restrained deep-green finish; signal metals and
            # the separately colored optical fibers retain their identity.
            if c[1]>c[0]*1.12 and c[1]>c[2]*1.05 and p.inputs['Metallic'].default_value<.3:
                p.inputs['Base Color'].default_value=(.009,.052,.037,c[3]);p.inputs['Roughness'].default_value=.39
            if c[0]>.45 and c[0]>c[1]*2.3 and c[1]>c[2]*2 and p.inputs['Metallic'].default_value>.9:
                # Exposed copper must remain legible in the passive DAC even
                # when no moving pulse happens to illuminate that route.
                p.inputs['Base Color'].default_value=(.68,.31,.13,c[3])
                p.inputs['Metallic'].default_value=.7;p.inputs['Roughness'].default_value=.38
    count=sum(1 for o in imported if o.type=='MESH')
    for o in imported:
        if o.type=='EMPTY' and not o.children:bpy.data.objects.remove(o,do_unlink=True)
    return count

def export(name, mats, footprint):
    # Merge by material: authored edge detail without hundreds of draw calls.
    def role(o):
        if 'lifted cover' in o.name:return 'cover'
        if 'release pull' in o.name:return 'pull'
        for prefix,part in [('Nano ITLA','itla'),('Modulator island','cdm'),('Receiver island','icr'),('Driver island','driver'),('TIA island','tia'),('ACC active','acc_chip'),('AEC active','aec_chip')]:
            if o.name.startswith(prefix):return part
        return 'base'
    for part in ['base','cover','pull','itla','cdm','icr','driver','tia','acc_chip','aec_chip']:
        for key,m in mats.items():
            objects = [o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0] == m and role(o) == part]
            if not objects: continue
            bpy.ops.object.select_all(action='DESELECT')
            for o in objects: o.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            bpy.ops.object.join()
            bpy.context.object.name = name+'_'+part+'_'+key
    root = bpy.data.objects.new(name+'_metadata', None); bpy.context.collection.objects.link(root)
    root['ifxMechanical'] = True; root['units'] = 'm'; root['nativeFootprintCm'] = footprint
    root['basis'] = 'Representative mechanical detail; native teaching layout and signal geometry retained.'
    root['lidTreatment'] = 'Complete exploded overview; cover translated only along assembly normal. Runtime qualifies x-ray surfaces for readable internal paths.'
    root['pullTabBasis']='Representative release loop based on public exterior product photographs; excluded from shell footprint claim.'
    if name=='coherent-hardware':root['itlaEnvelopeCm']=[2.5,.65,1.56]
    root['staticGeometry']='All hardware meshes authored in Blender; imported audited circuit geometry refined without rerouting.'
    root['runtimeExceptions']='Animated teaching signals, caption sprites, hotspot/UI indicators, diagram textures and lighting.'
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools'/'blender'/(name+'.blend')))
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')), export_format='GLB', export_yup=True, export_extras=True, export_cameras=False, export_lights=False)
    print('EXPORTED', name, (OUT/(name+'.glb')).stat().st_size)

def by_source(name):
    return [o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('sourceMesh')==name]

def refine_edges(o, width, segments=2):
    # glTF import splits every box face into its own vertices, so a bevel has
    # no connected edges to round. Weld first, then bevel at a real width.
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-7);bpy.ops.object.mode_set(mode='OBJECT')
    if o.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
    for mod in list(o.modifiers):o.modifiers.remove(mod)
    b=o.modifiers.new('Package edge radius','BEVEL');b.width=width*.01;b.segments=segments;b.limit_method='ANGLE';b.harden_normals=True
    bpy.ops.object.modifier_apply(modifier=b.name)
    w=o.modifiers.new('Package weighted normals','WEIGHTED_NORMAL');w.keep_sharp=True
    bpy.ops.object.modifier_apply(modifier=w.name)
    for p in o.data.polygons:p.use_smooth=True

def coherent_board_detail(m):
    """Package and board detail on the imported audited layout (scene cm).
    Representative: no teardown gives package styles or passive placement."""
    T=1.35  # PCB top
    for name,width in [('Coherent DSP die',.008),('Coherent IQ modulator die',.008),('Coherent receiver die',.008),
                       ('Coherent driver package',.016),('Coherent TIA package',.016),('Coherent package substrates',.012),
                       ('Coherent inductors',.035),('Coherent PCB',.005)]:
        for o in by_source(name):refine_edges(o,width,3 if name=='Coherent inductors' else 2)
    m['tin']=mat('Tin-plated terminations',(.70,.71,.72),.9,.3)
    m['cap']=mat('Ceramic capacitor body',(.52,.44,.31),0,.55)
    m['epoxy']=mat('Dark underfill epoxy',(.03,.03,.035),0,.35)
    m['inp']=mat('Cleaved die edge',(.40,.43,.47),.55,.3)
    m['attach']=mat('Fiber attach glass',(.50,.60,.66),0,.12)
    m['gold']=mat('Gold bond pads',(1,.78,.35),1,.18)
    def cap(x,z,along_x=True,size=(.06,.03,.03),body='cap'):
        l,h,w=size;t=l*.2
        box('Board passive',(x,T+h/2,z),(l-2*t,h*.96,w*.96) if along_x else (w*.96,h*.96,l-2*t),m[body],0)
        for s in [-1,1]:
            p=(x+s*(l/2-t/2),T+h/2,z) if along_x else (x,T+h/2,z+s*(l/2-t/2))
            box('Board passive termination',p,(t,h,w) if along_x else (w,h,t),m['tin'],0)
    # DSP: lidless die, dark underfill skirt, decoupling ring, stiffener frame.
    dx=-1.49; S=T+.1  # substrate top
    for s in [-1,1]:
        box('DSP underfill fillet',(dx+s*.585,S+.011,0),(.02,.022,1.19),m['epoxy'],.004)
        box('DSP underfill fillet',(dx,S+.011,s*.585),(1.15,.022,.02),m['epoxy'],.004)
    # Die-edge signal banks (native dspTex and routing) stay clear of capacitors.
    banks=[(49+i*52)/512*1.15-.575 for i in range(4)]+[(301+i*52)/512*1.15-.575 for i in range(4)]
    for s in [-1,1]:
        box('DSP stiffener ring',(dx+s*.78,S+.02,0),(.1,.04,1.66),m['seal'],.01)
        box('DSP stiffener ring',(dx,S+.02,s*.78),(1.46,.04,.1),m['seal'],.01)
    for i in range(10):
        u=-.6+i*.1333
        for s in [-1,1]:
            for x,z,ax in [(dx+s*.68,u,False),(dx+u,s*.68,True)]:
                if not ax and min(abs(u-b) for b in banks)<.045:continue
                l,h,w=.06,.03,.03;t=.012
                box('DSP decoupling capacitor',(x,S+h/2,z),(l-2*t,h*.96,w*.96) if ax else (w*.96,h*.96,l-2*t),m['cap'],0)
                for e in [-1,1]:
                    p=(x+e*(l/2-t/2),S+h/2,z) if ax else (x,S+h/2,z+e*(l/2-t/2))
                    box('DSP decoupling termination',p,(t,h,w) if ax else (w,h,t),m['tin'],0)
    # Driver and TIA: QFN-style tin lands round the package foot; the four RF
    # bond lands per side are the gold pads in the native layout.
    offs=[(58+k*46)/256*.66-.33 for k in range(4)]
    for cx,cz in [(2.85,-.55),(2.85,.55)]:
        for i in range(9):
            u=-.24+i*.06
            for s in [-1,1]:
                box('QFN land',(cx+u,1.4025,cz+s*.287),(.025,.005,.04),m['tin'],0)
                if min(abs(u-o) for o in offs)>.03:box('QFN land',(cx+s*.287,1.4025,cz+u),(.04,.005,.025),m['tin'],0)
    # Optical assemblies: cleaved die edge, ground-signal-ground pads on the RF
    # edge, and a glass fiber-attach block where each fiber meets the die.
    for cx,cz in [(3.92,-.55),(3.92,.55)]:
        for s in [-1,1]:
            box('Photonic die edge',(cx+s*.558,1.415,cz),(.016,.03,.676),m['inp'],.003)
            box('Photonic die edge',(cx,1.415,cz+s*.338),(1.132,.03,.016),m['inp'],.003)
        for o in offs:
            for g,wd in [(-.034,.018),(0,.014),(.034,.018)]:
                box('RF edge bond pad',(3.37+.035,1.4615,cz+o+g),(.04,.003,wd),m['gold'],0)
    for x,z,size in [(4.49,-.55,(.04,.07,.10)),(3.92,-.205,(.10,.07,.03)),(4.49,.55,(.04,.07,.10)),(3.92,.205,(.10,.07,.03))]:
        box('Fiber attach block',(x,1.435,z),size,m['attach'],.005)
    # Inductors: silver end terminations on the rounded molded bodies.
    for i in range(4):
        x=-5.39+1.35+(i%2)*.48;z=-.22 if i<2 else .22
        for s in [-1,1]:box('Inductor termination',(x+s*.158,T+.113,z),(.03,.226,.30),m['tin'],.006)
    # Representative passives and two small controller/PMIC packages, placed
    # clear of every native trace, fiber and animated feed.
    for x,z,l in [(2.36,0,.22),(-4.62,0,.24)]:
        box('Board QFN controller',(x,T+.03,z),(l,.06,l),m['package'],.012)
        for i in range(5):
            u=-l/2+.04+i*(l-.08)/4
            for s in [-1,1]:
                box('Board QFN land',(x+u,T+.002,z+s*(l/2+.012)),(.018,.004,.03),m['tin'],0)
                box('Board QFN land',(x+s*(l/2+.012),T+.002,z+u),(.03,.004,.018),m['tin'],0)
    for z in [-.36+i*.12 for i in range(7)]:cap(-.54,z,False)
    for z in [-.24,-.12,.12,.24]:cap(-2.45,z,False)
    for z in [-.36,-.1,.1,.36]:cap(-3.25,z,False,(.1,.05,.05))
    for s in [-1,1]:
        cap(-4.9,s*.2,False)
        cap(2.36,s*.25,False)

def tube(name, x0, x1, y, z, r, material, n=24, inner=0):
    # A cylinder (or open tube when inner>0) along +x, in scene cm.
    if inner:return annulus(name,((x0+x1)/2,y,z),r,inner,x1-x0,'x',material)
    bpy.ops.mesh.primitive_cylinder_add(vertices=n,radius=r*.01,depth=(x1-x0)*.01,location=xyz(((x0+x1)/2,y,z)),rotation=(0,math.pi/2,0))
    o=bpy.context.object;o.name=name;o.data.materials.append(material)
    for p in o.data.polygons:p.use_smooth=len(p.vertices)==4
    return o

def duplex_lc_receptacle(m):
    # One molded duplex LC receptacle at the module front: two square bores
    # with a stepped mouth and a latch-key slot, a zirconia split sleeve and a
    # ferrule stub face inside each, on a bracket under the board end. The
    # media interface is a duplex LC connector (Cisco 800G ZR/ZR+ datasheet);
    # body styling, sizes and the 6 mm port pitch here are representative.
    m['lcbody']=mat('Molded LC receptacle body',(.055,.06,.066),0,.5)
    m['zirconia']=mat('Zirconia ferrule sleeve',(.86,.85,.80),0,.35)
    x0,x1,y,h,hw=4.78,5.36,1.65,.8,.61
    body=box('LC receptacle body',((x0+x1)/2,y,0),(x1-x0,h,2*hw),m['lcbody'],.03)
    cuts=[]
    for z in [-.3,.3]:
        cuts.append(box('cut',(5.15,y,z),(.46,.46,.46),m['lcbody'],0))           # bore, 4.2 mm deep
        cuts.append(box('cut',(5.36,y,z),(.1,.53,.53),m['lcbody'],0))            # stepped mouth
        cuts.append(box('cut',(5.30,y+.25,z),(.2,.1,.16),m['lcbody'],0))         # latch-key slot
    for c in cuts:
        mod=body.modifiers.new('Port','BOOLEAN');mod.operation='DIFFERENCE';mod.object=c
        bpy.context.view_layer.objects.active=body;bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(c,do_unlink=True)
    for z in [-.3,.3]:
        tube('LC split sleeve',4.93,5.20,y,z,.085,m['zirconia'],32,.0625)
        tube('LC ferrule stub',4.93,5.16,y,z,.0625,m['zirconia'],24)
        tube('LC fiber strain relief',4.70,4.785,y,z,.045,m['boot'],16)
    box('LC receptacle bracket',(4.83,1.23,0),(1.06,.04,1.3),m['edge'],.008)
    for z in [-.45,.45]:screw('LC bracket screw',4.66,1.25,z,m,.04)

def dsp_gap_pad(m, lid_y=3.4, lid_half=.045):
    # The native layout carries a loose pad halfway between board and lid.
    # Replace it with a lid-mounted stack that travels with the cover: a
    # machined pedestal under the lid over the DSP, then a soft gap pad.
    # Representative: pedestal-plus-TIM has no module-specific source.
    for o in list(bpy.context.scene.objects):
        if o.get('sourceMesh')=='Coherent DSP thermal pad':bpy.data.objects.remove(o,do_unlink=True)
    m['gap']=mat('Soft thermal gap pad',(.30,.25,.29),0,.82)
    x=-1.49; under=lid_y-lid_half
    box('OSFP lifted cover DSP pedestal',(x,under-.075,0),(1.46,.15,1.46),m['lid'],.03)
    pad=box('OSFP lifted cover thermal gap pad',(x,under-.15-.06,0),(1.3,.12,1.3),m['gap'],.04)
    pad['sourceMesh']='Coherent DSP thermal pad'

def coherent():
    m=reset(); L=10.78; W=2.258
    box('OSFP lower tray', (0,0,0), (L,.12,W), m['shell'], .045)
    for s in [-1,1]:
        z=s*(W/2-.05)
        box('Folded shell wall',(0,.3,z),(L,.55,.1),m['shell'],.03)
        box('Machined lip',(0,.575,z),(L-.08,.025,.07),m['edge'],.009)
        box('Longitudinal rebate',(0,.16,s*(W/2-.105)),(L-.3,.04,.022),m['dark'],.006)
        for x in [-4.95,-2.8,-.65,1.55,4.95]:
            box('Cast fixing boss',(x,.105,s*.91),(.23,.09,.24),m['shell'],.04)
            screw('Captive fastener',x,.16,s*.91,m)
        for x in [-3.7,-.8,2.15]:
            box('Latch shoulder',(x,.36,z-s*.028),(.6,.16,.055),m['edge'],.02)
            box('Latch recess',(x,.38,z-s*.061),(.4,.055,.009),m['dark'],.004)
    for x in [-4.65,-3.2,-1.6,.1,2.4,4.4]:
        box('Milled tray reinforcement',(x,.071,0),(.08,.022,W-.3),m['edge'],.006)
    # Research-sized nano-ITLA case, not a claimed teardown of any named 800ZR.
    # Everything in the itla semantic group stays within 25 x 15.6 x 6.5 mm.
    ix=.96; y0=1.35
    box('Nano ITLA body',(ix,y0+.29,0),(2.5,.58,1.56),m['shell'],.027)
    box('Nano ITLA gasket',(ix,y0+.586,0),(2.47,.018,1.53),m['dark'],.016)
    cap = box('Nano ITLA welded lid',(ix,y0+.622,0),(2.5,.056,1.56),m['edge'],.024)
    # Cut a real identification recess instead of laying coincident faces on the lid.
    # The lid perimeter still reaches y=2.0, preserving the 6.5 mm package envelope.
    cut = box('Temporary label pocket',(ix-.05,1.997,0),(1.68,.012,.70),m['shell'],.014)
    pocket = cap.modifiers.new('Recessed identification pocket','BOOLEAN'); pocket.operation='DIFFERENCE'; pocket.object=cut
    bpy.context.view_layer.objects.active=cap; bpy.ops.object.modifier_apply(modifier=pocket.name)
    bpy.data.objects.remove(cut,do_unlink=True)
    box('Nano ITLA label recess',(ix-.05,1.992,0),(1.65,.002,.67),m['shell'],.012)
    for j,w in enumerate([.018,.03,.014,.035,.02,.014,.026,.02,.038,.015,.025]):
        box('Nano ITLA identification bar',(ix-.65+j*.065,1.994,.13),(w,.0007,.20),m['mark'],.0002)
    for x in [ix-1.11,ix+1.11]:
        for z in [-.64,.64]:screw('Nano ITLA flush fastener',x,1.989,z,m,.046)
    # Four independent board footprints: closed electronic packages are imported
    # with marked tops; optical assemblies remain open for the photonic schematic.
    for name,cx,cz,length,width in [
        ('Modulator island',3.92,-.55,1.18,.72),
        ('Driver island',2.85,-.55,.61,.61),
        ('Receiver island',3.92,.55,1.18,.72),
        ('TIA island',2.85,.55,.61,.61)]:
        box(name+' carrier',(cx,1.375,cz),(length,.05,width),m['ceramic'],.012)
    duplex_lc_receptacle(m)
    lid('OSFP lifted cover',0,3.4,0,L,W,True,m)
    pull_loop('OSFP release pull',(5.20,.29,0),True,m['pull'])
    internals('coherent')
    coherent_board_detail(m)
    dsp_gap_pad(m)
    export('coherent-hardware',m,[L,W])

def copper_package_mark(name, text, x, z, width, material):
    # Printed package identification: real flat Blender geometry on the molded
    # top, not a floating caption. Align to the connector's host-facing edge.
    curve=bpy.data.curves.new(name, 'FONT');curve.body=text
    curve.align_x='CENTER';curve.align_y='CENTER';curve.size=.001
    curve.space_line=1.12;curve.extrude=0;curve.resolution_u=3
    font=Path('C:/Windows/Fonts/consolab.ttf')
    if font.exists(): curve.font=bpy.data.fonts.load(str(font),check_existing=True)
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj)
    obj.location=xyz((x,1.014,z));obj.data.materials.append(material)
    bpy.context.view_layer.update()
    factor=width*.01/max(obj.dimensions.x,1e-6);obj.scale=(factor,factor,factor)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True)
    bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
    obj['packageMark']=text.replace('\n',' ')

def copper():
    m=reset(); W=2.2; L=6; zc=-.2
    m['ink']=mat('Copper IC printed identification',(.94,.96,.93),0,.75)
    for kind,x in [('DAC',-4.6),('ACC',0),('AEC',4.6)]:
        box(kind+' lower tray',(x,0,zc),(W,.12,L),m['shell'],.065)
        for sign in [-1,1]:
            dx=sign*(W/2-.055)
            box(kind+' sidewall',(x+dx,.205,zc),(.11,.35,L-.15),m['shell'],.028)
            box(kind+' machined lip',(x+dx,.39,zc),(.07,.025,L-.2),m['edge'],.009)
            box(kind+' housing seam',(x+dx-sign*.06,.15,zc),(.016,.03,L-.45),m['dark'],.005)
            for dz in [-2.55,2.55]:
                box(kind+' fixing boss',(x+sign*.87,.08,zc+dz),(.24,.045,.28),m['shell'],.035)
                screw(kind+' fastener',x+sign*.87,.112,zc+dz,m,.067)
            for dz in [-1.8,.8]:
                box(kind+' latch rail',(x+dx-sign*.027,.265,zc+dz),(.055,.13,.7),m['edge'],.018)
                box(kind+' latch recess',(x+dx-sign*.06,.265,zc+dz),(.01,.055,.4),m['dark'],.003)
        for dz in [-1.8,-.8,.3,1.4]:
            box(kind+' tray rib',(x,.069,zc+dz),(W-.3,.019,.07),m['edge'],.005)
        # Rectangular metal shoulders transition into the molded cable boot;
        # there is no unsupported free-standing circular clamp.
        for s in [-1,1]:
            box(kind+' rear shoulder',(x+s*.90,.27,-2.94),(.34,.42,.44),m['shell'],.065)
        cable_cutaway(kind+' sectioned jacket',x,m)
        if kind!='DAC':
            chipx=x+.39 if kind=='ACC' else x
            cw,cd=(.62,.6) if kind=='ACC' else (1.6,.95)
            box(kind+' active package',(chipx,.975,zc),(cw,.07,cd),m['package'],.018)
            # Function first, with a quieter second line. These are printed on
            # the molded chip, independent of floating annotations and layers.
            copper_package_mark(kind+' active function label', 'REDRIVER' if kind=='ACC' else 'RETIMER',chipx,zc-cd*.13,cw*.91,m['ink'])
            copper_package_mark(kind+' active identifier label', 'ACC / RX' if kind=='ACC' else 'AEC DSP',chipx,zc+cd*.22,cw*.56,m['ink'])
        lid(kind+' lifted cover',x,2.3,zc,L,W,False,m)
        copper_pull(kind+' release pull',x,m)
    internals('copper')
    export('copper-hardware',m,[W,L])

# Optional target avoids unrelated asset churn.
targets = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['coherent','copper']
if 'coherent' in targets: coherent()
if 'copper' in targets: copper()

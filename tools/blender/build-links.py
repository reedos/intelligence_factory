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

def lid(name, cx, cy, cz, length, width, along_x, mats):
    # Opaque metal, lifted for inspection. The UI can hide the cover entirely.
    dims=(length,.09,width) if along_x else (width,.09,length)
    box(name+'_cutaway', (cx,cy,cz), dims, mats['lid'], .035)
    if along_x:
        for z in [-width/2+.05,width/2-.05]: box(name+'_fold', (cx,cy,cz+z), (length,.12,.1), mats['edge'])
        for x in [-length/2+.09,length/2-.09]: box(name+'_end', (cx+x,cy,cz), (.18,.12,width-.2), mats['shell'])
        # The photographed coherent OSFP has a broad flat lid and a short
        # transverse bank of fins near the LC end, not full-length fins.
        box(name+'_flat crown',(cx-.38,cy+.065,cz),(length-1.1,.12,width-.18),mats['lid'],.04)
        for i in range(11): box(name+'_fin', (cx+length/2-.63,cy+.18,cz-.8+i*.16), (.48,.3,.035), mats['fin'], .012)
    else:
        for x in [-width/2+.05,width/2-.05]: box(name+'_fold', (cx+x,cy,cz), (.1,.12,length), mats['edge'])
        for z in [-length/2+.09,length/2-.09]: box(name+'_end', (cx,cy,cz+z), (width-.2,.12,.18), mats['shell'])
        # Flat QSFP-style clamshell: no invented cooling ribs. The shallow rear
        # shoulder and inset label landing follow the public QSFP112 DAC photo.
        box(name+'_rear shoulder', (cx,cy+.065,cz-length/2+.58), (width-.14,.13,1.0), mats['lid'], .065)
        box(name+'_label landing', (cx,cy+.048,cz+.35), (width-.65,.008,2.3), mats['shell'], .045)

def boot_stations():
    # Tapered strain-relief overmold (representative: no dimensioned source),
    # 12.4 mm across at the neck collar, easing to the jacket over 25 mm with
    # five flex-relief grooves, then the jacket itself to the end of the cutaway.
    st=[(-3.2,.62),(-3.55,.62)]
    for k in range(5):
        zg=-3.85-k*.4; r=.62-(k+1)*.028
        st+= [(zg+.05,r),(zg+.03,r-.05),(zg-.03,r-.05),(zg-.05,r)]
    st+= [(-5.75,.47),(-5.82,.43),(-6.0,.43)]
    return st

def cable_cutaway(name, cx, mats):
    # Lower half-shell of the boot and jacket: sectioned through the upper half
    # so the modeled conductors remain visible. Not transparent polymer. The
    # section faces carry their own lighter "cut" finish so the cut reads as
    # intentional.
    stations=boot_stations()
    n=32;verts=[]
    for z,r in stations:
        t=.08 if r>.45 else .06
        for radius in [r,r-t]:
            for i in range(n+1):
                a=math.pi+i*math.pi/n
                verts.append(xyz((cx+radius*math.cos(a),.9+radius*math.sin(a),z)))
    faces=[];cut=[];stride=2*(n+1)
    for j in range(len(stations)-1):
        for i in range(n):
            a=j*stride+i;b=a+stride
            faces.extend([(a,a+1,b+1,b),(a+n+1,b+n+1,b+n+2,a+n+2)])
        for i in [0,n]:
            a=j*stride+i;b=a+stride
            cut.append(len(faces));faces.append((a,b,b+n+1,a+n+1))
    for j in [0,len(stations)-1]:
        for i in range(n):
            a=j*stride+i;cut.append(len(faces));faces.append((a,a+n+1,a+n+2,a+1))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
    mesh.materials.append(mats['boot']);mesh.materials.append(mats['cut'])
    for f in cut:mesh.polygons[f].material_index=1
    # Recalculate outward normals on this closed, physically thick section.
    bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False)
    # one material per object: the export joins by first material
    bpy.ops.mesh.separate(type='MATERIAL');bpy.ops.object.mode_set(mode='OBJECT')
    for part in bpy.context.selected_objects:
        part.data.materials[0]=part.data.materials[part.data.polygons[0].material_index]
        for p in part.data.polygons:p.material_index=0;p.use_smooth=True
        while len(part.data.materials)>1:part.data.materials.pop(index=1)
    bpy.ops.object.select_all(action='DESELECT')
    # Crimp collar where the overmold grips the housing neck (lower half).
    n2=24;cv=[]
    for z in [-3.12,-3.32]:
        for r in [.6,.52]:
            for i in range(n2+1):
                a=math.pi+i*math.pi/n2;cv.append(xyz((cx+r*math.cos(a),.9+r*math.sin(a),z)))
    cf=[];st=2*(n2+1)
    for i in range(n2):
        cf+=[(i,i+1,st+i+1,st+i),(n2+1+i,st+n2+1+i,st+n2+2+i,n2+2+i),(i,n2+1+i,n2+2+i,i+1),(st+i,st+i+1,st+n2+2+i,st+n2+1+i)]
    for i in [0,n2]:cf.append((i,st+i,st+n2+1+i,n2+1+i))
    cm=bpy.data.meshes.new(name+' collar');cm.from_pydata(cv,[],cf);cm.update()
    co=bpy.data.objects.new(name+' crimp collar',cm);bpy.context.collection.objects.link(co);cm.materials.append(mats['edge'])
    bpy.context.view_layer.objects.active=co;co.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');co.select_set(False)
    # Beyond the cutaway the jacket is whole: a closed round cable whose cut
    # end faces the viewer, so the pairs run into the cable, not into air.
    bpy.ops.mesh.primitive_cylinder_add(vertices=40,radius=.43*.01,depth=.9*.01,location=xyz((cx,.9,-6.45)),rotation=(math.pi/2,0,0))
    j=bpy.context.object;j.name=name+' closed jacket';j.data.materials.append(mats['boot'])
    b=j.modifiers.new('Jacket edge','BEVEL');b.width=.00012;b.segments=2;b.limit_method='ANGLE'
    bpy.ops.object.modifier_apply(modifier=b.name)
    for p in j.data.polygons:p.use_smooth=len(p.vertices)<=4
    # the cut end facing the cutaway, a hair proud of the cap
    bpy.ops.mesh.primitive_circle_add(vertices=40,radius=.41*.01,fill_type='NGON',location=xyz((cx,.9,-5.994)),rotation=(math.pi/2,0,0))
    c=bpy.context.object;c.name=name+' jacket cut face';c.data.materials.append(mats['cut'])

def copper_pull(name, cx, mats):
    # Flat molded pull tab (representative, photo-inspired): two straps from
    # the stamped de-latch sliders on the housing sides, joining into one
    # 1.2 mm polymer tab that runs back under the boot to a rounded grip.
    import bmesh
    outer=[(-.975,-.9),(-.975,-2.95),(-.62,-3.6),(-.62,-6.05)]
    for k in range(9):
        a=math.pi+k*math.pi/8;outer.append((.62*math.cos(a),-6.05+.3*math.sin(a)))
    outer+=[(.62,-3.6),(.975,-2.95),(.975,-.9),(.94,-.9),(.94,-2.97),(.56,-3.55),(-.56,-3.55),(-.94,-2.97),(-.94,-.9)]
    y0,h=.14,.12
    bm=bmesh.new()
    vb=[bm.verts.new(xyz((cx+u,y0,z))) for u,z in outer]
    face=bm.faces.new(vb)
    ext=bmesh.ops.extrude_face_region(bm,geom=[face])
    for v in [e for e in ext['geom'] if isinstance(e,bmesh.types.BMVert)]:v.co.z+=h*.01
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bmesh.ops.triangulate(bm,faces=[f for f in bm.faces if len(f.verts)>4])
    mesh=bpy.data.meshes.new(name);bm.to_mesh(mesh);bm.free()
    o=bpy.data.objects.new(name+' tab',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(mats['pull'])
    bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=o;o.select_set(True)
    b=o.modifiers.new('Molded edge','BEVEL');b.width=.00018;b.segments=2;b.limit_method='ANGLE'
    bpy.ops.object.modifier_apply(modifier=b.name)
    o.select_set(False)
    # debossed chevrons on the grip
    for k in range(3):
        for sgn in [-1,1]:
            bpy.ops.mesh.primitive_cube_add(size=1,location=xyz((cx+sgn*.14,y0+h-.004,-5.7-k*.16)))
            c=bpy.context.object;c.name=name+' grip chevron';c.dimensions=(.3*.01,.05*.01,.01*.01)
            c.rotation_euler=(0,0,sgn*math.radians(35));c.data.materials.append(mats['dark'])
            bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)

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
        # Swept round conductors (copper twinax) are already smooth tubes: no bevel.
        swept=any(m and m.name.startswith(('Twinax','Tinned drain','Solder fillet')) for m in o.data.materials)
        if not swept:
            b=o.modifiers.new('Manufactured micro edge','BEVEL');b.width=.000015;b.segments=2;b.limit_method='ANGLE'
            bpy.ops.object.modifier_apply(modifier=b.name)
            w=o.modifiers.new('Weighted manufactured normals','WEIGHTED_NORMAL');w.keep_sharp=True
            bpy.ops.object.modifier_apply(modifier=w.name)
        else:
            # The reference arrives unindexed; weld its seams so the tubes shade smooth and export compact.
            bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.remove_doubles(threshold=.0000005);bpy.ops.object.mode_set(mode='OBJECT')
            for p in o.data.polygons:p.use_smooth=True
        for m in o.data.materials:
            if not m or not m.use_nodes:continue
            p=m.node_tree.nodes.get('Principled BSDF')
            if not p:continue
            c=p.inputs['Base Color'].default_value
            if m.name.startswith('Gold contact pads'):
                # Hard gold plating. Partly dielectric response keeps the gold legible where the
                # dark studio surround would otherwise mirror as black.
                p.inputs['Base Color'].default_value=(1.0,.72,.3,1);p.inputs['Metallic'].default_value=.72;p.inputs['Roughness'].default_value=.3
                continue
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
    # Existing duplex LC apertures gain concentric metal sleeves, with an open
    # bore comfortably wider than the optical pulse envelope.
    for z in [-.3,.3]:
        annulus('LC ferrule sleeve',(5.337,1.55,z),.114,.082,.028,'x',m['seal'])
        annulus('LC ferrule recess',(5.322,1.55,z),.132,.114,.012,'x',m['dark'])
    lid('OSFP lifted cover',0,3.4,0,L,W,True,m)
    pull_loop('OSFP release pull',(5.20,.29,0),True,m['pull'])
    internals('coherent')
    export('coherent-hardware',m,[L,W])

def copper_active_package(kind, x, zc, m):
    # Package styles are representative (no teardown of a named cable is
    # public): the AEC DSP as a lidded flip-chip BGA with decoupling
    # capacitors, the ACC redriver as a small leaded QFN. Marks are quiet
    # laser-etch bars and a pin-1 dot; the UI caption carries the function.
    top=.94
    if kind=='ACC':
        cx,cw,cd,h=x+.39,.62,.6,.085
        box('ACC active QFN body',(cx,top+h/2-.001,zc),(cw-.05,h,cd-.05),m['package'],.012)
        for i in range(8):
            t=(i-3.5)*.062
            for s in [-1,1]:
                box('ACC active QFN lead',(cx+s*(cw/2-.03),top+.005,zc+t),(.05,.012,.026),m['lead'],0)
                box('ACC active QFN lead',(cx+t,top+.005,zc+s*(cd/2-.03)),(.026,.012,.05),m['lead'],0)
        box('ACC active pin one mark',(cx-cw/2+.1,top+h+.0006,zc+cd/2-.1),(.045,.001,.045),m['etch'],.02)
        for j,w in enumerate([.16,.11,.2]):
            box('ACC active laser etch',(cx-.02,top+h+.0006,zc-.1+j*.075),(w,.001,.022),m['etch'],0)
        return
    cx,cw,cd=x,1.42,.95
    sub=.1; lw,ld,lh=1.08,.72,.07
    box('AEC active BGA shadow',(cx,top+.011,zc),(cw-.06,.024,cd-.06),m['dark'],.004)
    box('AEC active FCBGA substrate',(cx,top+.024+sub/2,zc),(cw,sub,cd),m['substrate'],.01)
    y=top+.024+sub
    box('AEC active nickel lid',(cx,y+lh/2,zc),(lw,lh,ld),m['nickel'],.02)
    box('AEC active lid sealant',(cx,y+.004,zc),(lw+.025,.008,ld+.025),m['dark'],.003)
    for j,w in enumerate([.3,.2,.36]):
        box('AEC active laser etch',(cx-.15,y+lh+.0006,zc-.12+j*.09),(w,.001,.03),m['etch'],0)
    box('AEC active pin one mark',(cx-lw/2+.09,y+lh+.0006,zc+ld/2-.09),(.05,.001,.05),m['etch'],.025)
    # 0201-size decoupling capacitors on the substrate margin (0.6 x 0.3 mm).
    for i in range(7):
        t=(i-3)*.15
        for s in [-1,1]:
            copper_cap('AEC active decoupling',cx+t,y,zc+s*(ld/2+.06),True,m)
    for i in range(3):
        t=(i-1)*.2
        for s in [-1,1]:
            copper_cap('AEC active decoupling',cx+s*(lw/2+.08),y,zc+t,False,m)

def copper_card_detail(kind, x, zc, m):
    # Paddle-card finish (representative): the ID memory as a leaded SOT-23-
    # class package, the AEC's molded power inductors with end terminations,
    # ground stitching vias between the pairs and plain silkscreen outlines and
    # reference designators (no logos). Positions match the native layout.
    top=.94
    ez=zc+1.95
    box(kind+' ID memory body',(x,top+.045,ez),(.15,.08,.26),m['package'],.012)
    for s in [-1,1]:
        for dz in ([-.09,0,.09] if s<0 else [-.09,.09]):
            box(kind+' ID memory lead',(x+s*.095,top+.005,ez+dz),(.04,.012,.035),m['lead'],0)
    box(kind+' ID memory pin one',(x-.045,top+.0855,ez+.09),(.025,.001,.025),m['etch'],0)
    silk_outline(kind+' silkscreen',x,ez,.2,.34,m)
    if kind=='AEC':
        for i in range(3):
            iz=zc+.78+i*.26
            box(kind+' power inductor body',(x,top+.079,iz),(.2,.16,.17),m['inductor'],.02)
            for s in [-1,1]:
                box(kind+' power inductor termination',(x,top+.059,iz+s*.09),(.18,.12,.022),m['lead'],.006)
    # ground stitching vias: rows midway between neighbouring pairs, clear of
    # the breakout, the packages and the rear termination
    lanes=[-.63+i*.16 for i in range(4)]+[.15+i*.16 for i in range(4)]
    rows=[-.71]+[(lanes[i]+lanes[i+1])/2 for i in range(7) if i!=3]+[.71]
    chip={'ACC':(x+.08,x+.70,zc-.35,zc+.35),'AEC':(x-.76,x+.76,zc-.52,zc+.52)}.get(kind)
    k=0
    for rx in rows:
        for j in range(15):
            vz=2.05-j*.25
            vx=x+rx
            if chip and chip[0]-.04<vx<chip[1]+.04 and chip[2]<vz<chip[3]:continue
            bpy.ops.mesh.primitive_cylinder_add(vertices=6,radius=.018*.01,depth=.004*.01,location=xyz((vx,top+.0015,vz)))
            o=bpy.context.object;o.name=kind+' stitching via';o.data.materials.append(m['via'])
            k+=1
    return k

def silk_outline(name, x, z, w, d, m):
    t=.008
    for s in [-1,1]:
        box(name+' outline',(x+s*w/2,.9415,z),(t,.004,d),m['silk'],0)
        box(name+' outline',(x,.9415,z+s*d/2),(w,.004,t),m['silk'],0)

def copper_cap(name, x, y, z, along_x, m):
    L,Wd,H=.06,.03,.03
    dims=(L,H,Wd) if along_x else (Wd,H,L)
    box(name+' body',(x,y+H/2,z),dims,m['ceramic'],0)
    for s in [-1,1]:
        off=(s*(L/2-.008),0) if along_x else (0,s*(L/2-.008))
        box(name+' termination',(x+off[0],y+H/2,z+off[1]),(.016,H+.002,Wd+.002) if along_x else (Wd+.002,H+.002,.016),m['lead'],0)

def loft_u(name, cx, stations, y0, t, f, material, flip=False, bevel=.018):
    # One closed U-channel section lofted along z through (z, outer width,
    # height) stations: a die-cast half shell with its floor and both walls in
    # one watertight mesh (no coincident faces between separate boxes).
    # flip=True opens it downward: the upper half of the clamshell.
    rings=[]
    for z,w,h in stations:
        prof=[(-w/2,h),(-w/2,0),(w/2,0),(w/2,h),(w/2-t,h),(w/2-t,f),(-w/2+t,f),(-w/2+t,h)]
        rings.append([xyz((cx+u,y0+(h-v if flip else v),z)) for u,v in prof])
    verts=[v for r in rings for v in r];faces=[]
    for j in range(len(rings)-1):
        a0,b0=j*8,(j+1)*8
        for i in range(8):
            k=(i+1)%8;faces.append((a0+i,a0+k,b0+k,b0+i))
    for base in [0,(len(rings)-1)*8]:
        for q in [(7,0,1,6),(6,1,2,5),(5,2,3,4)]:faces.append(tuple(base+i for i in q))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT');bpy.context.view_layer.objects.active=o;o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    if bevel:
        b=o.modifiers.new('Die-cast edge radius','BEVEL');b.width=bevel*.01;b.segments=3;b.limit_method='ANGLE'
        bpy.ops.object.modifier_apply(modifier=b.name)
        w=o.modifiers.new('Face weighted normals','WEIGHTED_NORMAL');w.keep_sharp=True
        bpy.ops.object.modifier_apply(modifier=w.name)
    for p in mesh.polygons:p.use_smooth=True
    o.select_set(False)
    return o

def copper_shell(kind, x, zc, W, m):
    # Two-piece die-cast clamshell at QSFP112 width (about 18.4 mm) and height
    # (8.5 mm), split at a parting line. Length is shortened for the diagram
    # (Type 1 bodies run to 72.4 mm); nose, ledges, bosses, neck, latch and EMI
    # details are representative, informed by exterior photographs.
    zn,zb,zr=zc+3.0,zc-2.2,zc-3.0          # host nose, start of the rear neck, neck end
    lower,upper=.42,.43                     # the two halves meet at 8.5 mm total
    body=[(zn,W,lower),(zb,W,lower),(zb-.35,1.5,lower*.92),(zr,1.12,lower*.86)]
    loft_u(kind+' lower half',x,body,0,.12,.1,m['shell'])
    # closed host nose: a chamfered lip under the card slot and cheeks either side
    box(kind+' nose lip',(x,.18,zn-.07),(W-.26,.18,.14),m['shell'],.05)
    for s in [-1,1]:
        box(kind+' nose cheek',(x+s*(W/2-.2),.295,zn-.06),(.18,.22,.12),m['shell'],.04)
    # card support ledges on both walls and four bosses the card rests on
    for s in [-1,1]:
        box(kind+' card ledge',(x+s*(W/2-.15),.34,zc+.45),(.08,.05,4.4),m['edge'],.012)
        for dz in [-1.75,2.05]:
            bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=.075*.01,depth=.26*.01,location=xyz((x+s*.56,.225,zc+dz)))
            o=bpy.context.object;o.name=kind+' card boss';o.data.materials.append(m['shell'])
            box(kind+' boss insert',(x+s*.56,.356,zc+dz),(.06,.006,.06),m['dark'],0)
    # floor ribs and fasteners
    for dz in [-1.4,-.35,.7,1.5]:
        box(kind+' tray rib',(x,.108,zc+dz),(W-.36,.02,.06),m['edge'],.006)
    for s in [-1,1]:
        for dz in [-1.95,2.45]:
            screw(kind+' fastener',x+s*.42,.1+.0095,zc+dz,m,.06)
    # parting-line groove and the stamped de-latch slider on each side wall
    for s in [-1,1]:
        box(kind+' parting groove',(x+s*(W/2-.004),lower-.05,zc+.4),(.014,.018,5.0),m['dark'],0)
        box(kind+' delatch slider',(x+s*(W/2+.018),.2,zc+.65),(.03,.2,2.7),m['edge'],.01)
        box(kind+' delatch ramp',(x+s*(W/2+.03),.2,zc+2.1),(.05,.12,.26),m['edge'],.018)
        box(kind+' slider window',(x+s*(W/2+.034),.2,zc+.6),(.006,.08,.8),m['dark'],0)
    # EMI grounding band behind the nose: spring fingers on walls and floor
    for s in [-1,1]:
        for i in range(4):
            box(kind+' EMI finger',(x+s*(W/2+.012),.06+i*.09,zn-.45),(.02,.06,.16),m['edge'],0)
    for i in range(9):
        box(kind+' EMI finger',(x+(i-4)*.19,-.008,zn-.45),(.12,.02,.16),m['edge'],0)
    # upper half, lifted straight up for inspection: same outline, recessed label field
    top=2.0
    up=loft_u(kind+' lifted cover upper half',x,body,top,.12,.1,m['lid'],True)
    cut=box('Temporary label pocket',(x,top+lower+.01,zc+.3),(W-.5,.06,2.6),m['lid'],.02)
    pocket=up.modifiers.new('Recessed label field','BOOLEAN');pocket.operation='DIFFERENCE';pocket.object=cut
    bpy.context.view_layer.objects.active=up;bpy.ops.object.modifier_apply(modifier=pocket.name)
    bpy.data.objects.remove(cut,do_unlink=True)
    for s in [-1,1]:
        box(kind+' lifted cover parting edge',(x+s*(W/2-.06),top+.008,zc+.4),(.1,.02,5.2),m['edge'],.006)

def copper():
    m=reset(); W=1.84; L=6; zc=-.2
    m['shell']=mat('Satin die-cast zinc',(.5,.53,.56),.9,.36)
    m['cut']=mat('Sectioned overmold face',(.2,.21,.22),0,.7)
    m['pull']=mat('Molded copper pull tab',(.1,.12,.15),0,.72)
    # Matte polymer: a low specular level keeps the broad studio softbox from
    # sheeting across these flat molded faces.
    for k in ['pull','boot','cut']:
        m[k].node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.15
    m['lead']=mat('Tinned package leads',(.72,.73,.74),1,.28)
    m['etch']=mat('Laser etched package mark',(.2,.22,.24),.1,.62)
    m['substrate']=mat('Dark BGA substrate',(.03,.05,.04),.05,.5)
    m['nickel']=mat('Nickel plated package lid',(.62,.63,.64),1,.24)
    m['inductor']=mat('Molded power inductor',(.15,.15,.16),.1,.6)
    m['via']=mat('ENIG via ring',(.85,.66,.36),.7,.3)
    m['silk']=mat('White silkscreen',(.8,.82,.8),0,.7)
    for kind,x in [('DAC',-4.6),('ACC',0),('AEC',4.6)]:
        copper_shell(kind,x,zc,W,m)
        cable_cutaway(kind+' sectioned jacket',x,m)
        if kind!='DAC':
            copper_active_package(kind,x,zc,m)
        copper_card_detail(kind,x,zc,m)
        copper_pull(kind+' release pull',x,m)
    internals('copper')
    export('copper-hardware',m,[W,L])

# Optional target avoids unrelated asset churn.
targets = sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['coherent','copper']
if 'coherent' in targets: coherent()
if 'copper' in targets: copper()

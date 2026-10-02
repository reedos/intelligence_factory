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

def reweight(o):
    # A boolean leaves smooth-shaded n-gons whose vertex normals lean toward
    # the side walls, which reads as a sloped frustum. Re-weight by face area.
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
    w=o.modifiers.new('Face weighted normals','WEIGHTED_NORMAL');w.keep_sharp=True;w.weight=100
    bpy.ops.object.modifier_apply(modifier=w.name)

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
    ceiling=box(name+'_ceiling plate',(cx,b+.05,cz),(length,.1,width),mats['lid'],.04)
    # Host end: the upper lip of the nose, without fins, with ventilation
    # slots (OSFP MSA Rev 5.0 sec. 3.2, Fig. 3-11); slot sizes are representative.
    nose=.6; x0=cx-length/2
    cut_away(ceiling,[box('cut',(x0+.3,b+.05,cz+k*.26),(.3,.2,.12),mats['lid'],0) for k in range(-3,4)])
    for s in [-1,1]:
        box(name+'_side wall',(cx,b+.1+(H-.1)/2,cz+s*(width/2-wall/2)),(length,H-.1,wall),mats['lid'],.03)
        box(name+'_parting seam',(cx,b+.012,cz+s*(width/2-.004)),(length-.12,.012,.01),mats['dark'],.003)
    for x in [-1,1]:
        box(name+'_parting seam',(cx+x*(length/2-.004),b+.012,cz),(.01,.012,width-.12),mats['dark'],.003)
    n=11; span=width-2*wall-.16
    for i in range(n):
        z=cz-span/2+i*span/(n-1)
        box(name+'_heat sink fin',(cx+nose/2,b+.1+(H-.1-skin)/2,z),(length-nose-.02,H-.1-skin,.05),mats['edge'],.012)
    top=box(name+'_top skin',(cx+nose/2,b+H-skin/2,cz),(length-nose,skin,width),mats['lid'],.04)
    # A shallow label recess where OSFP MSA rev 5.22 Fig. 3-4 recommends the
    # label: 15 x 20 mm on the top face at the fiber end (+x here).
    cut=box('Temporary cover label pocket',(cx+length/2-1.25,b+H,cz),(1.56,.03,2.06),mats['lid'],.01)
    pocket=top.modifiers.new('Label recess','BOOLEAN');pocket.operation='DIFFERENCE';pocket.object=cut
    bpy.context.view_layer.objects.active=top;bpy.ops.object.modifier_apply(modifier=pocket.name)
    bpy.data.objects.remove(cut,do_unlink=True)
    reweight(top)

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

def boot_stations():
    # Tapered strain-relief overmold (representative: no dimensioned source),
    # 12.4 mm across at the neck collar, easing to the jacket over 25 mm with
    # five flex-relief grooves, then the jacket itself to the end of the cutaway.
    # Each groove is a rounded trough (half a cosine, 1.4 mm wide, 0.4 mm deep)
    # so its section reads as a molded flex relief, not a machined sawtooth.
    st=[(-3.2,.62),(-3.55,.62)]
    for k in range(5):
        zg=-3.85-k*.4; r=.62-(k+1)*.028
        for i in range(7):
            u=i/6;st.append((zg+.07-.14*u,r-.04*(1-math.cos(2*math.pi*u))/2))
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
                a=math.pi+.04+i*(math.pi-.08)/n2;cv.append(xyz((cx+r*math.cos(a),.9+r*math.sin(a),z)))
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
    b=j.modifiers.new('Jacket edge','BEVEL');b.width=.0003;b.segments=3;b.limit_method='ANGLE'
    bpy.ops.object.modifier_apply(modifier=b.name)
    for p in j.data.polygons:p.use_smooth=len(p.vertices)<=4
    cable_end_section(name,cx,-6.9,mats)
    # the cut end facing the cutaway, a hair proud of the cap
    bpy.ops.mesh.primitive_circle_add(vertices=40,radius=.41*.01,fill_type='NGON',location=xyz((cx,.9,-5.994)),rotation=(math.pi/2,0,0))
    c=bpy.context.object;c.name=name+' jacket cut face';c.data.materials.append(mats['cut'])

def end_disc(name, cx, cy, z, rx, ry, material, n=24, inner=0):
    # A flat disc (or ring, with inner>0) facing the far end of the cable, -z.
    verts=[];faces=[]
    for i in range(n):
        a=2*math.pi*i/n
        verts.append(xyz((cx+rx*math.cos(a),cy+ry*math.sin(a),z)))
        if inner:verts.append(xyz((cx+inner*math.cos(a),cy+inner*math.sin(a),z)))
    if inner:
        for i in range(n):
            j=(i+1)%n;faces.append((2*j,2*j+1,2*i+1,2*i))
    else:faces.append(tuple(reversed(range(n))))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    if mesh.polygons[0].normal.y<0:mesh.flip_normals()     # Blender +Y is native -z
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);mesh.materials.append(material)
    return o

def cable_end_section(name, cx, z, mats):
    # The cable is cut short behind the boot. Its end shows the construction the
    # opened pairs already carry (representative layout): an overall shield
    # under the jacket, filler, and the eight pairs in their round pack, each two
    # insulated conductors in an oval foil. Layers step 0.03 mm toward the viewer.
    cy=.9;ring=.24;d=.036
    end_disc(name+' end filler',cx,cy,z-.003,.405,.405,mats['endfill'],40)
    end_disc(name+' end overall shield',cx,cy,z-.0045,.385,.385,mats['endfoil'],40,.355)
    for sx in [1,-1]:
        for deg in [157.5,202.5,112.5,247.5]:
            a=math.radians(deg);px=cx+sx*ring*math.cos(a);py=cy+ring*math.sin(a)
            end_disc(name+' end pair foil',px,py+.01,z-.006,.078,.062,mats['endfoil'],20)
            for ox in [-d,d]:
                end_disc(name+' end insulation',px+ox,py,z-.009,d*.92,d*.92,mats['endinsul'],14)
                end_disc(name+' end conductor',px+ox,py,z-.012,.013,.013,mats['endcu'],10)

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
        # Copper traces, vias and gold pads are hundreds of flat boxes: the import leaves every face unwelded, so a
        # bevel finds no shared edge and changes nothing. Weld them and keep them flat-shaded, which exports each
        # box with a third fewer vertices and the same look.
        flat=kind=='copper' and any(m and (m.name.startswith('Gold contact pads') or m.name.startswith('Physical')) for m in o.data.materials)
        if flat:
            bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
            bpy.ops.mesh.remove_doubles(threshold=.0000005);bpy.ops.object.mode_set(mode='OBJECT')
            if o.data.has_custom_normals:bpy.ops.mesh.customdata_custom_splitnormals_clear()
            for p in o.data.polygons:p.use_smooth=False
        elif not swept:
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

# Coherent board layout (scene cm), matching src/scenes/side-coherent.js: the DSP,
# then the driver and TIA beside its line-side edge, then the optics, whose fiber
# ports face the laser and the LC end (OIF HB-CDM / micro-ICR / IC-TROSA: RF at
# the end facing the DSP, fibers at the opposite end).
# Native side-coherent.js layout (design review 10/01/2026): converters behind the power pad, DSP right after,
# shorter optics and the laser moved toward the host so the line fibers reach the LC with gentle bends.
DSPX=-2.80; ANALOGX=-1.35; OPTL=.90; OPTX=-.80+OPTL/2; OPT_END=-.80+OPTL; ITLAX=2.75; TAPX=.85; INDX=[-4.285,-3.945]; IND=.28

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
    dx=DSPX; S=T+.1  # substrate top
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
    for cx,cz in [(ANALOGX,-.55),(ANALOGX,.55)]:
        for i in range(9):
            u=-.24+i*.06
            for s in [-1,1]:
                box('QFN land',(cx+u,1.4025,cz+s*.287),(.025,.005,.04),m['tin'],0)
                if min(abs(u-o) for o in offs)>.03:box('QFN land',(cx+s*.287,1.4025,cz+u),(.04,.005,.025),m['tin'],0)
    # Optical assemblies: cleaved die edge, ground-signal-ground pads on the RF
    # edge, and a glass fiber-attach block where each fiber meets the die.
    for cx,cz in [(OPTX,-.55),(OPTX,.55)]:
        for s in [-1,1]:
            box('Photonic die edge',(cx+s*(OPTL/2+.008),1.415,cz),(.016,.03,.676),m['inp'],.003)
            box('Photonic die edge',(cx,1.415,cz+s*.338),(OPTL+.032,.03,.016),m['inp'],.003)
        for o in offs:
            for g,wd in [(-.034,.018),(0,.014),(.034,.018)]:
                box('RF edge bond pad',(OPTX-OPTL/2+.035,1.4615,cz+o+g),(.04,.003,wd),m['gold'],0)
    # All four fiber ports are on the far (fiber) end: modulator carrier in and
    # light out, receiver signal and local oscillator in (offsets as iqTex/icrTex).
    for z in [-.55,-.55+.33-14/256*.66,.55,.55-.33+24/256*.66]:
        box('Fiber attach block',(OPT_END+.04,1.435,z),(.04,.07,.09),m['attach'],.005)
    # Hard gold on the card-edge pads and bond lands. Plated contacts are not
    # mirror-polished: roughness .55 keeps a gold sheen without the pads near
    # the key light blooming into a white patch in the card-edge close-up.
    for o in by_source('Coherent gold contacts'):
        for mt in o.data.materials:
            p=mt.node_tree.nodes.get('Principled BSDF')
            p.inputs['Base Color'].default_value=(.95,.74,.33,1);p.inputs['Metallic'].default_value=1;p.inputs['Roughness'].default_value=.55
    # Fused tap on a ceramic mount at the laser pigtail's height (1.68 cm), so the
    # pigtail runs straight in; fibers get a glossy acrylate coat.
    box('Fused tap mount',(TAPX,1.49,0),(.24,.28,.14),m['ceramic'],.01)
    for name in ['Coherent CW fiber','Coherent TX fiber','Coherent RX fiber']:
        for o in by_source(name):
            for mt in o.data.materials:
                p=mt.node_tree.nodes.get('Principled BSDF')
                c=p.inputs['Base Color'].default_value;p.inputs['Base Color'].default_value=(c[0],c[1],c[2],1)
                p.inputs['Alpha'].default_value=1;p.inputs['Roughness'].default_value=.25
    # Inductors: silver end terminations on the rounded molded bodies.
    for i in range(4):
        x=INDX[i%2];z=-.22 if i<2 else .22
        for s in [-1,1]:box('Inductor termination',(x+s*(IND/2-.012),T+.113,z),(.03,.226,IND-.04),m['tin'],.006)
    # Representative passives and two small controller/PMIC packages, placed
    # clear of every native trace, fiber and animated feed.
    for x,z,l in [(.85,.5,.22),(-4.605,0,.2)]:
        box('Board QFN controller',(x,T+.03,z),(l,.06,l),m['package'],.012)
        for i in range(5):
            u=-l/2+.04+i*(l-.08)/4
            for s in [-1,1]:
                box('Board QFN land',(x+u,T+.002,z+s*(l/2+.012)),(.018,.004,.03),m['tin'],0)
                box('Board QFN land',(x+s*(l/2+.012),T+.002,z+u),(.03,.004,.018),m['tin'],0)
    # Clear of every native trace, fiber, port and animated feed in the new order.
    # Decoupling beside the centre power channel (z = -0.02), never on it or on its branches.
    for z in [-.12,.12]:
        for dx in [-.15,.15]:cap(ANALOGX+dx,z,False);cap(OPTX+dx*1.4,z,False)
    # (no capacitors between the converters and the DSP: the host lanes jog across that strip to the DSP's balls)
    for s in [-1,1]:
        cap(-4.63,s*.22,False)
    for x in [.55,1.25]:cap(x,.5,False)

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
    reweight(body)
    for z in [-.3,.3]:
        tube('LC split sleeve',4.93,5.20,y,z,.085,m['zirconia'],32,.0625)
        tube('LC ferrule stub',4.93,5.16,y,z,.0625,m['zirconia'],24)
        tube('LC fiber strain relief',4.70,4.785,y,z,.045,m['boot'],16)
    box('LC receptacle bracket',(4.83,1.23,0),(1.06,.04,1.3),m['edge'],.008)
    for z in [-.45,.45]:screw('LC bracket screw',4.66,1.25,z,m,.04)

def osfp_pull_tab(m, x_nose=5.39, reach=.8):
    # Molded pull tab: a rounded tongue with an oval finger hole reaching
    # about 8 mm past the nose, joined by a crossbar to two arms that run back
    # along the side walls to the latch. With it the model stays within the
    # 116 mm maximum Cisco lists for its OSFP 800G modules with pull tab.
    # Color: OSFP MSA rev 5.22 Table 3-3 gives white for 1550 nm modules up to
    # 80 km; it has no coherent row, so white is the nearest entry (assumption).
    # Shape and arm routing are representative.
    m['tab']=mat('Molded release pull tab',(.80,.81,.80),0,.55)
    y,t=.30,.15; hw=.55; cx=x_nose+reach-hw
    outline=[(x_nose-.06,-1.14),(x_nose+.12,-1.14),(x_nose+.28,-hw)]
    outline+=[(cx+hw*math.cos(a),hw*math.sin(a)) for a in [-math.pi/2+i*math.pi/20 for i in range(21)]]
    outline+=[(x_nose+.28,hw),(x_nose+.12,1.14),(x_nose-.06,1.14)]
    verts=[xyz((x,y+d,z)) for d in [-t/2,t/2] for x,z in outline]
    n=len(outline)
    faces=[tuple(range(n))[::-1],tuple(range(n,2*n))]+[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]
    mesh=bpy.data.meshes.new('OSFP release pull tab');mesh.from_pydata(verts,[],faces);mesh.update()
    tab=bpy.data.objects.new('OSFP release pull tab',mesh);bpy.context.collection.objects.link(tab);mesh.materials.append(m['tab'])
    bpy.ops.object.select_all(action='DESELECT');tab.select_set(True);bpy.context.view_layer.objects.active=tab
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.01,depth=.01,location=xyz((cx+.02,y,0)))
    hole=bpy.context.object;hole.scale=(.24,.34,t*3)
    mod=tab.modifiers.new('Finger hole','BOOLEAN');mod.operation='DIFFERENCE';mod.object=hole
    bpy.context.view_layer.objects.active=tab;bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(hole,do_unlink=True)
    b=tab.modifiers.new('Molded edge','BEVEL');b.width=.0003;b.segments=2;b.limit_method='ANGLE'
    bpy.ops.object.modifier_apply(modifier=b.name)
    for p in tab.data.polygons:p.use_smooth=False
    for s in [-1,1]:
        box('OSFP release pull arm',((1.85+x_nose)/2,y,s*1.12),(x_nose-1.85,.16,.04),m['tab'],.012)

def dsp_gap_pad(m, lid_y=3.4, lid_half=.045):
    # The native layout carries a loose pad halfway between board and lid.
    # Replace it with a lid-mounted stack that travels with the cover: a
    # machined pedestal under the lid over the DSP, then a soft gap pad.
    # Representative: pedestal-plus-TIM has no module-specific source.
    for o in list(bpy.context.scene.objects):
        if o.get('sourceMesh')=='Coherent DSP thermal pad':bpy.data.objects.remove(o,do_unlink=True)
    m['gap']=mat('Soft thermal gap pad',(.30,.25,.29),0,.82)
    x=DSPX; under=lid_y-lid_half
    box('OSFP lifted cover DSP pedestal',(x,under-.075,0),(1.46,.15,1.46),m['lid'],.03)
    pad=box('OSFP lifted cover thermal gap pad',(x,under-.15-.06,0),(1.3,.12,1.3),m['gap'],.04)
    pad['sourceMesh']='Coherent DSP thermal pad'

def cut_away(target, cutters):
    for c in cutters:
        mod=target.modifiers.new('Cast pocket','BOOLEAN');mod.operation='DIFFERENCE';mod.object=c
        bpy.context.view_layer.objects.active=target;bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(c,do_unlink=True)
    reweight(target)

def coherent():
    m=reset(); L=10.78; W=2.258
    # A die-cast lower case: satin cast finish, rougher than the machined edges.
    m['shell']=mat('Die-cast lower case',(.34,.39,.44),.8,.42)
    tray=box('OSFP lower tray', (0,0,0), (L,.12,W), m['shell'], .045)
    # Shallow (0.4 mm) cast pockets between stiffening webs replace flat ribs.
    webs=[-5.0,-3.6,-2.2,-.8,.6,2.0,3.4,4.8]
    cut_away(tray,[box('cut',((a+b)/2,.06,0),(b-a-.16,.08,W-.46),m['shell'],0) for a,b in zip(webs,webs[1:])])
    for s in [-1,1]:
        z=s*(W/2-.05)
        wall=box('Folded shell wall',(0,.3,z),(L,.55,.1),m['shell'],.03)
        # Latch pockets sit on the outer faces of the side walls.
        cut_away(wall,[box('cut',(x,.3,s*W/2),(.4,.16,.04),m['shell'],0) for x in [-3.7,-.8,2.15]])
        box('Machined lip',(0,.575,z),(L-.08,.025,.07),m['edge'],.009)
        box('Longitudinal rebate',(0,.16,s*(W/2-.105)),(L-.3,.04,.022),m['dark'],.006)
        # Forward stop: the side walls rise to 7 mm above the module bottom
        # near the nose (OSFP MSA Rev 5.0 sec. 3.2); its position is representative.
        box('Forward stop wall',(-4.7,.295,z),(1.0,.71,.1),m['shell'],.03)
        # Fixing bosses are cast into the walls; captive screws clamp the cover.
        for x in [-4.95,-2.8,-.65,1.55,4.95]:
            box('Cast fixing boss',(x,.3,s*.93),(.23,.5,.2),m['shell'],.03)
            screw('Captive fastener',x,.56,s*.93,m)
        # Front bulkhead pillars and sill frame the LC receptacle opening.
        box('Front bulkhead',(5.25,.305,s*.855),(.1,.49,.35),m['shell'],.02)
    box('Front bulkhead sill',(5.25,.13,0),(.1,.14,1.36),m['shell'],.02)
    # Research-sized nano-ITLA case, not a claimed teardown of any named 800ZR.
    # Everything in the itla semantic group stays within 25 x 15.6 x 6.5 mm.
    ix=ITLAX; y0=1.35
    m['itla']=mat('Nano ITLA nickel case',(.40,.42,.45),.85,.36)
    m['itlalid']=mat('Nano ITLA seam-welded lid',(.47,.50,.53),.85,.33)
    m['kovar']=mat('Kovar fiber feedthrough',(.52,.50,.46),.9,.3)
    m['buffer']=mat('Tight-buffered PM fiber',(.92,.88,.78),0,.4)
    m['flex']=mat('Polyimide flex tail',(.62,.34,.06),0,.45)
    box('Nano ITLA body',(ix,y0+.29,0),(2.5,.58,1.56),m['itla'],.027)
    box('Nano ITLA gasket',(ix,y0+.586,0),(2.47,.018,1.53),m['dark'],.016)
    # A flat seam-welded lid (small edge break, not a frustum) with a raised
    # weld bead just inside its edge. The bead top is the 6.5 mm envelope.
    cap = box('Nano ITLA welded lid',(ix,1.967,0),(2.5,.046,1.56),m['itlalid'],.005)
    for s_ in [-1,1]:
        box('Nano ITLA seam weld',(ix,1.995,s_*(.78-.036)),(2.5-.06,.01,.012),m['itlalid'],.004)
        box('Nano ITLA seam weld',(ix+s_*(1.25-.036),1.995,0),(.012,.01,1.56-.084),m['itlalid'],.004)
    # A real identification recess cut into the lid, holding a flat label.
    cut = box('Temporary label pocket',(ix-.05,1.987,0),(1.68,.012,.70),m['shell'],.014)
    pocket = cap.modifiers.new('Recessed identification pocket','BOOLEAN'); pocket.operation='DIFFERENCE'; pocket.object=cut
    bpy.context.view_layer.objects.active=cap; bpy.ops.object.modifier_apply(modifier=pocket.name)
    bpy.data.objects.remove(cut,do_unlink=True)
    reweight(cap)
    # A matte printed label in the recess: a polished metal floor here caught a
    # glassy specular hotspot. Ink bars are printed on it.
    m['label']=mat('Matte identification label',(.40,.42,.43),0,.82)
    box('Nano ITLA label recess',(ix-.05,1.982,0),(1.65,.002,.67),m['label'],0)
    for j,w in enumerate([.018,.03,.014,.035,.02,.014,.026,.02,.038,.015,.025]):
        box('Nano ITLA identification bar',(ix-.65+j*.065,1.9835,.13),(w,.001,.20),m['mark'],0)
    for x in [ix-1.11,ix+1.11]:
        for z in [-.64,.64]:screw('Nano ITLA flush fastener',x,1.978,z,m,.046)
    # Output: a Kovar feedthrough snout, black strain-relief boot and a
    # tight-buffered PANDA fiber pigtail on the host-facing end, running straight
    # back to the tap; a polyimide flex tail on the fiber-facing end to a
    # board-to-board receptacle (a nano-ITLA vendor page lists a PANDA fiber
    # pigtail and a Molex board connector; which end carries which is drawn).
    ox=ix-1.25; oy=1.68
    tube('ITLA pigtail feedthrough snout',ox-.25,ox+.01,oy,0,.08,m['kovar'],24)
    tube('ITLA pigtail strain relief boot',ox-.5,ox-.25,oy,0,.06,m['boot'],20)
    hx=ix+1.25
    box('ITLA flex tail riser',(hx+.012,1.53,0),(.015,.34,.5),m['flex'],0)
    box('ITLA flex tail run',(hx+.053,1.362,0),(.095,.015,.5),m['flex'],0)
    box('ITLA board-to-board receptacle',(hx+.15,1.39,0),(.1,.08,.56),m['package'],.01)
    # Four independent board footprints: closed electronic packages are imported
    # with marked tops; optical assemblies remain open for the photonic schematic.
    for name,cx,cz,length,width in [
        ('Modulator island',OPTX,-.55,OPTL+.08,.72),
        ('Driver island',ANALOGX,-.55,.61,.61),
        ('Receiver island',OPTX,.55,OPTL+.08,.72),
        ('TIA island',ANALOGX,.55,.61,.61)]:
        box(name+' carrier',(cx,1.375,cz),(length,.05,width),m['ceramic'],.012)
    duplex_lc_receptacle(m)
    lid('OSFP lifted cover',0,3.4,0,L,W,True,m)
    osfp_pull_tab(m)
    internals('coherent')
    coherent_board_detail(m)
    dsp_gap_pad(m)
    export('coherent-hardware',m,[L,W])

def copper_active_package(kind, x, zc, m):
    # Package styles are representative (no teardown of a named cable is
    # public): the AEC DSP as a lidded flip-chip BGA with decoupling
    # capacitors, the ACC redriver as a small leaded QFN. Marks are quiet
    # laser-etch bars and a pin-1 dot; the UI caption carries the function.
    top=.94
    if kind=='ACC':
        cx,cw,cd,h=x+.475,.58,.6,.085
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
    cx,cw,cd=x,1.5,.95
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
    # lanes as side-geometry.js copperLane: banks at 0.15 cm pitch either side of a 0.25 cm half-channel
    lanes=[-(.25+(3-i)*.15) for i in range(4)]+[.25+i*.15 for i in range(4)]
    rows=[(lanes[i]+lanes[i+1])/2 for i in range(7) if i!=3]
    chip={'ACC':(x+.185,x+.765,zc-.35,zc+.35),'AEC':(x-.79,x+.79,zc-.52,zc+.52)}.get(kind)
    k=0
    for rx in rows:
        for j in range(15):
            vz=2.05-j*.25
            vx=x+rx
            if chip and chip[0]-.04<vx<chip[1]+.04 and chip[2]<vz<chip[3]:continue
            # a via reads only as its ring on the card top: one flat hexagon at the old barrel's top face
            ring=[xyz((vx+.018*math.cos(a*math.pi/3),top+.0035,vz+.018*math.sin(a*math.pi/3))) for a in range(6)]
            mesh=bpy.data.meshes.new(kind+' stitching via');mesh.from_pydata(ring,[],[tuple(range(6))]);mesh.update()
            if mesh.polygons[0].normal.z<0:mesh.flip_normals()     # Blender +Z is native up
            o=bpy.data.objects.new(kind+' stitching via',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(m['via'])
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
    m['endfill']=mat('Cable end filler',(.045,.05,.055),0,.8)
    m['endfoil']=mat('Cable end shield foil',(.62,.65,.69),.85,.34)
    m['endinsul']=mat('Cable end insulation',(.8,.78,.72),0,.5)
    m['endcu']=mat('Cable end copper',(.68,.31,.13),.8,.3)
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

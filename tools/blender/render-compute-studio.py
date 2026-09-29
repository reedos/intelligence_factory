"""Real Cycles product renders for modeling review, not web runtime promises."""
import bpy, math
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1]
OUT=ROOT/'research'/'compute-studio-renders';OUT.mkdir(parents=True,exist_ok=True)

def point(camera,target):camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
def area(name,p,power,size,color,target):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;d.color=color
    o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.location=p;point(o,target)

for kind in ['rack','tray','chip']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models'/f'compute-{kind}-gb200.glb'))
    S=bpy.context.scene;S.render.engine='CYCLES';S.cycles.samples=32;S.cycles.use_denoising=True
    S.render.resolution_x=1100;S.render.resolution_y=850;S.render.resolution_percentage=100
    S.render.image_settings.file_format='PNG';S.view_settings.view_transform='AgX'
    S.world=bpy.data.worlds.new('Dark product studio');S.world.use_nodes=True
    S.world.node_tree.nodes['Background'].inputs[0].default_value=(.025,.035,.055,1)
    S.world.node_tree.nodes['Background'].inputs[1].default_value=.3
    scale={'rack':1,'tray':.1,'chip':.01}[kind]
    center={'rack':(0,0,1.10),'tray':(0,0,.035),'chip':(0,0,.027)}[kind]
    camera={'rack':(-2.8,-4.4,2.6),'tray':(-.754,-1.092,.7955),'chip':(-.1625,-.234,.1414)}[kind]
    bpy.ops.object.camera_add(location=camera);cam=bpy.context.object;point(cam,center);cam.data.lens=53;S.camera=cam
    # Add authored shared solder geometry at exact native grid coordinates for
    # package render parity. The web runtime uses the same asset by instancing.
    if kind=='chip':
        for o in S.objects:
            if o.type=='MESH' and any(m.get('ifxCoverSurface')=='ihs' for m in o.data.materials):o.hide_render=True
        previous=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(ROOT/'public/models/compute-solder.glb'))
        source=next(o for o in bpy.data.objects if o not in previous and o.type=='MESH')
        for nX,nZ,pitch,r,y,startX,startZ in [(26,26,.3,.1,.12,-3.75,-3.75),(34,32,.18,.045,2.05,-2.97,-2.79)]:
            for i in range(nX):
                for j in range(nZ):
                    o=source.copy();o.data=source.data;S.collection.objects.link(o)
                    o.location=((startX+i*pitch)*.01,-(startZ+j*pitch)*.01,y*.01);o.scale=(r*.01,)*3
        bpy.data.objects.remove(source,do_unlink=True)
    # A photographic ground, removed from exported hardware. Root's web studio
    # separately supplies its realtime reflection and lighting approximation.
    bpy.ops.mesh.primitive_plane_add(size=200*scale,location=(0,0,-.005*scale));floor=bpy.context.object
    m=bpy.data.materials.new('Studio ground');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(.022,.032,.048,1);p.inputs['Roughness'].default_value=.25;p.inputs['Metallic'].default_value=.35;floor.data.materials.append(m)
    extent={'rack':2.5,'tray':1.1,'chip':.17}[kind]
    e=extent
    area('Broad neutral softbox',(-e,-e,e*1.8),100*e*e,e*1.2,(.86,.93,1),center)
    area('Warm contour softbox',(e,-e*.3,e*.8),70*e*e,e*.9,(1,.83,.64),center)
    area('Cool rear rim',(-e*.6,e,e*.9),100*e*e,e*.7,(.42,.65,1),center)
    S.render.filepath=str(OUT/f'{kind}-cycles.png');bpy.ops.render.render(write_still=True)
    print('STUDIO_RENDER',kind,flush=True)

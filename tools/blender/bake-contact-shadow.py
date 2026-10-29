"""Bake the level-4 rack's soft contact shadow into a small grayscale texture.

The rack level's studio floor ('Physical 0') takes no live cast shadow (compute-art-direction.js, round 2: the key
light's shadow stretched into a black wedge), which left the cabinet floating. This bakes what an offline render shows
instead: the floor's occlusion under the studio's soft lights, from a top orthographic camera, as a separate texture
that compute-blender.js lays on one floor quad at runtime. The shipped GLBs are read only, never re-exported.

  blender -b --python tools/blender/bake-contact-shadow.py -- --accel gb200|h100 [--size 512] [--samples 1024]

Reads public/models/compute-rack-<accel>.glb and its pulled tray, public/models/compute-tray-<accel>.glb, seated
where rack.js pulls it (scene.userData.pulledTray, in three.js metres; PULLED below). Renders the catcher floor with
Cycles on the GPU three times: lit with the hardware, a short-range ambient occlusion, and lit without the hardware.
Writes the shadow (0 = none, 255 = full) as an 8-bit grayscale PNG to public/models/compute-rack-contact-<accel>.png,
covering REGION (three.js x and z, metres). Reruns agree to about 1/255 (GPU sampling and denoising).

GB300 and Rubin share the GB200 cabinet and pulled-tray frame; their bakes differ from GB200's by at most 3/255, so
they reuse its texture (compute-blender.js CONTACT). The H100 rack has its own.

Lighting follows the studio (stage.js envScene('studio'), compute-art-direction.js): the big overhead-front
softbox, the two long overhead strips, a large soft panel along the cool rim's direction, and a dim uniform sky for
the hemisphere fill. No hard key: its shadow is the wedge the round-2 review rejected.
"""
import bpy, bmesh, sys, os, struct, zlib
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opt = lambda name, default: args[args.index(name) + 1] if name in args else default
ACCEL, SIZE, SAMPLES = opt('--accel', 'gb200'), int(opt('--size', '512')), int(opt('--samples', '1024'))
# rack.js scene.userData.pulledTray (x, floor, z) per accelerator, three.js metres; the tray GLB is seated there at scale 1
PULLED = {'gb200': (0, 1.23125, 0.965), 'gb300': (0, 1.23125, 0.965), 'rubin': (0, 1.23125, 0.965), 'h100': (0, 0.8792, 1.015)}
# the baked square in three.js coordinates: centre x, centre z, side (m). Must match compute-blender.js CONTACT_REGION.
REGION = (0.0, 0.0, 3.6)
CUT = 2.4   # metres: geometry above this casts nothing in the bake (see below)
# the texture is 1 - (1 - SOFT * soft) * (1 - CONTACT * contact): the studio lights' soft occlusion, and a short-range
# ambient occlusion within AO_DISTANCE that darkens the line where the cabinet meets the floor
SOFT, CONTACT, AO_DISTANCE = float(opt('--soft', '0.8')), float(opt('--contact', '0.75')), float(opt('--ao', '0.25'))
RIM = float(opt('--rim', '4000'))   # watts
RENDER = SIZE * 2   # rendered at twice the size and box-filtered down

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def import_glb(path, offset=None):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    if offset:
        for o in new:
            if o.parent is None:
                o.location += offset
    return new


three = lambda x, y, z: Vector((x, -z, y))   # three.js (y up) to Blender (z up), as the glTF importer converts
hardware = import_glb(os.path.join(ROOT, 'public', 'models', f'compute-rack-{ACCEL}.glb'))
if ACCEL in PULLED:
    hardware += import_glb(os.path.join(ROOT, 'public', 'models', f'compute-tray-{ACCEL}.glb'), three(*PULLED[ACCEL]))
bpy.context.view_layer.update()

meshes = [o for o in hardware if o.type == 'MESH']
for o in meshes:
    if any(s.material and s.material.name == 'Physical 0' for s in o.material_slots):   # the studio floor itself
        o.hide_render = True
        continue
    # Only what stands on the floor grounds it: the overhead busway, its hangers and the feed drop (above the
    # cabinet's 2.27 m top) would lay a broad, faint band across the stage that no live light casts. Trimmed in
    # memory; the file is not written back.
    if o.data.users > 1:
        o.data = o.data.copy()   # instanced data sits at other heights in other objects
    bm = bmesh.new(); bm.from_mesh(o.data)
    M = o.matrix_world
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if (M @ v.co).z > CUT], context='VERTS')
    bm.to_mesh(o.data); bm.free()
    o.visible_camera = False   # occluders only: the camera sees just the catcher floor
    o.visible_glossy = False
    o.visible_transmission = False

# the catcher floor: white diffuse, a hair larger than the region
cx, cz, side = REGION
bpy.ops.mesh.primitive_plane_add(size=side * 1.5, location=three(cx, 0, cz))
floor = bpy.context.object
mat = bpy.data.materials.new('Catcher')
mat.use_nodes = True
bsdf = mat.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value = (1, 1, 1, 1)
bsdf.inputs['Roughness'].default_value = 1
floor.data.materials.append(mat)

# lights, positions in three.js coordinates
def area(name, size, size_y, at, aim, power):
    data = bpy.data.lights.new(name, 'AREA')
    data.shape = 'RECTANGLE'; data.size = size; data.size_y = size_y; data.energy = power
    light = bpy.data.objects.new(name, data)
    scene.collection.objects.link(light)
    light.location = three(*at)
    light.rotation_euler = (light.location - three(*aim)).to_track_quat('Z', 'Y').to_euler()
    return light

area('Overhead-front softbox', 8, 5, (0, 7, 4), (0, 0, 0), 9000)          # envScene panel(8, 5, ..., 4.5, 0, 7, 4)
for x in (-2.4, 2.4):
    area(f'Overhead strip {x}', 0.9, 14, (x, 8.8, -1), (x, 0, -1), 1500)   # panel(0.9, 14, ..., 1.5, x, 8.8, -1)
# the cool rim from behind and to the right (compute-art-direction.js lights[1]) lights the floor behind the cabinet in
# the live scene, so the softbox's shadow there must not read black; a big soft panel along the rim's direction
area('Rim', 6, 6, (2.46, 4.2, -3.0), (0, 0, 0), RIM)
world = bpy.data.worlds.new('Sky')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (1, 1, 1, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.35
scene.world = world

cam_data = bpy.data.cameras.new('Top')
cam_data.type = 'ORTHO'; cam_data.ortho_scale = side
cam = bpy.data.objects.new('Top', cam_data)
scene.collection.objects.link(cam)
cam.location = three(cx, 10, cz)
cam.rotation_euler = (0, 0, 0)   # looking down -Z (Blender), image up = Blender +Y = three.js -z
scene.camera = cam

scene.render.engine = 'CYCLES'
prefs = bpy.context.preferences.addons['cycles'].preferences
for kind in ('OPTIX', 'CUDA'):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            break
    except TypeError:
        pass
for d in prefs.devices:
    d.use = d.type != 'CPU'
scene.cycles.device = 'GPU'
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 4; scene.cycles.diffuse_bounces = 2; scene.cycles.glossy_bounces = 1
scene.cycles.seed = 7
scene.render.resolution_x = scene.render.resolution_y = RENDER
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
scene.view_settings.view_transform = 'Standard'
scene.view_settings.look = 'None'
scene.render.image_settings.file_format = 'OPEN_EXR'
scene.render.image_settings.color_depth = '32'

tmp = bpy.app.tempdir


def render(name):
    path = os.path.join(tmp, f'{name}.exr')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(RENDER, RENDER, 4)[..., :3].mean(axis=2)
    bpy.data.images.remove(img)
    return px


lit = render('lit')
# the contact term: short-range ambient occlusion (AO_DISTANCE), as an emission so no light enters it
nodes, links = mat.node_tree.nodes, mat.node_tree.links
ao, emit = nodes.new('ShaderNodeAmbientOcclusion'), nodes.new('ShaderNodeEmission')
ao.inputs['Distance'].default_value = AO_DISTANCE; ao.samples = 64
links.new(ao.outputs['AO'], emit.inputs['Strength']); emit.inputs['Color'].default_value = (1, 1, 1, 1)
links.new(emit.outputs['Emission'], nodes['Material Output'].inputs['Surface'])
occlusion = render('ao')
for o in meshes:
    o.hide_render = True
links.new(bsdf.outputs['BSDF'], nodes['Material Output'].inputs['Surface'])
unlit = render('unlit')

soft = np.clip(1 - lit / np.maximum(unlit, 1e-6), 0, 1)
contact = np.clip(1 - occlusion, 0, 1)
shadow = 1 - (1 - SOFT * soft) * (1 - CONTACT * contact)
shadow = shadow.reshape(SIZE, 2, SIZE, 2).mean(axis=(1, 3))   # box filter to SIZE
# fade the last 12% to each edge, so the quad's border never shows even where the faint far shadow reaches it
t = np.clip(np.minimum(np.arange(SIZE), np.arange(SIZE)[::-1]) / (SIZE * 0.12), 0, 1)
t = t * t * (3 - 2 * t)
shadow *= np.outer(t, t)
# Blender image rows run bottom-up (three.js +z at the bottom row); PNG rows run top-down, so the first PNG row is
# three.js -z (the cabinet's rear), which is how a PlaneGeometry rotated -90 degrees about x maps v = 1 to -z.
rows = np.round(shadow[::-1] * 255).astype(np.uint8)

out = os.path.join(ROOT, 'public', 'models', f'compute-rack-contact-{ACCEL}.png')
# PNG filter 2 ('Up': each byte less the one above) on every row: the smooth gradient deflates about 30% smaller
up = np.diff(rows.astype(np.int16), axis=0, prepend=0).astype(np.uint8)
raw = b''.join(b'\x02' + up[i].tobytes() for i in range(SIZE))
chunk = lambda kind, data: struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
with open(out, 'wb') as f:
    f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 0, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
print(f'contact shadow: {out} ({os.path.getsize(out)} bytes), max {shadow.max():.3f}, '
      f'centre {shadow[SIZE // 2, SIZE // 2]:.3f}')

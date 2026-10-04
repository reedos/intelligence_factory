"""Rack-scale service hardware, using the close-up models' material/mechanical
language. Device counts and functional route centers belong to rack.js. Small
passives, fasteners and fabrication marks are representative, not a vendor BOM.
Only the exposed tray receives this detail; repeated closed trays stay batched.
"""
import bpy, json
from pathlib import Path

LAY=json.loads((Path(__file__).resolve().parent/'references'/'rack-tray-layout.json').read_text())

def enhance(accel,m,box,cylinder,material):
    U=.04445
    h100=accel=='h100';rubin=accel=='rubin'
    # the pulled tray's frame in the rack, as rack.js built it (export-native-reference.mjs writes scene.userData.pulledTray)
    PT=LAY['rack']['pulledTray'][accel]
    yb=PT['floor'];pz=PT['z']
    pcb=material('Service solder mask',(.025,.073,.055),.25,.52)
    cap=material('Service ceramic passives',(.12,.14,.15),.2,.56)
    ink=material('Service PCB silkscreen',(.54,.62,.57),.0,.68)
    hose=material('Service coolant hose',(.042,.054,.060),.05,.6)
    # Black-jacketed DC harness with red/black conductor sleeves at the ends:
    # an orange jacket read as the 415 V AC legend color (and as coolant hose).
    power=material('Service insulated DC harness',(.018,.019,.021),.0,.55)
    pos=material('Service DC positive sleeve',(.42,.035,.03),.0,.5)
    neg=material('Service DC negative sleeve',(.02,.02,.022),.0,.4)
    def b(name,p,d,mat,bevel=.0005):return box('Inspection '+name,p,d,mat,1,bevel)
    def screw(x,y,z,r=.002):
        cylinder('Inspection captive fastener',(x,y,z),r,.0013,m['bright'],1)
        b('fastener drive',(x,y+.00075,z),(r*1.25,.0002,r*.25),m['dark'],0)
    def frame(name,x,y,z,w,d):
        for s in [-1,1]:
            b(name,(x+s*w/2,y,z),(.0006,.0002,d),ink,0)
            b(name,(x,y,z+s*d/2),(w,.0002,.0006),ink,0)
    def passives(x,y,z,span,n):
        for i in range(n):
            px=x+(i-(n-1)/2)*span/n
            # 3.2 x 2.1 mm parts cover a pixel or two at the closest camera:
            # one unbeveled 12-triangle body each (no separate terminations).
            b('decoupling body',(px,y,z),(.0032,.0015,.0021),cap,0)
    def tube(name,points,r,mat):
        curve=bpy.data.curves.new('Inspection '+name,'CURVE');curve.dimensions='3D'
        curve.resolution_u=6;curve.bevel_depth=r;curve.bevel_resolution=2
        spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
        for point,(x,y,z) in zip(spline.bezier_points,points):
            point.co=(x,-z,y);point.handle_left_type='AUTO';point.handle_right_type='AUTO'
        obj=bpy.data.objects.new('Inspection '+name,curve);bpy.context.collection.objects.link(obj);obj.data.materials.append(mat)
        # Convert before the exporter batches static hardware by material.
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
    def control_board(name,x,y,z,w,d):
        b(name,(x,y,z),(w,.002,d),pcb,0)
        frame(name+' outline',x,y+.0012,z,w-.004,d-.004)
        for sx in [-1,1]:
            for sz in [-1,1]:screw(x+sx*(w/2-.005),y+.002,z+sz*(d/2-.005),.0016)
        for sz in [-1,1]:passives(x,y+.003,z+sz*d*.37,w*.7,10)
    # The pulled compute tray itself (chassis, boards, plates, memory, fans, front and rear) is not authored here: compute-blender.js seats
    # the tray level's own GLB (compute-tray-<accel>.glb, built by build-compute.py from tray.js / tray-rubin.js) in the rack at the frame
    # rack.js reports, so the two levels draw one tray. What is the rack's own, outside the tray's walls, is its telescoping slide rails.
    for x in [-.254,.254]:
        b('telescopic rail bearing',(x,yb+.003,pz-.29),(.008,.006,1.12),m['graphite'])
        b('telescopic rail slide',(x,yb+.007,pz-.12),(.006,.004,.81),m['bright'])
        for dz in [-.34,.15,.35]:screw(x,yb+.01,pz+dz,.0023)
    # Existing switch inspection tray: socket retainers, passives and board
    # alignment markings add detail without changing the two/four ASIC census.
    if not h100:
        sy=LAY['rack']['base']+LAY['rack']['switchPulled']*U+U/2;sz=.615   # NVL72 opened switch tray, row 16 (nvl72-layout.js)
        sites=[(-.10,-.12),(.10,-.12),(-.10,.06),(.10,.06)] if rubin else [(-.11,-.08),(.11,-.08)]
        for x,dz in sites:
            frame('switch socket outline',x,sy-.009,sz+dz,.112,.112)
            for s in [-1,1]:
                passives(x,sy-.008,sz+dz+s*.059,.083,12)
                for side in [-1,1]:screw(x+side*.049,sy-.001,sz+dz+s*.049,.002)
            # Liquid-cooled switch package: its actual silicon stays underneath.
            b('NVSwitch cold plate',(x,sy+.014,sz+dz),(.091,.010,.091),m['shell'],.003)
            for side in [-1,1]:
                b('switch cold plate seal',(x,sy+.0088,sz+dz+side*.043),(.083,.0015,.0018),m['dark'],0)
                for k in range(6):
                    vx=x+side*.062;vz=sz+dz-.041+k*.016
                    b('switch VRM inductor',(vx,sy-.004,vz),(.012,.010,.012),m['graphite'])
                    b('switch VRM crown',(vx,sy+.0015,vz),(.009,.001,.009),m['shell'],0)
                tube('switch coolant connection',[(x+side*.025,sy+.021,sz+dz),
                    (x+side*.025,sy+.030,sz+dz-.055),(x+side*.025,sy+.030,sz-.33),
                    (side*.185,sy+.023,sz-.39),(side*.185,sy+.023,sz-.45)],.0035,hose)
                cylinder('Inspection switch tube gland',(x+side*.025,sy+.021,sz+dz),.006,.009,m['bright'],1)
            for k in range(5):b('switch plate etch',(x-.012+k*.006,sy+.0192,sz+dz+.018),(.002,.0003,.009),m['etch'],0)
        control_board('switch power distribution',0,sy-.010,sz+.16,.35,.090)
        control_board('switch management board',0,sy-.010,sz+.31,.37,.125)
        for x in [-.15,-.10,-.05,.05,.10,.15]:
            b('switch converter body',(x,sy-.002,sz+.16),(.028,.015,.035),m['graphite'])
            for j in range(3):cylinder('Inspection converter capacitor',(x-.010+j*.010,sy+.007,sz+.194),.003,.013,m['dark'],1)
        b('switch controller',(0,sy-.003,sz+.30),(.036,.009,.040),m['graphite'])
        b('switch boot storage',(.10,sy-.005,sz+.30),(.025,.006,.077),pcb)
        for z in [.277,.300,.323]:b('boot storage package',(.10,sy,sz+z),(.018,.004,.014),m['graphite'])
        cylinder('Inspection switch service battery',(-.10,sy-.002,sz+.32),.012,.006,m['bright'],1)
        for x in [-.16,-.055,.055,.155]:
            for dz in [.265,.285,.325,.355]:
                passives(x,sy-.007,sz+dz,.025,7)
        for side in [-1,1]:
            for k in range(12):passives(side*.187,sy-.009,sz-.28+k*.030,.018,5)
            b('control harness socket',(side*.053,sy-.003,sz+.35),(.032,.012,.013),m['graphite'])
            for k in range(8):b('control harness contact',(side*.053-.012+k*.0035,sy+.0035,sz+.35),(.001,.001,.007),m['bright'],0)
        for side in [-1,1]:
            # Rear blind-mate banks are electrical, with no optical receptacles.
            for x in [side*.055,side*.115,side*.175]:
                b('NVLink blind mate bank',(x,sy-.003,sz-.342),(.045,.018,.042),m['graphite'])
                for k in range(9):b('rear electrical contact',(x-.016+k*.004,sy-.001,sz-.365),(.0015,.009,.004),m['bright'],0)
            tube('switch power harness',[(side*.012,sy+.013,sz-.45),(side*.020,sy+.018,sz-.29),
                (side*.023,sy+.022,sz+.08),(side*.05,sy+.011,sz+.16)],.004,power)
            for z,y in [(sz-.43,sy+.015),(sz+.15,sy+.012)]:cylinder('Inspection DC conductor sleeve',(side*.012 if z<sz else side*.048,y,z),.0048,.012,pos if side>0 else neg,1,'z')
            b('switch power input',(side*.012,sy+.008,sz-.45),(.021,.017,.025),m['graphite'])
            b('switch QD block',(side*.185,sy+.019,sz-.445),(.032,.026,.023),m['shell'])

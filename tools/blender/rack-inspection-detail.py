"""Rack-scale service hardware, using the close-up models' material/mechanical
language. Device counts and functional route centers belong to rack.js. Small
passives, fasteners and fabrication marks are representative, not a vendor BOM.
Only the exposed tray receives this detail; repeated closed trays stay batched.
"""
import bpy

def enhance(accel,m,box,cylinder,material):
    U=.04445
    h100=accel=='h100';rubin=accel=='rubin'
    py=.16+2*(8*U+.004)+4*U if h100 else .12+25*U+U/2   # NVL72: the pulled compute tray, row 25 (nvl72-layout.js)
    yb=py-(4*U if h100 else U/2)
    pz=1.045 if h100 else .965
    depth=.84 if h100 else .9
    pcb=material('Service solder mask',(.025,.073,.055),.25,.52)
    cap=material('Service ceramic passives',(.12,.14,.15),.2,.56)
    ink=material('Service PCB silkscreen',(.54,.62,.57),.0,.68)
    hose=material('Service coolant hose',(.042,.054,.060),.05,.6)
    # Black-jacketed DC harness with red/black conductor sleeves at the ends:
    # an orange jacket read as the 415 V AC legend color (and as coolant hose).
    power=material('Service insulated DC harness',(.018,.019,.021),.0,.55)
    pos=material('Service DC positive sleeve',(.42,.035,.03),.0,.5)
    neg=material('Service DC negative sleeve',(.02,.02,.022),.0,.4)
    # Brushed, less mirror-like lids: flat polished nickel facing the studio
    # softbox bloomed to white blocks at the compute and tp cameras.
    lid=material('Inspection brushed cold plate lid',(.30,.33,.36),.35,.72)
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
    # Folded returns, telescoping bearing channels, captive mounting hardware.
    for x in [-.216,.216]:
        y=py+4*U*.95 if h100 and x<0 else yb+(.035 if h100 else .042)
        b('rolled chassis return',(x,y,pz),(.008,.0025,depth-.014),m['shell'])
        for dz in [-.36,-.18,0,.18,.36]:screw(x,y+.002,pz+dz)
    for x in [-.254,.254]:
        b('telescopic rail bearing',(x,yb+.003,pz-.29),(.008,.006,1.12),m['graphite'])
        b('telescopic rail slide',(x,yb+.007,pz-.12),(.006,.004,.81),m['bright'])
        for dz in [-.34,.15,.35]:screw(x,yb+.01,pz+dz,.0023)
    if h100:
        # Existing eight GPU sinks: socket retainers and captive corners.
        for dz in [.27,.10]:
            for i in range(4):
                x=-.162+i*.108;z=pz+dz
                frame('GPU assembly outline',x,yb+.010,z,.098,.146)
                for sx in [-1,1]:
                    for sz in [-1,1]:screw(x+sx*.046,yb+.026,z+sz*.065,.0023)
                passives(x,yb+.011,z-.073,.080,12)
        # CPU heatsink fin crowns over the two existing CPU base blocks.
        for x in [-.1,.1]:
            for i in range(19):b('CPU fin',(x-.027+i*.003,yb+.264,pz-.24),(.0011,.018,.067),m['shell'],.0002)
            for s in [-1,1]:
                for k in range(4):
                    dx=x+s*(.045+k*.007)
                    for j in range(6):b('DIMM package',(dx+.002,yb+.224,pz-.285+j*.017),(.001,.012,.010),m['graphite'],.0002)
                    for dz in [-.065,.065]:b('DIMM latch',(dx,yb+.21,pz-.24+dz),(.004,.009,.007),m['shell'])
        for i in range(6):
            x=-.185+i*.074
            for dy in [.065,.135]:
                for sx in [-1,1]:
                    for sy in [-1,1]:
                        cylinder('Inspection fan captive corner',(x+sx*.029,yb+dy+sy*.029,pz+depth/2-.012),.002,.002,m['bright'],1,'z')
            for j in range(7):b('PSU intake louver',(x-.024+j*.008,yb+.081,pz-depth/2+.07),(.003,.003,.095),m['shell'])
    else:
        # Supporting power and network hardware occupies the former bare board
        # fields. Placement is schematic; NIC/DPU counts follow this generation.
        control_board('compute power distribution',0,yb+.011,pz+.015,.052,.67)
        for dz in [-.25,-.12,.02,.16,.29]:
            for x in [-.014,.014]:
                b('power connector',(x,yb+.020,pz+dz),(.013,.014,.027),m['graphite'])
                for k in range(3):b('power terminal',(x-.004+k*.004,yb+.0275,pz+dz),(.0015,.001,.016),m['bright'],0)
        for x in [-.009,.009]:tube('supply harness',[(x,yb+.023,pz-.43),(x,yb+.023,pz-.34),(x,yb+.031,pz+.12),(x,yb+.022,pz+.29)],.003,power)
        for side in [-1,1]:
            control_board('network mezzanine',side*.112,yb+.013,pz+.185,.178,.072)
        nic_sites=[(x,.185) for x in [-.175,-.05,.05,.175]]
        if rubin:nic_sites=[(x,z) for x in [-.175,-.05,.05,.175] for z in [.175,.215]]
        for x,dz in nic_sites:
            b('network package',(x,yb+.017,pz+dz),(.024,.005,.024),m['graphite'])
            b('network thermal base',(x,yb+.021,pz+dz),(.028,.003,.029),m['shell'])
            if not rubin:
                for k in range(9):b('network heatsink fin',(x-.0112+k*.0028,yb+.026,pz+dz),(.0009,.008,.027),m['shell'],.0002)
        dpu_sites=[-.048,.048] if accel=='gb200' else [.048]
        for x in dpu_sites:
            control_board('storage control board',x,yb+.012,pz+.305,.043,.068)
            b('DPU thermal assembly',(x,yb+.020,pz+.305),(.028,.013,.041),m['shell'])
            if not rubin:
                for k in range(8):b('DPU cooling fin',(x-.012+k*.0034,yb+.030,pz+.305),(.001,.008,.038),m['shell'],.0002)
        # Small memory and support packages sit around the existing processors;
        # they are illustrative support population rather than exact vendor BOM.
        for side in [-1,1]:
            for dz in [-.31,-.29,-.04,-.02,.12]:
                for x in [side*.075,side*.145]:
                    b('support memory package',(x,yb+.012,pz+dz),(.018,.003,.012),m['graphite'])
                    passives(x,yb+.011,pz+dz+.010,.018,5)
        # Six existing processor cold plates get the same copper/seal/milled-lid
        # construction as the close-up, at their rack diagram coordinates.
        plates=([(-.165,-.23),(-.06,-.23),(.06,-.23),(.165,-.23)] if rubin else [(-.11,-.2),(.11,-.2),(-.11,.08),(.11,.08)])
        for x,dz,w,d,y in [(x,z,.10,.12,yb+.035) for x,z in plates]+[(x,.26,.07,.07,yb+.026) for x in [-.11,.11]]:
            z=pz+dz
            b('cold plate perimeter seal',(x,y,z),(w*.86,.0016,d*.86),m['dark'])
            b('milled cold plate crown',(x,y+.0025,z),(w*.80,.0035,d*.80),lid,.0013)
            # The original coolant lines at x +/- .02 retain clear space.
            for sx in [-1,1]:
                for sz in [-1,1]:screw(x+sx*w*.39,y+.0048,z+sz*d*.37,.0022)
            for k in range(5):b('lid identification mark',(x-.008+k*.004,y+.0044,z),(.0013,.00015,.006),m['etch'],0)
            frame('socket silkscreen',x,yb+.010,z,w+.008,d+.010)
            for sz in [-1,1]:passives(x,yb+.011,z+sz*(d/2+.009),w*.80,12)
            for sx in [-1,1]:
                for k in range(8):
                    xx=x+sx*(w/2+.008);zz=z-d*.36+k*d*.103
                    b('VRM inductor',(xx,yb+.013,zz),(.008,.006,.009),m['graphite'],.0007)
                    b('VRM inductor cap',(xx,yb+.0162,zz),(.006,.0008,.006),m['shell'],.0002)
                    b('power stage',(xx-sx*.007,yb+.011,zz),(.003,.0015,.006),m['dark'],.0002)
        # Solder mask on the unused board margins, representative support
        # passives and thermal vias; no extra accelerator or network devices.
        for x in [-.193,.193]:
            b('board edge',(x,yb+.0096,pz-.05),(.029,.0008,.49),pcb,0)
            for j in range(22):
                z=pz-.282+j*.021
                passives(x,yb+.011,z,.018,4)
                if j%4==0:screw(x,yb+.011,z+.009,.0017)
        if not rubin:
            for i in range(6):
                x=-.15+i*.06
                for s in [-1,1]:
                    b('fan cassette rim',(x+s*.024,yb+.02,pz+.402),(.002,.029,.003),m['shell'])
                    b('fan cassette rim',(x,yb+.02+s*.014,pz+.402),(.048,.002,.003),m['shell'])
        else:
            for x in [-.13,0,.13]:
                for s in [-1,1]:b('modular bay retainer',(x+s*.045,py+.02,pz+.30),(.004,.003,.17),m['bright'])
    # Existing switch inspection tray: socket retainers, passives and board
    # alignment markings add detail without changing the two/four ASIC census.
    if not h100:
        sy=.12+16*U+U/2;sz=.615   # NVL72 opened switch tray, row 16 (nvl72-layout.js)
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

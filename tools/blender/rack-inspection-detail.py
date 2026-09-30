"""Rack-scale service hardware, using the close-up models' material/mechanical
language. Device counts and functional route centers belong to rack.js. Small
passives, fasteners and fabrication marks are representative, not a vendor BOM.
Only the exposed tray receives this detail; repeated closed trays stay batched.
"""
def enhance(accel,m,box,cylinder,material):
    U=.04445
    h100=accel=='h100';rubin=accel=='rubin'
    py=.16+2*(8*U+.004)+4*U if h100 else .12+24*U+U/2
    yb=py-(4*U if h100 else U/2)
    pz=1.045 if h100 else .965
    depth=.84 if h100 else .9
    pcb=material('Service solder mask',(.025,.073,.055),.25,.52)
    cap=material('Service ceramic passives',(.12,.14,.15),.2,.56)
    ink=material('Service PCB silkscreen',(.54,.62,.57),.0,.68)
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
            b('decoupling body',(px,y,z),(.0032,.0015,.0021),cap,.00025)
            for s in [-1,1]:b('solder termination',(px+s*.00145,y,z),(.0005,.0016,.00215),m['bright'],0)
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
        # Six existing processor cold plates get the same copper/seal/milled-lid
        # construction as the close-up, at their rack diagram coordinates.
        plates=([(-.165,-.23),(-.06,-.23),(.06,-.23),(.165,-.23)] if rubin else [(-.11,-.2),(.11,-.2),(-.11,.08),(.11,.08)])
        for x,dz,w,d,y in [(x,z,.10,.12,yb+.035) for x,z in plates]+[(x,.26,.07,.07,yb+.026) for x in [-.11,.11]]:
            z=pz+dz
            b('cold plate perimeter seal',(x,y,z),(w*.86,.0016,d*.86),m['dark'])
            b('milled cold plate crown',(x,y+.0025,z),(w*.80,.0035,d*.80),m['shell'],.0013)
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
        sy=.12+15*U+U/2;sz=.615
        sites=[(-.10,-.12),(.10,-.12),(-.10,.06),(.10,.06)] if rubin else [(-.11,-.08),(.11,-.08)]
        for x,dz in sites:
            frame('switch socket outline',x,sy-.009,sz+dz,.112,.112)
            for s in [-1,1]:
                passives(x,sy-.008,sz+dz+s*.059,.083,12)
                for side in [-1,1]:screw(x+side*.049,sy-.001,sz+dz+s*.049,.002)

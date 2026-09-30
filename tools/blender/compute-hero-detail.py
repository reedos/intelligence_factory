"""Visible product-scale mechanical redesign. No additional functional devices.
Dimensions are representative and keep all audited device/route coordinates.
"""
import bpy, math

def enhance(kind,accel,m,box,cylinder,p3,material):
    titanium=material('Hero bead blasted titanium',(.28,.34,.40),.78,.27)
    ceramic=material('Hero graphite ceramic',(.10,.14,.18),.38,.34)
    dark=material('Hero deep service recess',(.009,.016,.023),.25,.46)
    trim=material('Hero polished edge',(.56,.64,.70),.90,.23)

    def ring(name,p,r,section,u,mat=titanium):
        bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,major_radius=r*u,minor_radius=section*u,location=p3(p,u))
        o=bpy.context.object;o.name=name;o.rotation_euler.x=math.pi/2;o.data.materials.append(mat)
        for f in o.data.polygons:f.use_smooth=True
    def front_frame(name,x,y,z,w,h,t,u,mat=titanium):
        for sy in [-1,1]:box(name+' horizontal',(x,y+sy*(h-t)/2,z),(w,t,t*1.6),mat,u,t*.38)
        for sx in [-1,1]:box(name+' vertical',(x+sx*(w-t)/2,y,z),(t,h-t*2,t*1.6),mat,u,t*.38)

    if kind=='rack':
        # Large visible planes need designed joinery, not only thin highlight lines.
        # Side cover remains a solid protective cover; grooves add no I/O.
        box('Side cover perimeter reveal',(-.315,1.15,0),(.012,2.08,.976),dark,1,.004)
        box('Formed titanium side access panel',(-.326,1.15,0),(.014,2.014,.91),titanium,1,.006)
        for z in [-.42,.42]:box('Recessed longitudinal shoulder',(-.338,1.15,z),(.006,1.91,.020),ceramic,1,.002)
        # Two interrupted channels stiffen one sheet; not extra rack enclosures.
        for z in [-.26,.26]:box('Pressed side stiffener',(-.338,1.15,z),(.009,1.70,.035),titanium,1,.004)
        for y in [.25,2.05]:
            for z in [-.39,.39]:cylinder('Quarter turn panel fastener',(-.345,y,z),.010,.008,trim,1,'x')
        box('Upper fascia insert',(0,2.105,.478),(.445,.165,.025),ceramic,1,.012)
        for y in [2.046,2.164]:box('Fascia chamfer edge',(0,y,.495),(.418,.008,.008),trim,1,.003)
        for x in [-.185,.185]:box('Recessed fascia latch',(x,2.105,.497),(.026,.080,.008),dark,1,.005)
        if accel!='h100':
            layout=['ps']*3+['compute']*8+['switch']*9+['compute']*10+['ps']*3+['mgmt']
            for i in range(34):
                if i in [15,24]:continue
                y=.12+i*.04445+.022225
                front_frame('Service tray machined bezel',0,y,.479,.444,.039,.0045,1)
                # Offset embossed grille over the pre-existing vent half only.
                if layout[i]=='switch' and accel!='rubin':
                    box('Service intake cavity',(-.128,y,.480),(.175,.027,.008),dark,1,.003)
                    for j in range(9):box('Pressed intake louver',(-.20+j*.018,y,.488),(.008,.022,.010),ceramic,1,.002)
                for x in [-.24,.24]:
                    front_frame('Captive recessed latch',x,y,.490,.021,.029,.003,1,trim)
        else:
            # Four real HGX servers; preserve their native fan walls.
            for i in [0,1,3]:
                y=.16+(8*.04445)/2+i*(8*.04445+.004)
                front_frame('HGX service perimeter',0,y,.49,.47,.345,.011,1)
    elif kind=='tray':
        if accel=='rubin':return  # purpose-built modular bay hardware is authored in build-compute.py
        u=.1
        if accel!='h100':
            # Visible machined runners frame the board field, leaving the original
            # coolant tubes and six processor plates unobstructed.
            for x in [-2.14,2.14]:
                box('Chassis titanium runner',(x,.37,0),(.11,.12,8.77),titanium,u,.035)
                for z in [-3.75,-2.0,0,2,3.75]:box('Runner recessed retention pad',(x,.439,z),(.065,.006,.28),dark,u,.01)
            for x in [-1.1,1.1]:
                for z,s in [(1.75,.66),(.2,.9),(-1.55,.9)]:
                    # Broad sculpted shoulders create large reflections at the
                    # overview distance without hiding the coolant fittings.
                    for side in [-1,1]:box('Cold plate forged shoulder',(x+side*s*.32,.751,z),(s*.13,.075,s*.72),titanium,u,.030)
            for i in range(6):
                x=-1.71+i*.76
                ring('Fan inlet rolled lip',(x,.20,2.748),.147,.012,u)
                front_frame('Removable fan cartridge bezel',x,.20,2.733,.375,.354,.025,u)
                for sx in [-1,1]:
                    for sy in [-1,1]:cylinder('Fan captive corner',(x+sx*.151,.20+sy*.137,2.758),.017,.012,trim,u,'z')
            # Four existing E1.S drive sleds get real service faces and cooling ribs.
            for i in range(4):
                x=-1.95+i*.26
                front_frame('Drive sled face',x,.20,4.468,.222,.33,.019,u)
                box('Drive release paddle',(x,.20,4.485),(.13,.22,.018),ceramic,u,.018)
                for z in [3.49,3.67,3.85,4.03,4.21]:box('Drive shell rib',(x,.376,z),(.193,.015,.028),titanium,u,.006)
            # Four existing OSFP cages; an open front frame and pull loop leave
            # the electrical/optical teaching routes free through the apertures.
            for x in [.2,.7,1.2,1.7]:
                front_frame('Folded OSFP cage mouth',x,.24,4.52,.22,.164,.014,u,trim)
                for sx in [-1,1]:box('OSFP insertion guide',(x+sx*.103,.245,4.21),(.014,.15,.47),titanium,u,.005)
                front_frame('OSFP extraction bail',x,.23,4.58,.18,.118,.012,u,titanium)
            # Substantial perimeter treatment over the existing DPU package.
            for center in ([-.35] if accel=='gb300' else [-.8,-.3]):
                for x in [center-.16,center+.16]:box('DPU thermal edge shoulder',(x,.385,3.65),(.025,.065,.58),titanium,u,.01)
        else:
            # Existing two-by-six HGX fan wall, no additional fans. Molded
            # black plastic bezels (the chrome rings read as polished metal).
            molded=material('Hero molded fan bezel',(.022,.025,.029),0,.55)
            for y in [.9,2.6]:
                for i in range(6):
                    x=-1.85+i*.74
                    ring('HGX molded fan inlet',(x,y,4.43),.303,.023,u,molded)
                    front_frame('HGX fan cassette',x,y,4.418,.696,.775,.044,u,molded)
    else:
        u=.01
        # A stepped structural frame around the existing substrate, interrupted
        # corner landings and visible metal/ceramic seams. No new silicon.
        for s in [-1,1]:
            box('Package stiffener deep rail',(0,1.32,s*4.12),(8.34,.27,.15),titanium,u,.06)
            box('Package stiffener deep rail',(s*4.12,1.32,0),(.15,.27,8.04),titanium,u,.06)
            box('Substrate registration shoulder',(0,1.10,s*4.23),(8.48,.20,.12),ceramic,u,.045)
            box('Substrate registration shoulder',(s*4.23,1.10,0),(.12,.20,8.24),ceramic,u,.045)
        for x in [-3.92,3.92]:
            for z in [-3.92,3.92]:
                box('Stepped corner landing',(x,1.405,z),(.31,.075,.31),trim,u,.055)
        # Physical chamfered edge on the existing lifted IHS; center remains the
        # explicitly labeled x-ray surface supplied by the teaching diagram.
        cover=titanium.copy();cover.name='IHS removable flange';cover['ifxCoverSurface']='ihs'
        for s in [-1,1]:
            box('IHS formed peripheral flange',(0,4.69,s*3.43),(7.12,.17,.12),cover,u,.045)
            box('IHS formed peripheral flange',(s*3.53,4.69,0),(.12,.17,6.77),cover,u,.045)

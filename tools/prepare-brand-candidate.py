"""Rebuild review-only Sahib icons from the authoritative inline Amiri logo.
Dev dependencies: fonttools[woff], uharfbuzz, resvg-py, Pillow. No runtime dependency.
"""
from pathlib import Path
from io import BytesIO
import hashlib,json,re,struct
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb
import resvg_py
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'branding'/'sahib-0.2.4';OUT.mkdir(parents=True,exist_ok=True)
font=TTFont(ROOT/'assets/fonts/Amiri-Regular.woff2');font.flavor=None
buf=BytesIO();font.save(buf);data=buf.getvalue();face=hb.Face(data);shape=hb.Font(face);shape.scale=(face.upem,face.upem)
b=hb.Buffer();b.add_str('صاحب');b.guess_segment_properties();hb.shape(shape,b)
width=sum(p.x_advance for p in b.glyph_positions);scale=57/face.upem;x=80-width*scale/2
pens=[];glyphs=font.getGlyphSet();order=font.getGlyphOrder()
for info,pos in zip(b.glyph_infos,b.glyph_positions):
 pen=SVGPathPen(glyphs);glyphs[order[info.codepoint]].draw(TransformPen(pen,(scale,0,0,-scale,x+pos.x_offset*scale,75-pos.y_offset*scale)));pens.append(pen.getCommands());x+=pos.x_advance*scale
word=''.join(pens)
# The arch and ornament are exactly the sidebar artwork. Text is shaped once,
# then outlined so installed launcher artwork never depends on a system font.
logo=f'<g fill="currentColor"><path d="{word}"/></g><g fill="none" stroke="currentColor"><path stroke-width="1.2" d="M25 72V46C25 25 51 18 80 7c29 11 55 18 55 39v26M34 77h92"/><path stroke-width="1" d="M55 94h17m16 0h17m-25-4 4 4-4 4-4-4z"/></g>'
master=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 110" role="img" aria-label="صاحب">{logo}</svg>'
(OUT/'sahib-mark.svg').write_text(master,encoding='utf8')
background='<defs><linearGradient id="bg" x2=".9" y2="1"><stop stop-color="#21433a"/><stop offset="1" stop-color="#071b18"/></linearGradient></defs><rect x="8" y="8" width="240" height="240" rx="54" fill="url(#bg)" stroke="#486d5e" stroke-width="1.3"/>'
icon=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">{background}<g color="#f4b27d" transform="translate(22 47) scale(1.325)">{logo}</g></svg>'
(OUT/'app-icon.svg').write_text(icon,encoding='utf8')
# Transparent mark for Android adaptive safe zone: foreground bounds stay
# within the central 66 of the 108 units; background is a separate full layer.
fg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><g color="#f4b27d" transform="translate(21 31) scale(.4125)">{logo}</g></svg>'
(OUT/'android-foreground.svg').write_text(fg,encoding='utf8');(OUT/'android-monochrome.svg').write_text(fg.replace('#f4b27d','#000000'),encoding='utf8');(OUT/'android-background.svg').write_text('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><path fill="#0b2420" d="M0 0h108v108H0z"/></svg>',encoding='utf8')
(OUT/'android-adaptive-icon.xml').write_text('<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n <background android:drawable="@color/sahib_icon_background"/>\n <foreground android:drawable="@drawable/sahib_icon_foreground"/>\n <monochrome android:drawable="@drawable/sahib_icon_monochrome"/>\n</adaptive-icon>\n',encoding='utf8')
sizes=[16,20,24,32,40,48,64,128,256]
pngs=[]
for n in sizes:
 raw=resvg_py.svg_to_bytes(svg_string=icon,width=n,height=n,skip_system_fonts=True);(OUT/f'icon-{n}.png').write_bytes(raw);pngs.append(raw)
# Each ICO entry is rendered independently at its native size, never enlarged
# from a screenshot or a smaller raster.
head=struct.pack('<HHH',0,1,len(sizes));offset=6+16*len(sizes);entries=[]
for n,raw in zip(sizes,pngs):entries.append(struct.pack('<BBBBHHII',n%256,n%256,0,0,1,32,len(raw),offset));offset+=len(raw)
(OUT/'icon.ico').write_bytes(head+b''.join(entries)+b''.join(pngs))
# Use the existing collapsed-sidebar Sad monogram at tray dimensions.
# The full word loses legibility at 16 px; no unrelated symbol is introduced.
b=hb.Buffer();b.add_str('ص');b.guess_segment_properties();hb.shape(shape,b)
width=sum(p.x_advance for p in b.glyph_positions);scale=43/face.upem;x=32-width*scale/2;parts=[]
for info,pos in zip(b.glyph_infos,b.glyph_positions):
 pen=SVGPathPen(glyphs);glyphs[order[info.codepoint]].draw(TransformPen(pen,(scale,0,0,-scale,x+pos.x_offset*scale,46-pos.y_offset*scale)));parts.append(pen.getCommands());x+=pos.x_advance*scale
tray=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="#0b2420" stroke="#789486" stroke-width="1.2"/><path d="M9 37V24c0-8 11-12 23-17 12 5 23 9 23 17v13" fill="none" stroke="#f4b27d" stroke-width="1.6"/><path fill="#f4b27d" d="{''.join(parts)}"/></svg>'
(OUT/'tray-icon.svg').write_text(tray,encoding='utf8')
for n in [16,20,24,32,48]: (OUT/f'tray-{n}.png').write_bytes(resvg_py.svg_to_bytes(svg_string=tray,width=n,height=n,skip_system_fonts=True))
for name in ['android-foreground','android-monochrome','android-background']:(OUT/f'{name}.png').write_bytes(resvg_py.svg_to_bytes(svg_path=str(OUT/f'{name}.svg'),width=432,height=432,skip_system_fonts=True))
# Simple review contact sheet on both Windows taskbar background tones.
sheet=Image.new('RGB',(1040,480),'#f6f0e7');draw=ImageDraw.Draw(sheet)
for row,bg in [(0,'#f6f0e7'),(1,'#101a1b')]:
 y=row*240;draw.rectangle((0,y,1040,y+240),fill=bg);draw.text((24,y+15),'SAHIB - VECTOR BRAND CANDIDATE / LIGHT' if row==0 else 'SAHIB - VECTOR BRAND CANDIDATE / DARK',fill='#173e32' if row==0 else '#f4b27d')
 x=24
 for n in [128,64,48,32,24,16]:
  im=Image.open(OUT/f'icon-{n}.png');sheet.paste(im,(x,y+65),im);draw.text((x,y+202),f'{n} px',fill='#173e32' if row==0 else '#f4b27d');x+=n+36
 x=780
 for n in [16,24,32]:
  im=Image.open(OUT/f'tray-{n}.png');sheet.paste(im,(x,y+90),im);draw.text((x-3,y+140),f'{n}',fill='#173e32' if row==0 else '#f4b27d');x+=70
sheet.save(OUT/'brand-review.png')
(OUT/'provenance.json').write_text(json.dumps({'authoritativeSource':'index.html .sahib-mark','text':'صاحب','font':'assets/fonts/Amiri-Regular.woff2','fontSHA256':hashlib.sha256((ROOT/'assets/fonts/Amiri-Regular.woff2').read_bytes()).hexdigest(),'fontLicense':'assets/fonts/licenses/amiri-OFL.txt','shaper':'HarfBuzz via uharfbuzz','cropUsed':False,'productionAssetsReplaced':False,'icoSizes':sizes},ensure_ascii=False,indent=2),encoding='utf8')
print(OUT)

# Review-only PWA exports. The actual PWA manifest/icons are unchanged.
for n in [192,512]: (OUT/f'pwa-{n}.png').write_bytes(resvg_py.svg_to_bytes(svg_string=icon,width=n,height=n,skip_system_fonts=True))
(OUT/'OFL-Amiri.txt').write_bytes((ROOT/'assets/fonts/licenses/amiri-OFL.txt').read_bytes())
android_logo=f'<path android:fillColor="#F4B27D" android:pathData="{word}"/><path android:fillColor="#00000000" android:strokeColor="#F4B27D" android:strokeWidth="1.2" android:pathData="M25 72V46C25 25 51 18 80 7c29 11 55 18 55 39v26M34 77h92"/><path android:fillColor="#00000000" android:strokeColor="#F4B27D" android:strokeWidth="1" android:pathData="M55 94h17m16 0h17m-25-4 4 4-4 4-4-4z"/>'
android=f'<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><group android:translateX="21" android:translateY="31" android:scaleX="0.4125" android:scaleY="0.4125">{android_logo}</group></vector>'
(OUT/'sahib_icon_foreground.xml').write_text(android,encoding='utf8');(OUT/'sahib_icon_monochrome.xml').write_text(android.replace('#F4B27D','#000000'),encoding='utf8');(OUT/'android-colors.xml').write_text('<resources><color name="sahib_icon_background">#0B2420</color></resources>',encoding='utf8')

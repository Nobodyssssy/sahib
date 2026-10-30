from pathlib import Path
from io import BytesIO
import json,hashlib
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
ROOT=Path(__file__).resolve().parent.parent
out=ROOT/'native-resources/fonts';out.mkdir(parents=True,exist_ok=True)
report=[]
for p in (ROOT/'assets/fonts').glob('*.woff2'):
 f=TTFont(p);c=f.getBestCmap();report.append({'file':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'glyphCoverage':len(c),'family':f['name'].getDebugName(1),'arabicLabels':all(ord(x) in c for x in 'الفجرالظهرالعصرالمغربالعشاءالمتبقي'),'diacritics':all(x in c for x in [0x64b,0x64e,0x651,0x652])})
# Existing static Arabic UI face; no new family is needed for the release.
f=TTFont(ROOT/'assets/fonts/Tajawal-Medium.woff2');f.flavor=None;f.save(out/'Tajawal-Medium.ttf')
(ROOT/'native-resources/fonts/OFL-Tajawal.txt').write_bytes((ROOT/'assets/fonts/licenses/tajawal-OFL.txt').read_bytes())
# Comparison-only candidates are not bundled in the release resources.
for p in (ROOT/'.qa/font-candidates').glob('*.ttf'):
 if p.name.startswith('subset-'): continue
 f=TTFont(p);axes={a.axisTag: min(a.maxValue,max(a.minValue,500 if a.axisTag=='wght' else a.defaultValue)) for a in f['fvar'].axes};f=instantiateVariableFont(f,axes,inplace=False);o=subset.Options();o.layout_features=['*'];o.notdef_glyph=True;o.recalc_bounds=True
 s=subset.Subsetter(options=o);s.populate(unicodes=list(range(0x20,0x250))+list(range(0x600,0x700))+list(range(0x750,0x780))+list(range(0x870,0x900))+[0x200c,0x200d,0x200e,0x200f,0x202f,0x2066,0x2067,0x2069]);s.subset(f)
 target=p.with_name('subset-'+p.name);f.save(target);report.append({'file':p.name,'sourceBytes':p.stat().st_size,'subsetBytes':target.stat().st_size,'family':f['name'].getDebugName(1),'shapingTables':[t for t in ['GSUB','GPOS','GDEF'] if t in f],'packaged':False})
audit=ROOT/'.qa/font-candidates/audit.json';audit.parent.mkdir(parents=True,exist_ok=True)
audit.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8');print(json.dumps(report,ensure_ascii=False,indent=2))

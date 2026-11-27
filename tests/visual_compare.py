"""Compare actual 1774×887 UI captures against the approved reference.
Pixel error includes intentional patch-value differences and is not an acceptance score.
DOM geometry is independently asserted by browser.js against docs/LAYOUT.md.
"""
from pathlib import Path
from PIL import Image, ImageChops, ImageEnhance
import json
root=Path(__file__).resolve().parent.parent
out=root/'work'/'validation'
out.mkdir(parents=True,exist_ok=True)
reference=Image.open(root/'docs'/'reference.png').convert('RGB')
passes={'A-typography':root/'work'/'pass2.png','B-geometry':root/'work'/'pass4.png','C-final':out/'final.png'}
regions={'whole':(0,0,1774,887),'branding':(43,13,1732,91),'upper-bank':(52,112,1723,343),'lower-bank':(52,368,1725,554),'keyboard':(224,597,1706,841)}
report={'reference_size':reference.size,'note':'MAE includes different parameter values, texture, glyphs and lighting. Zero DOM error is against the manually measured reference map, not automatic image feature detection.','passes':{}}
for name,path in passes.items():
    capture=Image.open(path).convert('RGB')
    assert capture.size==reference.size,(path,capture.size)
    Image.blend(reference,capture,.5).save(out/(name+'-overlay.png'))
    difference=ImageChops.difference(reference,capture)
    ImageEnhance.Contrast(difference).enhance(3).save(out/(name+'-difference.png'))
    metrics={}
    for key,box in regions.items():
        crop=difference.crop(box)
        hist=crop.histogram()
        metrics[key]=round(sum((i%256)*count for i,count in enumerate(hist))/(crop.width*crop.height*3),3)
    report['passes'][name]={'source':str(path.relative_to(root)),'mean_absolute_error_0_to_255':metrics}
(out/'visual.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

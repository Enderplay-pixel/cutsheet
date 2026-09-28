import json,statistics as st,colorsys
d=json.load(open('docs/praesentation/design-messung/systeme.json'))
def m(k): v=[x[k] for x in d]; return dict(median=st.median(v),min=min(v),max=max(v))
out={k:m(k) for k in ['body','lh','space','focus','control']}
out['lh_ratio']=dict(median=round(st.median([x['lh']/x['body'] for x in d]),3))
rad=[r for x in d for r in x['radius'] if r>0]; out['radius']=dict(median=st.median(rad),werte=sorted(set(rad)))
dur=[t for x in d for t in x['dur']]; out['dur']=dict(median=st.median(dur),p25=sorted(dur)[len(dur)//4],p75=sorted(dur)[3*len(dur)//4])
def hue(h):
  h=h.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]; H,L,S=colorsys.rgb_to_hls(r,g,b); return round(H*360),round(S*100),round(L*100)
hs=[(x['system'],x['accent'],hue(x['accent'])) for x in d]; out['akzente']=hs
blau=[h for h in hs if 200<=h[2][0]<=235]; out['anteil_blau']=f"{len(blau)}/{len(hs)}"
print(json.dumps(out,indent=1,ensure_ascii=False))
json.dump(out,open('docs/praesentation/design-messung/stat.json','w'),ensure_ascii=False,indent=1)

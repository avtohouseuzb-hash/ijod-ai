import { ImageResponse } from "next/og";
import { createElement as h } from "react";

export const runtime = "edge";

type Rate = { code: string; rate: number; nominal: number; diff: number | null; flag: string };

function formatRate(value: number) {
  return new Intl.NumberFormat("uz-UZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const date = params.get("date") || "";
  let rates: Rate[];
  try {
    rates = JSON.parse(params.get("rates") || "[]");
  } catch {
    return new Response("Invalid rates", { status: 400 });
  }
  if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date) || !Array.isArray(rates) || rates.length < 7 || rates.length > 12 ||
      rates.some(item => !item || typeof item.code !== "string" || !Number.isFinite(item.rate) || !Number.isFinite(item.nominal))) {
    return new Response("Invalid currency data", { status: 400 });
  }
  const rows = rates.map((item, index) => h("div", {
    key: item.code,
    style: { display:"flex", alignItems:"center", height:index===0?112:104, padding:"0 42px", borderBottom:index===rates.length-1?"none":"2px dashed #d4d4d4", background:"#ffffff" }
  },
    h("div", { style:{ width:62,height:62,borderRadius:40,background:"#f0f2f5",color:"#1d3557",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:800} }, item.flag),
    h("div",{style:{marginLeft:24,width:500,display:"flex",alignItems:"center",fontSize:35,color:"#252a31"}},
      h("span",{style:{fontWeight:800}},item.nominal>1?String(item.nominal)+" "+item.code:item.code),
      h("span",{style:{marginLeft:14,fontWeight:400}},"= "+formatRate(item.rate))
    ),
    h("div",{style:{marginLeft:"auto",width:190,textAlign:"right",fontSize:30,color:item.diff===null?"#777":item.diff>0?"#218653":item.diff<0?"#c65c60":"#777"}},
      item.diff===null?"—":(item.diff>0?"+":"")+formatRate(item.diff)
    ),
    h("div",{style:{width:76,textAlign:"right",fontSize:44,fontWeight:700,color:item.diff===null?"#999":item.diff>0?"#218653":item.diff<0?"#c65c60":"#999"}},item.diff===null?"·":item.diff>0?"↗":item.diff<0?"↘":"→")
  ));
  const tree = h("div",{style:{width:"100%",height:"100%",display:"flex",flexDirection:"column",background:"#f7f6ed",fontFamily:"Arial",padding:"30px 34px"}},
    h("div",{style:{height:142,display:"flex",alignItems:"center",justifyContent:"center",fontSize:46,fontWeight:800,color:"#252a31",letterSpacing:1}},"IJOD AI  ·  VALYUTA KURSLARI"),
    h("div",{style:{height:70,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,color:"#646b72"}},"O‘ZBEKISTON MARKAZIY BANKI  ·  "+date),
    h("div",{style:{display:"flex",flexDirection:"column",borderRadius:22,overflow:"hidden",border:"1px solid #e4e4e4",background:"#fff"}},...rows),
    h("div",{style:{marginTop:22,display:"flex",justifyContent:"space-between",fontSize:20,color:"#6b7077",padding:"0 12px"}},"Kurslar so‘mda ko‘rsatilgan","Manba: cbu.uz")
  );
  return new ImageResponse(tree,{width:1080,height:1350});
}

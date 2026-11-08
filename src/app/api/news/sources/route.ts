import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function parsedSafeOrigin(value:string){try{return new URL(value).origin}catch{return ""}}

async function admin(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceKey = process.env.SUPABASE_SECRET_KEY;
  if (!token || !url || !publicKey || !serviceKey) return { response: NextResponse.json({error:"Ruxsat yo‘q."},{status:401}) };
  const auth = createClient(url, publicKey, {auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error} = await auth.auth.getUser(token);
  if (error || !user?.email) return {response:NextResponse.json({error:"Hisobingizga kiring."},{status:401})};
  const allowed = (process.env.AI_NEWS_ADMIN_EMAILS || "").split(",").map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(user.email.toLowerCase())) return {response:NextResponse.json({error:"Admin huquqi yo‘q. AI_NEWS_ADMIN_EMAILS sozlang."},{status:403})};
  return {db:createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}})};
}
const topicGroups:Record<string,string[]> = {
 "Huquq":["O‘zbekiston qonunchiligi","Xalqaro huquq","Sud va huquqiy amaliyot","Normativ hujjatlar"],
 "Fan":["Fizika","Kimyo","Matematika","Biologiya","Astronomiya","Geologiya","Ekologiya","Tibbiyot","Ilmiy izlanishlar","Sog‘lom turmush","Ta’lim texnologiyalari","Yangi metodlar","Ilmiy tadqiqotlar","Oliy ta’lim"],
 "AI va IT":["Sun’iy intellekt","Dasturlash","Kiberxavfsizlik","Robototexnika","IT kompaniyalar","Startap texnologiyalari","Avtomobil","Maishiy texnika","Transport"],
 "O‘zbekiston":["Davlat","Jamiyat","Hududlar","Ijtimoiy yangiliklar","Siyosat","Kadastr","Me’yorlar","Oliy ta’lim"],
 "Jahon":["Jahon yangiliklari","Geosiyosat","Xalqaro munosabatlar","Davlatlar","Tarix","Kitoblar","Kino","San’at","Hajviya","Trendlar","Qiziqarli faktlar","Fantastika"],
 "Iqtisodiyot":["Jahon iqtisodiyoti","Bozorlar","Savdo","Sanoat","Makroiqtisodiyot","Bank","Kredit","Investitsiya","Soliq","Sug‘urta","Fintech","Qurilish texnologiyalari","Qurilish materiallari","Uy-joy bozori","Ijara","Ipoteka","Arxitektura","Mebel","Interyer","Eksteryer","Dizayn materiallari","Ishlab chiqarish"],
 "Biznes":["Tadbirkorlik","Marketing","Menejment","Biznes yangiliklari"],
 "Sport":["Sport"]
};
const parentCategory:Record<string,string> = {
 "Huquq":"O‘zbekiston","Fan":"Fan","AI va IT":"AI va IT","O‘zbekiston":"O‘zbekiston","Jahon":"Jahon",
 "Iqtisodiyot":"Iqtisodiyot","Bank va moliya":"Iqtisodiyot","Qurilish":"Iqtisodiyot","Ko‘chmas mulk":"Iqtisodiyot",
 "Mebel va dizayn":"Iqtisodiyot","Texnika":"AI va IT","Ta’lim":"Fan","Madaniyat":"Jahon",
 "Ko‘ngilochar":"Jahon","Biznes":"Biznes","Salomatlik":"Fan","Sport":"Sport"
};
const categories=[...Object.keys(topicGroups),"Bank va moliya","Qurilish","Ko‘chmas mulk","Mebel va dizayn","Texnika","Ta’lim","Madaniyat","Ko‘ngilochar","Salomatlik"];
const allTopics=new Set([...categories,...Object.values(topicGroups).flat()]);
const sourceGroups=["RSS manbalari","Rasmiy davlat saytlari","Yangilik portallari","Xalqaro tashkilotlar","Ilmiy jurnallar va tadqiqotlar","Kompaniya va banklarning rasmiy yangiliklari","Normativ-huquqiy hujjatlar portallari","Administrator kiritgan maxsus URL"];
const sourceGroups=["RSS manbalari","Rasmiy davlat saytlari","Yangilik portallari","Xalqaro tashkilotlar","Ilmiy jurnallar va tadqiqotlar","Kompaniya va banklarning rasmiy yangiliklari","Normativ-huquqiy hujjatlar portallari","Ochiq API manbalari","Administrator kiritgan maxsus URL"];
export async function GET(request:Request){
 const a=await admin(request); if(a.response)return a.response;
 const {data,error}=await a.db.from("news_sources").select("id,name,feed_url,site_url,source_group,connector_type,category,enabled").order("category").order("name");
 if(error)return NextResponse.json({error:error.message},{status:500});
 return NextResponse.json({sources:data||[]});
}
export async function POST(request:Request){
 const a=await admin(request); if(a.response)return a.response;
 let b:any; try{b=await request.json()}catch{return NextResponse.json({error:"Noto‘g‘ri so‘rov."},{status:400})}
 if(b.action==="toggle"){
  if(typeof b.id!=="string"||typeof b.enabled!=="boolean")return NextResponse.json({error:"ID yoki holat noto‘g‘ri."},{status:400});
  const {error}=await a.db.from("news_sources").update({enabled:b.enabled}).eq("id",b.id);
  return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({ok:true});
 }
 if(b.action==="delete"){
  if(typeof b.id!=="string")return NextResponse.json({error:"ID noto‘g‘ri."},{status:400});
  const {error}=await a.db.from("news_sources").delete().eq("id",b.id);
  return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({ok:true});
 }
 const name=typeof b.name==="string"?b.name.trim().slice(0,120):"";
 const feedUrl=typeof b.feedUrl==="string"?b.feedUrl.trim():"";
 const category=typeof b.category==="string"?b.category:"";
 const sourceGroup=typeof b.sourceGroup==="string"?b.sourceGroup:"RSS manbalari";
 const siteUrl=typeof b.siteUrl==="string"?b.siteUrl.trim():parsedSafeOrigin(feedUrl);
 let parsed:URL; try{parsed=new URL(feedUrl)}catch{return NextResponse.json({error:"RSS/API URL noto‘g‘ri."},{status:400})}
 if(!["https:","http:"].includes(parsed.protocol)||!name||!allTopics.has(category)||!sourceGroups.includes(sourceGroup))return NextResponse.json({error:"Sayt nomi, URL yoki mavzu noto‘g‘ri."},{status:400});
 if(sourceGroup==="Ochiq API manbalari")return NextResponse.json({error:"JSON API connector hali ulanmagan. Hozircha RSS/Atom feed URL kiriting."},{status:400});
 const topicGroup=Object.entries(topicGroups).find(([,topics])=>topics.includes(category))?.[0] || category;
 const normalizedCategory=parentCategory[topicGroup] || topicGroup;
 const {data:existing}=await a.db.from("news_sources").select("id").eq("feed_url",feedUrl).maybeSingle();
 const values={name,feed_url:feedUrl,site_url:siteUrl,source_group:sourceGroup,connector_type:"rss",category:normalizedCategory,language:"multi",enabled:true};
 const result=existing?await a.db.from("news_sources").update(values).eq("id",existing.id):await a.db.from("news_sources").insert(values);
 if(result.error)return NextResponse.json({error:result.error.message},{status:500});
 return NextResponse.json({ok:true});
}

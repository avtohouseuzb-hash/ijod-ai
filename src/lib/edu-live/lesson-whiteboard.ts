import type { EduLiveWhiteboardCommand, EduLiveWhiteboardPayload } from "./types";
import type { EduTutorBoardPlan } from "@/components/edu-tutor-lesson-board";
function wrap(value:string,max:number,count:number):string[]{const out:string[]=[];let current="";for(const word of value.trim().split(/\s+/).filter(Boolean)){const next=current?current+" "+word:word;if(next.length>max&&current){out.push(current);current=word;if(out.length>=count)break;}else current=next;}if(current&&out.length<count)out.push(current);return out;}
export function buildEduLiveWhiteboard(board:EduTutorBoardPlan):EduLiveWhiteboardPayload{
 const commands:EduLiveWhiteboardCommand[]=[{id:"clear",type:"clear",delayMs:0},{id:"title",type:"title",text:board.title.slice(0,90),color:"#6d28d9",delayMs:250}];
 wrap(board.explanation,76,2).forEach((line,i)=>commands.push({id:`explanation-${i}`,type:"text",x:52,y:130+i*34,text:line.slice(0,115),fontSize:21,color:"#334155",delayMs:350}));
 board.steps.slice(0,4).forEach((step,i)=>{const y=225+i*56;commands.push({id:`step-box-${i}`,type:"rect",x:48,y:y-28,width:904,height:42,stroke:"#ddd6fe",fill:"#faf5ff",delayMs:280});commands.push({id:`step-text-${i}`,type:"text",x:66,y,text:`${i+1}. ${(wrap(step,82,1)[0]??"").slice(0,110)}`,fontSize:18,color:"#263247",delayMs:280});});
 const nodes=board.diagram?.nodes?.slice(0,4)??[];if(nodes.length){const gap=18,w=Math.floor((904-gap*(nodes.length-1))/nodes.length),y=510;nodes.forEach((node,i)=>{const x=48+i*(w+gap);commands.push({id:`node-box-${i}`,type:"rect",x,y:y-27,width:w,height:58,stroke:"#0284c7",fill:"#f0f9ff",delayMs:350});commands.push({id:`node-text-${i}`,type:"text",x:x+8,y:y+5,text:wrap(node,22,2).join(" ").slice(0,44),fontSize:16,color:"#075985",delayMs:250});if(i<nodes.length-1&&["flow","timeline"].includes(board.diagram.kind))commands.push({id:`node-arrow-${i}`,type:"arrow",x:x+w,y,width:gap,height:0,stroke:"#7c3aed",delayMs:240});});}
 const key=board.formula||board.summary;if(key)wrap(key,78,2).forEach((line,i)=>commands.push({id:`key-${i}`,type:"text",x:52,y:625+i*30,text:line.slice(0,110),fontSize:19,color:"#6d28d9",delayMs:250}));
 if(board.checkQuestion)commands.push({id:"check",type:"text",x:52,y:710,text:("O‘zingni tekshir: "+board.checkQuestion).slice(0,110),fontSize:17,color:"#047857",delayMs:250});
 commands.push({id:"finish",type:"finish",delayMs:0});return{version:1,width:1000,height:760,commands:commands.slice(0,100)};
}
export function validateEduLiveWhiteboard(p:EduLiveWhiteboardPayload):boolean{
 if(!p||p.version!==1||p.width!==1000||p.height!==760||!Array.isArray(p.commands)||p.commands.length>100)return false;const ids=new Set<string>();
 for(const c of p.commands){if(!c||typeof c.id!=="string"||!/^[a-z0-9_-]{1,64}$/i.test(c.id)||ids.has(c.id))return false;ids.add(c.id);if(c.delayMs!==undefined&&(!Number.isInteger(c.delayMs)||c.delayMs<0||c.delayMs>8000))return false;
 if(c.type==="title"&&(typeof c.text!=="string"||c.text.length>100))return false;
 if(c.type==="text"&&(!Number.isFinite(c.x)||c.x<0||c.x>1000||!Number.isFinite(c.y)||c.y<0||c.y>760||typeof c.text!=="string"||c.text.length>120))return false;
 if(c.type==="formula"&&(!Number.isFinite(c.x)||c.x<0||c.x>1000||!Number.isFinite(c.y)||c.y<0||c.y>760||typeof c.expression!=="string"||c.expression.length>120))return false;
 if(c.type==="rect"&&(![c.x,c.y,c.width,c.height].every(Number.isFinite)||c.x<0||c.y<0||c.width<0||c.height<0||c.x+c.width>1000||c.y+c.height>760))return false;
 if(c.type==="arrow"&&(![c.x,c.y,c.width,c.height].every(Number.isFinite)||c.x<0||c.y<0||c.x+c.width>1000||c.y+c.height>760))return false;}return true;
}

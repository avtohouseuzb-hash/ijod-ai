export type EduLiveWhiteboardCommand =
 | {id:string;type:"clear"|"finish";delayMs?:number}
 | {id:string;type:"title";text:string;color?:string;delayMs?:number}
 | {id:string;type:"text";x:number;y:number;text:string;fontSize?:number;color?:string;delayMs?:number}
 | {id:string;type:"formula";x:number;y:number;expression:string;color?:string;delayMs?:number}
 | {id:string;type:"rect";x:number;y:number;width:number;height:number;stroke:string;fill?:string;delayMs?:number}
 | {id:string;type:"arrow";x:number;y:number;width:number;height:number;stroke:string;delayMs?:number};
export type EduLiveWhiteboardPayload={version:1;width:1000;height:760;commands:EduLiveWhiteboardCommand[]};

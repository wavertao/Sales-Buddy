import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {dirname,resolve,posix,join} from 'node:path';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import JSZip from 'jszip';
import {XMLParser} from 'fast-xml-parser';

export type SlideContent={title:string;subtitle?:string;bullets?:string[];columns?:{title:string;items:string[]}[];notes?:string;mock?:boolean;layout?:string;imagePaths?:string[]};
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_'});
const arr=(x:any):any[]=>x===undefined?[]:Array.isArray(x)?x:[x];
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const unescape=(s:string)=>String(parser.parse('<v>'+s+'</v>').v||'');
let artifactPromise:Promise<any>|undefined;
export function artifact(){const modulePath=process.env.ARTIFACT_MODULE_PATH||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs');if(!existsSync(modulePath))throw new Error('缺少本地演示文稿运行时，请设置ARTIFACT_MODULE_PATH');return artifactPromise??=import(pathToFileURL(modulePath).href);}
export async function packageZip(bytes:Buffer){
 if(bytes.length>60*1024*1024)throw new Error('文件最多60MB');
 const zip=await JSZip.loadAsync(bytes);let size=0;
 for(const [name,f]of Object.entries(zip.files)){if(name.includes('..')||name.startsWith('/'))throw new Error('文件包路径无效');size+=(f as any)._data?.uncompressedSize||0;if(size>180*1024*1024)throw new Error('文件解压后过大');}
 return zip;
}
export async function inspectPptx(bytes:Buffer){
 const zip=await packageZip(bytes);const px=await zip.file('ppt/presentation.xml')?.async('string');const rx=await zip.file('ppt/_rels/presentation.xml.rels')?.async('string');if(!px||!rx)throw new Error('不是有效PPTX文件');
 const p=parser.parse(px)['p:presentation'];if(!p)throw new Error('不支持该PPTX命名空间');const relationships=arr(parser.parse(rx).Relationships?.Relationship);const dim=p['p:sldSz'];const width=Number(dim?.['@_cx']),height=Number(dim?.['@_cy']);
 const slides=[];for(const [index,s]of arr(p['p:sldIdLst']?.['p:sldId']).entries()){const rel=relationships.find((r:any)=>r['@_Id']===s['@_r:id']);if(!rel)throw new Error('缺少Slide关系');const part=String(rel['@_Target']).startsWith('/')?String(rel['@_Target']).slice(1):posix.normalize(posix.join('ppt',rel['@_Target']));const xml=await zip.file(part)?.async('string');if(!xml)throw new Error('源Slide不存在');const text=[...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(m=>unescape(m[1]));const rpart=posix.join(posix.dirname(part),'_rels',posix.basename(part)+'.rels');const relxml=await zip.file(rpart)?.async('string')||'';
 const unsupported=/oleObj|videoFile|audioFile|<p:timing|drawingml\/2006\/diagram|<p:contentPart/i.test(xml)||/TargetMode="External"/i.test(relxml);const hidden=/<p:sld\b[^>]*\bshow="0"/.test(xml);slides.push({page:index+1,part,title:[...xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)].map(m=>({text:[...m[0].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(t=>unescape(t[1])).join(' '),size:Math.max(0,...[...m[0].matchAll(/\bsz="(\d+)"/g)].map(t=>Number(t[1])))})).filter(x=>x.text).sort((a,b)=>b.size-a.size)[0]?.text||text.find(x=>x.trim())||'第'+(index+1)+'页',text:text.join('\n'),supported:!unsupported&&!hidden&&Math.abs(width/height-16/9)<0.03,hidden,unsupportedReason:unsupported?'包含复杂对象、动画或外部关系':hidden?'隐藏页':Math.abs(width/height-16/9)>=0.03?'非16:9页面，需要重新布局':null});}
 if(!slides.length||slides.length>150)throw new Error('PPTX需包含1—150页');return{width,height,slides};
}
export async function createPptx(contents:SlideContent[],output:string,previewDir?:string){
 if(process.env.PRESENTATION_ENGINE==='libreoffice')return(await import('./presentation-portable.ts')).portableCreate(contents,output,previewDir);
 const {Presentation,PresentationFile}=await artifact();const p=Presentation.create({slideSize:{width:1280,height:720}});const font=contents.some(c=>/[\u4e00-\u9fff]/.test(c.title+(c.bullets||[]).join('')))?'Microsoft YaHei':'Arial';
 const text=(s:any,value:string,x:number,y:number,w:number,h:number,size:number,color:string,bold=false)=>{const sh=s.shapes.add({geometry:'textbox',name:value.slice(0,35),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});sh.text=value;sh.text.style={typeface:font,fontSize:size,color,bold};return sh;};
 for(const [i,c]of contents.entries()){
 const s=p.slides.add();const cover=c.layout==='cover';s.background.fill=cover?'#172345':'#FFFFFF';const ink=cover?'#FFFFFF':'#172345',muted=cover?'#BFCBE9':'#62708C';
 if(!c.layout||c.layout!=='blank'){text(s,cover?'ENERGY STORAGE · MEETING BRIEF':'ENERGY STORAGE',64,40,1100,30,16,cover?'#A6B9FC':'#4F6CF7',true);}
 text(s,c.title,64,cover?160:100,1140,cover?170:110,cover?54:40,ink,true);
 if(c.subtitle)text(s,c.subtitle,64,cover?380:215,1120,75,23,muted);
 if(c.layout!=='blank'){
 if(c.columns?.length){const columns=c.columns.slice(0,2),width=540;for(const [j,col]of columns.entries()){text(s,col.title,64+j*590,300,width,45,27,ink,true);for(const [k,b]of col.items.slice(0,4).entries())text(s,'• '+b,64+j*590,365+k*60,width,55,22,muted);}}
 else for(const [j,b]of (c.bullets||[]).slice(0,5).entries())text(s,'• '+b,64,cover?490:305+j*65,c.imagePaths?.length?550:1120,62,c.imagePaths?.length?18:24,muted);
 if(c.imagePaths?.length){const image=c.imagePaths[0];s.images.add({blob:new Uint8Array(readFileSync(image)),contentType:/\.png$/i.test(image)?'image/png':'image/jpeg',alt:'User selected reference image',fit:'contain',position:{left:660,top:280,width:550,height:350}});}
 }
 text(s,c.mock?'MOCK · Illustrative guidance, not a supplier commitment':'Prepared for discussion · Please confirm open items',64,665,1080,27,13,muted);text(s,String(i+1),1190,665,50,27,14,muted);
 s.speakerNotes.text=c.notes||'';
 }
 mkdirSync(dirname(output),{recursive:true});await(await PresentationFile.exportPptx(p)).save(output);
 if(previewDir){mkdirSync(previewDir,{recursive:true});for(const [i,s]of p.slides.items.entries()){const png=await p.export({slide:s,format:'png',scale:1});writeFileSync(join(previewDir,`${i+1}.png`),new Uint8Array(await png.arrayBuffer()));}}
 return{pages:contents.length};
}
export async function renderPptx(file:string,out:string){if(process.env.PRESENTATION_ENGINE==='libreoffice')return(await import('./presentation-portable.ts')).portableRender(file,out);const {PresentationFile,FileBlob}=await artifact();const p=await PresentationFile.importPptx(await FileBlob.load(file));mkdirSync(out,{recursive:true});for(const [i,s]of p.slides.items.entries()){const blob=await p.export({slide:s,format:'png',scale:1});writeFileSync(join(out,`${i+1}.png`),new Uint8Array(await blob.arrayBuffer()));}return{pages:p.slides.items.length};}

export async function assemblePptx(selected:{file:string;page:number}[],output:string){
 if(!selected.length||selected.length>40)throw new Error('导出需包含1—40页');
 const first=await packageZip(readFileSync(selected[0].file));const base=new JSZip();for(const [name,f]of Object.entries(first.files))if(!f.dir&&!name.startsWith('ppt/slides/')&&!name.startsWith('ppt/notesSlides/')&&!name.startsWith('ppt/notesMasters/')&&!name.startsWith('ppt/comments/'))base.file(name,await f.async('nodebuffer'));
 let pres=await first.file('ppt/presentation.xml')!.async('string');const types=new Map<string,string>();let contentTypes=await first.file('[Content_Types].xml')!.async('string');const masters:string[]=[];const slides:string[]=[];const rels:string[]=[];let relNum=1;
 const relType='http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
 for(const [index,item]of selected.entries()){
 const bytes=readFileSync(item.file),info=await inspectPptx(bytes);const slide=info.slides[item.page-1];if(!slide?.supported)throw new Error('目标原始页不支持直接复用，请改写或更换素材');const source=await packageZip(bytes);const ct=parser.parse(await source.file('[Content_Types].xml')!.async('string')).Types;const overrides=arr(ct.Override),defaults=arr(ct.Default);const mapped=new Map<string,string>();
 const copy=async(part:string):Promise<string>=>{if(mapped.has(part))return mapped.get(part)!;const f=source.file(part);if(!f)throw new Error('来源资源缺失：'+part);const folder=posix.dirname(part),name=`p11_${index+1}_${mapped.size}_${posix.basename(part)}`,target=posix.join(folder,name);mapped.set(part,target);const data=await f.async('nodebuffer');base.file(target,data);const type=overrides.find((v:any)=>v['@_PartName']==='/'+part)?.['@_ContentType']||defaults.find((v:any)=>v['@_Extension']===posix.extname(part).slice(1))?.['@_ContentType'];if(type)types.set('/'+target,type);
 const sourceRels=posix.join(folder,'_rels',posix.basename(part)+'.rels');const rfile=source.file(sourceRels);if(rfile){const rr=arr(parser.parse(await rfile.async('string')).Relationships?.Relationship),out=[];for(const r of rr){const kind=String(r['@_Type']);if(/notesSlide|notesMaster|comments|person/.test(kind))continue;if(r['@_TargetMode']==='External')throw new Error('源文件包含外部资源，不支持直接复用');let resolved=String(r['@_Target']).startsWith('/')?String(r['@_Target']).slice(1):posix.normalize(posix.join(folder,r['@_Target']));if(resolved.startsWith('..'))throw new Error('关系路径无效');const newTarget=await copy(resolved);out.push(`<Relationship Id="${escape(r['@_Id'])}" Type="${escape(kind)}" Target="${escape(posix.relative(posix.dirname(target),newTarget))}"/>`);}base.file(posix.join(folder,'_rels',name+'.rels'),'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+out.join('')+'</Relationships>');}
 if(folder==='ppt/slideMasters'){const id='rId'+relNum++;rels.push(`<Relationship Id="${id}" Type="${relType}slideMaster" Target="${posix.relative('ppt',target)}"/>`);masters.push(`<p:sldMasterId id="${2147483648+masters.length}" r:id="${id}"/>`);}return target;};
 const target=await copy(slide.part);const id='rId'+relNum++;rels.push(`<Relationship Id="${id}" Type="${relType}slide" Target="${posix.relative('ppt',target)}"/>`);slides.push(`<p:sldId id="${256+index}" r:id="${id}"/>`);
 }
 pres=pres.replace(/<p:sldIdLst\b[^>]*>[\s\S]*?<\/p:sldIdLst>|<p:sldIdLst\s*\/>/,'<p:sldIdLst>'+slides.join('')+'</p:sldIdLst>');pres=pres.replace(/<p:sldMasterIdLst\b[^>]*>[\s\S]*?<\/p:sldMasterIdLst>|<p:sldMasterIdLst\s*\/>/,'<p:sldMasterIdLst>'+masters.join('')+'</p:sldMasterIdLst>');pres=pres.replace(/<p:notesMasterIdLst\b[^>]*>[\s\S]*?<\/p:notesMasterIdLst>/,'');
 for(const typeName of ['presProps','viewProps','theme','tableStyles']){const originals=arr(parser.parse(await first.file('ppt/_rels/presentation.xml.rels')!.async('string')).Relationships?.Relationship);for(const r of originals.filter((v:any)=>v['@_Type']===relType+typeName)){const id='rId'+relNum++;rels.push(`<Relationship Id="${id}" Type="${r['@_Type']}" Target="${escape(r['@_Target'])}"/>`);}}
 if(!/xmlns:r=/.test(pres.match(/<p:presentation\b[^>]*>/)?.[0]||''))pres=pres.replace('<p:presentation ', '<p:presentation xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');base.file('ppt/presentation.xml',pres);base.file('ppt/_rels/presentation.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+rels.join('')+'</Relationships>');
 contentTypes=contentTypes.replace(/<Override\b[^>]*PartName="\/ppt\/(?:slides|notesSlides|notesMasters|comments)\/[^>]*\/>/g,'');contentTypes=contentTypes.replace('</Types>',[...types].map(([part,type])=>`<Override PartName="${escape(part)}" ContentType="${escape(type)}"/>`).join('')+'</Types>');base.file('[Content_Types].xml',contentTypes);mkdirSync(dirname(output),{recursive:true});writeFileSync(output,await base.generateAsync({type:'nodebuffer',compression:'DEFLATE'}));const check=await inspectPptx(readFileSync(output));if(check.slides.length!==selected.length)throw new Error('导出页数校验失败');return{pages:selected.length};
}

import PptxGenJS from 'pptxgenjs';
import {execFile} from 'node:child_process';
import {mkdirSync,readdirSync,copyFileSync,existsSync,renameSync,mkdtempSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import type {SlideContent} from './presentation-engine.ts';

const run=(bin:string,args:string[])=>new Promise<void>((yes,no)=>execFile(bin,args,{timeout:120000,maxBuffer:2*1024*1024,windowsHide:true},error=>error?no(new Error('PPT渲染组件执行失败，请检查服务器LibreOffice与Poppler配置')):yes()));
export async function portableRender(file:string,out:string){
 mkdirSync(out,{recursive:true});const work=mkdtempSync(join(out,'.render-')),input=join(work,'input.pptx');copyFileSync(file,input);
 await run(process.env.LIBREOFFICE_BIN||'libreoffice',['-env:UserInstallation='+pathToFileURL(join(work,'profile')).href,'--headless','--convert-to','pdf:impress_pdf_Export','--outdir',work,input]);
 const pdf=join(work,'input.pdf');if(!existsSync(pdf))throw new Error('PPT预览PDF未生成');
 await run(process.env.PDFTOPPM_BIN||'pdftoppm',['-png','-scale-to-x','1280','-scale-to-y','-1',pdf,join(work,'page')]);
 const pngs=readdirSync(work).filter(n=>/^page-\d+\.png$/.test(n)).sort((a,b)=>Number(a.match(/\d+/)![0])-Number(b.match(/\d+/)![0]));
 if(!pngs.length)throw new Error('PPT没有生成可用预览');for(const [i,n]of pngs.entries())renameSync(join(work,n),join(out,`${i+1}.png`));
 return{pages:pngs.length};
}
export async function portableCreate(contents:SlideContent[],output:string,previewDir?:string){
 const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';ppt.author='Sales Buddy';ppt.subject='Meeting enablement';ppt.title=contents[0]?.title||'Meeting Brief';
 const font=process.env.PRESENTATION_FONT||'Noto Sans CJK SC';
 for(const [i,c]of contents.entries()){
  const s=ppt.addSlide(),cover=c.layout==='cover',ink=cover?'FFFFFF':'172345',muted=cover?'BFCBE9':'62708C';s.background={color:cover?'172345':'FFFFFF'};
  const text=(v:string,x:number,y:number,w:number,h:number,size:number,color=ink,bold=false)=>s.addText(v,{x:x/96,y:y/96,w:w/96,h:h/96,fontFace:font,fontSize:size*.75,color,bold,margin:0,breakLine:false,valign:'middle',fit:'shrink'});
  if(c.layout!=='blank')text(cover?'ENERGY STORAGE · MEETING BRIEF':'ENERGY STORAGE',64,40,1100,30,16,cover?'A6B9FC':'4F6CF7',true);
  text(c.title,64,cover?160:100,1140,cover?170:110,cover?54:40,ink,true);
  if(c.subtitle)text(c.subtitle,64,cover?380:215,1120,75,23,muted);
  if(c.layout!=='blank'){
   if(c.columns?.length)for(const [j,col]of c.columns.slice(0,2).entries()){text(col.title,64+j*590,300,540,45,27,ink,true);for(const[k,b]of col.items.slice(0,4).entries())text('• '+b,64+j*590,365+k*60,540,55,22,muted);}
   else for(const[j,b]of(c.bullets||[]).slice(0,5).entries())text('• '+b,64,cover?490+j*30:305+j*65,c.imagePaths?.length?550:1120,62,c.imagePaths?.length?18:24,muted);
   if(c.imagePaths?.length)s.addImage({path:resolve(c.imagePaths[0]),x:660/96,y:280/96,w:550/96,h:350/96,sizing:{type:'contain',w:550/96,h:350/96}});
  }
  text(c.mock?'MOCK · Illustrative guidance, not a supplier commitment':'Prepared for discussion · Please confirm open items',64,665,1080,27,13,muted);text(String(i+1),1190,665,50,27,14,muted);s.addNotes(c.notes||'');
 }
 mkdirSync(dirname(output),{recursive:true});await ppt.writeFile({fileName:output});if(previewDir){const rendered=await portableRender(output,previewDir);if(rendered.pages!==contents.length)throw new Error('PPT预览页数不匹配');}return{pages:contents.length};
}

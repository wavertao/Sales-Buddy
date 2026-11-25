import {topicalScore,slideThemes} from './material-matching.ts';
import {presentationLibraryRoot} from '../../../packages/paths.ts';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {join,resolve,extname} from 'node:path';
import {createHash} from 'node:crypto';
import mammoth from 'mammoth';
import {db,put,get,list,uid} from './db.ts';
import {authorize,canAccess} from './crm.ts';
import {AppError,type User,type Scope} from '../../../packages/contracts/index.ts';
import {inspectPptx} from './presentation-engine.ts';
import {presentationWork,materialRoot} from './presentation-jobs.ts';
import {tokens} from './knowledge.ts';
import {presentationCategories,researchSources} from '../../../assets/presentations/catalog.ts';
export {presentationCategories,researchSources};
export const stamp=()=>new Date().toISOString();
export const material=(id:string)=>get('materials',id);
export function allowedMaterial(u:User,id:string){const m=material(id);if(!m)throw new AppError('NOT_FOUND','素材不存在',404);if(m.userId&&m.userId!==u.id)throw new AppError('FORBIDDEN','只能访问本人的个人素材',403);if(m.scope)authorize(u,m.scope);if(m.status==='disabled')throw new AppError('NOT_FOUND','素材已停用',404);return m;}
function index(m:any){db.prepare('DELETE FROM material_fts WHERE id=?').run(m.id);db.prepare('INSERT INTO material_fts(id,text) VALUES (?,?)').run(m.id,tokens(m.title+' '+(m.keywords||'')+' '+m.slides.map((s:any)=>s.title+' '+s.text).join(' ')));}
export function saveMaterial(m:any){put('materials',m.id,m,m.userId,m.scope?.objectId);if(m.status==='ready')index(m);return m;}
export function materialView(m:any){const {file,previewDir,sha256,...safe}=m;return{...safe,slides:m.slides.map((s:any)=>{const{part,...p}=s;return p;}),hasFile:existsSync(file)};}
export function materialList(u:User,query:any={}){return list('materials').filter(m=>(query.personal?m.userId===u.id:!m.userId||m.userId===u.id)&&m.status!=='disabled'&&(!m.scope||canAccess(u,m.scope.customerId))).filter(m=>!query.source||query.source==='all'||m.source===query.source).filter(m=>!query.q||(m.title+' '+m.filename+' '+m.keywords+' '+(m.scope?.objectId||'')).toLowerCase().includes(String(query.q).toLowerCase())).map(materialView);}
export async function initMaterialLibrary(){
 db.exec('CREATE VIRTUAL TABLE IF NOT EXISTS material_fts USING fts5(id UNINDEXED,text);');
 const root=presentationLibraryRoot,manifest=join(root,'manifest.json');if(!existsSync(manifest))return;
 for(const d of JSON.parse(readFileSync(manifest,'utf8'))){const id='public-'+d.id+'-v'+d.version;const existing=get('materials',id);if(existing?.indexVersion===3)continue;const file=join(root,d.file);if(!existsSync(file))continue;const info=await inspectPptx(readFileSync(file));saveMaterial({...d,indexVersion:3,id,userId:null,source:'public',format:'pptx',status:'ready',file,filename:d.file,previewDir:join(root,'previews',d.id),slides:info.slides.map((s,i)=>({...s,text:s.text,summary:d.slides[i]?.summary||'',previewAvailable:existsSync(join(root,'previews',d.id,`${i+1}.png`))})),createdAt:d.createdAt,updatedAt:stamp()});}
 for(const m of list('materials').filter(m=>m.status==='parsing'))saveMaterial({...m,status:'failed',error:'服务重启，解析已中断，可重试',updatedAt:stamp()});
}
export async function ingestUpload(u:User,filename:string,buffer:Buffer,scope?:Scope,shared=false){
 if(scope)authorize(u,scope);if(shared&&u.role!=='admin')throw new AppError('FORBIDDEN','只有管理员可维护公共素材',403);
 const ext=extname(filename).slice(1).toLowerCase();if(!['pptx','pdf','docx','png','jpg','jpeg'].includes(ext))throw new AppError('INVALID_ARGUMENT','支持PPTX、PDF、DOCX、PNG和JPG');if(!buffer.length||buffer.length>60*1024*1024)throw new AppError('INVALID_ARGUMENT','文件不能为空且最多60MB');
 if(ext==='pdf'&&!buffer.subarray(0,5).toString().startsWith('%PDF'))throw new AppError('INVALID_ARGUMENT','PDF文件内容无效');
 if(ext==='png'&&!buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new AppError('INVALID_ARGUMENT','PNG文件内容无效');if(['jpg','jpeg'].includes(ext)&&(buffer[0]!==255||buffer[1]!==216))throw new AppError('INVALID_ARGUMENT','JPG文件内容无效');
 const digest=createHash('sha256').update(buffer).digest('hex');const existing=list('materials').find(m=>m.sha256===digest&&m.userId===(shared?null:u.id)&&JSON.stringify(m.scope||null)===JSON.stringify(scope||null)&&m.status!=='disabled');if(existing)return materialView(existing);
 const id=uid('material'),dir=join(materialRoot,id);mkdirSync(dir,{recursive:true});const file=join(dir,'original.'+ext);writeFileSync(file,buffer);const m={id,userId:shared?null:u.id,scope,source:'uploaded',format:ext,status:'parsing',filename:filename.replace(/[\\/\r\n]/g,'_').slice(0,180),title:filename.replace(/\.[^.]+$/,'').slice(0,160),version:1,file,previewDir:join(dir,'previews'),sha256:digest,slides:[],mock:false,createdAt:stamp(),updatedAt:stamp()};saveMaterial(m);void processMaterial(m);return materialView(m);
}
export async function processMaterial(m:any){try{const bytes=readFileSync(m.file);let slides:any[]=[];
 if(m.format==='pptx'){const data=await inspectPptx(bytes);slides=data.slides.map(s=>({...s,previewAvailable:false}));saveMaterial({...m,slides});try{await presentationWork({operation:'render',file:m.file,previews:m.previewDir});slides=slides.map(s=>({...s,previewAvailable:true}));}catch(e:any){m.previewWarning='缩略图生成失败，可查看提取内容或下载原文件：'+e.message;}}
 else if(m.format==='docx'){const zip=await (await import('./presentation-engine.ts')).packageZip(bytes);if(!zip.file('word/document.xml'))throw new Error('DOCX内容无效');const result=await mammoth.extractRawText({buffer:bytes});slides=[{page:1,title:m.title,text:result.value.slice(0,60000),supported:false,referenceOnly:true,previewAvailable:false}];}
 else if(m.format==='pdf'){const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const loading=pdfjs.getDocument({data:new Uint8Array(bytes)});const pdf=await loading.promise;try{if(pdf.numPages>150)throw new Error('PDF最多150页');for(let i=1;i<=pdf.numPages;i++){const content=await(await pdf.getPage(i)).getTextContent();slides.push({page:i,title:m.title+' · 第'+i+'页',text:content.items.map((x:any)=>x.str||'').join(' ').slice(0,12000),supported:false,referenceOnly:true,previewAvailable:false});}}finally{await loading.destroy();}}
 else slides=[{page:1,title:m.title,text:'用户上传图片；图中事实需用户说明，不从文件名推断参数。',supported:false,referenceOnly:true,image:true,previewAvailable:true}];
 saveMaterial({...m,slides,language:m.format==='pptx'&&/[\u4e00-\u9fff]{2}/.test(slides.map(s=>s.text).join(''))?'zh':'en',status:'ready',error:null,updatedAt:stamp()});
 }catch(e:any){saveMaterial({...m,status:'failed',error:String(e.message).slice(0,500),updatedAt:stamp()});}}
export async function registerGenerated(u:User,kit:any,title:string,file:string,previewDir:string,sourceId:string,status='草稿'){
 const old=list('materials').find(m=>m.userId===u.id&&m.sourceId===sourceId);if(old)return old;
 const info=await inspectPptx(readFileSync(file));return saveMaterial({id:uid('generated'),userId:u.id,scope:kit.scope,source:'generated',sourceId,sourceKitId:kit.id,title,filename:title+'.pptx',file,previewDir,format:'pptx',version:1,status:'ready',generationStatus:status,slides:info.slides.map(s=>({...s,previewAvailable:existsSync(join(previewDir,s.page+'.png'))})),mock:info.slides.some(s=>s.text.includes('MOCK')),language:kit.brief.language,createdAt:stamp(),updatedAt:stamp()});
}
export function matchMaterialSlides(u:User,target:any,kit:any){
 const intent=slideThemes(target.title),standard=intent.has('company')||intent.has('product')||intent.has('agenda');
 const available=materialList(u).filter(m=>m.status==='ready'&&m.format==='pptx'&&m.generationStatus!=='草稿');const candidates:any[]=[];
 for(const m of available){
  const sourceScope=m.scope||(m.sourceKitId?get('meeting_kits',m.sourceKitId)?.scope:null);
  // An old generated deck without a reliable customer scope is reference-only via explicit personal selection.
  if(m.source==='generated'&&!sourceScope&&m.sourceKitId!==kit.id)continue;
  if(sourceScope&&(!kit.scope||sourceScope.customerId!==kit.scope.customerId||sourceScope.objectType!=='customer'&&sourceScope.objectId!==kit.scope.objectId))continue;
  if(target.requiresCustomerContext&&!standard&&!sourceScope)continue;
  if(m.mode&&m.mode!=='all'&&kit.businessMode&&m.mode!==kit.businessMode)continue;
  for(const slide of m.slides){if(slide.hidden||slide.page===1||/discussion and next steps/i.test(slide.title))continue;
   const relevance=topicalScore(target,slide);if(!relevance)continue;
   const confidence=Math.min(99,relevance.score+(sourceScope?3:0)+(m.id.includes('GEN-05')&&intent.has('company')?8:0)+(m.id.includes('PRE-03')&&intent.has('agenda')?12:0));
   candidates.push({materialId:m.id,page:slide.page,title:slide.title,materialTitle:m.title,version:m.version,source:m.source,language:m.language||'未知',supported:slide.supported,tag:!slide.supported?'仅供参考':m.language&&m.language!==kit.brief?.language?'需要改写':'可直接复用',confidence,score:confidence,reason:'依据本页主题、标题与原页内容匹配；'+(sourceScope?'当前客户/项目资料':'通用标准资料'),difference:target.requiresCustomerContext&&!sourceScope?'标准页可复用；本次客户的具体目标与优先事项需补充。':slide.supported?'请核对本次会晤适用范围。':'此页需要改写或重新布局。'});
  }
 }
 return candidates.sort((a,b)=>b.confidence-a.confidence||a.materialId.localeCompare(b.materialId)||a.page-b.page).slice(0,60);
}

import {databasePath} from '../../../packages/paths.ts';
import 'dotenv/config';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
// Legacy local .env files may still contain the old demo date. Only isolated
// test databases may override the clock; never freeze a user's runtime data.
export const now=()=>process.env.BUSINESS_CLOCK&&/[\\/]data-test-[^\\/]+[\\/]/.test(dbPath)?process.env.BUSINESS_CLOCK:new Date().toISOString();
export const uid=(prefix='id')=>prefix+'-'+randomUUID().slice(0,12);
export const dbPath=databasePath();
mkdirSync(dirname(dbPath),{recursive:true});
export const db=new DatabaseSync(dbPath);
db.exec(`
PRAGMA foreign_keys=ON;
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,role TEXT NOT NULL,team_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS records(
id TEXT PRIMARY KEY,type TEXT NOT NULL,customer_id TEXT NOT NULL REFERENCES records(id),
entity_type TEXT,entity_id TEXT REFERENCES records(id),name TEXT NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL,
CHECK(type!='lead' OR json_extract(data,'$.stage')='S0'),
CHECK(type!='opportunity' OR json_extract(data,'$.stage') IN ('S1','S2','S3','S4','S5','S6','S7','S8')));
CREATE INDEX IF NOT EXISTS record_lookup ON records(type,customer_id,entity_id);
CREATE TRIGGER IF NOT EXISTS validate_lead_progress BEFORE INSERT ON records WHEN NEW.type='lead_progress' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.entity_id AND type='lead' AND json_extract(data,'$.status')!='converted') THEN RAISE(ABORT,'INVALID_LEAD_PROGRESS_TARGET') END;
END;
CREATE TRIGGER IF NOT EXISTS validate_opportunity_progress BEFORE INSERT ON records WHEN NEW.type='opportunity_progress' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM records WHERE id=NEW.entity_id AND type='opportunity') THEN RAISE(ABORT,'INVALID_OPPORTUNITY_PROGRESS_TARGET') END;
END;
CREATE TABLE IF NOT EXISTS documents(collection TEXT NOT NULL,id TEXT NOT NULL,user_id TEXT,object_id TEXT,data TEXT NOT NULL,updated_at TEXT NOT NULL,PRIMARY KEY(collection,id));
CREATE INDEX IF NOT EXISTS document_lookup ON documents(collection,user_id,object_id);
CREATE TABLE IF NOT EXISTS events(seq INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT NOT NULL,type TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS knowledge(id TEXT PRIMARY KEY,title TEXT NOT NULL,stage TEXT NOT NULL,mode TEXT NOT NULL,countries TEXT NOT NULL,source_id TEXT NOT NULL,body TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(id UNINDEXED,title,body);
CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL);
`);
export function setMeta(key:string,value:unknown){db.prepare('INSERT OR REPLACE INTO metadata VALUES (?,?)').run(key,JSON.stringify(value));}
export function meta<T=unknown>(key:string,fallback:T):T{const r=db.prepare('SELECT value FROM metadata WHERE key=?').get(key) as {value:string}|undefined;return r?JSON.parse(r.value):fallback;}
export function put(collection:string,id:string,data:unknown,userId:string|null=null,objectId:string|null=null){db.prepare('INSERT OR REPLACE INTO documents VALUES (?,?,?,?,?,?)').run(collection,id,userId,objectId,JSON.stringify(data),now());return data;}
export function get<T=any>(collection:string,id:string):T|undefined{const r=db.prepare('SELECT data FROM documents WHERE collection=? AND id=?').get(collection,id) as {data:string}|undefined;return r?JSON.parse(r.data):undefined;}
export function list<T=any>(collection:string):T[]{return (db.prepare('SELECT data FROM documents WHERE collection=? ORDER BY updated_at DESC,rowid DESC').all(collection) as {data:string}[]).map(r=>JSON.parse(r.data));}
export function addEvent(runId:string,type:string,data:unknown){const result=db.prepare('INSERT INTO events(run_id,type,data,created_at) VALUES (?,?,?,?)').run(runId,type,JSON.stringify(data),now());return Number(result.lastInsertRowid);}
export function events(runId:string,after=0){return (db.prepare('SELECT * FROM events WHERE run_id=? AND seq>? ORDER BY seq').all(runId,after) as any[]).map(r=>({...r,data:JSON.parse(r.data)}));}
export function saveRecord(r:any){db.prepare('INSERT OR REPLACE INTO records VALUES (?,?,?,?,?,?,?,?)').run(r.id,r.type,r.customerId,r.entityType||null,r.entityId||null,r.name,JSON.stringify(r),r.updatedAt||now());return r;}
export function record(id:string):any{const r=db.prepare('SELECT data FROM records WHERE id=?').get(id) as any;return r?JSON.parse(r.data):undefined;}
export function allRecords(type?:string):any[]{const rows=type?db.prepare('SELECT data FROM records WHERE type=? ORDER BY updated_at DESC,id').all(type):db.prepare('SELECT data FROM records ORDER BY updated_at DESC,id').all();return(rows as any[]).map(r=>JSON.parse(r.data));}
export function writeJson(path:string,value:unknown){mkdirSync(dirname(resolve(path)),{recursive:true});writeFileSync(path,JSON.stringify(value,null,2),'utf8');}
export {readFileSync,writeFileSync,mkdirSync,existsSync,resolve};


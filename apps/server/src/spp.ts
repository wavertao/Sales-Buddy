import {list,record} from './db.ts';
import type {User} from '../../../packages/contracts/index.ts';

export type SppTeam={id:string;name:string;regionId:string;leaderId:string;active:boolean;members:{userId:string;role:'S'|'PM'|'PD'}[]};
export type SppRegion={id:string;name:string;presidentId:string;active:boolean};
export function sppTeams(){return list<SppTeam>('spp_teams').filter(t=>t.active);}
export function managedTeams(u:User){const regions=list<SppRegion>('spp_regions').filter(r=>r.active&&r.presidentId===u.id);return sppTeams().filter(t=>t.leaderId===u.id||regions.some(r=>r.id===t.regionId));}
export function cuePersona(u:User){return list<SppRegion>('spp_regions').some(r=>r.active&&r.presidentId===u.id)?'regional_president':sppTeams().some(t=>t.leaderId===u.id)?'spp_leader':sppTeams().some(t=>t.members.some(m=>m.userId===u.id&&m.role==='S'))?'sales':sppTeams().some(t=>t.members.some(m=>m.userId===u.id))?'collaborator':u.role==='sales'?'sales':'personal';}
export function managedSalesIds(u:User){return new Set(managedTeams(u).flatMap(t=>t.members.filter(m=>m.role==='S').map(m=>m.userId)));}
export function projectTeam(p:any){if(!p)return undefined;const owner=p.primarySalesId||p.ownerId;const teams=sppTeams().filter(t=>t.members.some(m=>m.userId===owner&&m.role==='S'));return p.sppTeamId?teams.find(t=>t.id===p.sppTeamId):teams.length===1?teams[0]:undefined;}
export function inManagedScope(u:User,r:any){const p=r.type==='customer'?r:r.entityId?record(r.entityId)||r:r;const team=projectTeam(p);return !!team&&managedTeams(u).some(t=>t.id===team.id);}

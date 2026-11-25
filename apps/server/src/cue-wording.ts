import type {CueCandidate} from './cue-scenarios.ts';

/** Numbers, deadlines and commercial amounts must remain grounded in the supplied facts. */
export function validateCueWording(item:{title:string;description:string},candidate:CueCandidate){
 const text=item.title+' '+item.description,facts=JSON.stringify(candidate);
 if(/阶段未决项清单|补齐.{0,30}阶段.{0,10}清单/.test(item.title))throw Error('提醒标题没有明确业务行动');
 const dates=(text.match(/20\d{2}[-/]\d{1,2}[-/]\d{1,2}/g)||[]);
 for(const date of dates){const normalized=date.replaceAll('/','-');if(!facts.includes(normalized))throw Error('提醒包含无来源的日期');}
 for(const value of text.match(/\d+(?:\.\d+)?\s*(?:亿元|万元|MWh|kWh|MW|kW|%)/gi)||[])if(!facts.replaceAll(' ','').toLowerCase().includes(value.replaceAll(' ','').toLowerCase()))throw Error('提醒包含无来源的金额或容量');
}

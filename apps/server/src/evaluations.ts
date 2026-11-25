import {existsSync,readFileSync,put} from './db.ts';
export function initEvaluations(){
 if(!existsSync('runtime/reports/test-results.json'))return;
 const report=JSON.parse(readFileSync('runtime/reports/test-results.json','utf8'));
 for(const c of report.results||[])put('evaluation_cases',c.id,{id:c.id,title:c.title,category:c.id.split('-')[0],checks:'详见tests/core.test.ts；测试使用隔离数据库',result:c.status});
 put('evaluation_runs','latest-deterministic',{...report,id:'latest-deterministic'});
 if(existsSync('runtime/reports/live-results.json'))put('evaluation_runs','latest-live',JSON.parse(readFileSync('runtime/reports/live-results.json','utf8')));
}


import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {testDirectory} from './helpers/temp.ts';
import {portableCreate} from '../apps/server/src/presentation-portable.ts';
import {inspectPptx,assemblePptx} from '../apps/server/src/presentation-engine.ts';
test('可部署PPT生成器保留可编辑文字、顺序与16:9，并可复用原页组合',async()=>{
 const dir=testDirectory('portable-ppt'),file=join(dir,'editable.pptx');const result=await portableCreate([{title:'项目会晤目标',bullets:['核实并网条件','确认下一步事项'],notes:'仅供讨论'},{title:'Next Steps',columns:[{title:'Owner',items:['Sales team']}]}],file);assert.equal(result.pages,2);const info=await inspectPptx(readFileSync(file));assert.equal(info.slides.length,2);assert.match(info.slides[0].text,/项目会晤目标/);assert.equal(info.slides[0].supported,true);assert.ok(Math.abs(info.width/info.height-16/9)<0.01);const combined=join(dir,'combined.pptx');await assemblePptx([{file,page:2},{file,page:1}],combined);const reordered=await inspectPptx(readFileSync(combined));assert.match(reordered.slides[0].text,/Next Steps/);assert.match(reordered.slides[1].text,/项目会晤目标/);
});

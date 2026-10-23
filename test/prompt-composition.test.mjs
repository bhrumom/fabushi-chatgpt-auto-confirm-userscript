import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';
const source=await fs.readFile(new URL('../chatgpt-auto-confirm.user.js',import.meta.url),'utf8');
const names='data,tabId,workPrompt,workPromptSections,prepareTaskPrompt,normalizePromptConfig,DEFAULT_EXECUTION_RULES,openPromptComposer,durableWorkbenchSnapshot,durableTaskSnapshot,finish,taskTurnForInspection';
async function fixture(){
 const dom=new JSDOM('<main><article data-message-author-role="user" data-message-id="user">task [Fabushi:prompt-token]</article><article data-message-author-role="assistant" data-message-id="reply"><div id="response">工作完成</div><button aria-label="复制"></button><button aria-label="赞"></button></article></main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://chatgpt.com/c/prompt'});
 const w=dom.window;w.Element.prototype.getClientRects=()=>[{width:1,height:1}];
 w.navigator.locks={request(_n,opt,cb){return Promise.resolve((typeof opt==='function'?opt:cb)({}));}};
 await w.eval(source.replace('  mount();',`  window.h={${names},run:()=>{running=true;data.autoResume=true;},halt:()=>{running=false;}};\n  mount();`));
 const h=w.h;h.run();h.data.requireAuthorizationBeforeNewChat=false;
 const task={id:'prompt',ownerTabId:h.tabId,url:w.location.href,phase:'work',round:2,mode:'goal',state:'waiting',token:'prompt-token',goal:'实现功能',next:'继续修改',attachments:[],messages:[],goalRevision:0,dispatchGoalRevision:0};h.data.tasks.push(task);
 return {dom,w,h,task};
}
function report(task,status='next',extra={}){return JSON.stringify({taskId:task.id,round:task.round,status,summary:'实际工作结果',next:status==='next'?'继续实现下一项':'',...extra});}
function button(w,name){return Array.from(w.document.querySelectorAll('button')).find(b=>b.textContent===name);}
test('one composer supplies ordered visible sections, mandatory delivery and exact joined prompt',async()=>{
 const {dom,h,task}=await fixture();try{
  h.data.promptConfig={executionRules:'自定义规则',additions:[{id:'x',title:'附加一',text:'新增要求',enabled:true},{id:'y',text:'禁用要求',enabled:false}]};
  const parts=h.workPromptSections(task),text=h.workPrompt(task);
  assert.equal(parts.map(x=>x.text).join('\n'),text);assert.ok(text.includes('新增要求'));assert.ok(!text.includes('禁用要求'));
  assert.ok(text.indexOf('自定义规则')<text.indexOf('新增要求'));assert.ok(text.indexOf('新增要求')<text.indexOf('【GitHub 提交'));
  assert.match(text,/提交并推送到 GitHub/);assert.match(text,/githubDelivery/);assert.match(text,/\[Fabushi:prompt-token\]/);
 }finally{dom.window.close();}
});
test('editing config cannot mutate already prepared send and new preparation adopts the config',async()=>{
 const {dom,h,task}=await fixture();try{
  const original=h.prepareTaskPrompt(task);h.data.promptConfig={executionRules:'新规则',additions:[]};
  assert.equal(task.preparedPrompt,original);assert.equal(h.workPrompt(task),original);
  assert.equal(task.githubDeliveryRequired,undefined);assert.equal(task.githubDeliveryPending,undefined);
  assert.ok(h.prepareTaskPrompt(task).includes('新规则'));
  assert.equal(h.durableTaskSnapshot(task).githubDeliveryRequired,undefined);
 }finally{dom.window.close();}
});
test('editor supports add, reorder, disable, delete, save/default and safe exact preview',async()=>{
 const {dom,w,h,task}=await fixture();try{
  task.preparedPrompt='immutable prepared prompt';h.openPromptComposer(task);
  assert.ok(w.document.querySelector('[role="dialog"][aria-label="提示词组合"]'));
  assert.ok(w.document.getElementById('fabushi-auto-confirm-root').contains(w.document.getElementById('fabushi-prompt-composer')));
  const rules=w.document.querySelector('[aria-label="执行规则提示词"]');rules.value='自定义执行';rules.dispatchEvent(new w.Event('input'));
  button(w,'新增提示词').click();
  let body=w.document.querySelector('[aria-label="附加提示词内容 1"]');body.value='<img src=x onerror=alert(1)> 用户要求';body.dispatchEvent(new w.Event('input'));
  button(w,'新增提示词').click();
  body=w.document.querySelector('[aria-label="附加提示词内容 2"]');body.value='第二段';body.dispatchEvent(new w.Event('input'));
  Array.from(w.document.querySelectorAll('button')).filter(b=>b.textContent==='上移').at(-1).click();
  button(w,'保存提示词组合').click();
  assert.equal(h.data.promptConfig.additions[0].text,'第二段');assert.equal(w.document.querySelector('img'),null);
  const preview=w.document.querySelector('[aria-label="下一次发送完整提示词预览"]');
  assert.equal(preview.value,h.workPrompt({...task,promptConfigSnapshot:h.data.promptConfig}));assert.equal(task.preparedPrompt,'immutable prepared prompt');
  const stored=h.durableWorkbenchSnapshot(h.data);assert.equal(stored.tabControls[h.tabId].promptConfig.executionRules,'自定义执行');
  h.data.tabControls.other={promptConfig:{executionRules:'另一个工作区',additions:[]}};
  assert.equal(h.data.tabControls.other.promptConfig.executionRules,'另一个工作区');
  button(w,'删除此段').click();assert.equal(w.document.querySelectorAll('[aria-label^="附加提示词内容"]').length,1);
  const enable=w.document.querySelector('[aria-label="启用附加提示词 1"]');enable.checked=false;enable.dispatchEvent(new w.Event('change'));button(w,'保存提示词组合').click();assert.equal(h.data.promptConfig.additions[0].enabled,false);
  button(w,'恢复默认提示词').click();button(w,'保存提示词组合').click();assert.equal(h.data.promptConfig.executionRules,h.DEFAULT_EXECUTION_RULES);assert.equal(h.data.promptConfig.additions.length,0);
 }finally{dom.window.close();}
});
test('GitHub delivery remains prompt-only and creates no runner-side delivery state',async()=>{
 const {dom,h,task}=await fixture();try{
  const prompt=h.prepareTaskPrompt(task);
  assert.match(prompt,/提交并推送到 GitHub/);
  assert.match(prompt,/回读核验远端提交/);
  assert.match(prompt,/githubDelivery/);
  for(const field of ['githubDeliveryRequired','githubDeliveryPending','githubDeliveryAttempts','githubDeliveryBoundary','githubDeliveryReportBoundary','githubDeliveryLimitNoted']) {
    assert.equal(task[field],undefined,field+' must not be created by prompt preparation');
  }
 }finally{dom.window.close();}
});
for(const status of ['next','complete'])test(`report without githubDelivery settles normally for ${status}`,async()=>{
 const {dom,h,task}=await fixture();try{
  task.githubDeliveryRequired=true;
  task.githubDeliveryPending=true;
  task.githubDeliveryAttempts=3;
  const raw=report(task,status);
  h.finish(task,raw);
  if(status==='complete'){
    assert.equal(task.state,'done');
    assert.equal(task.round,2);
  }else{
    assert.equal(task.state,'queued');
    assert.equal(task.round,3);
    assert.equal(task.next,'继续实现下一项');
  }
 }finally{dom.window.close();}
});
test('legacy v2.10.76 GitHub pending fields are behaviorally inert and never project a special wait',async()=>{
 const {dom,h,task}=await fixture();try{
  Object.assign(task,{githubDeliveryRequired:true,githubDeliveryPending:true,githubDeliveryAttempts:3,githubDeliveryBoundary:'legacy',githubDeliveryReportBoundary:'legacy',githubDeliveryLimitNoted:true});
  const raw=report(task,'next');
  h.finish(task,raw);
  assert.equal(task.state,'queued');
  assert.equal(task.round,3);
  assert.equal(task.next,'继续实现下一项');
 }finally{dom.window.close();}
});
test('source has no local GitHub delivery wait or reminder loop',()=>{
 assert.doesNotMatch(source,/function githubDeliveryEvidence\s*\(/);
 assert.doesNotMatch(source,/function continuePendingGithubDelivery\s*\(/);
 assert.doesNotMatch(source,/等待 GitHub 提交与远端核验证据/);
 assert.doesNotMatch(source,/已在当前会话请求提交 GitHub 并核验证据/);
});

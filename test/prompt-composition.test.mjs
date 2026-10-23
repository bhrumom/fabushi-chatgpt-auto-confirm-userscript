import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';
const source=await fs.readFile(new URL('../chatgpt-auto-confirm.user.js',import.meta.url),'utf8');
const names='data,tabId,workPrompt,workPromptSections,prepareTaskPrompt,normalizePromptConfig,DEFAULT_EXECUTION_RULES,githubDeliveryEvidence,openPromptComposer,durableWorkbenchSnapshot,durableTaskSnapshot,finish,continuePendingGithubDelivery,taskTurnForInspection';
async function fixture(){
 const dom=new JSDOM('<main><article data-message-author-role="user" data-message-id="user">task [Fabushi:prompt-token]</article><article data-message-author-role="assistant" data-message-id="reply"><div id="response">工作完成</div><button aria-label="复制"></button><button aria-label="赞"></button></article></main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://chatgpt.com/c/prompt'});
 const w=dom.window;w.Element.prototype.getClientRects=()=>[{width:1,height:1}];
 w.navigator.locks={request(_n,opt,cb){return Promise.resolve((typeof opt==='function'?opt:cb)({}));}};
 await w.eval(source.replace('  mount();',`  window.h={${names},run:()=>{running=true;data.autoResume=true;},halt:()=>{running=false;}};\n  mount();`));
 const h=w.h;h.run();h.data.requireAuthorizationBeforeNewChat=false;
 const task={id:'prompt',ownerTabId:h.tabId,url:w.location.href,phase:'work',round:2,mode:'goal',state:'waiting',token:'prompt-token',goal:'实现功能',next:'继续修改',attachments:[],messages:[],goalRevision:0,dispatchGoalRevision:0};h.data.tasks.push(task);
 return {dom,w,h,task};
}
const sha='a'.repeat(40),proof={commitUrl:`https://github.com/owner/repo/commit/${sha}`,sha,verified:true};
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
  assert.equal(task.preparedPrompt,original);assert.equal(h.workPrompt(task),original);assert.equal(task.githubDeliveryRequired,true);
  assert.ok(h.prepareTaskPrompt(task).includes('新规则'));assert.ok(h.durableTaskSnapshot(task).githubDeliveryRequired);
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
for(const variant of ['missing','unverified','short-sha','mismatch','non-github','credentials','query'])test(`GitHub evidence rejects ${variant}`,async()=>{
 const {dom,h}=await fixture();try{
  const p={...proof};if(variant==='unverified')p.verified=false;if(variant==='short-sha')p.sha='abc123';if(variant==='mismatch')p.sha='b'.repeat(40);if(variant==='non-github')p.commitUrl=p.commitUrl.replace('github.com','example.com');if(variant==='credentials')p.commitUrl=p.commitUrl.replace('https://','https://user@');if(variant==='query')p.commitUrl+='?x=y';
  assert.equal(h.githubDeliveryEvidence(variant==='missing'?{}:{githubDelivery:p}),false);
 }finally{dom.window.close();}
});
for(const status of ['next','complete'])test(`missing GitHub proof retains current session and round for ${status}`,async()=>{
 const {dom,w,h,task}=await fixture();try{
  task.githubDeliveryRequired=true;const raw=report(task,status);w.document.querySelector('#response').textContent=raw;
  h.finish(task,raw);assert.equal(task.githubDeliveryPending,true);assert.equal(task.state,'waiting');assert.equal(task.round,2);assert.equal(task.url,'https://chatgpt.com/c/prompt');assert.equal(task.history,undefined);
  let sends=0;w.document.querySelector('[data-testid="send-button"]').onclick=()=>sends++;
  await h.continuePendingGithubDelivery(task,null);assert.equal(sends,1);assert.match(w.document.querySelector('textarea').value,/提交并推送到 GitHub/);
  Object.assign(task,JSON.parse(JSON.stringify(h.durableTaskSnapshot(task))));await h.continuePendingGithubDelivery(task,null);assert.equal(sends,1,'persisted boundary never repeats');assert.equal(task.round,2);
 }finally{dom.window.close();}
});
for(const kind of ['stop','card','paused','foreign-route','aborted','settlement','runner-paused'])test(`GitHub correction respects ${kind}`,async()=>{
 const {dom,w,h,task}=await fixture();try{
  task.githubDeliveryRequired=true;w.document.querySelector('#response').textContent=report(task);h.finish(task,report(task));
  const signal=new w.AbortController();
  if(kind==='stop')w.document.body.insertAdjacentHTML('beforeend','<button aria-label="停止生成"></button>');
  if(kind==='card')w.document.querySelector('main').insertAdjacentHTML('beforeend','<section data-testid="approval-card"><button disabled>允许一次</button></section>');
  if(kind==='paused')task.state='paused';if(kind==='foreign-route')w.history.replaceState({},'', '/c/foreign');if(kind==='aborted')signal.abort();if(kind==='runner-paused')h.halt();
  if(kind==='settlement')Object.assign(task,{approvalSettlementUntil:Date.now()+60000,approvalSettlementURL:task.url,approvalSettlementToken:task.token,approvalSettlementPhase:task.phase,approvalSettlementRound:task.round});
  let sends=0;w.document.querySelector('[data-testid="send-button"]').onclick=()=>sends++;
  await h.continuePendingGithubDelivery(task,signal.signal);assert.equal(sends,0);assert.equal(task.round,2);
 }finally{dom.window.close();}
});
test('valid GitHub receipt resumes final handling, invalid identity stays in same chat, and cap cannot end it',async()=>{
 const {dom,w,h,task}=await fixture();try{
  task.githubDeliveryRequired=true;h.finish(task,report(task));task.githubDeliveryAttempts=3;task.githubDeliveryBoundary='different';
  w.document.querySelector('#response').textContent=report(task);await h.continuePendingGithubDelivery(task,null);assert.equal(task.state,'waiting');assert.equal(task.url,'https://chatgpt.com/c/prompt');
  const good=report(task,'complete',{githubDelivery:proof});w.document.querySelector('#response').textContent=good;
  assert.equal(await h.continuePendingGithubDelivery(task,null),false);h.finish(task,good);assert.equal(task.state,'done');
 }finally{dom.window.close();}
});
test('legacy sent task report remains compatible and identity mismatch is not accepted as evidence',async()=>{
 const {dom,h,task}=await fixture();try{
  task.githubDeliveryRequired=true;h.finish(task,report({...task,id:'foreign'},'complete',{githubDelivery:proof}));assert.equal(task.githubDeliveryPending,true);assert.equal(task.round,2);
  delete task.githubDeliveryRequired;h.finish(task,report(task,'complete'));assert.equal(task.state,'done');
 }finally{dom.window.close();}
});

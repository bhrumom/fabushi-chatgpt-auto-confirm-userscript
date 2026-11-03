import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';
const source=await fs.readFile(new URL('../chatgpt-auto-confirm.user.js',import.meta.url),'utf8');
const names='data,tabId,workPrompt,workPromptSections,prepareTaskPrompt,normalizePromptConfig,DEFAULT_EXECUTION_RULES,openPromptComposer,durableWorkbenchSnapshot,durableTaskSnapshot,currentWorkFinalReport,finish,inspect,continueWithoutAuthorization,reportHasCloudDelivery,taskTurnForInspection';
async function fixture(){
 const dom=new JSDOM('<main><article data-message-author-role="user" data-message-id="user">task [Fabushi:prompt-token]</article><article data-message-author-role="assistant" data-message-id="reply"><div id="response">工作完成</div><button aria-label="复制"></button><button aria-label="赞"></button></article></main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://chatgpt.com/c/prompt'});
 const w=dom.window;w.Element.prototype.getClientRects=()=>[{width:1,height:1}];
 w.navigator.locks={request(_n,opt,cb){return Promise.resolve((typeof opt==='function'?opt:cb)({}));}};
 await w.eval(source.replace('  mount();',`  window.h={${names},paint:()=>paint(),selectForTest:id=>{selected=id;paint();},run:()=>{running=true;data.autoResume=true;},halt:()=>{running=false;}};\n  mount();`));
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

const delivery={verified:true,sha:'a'.repeat(40),commitUrl:'https://github.com/example/project/commit/'+'a'.repeat(40)};
for(const mode of ['goal','once'])for(const status of ['next','complete'])for(const evidence of [undefined,{...delivery,verified:false},{...delivery,sha:'b'.repeat(40)},{...delivery,sha:'short'},delivery])test(`cloud report gate ${mode}/${status}/${JSON.stringify(evidence)}`,async()=>{
 const {dom,h,task}=await fixture();try{
  task.mode=mode;task.authorizationSeenURL=task.url;task.authorizationSeenAt=Date.now();
  h.finish(task,report(task,status,{githubDelivery:evidence}));
  if(evidence===delivery){assert.equal(task.state,status==='complete'||mode==='once'?'done':'queued');}
  else {assert.equal(task.state,'waiting');assert.equal(task.round,2);assert.equal(task.url,'https://chatgpt.com/c/prompt');}
 }finally{dom.window.close();}
});
for(const enabled of [true,false])test(`missing cloud evidence sends exact prompt once with prior authorization, switch=${enabled}`,async()=>{
 const {dom,w,h,task}=await fixture();try{
  h.data.requireAuthorizationBeforeNewChat=enabled;
  task.authorizationSeenURL=task.url;task.authorizationSeenAt=Date.now();
  task.authorizationContinuationAttempts=3;task.authorizationContinuationURL=task.url;
  w.document.getElementById('response').textContent=report(task,'next');
  let sent=0,submitted='';w.document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>{sent++;submitted=w.document.querySelector('textarea').value;w.document.querySelector('textarea').value='';});
  await h.inspect(task,null);task.liveFinalReportSince=Date.now()-5000;
  await h.inspect(task,null);
  assert.equal(sent,1);assert.equal(submitted,'继续完成所有，并把工作成果提交到云端');
  assert.equal(task.round,2);assert.equal(task.url,w.location.href);
  task.continuationSentAt=Date.now()-120000;
  await h.inspect(task,null);assert.equal(sent,1);
  const stored=h.durableTaskSnapshot(task);assert.equal(stored.authorizationContinuationBoundary,task.authorizationContinuationBoundary);
 }finally{dom.window.close();}
});
for(const guard of ['draft','stop','paused','foreign','card','settlement'])test(`cloud delivery continuation respects ${guard}`,async()=>{
 const {dom,w,h,task}=await fixture();try{
  w.document.getElementById('response').textContent=report(task,'complete');
  if(guard==='draft')w.document.querySelector('textarea').value='用户草稿';
  if(guard==='stop'){const b=w.document.createElement('button');b.setAttribute('data-testid','stop-button');w.document.body.append(b);}
  if(guard==='card')w.document.querySelector('main').insertAdjacentHTML('beforeend','<section data-testid="authorization-card"><button>拒绝</button><button>允许一次</button><button aria-haspopup="menu">更多</button></section>');
  if(guard==='settlement')Object.assign(task,{approvalSettlementUntil:Date.now()+60000,approvalSettlementURL:task.url,approvalSettlementToken:task.token,approvalSettlementPhase:task.phase,approvalSettlementRound:task.round});
  if(guard==='paused')task.state='paused';
  if(guard==='foreign')task.ownerTabId='another-tab';
  let sent=0;w.document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>sent++);
  assert.equal(await h.continueWithoutAuthorization(task,null,Date.now(),{cloudDelivery:true}),false);assert.equal(sent,0);
  if(guard==='draft')assert.equal(w.document.querySelector('textarea').value,'用户草稿');
 }finally{dom.window.close();}
});
test('legacy pending delivery fields cannot override a valid live report',async()=>{
 const {dom,h,task}=await fixture();try{
  Object.assign(task,{githubDeliveryPending:true,githubDeliveryAttempts:3});
  h.finish(task,report(task,'next',{githubDelivery:delivery}));assert.equal(task.state,'queued');assert.equal(task.round,3);
 }finally{dom.window.close();}
});

for(const status of ['next','complete'])for(const style of ['markdown','autolink','whitespace'])test(`wrapped delivery URL settles without reminder: ${status}/${style}`,async()=>{
 const {dom,w,h,task}=await fixture();try{
  const sha='cc16c51eb94c9926cb3560b6973ef41ee241f399';
  const url='https://github.com/bhrumom/fabushi-desktop/commit/'+sha;
  const commitUrl=style==='markdown'?`[${url}](${url})`:style==='autolink'?`<${url}>`:`  ${url}  `;
  const raw=report(task,status,{githubDelivery:{sha,commitUrl,verified:true}});
  w.document.getElementById('response').textContent=raw;
  let sent=0;w.document.querySelector('[data-testid="send-button"]').onclick=()=>sent++;
  h.finish(task,raw);
  assert.equal(task.state,status==='complete'?'done':'queued');
  assert.equal(task.round,status==='complete'?2:3);assert.equal(sent,0);
 }finally{dom.window.close();}
});
for(const url of [
 `[${delivery.commitUrl}](https://evil.example/commit/${delivery.sha})`,
 `[${delivery.commitUrl}](https://github.com/example/project/commit/${'b'.repeat(40)})`,
 `已提交 ${delivery.commitUrl}`,
 `[commit](${delivery.commitUrl}) trailing prose`,
])test(`wrapped delivery rejects invalid destination ${url}`,async()=>{
 const {dom,h}=await fixture();try{assert.equal(h.reportHasCloudDelivery({githubDelivery:{...delivery,commitUrl:url}}),false);}finally{dom.window.close();}
});

test('large streaming previews update in place and retain history nodes',async()=>{
 const {dom,w,h,task}=await fixture();try{
  task.preview='initial';task.messageVersion=1;
  task.messages=Array.from({length:40},(_,i)=>({role:'assistant',text:'history '+i+' '+ 'x'.repeat(1000),at:Date.now()}));
  h.selectForTest(task.id);
  const preview=w.document.querySelector('.live-preview');assert.ok(preview);
  const feed=preview.parentElement;
  Object.defineProperty(feed,'scrollHeight',{configurable:true,value:10000});
  Object.defineProperty(feed,'clientHeight',{configurable:true,value:500});
  feed.scrollTop=123;
  const history=Array.from(w.document.querySelectorAll('.bubble:not(.live-preview)'));assert.ok(history.length);
  for(let i=0;i<20;i++){
   task.preview='update '+i+' '+ 'y'.repeat(16000);h.paint();
   assert.equal(w.document.querySelector('.live-preview'),preview);
   assert.equal(w.document.querySelector('.bubble:not(.live-preview)'),history[0]);
   assert.equal(preview.textContent,'实时回复\n'+task.preview);
   assert.equal(feed.scrollTop,123,'reader scroll position remains unchanged');
  }
  feed.scrollTop=9490;task.preview='near bottom';h.paint();assert.equal(feed.scrollTop,10000);
  task.messages.push({role:'status',text:'new history',at:Date.now()});task.messageVersion++;h.paint();
  assert.notEqual(w.document.querySelector('.bubble:not(.live-preview)'),history[0]);
  assert.ok(w.document.body.textContent.includes('new history'));
  task.preview='';h.paint();assert.equal(w.document.querySelector('.live-preview'),null);
  task.preview='restored';h.paint();assert.equal(w.document.querySelector('.live-preview').textContent,'实时回复\nrestored');
 }finally{dom.window.close();}
});
test('ordinary long prose skips report parsing and exact reports remain recognized',async()=>{
 const {dom,h,task}=await fixture();try{
  assert.equal(h.currentWorkFinalReport('working '.repeat(30000),task),null);
  assert.equal(h.currentWorkFinalReport(report(task),task).taskId,task.id);
 }finally{dom.window.close();}
});

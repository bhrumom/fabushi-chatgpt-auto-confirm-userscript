import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../chatgpt-auto-confirm.user.js',import.meta.url),'utf8');
const step=text=>`<div data-markdown-text-style="assistant-message" data-markdown-text-tone="tertiary">${text}</div>`;
const body=`<article><div data-message-author-role="user" data-message-id="user">[Fabushi:steps-token]</div></article><section id="activity">${step('整理了依赖范围')}</section><textarea id="prompt-textarea"></textarea>`;
const card='<section data-testid="authorization-card"><button disabled>拒绝</button><button disabled>允许一次</button><button disabled aria-haspopup="menu">更多</button></section>';
async function fixture(html=body){
 const dom=new JSDOM(`<main>${html}</main>`,{url:'https://chatgpt.com/c/steps',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 w.Element.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[{width:1,height:1}];};
 w.navigator.locks={request:(_n,o,cb)=>Promise.resolve((cb||o)({})),query:()=>Promise.resolve({held:[]})};
 let now=1800000000000;w.Date.now=()=>now;
 await w.eval(source.replace('  mount();',`  window.h={stopObservedGenerationIdentity,recoveryUserBoundaryKey,stepsOnlyResponse,handleStepsOnlyRest,recheckStepsOnlyRest,stepsOnlyRestDeadline,queueInterruptedFreshRetry,taskDeferredUntil,durableTaskSnapshot,inspect,send,navigate,refreshStalledConversation,memoryDiscardSafety,taskStatusText,data,pause,tabId,run:()=>{running=true;data.autoResume=true;data.autoApprove=false;data.requireAuthorizationBeforeNewChat=false;}};\n  mount();`));
 const h=w.h;h.run();
 const task={id:'steps',ownerTabId:h.tabId,token:'steps-token',url:w.location.href,phase:'work',round:77,mode:'goal',goal:'keep goal',state:'waiting',attempted:false,messages:[],attachments:[{name:'keep.txt'}]};
 h.data.tasks.push(task);
 return {w,h,task,advance:ms=>now+=ms,now:()=>now,close:()=>{h.pause();dom.window.close();}};
}
const fresh=f=>f.h.queueInterruptedFreshRetry(f.task,'已确认会话结束，需要新开',f.now(),null,{allowExactRouteFallback:true});
test('active steps never start rest after two minutes or hours; idle activity alone is not fresh-session authority',async()=>{
 const f=await fixture(body+'<button data-testid="stop-button">Stop</button>');try{
  const {h,task,w}=f;const signal=new w.AbortController().signal;
  await h.inspect(task,signal);f.advance(7200000);await h.inspect(task,signal);
  assert.equal(h.stepsOnlyRestDeadline(task),0);assert.equal(task.url,w.location.href);
  assert.equal(h.handleStepsOnlyRest(task,{freshRequired:true}),false,'Stop blocks even a direct rest request');
  w.document.querySelector('[data-testid="stop-button"]').remove();
  assert.equal(h.handleStepsOnlyRest(task),false,'idle without the fresh transition is insufficient');
  assert.equal(h.stepsOnlyRestDeadline(task),0);
 }finally{f.close();}
});
test('normal ended-without-final confirmation precedes the hour; no initial two-minute activity timer remains',async()=>{
 const f=await fixture();try{
  const {h,task,w}=f;const signal=new w.AbortController().signal;
  await h.inspect(task,signal);assert.equal(h.stepsOnlyRestDeadline(task),0);
  f.advance(7999);await h.inspect(task,signal);assert.equal(h.stepsOnlyRestDeadline(task),0);
  f.advance(2);await h.inspect(task,signal);assert.equal(h.stepsOnlyRestDeadline(task),f.now()+3600000);
  assert.equal(task.url,w.location.href);assert.equal(task.state,'waiting');
 }finally{f.close();}
});
test('pending approval never starts rest, including the screenshot with no Stop button',async()=>{
 const f=await fixture(body+card);try{
  const {h,task,w}=f;const signal=new w.AbortController().signal;
  await h.inspect(task,signal);f.advance(7200000);await h.inspect(task,signal);fresh(f);
  assert.equal(h.stepsOnlyRestDeadline(task),0);assert.equal(task.url,w.location.href);
  assert.equal(task.state,'approval');
 }finally{f.close();}
});
test('existing authorization-card continuation setting is honored before any rest',async()=>{
 const f=await fixture();try{
  const {h,task}=f;h.data.requireAuthorizationBeforeNewChat=true;
  fresh(f);assert.equal(task.authorizationRequiredContinuation,true);assert.equal(h.stepsOnlyRestDeadline(task),0);
 }finally{f.close();}
});
test('an ended fresh-session transition rests for one durable hour and subsequent sessions repeat without cap',async()=>{
 const f=await fixture();try{
  const {h,w}=f;fresh(f);const deadline=f.now()+3600000;
  assert.equal(h.stepsOnlyRestDeadline(f.task),deadline);assert.equal(f.task.url,w.location.href);
  assert.match(h.taskStatusText(f.task),/已结束且无卡无正文/);assert.equal(h.memoryDiscardSafety().safe,false);
  const restored=JSON.parse(JSON.stringify(h.durableTaskSnapshot(f.task)));h.data.tasks[0]=restored;f.task=restored;
  f.advance(3599999);fresh(f);assert.equal(h.stepsOnlyRestDeadline(restored),deadline);
  f.advance(1);fresh(f);assert.equal(restored.state,'queued');assert.equal(restored.url,'');assert.equal(restored.token,'');
  assert.equal(restored.round,77);assert.equal(restored.goal,'keep goal');assert.equal(restored.attachments[0].name,'keep.txt');
  assert.match(restored.abnormalFreshCarry,/整理了依赖范围/);
  for(let n=0;n<5;n++){
   restored.url=w.location.href;restored.token='steps-token';restored.state='waiting';
   fresh(f);assert.equal(h.stepsOnlyRestDeadline(restored),f.now()+3600000);
   f.advance(3600000);fresh(f);assert.equal(restored.state,'queued');assert.equal(restored.round,77);
  }
 }finally{f.close();}
});
test('real output, resumed generation and newly mounted cards cancel valid rest through passive inspection',async()=>{
 for(const kind of ['reply','stop','stream','card']){
  const f=await fixture();try{
   const {h,task,w}=f;fresh(f);
   const extra=kind==='reply'?'<div data-message-author-role="assistant" class="markdown">实际回复正文</div>':kind==='stop'?'<button data-testid="stop-button">Stop</button>':kind==='stream'?'<article data-is-streaming="true"><div data-message-author-role="assistant" data-is-streaming="true"></div></article>':card;
   w.document.querySelector('main').insertAdjacentHTML('beforeend',extra);
   assert.equal(h.recheckStepsOnlyRest(task),false,kind);assert.equal(h.stepsOnlyRestDeadline(task),0,kind);
   assert.equal(task.url,w.location.href);assert.equal(task.round,77);
  }finally{f.close();}
 }
});
test('legacy premature-rest deadlines cannot delay supervision, navigation, sends, UI or memory cleanup',async()=>{
 const f=await fixture(body+'<button data-testid="stop-button">Stop</button>');try{
  const {h,task,w}=f;task.stepsOnlyRestUntil=f.now()+3600000;task.stepsOnlySince=f.now()-120000;task.stepsOnlyBoundary='old';
  assert.equal(h.taskDeferredUntil(task),f.now());assert.doesNotMatch(h.taskStatusText(task),/休息/);
  assert.equal(h.stepsOnlyRestDeadline(task),0);
  await h.inspect(task,new w.AbortController().signal);
  assert.equal(task.stepsOnlyRestUntil,0);assert.equal(task.url,w.location.href);
  assert.ok(task.messages.some(m=>/取消旧版本提前开始/.test(m.text)));
 }finally{f.close();}
});
test('passive rest checks do not send, navigate, refresh, change the fixed hour or prevent other tasks running',async()=>{
 const f=await fixture();try{
  const {h,task,w}=f;fresh(f);const deadline=h.stepsOnlyRestDeadline(task);const signal=new w.AbortController().signal;
  f.advance(15000);await h.inspect(task,signal);
  assert.equal(h.stepsOnlyRestDeadline(task),deadline);assert.equal(h.taskDeferredUntil(task),f.now()+15000);
  await h.send(task,signal);assert.equal(await h.navigate('https://chatgpt.com/',signal,task),false);
  assert.equal(h.refreshStalledConversation(task,true,f.now(),{force:true}),false);assert.equal(task.url,w.location.href);
  const other={...task,id:'other',url:'https://chatgpt.com/c/other',stepsOnlyRestUntil:0};assert.equal(h.taskDeferredUntil(other),f.now());
 }finally{f.close();}
});
test('ownership, drafts, manual pause and ambiguous sends never qualify for hourly rest',async()=>{
 for(const kind of ['old','hidden','foreign','manual','paused','attempted','draft','blocked']){
  const f=await fixture();try{
   const {h,task,w}=f;
   if(kind==='old')w.document.querySelector('main').prepend(w.document.querySelector('#activity'));
   if(kind==='hidden')w.document.querySelector('#activity').hidden=true;
   if(kind==='foreign')task.token='foreign';
   if(kind==='manual')w.document.querySelector('#activity').insertAdjacentHTML('beforebegin','<div data-message-author-role="user">manual</div>');
   if(kind==='paused')task.state='paused';if(kind==='attempted')task.attempted=true;
   if(kind==='draft')w.document.querySelector('textarea').value='keep draft';
   h.handleStepsOnlyRest(task,{freshRequired:true,blocked:kind==='blocked'});
   assert.equal(h.stepsOnlyRestDeadline(task),0,kind);
  }finally{f.close();}
 }
});
test('virtualized stopped session preserves rest identity and carries only current response activity',async()=>{
 const f=await fixture(`<div data-content-search-turn-key="old"><div data-message-author-role="assistant" class="markdown">OLD REAL REPLY</div>${step('old activity')}</div><div data-content-search-turn-key="current">${body}</div>`);try{
  const {w,h,task}=f;
  task.stopObservedUserBoundaryKey=h.recoveryUserBoundaryKey(w.document.querySelector('[data-message-author-role="user"]'));
  task.stopObservedGenerationIdentity=h.stopObservedGenerationIdentity(task,w.location.href);
  fresh(f);const deadline=h.stepsOnlyRestDeadline(task);w.document.querySelector('[data-message-author-role="user"]').remove();
  h.recheckStepsOnlyRest(task);assert.equal(h.stepsOnlyRestDeadline(task),deadline);
  f.advance(3600000);fresh(f);assert.equal(task.state,'queued');
  assert.match(task.abnormalFreshCarry,/整理了依赖范围/);assert.doesNotMatch(task.abnormalFreshCarry,/OLD REAL REPLY|old activity/);
 }finally{f.close();}
});

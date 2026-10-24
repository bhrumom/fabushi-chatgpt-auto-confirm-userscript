import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../chatgpt-auto-confirm.user.js',import.meta.url),'utf8');
const step=text=>`<div data-markdown-text-style="assistant-message" data-markdown-text-tone="tertiary">${text}</div>`;
const body=`<article><div data-message-author-role="user" data-message-id="user">[Fabushi:steps-token]</div></article><section id="activity">${step('整理了依赖范围')}</section><button data-testid="stop-button">Stop</button><textarea id="prompt-textarea"></textarea>`;
function fixture(html=body){
 const dom=new JSDOM(`<main>${html}</main>`,{url:'https://chatgpt.com/c/steps',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window;
 w.Element.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[{width:1,height:1}];};
 w.navigator.locks={request:(_n,o,cb)=>Promise.resolve((cb||o)({})),query:()=>Promise.resolve({held:[]})};
 let now=1800000000000;w.Date.now=()=>now;
 w.eval(source.replace('  mount();',`  window.h={stepsOnlyResponse,handleStepsOnlyRest,taskDeferredUntil,durableTaskSnapshot,inspect,send,navigate,refreshStalledConversation,memoryDiscardSafety,taskStatusText,data,pause,tabId,run:()=>{running=true;data.autoResume=true;}};\n  mount();`));
 const h=w.h;h.run();
 const task={id:'steps',ownerTabId:h.tabId,token:'steps-token',url:w.location.href,phase:'work',round:77,mode:'goal',goal:'keep goal',state:'waiting',attempted:false,messages:[],attachments:[{name:'keep.txt'}]};
 h.data.tasks.push(task);
 return {w,h,task,advance:ms=>now+=ms,now:()=>now,close:()=>{h.pause();dom.window.close();}};
}
test('changing work summaries do not reset grace; rest lasts a durable hour and fresh sessions repeat without cap',()=>{
 const f=fixture();const {h,task,w}=f;
 try{
  assert.equal(h.handleStepsOnlyRest(task),true);
  f.advance(119999);w.document.querySelector('#activity').innerHTML+=step('完成扩展依赖核查');
  h.handleStepsOnlyRest(task);assert.equal(task.stepsOnlyRestUntil,0);
  f.advance(1);h.handleStepsOnlyRest(task);const deadline=f.now()+3600000;
  assert.equal(task.stepsOnlyRestUntil,deadline);assert.equal(h.taskDeferredUntil(task),deadline);
  assert.match(h.taskStatusText(task),/60 分钟/);assert.equal(h.memoryDiscardSafety().safe,false);
  const restored=JSON.parse(JSON.stringify(h.durableTaskSnapshot(task)));h.data.tasks[0]=restored;
  f.advance(3599999);h.handleStepsOnlyRest(restored);assert.equal(restored.stepsOnlyRestUntil,deadline);assert.equal(restored.url,task.url);
  f.advance(1);assert.equal(h.handleStepsOnlyRest(restored),true);
  assert.equal(restored.state,'queued');assert.equal(restored.url,'');assert.equal(restored.token,'');
  assert.equal(restored.round,77);assert.equal(restored.goal,'keep goal');assert.equal(restored.attachments[0].name,'keep.txt');
  assert.match(restored.abnormalFreshCarry,/整理了依赖范围/);assert.equal(restored.authorizationRequiredContinuation,false);
  assert.equal(h.handleStepsOnlyRest(restored),false);assert.equal(restored.history.length,1);
  for(let n=0;n<5;n++){
   restored.url=w.location.href;restored.token='steps-token';restored.state='waiting';
   h.handleStepsOnlyRest(restored);f.advance(120000);h.handleStepsOnlyRest(restored);
   assert.equal(restored.stepsOnlyRestUntil,f.now()+3600000);f.advance(3600000);h.handleStepsOnlyRest(restored);
   assert.equal(restored.state,'queued');assert.equal(restored.round,77);
  }
 }finally{f.close();}
});
test('a real primary reply cancels steps-only observation, including a reply that arrives during rest',()=>{
 const f=fixture();try{
  const {h,task,w}=f;h.handleStepsOnlyRest(task);f.advance(120000);h.handleStepsOnlyRest(task);f.advance(3600000);
  w.document.querySelector('#activity').insertAdjacentHTML('afterend','<article><div data-message-author-role="assistant"><div class="markdown">实际回复正文</div></div></article>');
  assert.equal(h.stepsOnlyResponse(task).hasReply,true);assert.equal(h.handleStepsOnlyRest(task),false);
  assert.equal(task.stepsOnlyRestUntil,0);assert.equal(task.url,w.location.href);assert.equal(task.round,77);
 }finally{f.close();}
});
test('old, hidden, foreign and newer manual turns cannot enter rest',()=>{
 for(const kind of ['old','hidden','foreign','manual','paused','attempted','blocked','draft']){
  const f=fixture();try{
   const {h,task,w}=f;
   if(kind==='old')w.document.querySelector('main').prepend(w.document.querySelector('#activity'));
   if(kind==='hidden')w.document.querySelector('#activity').hidden=true;
   if(kind==='foreign')task.token='foreign';
   if(kind==='manual')w.document.querySelector('#activity').insertAdjacentHTML('beforebegin','<div data-message-author-role="user">manual</div>');
   if(kind==='paused')task.state='paused';
   if(kind==='attempted')task.attempted=true;
   if(kind==='draft')w.document.querySelector('textarea').value='keep my draft';
   h.handleStepsOnlyRest(task,{blocked:kind==='blocked'});f.advance(7200000);h.handleStepsOnlyRest(task,{blocked:kind==='blocked'});
   assert.ok(!task.stepsOnlyRestUntil,kind);assert.equal(task.url,w.location.href,kind);
  }finally{f.close();}
 }
});
test('inspection, sends, navigation and refresh are suppressed before rest deadline',async()=>{
 const f=fixture();try{
  const {h,task,w}=f;h.handleStepsOnlyRest(task);f.advance(120000);h.handleStepsOnlyRest(task);
  const before=JSON.stringify(task);const signal=new w.AbortController().signal;
  await h.inspect(task,signal);await h.send(task,signal);
  assert.equal(await h.navigate('https://chatgpt.com/',signal,task),false);
  assert.equal(h.refreshStalledConversation(task,true,f.now(),{force:true}),false);
  assert.equal(JSON.stringify(task),before);
 }finally{f.close();}
});
test('inspect detects steps-only while Stop is active before generic recovery',async()=>{
 const f=fixture();try{
  const {h,task,w}=f;const signal=new w.AbortController().signal;
  await h.inspect(task,signal);assert.equal(task.stepsOnlySince,f.now());
  f.advance(120000);await h.inspect(task,signal);assert.equal(task.stepsOnlyRestUntil,f.now()+3600000);
 }finally{f.close();}
});
test('a pending live grant at expiry prevents fresh-session handoff even with the historical gate bypass',()=>{
 const f=fixture();try{
  const {h,task,w}=f;h.data.requireAuthorizationBeforeNewChat=true;
  h.handleStepsOnlyRest(task);f.advance(120000);h.handleStepsOnlyRest(task);f.advance(3600000);
  w.document.querySelector('main').insertAdjacentHTML('beforeend','<section data-testid="authorization-card"><button disabled>拒绝</button><button disabled>允许一次</button><button disabled aria-haspopup="menu">更多</button></section>');
  h.handleStepsOnlyRest(task);
  assert.equal(task.state,'approval');assert.equal(task.url,w.location.href);assert.equal(task.token,'steps-token');
 }finally{f.close();}
});
test('existing real body never enters grace, and nested activity in an assistant wrapper is not a body',()=>{
 for(const real of [false,true]){
  const html=body.replace('<section id="activity">','<section id="activity" data-message-author-role="assistant">')
    .replace('</section>',`${real?'<div class="markdown">真实回复</div>':''}</section>`);
  const f=fixture(html);try{
   assert.equal(f.h.stepsOnlyResponse(f.task).hasReply,real);
   assert.equal(f.h.handleStepsOnlyRest(f.task),!real);
  }finally{f.close();}
 }
});

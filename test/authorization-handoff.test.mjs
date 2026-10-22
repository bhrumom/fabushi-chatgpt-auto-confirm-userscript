import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
const source = await fs.readFile(new URL('../chatgpt-auto-confirm.user.js', import.meta.url), 'utf8');
const names = 'data,tabId,cards,concurrentRequestRetry,recoverConcurrentRequest,authorizationContinuationAttempts,authorizationGateExhausted,durableWorkbenchSnapshot,recordConversationAuthorization,conversationAuthorizationSeen,requireConversationAuthorization,continueWithoutAuthorization,durableTaskSnapshot,finish,queueInterruptedFreshRetry,queueBlockedFreshRetry,queueConversationLengthHandoff,queueWorkFinalReportRepair,clearDispatchIntent';
async function harness({authorizationGate=true}={}) {
  const dom = new JSDOM('<main><article data-message-author-role="user" data-message-id="u1">[Fabushi:guard-token]</article><article data-message-author-role="assistant" data-message-id="a1">已结束的回复</article></main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button">发送</button></form>', { runScripts:'outside-only', pretendToBeVisual:true, url:'https://chatgpt.com/c/guard' });
  const w = dom.window;
  w.Element.prototype.getClientRects = () => [{width:1,height:1}];
  w.navigator.locks = { request(_n, options, callback) { return Promise.resolve((typeof options === 'function' ? options : callback)({})); } };
  await w.eval(source.replace('  mount();', `  window.hooks = {${names},run:()=>{running=true;data.autoResume=true;},halt:()=>{running=false;}};\n  mount();`));
  const h=w.hooks;
  const task={id:'guard',ownerTabId:h.tabId,url:w.location.href,phase:'work',round:1,mode:'goal',state:'waiting',token:'guard-token',attempted:false,goal:'完成目标',attachments:[],messages:[],goalRevision:0,dispatchGoalRevision:0};
  h.data.requireAuthorizationBeforeNewChat=authorizationGate;
  h.data.tasks.push(task); h.run();
  return {dom,w,h,task};
}
for (const method of ['finish','queueInterruptedFreshRetry','queueBlockedFreshRetry','queueConversationLengthHandoff','queueWorkFinalReportRepair']) {
  test(`no card blocks ${method} without losing dispatch identity`, async()=>{
    const {dom,h,task}=await harness();
    try {
      const before=JSON.stringify([task.url,task.token,task.round,task.phase,task.attachments]);
      if(method==='finish') h.finish(task,JSON.stringify({taskId:task.id,round:1,status:'complete',summary:'已完成',next:''}));
      else h[method](task);
      assert.equal(task.authorizationRequiredContinuation,true);
      assert.equal(task.state,'waiting');
      assert.equal(JSON.stringify([task.url,task.token,task.round,task.phase,task.attachments]),before);
    } finally {dom.window.close();}
  });
}
test('real disabled card is persisted on its owner and never reused on another route',async()=>{
  const {dom,w,h,task}=await harness();
  try {
    w.document.querySelector('main').insertAdjacentHTML('beforeend','<section data-testid="authorization-card"><button disabled>拒绝</button><button disabled>允许一次</button><button aria-haspopup="menu" disabled>更多</button></section>');
    assert.ok(h.cards({wide:true}).length);
    assert.equal(h.conversationAuthorizationSeen(task),true);
    const stored=JSON.stringify(h.durableTaskSnapshot(task));
    assert.ok(JSON.parse(stored).authorizationSeenAt>0);
    assert.equal(h.conversationAuthorizationSeen(JSON.parse(stored)),true);
    task.url='https://chatgpt.com/c/next';
    assert.equal(h.conversationAuthorizationSeen(task),false);
    assert.equal(h.recordConversationAuthorization(task,w.location.href),false);
  } finally {dom.window.close();}
});
test('same-conversation continuation sends exact prompt once per user boundary even after state reload',async()=>{
  const {dom,w,h,task}=await harness();
  try {
    h.requireConversationAuthorization(task);
    let clicks=0;
    w.document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>clicks++);
    assert.equal(await h.continueWithoutAuthorization(task,new w.AbortController().signal),true);
    assert.equal(w.document.querySelector('textarea').value,'继续完成所有，闭环后按模板输入');
    assert.equal(clicks,1);
    assert.equal(task.url,'https://chatgpt.com/c/guard');
    Object.assign(task,JSON.parse(JSON.stringify(task)));
    task.continuationSentAt=1;
    assert.equal(await h.continueWithoutAuthorization(task,new w.AbortController().signal),false);
    assert.equal(clicks,1);
  } finally {dom.window.close();}
});
for(const scenario of ['draft','paused','stop','foreign-route','aborted','runner-paused']) {
  test(`continuation respects ${scenario}`,async()=>{
    const {dom,w,h,task}=await harness();
    try {
      h.requireConversationAuthorization(task);
      if(scenario==='draft') w.document.querySelector('textarea').value='用户草稿';
      if(scenario==='paused') task.state='paused';
      if(scenario==='stop') w.document.body.insertAdjacentHTML('beforeend','<button aria-label="停止生成"></button>');
      if(scenario==='foreign-route') w.history.replaceState({},'', '/c/other');
      const controller=new w.AbortController();
      if(scenario==='aborted') controller.abort();
      if(scenario==='runner-paused') h.halt();
      let clicks=0;w.document.querySelector('[data-testid="send-button"]').onclick=()=>clicks++;
      assert.equal(await h.continueWithoutAuthorization(task,controller.signal),false);
      assert.equal(clicks,0);
    } finally {dom.window.close();}
  });
}
test('observed authorization permits next-round handoff and initial unbound dispatch is exempt',async()=>{
  const {dom,h,task}=await harness();
  try {
    h.recordConversationAuthorization(task);
    h.finish(task,`MAHAYANA_TASK_REPORT_V1\n${JSON.stringify({taskId:task.id,round:1,status:'next',summary:'已核验',next:'继续读取当前证据'})}`);
    assert.equal(task.round,2);
    assert.equal(task.url,'');
    assert.equal(task.state,'queued');
    assert.equal(h.conversationAuthorizationSeen(task),false);
    assert.equal(h.requireConversationAuthorization(task),false);
  } finally {dom.window.close();}
});

test('new current card resumes the gate but quoted authorization never qualifies',async()=>{
  const {dom,w,h,task}=await harness();
  try {
    w.document.querySelector('main').insertAdjacentHTML('beforeend','<blockquote><section data-testid="authorization-card"><button>拒绝</button><button>允许一次</button><button aria-haspopup="menu">更多</button></section></blockquote>');
    h.cards({wide:true});
    assert.equal(h.conversationAuthorizationSeen(task),false);
    h.requireConversationAuthorization(task);
    assert.equal(task.authorizationRequiredContinuation,true);
    w.document.querySelector('main').insertAdjacentHTML('beforeend','<section data-testid="authorization-card"><button>拒绝</button><button>允许一次</button><button aria-haspopup="menu">更多</button></section>');
    h.cards({wide:true});
    assert.equal(h.conversationAuthorizationSeen(task),true);
    assert.equal(h.requireConversationAuthorization(task),true);
    assert.equal(task.state,'approval');
    let clicks=0;w.document.querySelector('[data-testid="send-button"]').onclick=()=>clicks++;
    assert.equal(await h.continueWithoutAuthorization(task,new w.AbortController().signal),false);
    assert.equal(clicks,0);
    w.document.querySelectorAll('[data-testid="authorization-card"]').forEach(node=>node.remove());
    assert.equal(h.requireConversationAuthorization(task),false);
  } finally {dom.window.close();}
});

test('virtualized original marker continues only on the bound route without a competing marker',async()=>{
  const {dom,w,h,task}=await harness();
  try {
    w.document.querySelector('[data-message-author-role="user"]').textContent='Original task prompt, marker virtualized';
    h.requireConversationAuthorization(task);
    let clicks=0;w.document.querySelector('[data-testid="send-button"]').onclick=()=>clicks++;
    assert.equal(await h.continueWithoutAuthorization(task,new w.AbortController().signal),true);
    assert.equal(clicks,1);
    task.authorizationRequiredContinuation=true;
    task.continuationSentAt=1;
    w.document.querySelector('[data-message-author-role="user"]').textContent='Other task [Fabushi:foreign-token]';
    assert.equal(await h.continueWithoutAuthorization(task,new w.AbortController().signal),false);
    assert.equal(clicks,1);
  } finally {dom.window.close();}
});

test('an entirely unmounted original user still continues the ended bound assistant response',async()=>{
  const {dom,w,h,task}=await harness();
  try {
    w.document.querySelector('[data-message-author-role="user"]').remove();
    h.requireConversationAuthorization(task);
    let clicks=0;w.document.querySelector('[data-testid="send-button"]').onclick=()=>clicks++;
    assert.equal(await h.continueWithoutAuthorization(task,new w.AbortController().signal),true);
    assert.equal(clicks,1);
    task.continuationSentAt=1;
    task.authorizationRequiredContinuation=true;
    assert.equal(await h.continueWithoutAuthorization(task,new w.AbortController().signal),false);
    assert.equal(clicks,1);
  } finally {dom.window.close();}
});

test('authorization check is an optional persisted workspace switch, default off',async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    assert.equal(h.data.requireAuthorizationBeforeNewChat,false);
    assert.equal(h.requireConversationAuthorization(task),false);
    const control=w.document.querySelector('[aria-label="新开会话前检查授权（最多继续3次）"]');
    assert.ok(control);assert.equal(control.checked,false);
    control.checked=true;control.dispatchEvent(new w.Event('change'));
    assert.equal(h.data.requireAuthorizationBeforeNewChat,true);
    assert.equal(JSON.parse(w.localStorage.getItem('fabushi-workbench-v2')).tabControls[h.tabId].requireAuthorizationBeforeNewChat,true);
    h.data.tabControls.other={autoResume:true,requireAuthorizationBeforeNewChat:false};
    const saved=h.durableWorkbenchSnapshot(h.data);
    assert.equal(saved.tabControls[h.tabId].requireAuthorizationBeforeNewChat,true);
    assert.equal(saved.tabControls.other.requireAuthorizationBeforeNewChat,false);
    h.requireConversationAuthorization(task);assert.equal(task.authorizationRequiredContinuation,true);
    control.checked=false;control.dispatchEvent(new w.Event('change'));
    assert.equal(task.authorizationRequiredContinuation,false);
    assert.equal(task.url,'https://chatgpt.com/c/guard');
  }finally{dom.window.close();}
});
test('enabled gate sends at most three continuations and hands off instead of accepting complete',async()=>{
  const {dom,w,h,task}=await harness();
  try {
    let now=Date.now();w.Date.now=()=>now;
    let sends=0;
    const button=w.document.querySelector('[data-testid="send-button"]');
    button.onclick=event=>{event.preventDefault();sends++;};
    for(let index=0;index<3;index++) {
      h.requireConversationAuthorization(task);
      assert.equal(await h.continueWithoutAuthorization(task,new w.AbortController().signal,now),true);
      w.document.querySelector('textarea').value='';
      w.document.querySelector('main').insertAdjacentHTML('beforeend',`<article data-message-author-role="user" data-message-id="continue-${index}">继续完成所有，闭环后按模板输入</article><article data-message-author-role="assistant" data-message-id="reply-${index}">本轮结束，尚未授权</article>`);
      now+=60_001;
    }
    assert.equal(sends,3);assert.equal(h.authorizationContinuationAttempts(task),3);
    assert.equal(h.authorizationGateExhausted(task),true);
    assert.equal(await h.continueWithoutAuthorization(task,new w.AbortController().signal,now),false);
    assert.equal(sends,3);
    h.finish(task,JSON.stringify({taskId:task.id,round:1,status:'complete',summary:'完成声明',next:''}));
    assert.equal(task.state,'queued');assert.equal(task.url,'');assert.equal(task.round,1);
    assert.equal(task.history.at(-1).reason,'authorization-continuation-limit');
    assert.equal(h.authorizationContinuationAttempts(task),0);
  }finally{dom.window.close();}
});
test('existing same-route sends migrate into the cap, survive toggles and do not leak across routes',async()=>{
  const {dom,h,task}=await harness();
  try {
    task.authorizationContinuationURL=task.url;task.continuationCount=3;
    assert.equal(h.authorizationContinuationAttempts(task),3);
    assert.equal(h.requireConversationAuthorization(task),false);
    h.data.requireAuthorizationBeforeNewChat=false;h.data.requireAuthorizationBeforeNewChat=true;
    assert.equal(h.authorizationGateExhausted(task),true);
    task.url='https://chatgpt.com/c/different';
    assert.equal(h.authorizationContinuationAttempts(task),0);
    assert.equal(h.authorizationGateExhausted(task),false);
  }finally{dom.window.close();}
});
test('concurrent request error waits, retries once with durable intent, then recovers the task',async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    let now=Date.now();w.Date.now=()=>now;
    w.document.querySelector('[data-message-author-role="assistant"]').innerHTML='<div>Too many concurrent requests</div><button id="retry">重试</button>';
    let retries=0;w.document.querySelector('#retry').onclick=()=>retries++;
    assert.equal(await h.recoverConcurrentRequest(task,null,now),true);
    assert.equal(task.concurrentRequestRetryAt,now+30_000);assert.equal(retries,0);
    now+=29_999;await h.recoverConcurrentRequest(task,null,now);assert.equal(retries,0);
    now++;await h.recoverConcurrentRequest(task,null,now);assert.equal(retries,1);
    Object.assign(task,JSON.parse(JSON.stringify(task)));
    now+=59_999;await h.recoverConcurrentRequest(task,null,now);assert.equal(retries,1);
    now++;assert.equal(await h.recoverConcurrentRequest(task,null,now),true);
    assert.equal(retries,1);assert.equal(task.url,'');assert.equal(task.state,'queued');
    assert.equal(task.history.at(-1).reason,'concurrent-request-error');
    assert.equal(task.round,1);
  }finally{dom.window.close();}
});
for(const condition of ['quote','foreign-route','paused','draft','approval','stop','newer-success']) {
  test(`concurrency recovery respects ${condition}`,async()=>{
    const {dom,w,h,task}=await harness({authorizationGate:false});
    try {
      w.document.querySelector('[data-message-author-role="assistant"]').innerHTML='<div>Too many concurrent requests</div><button id="retry">重试</button>';
      if(condition==='quote') w.document.querySelector('[data-message-author-role="assistant"]').innerHTML='<blockquote>Too many concurrent requests</blockquote><button id="retry">重试</button>';
      if(condition==='foreign-route') w.history.replaceState({},'', '/c/foreign');
      if(condition==='paused') task.state='paused';
      if(condition==='draft') w.document.querySelector('textarea').value='用户草稿';
      if(condition==='approval') w.document.querySelector('main').insertAdjacentHTML('beforeend','<section data-testid="approval-card"><button>允许</button></section>');
      if(condition==='stop') w.document.body.insertAdjacentHTML('beforeend','<button aria-label="停止生成"></button>');
      if(condition==='newer-success') w.document.querySelector('main').insertAdjacentHTML('beforeend','<article data-message-author-role="assistant" data-message-id="success">新的成功结果</article>');
      let retries=0;w.document.querySelector('#retry').onclick=()=>retries++;
      const before=task.url;
      await h.recoverConcurrentRequest(task,null,Date.now());
      await h.recoverConcurrentRequest(task,null,Date.now()+300_001);
      assert.equal(retries,0);assert.equal(task.url,before);
    }finally{dom.window.close();}
  });
}

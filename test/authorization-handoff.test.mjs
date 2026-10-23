import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
const source = await fs.readFile(new URL('../chatgpt-auto-confirm.user.js', import.meta.url), 'utf8');
const names = 'authorizationContinuationBoundaryKey,ownedAuthorizationContinuationDraft,taskTurnForInspection,sendTimeoutNotice,measurements,connectionInterruptionContinuationPending,authorizationContinuationEnabled,isContinuationPrompt,data,tabId,cards,inspect,recoverStoppedConversation,revealStoppedResponseActivity,authorizationContinuationAttempts,authorizationGateExhausted,durableWorkbenchSnapshot,recordConversationAuthorization,conversationAuthorizationSeen,requireConversationAuthorization,continueWithoutAuthorization,durableTaskSnapshot,finish,queueInterruptedFreshRetry,queueBlockedFreshRetry,queueConversationLengthHandoff,queueWorkFinalReportRepair,clearDispatchIntent';
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
    const control=w.document.querySelector('button[aria-label="开启授权卡片接力"]');
    const off=w.document.querySelector('button[aria-label="关闭授权卡片接力"]');
    assert.ok(control);assert.ok(off);assert.equal(control.getAttribute('aria-pressed'),'false');
    assert.equal(off.getAttribute('aria-pressed'),'true');
    assert.equal(control.closest('form'),null,'the handoff switch stays outside the bottom composer');
    assert.equal(control.closest('section').previousElementSibling.tagName,'HEADER');
    control.click();
    assert.equal(h.data.requireAuthorizationBeforeNewChat,true);
    assert.equal(control.getAttribute('aria-pressed'),'true');
    assert.match(control.closest('section').textContent,/已开启/);
    assert.equal(JSON.parse(w.localStorage.getItem('fabushi-workbench-v2')).tabControls[h.tabId].requireAuthorizationBeforeNewChat,true);
    h.data.tabControls.other={autoResume:true,requireAuthorizationBeforeNewChat:false};
    h.data.tasks.push({id:'other-workspace-task',ownerTabId:'other',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/other-workspace',attachments:[]});
    const saved=h.durableWorkbenchSnapshot(h.data);
    assert.equal(saved.tabControls[h.tabId].requireAuthorizationBeforeNewChat,true);
    assert.equal(saved.tabControls.other.requireAuthorizationBeforeNewChat,false);
    h.requireConversationAuthorization(task);assert.equal(task.authorizationRequiredContinuation,true);
    off.click();
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
test('a stopped concurrent-error reply uses structural confirmation and carried handoff without Retry',async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    let now=Date.now();w.Date.now=()=>now;
    w.document.querySelector('[data-message-author-role="assistant"]').innerHTML='<div>Too many concurrent requests</div><button id="retry" aria-label="重试">重试</button>';
    let retries=0;w.document.querySelector('#retry').onclick=()=>retries++;
    assert.equal(await h.recoverStoppedConversation(task,null,now),false);
    assert.equal(task.stoppedConversationSince,now);
    now+=7_999;assert.equal(await h.recoverStoppedConversation(task,null,now),false);
    Object.assign(task,JSON.parse(JSON.stringify(task)));
    now++;assert.equal(await h.recoverStoppedConversation(task,null,now),true);
    assert.equal(retries,0);assert.equal(task.url,'');assert.equal(task.state,'queued');
    assert.equal(task.history.at(-1).reason,'structural-stop-absence');assert.equal(task.round,1);
  }finally{dom.window.close();}
});
for(const condition of ['foreign-route','paused','draft','approval','stop','newer-success']) {
  test(`concurrency recovery respects ${condition}`,async()=>{
    const {dom,w,h,task}=await harness({authorizationGate:false});
    try {
      w.document.querySelector('[data-message-author-role="assistant"]').innerHTML='<div>Too many concurrent requests</div><button id="retry" aria-label="重试">重试</button>';
      if(condition==='quote') w.document.querySelector('[data-message-author-role="assistant"]').innerHTML='<blockquote>Too many concurrent requests</blockquote><button id="retry" aria-label="重试">重试</button>';
      if(condition==='foreign-route') w.history.replaceState({},'', '/c/foreign');
      if(condition==='paused') task.state='paused';
      if(condition==='draft') w.document.querySelector('textarea').value='用户草稿';
      if(condition==='approval') w.document.querySelector('main').insertAdjacentHTML('beforeend','<section data-testid="approval-card"><button>允许</button></section>');
      if(condition==='stop') w.document.body.insertAdjacentHTML('beforeend','<button aria-label="停止生成"></button>');
      if(condition==='newer-success') w.document.querySelector('main').insertAdjacentHTML('beforeend','<article data-message-author-role="assistant" data-message-id="success">新的成功结果<button aria-label="复制"></button><button aria-label="赞"></button></article>');
      let retries=0;w.document.querySelector('#retry').onclick=()=>retries++;
      const before=task.url;
      await h.recoverStoppedConversation(task,null,Date.now());
      await h.recoverStoppedConversation(task,null,Date.now()+300_001);
      assert.equal(retries,0);assert.equal(task.url,before);
    }finally{dom.window.close();}
  });
}

test('shared-renderer sibling error is handled before a persisted no-card continuation wait',async()=>{
  const {dom,w,h,task}=await harness();
  try {
    w.document.querySelector('main').innerHTML='<div data-content-search-turn-key="shared-concurrent"><div data-content-search-unit-key="shared-concurrent:0:user"><div data-user-message-bubble="true">执行 [Fabushi:guard-token]</div></div><div data-content-search-unit-key="shared-concurrent:2:assistant"><div data-testid="tool-call-result">已有工作记录</div></div><div class="error"><span>Too many concurrent requests</span><button id="retry" aria-label="重试">重试</button></div></div>';
    task.authorizationRequiredContinuation=true;
    let retries=0;w.document.querySelector('#retry').onclick=()=>retries++;
    await h.inspect(task,null);
    assert.ok(task.stoppedConversationSince>0);
    assert.equal(task.state,'waiting');assert.equal(retries,0);
    assert.equal(task.url,'https://chatgpt.com/c/guard');
  }finally{dom.window.close();}
});
test('a settled final reply is not overridden by an earlier concurrent error in the same response',async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    w.document.querySelector('[data-message-author-role="assistant"]').innerHTML='<div>Too many concurrent requests</div><button id="retry" aria-label="重试">重试</button><div class="markdown">'+JSON.stringify({taskId:task.id,round:1,status:'complete',summary:'新的成功结果',next:''})+'</div><button aria-label="复制"></button><button aria-label="赞"></button>';
    let retries=0;w.document.querySelector('#retry').onclick=()=>retries++;
    assert.equal(await h.recoverStoppedConversation(task,null),false);
    assert.equal(retries,0);assert.equal(task.concurrentRequestRetryAt,undefined);
  }finally{dom.window.close();}
});

for(const previousSends of [1,3]) test(`persistent concurrent error respects enabled gate with ${previousSends} prior sends`,async()=>{
  const {dom,w,h,task}=await harness();
  try {
    let now=Date.now();w.Date.now=()=>now;
    task.authorizationContinuationURL=task.url;task.continuationCount=previousSends;
    task.authorizationContinuationAttempts=previousSends;
    task.continuationSentAt=now-120_000;
    w.document.querySelector('main').insertAdjacentHTML('beforeend','<article data-message-author-role="user" data-message-id="continued-user">继续完成所有，闭环后按模板输入</article><article data-message-author-role="assistant" data-message-id="concurrency-failure"><div>Too many concurrent requests</div><button id="retry" aria-label="重试">重试</button></article>');
    let retries=0,sends=0;w.document.querySelector('#retry').onclick=()=>retries++;
    w.document.querySelector('[data-testid="send-button"]').onclick=event=>{event.preventDefault();sends++;};
    await h.recoverStoppedConversation(task,null,now);
    now+=8_000;await h.recoverStoppedConversation(task,null,now);
    assert.equal(retries,0);
    assert.equal(sends,previousSends===3?0:1);
    if(previousSends===3){assert.equal(task.url,'');assert.equal(task.state,'queued');}
    else {assert.equal(task.url,'https://chatgpt.com/c/guard');assert.equal(h.authorizationContinuationAttempts(task),2);}
  }finally{dom.window.close();}
});

for(const variant of ['unknown-error','stale-stream','no-error-copy']) {
  test(`structural recovery handles ${variant} without known error text or Retry`,async()=>{
    const {dom,w,h,task}=await harness({authorizationGate:false});
    try {
      let now=Date.now();w.Date.now=()=>now;
      const response=w.document.querySelector('[data-message-author-role="assistant"]');
      response.innerHTML=variant==='no-error-copy'?'<span data-testid="tool-call-result">执行已停止</span>':'<div>Vendor failure XQ-731</div>';
      if(variant==='stale-stream') {response.setAttribute('aria-busy','true');response.setAttribute('data-is-streaming','true');w.document.body.insertAdjacentHTML('beforeend','<div role="status">Loading</div>');}
      await h.inspect(task,null);
      now+=8_001;await h.inspect(task,null);
      assert.equal(task.state,'queued');assert.equal(task.url,'');
      assert.equal(task.history.at(-1).reason,'structural-stop-absence');
    }finally{dom.window.close();}
  });
}
test('activity is expanded before a lazy authorization card can be declared absent',async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    let now=Date.now();w.Date.now=()=>now;
    const response=w.document.querySelector('[data-message-author-role="assistant"]');
    response.innerHTML='<button id="activity" aria-expanded="false" aria-controls="activity-panel">用时 5分钟 34秒</button><div id="activity-panel"></div>';
    let expands=0;
    w.document.querySelector('#activity').onclick=()=>{expands++;w.document.querySelector('#activity').setAttribute('aria-expanded','true');w.document.querySelector('#activity-panel').innerHTML='<section data-testid="approval-card"><button disabled>允许</button></section>';};
    await h.inspect(task,null);assert.equal(expands,1);assert.equal(task.url,'https://chatgpt.com/c/guard');
    now+=10_000;await h.inspect(task,null);
    assert.equal(task.state,'approval');assert.equal(h.conversationAuthorizationSeen(task),true);
    assert.equal(task.url,'https://chatgpt.com/c/guard');assert.equal(expands,1);
  }finally{dom.window.close();}
});
test('a reappearing Stop and changed response reset generic absence confirmation',async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    let now=Date.now();w.Date.now=()=>now;
    await h.recoverStoppedConversation(task,null,now);
    now+=7_000;w.document.querySelector('[data-message-author-role="assistant"]').textContent='新的真实进度';
    await h.recoverStoppedConversation(task,null,now);assert.equal(task.stoppedConversationSince,now);
    w.document.body.insertAdjacentHTML('beforeend','<button id="stop" aria-label="停止生成"></button>');
    now+=10_000;assert.equal(await h.recoverStoppedConversation(task,null,now),false);
    assert.equal(task.stoppedConversationSince,0);assert.equal(task.url,'https://chatgpt.com/c/guard');
    w.document.querySelector('#stop').remove();now++;
    await h.recoverStoppedConversation(task,null,now);assert.equal(task.stoppedConversationSince,now);
  }finally{dom.window.close();}
});

for(const authorizationGate of [false,true]) for(const variant of ['structural','stale-stop','legacy']) {
  test(`connection interruption continues on original route: gate=${authorizationGate}, ${variant}`,async()=>{
    const {dom,w,h,task}=await harness({authorizationGate});
    try {
      let now=Date.now();w.Date.now=()=>now;
      const response=w.document.querySelector('[data-message-author-role="assistant"]');
      response.innerHTML=variant==='legacy'?'已完成部分工作':'<div>已完成部分工作</div><div>连接已中断，正在等待完整回复</div>';
      if(variant==='legacy') task.pendingContinuationReason='legacy connection interruption';
      let stops=0,sends=0;
      if(variant==='stale-stop') {
        w.document.body.insertAdjacentHTML('beforeend','<button id="stale-stop" aria-label="停止生成"></button>');
        w.document.querySelector('#stale-stop').onclick=()=>{stops++;w.document.querySelector('#stale-stop').remove();};
      }
      w.document.querySelector('[data-testid="send-button"]').onclick=event=>{event.preventDefault();sends++;};
      await h.inspect(task,null); assert.equal(sends,0);
      now+=9_001;await h.inspect(task,null);
      for(let attempt=0;attempt<3&&!sends;attempt++) await h.inspect(task,null);
      assert.equal(sends,1);assert.equal(task.url,'https://chatgpt.com/c/guard');
      assert.equal(w.document.querySelector('textarea').value,'继续完成所有，按模板回复');
      assert.equal(h.isContinuationPrompt(w.document.querySelector('textarea').value),true);
      assert.equal(h.authorizationContinuationAttempts(task),1);
      assert.equal(stops,variant==='stale-stop'?1:0);
      assert.equal(h.data.requireAuthorizationBeforeNewChat,authorizationGate);
      Object.assign(task,JSON.parse(JSON.stringify(h.durableTaskSnapshot(task))));
      assert.equal(h.connectionInterruptionContinuationPending(task),true);
      task.continuationSentAt=1;
      assert.equal(await h.continueWithoutAuthorization(task,null,now+120_000),false);
      assert.equal(sends,1,'reload cannot repeat the same boundary send');
    }finally{dom.window.close();}
  });
}
for(const previousSends of [2,3]) test(`connection exception has shared total cap after ${previousSends} sends with switch off`,async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    let now=Date.now();w.Date.now=()=>now;
    task.authorizationContinuationURL=task.url;task.authorizationContinuationAttempts=previousSends;
    task.continuationCount=previousSends;task.continuationSentAt=now-120_000;
    w.document.querySelector('main').insertAdjacentHTML('beforeend','<article data-message-author-role="user" data-message-id="connection-next">继续完成所有，按模板回复</article><article data-message-author-role="assistant" data-message-id="connection-next-failure">连接已中断，正在等待完整回复</article>');
    let sends=0;w.document.querySelector('[data-testid="send-button"]').onclick=event=>{event.preventDefault();sends++;};
    await h.inspect(task,null);now+=9_001;await h.inspect(task,null);
    if(previousSends===3) {assert.equal(sends,0);assert.equal(task.state,'queued');assert.equal(task.url,'');assert.equal(task.connectionInterruptionContinuationURL,'');}
    else {assert.equal(sends,1);assert.equal(h.authorizationContinuationAttempts(task),3);assert.equal(task.url,'https://chatgpt.com/c/guard');}
  }finally{dom.window.close();}
});
for(const condition of ['draft','paused','foreign-route','approval','authorization-seen','settlement']) test(`connection exception preserves ${condition} protection`,async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    w.document.querySelector('[data-message-author-role="assistant"]').textContent='连接已中断，正在等待完整回复';
    h.queueInterruptedFreshRetry(task,'connection interruption');
    assert.equal(h.connectionInterruptionContinuationPending(task),true);
    if(condition==='draft') w.document.querySelector('textarea').value='保留用户草稿';
    if(condition==='paused') task.state='paused';
    if(condition==='foreign-route') w.history.replaceState({},'', '/c/foreign');
    if(condition==='approval') w.document.querySelector('main').insertAdjacentHTML('beforeend','<section data-testid="approval-card"><button disabled>允许一次</button></section>');
    if(condition==='authorization-seen') h.recordConversationAuthorization(task);
    if(condition==='settlement') {task.approvalSettlementUntil=Date.now()+60_000;task.approvalSettlementURL=task.url;task.approvalSettlementToken=task.token;task.approvalSettlementPhase=task.phase;task.approvalSettlementRound=task.round;}
    let sends=0;w.document.querySelector('[data-testid="send-button"]').onclick=event=>{event.preventDefault();sends++;};
    assert.equal(await h.continueWithoutAuthorization(task,null),false);assert.equal(sends,0);
    if(condition==='draft') assert.equal(w.document.querySelector('textarea').value,'保留用户草稿');
    task.url='https://chatgpt.com/c/new';assert.equal(h.connectionInterruptionContinuationPending(task),false);
    h.clearDispatchIntent(task);assert.equal(task.connectionInterruptionContinuationURL,'');
  }finally{dom.window.close();}
});

function mountStalledContinuation(w,task,{error=false,draft='',sendAvailable=true}={}) {
  w.document.querySelector('main').innerHTML=`<div data-content-search-turn-key="fallback-turn-0"><div data-content-search-unit-key="fallback-turn-0:0:user"><div data-message-id="initial-user"><div data-user-message-bubble="true">执行 [Fabushi:guard-token]</div></div></div><div data-content-search-unit-key="fallback-turn-0:2:assistant"><div data-markdown-text-style="assistant-message" data-markdown-text-tone="primary">已完成真实工作</div></div></div><div data-content-search-turn-key="fallback-turn-1"><div data-content-search-unit-key="fallback-turn-1:0:user"><div data-message-id="continuation-user"><div data-user-message-bubble="true">继续完成所有，按模板回复</div></div></div><div data-content-search-unit-key="fallback-turn-1:2:assistant"><div data-markdown-text-style="assistant-message" data-markdown-text-tone="primary"></div></div>${error?'<div role="alert">消息传输超时。请重试。<button id="retry">重试</button></div>':''}</div>`;
  w.document.querySelector('form').innerHTML=`<div contenteditable="true" data-lexical-editor="true">${draft}</div>${sendAvailable?'<button data-testid="send-button">发送</button>':''}`;
  task.authorizationContinuationURL=task.url;task.connectionInterruptionContinuationURL=task.url;
  task.authorizationRequiredContinuation=true;task.authorizationContinuationAttempts=2;task.continuationCount=2;
}
for(const variant of ['same-boundary-empty','transmission-error-no-send','same-boundary-draft']) test(`observed stalled continuation recovers safely: ${variant}`,async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    let now=Date.now();w.Date.now=()=>now;
    mountStalledContinuation(w,task,{error:variant==='transmission-error-no-send',draft:variant==='same-boundary-empty'?'':'继续完成所有，按模板回复',sendAvailable:variant!=='transmission-error-no-send'});
    task.continuationSentAt=now-8*60*60*1000;
    task.authorizationContinuationBoundary=variant==='transmission-error-no-send'?'["old-user","old-response"]':h.authorizationContinuationBoundaryKey(task,h.taskTurnForInspection(task));
    let sends=0,retries=0;
    w.document.querySelector('[data-testid="send-button"]')?.addEventListener('click',event=>{event.preventDefault();sends++;});
    w.document.querySelector('#retry')?.addEventListener('click',()=>retries++);
    if(variant==='transmission-error-no-send') assert.equal(h.sendTimeoutNotice(h.taskTurnForInspection(task)),true);
    await h.inspect(task,null);
    assert.equal(task.url,'https://chatgpt.com/c/guard');
    now+=9_001;await h.inspect(task,null);
    assert.equal(sends,0);assert.equal(retries,0);assert.equal(task.state,'queued');assert.equal(task.url,'');
    assert.equal(task.history.at(-1).reason,'continuation-ack-timeout');
    assert.equal(w.document.querySelector('[contenteditable]').textContent,'');
    assert.equal(task.round,1);assert.equal(task.phase,'work');assert.equal(task.goal,'完成目标');
  }finally{dom.window.close();}
});
for(const condition of ['young-intent','user-draft','stop','approval','settlement','foreign-route','foreign-user','initial-shell']) test(`stalled continuation escape respects ${condition}`,async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    let now=Date.now();w.Date.now=()=>now;
    mountStalledContinuation(w,task);
    task.continuationSentAt=now-(condition==='young-intent'?1_000:120_000);
    task.authorizationContinuationBoundary=h.authorizationContinuationBoundaryKey(task,h.taskTurnForInspection(task));
    if(condition==='user-draft') w.document.querySelector('[contenteditable]').textContent='用户未发送的独立草稿';
    if(condition==='stop') w.document.body.insertAdjacentHTML('beforeend','<button aria-label="停止生成"></button>');
    if(condition==='approval') w.document.querySelector('main').insertAdjacentHTML('beforeend','<section data-testid="approval-card"><button disabled>允许一次</button></section>');
    if(condition==='settlement') Object.assign(task,{approvalSettlementUntil:now+60_000,approvalSettlementURL:task.url,approvalSettlementToken:task.token,approvalSettlementPhase:task.phase,approvalSettlementRound:task.round});
    if(condition==='foreign-route') w.history.replaceState({},'', '/c/other');
    if(condition==='foreign-user') w.document.querySelector('main').insertAdjacentHTML('beforeend','<div data-message-author-role="user">不同任务 [Fabushi:foreign]</div>');
    if(condition==='initial-shell') {w.document.querySelector('[data-content-search-turn-key="fallback-turn-1"]').remove();w.document.querySelector('[data-markdown-text-tone="primary"]').textContent='';}
    await h.recoverStoppedConversation(task,null,now);now+=9_001;await h.recoverStoppedConversation(task,null,now);
    assert.equal(task.url,'https://chatgpt.com/c/guard');assert.notEqual(task.state,'queued');
    if(condition==='user-draft') assert.equal(w.document.querySelector('[contenteditable]').textContent,'用户未发送的独立草稿');
  }finally{dom.window.close();}
});
test('pending deduped continuation still reaches ordinary inspection during confirmation',async()=>{
  const {dom,w,h,task}=await harness({authorizationGate:false});
  try {
    let now=Date.now();w.Date.now=()=>now;
    mountStalledContinuation(w,task);task.continuationSentAt=now-120_000;
    const response=w.document.querySelector('[data-content-search-unit-key="fallback-turn-1:2:assistant"]');
    response.querySelector('[data-markdown-text-tone="primary"]').textContent='供应商未知异常';
    task.authorizationContinuationBoundary=h.authorizationContinuationBoundaryKey(task,h.taskTurnForInspection(task));
    const scans=h.measurements.scans;
    await h.inspect(task,null);
    assert.ok(h.measurements.scans>scans,'ordinary inspection must run when no send occurred');
    assert.equal(task.url,'https://chatgpt.com/c/guard');
  }finally{dom.window.close();}
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../chatgpt-auto-confirm.user.js', import.meta.url), 'utf8');
function fixture(body='') {
  const dom = new JSDOM(`<body>${body}</body>`, { url:'https://chatgpt.com/', runScripts:'outside-only' });
  const w = dom.window;
  w.HTMLElement.prototype.getClientRects = function(){return this.hidden ? [] : [{}];};
  let held = false;
  w.navigator.locks = {request:async(name,options,callback)=>{if(held)return callback(null);held=true;try{await callback({name});}finally{held=false;}}};
  w.eval(source.replace('  mount();','  window.testHooks = { blocker, rateLimitNotice, classify, cards, latestTurn, parseReview, workPrompt, plannerPrompt, enqueue, start, pause, restorePausedTasks, markTasksPaused, migratePersistedPause, syncRemoteControl, authorize, isConversationScopedAllow, processGlobalApprovalCards, setGlobalAutoApprove, dismissUnexpectedModals, restoreCancelledTask, deleteTask, navigate, queueNavigation, directNavigate, recoverStalledRoute, stopAmbiguousSend, recoverLegacyNavigationFailures, dispatchCooldownRemaining, restForRateLimit, activateControl, editGoal, finish, inspect, send, log, data, measurements, canonicalConversationURL, currentConversationURL, recordConversationURL, recordedConversationURL, captureConversationURL, conversationURLOwner, taskMatchesCurrentConversation, taskHoldsScheduler, nextSupervisionTask, validNavigationTicket, getCurrent:()=>current };\n  mount();'));
  return {w,dom,h:w.testHooks};
}
test('completion requires own final turn, stop absent, no approval and stable completion evidence',()=>{
  const {h,dom}=fixture();
  const sample={owned:true,final:true,text:'result',sentAt:0,cards:0,stop:false};
  const previous={text:'result',since:1000,idleSince:1000,clear:true};
  assert.equal(h.classify(sample,previous,6000).state,'complete');
  assert.equal(h.classify({...sample,stop:true},previous,6000).state,'generating');
  assert.equal(h.classify({...sample,cards:1},previous,6000).state,'approval');
  assert.equal(h.classify({...sample,final:false},previous,6000).state,'waiting');
  assert.equal(h.classify({...sample,owned:false},previous,6000).state,'blocked');
  assert.equal(h.classify({...sample,owned:false,cards:1},previous,6000).state,'blocked');
  assert.equal(h.classify(sample,{...previous,clear:false},6000).state,'waiting');
  assert.equal(h.classify({...sample,final:false},previous,96000).state,'waiting');
  assert.equal(h.classify({...sample,final:false},previous,301000).state,'no-final-reply');
  assert.equal(h.classify({...sample,final:false},{...previous,clear:false},301000).state,'waiting','generation stopping gets a fresh grace period');
  dom.window.close();
});
test('a lost Stop control with no final answer becomes a recoverable abnormal end',()=>{
  const {h,dom}=fixture();
  const previous={text:'partial reply',since:1000,idleSince:1000,clear:true,stop:false,endedAt:1000};
  const sample={owned:true,final:false,text:'partial reply',sentAt:0,cards:0,stop:false};
  assert.equal(h.classify(sample,previous,16_001).state,'no-final-reply');
  assert.equal(h.classify({...sample,cards:1},previous,16_001).state,'approval');
  assert.equal(h.classify({...sample,stop:true},previous,16_001).state,'generating');
  dom.window.close();
});
test('work prompt stays natural while the fresh planner alone receives the report contract',()=>{
  const {h,dom}=fixture();
  const task={id:'a',round:1,goal:'do work',next:'',result:'natural result',token:'t'};
  assert.doesNotMatch(h.workPrompt(task),/MAHAYANA_TASK_REPORT_V1/);
  assert.doesNotMatch(h.workPrompt(task),/status.*complete/);
  assert.match(h.plannerPrompt(task),/MAHAYANA_TASK_REPORT_V1/);
  assert.match(h.plannerPrompt(task),/natural result/);
  dom.window.close();
});
test('nested split authorization card is detected without article/section wrappers',()=>{
  const {h,dom}=fixture('<main><div><div>这里可以是任意正文，不参与识别。</div><div><button>拒绝</button><button>允许</button><button aria-haspopup="menu"><svg></svg></button></div></div></main>');
  assert.equal(h.cards().length,1);
  h.cards()[0].button.disabled=true;
  assert.equal(h.cards().length,0);
  dom.window.close();
});
test('ordinary allow controls are not mistaken for authorization cards',()=>{
  const {h,dom}=fixture('<main><button>允许</button><div><button>拒绝</button><button>允许</button></div><div><button>允许</button><button aria-haspopup="menu">选项</button></div></main>');
  assert.equal(h.cards().length,0);
  dom.window.close();
});
test('unexpected ChatGPT modal is automatically closed while authorization cards stay untouched',async()=>{
  const {w,h,dom}=fixture();
  const modal=w.document.createElement('div');
  modal.setAttribute('role','dialog');
  modal.innerHTML='<h2>图像创作迎来重大升级</h2><button aria-label="Close">×</button><button>立即体验</button>';
  const close=modal.querySelector('[aria-label="Close"]');
  close.onclick=()=>modal.remove();
  w.document.body.append(modal);
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(modal.isConnected,false);

  const approval=w.document.createElement('div');
  approval.setAttribute('role','dialog');
  approval.innerHTML='<button>拒绝</button><button>允许</button><button aria-haspopup="menu">⌄</button>';
  const approvalClose=w.document.createElement('button');
  approvalClose.setAttribute('aria-label','Close');
  approvalClose.textContent='×';
  approvalClose.onclick=()=>approval.remove();
  approval.append(approvalClose);
  w.document.body.append(approval);
  assert.equal(h.cards().length,1);
  assert.equal(h.dismissUnexpectedModals(),0);
  assert.equal(approval.isConnected,true);
  dom.window.close();
});
test('historical final answer cannot complete a new user turn',()=>{
  const {h,dom}=fixture('<article><div data-message-author-role="assistant"><div class="markdown">old final</div></div><button data-testid="copy-turn-action-button">Copy</button></article><div data-message-author-role="user">new task</div><article><div data-message-author-role="assistant">Thinking</div></article>');
  assert.equal(h.latestTurn().final,false);
  assert.equal(h.latestTurn().text,'Thinking');
  dom.window.close();
});
test('review reports are tied to exact task and round',()=>{
  const {h,dom}=fixture();const task={id:'a',round:2};
  assert.equal(h.parseReview('{"taskId":"a","round":2,"status":"complete","summary":"verified"}',task).status,'complete');
  assert.throws(()=>h.parseReview('{"taskId":"b","round":2,"status":"complete","summary":"verified"}',task));
  assert.throws(()=>h.parseReview('{"taskId":"a","round":2,"status":"next","summary":"incomplete"}',task));
  dom.window.close();
});
test('startup is paused and UI submission remains local until one explicit scheduler send',async()=>{
  const {w,h,dom}=fixture('<form><textarea id="prompt-textarea"></textarea><button data-testid="send-button">Send</button></form>');
  let sends=0;w.document.querySelector('[data-testid="send-button"]').onclick=()=>sends++;
  assert.equal((await w.FabushiUserscript.call('status')).running,false);
  const root=w.document.getElementById('fabushi-auto-confirm-root');
  root.querySelector('textarea').value='test goal';
  root.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,150));
  h.pause();
  await new Promise(resolve=>setTimeout(resolve,500));
  assert.equal(sends,0,'pause interrupts the delayed send');
  assert.equal(h.data.tasks.length,1);
  assert.equal(w.document.querySelectorAll('.desk').length,1);
  dom.window.close();
});
test('existing conversation inspection does not wait for a missing composer',async()=>{
  const {h,w,dom}=fixture('<main><div data-message-author-role="user">[Fabushi:owner]</div><article><div data-message-author-role="assistant">partial</div></article></main>');
  w.history.pushState({},'', '/c/existing');
  const task={id:'existing',goal:'inspect',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/existing',token:'owner',messages:[]};
  assert.equal(await h.navigate(task.url,null,task,false),true);
  dom.window.close();
});
test('missing send controls keep one prepared intent instead of blocking or duplicating',async()=>{
  const {h,dom}=fixture('<main><form><textarea id="prompt-textarea"></textarea></form></main>');
  const task={id:'prepared',goal:'send once',mode:'goal',phase:'work',round:1,state:'queued',url:'',token:'',messages:[]};
  h.data.tasks.push(task);
  await h.start();
  try {
    const result=await h.send(task,null);
    assert.equal(result,false);
    assert.equal(task.state,'sending');
    assert.equal(task.sendPrepared,true);
    assert.ok(task.token);
    assert.match(task.messages.at(-1).text,/发送按钮暂不可用/);
  } finally {
    h.pause();
  }
  dom.window.close();
});
test('dispatch clears an unrelated ChatGPT composer draft before sending',async()=>{
  const {w,h,dom}=fixture('<main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button">Send</button></form></main>');
  const input=w.document.querySelector('#prompt-textarea');
  input.value='用户之前留下的草稿';
  const sendButton=w.document.querySelector('[data-testid="send-button"]');
  sendButton.type='button';
  sendButton.onclick=()=>{
    const task=h.data.tasks.at(-1);
    w.history.pushState({},'',`/c/draft-${task.id}`);
    const user=w.document.createElement('div');
    user.dataset.messageAuthorRole='user';
    user.textContent=`[Fabushi:${task.token}]`;
    w.document.querySelector('main').append(user);
  };
  const root=w.document.getElementById('fabushi-auto-confirm-root');
  root.querySelector('textarea').value='send after clearing draft';
  root.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,1100));
  const task=h.data.tasks[0];
  h.pause();
  assert.equal(input.value,task.preparedPrompt);
  assert.ok(task.messages.some(message=>/自动清空并替换/.test(message.text)));
  dom.window.close();
});
test('empty ChatGPT composer is filled before looking up its send control',async()=>{
  const {w,h,dom}=fixture('<main><form><textarea id="prompt-textarea"></textarea></form></main>');
  const pageInput=w.document.querySelector('#prompt-textarea');
  const form=pageInput.closest('form');
  let sends=0;
  pageInput.addEventListener('input',()=>{
    if (!pageInput.value || form.querySelector('[data-testid="send-button"]')) return;
    const button=w.document.createElement('button');
    button.type='button';
    button.dataset.testid='send-button';
    button.textContent='Send';
    button.onclick=()=>{
      sends++;
      const task=h.data.tasks.at(-1);
      w.history.pushState({},'',`/c/empty-${task.id}`);
      const user=w.document.createElement('div');
      user.dataset.messageAuthorRole='user';
      user.textContent=`[Fabushi:${task.token}]`;
      w.document.querySelector('main').append(user);
    };
    form.append(button);
  });
  const root=w.document.getElementById('fabushi-auto-confirm-root');
  root.querySelector('textarea').value='send with initially empty composer';
  root.querySelector('form').dispatchEvent(new w.Event('submit',{cancelable:true}));
  await new Promise(resolve=>setTimeout(resolve,1100));
  const task=h.data.tasks[0];
  h.pause();
  assert.equal(sends,1);
  assert.equal(pageInput.value,task.preparedPrompt);
  assert.ok(task.url.endsWith(`/c/empty-${task.id}`));
  assert.equal(task.sendPrepared,false);
  dom.window.close();
});
test('a stale route during SPA send handoff is not recorded before the task marker',async()=>{
  const {w,h,dom}=fixture('<main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button">Send</button></form></main>');
  const button=w.document.querySelector('[data-testid="send-button"]');
  button.type='button';
  button.onclick=()=>w.history.pushState({},'', '/c/old-route-left-on-screen');
  const task={id:'route-guard',goal:'send with route guard',mode:'once',phase:'work',round:1,state:'queued',url:'',token:'',messages:[]};
  h.data.tasks.push(task);
  await h.start();
  const controller=new w.AbortController();
  const pending=h.send(task,controller.signal);
  setTimeout(()=>controller.abort(),900);
  await assert.rejects(pending,/已暂停/);
  h.pause();
  assert.equal(task.url,'');
  assert.equal(task.sessionUrls,undefined);
  dom.window.close();
});
test('the new route is the only link captured once this task marker appears',async()=>{
  const {w,h,dom}=fixture('<main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button">Send</button></form></main>');
  const button=w.document.querySelector('[data-testid="send-button"]');
  button.type='button';
  button.onclick=()=>{
    const task=h.data.tasks.at(-1);
    w.history.pushState({},'', '/c/old-route-left-on-screen');
    setTimeout(()=>{
      w.history.pushState({},'', `/c/new-route-${task.id}`);
      const user=w.document.createElement('div');
      user.dataset.messageAuthorRole='user';
      user.textContent=`[Fabushi:${task.token}]`;
      w.document.querySelector('main').append(user);
    },350);
  };
  const task={id:'route-capture',goal:'capture only owned route',mode:'once',phase:'work',round:1,state:'queued',url:'',token:'',messages:[]};
  h.data.tasks.push(task);
  await h.start();
  const pending=h.send(task,null);
  await pending;
  h.pause();
  assert.equal(task.url,`https://chatgpt.com/c/new-route-${task.id}`);
  assert.deepEqual(Array.from(task.sessionUrls),[`https://chatgpt.com/c/new-route-${task.id}`]);
  dom.window.close();
});
test('new goals become the next scheduler target instead of waiting behind stale tasks',()=>{
  const {h,dom}=fixture();
  h.data.tasks.push({id:'stale',goal:'stale',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/WEB:stale',token:'old',messages:[]});
  const task=h.enqueue('new goal','goal');
  assert.equal(h.getCurrent(),task.id);
  assert.equal(h.data.selected,task.id);
  dom.window.close();
});
test('scheduler keeps sends and approvals exclusive while rotating inspections',()=>{
  const {h,dom}=fixture();
  for (const state of ['queued','sending','approval']) {
    assert.equal(h.taskHoldsScheduler({state}),true,`holds ${state}`);
  }
  for (const state of ['waiting','generating','reviewing']) {
    assert.equal(h.taskHoldsScheduler({state,url:'https://chatgpt.com/c/live'}),false,`rotates ${state}`);
  }
  for (const state of ['done','blocked','cancelled','paused']) {
    assert.equal(h.taskHoldsScheduler({state}),false,`releases ${state}`);
  }
  dom.window.close();
});
test('supervision rotates durable conversation URLs while keeping sends exclusive',()=>{
  const {h,dom}=fixture();
  const first=h.enqueue('first','goal');
  Object.assign(first,{state:'waiting',url:'https://chatgpt.com/c/first',token:'first-token'});
  const second={id:'second',goal:'second',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/second',token:'second-token',messages:[]};
  h.data.tasks.push(second);
  assert.equal(h.nextSupervisionTask([first,second],Date.now()),first);
  assert.equal(h.nextSupervisionTask([first,second],Date.now()+16000),second);
  assert.equal(h.taskHoldsScheduler({state:'sending'}),true);
  assert.equal(h.taskHoldsScheduler({state:'approval'}),true);
  dom.window.close();
});
test('pause marks active tasks and resume restores their runnable states',()=>{
  const {h,dom}=fixture();
  const waiting={id:'waiting',goal:'watch',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  const queued={id:'queued',goal:'send',state:'queued',phase:'work',round:1,url:'',token:'',messages:[]};
  const blocked={id:'blocked',goal:'keep evidence',state:'blocked',phase:'review',round:1,url:'https://chatgpt.com/c/evidence',token:'evidence',messages:[]};
  h.data.tasks.push(waiting,queued,blocked);
  h.pause(true);
  assert.equal(h.data.autoResume,false);
  assert.equal(waiting.state,'paused');
  assert.equal(waiting.pausedState,'waiting');
  assert.equal(queued.state,'paused');
  assert.equal(queued.pausedState,'queued');
  assert.equal(blocked.state,'paused');
  assert.equal(blocked.pausedState,'blocked');
  h.data.controlRevision++;
  h.data.autoResume=true;
  h.restorePausedTasks(h.data.controlRevision);
  assert.equal(waiting.state,'waiting');
  assert.equal(queued.state,'queued');
  assert.equal(blocked.state,'waiting','a blocked task with a recorded URL resumes inspection instead of immediately pausing again');
  assert.equal(waiting.pausedState,undefined);
  assert.equal(queued.pausedState,undefined);
  dom.window.close();
});
test('continue button starts a paused task instead of restoring a terminal blocked state',async()=>{
  const {w,h,dom}=fixture();
  const paused=h.enqueue('continue','goal');
  Object.assign(paused,{state:'paused',pausedState:'blocked',phase:'work',round:1,url:'https://chatgpt.com/c/continue',token:'owner'});
  h.data.autoResume=false;
  h.log(paused,'已暂停');
  const button=[...w.document.querySelectorAll('header button')].find(node=>node.textContent==='继续');
  assert.ok(button);
  button.click();
  await new Promise(resolve=>setTimeout(resolve,20));
  try {
    assert.equal(h.data.autoResume,true);
    assert.equal(paused.state,'waiting');
  } finally {
    h.pause();
  }
  dom.window.close();
});
test('an idle ChatGPT tab cannot pause a queue owned by another tab',()=>{
  const {w,h,dom}=fixture();
  const waiting={id:'idle-page',goal:'keep running',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  h.data.tasks.push(waiting);
  w.dispatchEvent(new w.Event('pagehide'));
  assert.equal(waiting.state,'waiting');
  assert.equal(h.data.autoResume,true);
  dom.window.close();
});
test('runner pagehide suspends locally without converting the queue to manual pause',async()=>{
  const {w,h,dom}=fixture();
  const waiting={id:'runner-page',goal:'keep running',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  h.data.tasks.push(waiting);
  await h.start();
  w.dispatchEvent(new w.Event('pagehide'));
  assert.equal(waiting.state,'waiting');
  assert.equal(h.data.autoResume,true);
  assert.equal((await w.FabushiUserscript.call('status')).running,false);
  dom.window.close();
});
test('replacing an idle script instance does not pause persisted tasks',()=>{
  const {w,h,dom}=fixture();
  const waiting={id:'idle-replace',goal:'keep running',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  h.data.tasks.push(waiting);
  w.__FABUSHI_AUTO_CONFIRM_INSTANCE__.shutdown();
  assert.equal(waiting.state,'waiting');
  assert.equal(h.data.autoResume,true);
  dom.window.close();
});
test('a persisted manual pause is made visible after script reload',()=>{
  const {h,dom}=fixture();
  const task={id:'reload-paused',goal:'keep paused',state:'generating',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  h.data.tasks.push(task);
  h.data.autoResume=false;
  assert.equal(h.migratePersistedPause(),true);
  assert.equal(task.state,'paused');
  assert.equal(task.pausedState,'generating');
  dom.window.close();
});
test('a newer manual pause from another tab wins over a stale runner write',()=>{
  const {h,w,dom}=fixture();
  const task={id:'remote-pause',goal:'keep stopped',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  h.data.tasks.push(task);
  h.data.controlRevision=3;
  h.data.autoResume=true;
  h.log(task,'旧标签页仍在巡视');
  const stored=JSON.parse(w.localStorage.getItem('fabushi-workbench-v2'));
  stored.controlRevision=4;
  stored.autoResume=false;
  stored.pausedAt=Date.now();
  stored.tasks[0]={...stored.tasks[0],state:'paused',pausedState:'waiting',pauseRevision:4,updatedAt:Date.now()+1};
  w.localStorage.setItem('fabushi-workbench-v2',JSON.stringify(stored));
  assert.equal(h.syncRemoteControl(),true);
  assert.equal(h.data.autoResume,false);
  assert.equal(task.state,'paused');
  assert.equal(task.pauseRevision,4);
  h.log(task,'旧标签页尝试写回');
  const persisted=JSON.parse(w.localStorage.getItem('fabushi-workbench-v2'));
  assert.equal(persisted.tasks[0].state,'paused');
  dom.window.close();
});
test('pause between opening approval menu and selecting scope prevents approval',async()=>{
  const {w,h,dom}=fixture('<main><div><p>任意内容</p><button>拒绝</button><button>允许</button><button aria-haspopup="menu">⌄</button></div><div role="menu"><button role="menuitem">允许本次会话</button></div></main>');
  let approvals=0;w.document.querySelector('[role=menuitem]').onclick=()=>approvals++;
  await h.start();
  const task={messages:[]};
  const work=h.authorize(h.cards()[0],task);
  h.pause();
  await assert.rejects(work);
  assert.equal(approvals,0);
  dom.window.close();
});
test('global approval setting handles a card in a non-queue Chat',async()=>{
  const {w,h,dom}=fixture('<main><div id="card"><p>任意内容</p><button>拒绝</button><button>允许</button><button aria-haspopup="menu">⌄</button><div role="menu"><button role="menuitem">允许本次会话</button></div></div></main>');
  let arrowClicks=0, approvals=0;
  w.document.querySelector('[aria-haspopup]').onclick=()=>arrowClicks++;
  w.document.querySelector('[role=menuitem]').onclick=()=>approvals++;
  h.data.globalAutoApprove=true;
  assert.equal(await h.processGlobalApprovalCards(),true);
  assert.equal(arrowClicks,1);
  assert.equal(approvals,1);
  dom.window.close();
});
test('connector-named conversation grant is accepted but permanent grants are rejected',()=>{
  const {w,h,dom}=fixture();
  const option=w.document.createElement('button');
  option.setAttribute('aria-label','Allow GitHub for this conversation');
  assert.equal(h.isConversationScopedAllow(option),true);
  option.setAttribute('aria-label','Always allow GitHub');
  assert.equal(h.isConversationScopedAllow(option),false);
  option.setAttribute('aria-label','允许 GitHub 用于此对话');
  assert.equal(h.isConversationScopedAllow(option),true);
  option.setAttribute('aria-label','始终允许 GitHub');
  assert.equal(h.isConversationScopedAllow(option),false);
  dom.window.close();
});
test('GitHub card selects from the live UI selects its connector-named menu item',async()=>{
  const {w,h,dom}=fixture('<main><div id="card"><h2>允许 ChatGPT 使用 GitHub？</h2><button>拒绝</button><button>允许</button><button aria-haspopup="menu" aria-label="Allow GitHub for this conversation">⌄</button></div><div role="menu"><button role="menuitem" aria-label="Allow GitHub for this conversation">Allow GitHub for this conversation</button></div></main>');
  let arrowClicks=0, approvals=0;
  w.document.querySelector('#card [aria-haspopup]').onclick=()=>arrowClicks++;
  w.document.querySelector('[role=menuitem]').onclick=()=>approvals++;
  await h.authorize(h.cards()[0],null,null,false);
  assert.equal(arrowClicks,1);
  assert.equal(approvals,1);
  dom.window.close();
});
test('Radix authorization trigger opens on pointerdown before selecting its div menuitem',async()=>{
  const {w,h,dom}=fixture('<main><div id="card"><p>任意内容</p><button>拒绝</button><button>允许</button><button aria-haspopup="menu" aria-label="Allow GitHub for this conversation">⌄</button></div></main>');
  let pointerdowns=0, approvals=0;
  w.document.querySelector('[aria-haspopup]').addEventListener('pointerdown',()=>{
    pointerdowns++;
    if(w.document.querySelector('[role=menu]'))return;
    const menu=w.document.createElement('div');menu.setAttribute('role','menu');
    const option=w.document.createElement('div');option.setAttribute('role','menuitem');option.textContent='Allow GitHub for this conversation';
    option.addEventListener('click',()=>approvals++);menu.append(option);w.document.body.append(menu);
  });
  await h.authorize(h.cards()[0],null,null,false);
  assert.equal(pointerdowns,1);
  assert.equal(approvals,1);
  dom.window.close();
});
test('cancelled tasks resume the exact persisted conversation when possible',()=>{
  const {h,dom}=fixture();
  const task={id:'cancelled',goal:'continue me',mode:'goal',phase:'work',round:3,state:'cancelled',url:'https://chatgpt.com/c/existing',token:'owner',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.restoreCancelledTask(task),true);
  assert.equal(task.state,'waiting');
  assert.equal(task.url,'https://chatgpt.com/c/existing');
  assert.equal(task.token,'owner');
  assert.match(task.messages.at(-1).text,/继续监控取消前/);
  dom.window.close();
});
test('cancelled unsent tasks return to the dispatch queue',()=>{
  const {h,dom}=fixture();
  const task={id:'cancelled-unsent',goal:'continue me',mode:'goal',phase:'work',round:1,state:'cancelled',url:'',token:'stale',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.restoreCancelledTask(task),true);
  assert.equal(task.state,'queued');
  assert.equal(task.token,'');
  dom.window.close();
});
test('cancelled queued planner does not reopen the previous Work URL',()=>{
  const {h,dom}=fixture();
  const task={id:'cancelled-planner',goal:'continue me',next:'verify the new round',mode:'goal',phase:'review',round:2,state:'cancelled',url:'',sessionUrl:'https://chatgpt.com/c/previous-work',sessionUrls:['https://chatgpt.com/c/previous-work'],token:'',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.restoreCancelledTask(task),true);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.phase,'review');
  dom.window.close();
});
test('quota banner is ignored while real safety challenges remain blockers',()=>{
  const {h,dom}=fixture('<p>工作区有成员达到使用上限</p><button>开启自动充值</button>');
  assert.equal(h.blocker(),'');
  assert.equal(h.classify({owned:true,final:false,text:'',sentAt:Date.now(),cards:0,stop:false,blocker:'ChatGPT 使用额度或访问频率受限'},null,Date.now()).state,'waiting');
  assert.equal(h.classify({owned:true,final:false,text:'',sentAt:Date.now(),cards:0,stop:false,blocker:'页面需要完成安全验证'},null,Date.now()).state,'blocked');
  dom.window.close();
});
test('rate-limit detection ignores the plugin log and conversation text',()=>{
  const {h,dom}=fixture('<main><article><div data-message-author-role="user">Please explain rate limits</div></article></main>');
  const root=dom.window.document.getElementById('fabushi-auto-confirm-root');
  root.append(dom.window.document.createTextNode('检测到 ChatGPT 请求过于频繁'));
  assert.equal(h.rateLimitNotice(),'');
  const alert=dom.window.document.createElement('div');
  alert.setAttribute('role','alert');
  alert.textContent='你的请求过于频繁，请稍等几分钟后再重试';
  dom.window.document.body.append(alert);
  assert.match(h.rateLimitNotice(),/休息等待/);
  dom.window.close();
});
test('reload recovery preserves healthy and rate-limited in-flight sessions',()=>{
  const {h,dom}=fixture();
  const base={goal:'test task',mode:'goal',phase:'work',round:1};
  const healthy={...base,id:'healthy',state:'waiting',url:'https://chatgpt.com/c/healthy',token:'keep',messages:[{text:'正在生成'}]};
  const limited={...base,id:'limited',state:'waiting',url:'https://chatgpt.com/c/limited',token:'keep-too',messages:[{text:'检测到 ChatGPT 请求过于频繁'}]};
  const legacy={...base,id:'legacy',state:'blocked',url:'https://chatgpt.com/c/old',token:'old',messages:[{text:'侧栏会话切换未确认'}]};
  h.data.tasks.push(healthy,limited,legacy);
  assert.equal(h.recoverLegacyNavigationFailures(),'legacy');
  assert.equal(healthy.url,'https://chatgpt.com/c/healthy');
  assert.equal(healthy.token,'keep');
  assert.equal(limited.url,'https://chatgpt.com/c/limited');
  assert.equal(limited.token,'keep-too');
  assert.equal(legacy.url,'https://chatgpt.com/c/old');
  assert.equal(legacy.token,'old');
  assert.equal(legacy.state,'waiting');
  dom.window.close();
});
test('paused legacy sidebar waits resume directly from their recorded URL',()=>{
  const {h,dom}=fixture();
  const task={id:'paused-legacy',goal:'keep this chat',mode:'goal',phase:'work',round:1,state:'paused',pausedState:'blocked',url:'https://chatgpt.com/c/legacy-url',token:'legacy-token',attempted:true,messages:[{text:'目标会话链接尚未出现在侧栏；保持当前页面等待，不会刷新或重复派发（第 4/4 次）。'}]};
  h.data.tasks.push(task);
  assert.equal(h.restorePausedTasks(9),true);
  assert.equal(task.state,'waiting');
  assert.equal(task.url,'https://chatgpt.com/c/legacy-url');
  assert.equal(task.attempted,false);
  assert.match(task.messages.at(-1).text,/不等待侧栏/);
  dom.window.close();
});
test('resuming a queued next round never reopens a historical Work URL',()=>{
  const {h,dom}=fixture();
  const task={id:'queued-next-round',goal:'continue with the new round',mode:'goal',phase:'review',round:2,state:'paused',pausedState:'queued',url:'',sessionUrl:'https://chatgpt.com/c/previous-work',sessionUrls:['https://chatgpt.com/c/previous-work'],token:'',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.restorePausedTasks(12),true);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(h.validNavigationTicket({task:task.id,path:'/c/previous-work',href:'https://chatgpt.com/c/previous-work',resume:true}),false);
  dom.window.close();
});
test('transient navigation warning cannot redispatch an already generating conversation',()=>{
  const {h,dom}=fixture();
  const task={
    id:'generating',goal:'keep this chat',mode:'goal',phase:'planner',round:1,
    state:'generating',url:'https://chatgpt.com/c/current',token:'live-owner',attempted:true,
    messages:[{text:'会话切换未确认，插件正在自动切换到新会话'}]
  };
  h.data.tasks.push(task);
  assert.equal(h.recoverLegacyNavigationFailures(),'');
  assert.equal(task.state,'generating');
  assert.equal(task.url,'https://chatgpt.com/c/current');
  assert.equal(task.token,'live-owner');
  assert.equal(task.attempted,true);
  dom.window.close();
});
test('missing sidebar links never create a four-attempt wait loop',()=>{
  const {h,w,dom}=fixture();
  const task={id:'nav',state:'queued',messages:[]};
  const target=new w.URL('https://chatgpt.com/c/WEB:not-a-browser-session');
  assert.equal(h.queueNavigation(target,task),false);
  assert.equal(task.state,'blocked');
  assert.equal(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'),null);
  assert.ok(task.messages.some(message=>/没有可用的真实会话链接/.test(message.text)));
  dom.window.close();
});
test('live owned conversation canonicalizes a stale URL without navigation',async()=>{
  const {h,w,dom}=fixture('<main><div data-message-author-role="user">[Fabushi:live-token]</div><article><div data-message-author-role="assistant">正在生成</div></article>');
  const task={id:'canonical',goal:'keep',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/WEB:stale',token:'live-token',attempted:false,messages:[]};
  h.data.tasks.push(task);
  w.history.pushState({},'', '/c/real-conversation');
  assert.equal(await h.navigate(task.url,undefined,task),true);
  assert.equal(task.url,'https://chatgpt.com/c/real-conversation');
  assert.equal(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'),null);
  dom.window.close();
});
test('recorded conversation links are canonical identities and direct recovery is one-shot',()=>{
  const {h,w,dom}=fixture();
  const task={id:'direct',goal:'recover',state:'waiting',phase:'work',round:1,url:'',token:'owner',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.canonicalConversationURL('https://chatgpt.com/c/6aa0132a-c708-83e8-812c-818dcfc31876?messageId=ignored'),'https://chatgpt.com/c/6aa0132a-c708-83e8-812c-818dcfc31876');
  assert.equal(h.canonicalConversationURL('https://chatgpt.com/c/WEB:synthetic'),'');
  assert.equal(h.recordConversationURL(task,'https://chatgpt.com/c/6aa0132a-c708-83e8-812c-818dcfc31876'),task.url);
  assert.equal(task.sessionUrls.length,1);
  assert.equal(task.sessionUrls[0],'https://chatgpt.com/c/6aa0132a-c708-83e8-812c-818dcfc31876');
  h.directNavigate(new w.URL(task.url),task,false);
  const ticket=JSON.parse(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'));
  assert.equal(ticket.direct,true);
  assert.equal(ticket.attempts,1);
  h.directNavigate(new w.URL(task.url),task,false);
  assert.equal(JSON.parse(w.sessionStorage.getItem('fabushi-workbench-navigation-v2')).attempts,1);
  dom.window.close();
});
test('a conversation URL cannot be adopted by two active tasks',()=>{
  const {h,dom}=fixture();
  const first={id:'owner',url:'https://chatgpt.com/c/unique',messages:[]};
  const second={id:'new-task',url:'',messages:[]};
  h.data.tasks.push(first,second);
  assert.equal(h.captureConversationURL(second,first.url),'');
  assert.equal(second.url,'');
  assert.equal(h.conversationURLOwner(first.url),first);
  dom.window.close();
});
test('synthetic conversation URL stays on the current page without retrying',()=>{
  const {h,w,dom}=fixture();
  const task={id:'unverified',goal:'wait',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/WEB:not-in-sidebar',token:'owner',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.queueNavigation(new w.URL(task.url),task,'会话地址无效'),false);
  assert.equal(w.location.pathname,'/');
  assert.match(task.messages.at(-1).text,/请在任务中保留有效/);
  h.pause();
  dom.window.close();
});
test('ambiguous send timeout preserves token and stops instead of creating another planner',()=>{
  const {h,w,dom}=fixture();
  w.history.pushState({},'', '/c/old-conversation');
  const task={id:'sent',goal:'review once',mode:'goal',round:1,state:'sending',phase:'review',url:'',token:'one-dispatch',attempted:true,messages:[]};
  h.data.tasks.push(task);
  h.stopAmbiguousSend(task);
  assert.equal(task.state,'blocked');
  assert.equal(task.url,'','the visible old route must never be adopted after an ambiguous send');
  assert.equal(task.token,'one-dispatch');
  assert.equal(task.attempted,true);
  assert.match(task.messages.at(-1).text,/不会自动重发/);
  dom.window.close();
});
test('edited goal is persisted and replaces stale next-round instructions',()=>{
  const {h,dom}=fixture();
  const task={id:'goal-edit',goal:'旧目标',next:'旧的下一步',mode:'goal',phase:'work',round:2,state:'queued',messages:[],goalRevision:0};
  h.data.tasks.push(task);
  assert.equal(h.editGoal(task,'新目标'),true);
  assert.equal(task.goal,'新目标');
  assert.equal(task.next,'');
  assert.equal(task.goalRevision,1);
  assert.match(h.workPrompt({...task,token:'t'}),/^新目标\n/);
  assert.match(task.messages.at(-1).text,/下一轮将按新目标执行/);
  dom.window.close();
});
test('goal edits during review discard stale acceptance next and start a new work round',()=>{
  const {h,dom}=fixture();
  const task={id:'review-edit',goal:'旧目标',next:'',mode:'goal',phase:'review',round:1,state:'waiting',url:'https://chatgpt.com/c/review',token:'review-token',messages:[],goalRevision:0,dispatchGoalRevision:0,result:'旧结果'};
  h.data.tasks.push(task);
  h.editGoal(task,'新目标');
  h.finish(task,'{"taskId":"review-edit","round":1,"status":"next","summary":"旧验收","next":"继续旧目标"}');
  assert.equal(task.phase,'work');
  assert.equal(task.round,2);
  assert.equal(task.next,'');
  assert.equal(task.goal,'新目标');
  assert.match(task.messages.at(-1).text,/忽略旧验收结论/);
  dom.window.close();
});
test('editing a queued review skips the unsent stale planner immediately',()=>{
  const {h,dom}=fixture();
  const task={id:'queued-review-edit',goal:'旧目标',next:'旧验收安排',mode:'goal',phase:'review',round:1,state:'queued',url:'',token:'old-token',messages:[],goalRevision:0,result:'旧结果'};
  h.data.tasks.push(task);
  assert.equal(h.editGoal(task,'新目标'),true);
  assert.equal(task.phase,'work');
  assert.equal(task.round,2);
  assert.equal(task.next,'');
  assert.equal(task.token,'');
  assert.equal(task.state,'queued');
  assert.match(task.messages.at(-1).text,/尚未发送的旧验收已跳过/);
  dom.window.close();
});
test('message history is not truncated after eighty entries',()=>{
  const {h,dom}=fixture();
  const task={id:'history',goal:'keep history',messages:[],messageVersion:0};
  h.data.tasks.push(task);
  for(let index=0;index<120;index++) h.log(task,`记录 ${index}`);
  assert.equal(task.messages.length,120);
  assert.equal(task.messages[0].text,'记录 0');
  assert.equal(task.messages.at(-1).text,'记录 119');
  dom.window.close();
});
test('completed, cancelled, and paused tasks can be deleted while live tasks are retained',()=>{
  const {h,w,dom}=fixture();
  const completed=h.enqueue('old completed','once');
  completed.state='done';
  const cancelled={id:'old-cancelled',goal:'old cancelled',mode:'once',phase:'work',round:1,state:'cancelled',messages:[]};
  const paused={id:'old-paused',goal:'old paused',mode:'goal',phase:'work',round:1,state:'paused',messages:[]};
  const live={id:'live',goal:'keep running',mode:'goal',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/live',token:'live',messages:[]};
  h.data.tasks.push(cancelled,paused,live);
  h.paint?.();
  assert.equal(h.deleteTask(live),false);
  assert.equal(h.deleteTask(completed),true);
  assert.equal(h.deleteTask(cancelled),true);
  assert.equal(h.deleteTask(paused),true);
  assert.equal(h.data.tasks.map(task=>task.id).join(','),'live');
  assert.equal(h.data.selected,'live');
  dom.window.close();
});
test('same-route hydration waits without creating a navigation ticket',async()=>{
  const {h,w,dom}=fixture('<main>ChatGPT is loading</main>');
  const result=await h.navigate('/',undefined,{id:'task'});
  assert.equal(result,false);
  assert.equal(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'),null);
  dom.window.close();
});
test('dispatches keep a full cooldown between Chat sessions',()=>{
  const {h,dom}=fixture();
  const now=Date.now();
  h.data.lastDispatchAt=now;
  assert.ok(h.dispatchCooldownRemaining(now) >= 59_000);
  assert.equal(h.dispatchCooldownRemaining(now + 60_000),0);
  const task={state:'queued',messages:[]};
  const wait=h.restForRateLimit(task);
  assert.ok(wait >= 4 * 60_000);
  assert.equal(task.state,'waiting');
  assert.match(task.messages.at(-1).text,/暂停发送、导航和刷新/);
  dom.window.close();
});

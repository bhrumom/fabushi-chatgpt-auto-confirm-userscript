import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../chatgpt-auto-confirm.user.js', import.meta.url), 'utf8');
async function fixture(body='', setup=()=>{}) {
  const dom = new JSDOM(`<body>${body}</body>`, { url:'https://chatgpt.com/', runScripts:'outside-only' });
  const w = dom.window;
  w.HTMLElement.prototype.getClientRects = function(){return this.hidden ? [] : [{}];};
  w.SVGElement.prototype.getClientRects = function(){return this.hidden ? [] : [{}];};
  const held = new Set();
  w.navigator.locks = {query:async()=>({held:[...held].map(name=>({name}))}),request:async(name,options,callback)=>{callback ||= options;if(held.has(name))return callback(null);held.add(name);try{return await callback({name});}finally{held.delete(name);}}};
  setup(w);
  await w.eval(source.replace('  mount();','  window.testHooks = { blocker, rateLimitNotice, sendTimeoutNotice, conversationLengthLimitNotice, queueConversationLengthHandoff, conversationLengthContinuationContext, connectionInterruptedNotice, queueInterruptedFreshRetry, clearPendingContinuation, sendContinuation, classify, pageLoadingState, conversationLoading, cards, latestTurn, parseReview, normalizeAttachmentMeta, taskAttachmentSummary, attachmentPrompt, attachmentInputFor, assignFilesToInput, pasteFilesToComposer, attachmentReady, ensureTaskAttachments, retryAttachmentUpload, holdForChatGPTLoading, recoverLegacyAttachmentUploadTimeouts, workPrompt, plannerPrompt, enqueue, start, tick, pause, restorePausedTasks, markTasksPaused, migratePersistedPause, syncRemoteControl, authorize, isConversationScopedAllow, processGlobalApprovalCards, setGlobalAutoApprove, dismissUnexpectedModals, restoreCancelledTask, resumeTask, prepareTaskForRecovery, recoverPersistedBlockedTasks, deleteTask, prepareRecordedConversationOpen, navigate, queueNavigation, directNavigate, beginGuardedNavigation, armNavigationCommitWatchdog, resetRendererRecoveryState, recoverStalledRoute, refreshStalledConversation, stopAmbiguousSend, adoptUnboundAttemptedConversation, noFinalReplyBackoffMs, queueNoFinalReplyRetry, recoverLegacyNavigationFailures, recoverLegacyExhaustedNoFinalReplies, dispatchCooldownRemaining, restForRateLimit, activateControl, editGoal, finish, inspect, send, log, data, measurements, observations, canonicalConversationURL, currentConversationURL, recordConversationURL, recordedConversationURL, captureConversationURL, conversationURLOwner, taskMatchesCurrentConversation, taskHoldsScheduler, taskDeferredUntil, nextSupervisionTask, nextTaskWakeDelay, validNavigationTicket, taskBelongsToTab, tabTasks, recoverableWorkspaces, restoreWorkspace, findAutomaticRecoveryOwner, writeWorkspaceHeartbeat, ensureAutomaticRecoveryTicket, requestHostRecoveryCapability, releaseHostRecoveryCapability, requestHostNavigationPermit, settleHostNavigationRequest, rememberNavigationCommit, cancelHostNavigationLease, readMemorySnapshot, memoryPressureLevel, compactTaskMessages, cleanupLocalMemory, requestHostMemoryCleanup, inspectMemoryPressure, memoryStatusText, memoryDiscardSafety, memorySnapshot:()=>memorySnapshot, memoryPressure:()=>memoryPressure, hostMemoryPending:()=>hostMemoryPending, hostRecoveryCapability:()=>hostRecoveryCapability, recoverStaleWorkspaceAutomatically, getNavigationState:()=>({navigating,navigationRequestPending,timer:Boolean(timer),navigationTimer:Boolean(navigationTimer)}), getTabId:()=>tabId, getCurrent:()=>current };\n  mount();'));
  return {w,dom,h:w.testHooks};
}
test('runtime blocked transition immediately becomes a fresh queued resend',async()=>{
  const {h,w,dom}=await fixture();
  const task={id:'runtime-blocked',ownerTabId:h.getTabId(),goal:'continue forever',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/stuck',token:'dispatch-token',attempted:true,messages:[]};
  h.data.tasks.push(task);
  h.queueNavigation(new w.URL('https://chatgpt.com/c/WEB:missing'),task,'当前会话无法恢复');
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.attempted,false);
  assert.ok(task.messages.some(message=>/不会停在“需要处理”/.test(message.text)));
  dom.window.close();
});

test('completion requires own final toolbar, stop absent, no approval and stable evidence',async()=>{
  const {h,dom}=await fixture();
  const sample={owned:true,final:true,text:'result',sentAt:0,cards:0,stop:false};
  const previous={text:'result',since:1000,idleSince:1000,clear:true,final:true,finalSince:1000};
  assert.equal(h.classify(sample,previous,6000).state,'complete');
  assert.equal(h.classify({...sample,stop:true},previous,6000).state,'generating');
  assert.equal(h.classify({...sample,cards:1},previous,6000).state,'approval');
  assert.equal(h.classify({...sample,final:false},previous,6000).state,'waiting');
  assert.equal(h.classify({...sample,owned:false},previous,6000).state,'waiting');
  assert.equal(h.classify({...sample,owned:false,cards:1},previous,6000).state,'waiting','approval from another task must not cross the task boundary');
  assert.equal(h.classify(sample,{...previous,final:false,clear:false},6000).state,'waiting');
  assert.equal(h.classify({...sample,final:false},previous,96_000).state,'waiting');
  assert.equal(h.classify({...sample,final:false},previous,301_000).state,'waiting','Stop absence never becomes a fresh-session retry signal');
  dom.window.close();
});
test('a visible conversation spinner is loading, not an abnormal end',async()=>{
  const {h,w,dom}=await fixture('<main><div class="flex h-full items-center justify-center"><svg class="animate-spin" aria-hidden="true"></svg></div><form><textarea id="prompt-textarea"></textarea></form></main>');
  w.history.pushState({},'', '/c/loading-page');
  assert.equal(h.pageLoadingState(),'ChatGPT 页面正在加载，等待会话内容完全渲染。');
  assert.equal(h.conversationLoading(),true);
  const sample={owned:true,final:false,text:'',sentAt:1,cards:0,stop:false,loading:true,blocker:'',rateLimit:''};
  const previous={text:'',since:1_000,idleSince:1_000,endedAt:1_000,clear:true};
  assert.equal(h.classify(sample,previous,301_000).state,'loading');
  const task={id:'loading-page',goal:'wait for page',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/loading-page',token:'owner-token',attempted:false,messages:[]};
  h.data.tasks.push(task);
  await h.start();
  await h.inspect(task,null);
  assert.equal(task.state,'loading');
  h.pause();
  dom.window.close();
});
test('a root-page spinner is loading and blocks dispatch until hydration finishes',async()=>{
  const {h,w,dom}=await fixture('<main><div class="animate-spin"></div><form><textarea id="prompt-textarea"></textarea></form></main>');
  const task={id:'root-loading',goal:'wait for root',state:'queued',attachments:[],messages:[]};
  assert.equal(h.pageLoadingState(),'ChatGPT 页面正在加载，等待会话内容完全渲染。');
  assert.equal(await h.navigate('/',null,task,true),false);
  assert.equal(task.state,'loading');
  w.document.querySelector('.animate-spin').remove();
  assert.equal(await h.navigate('/',null,task,true),true);
  dom.window.close();
});
test('loading detection ignores transcript, composer, sidebar and workbench indicators',async()=>{
  const {h,w,dom}=await fixture('<main><article data-message-author-role="assistant" aria-busy="true">partial answer</article><div role="status">Saved</div><form><div class="loading"></div><textarea id="prompt-textarea"></textarea></form></main><aside><div class="animate-spin"></div></aside>');
  w.history.pushState({},'', '/c/stable-page');
  const ownSpinner=w.document.createElement('div');
  ownSpinner.className='animate-spin';
  w.document.querySelector('#fabushi-auto-confirm-root').append(ownSpinner);
  assert.equal(h.pageLoadingState(),'');
  dom.window.close();
});
test('clearing the loading signal stays bound until final reply controls appear',async()=>{
  const {h,w,dom}=await fixture('<main><div id="loader" aria-busy="true"></div></main>');
  w.history.pushState({},'', '/c/loading-transition');
  const loading={owned:true,final:false,text:'',sentAt:1,cards:0,stop:false,loading:true,blocker:'',rateLimit:''};
  const previous={text:'',since:1_000,idleSince:1_000,clear:true};
  assert.equal(h.pageLoadingState(),'ChatGPT 页面正在加载，等待会话内容完全渲染。');
  assert.equal(h.classify(loading,previous,301_000).state,'loading');
  w.document.querySelector('#loader').remove();
  const loaded={...loading,loading:false,text:'partial answer'};
  const loadingObservation={text:'',since:1_000,idleSince:1_000,clear:false,loading:true};
  assert.equal(h.pageLoadingState(),'');
  assert.equal(h.classify(loaded,loadingObservation,301_000).state,'waiting');
  assert.equal(h.classify(loaded,{...loadingObservation,clear:true,text:'partial answer'},901_000).state,'waiting');
  dom.window.close();
});
test('task prompts carry attachment names without embedding file contents',async()=>{
  const {h,dom}=await fixture();
  const task={goal:'分析这批素材',next:'',round:1,token:'attachment-token',attachments:[{id:'video-1',name:'采访视频.mp4',type:'video/mp4',size:1234,lastModified:1}]};
  const prompt=h.workPrompt(task);
  assert.match(prompt,/采访视频\.mp4/);
  assert.match(prompt,/附件名称仅作文件标签/);
  assert.doesNotMatch(prompt,/PRIVATE_FILE_CONTENT/);
  assert.match(h.plannerPrompt({...task,id:'task-1',result:'已完成'}),/采访视频\.mp4/);
  dom.window.close();
});
test('enqueue persists attachment metadata only and the workbench exposes a multi-file picker',async()=>{
  const {w,h,dom}=await fixture();
  const task=h.enqueue('整理附件','once',[{id:'image-1',name:'产品图.png',type:'image/png',size:2048,lastModified:2}]);
  assert.deepEqual(JSON.parse(JSON.stringify(task.attachments)),[{id:'image-1',name:'产品图.png',type:'image/png',size:2048,lastModified:2}]);
  assert.doesNotMatch(w.localStorage.getItem('fabushi-workbench-v2'),/PRIVATE_FILE_CONTENT/);
  const root=w.document.getElementById('fabushi-auto-confirm-root');
  const picker=root.querySelector('input[type="file"]');
  assert.ok(picker);
  assert.equal(picker.multiple,true);
  assert.match(root.textContent,/添加图片 \/ 视频 \/ 文件/);
  assert.match(root.textContent,/不会发送目标文字/);
  dom.window.close();
});
test('attachment confirmation is scoped to the current ChatGPT composer',async()=>{
  const {h,w,dom}=await fixture('<main><div data-file-name="outside.pdf">outside.pdf</div><form id="chat"><div data-testid="file-attachment" data-file-name="clip.mp4">clip.mp4</div><textarea id="prompt-textarea"></textarea></form></main>');
  const input=w.document.querySelector('#prompt-textarea');
  assert.equal(h.attachmentReady([{id:'clip',name:'clip.mp4'}],input),true);
  assert.equal(h.attachmentReady([{id:'missing',name:'missing.mov'}],input),false);
  dom.window.close();
});
test('attachment picker falls back to a page-level input outside the composer form',async()=>{
  const {h,w,dom}=await fixture('<main><form><textarea id="prompt-textarea"></textarea></form><input id="portal-picker" type="file" multiple></main>');
  const input=w.document.querySelector('#prompt-textarea');
  assert.equal(h.attachmentInputFor(input)?.id,'portal-picker');
  dom.window.close();
});
test('old attachment upload timeout records return to a safe queued retry',async()=>{
  const {h,dom}=await fixture();
  const task=h.enqueue('retry attachment','once',[{id:'clip',name:'clip.mp4',type:'video/mp4',size:12,lastModified:1}]);
  Object.assign(task,{state:'blocked',url:'',attempted:false,sendPrepared:true,token:'old-token',messages:[{text:'附件上传未确认，已停止发送纯文字目标。等待 ChatGPT 显示附件已超过 45 秒。'}]});
  assert.equal(h.recoverLegacyAttachmentUploadTimeouts(),task.id);
  assert.equal(task.state,'queued');
  assert.equal(task.token,'');
  assert.equal(task.sendPrepared,false);
  assert.equal(task.attachmentUploadFailed,false);
  assert.match(task.messages.at(-1).text,/重新上传/);
  dom.window.close();
});
test('a lost Stop control stays in the same conversation until the final toolbar appears',async()=>{
  const {h,dom}=await fixture();
  const previous={text:'partial reply',since:1_000,idleSince:1_000,clear:true,stop:false,final:false};
  const sample={owned:true,final:false,text:'partial reply',sentAt:0,cards:0,stop:false,loading:false,blocker:'',rateLimit:''};
  assert.equal(h.classify(sample,previous,16_001).state,'waiting');
  assert.equal(h.classify(sample,previous,301_000).state,'waiting');
  assert.equal(h.classify(sample,previous,901_000).state,'waiting');
  assert.equal(h.classify({...sample,cards:1},previous,901_000).state,'approval');
  assert.equal(h.classify({...sample,stop:true},previous,901_000).state,'generating');
  dom.window.close();
});
test('Stop disappearance with a visible composer never triggers an abnormal continuation',async()=>{
  const {h,w,dom}=await fixture('<main><div class="animate-spin" aria-hidden="true"></div><article data-testid="conversation-turn-user"><div data-message-author-role="user">finish all [Fabushi:stop-transition-token]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant">normal reply has finished streaming but toolbar is not mounted yet</div></article><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form></main>');
  try {
    w.history.pushState({},'', '/c/stop-transition');
    const task={id:'stop-transition',ownerTabId:h.getTabId(),goal:'finish all',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/stop-transition',token:'stop-transition-token',attempted:false,messages:[],stopMissingSince:Date.now()-60_000,stopMissingSignature:'legacy-v2.9.54-state'};
    h.data.tasks.push(task);
    let clicks=0;
    w.document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>clicks++);
    await h.start();
    await h.inspect(task,null);
    await h.inspect(task,null);
    assert.equal(task.state,'waiting');
    assert.equal(task.continuationCount||0,0);
    assert.equal(clicks,0);
    assert.equal(w.document.querySelector('#prompt-textarea').value,'');
    assert.equal(task.messages.some(item=>/Stop 已消失.*异常停止/.test(item.text||'')),false);
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('waiting response detects an ended bound conversation and continues after eight stable seconds',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">finish all [Fabushi:ended-waiting-token]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><div data-testid="tool-call-result">已调用工具</div></div></article><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form></main>');
  try {
    w.history.pushState({},'', '/c/ended-waiting');
    const task={id:'ended-waiting',ownerTabId:h.getTabId(),goal:'finish all',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/ended-waiting',token:'ended-waiting-token',attempted:false,messages:[]};
    h.data.tasks.push(task);
    let clicks=0;
    w.document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>clicks++);

    await h.inspect(task,null);
    assert.equal(task.state,'waiting');
    assert.equal(task.continuationCount||0,0);
    assert.ok(Number(task.abnormalNoFinalSince)>0,'waiting inspection starts the ended-conversation stability timer');

    task.abnormalNoFinalSince=Date.now()-9_000;
    await h.inspect(task,null);

    assert.equal(task.state,'waiting');
    assert.equal(task.continuationCount,1);
    assert.equal(clicks,1);
    assert.equal(w.document.querySelector('#prompt-textarea').value,'继续完成所有');
    assert.match(task.messages.at(-1).text,/检测到当前会话已经结束但没有最终回复/);
    assert.match(task.messages.at(-1).text,/原会话输入并发送“继续完成所有”/);
    assert.equal(task.stalledRefreshAttempts||0,0,'ended-response continuation happens before the fifteen-minute stalled refresh');
  } finally {
    dom.window.close();
  }
});

test('manual recovered marker-virtualized tool-only conversation also continues instead of waiting fifteen minutes',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user" data-message-id="older-user">更早的普通用户消息</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><div data-testid="tool-call-result">已调用工具</div></div></article><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form></main>');
  try {
    w.history.pushState({},'', '/c/recovered-ended-tool-only');
    const task={id:'recovered-ended-tool-only',ownerTabId:h.getTabId(),goal:'继续完成任务',goalRevision:3,mode:'once',phase:'work',round:2,state:'blocked',url:'https://chatgpt.com/c/recovered-ended-tool-only',token:'virtualized-task-token',attempted:false,messages:[]};
    h.data.tasks.push(task);
    assert.equal(h.prepareTaskForRecovery(task),true);
    assert.equal(task.state,'waiting');
    assert.equal(task.recoveredFinalIdentity.allowStaticFinal,true);
    let clicks=0;
    w.document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>clicks++);

    await h.inspect(task,null);
    assert.ok(Number(task.abnormalNoFinalSince)>0,'explicit recovery owns the exact tool-only edge for ended-state detection');
    task.abnormalNoFinalSince=Date.now()-9_000;
    await h.inspect(task,null);

    assert.equal(task.continuationCount,1);
    assert.equal(clicks,1);
    assert.equal(w.document.querySelector('#prompt-textarea').value,'继续完成所有');
    assert.equal(task.stalledRefreshAttempts||0,0);
  } finally {
    dom.window.close();
  }
});

test('a late sibling final toolbar completes normally without injecting continuation',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">finish all [Fabushi:late-toolbar-token]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><div class="markdown">当前结论与下一步。PR 仍保持 Draft，不能合并。</div></div></article><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form></main>');
  try {
    w.history.pushState({},'', '/c/late-toolbar');
    const task={id:'late-toolbar',ownerTabId:h.getTabId(),goal:'finish all',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/late-toolbar',token:'late-toolbar-token',attempted:false,messages:[]};
    h.data.tasks.push(task);
    let clicks=0;
    w.document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>clicks++);

    await h.start();
    await h.inspect(task,null);
    assert.equal(task.state,'waiting');
    assert.equal(clicks,0);

    const main=w.document.querySelector('main');
    const form=w.document.querySelector('form');
    const toolbar=w.document.createElement('div');
    toolbar.id='late-response-actions';
    toolbar.innerHTML='<button aria-label="复制回复"></button><button aria-label="来源"></button><button aria-label="更多操作"></button>';
    main.insertBefore(toolbar,form);

    const turn=h.latestTurn(task);
    assert.equal(turn.final,true,'Copy + Sources/More sibling row is strong final evidence');
    assert.ok(turn.responseActions.includes('copy'));
    assert.ok(turn.responseActions.includes('source'));
    assert.ok(turn.responseActions.includes('more'));

    await h.inspect(task,null);
    assert.equal(task.state,'waiting','first final observation must respect the stability window');
    const previous=h.observations.get(task.id);
    h.observations.set(task.id,{...previous,final:true,finalSince:Date.now()-5_000,text:turn.text,clear:true});
    await h.inspect(task,null);
    assert.equal(task.state,'done');
    assert.equal(task.continuationCount||0,0);
    assert.equal(clicks,0);
    assert.equal(w.document.querySelector('#prompt-textarea').value,'');
    assert.ok(task.messages.some(item=>item.role==='assistant' && /PR 仍保持 Draft/.test(item.text||'')));
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('an older unassociated toolbar cannot complete the latest assistant turn',async()=>{
  const {h,w,dom}=await fixture('<main><div id="old-response-actions"><button aria-label="复制回复"></button><button aria-label="来源"></button><button aria-label="更多操作"></button></div><article data-testid="conversation-turn-user"><div data-message-author-role="user">new task [Fabushi:old-toolbar-token]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><div class="markdown">latest reply without its own toolbar yet</div></div></article><form><textarea id="prompt-textarea"></textarea></form></main>');
  try {
    w.history.pushState({},'', '/c/old-toolbar');
    const task={id:'old-toolbar',ownerTabId:h.getTabId(),goal:'new task',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/old-toolbar',token:'old-toolbar-token',attempted:false,messages:[]};
    h.data.tasks.push(task);
    const turn=h.latestTurn(task);
    assert.equal(turn.owned,true);
    assert.equal(turn.final,false);
    assert.equal(turn.responseActions.length,0);
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('an authorization-card transition cannot become a duplicate fresh-session send',async()=>{
  const {h,dom}=await fixture();
  const sample={owned:true,final:false,text:'tool calls only',sentAt:0,cards:1,stop:false,loading:false,blocker:'',rateLimit:''};
  const previous={text:sample.text,since:1_000,idleSince:1_000,clear:true,final:false,endedAt:1_000};
  assert.equal(h.classify(sample,previous,16_001).state,'approval');
  assert.equal(h.classify({...sample,cards:0},previous,16_001).state,'waiting','a transient card scan miss must fail closed');
  assert.equal(h.classify({...sample,cards:0},previous,901_000).state,'waiting','old persisted endedAt data cannot resurrect the removed Stop-loss retry');
  const firstFinal={...sample,cards:0,final:true};
  assert.equal(h.classify(firstFinal,previous,902_000).state,'waiting','the toolbar must be observed stably');
  assert.equal(h.classify(firstFinal,{...previous,final:true,finalSince:902_000},906_000).state,'complete');
  dom.window.close();
});
test('conversation length-limit detection is scoped to the current response and ignores quotes/logs',async()=>{
  const zh=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">do work [Fabushi:length-zh]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><p>已完成前半段工作。</p><p>你已达到此对话的长度上限，你可以开始新聊天以继续对话。</p></div></article></main>');
  zh.w.history.pushState({},'', '/c/length-zh');
  const task={id:'length-zh',ownerTabId:zh.h.getTabId(),goal:'do work',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/length-zh',token:'length-zh',messages:[]};
  zh.h.data.tasks.push(task);
  const turn=zh.h.latestTurn(task);
  assert.match(zh.h.conversationLengthLimitNotice(turn),/长度上限/);
  zh.dom.window.close();

  const en=await fixture('<div role="status">You\'ve reached the maximum length for this conversation, but you can keep talking by starting a new chat.</div>');
  assert.match(en.h.conversationLengthLimitNotice(),/maximum length/i);
  en.dom.window.close();

  const quoted=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">测试文本：你已达到此对话的长度上限，你可以开始新聊天以继续对话。</div></article></main>');
  assert.equal(quoted.h.conversationLengthLimitNotice(),'', 'user quotation must not trigger a handoff');
  const ownNotice=quoted.w.document.createElement('div');
  ownNotice.textContent='你已达到此对话的长度上限，你可以开始新聊天以继续对话。';
  quoted.w.document.querySelector('#fabushi-auto-confirm-root').append(ownNotice);
  assert.equal(quoted.h.conversationLengthLimitNotice(),'', 'Fabushi logs must not self-trigger');
  quoted.dom.window.close();

  const assistantQuote=await fixture('<main><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><blockquote>你已达到此对话的长度上限，你可以开始新聊天以继续对话。</blockquote></div></article></main>');
  assert.equal(assistantQuote.h.conversationLengthLimitNotice({owned:true,article:assistantQuote.w.document.querySelector('article')}),'','quoted assistant discussion is not a product boundary');
  assistantQuote.dom.window.close();
});

test('conversation length-limit handoff preserves phase/round/attachments and replaces carry on repeated hops',async()=>{
  const {h,w,dom}=await fixture();
  const attachments=[{id:'proof',name:'proof.png',type:'image/png',size:12}];
  const task={id:'length-hop',ownerTabId:h.getTabId(),goal:'finish everything',mode:'goal',phase:'work',round:2,state:'waiting',url:'https://chatgpt.com/c/length-one',token:'old-token',attempted:false,attachments,messages:[]};
  h.data.tasks.push(task);
  w.history.pushState({},'', '/c/length-one');
  assert.equal(h.queueConversationLengthHandoff(task,{text:'第一会话已经完成 A/B；你已达到此对话的长度上限，你可以开始新聊天以继续对话。'},'notice',1_000),true);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.phase,'work');
  assert.equal(task.round,2);
  assert.deepEqual(task.attachments,attachments);
  assert.match(task.lengthLimitCarry,/已经完成 A\/B/);
  assert.equal(task.lengthLimitHopCount,1);
  assert.equal(task.lengthLimitCarrySourceURL,'https://chatgpt.com/c/length-one');
  assert.equal(task.history.at(-1).reason,'conversation-length-limit');

  task.url='https://chatgpt.com/c/length-two';
  task.token='second-token';
  task.state='waiting';
  w.history.pushState({},'', '/c/length-two');
  assert.equal(h.queueConversationLengthHandoff(task,{text:'第二会话又完成 C；你已达到此对话的长度上限，你可以开始新聊天以继续对话。'},'notice',2_000),true);
  assert.equal(task.phase,'work');
  assert.equal(task.round,2);
  assert.equal(task.lengthLimitHopCount,2);
  assert.match(task.lengthLimitCarry,/第二会话又完成 C/);
  assert.doesNotMatch(task.lengthLimitCarry,/已经完成 A\/B/,'each hop carries the latest page reply instead of growing without bound');
  dom.window.close();
});

test('fresh Work and Review prompts include the previous length-limited reply without changing their contracts',async()=>{
  const {h,dom}=await fixture();
  const base={id:'length-prompt',round:4,goal:'original goal',next:'continue implementation',token:'new-token',lengthLimitCarry:'上一会话已经修改 foo.rs，下一步需要完成 bar.rs。',lengthLimitHopCount:2,attachments:[{id:'a',name:'proof.png',type:'image/png',size:10}]};
  const work=h.workPrompt({...base,phase:'work'});
  assert.match(work,/continue implementation/);
  assert.match(work,/上一会话已经修改 foo\.rs/);
  assert.match(work,/从停止处继续/);
  assert.match(work,/不要重新从头执行/);
  assert.doesNotMatch(work,/MAHAYANA_TASK_REPORT_V1/);

  const review=h.plannerPrompt({...base,phase:'review',result:'Work 已完成主要实现'});
  assert.match(review,/Work 已完成主要实现/);
  assert.match(review,/上一会话已经修改 foo\.rs/);
  assert.match(review,/MAHAYANA_TASK_REPORT_V1/);
  assert.match(review,/"round":4/);
  dom.window.close();
});

test('a length-limit notice wins over a final-looking toolbar and queues a fresh continuation chat',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">finish [Fabushi:length-final]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><p>已经完成一部分。</p><p>你已达到此对话的长度上限，你可以开始新聊天以继续对话。</p></div><button aria-label="复制回复"></button><button aria-label="评价回复"></button></article><form><textarea id="prompt-textarea"></textarea></form></main>');
  w.history.pushState({},'', '/c/length-final');
  const task={id:'length-final',ownerTabId:h.getTabId(),goal:'finish',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/length-final',token:'length-final',attempted:false,messages:[]};
  h.data.tasks.push(task);
  const turn=h.latestTurn(task);
  assert.equal(turn.final,true,'the UI can expose a normal-looking final toolbar on the length-limit turn');
  await h.start();
  await h.inspect(task,null);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.phase,'work');
  assert.match(task.lengthLimitCarry,/已经完成一部分/);
  assert.equal(task.lengthLimitHopCount,1);
  h.pause();
  dom.window.close();
});

test('a true final reply clears temporary length-limit carry state',async()=>{
  const {h,dom}=await fixture();
  const task={id:'length-done',ownerTabId:h.getTabId(),goal:'finish',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/final',token:'final-token',lengthLimitCarry:'old partial reply',lengthLimitCarrySourceURL:'https://chatgpt.com/c/old',lengthLimitHopCount:3,lengthLimitLastAt:123,abnormalFreshCarry:'old abnormal partial',abnormalFreshCarrySourceURL:'https://chatgpt.com/c/abnormal',abnormalFreshCarryReason:'connection interrupted',abnormalFreshCarryPhase:'work',abnormalFreshCarryRound:1,abnormalFreshCarryAt:456,messages:[]};
  h.data.tasks.push(task);
  h.finish(task,'真正最终回复');
  assert.equal(task.state,'done');
  assert.equal(task.lengthLimitCarry,'');
  assert.equal(task.lengthLimitCarrySourceURL,'');
  assert.equal(task.lengthLimitHopCount,0);
  assert.equal(task.lengthLimitLastAt,0);
  assert.equal(task.abnormalFreshCarry,'');
  assert.equal(task.abnormalFreshCarrySourceURL,'');
  assert.equal(task.abnormalFreshCarryReason,'');
  assert.equal(task.abnormalFreshCarryPhase,'');
  assert.equal(task.abnormalFreshCarryRound,0);
  assert.equal(task.abnormalFreshCarryAt,0);
  dom.window.close();
});

test('connection interruption recovery recognizes current live assistant status and page chrome without quote false positives',async()=>{
  const page=await fixture('<div role="status">连接已中断。正在等待完整回复。</div>');
  assert.equal(page.h.connectionInterruptedNotice(),true);
  page.dom.window.close();

  const live=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">continue [Fabushi:interrupt-live]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant">连接已中断。正在等待完整回复。</div></article></main>');
  live.w.history.pushState({},'', '/c/interrupt-live');
  const liveTask={id:'interrupt-live',ownerTabId:live.h.getTabId(),goal:'continue',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/interrupt-live',token:'interrupt-live',messages:[]};
  live.h.data.tasks.push(liveTask);
  const liveTurn=live.h.latestTurn(liveTask);
  assert.equal(liveTurn.owned,true);
  assert.equal(live.h.connectionInterruptedNotice(liveTurn),true,'standalone current assistant status is the real renderer path');
  live.dom.window.close();

  const quoted=await fixture('<div data-message-author-role="user">连接已中断。正在等待完整回复。</div>');
  assert.equal(quoted.h.connectionInterruptedNotice(),false,'user transcript must not trigger a refresh');
  const ownNotice=quoted.w.document.createElement('div');
  ownNotice.textContent='连接已中断。正在等待完整回复。';
  quoted.w.document.querySelector('#fabushi-auto-confirm-root').append(ownNotice);
  assert.equal(quoted.h.connectionInterruptedNotice(),false,'workbench logs must not self-trigger');
  quoted.dom.window.close();

  const discussed=await fixture('<article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><p>如果页面显示“连接已中断。正在等待完整回复。”，我们需要继续判断下一步。</p><blockquote>连接已中断。正在等待完整回复。</blockquote></div></article>');
  const article=discussed.w.document.querySelector('article');
  assert.equal(discussed.h.connectionInterruptedNotice({owned:true,article}),false,'long assistant discussion and blockquotes are not product-status detections');
  discussed.dom.window.close();
});
test('connection interruption route fallback carries visible assistant work when the marker user turn is virtualized out of the DOM',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">旧的普通用户消息，任务 marker 已被虚拟化</div></article><article data-testid="conversation-turn-assistant-a"><div data-message-author-role="assistant"><div class="markdown">已经完成 architecture checker 的第一轮修复，并把 legacy adapter 的 Agent 依赖移出。</div></div></article><article data-testid="conversation-turn-assistant-b"><div data-message-author-role="assistant"><div data-message-content>下一步正在修 packaged acceptance 的 TypeScript 错误。</div></div></article><article data-testid="conversation-turn-assistant-status"><div data-message-author-role="assistant">连接已中断。正在等待完整回复。</div></article><div role="status">连接已中断。正在等待完整回复。</div><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form></main>');
  try {
    w.history.pushState({},'', '/c/virtualized-marker');
    const task={id:'virtualized-marker',ownerTabId:h.getTabId(),goal:'original architecture goal',next:'continue exact refactor',mode:'goal',phase:'work',round:2,state:'waiting',url:'https://chatgpt.com/c/virtualized-marker',token:'marker-no-longer-mounted',attempted:false,attachments:[],messages:[]};
    h.data.tasks.push(task);
    const scoped=h.latestTurn(task);
    assert.equal(scoped.owned,false,'the task marker is intentionally absent to model ChatGPT turn virtualization');
    assert.equal(scoped.text,'');
    const unscoped=h.latestTurn();
    assert.match(unscoped.text,/连接已中断/,'the ordinary unscoped latest-turn fallback sees only the final status segment');

    await h.start();
    await h.inspect(task,null);
    assert.equal(task.state,'queued');
    assert.equal(task.url,'');
    assert.equal(task.token,'');
    assert.equal(task.connectionInterruptedFreshDispatch,true);
    assert.match(task.abnormalFreshCarry,/已经完成 architecture checker/);
    assert.match(task.abnormalFreshCarry,/packaged acceptance/);
    assert.equal(task.abnormalFreshCarrySourceURL,'https://chatgpt.com/c/virtualized-marker');
    assert.equal(task.abnormalFreshCarrySourceKind,'exact-route-visible-assistant-transcript');
    assert.match(task.messages.at(-1).text,/任务标识被页面虚拟化/);
    assert.match(task.messages.at(-1).text,/精确 conversation URL 回退读取/);
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('connection interruption route fallback refuses a foreign task marker on the same rendered page',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">other task [Fabushi:foreign-token]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant">foreign assistant work</div></article><div role="status">连接已中断。正在等待完整回复。</div></main>');
  try {
    w.history.pushState({},'', '/c/route-owned-but-foreign-marker');
    const task={id:'target-task',ownerTabId:h.getTabId(),goal:'target',mode:'goal',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/route-owned-but-foreign-marker',token:'missing-target-token',attempted:false,attachments:[],messages:[]};
    const foreign={id:'foreign-task',ownerTabId:h.getTabId(),goal:'foreign',mode:'goal',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/foreign',token:'foreign-token',attempted:false,attachments:[],messages:[]};
    h.data.tasks.push(task,foreign);
    await h.start();
    await h.inspect(task,null);
    assert.equal(task.url,'https://chatgpt.com/c/route-owned-but-foreign-marker');
    assert.equal(task.connectionInterruptedFreshDispatch||false,false);
    assert.equal(task.abnormalFreshCarry||'','');
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('a stale earlier retry error cannot override a newer final reply',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">goal [Fabushi:stale-error-token]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><div>消息错误，请重试。</div><button aria-label="重试"></button></div></article><article data-testid="conversation-turn-user"><div data-message-author-role="user">继续完成所有</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant">final result</div><button aria-label="复制回复"></button><button aria-label="评价回复"></button></article><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form></main>');
  w.history.pushState({},'', '/c/stale-error-final');
  const task={id:'stale-error-final',ownerTabId:h.getTabId(),goal:'goal',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/stale-error-final',token:'stale-error-token',continuationCount:1,messages:[]};
  h.data.tasks.push(task);
  const turn=h.latestTurn(task);
  assert.equal(turn.final,true);
  assert.equal(h.sendTimeoutNotice(turn),false,'the earlier error card is not the latest task reply');
  dom.window.close();
});
test('connection interruption immediately requeues the same task for a fresh chat without refresh or continuation',async()=>{
  const {h,w,dom}=await fixture();
  const task=h.enqueue('original goal','goal',[{id:'doc-1',name:'evidence.txt',type:'text/plain',size:12,lastModified:1}]);
  Object.assign(task,{
    state:'waiting',
    phase:'work',
    round:4,
    next:'continue the exact current work',
    url:'https://chatgpt.com/c/interrupted-old',
    token:'old-interruption-token',
    attempted:false,
    pendingContinuationReason:'legacy interrupted',
    pendingContinuationURL:'https://chatgpt.com/c/interrupted-old',
  });
  w.history.pushState({},'', '/c/interrupted-old');
  const originalAttachments=JSON.stringify(task.attachments);
  assert.equal(h.queueInterruptedFreshRetry(task,'检测到连接中断',1_000),true);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.attempted,false);
  assert.equal(task.phase,'work');
  assert.equal(task.round,4);
  assert.equal(task.goal,'original goal');
  assert.equal(task.next,'continue the exact current work');
  assert.equal(JSON.stringify(task.attachments),originalAttachments);
  assert.equal(task.pendingContinuationReason,'');
  assert.equal(task.pendingContinuationURL,'');
  assert.equal(task.connectionInterruptedFreshDispatch,true);
  assert.equal(task.connectionInterruptedFreshRetryCount,1);
  assert.equal(task.history.at(-1).url,'https://chatgpt.com/c/interrupted-old');
  assert.equal(task.history.at(-1).reason,'connection-interrupted-fresh-chat');
  assert.match(task.messages.at(-1).text,/立即结束旧会话派发/);
  assert.match(task.messages.at(-1).text,/不再等待 15 分钟/);
  assert.match(task.messages.at(-1).text,/不刷新旧会话/);
  dom.window.close();
});

test('connection interruption carries all substantive assistant segments when the latest assistant node is only the interruption status',async()=>{
  const {h,w,dom}=await fixture(`<main>
    <article data-testid="conversation-turn-user"><div data-message-author-role="user">continue split response [Fabushi:split-interrupt]</div></article>
    <article data-testid="conversation-turn-assistant-a"><div data-message-author-role="assistant"><div class="markdown">已经核对 PR #19，并确认它只是 spec-only；随后开始检查 PR #20 的真实实现。</div></div></article>
    <article data-testid="conversation-turn-assistant-b"><div data-message-author-role="assistant"><div data-message-content>已经修进一个编译阻塞，产生新 commit；接下来正在继续清理 manifest 中仍然 planned 的模块。</div></div></article>
    <article data-testid="conversation-turn-assistant-status"><div data-message-author-role="assistant">连接已中断。正在等待完整回复。</div></article>
    <form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form>
  </main>`);
  try {
    w.history.pushState({},'', '/c/split-interrupt');
    const task={id:'split-interrupt',ownerTabId:h.getTabId(),goal:'original architecture goal',next:'continue architecture parity work',mode:'goal',phase:'work',round:4,state:'waiting',url:'https://chatgpt.com/c/split-interrupt',token:'split-interrupt',attempted:false,attachments:[],messages:[]};
    h.data.tasks.push(task);
    const latest=h.latestTurn(task);
    assert.equal(latest.owned,true);
    assert.match(latest.text,/连接已中断/,'the legacy latest-turn reader sees only the status node in this renderer shape');

    await h.start();
    await h.inspect(task,null);
    assert.equal(task.state,'queued');
    assert.equal(task.url,'');
    assert.equal(task.abnormalFreshCarrySourceKind,'owned-visible-assistant-transcript');
    assert.match(task.abnormalFreshCarry,/确认它只是 spec-only/);
    assert.match(task.abnormalFreshCarry,/修进一个编译阻塞/);
    assert.match(task.abnormalFreshCarry,/继续清理 manifest/);
    assert.doesNotMatch(task.abnormalFreshCarry,/连接已中断/);
    assert.ok(task.abnormalFreshCarry.indexOf('确认它只是 spec-only') < task.abnormalFreshCarry.indexOf('修进一个编译阻塞'));

    const prompt=h.workPrompt(task);
    assert.match(prompt,/一、验收会话最终给出的本轮提示词/);
    assert.match(prompt,/continue architecture parity work/);
    assert.match(prompt,/二、异常会话里 ChatGPT 已经工作的实时回复/);
    assert.match(prompt,/确认它只是 spec-only/);
    assert.match(prompt,/修进一个编译阻塞/);
    assert.match(prompt,/三、原始目标/);
    assert.match(prompt,/original architecture goal/);
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('connection interruption carries visible semantic work from zero-rect assistant hosts into the next prompt',async()=>{
  const {h,w,dom}=await fixture(`<main>
    <article data-testid="conversation-turn-user"><div data-message-author-role="user">continue live work [Fabushi:zero-rect-interrupt]</div></article>
    <article data-testid="conversation-turn-assistant-a"><div data-message-author-role="assistant"><div class="markdown">已经确认 PR #19 只是 spec-only，并开始核对 PR #20 的 Coordinator Host Runner 实现。</div></div></article>
    <article data-testid="conversation-turn-assistant-b"><div data-message-author-role="assistant"><div data-message-content>已经修复一个编译阻塞并产生新 commit，正在继续清理 manifest 中仍然 planned 的模块。</div></div></article>
    <article data-testid="conversation-turn-assistant-status"><div data-message-author-role="assistant">连接已中断。正在等待完整回复。</div></article>
    <div role="status">连接已中断。正在等待完整回复。</div>
    <form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form>
  </main>`,window=>{
    window.HTMLElement.prototype.getClientRects=function(){
      if(this.hidden||this.closest?.('[hidden],[inert]'))return [];
      if(this.getAttribute?.('data-message-author-role')==='assistant')return [];
      return [{}];
    };
  });
  try {
    w.history.pushState({},'', '/c/zero-rect-interrupt');
    const task={id:'zero-rect-interrupt',ownerTabId:h.getTabId(),goal:'original architecture goal',next:'continue exact architecture parity work',mode:'goal',phase:'work',round:5,state:'waiting',url:'https://chatgpt.com/c/zero-rect-interrupt',token:'zero-rect-interrupt',attempted:false,attachments:[],messages:[]};
    h.data.tasks.push(task);

    const assistantHosts=[...w.document.querySelectorAll('[data-message-author-role="assistant"]')];
    assert.ok(assistantHosts.every(node=>node.getClientRects().length===0),'the regression models layout-neutral assistant-role hosts');
    assert.ok(w.document.querySelector('.markdown').getClientRects().length>0,'semantic assistant content remains visibly rendered');

    await h.start();
    await h.inspect(task,null);
    assert.equal(task.state,'queued');
    assert.equal(task.url,'');
    assert.equal(task.abnormalFreshCarrySourceKind,'owned-visible-assistant-transcript');
    assert.match(task.abnormalFreshCarry,/PR #19 只是 spec-only/);
    assert.match(task.abnormalFreshCarry,/Coordinator Host Runner/);
    assert.match(task.abnormalFreshCarry,/修复一个编译阻塞/);
    assert.match(task.abnormalFreshCarry,/继续清理 manifest/);
    assert.doesNotMatch(task.abnormalFreshCarry,/连接已中断/);

    const prompt=h.workPrompt({...task,token:'fresh-zero-rect-token'});
    assert.match(prompt,/一、验收会话最终给出的本轮提示词/);
    assert.match(prompt,/continue exact architecture parity work/);
    assert.match(prompt,/二、异常会话里 ChatGPT 已经工作的实时回复/);
    assert.match(prompt,/PR #19 只是 spec-only/);
    assert.match(prompt,/修复一个编译阻塞/);
    assert.match(prompt,/三、原始目标/);
    assert.match(prompt,/original architecture goal/);
    assert.ok(prompt.indexOf('continue exact architecture parity work') < prompt.indexOf('PR #19 只是 spec-only'));
    assert.ok(prompt.indexOf('PR #19 只是 spec-only') < prompt.lastIndexOf('original architecture goal'));
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('connection interruption never carries hidden or inert assistant content from zero-rect hosts',async()=>{
  const {h,w,dom}=await fixture(`<main>
    <article data-testid="conversation-turn-user"><div data-message-author-role="user">continue safely [Fabushi:hidden-zero-rect]</div></article>
    <article data-testid="conversation-turn-assistant-hidden" hidden><div data-message-author-role="assistant"><div class="markdown">SECRET_HIDDEN_ASSISTANT_WORK</div></div></article>
    <article data-testid="conversation-turn-assistant-inert" inert><div data-message-author-role="assistant"><div data-message-content>SECRET_INERT_ASSISTANT_WORK</div></div></article>
    <article data-testid="conversation-turn-assistant-status"><div data-message-author-role="assistant">连接已中断。正在等待完整回复。</div></article>
    <div role="status">连接已中断。正在等待完整回复。</div>
  </main>`,window=>{
    window.HTMLElement.prototype.getClientRects=function(){
      if(this.hidden||this.closest?.('[hidden],[inert]'))return [];
      if(this.getAttribute?.('data-message-author-role')==='assistant')return [];
      return [{}];
    };
  });
  try {
    w.history.pushState({},'', '/c/hidden-zero-rect');
    const task={id:'hidden-zero-rect',ownerTabId:h.getTabId(),goal:'safe goal',next:'safe next',mode:'goal',phase:'work',round:2,state:'waiting',url:'https://chatgpt.com/c/hidden-zero-rect',token:'hidden-zero-rect',attempted:false,attachments:[],messages:[]};
    h.data.tasks.push(task);

    await h.start();
    await h.inspect(task,null);
    assert.equal(task.state,'queued');
    assert.equal(task.url,'');
    assert.equal(task.abnormalFreshCarry||'','');
    assert.doesNotMatch(task.abnormalFreshCarry||'',/SECRET_HIDDEN_ASSISTANT_WORK|SECRET_INERT_ASSISTANT_WORK/);
    const prompt=h.workPrompt({...task,token:'fresh-hidden-token'});
    assert.doesNotMatch(prompt,/SECRET_HIDDEN_ASSISTANT_WORK|SECRET_INERT_ASSISTANT_WORK/);
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('scheduler carries the interrupted live assistant work into the fresh-chat three-part Work prompt',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">continue current work [Fabushi:interrupt-live-send]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><p>已完成 legacy shell 拆分，并正在修复 packaged acceptance TypeScript 错误。</p><p>连接已中断。正在等待完整回复。</p></div></article><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form></main>');
  w.history.pushState({},'', '/c/interrupt-live-send');
  const task={id:'interrupt-live-send',ownerTabId:h.getTabId(),goal:'original goal',next:'continue current work',mode:'goal',phase:'work',round:3,state:'waiting',url:'https://chatgpt.com/c/interrupt-live-send',token:'interrupt-live-send',attempted:false,attachments:[],messages:[]};
  h.data.tasks.push(task);
  let oldConversationSends=0;
  w.document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>oldConversationSends++);

  await h.start();
  await h.tick();
  assert.equal(oldConversationSends,0,'the interrupted conversation must never receive a continuation send');
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.connectionInterruptedFreshDispatch,true);
  assert.equal(task.continuationCount||0,0);
  assert.equal(task.pendingContinuationReason||'','');
  assert.match(task.abnormalFreshCarry,/已完成 legacy shell 拆分/);
  assert.match(task.abnormalFreshCarry,/packaged acceptance TypeScript/);
  assert.doesNotMatch(task.abnormalFreshCarry,/连接已中断/);
  assert.equal(task.abnormalFreshCarryPhase,'work');
  assert.equal(task.abnormalFreshCarryRound,3);
  assert.equal(task.abnormalFreshCarrySourceURL,'https://chatgpt.com/c/interrupt-live-send');

  // Simulate the fresh root route. A very recent previous dispatch normally
  // activates the global send cooldown; the interruption recovery bypass is
  // one-shot so the scheduler can issue this fresh resend immediately.
  w.history.pushState({},'', '/');
  const main=w.document.querySelector('main');
  main.innerHTML='<form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form>';
  h.data.lastDispatchAt=Date.now();
  const input=w.document.querySelector('#prompt-textarea');
  const send=w.document.querySelector('[data-testid="send-button"]');
  let freshSends=0;
  send.addEventListener('click',()=>{
    freshSends++;
    const article=w.document.createElement('article');
    article.dataset.testid='conversation-turn-user';
    const user=w.document.createElement('div');
    user.dataset.messageAuthorRole='user';
    user.textContent=input.value;
    article.append(user);
    main.prepend(article);
    w.history.pushState({},'', '/c/interrupt-fresh');
  });

  await h.tick();
  assert.equal(freshSends,1);
  assert.equal(task.url,'https://chatgpt.com/c/interrupt-fresh');
  assert.equal(task.state,'waiting');
  assert.notEqual(task.token,'');
  assert.notEqual(task.token,'interrupt-live-send');
  assert.equal(task.connectionInterruptedFreshDispatch,false);
  assert.match(input.value,/一、验收会话最终给出的本轮提示词/);
  assert.match(input.value,/continue current work/);
  assert.match(input.value,/二、异常会话里 ChatGPT 已经工作的实时回复/);
  assert.match(input.value,/已完成 legacy shell 拆分/);
  assert.match(input.value,/三、原始目标/);
  assert.match(input.value,/original goal/);
  assert.ok(input.value.indexOf('一、验收会话最终给出的本轮提示词') < input.value.indexOf('二、异常会话里 ChatGPT 已经工作的实时回复'));
  assert.ok(input.value.indexOf('二、异常会话里 ChatGPT 已经工作的实时回复') < input.value.indexOf('三、原始目标'));
  assert.match(input.value,/从中断处继续/);
  assert.match(input.value,new RegExp('\\[Fabushi:'+task.token+'\\]'));
  h.pause();
  dom.window.close();
});

test('legacy pending interruption state is migrated to fresh-chat recovery instead of same-chat continuation',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">continue [Fabushi:legacy-pending]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant">partial stopped response</div></article><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form></main>');
  w.history.pushState({},'', '/c/legacy-pending');
  const task={id:'legacy-pending',ownerTabId:h.getTabId(),goal:'continue',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/legacy-pending',token:'legacy-pending',pendingContinuationReason:'旧版连接中断待续发',pendingContinuationURL:'https://chatgpt.com/c/legacy-pending',pendingContinuationSince:1,messages:[]};
  h.data.tasks.push(task);
  let sends=0;
  w.document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>sends++);
  await h.start();
  await h.tick();
  assert.equal(sends,0);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.pendingContinuationReason,'');
  assert.equal(task.pendingContinuationURL,'');
  assert.equal(task.connectionInterruptedFreshDispatch,true);
  assert.match(task.messages.at(-1).text,/旧版本遗留的连接中断强制续发状态/);
  h.pause();
  dom.window.close();
});

test('dispatch reset and true final completion clear stale pending interruption continuation',async()=>{
  const {h,dom}=await fixture();
  const task={id:'pending-final',ownerTabId:h.getTabId(),goal:'finish',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/pending-final',token:'pending-final',pendingContinuationReason:'interrupted',pendingContinuationURL:'https://chatgpt.com/c/pending-final',pendingContinuationSince:1,pendingContinuationStopClickedAt:2,messages:[]};
  h.data.tasks.push(task);
  h.finish(task,'真正最终回复');
  assert.equal(task.state,'done');
  assert.equal(task.pendingContinuationReason,'');
  assert.equal(task.pendingContinuationURL,'');
  assert.equal(task.pendingContinuationSince,0);
  dom.window.close();
});

test('verified continuation user turn remains owned by the original task until final toolbar',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">goal [Fabushi:continuation-token]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant">partial</div></article><article data-testid="conversation-turn-user"><div data-message-author-role="user">继续完成所有</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant">final result</div><button aria-label="复制回复"></button><button aria-label="评价回复"></button></article></main>');
  w.history.pushState({},'', '/c/continuation-owned');
  const task={id:'continuation-owned',ownerTabId:h.getTabId(),goal:'goal',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/continuation-owned',token:'continuation-token',continuationCount:1,messages:[]};
  h.data.tasks.push(task);
  const turn=h.latestTurn(task);
  assert.equal(turn.owned,true);
  assert.equal(turn.text,'final result');
  assert.equal(turn.final,true);
  dom.window.close();
});
test('send timeout recovery recognizes a retryable assistant error card without matching quoted text',async()=>{
  const page=await fixture('<div role="alert">消息发送超时，请重试。</div>');
  assert.equal(page.h.sendTimeoutNotice(),true);
  page.dom.window.close();

  const assistantError=await fixture('<article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><div>消息发送超时，请重试。</div><button aria-label="重试"></button></div></article>');
  assert.equal(assistantError.h.sendTimeoutNotice(),true,'an assistant error card with a retry control is actionable');
  assistantError.dom.window.close();

  const quoted=await fixture('<div data-message-author-role="assistant">消息发送超时，请重试。</div>');
  assert.equal(quoted.h.sendTimeoutNotice(),false,'task transcript must not trigger a resend');
  const ownNotice=quoted.w.document.createElement('div');
  ownNotice.textContent='消息发送超时，请重试。';
  quoted.w.document.querySelector('#fabushi-auto-confirm-root').append(ownNotice);
  assert.equal(quoted.h.sendTimeoutNotice(),false,'workbench logs must not self-trigger');
  quoted.dom.window.close();
});
test('inspect appends continuation in the same bound chat after a retryable message error',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">recover timeout [Fabushi:old-token]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><div>消息错误，请重试。</div><button aria-label="重试"></button></div></article><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" type="button">发送</button></form></main>');
  const task={id:'timeout-inspect',ownerTabId:h.getTabId(),goal:'recover timeout',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/timeout-inspect',token:'old-token',attempted:false,noFinalReplyAttempts:0,messages:[]};
  h.data.tasks.push(task);
  w.history.pushState({},'', '/c/timeout-inspect');
  let clicks=0;
  w.document.querySelector('[data-testid="send-button"]').addEventListener('click',()=>clicks++);
  await h.start();
  await h.inspect(task,null);
  assert.equal(task.state,'waiting');
  assert.equal(task.url,'https://chatgpt.com/c/timeout-inspect');
  assert.equal(task.token,'old-token');
  assert.equal(task.noFinalReplyAttempts,0);
  assert.equal(task.continuationCount,1);
  assert.equal(w.document.querySelector('#prompt-textarea').value,'继续完成所有');
  assert.equal(clicks,1);
  assert.match(task.messages.at(-1).text,/原会话输入并发送“继续完成所有”/);
  h.pause();
  dom.window.close();
});
test('exhausted abnormal retries enter persisted backoff and reset after success',async()=>{
  const {h,dom}=await fixture();
  const task=h.enqueue('keep recovering','once');
  Object.assign(task,{state:'waiting',phase:'work',url:'https://chatgpt.com/c/exhausted',token:'old-token',attempted:false,noFinalReplyAttempts:4});
  const before=Date.now();
  assert.equal(h.noFinalReplyBackoffMs(1),5*60*1000);
  assert.equal(h.noFinalReplyBackoffMs(2),10*60*1000);
  assert.equal(h.noFinalReplyBackoffMs(5),30*60*1000);
  assert.equal(h.queueNoFinalReplyRetry(task,'检测到“消息发送超时，请重试”'),'waiting');
  assert.equal(task.state,'waiting');
  assert.equal(task.noFinalReplyAttempts,4);
  assert.equal(task.noFinalReplyRecoveryCycles,undefined);
  assert.equal(task.noFinalReplyRecoveryUntil,undefined);
  assert.equal(task.url,'https://chatgpt.com/c/exhausted');
  assert.match(task.messages.at(-1).text,/保留当前会话/);
  h.finish(task,'final answer');
  assert.equal(task.state,'done');
  assert.equal(task.noFinalReplyAttempts,0);
  assert.equal(task.noFinalReplyRecoveryCycles,0);
  assert.equal(task.noFinalReplyRecoveryUntil,0);
  dom.window.close();
});
test('a bound abnormal retry remains in the same conversation',async()=>{
  const {h,dom}=await fixture();
  const task=h.enqueue('retry once','once');
  Object.assign(task,{state:'waiting',phase:'work',url:'https://chatgpt.com/c/ended',token:'old-token',noFinalReplyAttempts:0});
  assert.equal(h.queueNoFinalReplyRetry(task),'waiting');
  assert.equal(task.state,'waiting');
  assert.equal(task.noFinalReplyAttempts,0);
  assert.equal(task.url,'https://chatgpt.com/c/ended');
  assert.match(task.messages.at(-1).text,/同一会话追加“继续完成所有”/);
  dom.window.close();
});
test('legacy exhausted abnormal records are revived after upgrading',async()=>{
  const {h,dom}=await fixture();
  const task={id:'legacy-exhausted',goal:'revive me',mode:'goal',phase:'work',round:1,state:'paused',pausedState:'blocked',url:'https://chatgpt.com/c/legacy-exhausted',token:'old-token',messages:[{text:'会话已结束但没有最终回复，自动重发次数已用尽。'}]};
  h.data.tasks.push(task);
  assert.equal(h.recoverLegacyExhaustedNoFinalReplies(),task.id);
  assert.equal(task.state,'waiting');
  assert.equal(task.pausedState,undefined);
  assert.equal(task.noFinalReplyAttempts,4);
  assert.equal(task.noFinalReplyRecoveryUntil,0);
  assert.match(task.messages.at(-1).text,/持续延迟恢复/);
  dom.window.close();
});
test('persisted needs-processing task automatically opens a fresh retry instead of stopping',async()=>{
  const {h,dom}=await fixture();
  const task={id:'old-error',ownerTabId:h.getTabId(),goal:'keep running',mode:'goal',phase:'work',round:1,state:'blocked',url:'https://chatgpt.com/c/old-error',token:'old-token',attempted:true,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.recoverPersistedBlockedTasks(),task.id);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.attempted,false);
  assert.equal(task.cooldownUntil,0,'first persisted blocked recovery is immediate');
  assert.match(task.messages.at(-1).text,/新的 ChatGPT 会话/);
  assert.match(task.messages.at(-1).text,/自动重发/);
  assert.doesNotMatch(h.data.tasks.map(item=>item.state).join(','),/blocked/);
  dom.window.close();
});
test('repeated connection interruptions create fresh dispatches while preserving task identity and phase',async()=>{
  const {h,w,dom}=await fixture();
  const task=h.enqueue('keep this exact task','goal');
  Object.assign(task,{state:'waiting',phase:'work',round:5,next:'resume exact step',url:'https://chatgpt.com/c/disconnected-1',token:'owner-token-1',attempted:false});
  w.history.pushState({},'', '/c/disconnected-1');
  assert.equal(h.queueInterruptedFreshRetry(task,'first interruption',20_000,{owned:true,text:'第一异常会话已经完成 A，并开始 B。'}),true);
  assert.equal(task.id,h.data.tasks[0].id);
  assert.equal(task.phase,'work');
  assert.equal(task.round,5);
  assert.equal(task.next,'resume exact step');
  assert.equal(task.connectionInterruptedFreshRetryCount,1);
  assert.equal(task.history.at(-1).url,'https://chatgpt.com/c/disconnected-1');
  assert.match(task.abnormalFreshCarry,/已经完成 A/);

  // Simulate a successfully bound fresh chat that later gets interrupted too.
  Object.assign(task,{state:'waiting',url:'https://chatgpt.com/c/disconnected-2',token:'owner-token-2',attempted:false,connectionInterruptedFreshDispatch:false});
  w.history.pushState({},'', '/c/disconnected-2');
  assert.equal(h.queueInterruptedFreshRetry(task,'second interruption',30_000,{owned:true,text:'第二异常会话已经完成 B，并正在处理 C。'}),true);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.phase,'work');
  assert.equal(task.round,5);
  assert.equal(task.next,'resume exact step');
  assert.equal(task.connectionInterruptedFreshRetryCount,2);
  assert.equal(task.history.at(-1).url,'https://chatgpt.com/c/disconnected-2');
  assert.equal(task.history.at(-1).reason,'connection-interrupted-fresh-chat');
  assert.match(task.abnormalFreshCarry,/第二异常会话已经完成 B/);
  assert.doesNotMatch(task.abnormalFreshCarry,/第一异常会话/,'each abnormal fresh-chat hop keeps the newest live assistant work instead of growing without bound');
  dom.window.close();
});
test('abnormal fresh-chat Work prompt has the required three parts and ignores stale carry from another phase or round',async()=>{
  const {h,dom}=await fixture();
  const task={id:'carry-prompt',round:6,goal:'original target',next:'planner final next instruction',phase:'work',token:'carry-token',abnormalFreshCarry:'partial assistant progress from failed chat',abnormalFreshCarryPhase:'work',abnormalFreshCarryRound:6};
  const prompt=h.workPrompt(task);
  assert.match(prompt,/一、验收会话最终给出的本轮提示词/);
  assert.match(prompt,/planner final next instruction/);
  assert.match(prompt,/二、异常会话里 ChatGPT 已经工作的实时回复/);
  assert.match(prompt,/partial assistant progress from failed chat/);
  assert.match(prompt,/三、原始目标/);
  assert.match(prompt,/original target/);
  assert.ok(prompt.indexOf('planner final next instruction') < prompt.indexOf('partial assistant progress from failed chat'));
  assert.ok(prompt.indexOf('partial assistant progress from failed chat') < prompt.lastIndexOf('original target'));
  assert.doesNotMatch(h.workPrompt({...task,round:7}),/partial assistant progress from failed chat/,'carry is generation-bound to the interrupted phase and round');

  const review=h.plannerPrompt({...task,phase:'review',abnormalFreshCarryPhase:'review',result:'Work natural result'});
  assert.match(review,/异常会话中 ChatGPT 已经输出的实时回复/);
  assert.match(review,/partial assistant progress from failed chat/);
  assert.match(review,/MAHAYANA_TASK_REPORT_V1/);
  dom.window.close();
});

test('work prompt stays natural while the fresh planner alone receives the report contract',async()=>{
  const {h,dom}=await fixture();
  const task={id:'a',round:1,goal:'do work',next:'',result:'natural result',token:'t'};
  assert.doesNotMatch(h.workPrompt(task),/MAHAYANA_TASK_REPORT_V1/);
  assert.doesNotMatch(h.workPrompt(task),/status.*complete/);
  assert.match(h.plannerPrompt(task),/MAHAYANA_TASK_REPORT_V1/);
  assert.match(h.plannerPrompt(task),/natural result/);
  dom.window.close();
});
test('nested split authorization card is detected without article/section wrappers',async()=>{
  const {h,dom}=await fixture('<main><div><div>这里可以是任意正文，不参与识别。</div><div><button>拒绝</button><button>允许</button><button aria-haspopup="menu"><svg></svg></button></div></div></main>');
  assert.equal(h.cards().length,1);
  h.cards()[0].button.disabled=true;
  assert.equal(h.cards().length,0);
  dom.window.close();
});
test('ordinary allow controls are not mistaken for authorization cards',async()=>{
  const {h,dom}=await fixture('<main><button>允许</button><div><button>拒绝</button><button>允许</button></div><div><button>允许</button><button aria-haspopup="menu">选项</button></div></main>');
  assert.equal(h.cards().length,0);
  dom.window.close();
});
test('unexpected ChatGPT modal is automatically closed while authorization cards stay untouched',async()=>{
  const {w,h,dom}=await fixture();
  h.setGlobalAutoApprove(true);
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
test('historical final answer cannot complete a new user turn',async()=>{
  const {h,dom}=await fixture('<article><div data-message-author-role="assistant"><div class="markdown">old final</div></div><button data-testid="copy-turn-action-button">Copy</button></article><div data-message-author-role="user">new task</div><article><div data-message-author-role="assistant">Thinking</div></article>');
  assert.equal(h.latestTurn().final,false);
  assert.equal(h.latestTurn().text,'Thinking');
  dom.window.close();
});
test('review reports are tied to exact task and round',async()=>{
  const {h,dom}=await fixture();const task={id:'a',round:2};
  assert.equal(h.parseReview('{"taskId":"a","round":2,"status":"complete","summary":"verified"}',task).status,'complete');
  assert.throws(()=>h.parseReview('{"taskId":"b","round":2,"status":"complete","summary":"verified"}',task));
  assert.throws(()=>h.parseReview('{"taskId":"a","round":2,"status":"next","summary":"incomplete"}',task));
  dom.window.close();
});
test('startup is paused and UI submission remains local until one explicit scheduler send',async()=>{
  const {w,h,dom}=await fixture('<form><textarea id="prompt-textarea"></textarea><button data-testid="send-button">Send</button></form>');
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
  const {h,w,dom}=await fixture('<main><div data-message-author-role="user">[Fabushi:owner]</div><article><div data-message-author-role="assistant">partial</div></article></main>');
  w.history.pushState({},'', '/c/existing');
  const task={id:'existing',goal:'inspect',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/existing',token:'owner',messages:[]};
  assert.equal(await h.navigate(task.url,null,task,false),true);
  dom.window.close();
});
test('missing send controls keep one prepared intent instead of blocking or duplicating',async()=>{
  const {h,dom}=await fixture('<main><form><textarea id="prompt-textarea"></textarea></form></main>');
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
  const {w,h,dom}=await fixture('<main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button">Send</button></form></main>');
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
  const {w,h,dom}=await fixture('<main><form><textarea id="prompt-textarea"></textarea></form></main>');
  const pageInput=w.document.querySelector('#prompt-textarea');
  const form=pageInput.closest('form');
  let sends=0;
  pageInput.addEventListener('input',async()=>{
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
  const {w,h,dom}=await fixture('<main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button">Send</button></form></main>');
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
  const {w,h,dom}=await fixture('<main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button">Send</button></form></main>');
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
  await new Promise(resolve=>setTimeout(resolve,400));
  h.pause();
  assert.equal(task.url,`https://chatgpt.com/c/new-route-${task.id}`);
  assert.deepEqual(Array.from(task.sessionUrls),[`https://chatgpt.com/c/new-route-${task.id}`]);
  dom.window.close();
});
test('new goals become the next scheduler target instead of waiting behind stale tasks',async()=>{
  const {h,dom}=await fixture();
  h.data.tasks.push({id:'stale',goal:'stale',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/WEB:stale',token:'old',messages:[]});
  const task=h.enqueue('new goal','goal');
  assert.equal(h.getCurrent(),task.id);
  assert.equal(h.data.selected,task.id);
  dom.window.close();
});
test('scheduler keeps sends and approvals exclusive while rotating inspections',async()=>{
  const {h,dom}=await fixture();
  for (const state of ['queued','sending','uploading','loading','approval']) {
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
test('supervision rotates durable conversation URLs while keeping sends exclusive',async()=>{
  const {h,dom}=await fixture();
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
test('a deferred task never head-of-line blocks another runnable task',async()=>{
  const {h,dom}=await fixture();
  const now=Date.now();
  const deferred=h.enqueue('deferred','goal');
  Object.assign(deferred,{state:'waiting',url:'https://chatgpt.com/c/deferred',token:'deferred',navigationGuardRetryAt:now+30000});
  const runnable=h.enqueue('runnable','goal');
  Object.assign(runnable,{state:'waiting',url:'https://chatgpt.com/c/runnable',token:'runnable'});
  assert.equal(h.nextSupervisionTask([deferred,runnable],now),runnable);
  assert.ok(h.taskDeferredUntil(deferred,now)>=now+29000);
  dom.window.close();
});
test('queued dispatch throttling delays only unsent tasks while existing conversations remain inspectable',async()=>{
  const {h,dom}=await fixture();
  const now=Date.now();
  h.data.lastDispatchAt=now;
  const queued=h.enqueue('queued','goal');
  const waiting={id:'waiting',ownerTabId:h.getTabId(),goal:'waiting',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/waiting',token:'waiting',messages:[]};
  h.data.tasks.push(waiting);
  assert.equal(h.nextSupervisionTask([queued,waiting],now),waiting);
  assert.ok(h.nextTaskWakeDelay([queued],now)>=59000);
  dom.window.close();
});
test('each browser tab owns an isolated task workspace while local tasks can rotate',async()=>{
  const {h,w,dom}=await fixture();
  const localFirst=h.enqueue('local first','goal');
  Object.assign(localFirst,{state:'waiting',url:'https://chatgpt.com/c/local-first',token:'first'});
  const localSecond=h.enqueue('local second','goal');
  Object.assign(localSecond,{state:'waiting',url:'https://chatgpt.com/c/local-second',token:'second'});
  const foreign={id:'foreign',ownerTabId:'another-tab',goal:'foreign task',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/foreign',token:'foreign',messages:[]};
  h.data.tasks.push(foreign);
  h.log(localFirst,'refresh grouped sidebar');
  assert.equal(localFirst.ownerTabId,h.getTabId());
  assert.equal(localSecond.ownerTabId,h.getTabId());
  assert.deepEqual(Array.from(h.tabTasks(),task=>task.id),[localFirst.id,localSecond.id]);
  assert.equal(h.taskBelongsToTab(foreign),false);
  const sidebarLabels=[...w.document.querySelectorAll('aside button')].map(node=>node.textContent);
  assert.ok(sidebarLabels.some(label=>label.includes('local first')));
  assert.ok(sidebarLabels.some(label=>label.includes('local second')));
  assert.ok(sidebarLabels.every(label=>!label.includes('foreign task')),'foreign task records are read-only rows, not current-tab buttons');
  assert.ok(w.document.querySelector('[data-owner-tab-id="another-tab"] [data-task-id="foreign"]'));
  assert.equal(w.document.querySelector('[data-task-id="foreign"]').dataset.taskState,'waiting');
  assert.match(w.document.querySelector('[data-task-id="foreign"] .state-badge').textContent,/等待响应/);
  h.pause(true);
  assert.equal(localFirst.state,'paused');
  assert.equal(localSecond.state,'paused');
  assert.equal(foreign.state,'waiting','pausing one tab cannot pause another tab workspace');
  dom.window.close();
});
test('a single task already on its exact route never creates a navigation or refresh ticket',async()=>{
  const {h,w,dom}=await fixture();
  const task=h.enqueue('stay here','goal');
  Object.assign(task,{state:'waiting',url:'https://chatgpt.com/c/stay-here',token:'owner'});
  w.history.pushState({},'', '/c/stay-here');
  w.sessionStorage.setItem('fabushi-workbench-navigation-v2',JSON.stringify({task:task.id,href:task.url,path:'/c/stay-here',resume:true,direct:true,at:Date.now()}));
  assert.equal(h.directNavigate(new w.URL(task.url),task,false),true);
  assert.equal(w.location.href,task.url);
  assert.equal(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'),null);
  assert.equal(h.measurements.switches,0);
  dom.window.close();
});
test('pause marks active tasks and resume restores their runnable states',async()=>{
  const {h,dom}=await fixture();
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
  const {w,h,dom}=await fixture();
  const paused=h.enqueue('continue','goal');
  Object.assign(paused,{state:'paused',pausedState:'blocked',phase:'work',round:1,url:'https://chatgpt.com/c/continue',token:'owner'});
  h.data.autoResume=false;
  h.log(paused,'已暂停');
  const button=[...w.document.querySelectorAll('header button')].find(node=>node.textContent.includes('继续'));
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
test('a paused task without a real URL resumes as a fresh queued dispatch and keeps attachments',async()=>{
  const {h,dom}=await fixture();
  const task={id:'paused-no-url',goal:'send again safely',state:'paused',pausedState:'blocked',phase:'work',round:1,url:'',token:'stale-token',attempted:true,sendPrepared:true,preparedPrompt:'old prompt',dispatchOriginURL:'https://chatgpt.com/c/old',messages:[],attachments:[{id:'paused-file',name:'paused.png',type:'image/png',size:4,lastModified:1}]};
  h.data.tasks.push(task);
  assert.equal(h.restorePausedTasks(7),true);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.attempted,false);
  assert.equal(task.sendPrepared,false);
  assert.deepEqual(task.attachments,[{id:'paused-file',name:'paused.png',type:'image/png',size:4,lastModified:1}]);
  dom.window.close();
});
test('an idle ChatGPT tab cannot pause a queue owned by another tab',async()=>{
  const {w,h,dom}=await fixture();
  const waiting={id:'idle-page',goal:'keep running',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  h.data.tasks.push(waiting);
  w.dispatchEvent(new w.Event('pagehide'));
  assert.equal(waiting.state,'waiting');
  assert.equal(h.data.autoResume,true);
  dom.window.close();
});
test('runner pagehide suspends locally without converting the queue to manual pause',async()=>{
  const {w,h,dom}=await fixture();
  const waiting={id:'runner-page',goal:'keep running',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  h.data.tasks.push(waiting);
  await h.start();
  w.dispatchEvent(new w.Event('pagehide'));
  assert.equal(waiting.state,'waiting');
  assert.equal(h.data.autoResume,true);
  assert.equal((await w.FabushiUserscript.call('status')).running,false);
  dom.window.close();
});
test('replacing an idle script instance does not pause persisted tasks',async()=>{
  const {w,h,dom}=await fixture();
  const waiting={id:'idle-replace',goal:'keep running',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  h.data.tasks.push(waiting);
  w.__FABUSHI_AUTO_CONFIRM_INSTANCE__.shutdown();
  assert.equal(waiting.state,'waiting');
  assert.equal(h.data.autoResume,true);
  dom.window.close();
});
test('same-document hot replacement keeps the workspace and continuous review transition',async()=>{
  const {w,h,dom}=await fixture();
  const task=h.enqueue('continue through validation','goal');
  Object.assign(task,{state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/hot-reload',token:'owner-token'});
  w.history.pushState({},'', '/c/hot-reload');
  h.log(task,'persist before hot replacement');
  const originalTabId=h.getTabId();

  const duplicateRoot=w.document.createElement('div');duplicateRoot.id='fabushi-auto-confirm-root';w.document.body.append(duplicateRoot);
  const duplicateStyle=w.document.createElement('style');duplicateStyle.id='fabushi-auto-confirm-style';w.document.head.append(duplicateStyle);
  w.__FABUSHI_AUTO_CONFIRM_INSTANCE__.version='2.9.5';
  await w.eval(source.replace('  mount();','  window.replacementHooks = { finish, data, getTabId:()=>tabId };\n  mount();'));

  assert.equal(w.replacementHooks.getTabId(),originalTabId,'replacement must reclaim the same document workspace');
  assert.equal(w.document.querySelectorAll('#fabushi-auto-confirm-root').length,1);
  assert.equal(w.document.querySelectorAll('#fabushi-auto-confirm-style').length,1);
  const replacementTask=w.replacementHooks.data.tasks.find(item=>item.id===task.id);
  assert.ok(replacementTask,'the continuous task remains owned by the replacement instance');
  w.replacementHooks.finish(replacementTask,'completed Work result');
  assert.equal(replacementTask.phase,'review');
  assert.equal(replacementTask.state,'queued');
  assert.equal(replacementTask.url,'');
  assert.match(replacementTask.messages.at(-1).text,/新开规划\/验收会话/);
  await w.__FABUSHI_AUTO_CONFIRM_INSTANCE__.shutdown();
  dom.window.close();
});
test('same-tab navigation reclaims the persisted workspace after the old document releases its lock',async()=>{
  const original=await fixture();
  const task=original.h.enqueue('保持同一标签页身份','goal');
  original.h.recordConversationURL(task,'https://chatgpt.com/c/same-tab-handoff');
  original.h.log(task,'准备进行同页导航');
  const owner=original.h.getTabId();
  const ticket={path:'/c/same-tab-handoff',href:'https://chatgpt.com/c/same-tab-handoff',task:task.id,at:Date.now(),resume:true};
  const resumed=await fixture('',w=>{
    w.navigator.locks=original.w.navigator.locks;
    w.localStorage.setItem('fabushi-workbench-v2',original.w.localStorage.getItem('fabushi-workbench-v2'));
    w.localStorage.setItem('fabushi-workbench-legacy-owner-v1',owner);
    w.sessionStorage.setItem('fabushi-workbench-tab-session-v1',owner);
    w.sessionStorage.setItem('fabushi-workbench-navigation-v2',JSON.stringify(ticket));
    setTimeout(()=>original.w.__FABUSHI_AUTO_CONFIRM_INSTANCE__.shutdown(),100);
  });
  assert.equal(resumed.h.getTabId(),owner,'same-tab document handoff must keep the persisted owner id');
  assert.equal(resumed.h.tabTasks().length,1);
  assert.equal(resumed.h.tabTasks()[0].goal,'保持同一标签页身份');
  original.dom.window.close();resumed.dom.window.close();
});
test('runner start waits for a retiring document lock and then self-heals',async()=>{
  let runnerAttempts=0;
  const {h,w,dom}=await fixture('',window=>{
    const base=window.navigator.locks.request.bind(window.navigator.locks);
    window.navigator.locks.request=async(name,options,callback)=>{
      callback ||= options;
      if(name.startsWith('fabushi-tab-runner-v3:') && runnerAttempts++ < 2) return callback(null);
      return base(name,options,callback);
    };
  });
  h.enqueue('lease handoff','goal');
  try {
    await h.start(false);
    assert.ok(runnerAttempts>=3,'the new document retries until the retiring runner releases its lock');
  } finally {
    h.pause();
    w.close();
    dom.window.close();
  }
});
test('concurrent script injection mounts one workbench instance',async()=>{
  const dom=new JSDOM('<body></body>',{url:'https://chatgpt.com/',runScripts:'outside-only'});
  const w=dom.window;
  w.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{}];};
  const held=new Set();
  w.navigator.locks={query:async()=>({held:[...held].map(name=>({name}))}),request:async(name,options,callback)=>{callback ||= options;if(held.has(name))return callback(null);held.add(name);try{return await callback({name});}finally{held.delete(name);}}};
  const hooks='  window.testHooks = { getTabId:()=>tabId, tabTasks };\n  mount();';
  await Promise.all([w.eval(source.replace('  mount();',hooks)),w.eval(source.replace('  mount();',hooks))]);
  assert.equal(w.document.querySelectorAll('#fabushi-auto-confirm-root').length,1);
  assert.equal(w.document.querySelectorAll('#fabushi-auto-confirm-bootstrap-v1').length,1);
  dom.window.close();
});
test('a persisted manual pause is made visible after script reload',async()=>{
  const {h,dom}=await fixture();
  const task={id:'reload-paused',goal:'keep paused',state:'generating',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  h.data.tasks.push(task);
  h.data.autoResume=false;
  assert.equal(h.migratePersistedPause(),true);
  assert.equal(task.state,'paused');
  assert.equal(task.pausedState,'generating');
  dom.window.close();
});
test('a newer manual pause from another tab wins over a stale runner write',async()=>{
  const {h,w,dom}=await fixture();
  const task={id:'remote-pause',goal:'keep stopped',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/live',token:'owner',messages:[]};
  h.data.tasks.push(task);
  h.data.controlRevision=3;
  h.data.autoResume=true;
  h.log(task,'旧标签页仍在巡视');
  const stored=JSON.parse(w.localStorage.getItem('fabushi-workbench-v2'));
  stored.tabControls[h.getTabId()].controlRevision=4;
  stored.tabControls[h.getTabId()].autoResume=false;
  stored.tabControls[h.getTabId()].pausedAt=Date.now();
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
  const {w,h,dom}=await fixture('<main><div><p>任意内容</p><button>拒绝</button><button>允许</button><button aria-haspopup="menu">⌄</button></div><div role="menu"><button role="menuitem">允许本次会话</button></div></main>');
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
  const {w,h,dom}=await fixture('<main><div id="card"><p>任意内容</p><button>拒绝</button><button>允许</button><button aria-haspopup="menu">⌄</button><div role="menu"><button role="menuitem">允许本次会话</button></div></div></main>');
  let arrowClicks=0, approvals=0;
  w.document.querySelector('[aria-haspopup]').onclick=()=>arrowClicks++;
  w.document.querySelector('[role=menuitem]').onclick=()=>approvals++;
  h.data.globalAutoApprove=true;
  assert.equal(await h.processGlobalApprovalCards(),true);
  assert.equal(arrowClicks,1);
  assert.equal(approvals,1);
  dom.window.close();
});
test('connector-named conversation grant is accepted but permanent grants are rejected',async()=>{
  const {w,h,dom}=await fixture();
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
  const {w,h,dom}=await fixture('<main><div id="card"><h2>允许 ChatGPT 使用 GitHub？</h2><button>拒绝</button><button>允许</button><button aria-haspopup="menu" aria-label="Allow GitHub for this conversation">⌄</button></div><div role="menu"><button role="menuitem" aria-label="Allow GitHub for this conversation">Allow GitHub for this conversation</button></div></main>');
  let arrowClicks=0, approvals=0;
  w.document.querySelector('#card [aria-haspopup]').onclick=()=>arrowClicks++;
  w.document.querySelector('[role=menuitem]').onclick=()=>approvals++;
  await h.authorize(h.cards()[0],null,null,false);
  assert.equal(arrowClicks,1);
  assert.equal(approvals,1);
  dom.window.close();
});
test('Radix authorization trigger opens on pointerdown before selecting its div menuitem',async()=>{
  const {w,h,dom}=await fixture('<main><div id="card"><p>任意内容</p><button>拒绝</button><button>允许</button><button aria-haspopup="menu" aria-label="Allow GitHub for this conversation">⌄</button></div></main>');
  let pointerdowns=0, approvals=0;
  w.document.querySelector('[aria-haspopup]').addEventListener('pointerdown',async()=>{
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
test('cancelled tasks resume the exact persisted conversation when possible',async()=>{
  const {h,dom}=await fixture();
  const task={id:'cancelled',goal:'continue me',mode:'goal',phase:'work',round:3,state:'cancelled',url:'https://chatgpt.com/c/existing',token:'owner',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.restoreCancelledTask(task),true);
  assert.equal(task.state,'waiting');
  assert.equal(task.url,'https://chatgpt.com/c/existing');
  assert.equal(task.token,'owner');
  assert.match(task.messages.at(-1).text,/继续监控取消前/);
  dom.window.close();
});
test('cancelled unsent tasks return to the dispatch queue and keep attachments',async()=>{
  const {h,dom}=await fixture();
  const task={id:'cancelled-unsent',goal:'continue me',mode:'goal',phase:'work',round:1,state:'cancelled',url:'',token:'stale',attempted:false,messages:[],attachments:[{id:'cancelled-file',name:'cancelled.pdf',type:'application/pdf',size:4,lastModified:1}]};
  h.data.tasks.push(task);
  assert.equal(h.restoreCancelledTask(task),true);
  assert.equal(task.state,'queued');
  assert.equal(task.token,'');
  assert.deepEqual(task.attachments,[{id:'cancelled-file',name:'cancelled.pdf',type:'application/pdf',size:4,lastModified:1}]);
  dom.window.close();
});
test('cancelled queued planner does not reopen the previous Work URL',async()=>{
  const {h,dom}=await fixture();
  const task={id:'cancelled-planner',goal:'continue me',next:'verify the new round',mode:'goal',phase:'review',round:2,state:'cancelled',url:'',sessionUrl:'https://chatgpt.com/c/previous-work',sessionUrls:['https://chatgpt.com/c/previous-work'],token:'',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.restoreCancelledTask(task),true);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.phase,'review');
  dom.window.close();
});
test('quota banner is ignored while real safety challenges remain blockers',async()=>{
  const {h,dom}=await fixture('<p>工作区有成员达到使用上限</p><button>开启自动充值</button>');
  assert.equal(h.blocker(),'');
  assert.equal(h.classify({owned:true,final:false,text:'',sentAt:Date.now(),cards:0,stop:false,blocker:'ChatGPT 使用额度或访问频率受限'},null,Date.now()).state,'waiting');
  assert.equal(h.classify({owned:true,final:false,text:'',sentAt:Date.now(),cards:0,stop:false,blocker:'页面需要完成安全验证'},null,Date.now()).state,'blocked');
  dom.window.close();
});
test('rate-limit detection ignores the plugin log and conversation text',async()=>{
  const {h,dom}=await fixture('<main><article><div data-message-author-role="user">Please explain rate limits</div></article></main>');
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
test('reload recovery preserves healthy and rate-limited in-flight sessions',async()=>{
  const {h,dom}=await fixture();
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
test('paused legacy sidebar waits resume directly from their recorded URL',async()=>{
  const {h,dom}=await fixture();
  const task={id:'paused-legacy',goal:'keep this chat',mode:'goal',phase:'work',round:1,state:'paused',pausedState:'blocked',url:'https://chatgpt.com/c/legacy-url',token:'legacy-token',attempted:true,messages:[{text:'目标会话链接尚未出现在侧栏；保持当前页面等待，不会刷新或重复派发（第 4/4 次）。'}]};
  h.data.tasks.push(task);
  assert.equal(h.restorePausedTasks(9),true);
  assert.equal(task.state,'waiting');
  assert.equal(task.url,'https://chatgpt.com/c/legacy-url');
  assert.equal(task.attempted,false);
  assert.match(task.messages.at(-1).text,/不等待侧栏/);
  dom.window.close();
});
test('resuming a queued next round never reopens a historical Work URL',async()=>{
  const {h,dom}=await fixture();
  const task={id:'queued-next-round',goal:'continue with the new round',mode:'goal',phase:'review',round:2,state:'paused',pausedState:'queued',url:'',sessionUrl:'https://chatgpt.com/c/previous-work',sessionUrls:['https://chatgpt.com/c/previous-work'],token:'',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.restorePausedTasks(12),true);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(h.validNavigationTicket({task:task.id,path:'/c/previous-work',href:'https://chatgpt.com/c/previous-work',resume:true}),false);
  dom.window.close();
});
test('transient navigation warning cannot redispatch an already generating conversation',async()=>{
  const {h,dom}=await fixture();
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
test('missing sidebar links automatically requeue in a fresh conversation',async()=>{
  const {h,w,dom}=await fixture();
  const task={id:'nav',ownerTabId:h.getTabId(),state:'queued',messages:[]};
  const target=new w.URL('https://chatgpt.com/c/WEB:not-a-browser-session');
  assert.equal(h.queueNavigation(target,task),false);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.cooldownUntil,0,'first automatic recovery is immediate');
  assert.equal(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'),null);
  assert.ok(task.messages.some(message=>/新的 ChatGPT 会话/.test(message.text) && /自动重发/.test(message.text)));
  assert.ok(task.messages.every(message=>!/请在任务中保留有效/.test(message.text)),'manual recovery copy must never be emitted');
  h.queueNavigation(target,task,'同一错误再次出现');
  assert.equal(task.state,'queued');
  assert.ok(task.cooldownUntil>Date.now(),'repeated permanent failures back off instead of hot-looping');
  assert.equal(task.blockedAutoRetryCount,2);
  dom.window.close();
});
test('live owned conversation canonicalizes a stale URL without navigation',async()=>{
  const {h,w,dom}=await fixture('<main><div data-message-author-role="user">[Fabushi:live-token]</div><article><div data-message-author-role="assistant">正在生成</div></article>');
  const task={id:'canonical',goal:'keep',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/WEB:stale',token:'live-token',attempted:false,messages:[]};
  h.data.tasks.push(task);
  w.history.pushState({},'', '/c/real-conversation');
  assert.equal(await h.navigate(task.url,undefined,task),true);
  assert.equal(task.url,'https://chatgpt.com/c/real-conversation');
  assert.equal(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'),null);
  dom.window.close();
});
test('recorded conversation links are canonical identities and direct recovery is one-shot',async()=>{
  const {h,w,dom}=await fixture();
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
test('open control keeps every task runnable and carries a generation-bound inspection ticket',async()=>{
  const {h,w,dom}=await fixture();
  const oldTask=h.enqueue('old task','goal');
  h.recordConversationURL(oldTask,'https://chatgpt.com/c/old-conversation');
  const newTask=h.enqueue('new task','goal');
  h.recordConversationURL(newTask,'https://chatgpt.com/c/new-conversation');
  h.log(newTask,'工作会话已确认发送');
  w.sessionStorage.setItem('fabushi-workbench-navigation-v2',JSON.stringify({
    task:oldTask.id,path:'/c/old-conversation',href:oldTask.url,resume:true,at:Date.now()
  }));
  const link=[...w.document.querySelectorAll('a.action')].find(node=>node.textContent==='打开已记录会话链接');
  assert.ok(link);
  assert.equal(link.href,newTask.url,'the visible control carries the selected task URL as a native href');
  assert.equal(link.dataset.taskId,newTask.id);
  assert.equal(link.dataset.conversationUrl,newTask.url);
  let prevented=false;
  link.onclick({preventDefault(){prevented=true;}});
  assert.equal(prevented,false);
  assert.equal(link.href,newTask.url,'click cannot be retargeted to a stale task URL');
  assert.equal(h.data.autoResume,true,'manual open keeps automatic supervision enabled');
  assert.equal(oldTask.state,'queued','manual open leaves unrelated tasks runnable');
  assert.equal(newTask.state,'queued','manual open leaves the selected task runnable');
  assert.match(newTask.messages.at(-1).text,/任务保持运行/,'the status explains that inspection does not pause work');
  const ticket=JSON.parse(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'));
  assert.equal(ticket.purpose,'inspect');
  assert.equal(ticket.task,newTask.id);
  assert.equal(h.validNavigationTicket(ticket),true);
  assert.equal(oldTask.url,'https://chatgpt.com/c/old-conversation');
  assert.equal(newTask.url,'https://chatgpt.com/c/new-conversation');
  dom.window.close();
});
test('open control rejects a task URL that changed after the panel rendered',async()=>{
  const {h,dom}=await fixture();
  const task=h.enqueue('changing task','goal');
  h.recordConversationURL(task,'https://chatgpt.com/c/rendered');
  assert.equal(h.prepareRecordedConversationOpen(task.id,'https://chatgpt.com/c/rendered'),task.url);
  h.data.autoResume=true;
  task.state='waiting';
  h.recordConversationURL(task,'https://chatgpt.com/c/changed');
  assert.equal(h.prepareRecordedConversationOpen(task.id,'https://chatgpt.com/c/rendered'),'');
  assert.equal(h.data.autoResume,true,'a stale control cannot pause or navigate the current task');
  dom.window.close();
});
test('a conversation URL cannot be adopted by two active tasks',async()=>{
  const {h,dom}=await fixture();
  const first={id:'owner',url:'https://chatgpt.com/c/unique',messages:[]};
  const second={id:'new-task',url:'',messages:[]};
  h.data.tasks.push(first,second);
  assert.equal(h.captureConversationURL(second,first.url),'');
  assert.equal(second.url,'');
  assert.equal(h.conversationURLOwner(first.url),first);
  dom.window.close();
});
test('synthetic conversation URL automatically becomes a fresh resend',async()=>{
  const {h,w,dom}=await fixture();
  const task={id:'unverified',ownerTabId:h.getTabId(),goal:'wait',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/WEB:not-in-sidebar',token:'owner',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.queueNavigation(new w.URL(task.url),task,'会话地址无效'),false);
  assert.equal(w.location.pathname,'/');
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.cooldownUntil,0);
  assert.match(task.messages.at(-1).text,/新的 ChatGPT 会话/);
  assert.match(task.messages.at(-1).text,/自动重发/);
  assert.doesNotMatch(task.messages.at(-1).text,/请在任务中保留有效/);
  h.pause();
  dom.window.close();
});
test('ambiguous send timeout prioritizes the current-round bound conversation before any resend',async()=>{
  const {h,w,dom}=await fixture();
  w.history.pushState({},'', '/c/other-conversation');
  const task={id:'sent-bound',goal:'review once',mode:'goal',round:1,state:'sending',phase:'review',url:'https://chatgpt.com/c/bound-conversation',token:'one-dispatch',attempted:true,sentAt:Date.now(),messages:[]};
  h.data.tasks.push(task);
  h.stopAmbiguousSend(task,false,1_000_000);
  assert.equal(task.state,'waiting');
  assert.equal(task.url,'https://chatgpt.com/c/bound-conversation');
  assert.equal(task.token,'one-dispatch');
  assert.equal(task.attempted,false);
  assert.match(task.messages.at(-1).text,/绑定会话/);
  assert.match(task.messages.at(-1).text,/最终回复/);
  dom.window.close();
});
test('loading recovery never refreshes an owned conversation after its final reply is already visible',async()=>{
  const {h,w,dom}=await fixture('<main><article data-testid="conversation-turn-user"><div data-message-author-role="user">验收 [Fabushi:final-no-refresh-token]</div></article><article data-testid="conversation-turn-assistant"><div data-message-author-role="assistant"><div class="markdown" data-is-streaming="false">验收最终回复已经完成。</div></div><button aria-label="复制回复"></button><button aria-label="评价回复"></button></article><form><textarea id="prompt-textarea"></textarea></form></main>');
  w.history.pushState({},'', '/c/final-no-refresh');
  const task={id:'final-no-refresh',ownerTabId:h.getTabId(),goal:'验收',mode:'goal',phase:'review',round:4,state:'waiting',url:'https://chatgpt.com/c/final-no-refresh',token:'final-no-refresh-token',attempted:false,messages:[],routeRecoveryAttempts:0,workspaceDocumentRecoveryAttempts:0};
  h.data.tasks.push(task);
  assert.equal(h.latestTurn(task).final,true);
  assert.equal(h.recoverStalledRoute(new URL(task.url),task),false);
  assert.equal(task.routeRecoveryAttempts,0);
  assert.equal(task.workspaceDocumentRecoveryAttempts,0);
  assert.equal(task.messages.some(item=>/页面长时间没有恢复/.test(item.text||'')),false);
  dom.window.close();
});

test('generic stalled conversation refresh cooldown is fifteen minutes while ambiguous-send recovery stays separate',async()=>{
  const {h,w,dom}=await fixture();
  w.history.pushState({},'', '/c/stall-fifteen');
  const task={id:'stall-fifteen',ownerTabId:h.getTabId(),goal:'wait',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/stall-fifteen',token:'stall-fifteen',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.refreshStalledConversation(task,false,1_000_000),true);
  assert.equal(task.stalledRefreshAttempts,1);
  assert.match(task.messages.at(-1).text,/连续 15 分钟/);
  assert.match(task.messages.at(-1).text,/每 15 分钟/);
  assert.equal(h.refreshStalledConversation(task,false,1_899_999),false,'generic stall refresh must not recur before 15 minutes');
  assert.equal(task.stalledRefreshAttempts,1);
  assert.equal(h.refreshStalledConversation(task,false,1_900_000),true,'15 minutes permits the next same-chat stalled refresh');
  assert.equal(task.stalledRefreshAttempts,2);
  dom.window.close();
});

test('unbound ambiguous send older than 90 seconds immediately queues a fresh resend without refresh delay',async()=>{
  const {h,w,dom}=await fixture();
  w.history.pushState({},'', '/c/old-conversation');
  const attachments=[{id:'proof',name:'proof.png',type:'image/png',size:12,lastModified:1}];
  const task={id:'sent-unbound',ownerTabId:h.getTabId(),goal:'review once',next:'keep the same next step',mode:'goal',round:3,state:'sending',phase:'review',url:'',token:'one-dispatch',attempted:true,dispatchOriginURL:'https://chatgpt.com/c/old-conversation',sentAt:1,attachments,messages:[]};
  h.data.tasks.push(task);
  h.data.lastDispatchAt=999_999;
  h.stopAmbiguousSend(task,false,1_000_000);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'','the stale ambiguous dispatch token is discarded before a fresh send');
  assert.equal(task.attempted,false);
  assert.equal(task.immediateFreshDispatch,true);
  assert.equal(task.ambiguousFreshRetryCount,1);
  assert.equal(task.ambiguousSendRefreshAttempts,0);
  assert.equal(task.ambiguousSendRefreshAt,0);
  assert.equal(task.phase,'review');
  assert.equal(task.round,3);
  assert.equal(task.goal,'review once');
  assert.equal(task.next,'keep the same next step');
  assert.deepEqual(task.attachments,attachments);
  assert.equal(h.taskDeferredUntil(task,1_000_000),1_000_000,'the one-shot recovery resend bypasses the ordinary dispatch cooldown');
  assert.match(task.messages.at(-1).text,/立即放弃未绑定发送并新开 ChatGPT 会话原样重发/);
  assert.match(task.messages.at(-1).text,/不再刷新旧页面或等待 3 分钟/);
  dom.window.close();
});
test('edited goal is persisted and replaces stale next-round instructions',async()=>{
  const {h,dom}=await fixture();
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
test('goal edits during review discard stale acceptance next and start a new work round',async()=>{
  const {h,dom}=await fixture();
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
test('editing a queued review skips the unsent stale planner immediately',async()=>{
  const {h,dom}=await fixture();
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
test('message history is bounded after eighty entries',async()=>{
  const {h,dom}=await fixture();
  const task={id:'history',goal:'keep history',messages:[],messageVersion:0};
  h.data.tasks.push(task);
  for(let index=0;index<120;index++) h.log(task,`记录 ${index}`);
  assert.equal(task.messages.length,80);
  assert.equal(task.messages[0].text,'记录 40');
  assert.equal(task.messages.at(-1).text,'记录 119');
  dom.window.close();
});
test('completed, cancelled, and paused tasks can be deleted while live tasks are retained',async()=>{
  const {h,w,dom}=await fixture();
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
test('task rows expose isolated pause, details, cancel, and delete controls',async()=>{
  const {h,w,dom}=await fixture();
  const first=h.enqueue('first task detail','goal');
  const second=h.enqueue('second task remains','once');
  const rowFor=task=>w.document.querySelector(`[data-task-id="${task.id}"]`);
  const action=(row,label)=>[...row.querySelectorAll('.task-action')].find(button=>button.textContent===label);
  [...w.document.querySelectorAll('header button')].find(button=>button.textContent==='设置').click();
  assert.ok([...w.document.querySelectorAll('.settings button')].some(button=>/^(暂停|继续)全部任务$/.test(button.textContent)),'the global pause action is explicit and separate');

  assert.ok(action(rowFor(first),'详情'),'each task exposes a details action');
  assert.ok(action(rowFor(first),'暂停'),'a runnable task exposes a pause action');
  assert.equal(action(rowFor(first),'删除').disabled,true,'a live task cannot be deleted before it is stopped');
  action(rowFor(first),'暂停').click();
  assert.equal(first.state,'paused');
  assert.equal(first.pausedState,'queued');
  assert.equal(second.state,'queued','pausing one task leaves its sibling queued');
  assert.equal(h.data.autoResume,true,'a task pause does not activate the global pause barrier');
  assert.ok(action(rowFor(first),'继续'),'a paused task exposes a task-level continue action');
  assert.equal(action(rowFor(first),'删除').disabled,false,'a paused task can be deleted');

  action(rowFor(first),'详情').click();
  assert.equal(h.data.selected,first.id);
  assert.match(w.document.querySelector('.feed').textContent,/first task detail/,'details action selects the task feed');

  action(rowFor(second),'详情').click();
  const cancel=[...w.document.querySelectorAll('.feed button')].find(button=>button.textContent==='取消此任务');
  assert.ok(cancel);
  cancel.click();
  assert.equal(second.state,'cancelled');
  assert.equal(first.state,'paused','cancelling one task leaves the other paused');
  assert.equal(h.data.autoResume,true,'cancelling one task does not activate the global pause barrier');

  action(rowFor(first),'删除').click();
  assert.equal(h.data.tasks.map(task=>task.id).join(','),second.id,'deleting one task leaves the sibling record');
  dom.window.close();
});
test('continuing one paused task does not restore another paused task',async()=>{
  const {h,w,dom}=await fixture();
  const first=h.enqueue('resume only this task','goal');
  const second=h.enqueue('keep this task paused','goal');
  Object.assign(first,{state:'paused',pausedState:'queued'});
  Object.assign(second,{state:'paused',pausedState:'waiting',url:'https://chatgpt.com/c/keep-paused',token:'keep-paused'});
  h.log(second,'第二个任务保持暂停');
  const rowFor=task=>w.document.querySelector(`[data-task-id="${task.id}"]`);
  const action=(row,label)=>[...row.querySelectorAll('.task-action')].find(button=>button.textContent===label);
  assert.ok(action(rowFor(first),'继续'));
  action(rowFor(first),'继续').click();
  await new Promise(resolve=>setTimeout(resolve,20));
  try {
    assert.notEqual(first.state,'paused','the selected task resumes');
    assert.equal(second.state,'paused','the sibling task remains paused');
    assert.equal(h.data.autoResume,true,'single-task continue does not restore the global barrier');
  } finally {
    h.pause();
    dom.window.close();
  }
});
test('header pause targets the selected task and settings owns the global pause',async()=>{
  const {h,w,dom}=await fixture();
  const first=h.enqueue('selected task','once');
  const second=h.enqueue('sibling task','once');
  const rowFor=task=>w.document.querySelector(`[data-task-id="${task.id}"]`);
  [...rowFor(first).querySelectorAll('.task-action')].find(button=>button.textContent==='详情').click();
  await h.start();
  try {
    const headerPause=[...w.document.querySelectorAll('header button')].find(button=>button.textContent==='暂停当前任务');
    assert.ok(headerPause,'the running header exposes a task-level pause');
    headerPause.click();
    assert.equal(first.state,'paused');
    assert.equal(second.state,'queued','the header action leaves the sibling task runnable');
    assert.equal(h.data.autoResume,true);

    [...w.document.querySelectorAll('header button')].find(button=>button.textContent==='设置').click();
    const globalPause=[...w.document.querySelectorAll('.settings button')].find(button=>button.textContent==='暂停全部任务');
    assert.ok(globalPause);
    globalPause.click();
    assert.equal(h.data.autoResume,false);
    assert.equal(second.state,'paused','the explicit global action pauses the remaining task');
  } finally {
    h.pause();
    dom.window.close();
  }
});
test('same-route recovery is a committed reload path and watchdog re-arms a scheduler that would otherwise go silent',async()=>{
  const {h,w,dom}=await fixture('<main><article data-message-author-role="user">goal [Fabushi:deadlock-recovery]</article><div class="animate-spin"></div></main>');
  try {
    w.history.replaceState({},'', '/c/deadlock-recovery');
    const task={id:'deadlock-recovery',ownerTabId:h.getTabId(),goal:'goal',mode:'once',phase:'work',round:1,goalRevision:0,state:'loading',url:'https://chatgpt.com/c/deadlock-recovery',token:'deadlock-recovery',messages:[],routeRecoveryAttempts:1};
    h.data.tasks.push(task);
    w.sessionStorage.setItem('fabushi-workbench-navigation-v2',JSON.stringify({
      path:'/c/deadlock-recovery',
      href:task.url,
      at:Date.now(),
      task:task.id,
      attempts:2,
      assigned:true,
      direct:true,
      purpose:'recovery',
      phase:'work',
      round:1,
      goalRevision:0,
      recovery:true,
      resume:true,
    }));
    await h.start(false);
    h.beginGuardedNavigation(task.url,task,{replace:true,force:true,recovery:true,ticketPath:'/c/deadlock-recovery',ticketHref:task.url,reason:'route-recovery'});
    await new Promise(resolve=>w.setTimeout(resolve,0));
    assert.equal(h.getNavigationState().navigating,true,'same-route recovery must remain a committed navigation rather than being cancelled as a no-op');
    assert.match(source,/if \(sameRoute && recovery\) location\.reload\(\);/,'same-route recovery commits a real reload');
    h.armNavigationCommitWatchdog(task,'test-recovery',10);
    await new Promise(resolve=>w.setTimeout(resolve,130));
    assert.equal(h.getNavigationState().navigating,false,'watchdog releases a committed navigation when the document does not unload');
    assert.equal(h.getNavigationState().timer,true,'scheduler is re-armed after the failed navigation commit');
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('ordinary same-route navigation remains a no-op but asynchronous cancellation re-arms the scheduler',async()=>{
  const {h,w,dom}=await fixture();
  try {
    w.history.replaceState({},'', '/c/same-route-noop');
    const task={id:'same-route-noop',ownerTabId:h.getTabId(),goal:'goal',mode:'once',phase:'work',round:1,goalRevision:0,state:'waiting',url:'https://chatgpt.com/c/same-route-noop',token:'same-route-noop',messages:[]};
    h.data.tasks.push(task);
    w.sessionStorage.setItem('fabushi-workbench-navigation-v2',JSON.stringify({
      path:'/c/same-route-noop',href:task.url,at:Date.now(),task:task.id,attempts:1,assigned:true,direct:true,purpose:'inspect',phase:'work',round:1,goalRevision:0,resume:true,
    }));
    await h.start(false);
    h.beginGuardedNavigation(task.url,task,{replace:true,force:true,recovery:false,ticketPath:'/c/same-route-noop',ticketHref:task.url,reason:'inspect'});
    await new Promise(resolve=>w.setTimeout(resolve,10));
    assert.equal(h.getNavigationState().navigating,false);
    assert.equal(h.getNavigationState().timer,true,'same-route cancellation must not strand tick.finally without a timer');
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('owned route inspection preserves loading recovery counters until loading truly clears',async()=>{
  const {h,w,dom}=await fixture('<main><article data-message-author-role="user">goal [Fabushi:loading-counter]</article><div id="loader" class="animate-spin"></div></main>');
  try {
    w.history.replaceState({},'', '/c/loading-counter');
    const task={id:'loading-counter',ownerTabId:h.getTabId(),goal:'goal',mode:'once',phase:'work',round:1,state:'loading',url:'https://chatgpt.com/c/loading-counter',token:'loading-counter',messages:[],routeRecoveryAttempts:1,workspaceDocumentRecoveryAttempts:1,rendererRecoveryExhausted:true,sendUiWaitSince:123};
    h.data.tasks.push(task);
    assert.equal(await h.navigate(task.url,null,task,false),true);
    assert.equal(task.routeRecoveryAttempts,1,'loading route must keep the recovery count');
    assert.equal(task.workspaceDocumentRecoveryAttempts,1);
    assert.equal(task.rendererRecoveryExhausted,true);
    w.document.querySelector('#loader').remove();
    assert.equal(await h.navigate(task.url,null,task,false),true);
    assert.equal(task.routeRecoveryAttempts,0,'counter resets only after loading signal disappears');
    assert.equal(task.workspaceDocumentRecoveryAttempts,0);
    assert.equal(task.rendererRecoveryExhausted,false);
    assert.equal(task.sendUiWaitSince,0);
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('loading recovery progresses from second route attempt into one fresh-document handoff',async()=>{
  const {h,w,dom}=await fixture();
  try {
    const task={id:'loading-budget',ownerTabId:h.getTabId(),goal:'goal',mode:'once',phase:'work',round:1,goalRevision:0,state:'loading',url:'https://chatgpt.com/c/loading-budget',token:'loading-budget',messages:[],routeRecoveryAttempts:1,workspaceDocumentRecoveryAttempts:0,rendererRecoveryExhausted:false};
    h.data.tasks.push(task);
    h.recoverStalledRoute(new w.URL(task.url),task);
    assert.equal(task.routeRecoveryAttempts,2);
    assert.ok(task.messages.some(message=>/第 2\/2 次/.test(message.text)));
    h.recoverStalledRoute(new w.URL(task.url),task);
    assert.equal(task.workspaceDocumentRecoveryAttempts,1,'after 2/2 the next recovery is the bounded fresh-document handoff');
    assert.equal(task.rendererRecoveryExhausted,true);
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('same-route hydration waits without creating a navigation ticket',async()=>{
  const {h,w,dom}=await fixture('<main>ChatGPT is loading</main>');
  const result=await h.navigate('/',undefined,{id:'task'});
  assert.equal(result,false);
  assert.equal(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'),null);
  dom.window.close();
});
test('dispatches keep a full cooldown between Chat sessions',async()=>{
  const {h,dom}=await fixture();
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

test('the fourth distinct rate-limit episode abandons the old conversation and queues a fresh resend',async()=>{
  const {h,dom}=await fixture();
  const attachments=[{id:'proof',name:'proof.png',type:'image/png',size:12}];
  const task={id:'rate-limit-4',ownerTabId:h.getTabId(),goal:'finish it',mode:'goal',phase:'review',round:3,state:'waiting',url:'https://chatgpt.com/c/rate-limit-old',token:'rate-token',attempted:false,attachments,messages:[]};
  h.data.tasks.push(task);
  assert.ok(h.restForRateLimit(task,1_000)>0);
  assert.equal(task.rateLimitEpisodes,1);
  assert.ok(h.restForRateLimit(task,301_001)>0);
  assert.equal(task.rateLimitEpisodes,2);
  assert.ok(h.restForRateLimit(task,601_002)>0);
  assert.equal(task.rateLimitEpisodes,3);
  assert.equal(h.restForRateLimit(task,901_003),100);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.rateLimitEpisodes,0);
  assert.equal(task.phase,'review');
  assert.equal(task.round,3);
  assert.equal(task.goal,'finish it');
  assert.deepEqual(task.attachments,attachments);
  assert.match(task.messages.at(-1).text,/超过 3 次/);
  assert.match(task.messages.at(-1).text,/新的 ChatGPT 会话恢复当前任务/);
  dom.window.close();
});
test('a new round rejects historical routes even when its new marker is already rendered',async()=>{
  const {h,dom}=await fixture();
  const task={id:'new-round',attempted:true,url:'',sessionUrls:['https://chatgpt.com/c/old-round']};
  assert.equal(h.captureConversationURL(task,'https://chatgpt.com/c/old-round'),'');
  assert.equal(task.url,'');
  assert.equal(h.captureConversationURL(task,'https://chatgpt.com/c/new-round'),'https://chatgpt.com/c/new-round');
  dom.window.close();
});
test('different non-conversation routes are not treated as an already open destination',async()=>{
  const {h,w,dom}=await fixture();
  w.history.pushState({},'', '/settings');
  const task=h.enqueue('new task','once');
  assert.equal(h.directNavigate(new w.URL('https://chatgpt.com/'),task,false),false);
  assert.equal(JSON.parse(w.sessionStorage.getItem('fabushi-workbench-navigation-v2')).path,'/');
  dom.window.close();
});
test('an idle personal tab leaves its modal untouched',async()=>{
  const {w,dom}=await fixture('<div role="dialog"><button aria-label="Close">×</button></div>');
  let clicks=0;
  w.document.querySelector('[aria-label="Close"]').onclick=()=>clicks++;
  await new Promise(resolve=>setTimeout(resolve,150));
  assert.equal(clicks,0);
  dom.window.close();
});

test('a stale navigation call cannot overwrite or open an already advanced conversation',async()=>{
  const {h,w,dom}=await fixture();
  const task=h.enqueue('advanced task','goal');
  h.recordConversationURL(task,'https://chatgpt.com/c/latest');
  assert.equal(h.directNavigate(new w.URL('https://chatgpt.com/c/previous'),task,false),false);
  assert.equal(task.url,'https://chatgpt.com/c/latest');
  assert.equal(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'),null);
  dom.window.close();
});

test('duplicating a live tab creates a distinct workspace instead of sharing its tasks',async()=>{
  const original=await fixture();
  original.h.enqueue('original goal','goal');
  const copy=await fixture('',w=>{
    w.navigator.locks=original.w.navigator.locks;
    w.localStorage.setItem('fabushi-workbench-v2',original.w.localStorage.getItem('fabushi-workbench-v2'));
    w.localStorage.setItem('fabushi-workbench-legacy-owner-v1',original.h.getTabId());
    w.sessionStorage.setItem('fabushi-workbench-tab-session-v1',original.h.getTabId());
  });
  assert.notEqual(copy.h.getTabId(),original.h.getTabId());
  assert.equal(copy.h.tabTasks().length,0);
  assert.equal(original.h.tabTasks().length,1);
  assert.equal((await copy.w.FabushiUserscript.call('status')).running,false);
  original.dom.window.close();copy.dom.window.close();
});

test('restoration refuses a workspace whose original tab is still open even while paused',async()=>{
  const original=await fixture();
  original.h.enqueue('original goal','goal');original.h.pause(true);
  const personal=await fixture('',w=>{
    w.navigator.locks=original.w.navigator.locks;
    w.localStorage.setItem('fabushi-workbench-v2',original.w.localStorage.getItem('fabushi-workbench-v2'));
    w.localStorage.setItem('fabushi-workbench-legacy-owner-v1',original.h.getTabId());
  });
  personal.w.open=()=>{throw new Error('must not open a duplicate');};
  await assert.rejects(personal.h.restoreWorkspace(original.h.getTabId()),/仍在原标签页/);
  assert.equal(personal.h.tabTasks().length,0);
  original.dom.window.close();personal.dom.window.close();
});

test('closed workspace resumes via a one-use ticket in a dedicated tab without taking over the caller',async()=>{
  const original=await fixture();
  const task=original.h.enqueue('restore exact task','goal');
  original.h.recordConversationURL(task,'https://chatgpt.com/c/current-round');
  original.h.pause(true);
  const owner=original.h.getTabId();
  original.w.__FABUSHI_AUTO_CONFIRM_INSTANCE__.shutdown();
  await Promise.resolve();
  const personal=await fixture('',w=>{
    w.navigator.locks=original.w.navigator.locks;
    w.localStorage.setItem('fabushi-workbench-v2',original.w.localStorage.getItem('fabushi-workbench-v2'));
    w.localStorage.setItem('fabushi-workbench-legacy-owner-v1',owner);
  });
  const personalId=personal.h.getTabId();let openedURL='';
  personal.w.open=url=>{openedURL=url;return {opener:personal.w};};
  await personal.h.restoreWorkspace(owner);
  assert.match(openedURL,/\/c\/current-round#fabushi-resume=/);
  assert.equal(personal.h.getTabId(),personalId);
  assert.equal(personal.w.location.href,'https://chatgpt.com/');
  assert.equal(personal.h.tabTasks().length,0);
  const restored=await fixture('',w=>{
    w.navigator.locks=personal.w.navigator.locks;
    for(let i=0;i<personal.w.localStorage.length;i++){
      const key=personal.w.localStorage.key(i);w.localStorage.setItem(key,personal.w.localStorage.getItem(key));
    }
    w.history.replaceState({},'',openedURL);
  });
  assert.equal(restored.h.getTabId(),owner);
  assert.equal(restored.h.tabTasks()[0].url,'https://chatgpt.com/c/current-round');
  assert.equal(restored.h.tabTasks()[0].state,'paused','explicit manual pause remains authoritative');
  assert.equal(restored.w.location.hash,'');
  const token=new URL(openedURL).hash.split('=')[1];
  assert.equal(restored.w.localStorage.getItem('fabushi-workspace-recovery-v1:'+token),null);
  original.dom.window.close();personal.dom.window.close();restored.dom.window.close();
});

test('an empty new tab visibly offers and adopts a closed workspace in place',async()=>{
  const original=await fixture();
  const task=original.h.enqueue('关闭标签页后仍要找得到','goal');
  original.h.recordConversationURL(task,'https://chatgpt.com/c/recover-current-tab');
  original.h.pause(true);
  const owner=original.h.getTabId();
  original.w.__FABUSHI_AUTO_CONFIRM_INSTANCE__.shutdown();
  await Promise.resolve();

  const personal=await fixture('',w=>{
    w.navigator.locks=original.w.navigator.locks;
    w.localStorage.setItem('fabushi-workbench-v2',original.w.localStorage.getItem('fabushi-workbench-v2'));
    w.localStorage.setItem('fabushi-workbench-legacy-owner-v1',owner);
  });
  personal.w.open=()=>{throw new Error('an empty replacement tab must not open a third tab');};
  const restore=[...personal.w.document.querySelectorAll('aside .restore-workspace')]
    .find(button=>button.textContent==='恢复到当前标签页');
  assert.ok(restore);
  assert.equal(personal.w.document.querySelectorAll('aside .task-group[data-owner-tab-id]').length,1,'recovery is grouped in the left task list');
  assert.equal(personal.w.document.querySelector('header button:nth-of-type(2)').textContent,'设置','top recovery strip is removed');
  assert.equal(personal.h.recoverableWorkspaces()[0].ownerTabId,owner);

  const result=await personal.h.restoreWorkspace(owner,true);
  assert.equal(result.target,'current');
  assert.equal(personal.h.getTabId(),owner);
  assert.equal(personal.h.tabTasks().length,1);
  assert.equal(personal.h.tabTasks()[0].goal,'关闭标签页后仍要找得到');
  assert.equal(personal.h.tabTasks()[0].state,'paused','manual pause remains authoritative after in-place recovery');
  assert.equal(personal.w.sessionStorage.getItem('fabushi-workbench-tab-session-v1'),owner);
  original.dom.window.close();personal.dom.window.close();
});

test('completed task records remain recoverable after their tab closes',async()=>{
  const original=await fixture();
  const task=original.h.enqueue('保留已完成任务记录','once');
  task.state='done';
  original.h.log(task,'任务已完成');
  original.h.data.selected=task.id;
  original.w.__FABUSHI_AUTO_CONFIRM_INSTANCE__.shutdown();
  await Promise.resolve();
  const owner=original.h.getTabId();

  const personal=await fixture('',w=>{
    w.navigator.locks=original.w.navigator.locks;
    w.localStorage.setItem('fabushi-workbench-v2',original.w.localStorage.getItem('fabushi-workbench-v2'));
    w.localStorage.setItem('fabushi-workbench-legacy-owner-v1',owner);
  });
  assert.equal(personal.h.recoverableWorkspaces().length,1);
  const result=await personal.h.restoreWorkspace(owner,true);
  assert.equal(result.target,'current');
  assert.equal(personal.h.tabTasks()[0].state,'done');
  assert.match(personal.h.tabTasks()[0].messages.at(-1).text,/任务已完成/);
  original.dom.window.close();personal.dom.window.close();
});

test('a fresh ChatGPT document automatically adopts the only stale running workspace',async()=>{
  const owner='crashed-renderer-owner';
  const task={id:'crashed-task',ownerTabId:owner,goal:'继续执行崩溃前目标',mode:'goal',phase:'work',round:2,state:'waiting',url:'https://chatgpt.com/c/crashed-conversation',token:'crashed-token',attempted:false,attachments:[{id:'crashed-file',name:'证据.png',type:'image/png',size:12,lastModified:1}],messages:[]};
  const stored={tasks:[task],selectedByTab:{[owner]:task.id},tabControls:{[owner]:{autoResume:true,autoApprove:true,controlRevision:4}}};
  const heartbeat={ownerTabId:owner,at:Date.now()-180000,autoResume:true,running:true,taskId:task.id,taskState:task.state,taskURL:task.url,recoveryURL:'https://chatgpt.com/c/crashed-conversation#fabushi-resume=crashed'};
  const {h,w,dom}=await fixture('',window=>{
    window.localStorage.setItem('fabushi-workbench-v2',JSON.stringify(stored));
    window.localStorage.setItem('fabushi-workspace-heartbeat-v1:'+owner,JSON.stringify(heartbeat));
  });
  assert.equal(h.getTabId(),owner);
  assert.equal(h.tabTasks().length,1);
  assert.equal(h.tabTasks()[0].url,task.url);
  assert.equal(h.tabTasks()[0].token,task.token);
  assert.deepEqual(JSON.parse(JSON.stringify(h.tabTasks()[0].attachments)),task.attachments);
  const persistedHeartbeat=JSON.parse(w.localStorage.getItem('fabushi-workspace-heartbeat-v1:'+owner));
  assert.equal(persistedHeartbeat.taskId,task.id);
  assert.deepEqual(persistedHeartbeat.attachmentIds,['crashed-file']);
  assert.equal(persistedHeartbeat.goal,undefined,'heartbeat must not persist task text');
  h.pause();
  dom.window.close();
});

test('startup auto-resume arms recovered-final identity for the exact persisted conversation',async()=>{
  const owner='startup-recovered-owner';
  const task={
    id:'startup-recovered-final',
    ownerTabId:owner,
    goal:'继续已恢复任务',
    goalRevision:6,
    mode:'once',
    phase:'work',
    round:5,
    state:'waiting',
    url:'https://chatgpt.com/c/startup-recovered-final',
    token:'startup-recovered-token',
    attempted:false,
    messages:[],
    updatedAt:Date.now(),
  };
  const {h,dom}=await fixture('',window=>{
    window.history.replaceState({},'', '/c/startup-recovered-final');
    window.sessionStorage.setItem('fabushi-workbench-tab-session-v1',owner);
    window.localStorage.setItem('fabushi-workbench-v2',JSON.stringify({
      tasks:[task],
      deletedTaskIds:[],
      selected:task.id,
      selectedByTab:{[owner]:task.id},
      tabControls:{[owner]:{autoResume:true,lastDispatchAt:0,controlRevision:0,pausedAt:0,globalAutoApprove:false,autoApprove:true}},
    }));
  });
  const restored=h.data.tasks.find(item=>item.id===task.id);
  assert.ok(restored);
  assert.deepEqual(JSON.parse(JSON.stringify(restored.recoveredFinalIdentity)),{
    url:'https://chatgpt.com/c/startup-recovered-final',
    token:'startup-recovered-token',
    phase:'work',
    round:5,
    goalRevision:6,
  });
  assert.equal(h.getCurrent(),task.id);
  h.pause();
  dom.window.close();
});

test('automatic recovery ignores healthy, paused and ambiguous workspaces',async()=>{
  const makeTask=(owner,id,state='waiting')=>({id,ownerTabId:owner,goal:id,mode:'once',phase:'work',round:1,state,url:'https://chatgpt.com/c/'+id,token:id+'-token',attempted:false,attachments:[],messages:[]});
  const healthyOwner='healthy-owner';
  const healthyTask=makeTask(healthyOwner,'healthy-task');
  const healthy=await fixture('',window=>{
    window.localStorage.setItem('fabushi-workbench-v2',JSON.stringify({tasks:[healthyTask],tabControls:{[healthyOwner]:{autoResume:true}}}));
    window.localStorage.setItem('fabushi-workspace-heartbeat-v1:'+healthyOwner,JSON.stringify({ownerTabId:healthyOwner,at:Date.now()-1000,autoResume:true,running:true,taskId:healthyTask.id,recoveryURL:'https://chatgpt.com/#fabushi-resume=healthy'}));
  });
  assert.notEqual(healthy.h.getTabId(),healthyOwner);
  healthy.dom.window.close();

  const pausedOwner='paused-owner';
  const pausedTask=makeTask(pausedOwner,'paused-task','paused');
  const paused=await fixture('',window=>{
    window.localStorage.setItem('fabushi-workbench-v2',JSON.stringify({tasks:[pausedTask],tabControls:{[pausedOwner]:{autoResume:false}}}));
    window.localStorage.setItem('fabushi-workspace-heartbeat-v1:'+pausedOwner,JSON.stringify({ownerTabId:pausedOwner,at:Date.now()-180000,autoResume:false,running:false,taskId:pausedTask.id,recoveryURL:'https://chatgpt.com/#fabushi-resume=paused'}));
  });
  assert.notEqual(paused.h.getTabId(),pausedOwner);
  paused.dom.window.close();

  const firstOwner='ambiguous-one';
  const secondOwner='ambiguous-two';
  const first=makeTask(firstOwner,'ambiguous-task-one');
  const second=makeTask(secondOwner,'ambiguous-task-two');
  const ambiguous=await fixture('',window=>{
    window.localStorage.setItem('fabushi-workbench-v2',JSON.stringify({tasks:[first,second],tabControls:{[firstOwner]:{autoResume:true},[secondOwner]:{autoResume:true}}}));
    for(const [owner,task] of [[firstOwner,first],[secondOwner,second]]) window.localStorage.setItem('fabushi-workspace-heartbeat-v1:'+owner,JSON.stringify({ownerTabId:owner,at:Date.now()-180000,autoResume:true,running:true,taskId:task.id,recoveryURL:'https://chatgpt.com/#fabushi-resume='+owner}));
  });
  assert.notEqual(ambiguous.h.getTabId(),firstOwner);
  assert.notEqual(ambiguous.h.getTabId(),secondOwner);
  ambiguous.dom.window.close();
});

test('stalled route hands off once through a fresh document without clearing attachments or dispatch identity',async()=>{
  const {h,w,dom}=await fixture();
  const task={id:'stalled-route',ownerTabId:h.getTabId(),goal:'恢复卡住页面',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/stalled-route',token:'stable-token',attempted:true,attachments:[{id:'clip',name:'卡住证据.png',type:'image/png',size:10,lastModified:1}],messages:[],routeRecoveryAttempts:2,rendererRecoveryExhausted:false};
  h.data.tasks.push(task);
  h.recoverStalledRoute(new w.URL(task.url),task);
  assert.equal(task.workspaceDocumentRecoveryAttempts,1);
  assert.equal(task.rendererRecoveryExhausted,true);
  assert.equal(task.token,'stable-token');
  assert.deepEqual(task.attachments,[{id:'clip',name:'卡住证据.png',type:'image/png',size:10,lastModified:1}]);
  const ticket=JSON.parse(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'));
  assert.equal(ticket.documentRecovery,true);
  assert.equal(ticket.path,'/');
  assert.match(ticket.href,/^https:\/\/chatgpt\.com\/$/);
  h.recoverStalledRoute(new w.URL(task.url),task);
  assert.equal(task.workspaceDocumentRecoveryAttempts,1,'a stalled document cannot create repeated handoffs');
  h.pause();
  dom.window.close();
});

test('active work explicitly requests the host recovery capability without task text or file bytes',async()=>{
  const requests=[];
  const {h,w,dom}=await fixture('',window=>{
    window.addEventListener('message',event=>{
      if(event.data?.source==='fabushi-userscript'&&event.data?.type==='recovery-capability.request') requests.push(event.data);
    });
  });
  const task=h.enqueue('恢复页面后继续处理','once',[{id:'proof',name:'证据.png',type:'image/png',size:12,lastModified:1}]);
  await new Promise(resolve=>w.setTimeout(resolve,0));
  const request=requests.at(-1);
  assert.ok(request);
  assert.equal(request.payload.capability,'tab-recovery');
  assert.equal(request.payload.taskId,task.id);
  assert.equal(request.payload.attachmentIds[0],'proof');
  assert.equal(request.payload.goal,undefined);
  assert.equal(request.payload.prompt,undefined);
  assert.equal(request.payload.file,undefined);
  assert.equal(request.payload.recoveryEligible,true);
  h.releaseHostRecoveryCapability();
  dom.window.close();
});

test('blocked ambiguous send can adopt the only new conversation and resume without a duplicate send',async()=>{
  const {h,w,dom}=await fixture('',window=>window.history.replaceState({},'', '/c/recovered-after-timeout'));
  const task={id:'blocked-ambiguous',ownerTabId:h.getTabId(),goal:'继续执行',mode:'once',phase:'work',round:1,state:'blocked',url:'',token:'same-send-token',attempted:true,sentAt:Date.now()-120000,attachments:[{id:'proof',name:'证据.png',type:'image/png',size:12,lastModified:1}],messages:[{text:'原消息发送结果超过 90 秒仍无法确认'}]};
  h.data.tasks.push(task);
  await h.resumeTask(task);
  assert.equal(task.state,'waiting');
  assert.equal(task.url,'https://chatgpt.com/c/recovered-after-timeout');
  assert.equal(task.token,'same-send-token');
  assert.equal(task.attempted,false);
  assert.deepEqual(JSON.parse(JSON.stringify(task.attachments)),[{id:'proof',name:'证据.png',type:'image/png',size:12,lastModified:1}]);
  h.pause();
  dom.window.close();
});

test('explicit recovery can bind the current unique route even when it was the dispatch origin',async()=>{
  const route='https://chatgpt.com/c/current-recovery-route';
  const {h,w,dom}=await fixture('',window=>window.history.replaceState({},'', '/c/current-recovery-route'));
  const task={id:'blocked-current-route',ownerTabId:h.getTabId(),goal:'继续当前会话',mode:'once',phase:'work',round:1,state:'blocked',url:'',token:'same-send-token',attempted:true,sentAt:Date.now()-120000,dispatchOriginURL:route,attachments:[],messages:[{text:'原消息发送结果超过 90 秒仍无法确认'}]};
  h.data.tasks.push(task);
  await h.resumeTask(task);
  assert.equal(task.state,'waiting');
  assert.equal(task.url,route);
  assert.equal(task.attempted,false);
  assert.equal(task.token,'same-send-token');
  h.pause();
  dom.window.close();
});

test('memory diagnostics identify a bounded JS heap estimate and pressure level',async()=>{
  const gib = 1024 * 1024 * 1024;
  const {h,w,dom}=await fixture('',window=>{
    Object.defineProperty(window.performance,'memory',{configurable:true,value:{
      usedJSHeapSize:1.8 * gib,
      totalJSHeapSize:2.1 * gib,
      jsHeapSizeLimit:4 * gib,
    }});
  });
  const snapshot=h.readMemorySnapshot();
  assert.equal(snapshot.supported,true);
  assert.equal(snapshot.usedBytes,1.8 * gib);
  assert.equal(h.memoryPressureLevel(snapshot),'high');
  assert.match(h.memoryStatusText(),/网页 JS 堆估算/);
  assert.match(h.memoryStatusText(),/高/);
  await h.shutdown?.();
  dom.window.close();
});

test('local memory cleanup bounds task logs without deleting task identity or attachments',async()=>{
  const {h,dom}=await fixture();
  const task=h.enqueue('保留这个目标','once',[{id:'attachment-1',name:'证据.png',type:'image/png',size:10,lastModified:1}]);
  for(let index=0;index<140;index+=1) h.log(task,`${'x'.repeat(10000)}-${index}`,'status');
  assert.ok(task.messages.length<=80);
  assert.ok(task.messages.reduce((sum,item)=>sum+item.text.length,0)<=320000);
  assert.equal(task.goal,'保留这个目标');
  assert.equal(task.attachments[0].id,'attachment-1');
  assert.match(task.messages.at(-1).text,/139$/);
  const result=h.cleanupLocalMemory({reason:'test'});
  assert.equal(result.skipped,false);
  assert.equal(h.data.tasks.some(item=>item.id===task.id),true);
  await h.shutdown?.();
  dom.window.close();
});

test('manual memory cleanup asks the host with redacted bounded diagnostics',async()=>{
  const requests=[];
  const {h,w,dom}=await fixture('',window=>{
    window.addEventListener('message',event=>{
      if(event.data?.source!=='fabushi-userscript'||event.data?.type!=='tab-memory.request') return;
      requests.push(event.data);
      window.setTimeout(()=>window.dispatchEvent(new window.MessageEvent('message',{data:{
        source:'fabushi-extension',
        type:'tab-memory.response',
        requestId:event.data.requestId,
        ok:true,
        result:{ok:true,discarded:false,reason:'active-tab'},
      },source:window})),0);
    });
  });
  const result=await h.requestHostMemoryCleanup({reason:'test-manual',userInitiated:true});
  const request=requests.at(-1);
  assert.ok(request);
  assert.equal(request.pluginId,'chatgpt-auto-confirm');
  assert.equal(request.payload.capability,'tab-memory-discard');
  assert.equal(request.payload.reason,'test-manual');
  assert.equal(request.payload.goal,undefined);
  assert.equal(request.payload.prompt,undefined);
  assert.equal(request.payload.file,undefined);
  assert.equal(request.payload.token,undefined);
  assert.equal(result.reason,'active-tab');
  assert.equal(result.discarded,false);
  await h.shutdown?.();
  dom.window.close();
});

test('blocked ambiguous send remains resumable when no route is visible and keeps its recovery ticket',async()=>{
  const {h,w,dom}=await fixture();
  const task={id:'blocked-no-route',ownerTabId:h.getTabId(),goal:'等待页面恢复',mode:'once',phase:'work',round:1,state:'blocked',url:'',token:'same-send-token',attempted:true,sentAt:Date.now()-120000,attachments:[{id:'proof',name:'证据.png',type:'image/png',size:12,lastModified:1}],messages:[{text:'原消息发送结果超过 90 秒仍无法确认'}]};
  h.data.tasks.push(task);
  await h.resumeTask(task);
  assert.equal(task.state,'sending');
  assert.equal(task.attempted,true);
  assert.equal(task.token,'same-send-token');
  assert.ok(Number(task.recoveryConfirmationStartedAt)>0);
  await h.tick();
  assert.equal(task.state,'sending','the first post-recovery scan must not reuse the expired original send timeout');
  assert.equal(task.attempted,true);
  const heartbeat=JSON.parse(w.localStorage.getItem('fabushi-workspace-heartbeat-v1:'+h.getTabId()));
  assert.equal(heartbeat.taskId,task.id);
  assert.match(heartbeat.recoveryURL,/fabushi-resume=/);
  assert.deepEqual(heartbeat.attachmentIds,['proof']);
  h.pause();
  dom.window.close();
});

test('a navigation permit consumes no local budget until the route change is committed',async()=>{
  const requests=[];
  const navigationRequests=()=>requests.filter(message=>message?.type==='navigation-guard.request');
  const {h,w,dom}=await fixture('',window=>{
    const bridge=message=>{
      requests.push(message);
      window.setTimeout(()=>window.dispatchEvent(new window.MessageEvent('message',{
        source:window,
        data:{
          source:'fabushi-extension',
          type:'navigation-guard.granted',
          requestId:message.requestId,
          granted:true,
          reason:'granted',
          leaseId:'lease-1',
        },
      })),0);
    };
    try { Object.defineProperty(window,'postMessage',{configurable:true,writable:true,value:bridge}); }
    catch { window.postMessage=bridge; }
  });
  const task={id:'guard-task',phase:'review',round:2,goalRevision:7,state:'reviewing',url:'https://chatgpt.com/c/review-route',messages:[]};
  try {
    const pending=h.requestHostNavigationPermit('https://chatgpt.com/c/next-route',task,{reason:'route-switch'});
    await new Promise(resolve=>w.setTimeout(resolve,0));
    assert.equal(navigationRequests().length,1);
    h.settleHostNavigationRequest(navigationRequests()[0].requestId,{granted:true,reason:'granted',leaseId:'lease-1'});
    const granted=await pending;
    assert.equal(granted.granted,true);
    assert.equal(granted.leaseId,'lease-1');
    assert.equal(navigationRequests()[0].payload.capability,'tab-navigation-guard');
    assert.equal(navigationRequests()[0].payload.taskId,'guard-task');
    assert.equal(navigationRequests()[0].payload.phase,'review');
    assert.equal(navigationRequests()[0].payload.round,2);
    assert.equal(navigationRequests()[0].payload.goalRevision,7);
    assert.equal(navigationRequests()[0].pluginId,'chatgpt-auto-confirm');
    assert.equal(navigationRequests()[0].scriptId,'chatgpt-auto-confirm');
    assert.equal(navigationRequests()[0].payload.prompt,undefined);
    const secondGrant=h.requestHostNavigationPermit('https://chatgpt.com/c/another-route',task,{reason:'route-switch'});
    await new Promise(resolve=>w.setTimeout(resolve,0));
    assert.equal(navigationRequests().length,2,'a grant alone must not start the local 30-second cooldown');
    h.settleHostNavigationRequest(navigationRequests()[1].requestId,{granted:true,reason:'granted',leaseId:'lease-2'});
    assert.equal((await secondGrant).granted,true);
    h.rememberNavigationCommit();
    const denied=await h.requestHostNavigationPermit('https://chatgpt.com/c/third-route',task,{reason:'route-switch'});
    assert.equal(denied.granted,false);
    assert.equal(denied.reason,'local-cooldown');
    assert.ok(Number(denied.retryAfterMs)>=29000);
    assert.equal(navigationRequests().length,2);
  } finally {
    h.pause();
    dom.window.close();
  }
});

test('stale navigation leases are cancelled with the canonical plugin identity',async()=>{
  const messages=[];
  const {h,w,dom}=await fixture('',window=>{
    const bridge=message=>messages.push(message);
    try { Object.defineProperty(window,'postMessage',{configurable:true,writable:true,value:bridge}); }
    catch { window.postMessage=bridge; }
  });
  try {
    assert.equal(h.cancelHostNavigationLease('lease-stale','stale-navigation-ticket'),true);
    const cancel=messages.find(message=>message?.type==='navigation-guard.cancel');
    assert.equal(cancel.pluginId,'chatgpt-auto-confirm');
    assert.equal(cancel.scriptId,'chatgpt-auto-confirm');
    assert.equal(cancel.payload.leaseId,'lease-stale');
    assert.equal(cancel.payload.reason,'stale-navigation-ticket');
  } finally {
    w.close();
    dom.window.close();
  }
});

test('root dispatch navigation tickets are bound to the current review generation',async()=>{
  const {h,dom}=await fixture();
  const task={id:'review-dispatch',ownerTabId:h.getTabId(),phase:'review',round:3,goalRevision:9,state:'queued',url:'',attempted:false,messages:[]};
  h.data.tasks.push(task);
  const ticket={task:task.id,path:'/',href:'https://chatgpt.com/',resume:true,direct:true,purpose:'dispatch',phase:'review',round:3,goalRevision:9};
  assert.equal(h.validNavigationTicket(ticket),true);
  assert.equal(h.validNavigationTicket({...ticket,goalRevision:8}),false);
  assert.equal(h.validNavigationTicket({...ticket,phase:'work'}),false);
  assert.equal(h.validNavigationTicket({...ticket,task:'other'}),false);
  dom.window.close();
});

test('the packaged userscript declares its stable remote update and download URLs',()=>{
  assert.match(source,/^\/\/ @version\s+2\.9\.59$/m);
  assert.match(source,/const VERSION = '2\.9\.59'/);
  assert.match(source,/const STALLED_REFRESH_MS = 15 \* 60 \* 1000/);
  assert.match(source,/const ENDED_NO_FINAL_STABILITY_MS = 8000/);
  assert.doesNotMatch(source,/ABNORMAL_NO_FINAL_CONTINUE_AFTER_MS/);
  assert.doesNotMatch(source,/AMBIGUOUS_SEND_REFRESH_MS|AMBIGUOUS_SEND_REFRESH_LIMIT/);
  assert.doesNotMatch(source,/STOP_MISSING_CONTINUE_GRACE_MS|stopMissingSince|stopMissingSignature/);
  assert.doesNotMatch(source,/CONNECTION_INTERRUPTED_REFRESH_COOLDOWN_MS/);
  assert.doesNotMatch(source,/function refreshInterruptedConversation/);
  assert.doesNotMatch(source,/function queuePendingContinuation/);
  assert.doesNotMatch(source,/function attemptPendingContinuation/);
  assert.match(source,/connectionInterruptedFreshDispatch/);
  assert.match(source,/function queueInterruptedFreshRetry/);
  assert.match(source,/connection-interrupted-fresh-chat/);
  assert.match(source,/^\/\/ @updateURL\s+https:\/\/raw\.githubusercontent\.com\/bhrumom\/fabushi-chatgpt-auto-confirm-userscript\/main\/chatgpt-auto-confirm\.user\.js$/m);
  assert.match(source,/^\/\/ @downloadURL\s+https:\/\/raw\.githubusercontent\.com\/bhrumom\/fabushi-chatgpt-auto-confirm-userscript\/main\/chatgpt-auto-confirm\.user\.js$/m);
});

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
  await w.eval(source.replace('  mount();','  window.testHooks = { blocker, rateLimitNotice, sendTimeoutNotice, connectionInterruptedNotice, refreshInterruptedConversation, classify, abnormalEndSince, pageLoadingState, conversationLoading, cards, latestTurn, parseReview, normalizeAttachmentMeta, taskAttachmentSummary, attachmentPrompt, attachmentInputFor, assignFilesToInput, pasteFilesToComposer, attachmentReady, ensureTaskAttachments, retryAttachmentUpload, holdForChatGPTLoading, recoverLegacyAttachmentUploadTimeouts, workPrompt, plannerPrompt, enqueue, start, tick, pause, restorePausedTasks, markTasksPaused, migratePersistedPause, syncRemoteControl, authorize, isConversationScopedAllow, processGlobalApprovalCards, setGlobalAutoApprove, dismissUnexpectedModals, restoreCancelledTask, deleteTask, prepareRecordedConversationOpen, navigate, queueNavigation, directNavigate, recoverStalledRoute, stopAmbiguousSend, noFinalReplyBackoffMs, queueNoFinalReplyRetry, recoverLegacyNavigationFailures, recoverLegacyExhaustedNoFinalReplies, dispatchCooldownRemaining, restForRateLimit, activateControl, editGoal, finish, inspect, send, log, data, measurements, canonicalConversationURL, currentConversationURL, recordConversationURL, recordedConversationURL, captureConversationURL, conversationURLOwner, taskMatchesCurrentConversation, taskHoldsScheduler, nextSupervisionTask, validNavigationTicket, taskBelongsToTab, tabTasks, recoverableWorkspaces, restoreWorkspace, getTabId:()=>tabId, getCurrent:()=>current };\n  mount();'));
  return {w,dom,h:w.testHooks};
}
test('completion requires own final turn, stop absent, no approval and stable completion evidence',async()=>{
  const {h,dom}=await fixture();
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
test('a visible conversation spinner is loading, not an abnormal end',async()=>{
  const {h,w,dom}=await fixture('<main><div class="flex h-full items-center justify-center"><svg class="animate-spin" aria-hidden="true"></svg></div><form><textarea id="prompt-textarea"></textarea></form></main>');
  w.history.pushState({},'', '/c/loading-page');
  assert.equal(h.pageLoadingState(),'ChatGPT 页面正在加载，等待会话内容完全渲染。');
  assert.equal(h.conversationLoading(),true);
  const sample={owned:true,final:false,text:'',sentAt:1,cards:0,stop:false,loading:true,blocker:'',rateLimit:''};
  const previous={text:'',since:1_000,idleSince:1_000,endedAt:1_000,clear:true};
  assert.equal(h.classify(sample,previous,301_000).state,'loading');
  assert.equal(h.abnormalEndSince(sample,previous,301_000),0);
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
test('clearing the loading signal starts a fresh abnormal-end observation',async()=>{
  const {h,w,dom}=await fixture('<main><div id="loader" aria-busy="true"></div></main>');
  w.history.pushState({},'', '/c/loading-transition');
  const loading={owned:true,final:false,text:'',sentAt:1,cards:0,stop:false,loading:true,blocker:'',rateLimit:''};
  const previous={text:'',since:1_000,idleSince:1_000,endedAt:1_000,clear:true};
  assert.equal(h.pageLoadingState(),'ChatGPT 页面正在加载，等待会话内容完全渲染。');
  assert.equal(h.classify(loading,previous,301_000).state,'loading');
  assert.equal(h.abnormalEndSince(loading,previous,301_000),0);
  w.document.querySelector('#loader').remove();
  const loaded={...loading,loading:false,text:'partial answer'};
  const loadingObservation={text:'',since:1_000,idleSince:1_000,endedAt:0,clear:false,loading:true};
  assert.equal(h.pageLoadingState(),'');
  assert.equal(h.classify(loaded,loadingObservation,301_000).state,'waiting');
  assert.equal(h.abnormalEndSince(loaded,loadingObservation,301_000),301_000);
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
test('a lost Stop control with no final answer becomes a recoverable abnormal end',async()=>{
  const {h,dom}=await fixture();
  const previous={text:'partial reply',since:1000,idleSince:1000,clear:true,stop:false,endedAt:1000};
  const sample={owned:true,final:false,text:'partial reply',sentAt:0,cards:0,stop:false};
  assert.equal(h.classify(sample,previous,16_001).state,'no-final-reply');
  assert.equal(h.classify({...sample,cards:1},previous,16_001).state,'approval');
  assert.equal(h.classify({...sample,stop:true},previous,16_001).state,'generating');
  dom.window.close();
});
test('late observation starts the short abnormal-end timer even when Stop already disappeared',async()=>{
  const {h,dom}=await fixture();
  const sample={owned:true,final:false,text:'tool calls only',sentAt:0,cards:0,stop:false,blocker:'',rateLimit:''};
  const started=h.abnormalEndSince(sample,null,1_000);
  assert.equal(started,1_000,'the first clear observation starts the grace period');
  const stable={text:sample.text,idleSince:1_000,endedAt:started,clear:true,stop:false};
  assert.equal(h.abnormalEndSince(sample,stable,3_000),1_000,'stable absence keeps the original timer');
  assert.equal(h.classify(sample,stable,16_001).state,'no-final-reply');
  assert.equal(h.abnormalEndSince({...sample,text:'new partial output'},stable,3_000),3_000,'new text resets the timer');
  assert.equal(h.abnormalEndSince({...sample,stop:true},stable,3_000),0);
  assert.equal(h.abnormalEndSince({...sample,cards:1},stable,3_000),0);
  assert.equal(h.abnormalEndSince({...sample,final:true},stable,3_000),0);
  assert.equal(h.abnormalEndSince({...sample,owned:false},stable,3_000),0);
  assert.equal(h.abnormalEndSince({...sample,blocker:'security verification'},stable,3_000),0);
  assert.equal(h.abnormalEndSince({...sample,rateLimit:'rate limit'},stable,3_000),0);
  dom.window.close();
});
test('connection interruption recovery only recognizes visible ChatGPT page notices',async()=>{
  const page=await fixture('<div role="status">连接已中断。正在等待完整回复。</div>');
  assert.equal(page.h.connectionInterruptedNotice(),true);
  page.dom.window.close();

  const quoted=await fixture('<div data-message-author-role="user">连接已中断。正在等待完整回复。</div>');
  assert.equal(quoted.h.connectionInterruptedNotice(),false,'task transcript must not trigger a refresh');
  const ownNotice=quoted.w.document.createElement('div');
  ownNotice.textContent='连接已中断。正在等待完整回复。';
  quoted.w.document.querySelector('#fabushi-auto-confirm-root').append(ownNotice);
  assert.equal(quoted.h.connectionInterruptedNotice(),false,'workbench logs must not self-trigger');
  quoted.dom.window.close();
});
test('send timeout recovery only recognizes visible page errors',async()=>{
  const page=await fixture('<div role="alert">消息发送超时，请重试。</div>');
  assert.equal(page.h.sendTimeoutNotice(),true);
  page.dom.window.close();

  const quoted=await fixture('<div data-message-author-role="assistant">消息发送超时，请重试。</div>');
  assert.equal(quoted.h.sendTimeoutNotice(),false,'task transcript must not trigger a resend');
  const ownNotice=quoted.w.document.createElement('div');
  ownNotice.textContent='消息发送超时，请重试。';
  quoted.w.document.querySelector('#fabushi-auto-confirm-root').append(ownNotice);
  assert.equal(quoted.h.sendTimeoutNotice(),false,'workbench logs must not self-trigger');
  quoted.dom.window.close();
});
test('inspect turns a page send timeout into a fresh dispatch without waiting for a sidebar',async()=>{
  const {h,w,dom}=await fixture('<div role="alert">消息发送超时，请重试。</div>');
  const task={id:'timeout-inspect',goal:'recover timeout',mode:'once',phase:'work',round:1,state:'waiting',url:'https://chatgpt.com/c/timeout-inspect',token:'old-token',attempted:false,noFinalReplyAttempts:0,messages:[]};
  h.data.tasks.push(task);
  w.history.pushState({},'', '/c/timeout-inspect');
  await h.start();
  await h.inspect(task,null);
  assert.equal(task.state,'queued');
  assert.equal(task.noFinalReplyAttempts,1);
  assert.equal(task.url,'');
  assert.match(task.messages.at(-1).text,/正在新开 Work\/规划会话原样重发/);
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
  assert.equal(h.queueNoFinalReplyRetry(task,'检测到“消息发送超时，请重试”'),'backoff');
  assert.equal(task.state,'waiting');
  assert.equal(task.noFinalReplyAttempts,0);
  assert.equal(task.noFinalReplyRecoveryCycles,1);
  assert.ok(task.noFinalReplyRecoveryUntil>=before+5*60*1000);
  assert.equal(task.url,'');
  assert.match(task.messages.at(-1).text,/不会自动暂停/);
  h.finish(task,'final answer');
  assert.equal(task.state,'done');
  assert.equal(task.noFinalReplyAttempts,0);
  assert.equal(task.noFinalReplyRecoveryCycles,0);
  assert.equal(task.noFinalReplyRecoveryUntil,0);
  dom.window.close();
});
test('fast abnormal retry still queues one fresh conversation before backoff',async()=>{
  const {h,dom}=await fixture();
  const task=h.enqueue('retry once','once');
  Object.assign(task,{state:'waiting',phase:'work',url:'https://chatgpt.com/c/ended',token:'old-token',noFinalReplyAttempts:0});
  assert.equal(h.queueNoFinalReplyRetry(task),'queued');
  assert.equal(task.state,'queued');
  assert.equal(task.noFinalReplyAttempts,1);
  assert.equal(task.noFinalReplyRecoveryUntil,0);
  assert.equal(task.url,'');
  assert.match(task.messages.at(-1).text,/正在新开 Work\/规划会话原样重发/);
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
test('idle runner does not rewrite terminal error records into paused tasks',async()=>{
  const {h,w,dom}=await fixture();
  const task={id:'old-error',goal:'keep visible',mode:'goal',phase:'work',round:1,state:'blocked',url:'https://chatgpt.com/c/old-error',token:'old-token',messages:[]};
  h.data.tasks.push(task);
  await h.start();
  await h.tick();
  assert.equal(task.state,'blocked');
  assert.equal((await w.FabushiUserscript.call('status')).running,false);
  dom.window.close();
});
test('connection interruption refresh is bounded per conversation and preserves identity',async()=>{
  const {h,w,dom}=await fixture();
  const task=h.enqueue('keep this exact task','goal');
  Object.assign(task,{state:'generating',url:'https://chatgpt.com/c/disconnected',token:'owner-token',attempted:false});
  w.history.pushState({},'', '/c/disconnected');
  const first=h.refreshInterruptedConversation(task,false,20_000);
  assert.equal(first,true);
  assert.equal(task.state,'waiting');
  assert.equal(task.url,'https://chatgpt.com/c/disconnected');
  assert.equal(task.token,'owner-token');
  assert.equal(task.attempted,false);
  assert.equal(task.connectionInterruptedRefreshAttempts,1);
  assert.equal(h.refreshInterruptedConversation(task,false,25_000),false,'cooldown prevents a reload loop');
  assert.equal(h.refreshInterruptedConversation(task,false,40_000),true);
  assert.equal(task.connectionInterruptedRefreshAttempts,2);
  assert.equal(h.refreshInterruptedConversation(task,false,60_000),false);
  assert.equal(task.connectionInterruptedRefreshExhausted,true);
  assert.match(task.messages.at(-1).text,/已停止重复刷新/);
  w.history.pushState({},'', '/c/next-conversation');
  task.url='https://chatgpt.com/c/next-conversation';
  assert.equal(h.refreshInterruptedConversation(task,false,80_000),true,'a new durable conversation gets its own bounded recovery budget');
  assert.equal(task.connectionInterruptedRefreshAttempts,1);
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
test('a paused task without a real URL resumes as a fresh queued dispatch',async()=>{
  const {h,dom}=await fixture();
  const task={id:'paused-no-url',goal:'send again safely',state:'paused',pausedState:'blocked',phase:'work',round:1,url:'',token:'stale-token',attempted:true,sendPrepared:true,preparedPrompt:'old prompt',dispatchOriginURL:'https://chatgpt.com/c/old',messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.restorePausedTasks(7),true);
  assert.equal(task.state,'queued');
  assert.equal(task.url,'');
  assert.equal(task.token,'');
  assert.equal(task.attempted,false);
  assert.equal(task.sendPrepared,false);
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
test('cancelled unsent tasks return to the dispatch queue',async()=>{
  const {h,dom}=await fixture();
  const task={id:'cancelled-unsent',goal:'continue me',mode:'goal',phase:'work',round:1,state:'cancelled',url:'',token:'stale',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.restoreCancelledTask(task),true);
  assert.equal(task.state,'queued');
  assert.equal(task.token,'');
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
test('missing sidebar links never create a four-attempt wait loop',async()=>{
  const {h,w,dom}=await fixture();
  const task={id:'nav',state:'queued',messages:[]};
  const target=new w.URL('https://chatgpt.com/c/WEB:not-a-browser-session');
  assert.equal(h.queueNavigation(target,task),false);
  assert.equal(task.state,'blocked');
  assert.equal(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'),null);
  assert.ok(task.messages.some(message=>/没有可用的真实会话链接/.test(message.text)));
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
test('open control is a native link bound to the selected task exact conversation URL',async()=>{
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
  assert.equal(h.data.autoResume,false,'manual open creates a durable scheduler pause barrier');
  assert.equal(w.sessionStorage.getItem('fabushi-workbench-navigation-v2'),null,'stale navigation ticket is discarded');
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
test('synthetic conversation URL stays on the current page without retrying',async()=>{
  const {h,w,dom}=await fixture();
  const task={id:'unverified',goal:'wait',state:'waiting',phase:'work',round:1,url:'https://chatgpt.com/c/WEB:not-in-sidebar',token:'owner',attempted:false,messages:[]};
  h.data.tasks.push(task);
  assert.equal(h.queueNavigation(new w.URL(task.url),task,'会话地址无效'),false);
  assert.equal(w.location.pathname,'/');
  assert.match(task.messages.at(-1).text,/请在任务中保留有效/);
  h.pause();
  dom.window.close();
});
test('ambiguous send timeout preserves token and stops instead of creating another planner',async()=>{
  const {h,w,dom}=await fixture();
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
test('message history is not truncated after eighty entries',async()=>{
  const {h,dom}=await fixture();
  const task={id:'history',goal:'keep history',messages:[],messageVersion:0};
  h.data.tasks.push(task);
  for(let index=0;index<120;index++) h.log(task,`记录 ${index}`);
  assert.equal(task.messages.length,120);
  assert.equal(task.messages[0].text,'记录 0');
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

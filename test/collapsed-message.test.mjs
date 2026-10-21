import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source = readFileSync(new URL('../chatgpt-auto-confirm.user.js', import.meta.url), 'utf8');
async function fixture(body) {
  const dom = new JSDOM(`<main>${body}</main><textarea id="prompt-textarea"></textarea>`, {
    url:'https://chatgpt.com/c/collapsed-message', runScripts:'outside-only', pretendToBeVisual:true,
  });
  const w = dom.window;
  w.Element.prototype.getClientRects = () => [{width:1,height:1}];
  w.navigator.locks = {request:(_n,o,cb)=>Promise.resolve((cb || o)({})),query:()=>Promise.resolve({held:[]})};
  w.eval(source.replace('  mount();', `  window.h = {revealCurrentCollapsedMessage, latestTurn, inspect, tick, data, observations, pause, messageRevealAttempts,
    startTest:()=>{running=true; controller=new AbortController();}, tabId,
    navigationTest:v=>{navigating=v;}, memoryTest:v=>{if(v)hostMemoryPending.set('test',{});else hostMemoryPending.clear();}};
  mount();`));
  await new Promise(resolve => w.setTimeout(resolve,0));
  const h=w.h;
  const task={id:'collapse',ownerTabId:h.tabId,goal:'keep goal',mode:'once',phase:'work',round:7,
    token:'tail-token',url:w.location.href,state:'waiting',attempted:false,attachments:[{name:'keep.txt'}],messages:[]};
  h.data.tasks.push(task); h.startTest();
  return {w,h,task,dom,close:()=>{h.memoryTest(false);h.pause();dom.window.close();}};
}
const user = (body='truncated', button='<button id="expand">显示更多</button>') =>
  `<article><div data-message-author-role="user" data-message-id="user-current">${body}</div>${button}</article>`;

test('lazy user tail is revealed before ownership is read, with task identity preserved',async()=>{
  const f=await fixture(user());const {w,h,task}=f;
  try {
    assert.equal(h.latestTurn(task).owned,false);
    const before=JSON.stringify([task.id,task.phase,task.round,task.url,task.token,task.attempted,task.attachments]);
    h.observations.set(task.id,{final:true});
    let clicks=0;
    w.document.querySelector('#expand').onclick=event=>{clicks++;w.document.querySelector('[data-message-author-role]').append(' [Fabushi:tail-token]');event.target.textContent='收起';};
    assert.equal(h.revealCurrentCollapsedMessage(task),true);
    assert.equal(h.observations.has(task.id),false);
    assert.equal(h.latestTurn(task).owned,true);
    assert.equal(h.revealCurrentCollapsedMessage(task),false);
    assert.equal(clicks,1);
    assert.equal(JSON.stringify([task.id,task.phase,task.round,task.url,task.token,task.attempted,task.attachments]),before);
  } finally {f.close();}
});

test('inspect yields after reveal, then recognizes the freshly mounted assistant final',async()=>{
  const f=await fixture(user('[Fabushi:tail-token]','')+`<article><div data-message-author-role="assistant" data-message-id="reply"><div class="markdown">Partial</div></div><button id="expand">Show more</button></article>`);
  try {
    const {w,h,task}=f;
    w.document.querySelector('#expand').onclick=event=>{w.document.querySelector('.markdown').textContent='Complete reply';event.target.outerHTML='<button aria-label="Copy response"></button>';};
    await h.inspect(task,new w.AbortController().signal);
    assert.equal(h.observations.has(task.id),false,'no classification on the truncated snapshot');
    assert.equal(h.latestTurn(task).text,'Complete reply');
    assert.equal(h.latestTurn(task).final,true);
    assert.equal(task.state,'waiting','reveal never completes work itself');
  } finally {f.close();}
});

test('runner reveals before ambiguous-send marker confirmation and confirms only next pass',async()=>{
  const f=await fixture(user());
  try {
    const {w,h,task}=f;task.attempted=true;task.state='sending';task.sentAt=w.Date.now();
    w.document.querySelector('#expand').onclick=event=>{w.document.querySelector('[data-message-author-role]').append(' [Fabushi:tail-token]');event.target.remove();};
    await h.tick();assert.equal(task.attempted,true,'click is not send acknowledgement');
    await h.tick();assert.equal(task.attempted,false);assert.equal(task.token,'tail-token');
  } finally {f.close();}
});

test('same mounted or remounted unresponsive control is paced and bounded',async()=>{
  const f=await fixture(user());
  try {
    const {w,h,task}=f;let now=100000;w.Date.now=()=>now;let clicks=0;
    const wire=()=>{w.document.querySelector('#expand').onclick=()=>clicks++;};wire();
    assert.equal(h.revealCurrentCollapsedMessage(task),true);assert.equal(clicks,1);
    w.document.querySelector('#expand').outerHTML='<button id="expand">显示更多</button>';wire();
    assert.equal(h.revealCurrentCollapsedMessage(task),true);assert.equal(clicks,1);
    for(let n=0;n<2;n++){now+=15000;assert.equal(h.revealCurrentCollapsedMessage(task),true);}
    now+=15000;assert.equal(h.revealCurrentCollapsedMessage(task),false);assert.equal(clicks,3);
    assert.equal(h.messageRevealAttempts.size,1);
  } finally {f.close();}
});

for (const label of ['顯示更多','展开更多','展開更多','阅读更多','閱讀更多','Read more','See more']) {
  test(`explicit message expansion label: ${label}`,async()=>{
    const f=await fixture(user('tail',`<button id="expand">${label}</button>`));
    try {let clicks=0;f.w.document.querySelector('#expand').onclick=()=>clicks++;assert.equal(f.h.revealCurrentCollapsedMessage(f.task),true);assert.equal(clicks,1);} finally {f.close();}
  });
}
for (const scenario of ['paused','cancelled','blocked','done','foreign route','foreign owner','competing route','competing marker','old own marker','aborted','navigation','host memory','settlement','runner stopped']) {
  test(`does not reveal under ${scenario}`,async()=>{
    const f=await fixture(user());const {h,w,task}=f;
    try {
      let signal;let clicks=0;w.document.querySelector('#expand').onclick=()=>clicks++;
      if(['paused','cancelled','blocked','done'].includes(scenario))task.state=scenario;
      if(scenario==='foreign route')task.url='https://chatgpt.com/c/another';
      if(scenario==='foreign owner')task.ownerTabId='foreign';
      if(scenario==='competing route')h.data.tasks.push({...task,id:'other',token:'other'});
      if(scenario==='competing marker'){h.data.tasks.push({...task,id:'other',url:'https://chatgpt.com/c/another',token:'other'});w.document.querySelector('main').insertAdjacentHTML('afterbegin',user('[Fabushi:other]',''));}
      if(scenario==='old own marker')w.document.querySelector('main').insertAdjacentHTML('afterbegin',user('[Fabushi:tail-token]',''));
      if(scenario==='aborted'){const c=new w.AbortController();c.abort();signal=c.signal;}
      if(scenario==='navigation')h.navigationTest(true);
      if(scenario==='host memory')h.memoryTest(true);
      if(scenario==='runner stopped')h.pause();
      if(scenario==='settlement')Object.assign(task,{approvalSettlementUntil:w.Date.now()+50000,approvalSettlementURL:task.url,approvalSettlementToken:task.token,approvalSettlementPhase:task.phase,approvalSettlementRound:task.round});
      assert.equal(h.revealCurrentCollapsedMessage(task,signal),false);assert.equal(clicks,0);
    } finally {f.close();}
  });
}
for(const control of ['<button>更多</button>','<button>More actions</button>','<button>收起</button>','<button aria-expanded="true">Show more</button>','<button aria-haspopup="menu">Show more</button>','<button disabled>Show more</button>','<a role="button">Show more</a>','<pre><button>Show more</button></pre>','<blockquote><button>Show more</button></blockquote>']) {
  test(`ignores non-message expansion: ${control}`,async()=>{
    const f=await fixture(user('text',control));
    try {assert.equal(f.h.revealCurrentCollapsedMessage(f.task),false);} finally {f.close();}
  });
}

test('shared fallback turn reveals latest user before assistant and ignores historical and sidebar buttons',async()=>{
  const f=await fixture(`<aside><button id="sidebar">Show more</button></aside>`+user('old','<button id="old">Show more</button>')+`<div data-content-search-turn-key="current"><div data-content-search-unit-key="current:user">text<button id="u">显示更多</button></div><div data-content-search-unit-key="current:assistant"><div class="markdown">reply</div><button id="a">Show more</button></div></div>`);
  try {
    const {w,h,task}=f;const clicked=[];
    for(const id of ['sidebar','old','u','a'])w.document.getElementById(id).onclick=e=>{clicked.push(id);e.target.textContent='收起';};
    assert.equal(h.revealCurrentCollapsedMessage(task),true);assert.deepEqual(clicked,['u']);
    assert.equal(h.revealCurrentCollapsedMessage(task),true);assert.deepEqual(clicked,['u','a']);
    assert.equal(h.revealCurrentCollapsedMessage(task),false);
  } finally {f.close();}
});

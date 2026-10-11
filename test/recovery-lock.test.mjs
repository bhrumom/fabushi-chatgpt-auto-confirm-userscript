import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import {JSDOM} from 'jsdom';
const source=await fs.readFile(new URL('../chatgpt-auto-confirm.user.js',import.meta.url),'utf8');

test('explicit recovery keeps its ticket beyond lock timeout and automatically reclaims original owner',async()=>{
 const dom=new JSDOM('<!doctype html><html><body><textarea id="prompt-textarea"></textarea></body></html>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://chatgpt.com/c/lock-recovery#fabushi-resume=lock-ticket'});
 const w=dom.window;
 w.Element.prototype.getClientRects=()=>[{width:1,height:1}];
 const task={id:'original-task',ownerTabId:'original-owner',goal:'keep paused',mode:'once',phase:'work',round:8,state:'paused',paused:true,url:'https://chatgpt.com/c/lock-recovery',token:'original-token',attempted:false,attachments:[],messages:[]};
 const serialized=JSON.stringify({tasks:[task],tabControls:{'original-owner':{autoResume:false}},selectedByTab:{'original-owner':task.id}});
 w.localStorage.setItem('fabushi-workbench-v2',serialized);
 w.localStorage.setItem('fabushi-workspace-recovery-v1:lock-ticket',JSON.stringify({ownerTabId:'original-owner',taskId:task.id,url:task.url,at:Date.now(),auto:true}));
 let available=false; const owners=[];
 w.navigator.locks={request:async(name,options,cb)=>{owners.push(name);return cb(available?{}:null);},query:async()=>({held:[]})};
 const instrumented=source.replace('  mount();','  window.recoveryTest={tabId,data};\n  mount();');
 try {
   const boot=w.eval(instrumented);
   await new Promise(r=>setTimeout(r,5300));
   assert.ok(w.localStorage.getItem('fabushi-workspace-recovery-v1:lock-ticket'));
   assert.equal(w.localStorage.getItem('fabushi-workbench-v2'),serialized);
   assert.equal(w.document.querySelector('#fabushi-auto-confirm-root'),null,'no empty independent workspace');
   assert.match(w.document.querySelector('#fabushi-auto-confirm-startup-error').textContent,/自动恢复/);
   available=true;
   await Promise.race([boot,new Promise((_,reject)=>setTimeout(()=>reject(new Error('recovery did not retry automatically')),4000))]);
   assert.equal(w.recoveryTest.tabId,'original-owner');
   assert.equal(w.recoveryTest.data.tasks[0].id,task.id);
   assert.equal(w.recoveryTest.data.tasks[0].state,'paused');
   assert.equal(w.recoveryTest.data.tasks[0].round,8);
   assert.equal(w.recoveryTest.data.tasks[0].token,'original-token');
   assert.equal(w.localStorage.getItem('fabushi-workspace-recovery-v1:lock-ticket'),null);
   assert.equal(w.location.hash,'');
   assert.ok(owners.every(name=>name.endsWith('original-owner')));
 } finally {dom.window.close();}
});

for (const scenario of ['unique','ambiguous','paused','live-owner','other-session-task','historical-route']) test(`ticketless exact-route recovery: ${scenario}`,async()=>{
 const dom=new JSDOM('<!doctype html><html><body><textarea id="prompt-textarea"></textarea><button aria-label="停止生成"></button></body></html>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://chatgpt.com/c/exact-recovered'});
 const w=dom.window; w.Element.prototype.getClientRects=()=>[{width:1,height:1}];
 w.navigator.locks={request:async(name,options,cb)=>cb({}),query:async()=>({held:[]})};
 const task={id:'saved-task',ownerTabId:'saved-owner',goal:'keep goal',mode:'once',phase:'work',round:9,state:scenario==='paused'?'paused':'waiting',url:scenario==='historical-route'?'https://chatgpt.com/c/other':'https://chatgpt.com/c/exact-recovered',sessionUrls:['https://chatgpt.com/c/exact-recovered'],token:'saved-token',attempted:false,attachments:[],messages:[]};
 const tasks=[task]; if(scenario==='ambiguous')tasks.push({...task,id:'second-task',ownerTabId:'saved-owner'});
 if(scenario==='other-session-task'){w.sessionStorage.setItem('fabushi-workbench-tab-session-v1','session-owner');tasks.push({...task,id:'session-task',ownerTabId:'session-owner',state:'paused'});}
 w.localStorage.setItem('fabushi-workbench-v2',JSON.stringify({tasks,selectedByTab:{'saved-owner':task.id},tabControls:{'saved-owner':{autoResume:scenario!=='paused'}}}));
 w.localStorage.setItem('fabushi-workspace-heartbeat-v1:saved-owner',JSON.stringify({at:Date.now()-(scenario==='live-owner'?0:150000),autoResume:scenario!=='paused'}));
 try {
 await w.eval(source.replace('  mount();','  window.recoveryTest={tabId,data};\n  mount();'));
 assert.ok(w.recoveryTest,'bootstrap completed');
 if(scenario==='unique'){
  assert.equal(w.recoveryTest.tabId,'saved-owner');
  assert.equal(w.recoveryTest.data.tasks[0].round,9);
  assert.equal(w.recoveryTest.data.tasks[0].token,'saved-token');
  assert.ok(w.recoveryTest.data.tasks[0].recoveredFinalIdentity,'real automatic restore armed reply identity');
 }else assert.notEqual(w.recoveryTest.tabId,'saved-owner','unsafe route is never adopted');
 }finally{dom.window.close();}
});

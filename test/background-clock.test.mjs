import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../src/background-clock.js',import.meta.url),'utf8');
function fixture(hidden=true){
 let now=1000, sequence=0, wake=0; const timers=new Map(), messages=[]; let listener;
 const page={document:{hidden},crypto:{randomUUID:()=>String(++sequence)},setTimeout:fn=>{const id=++sequence;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),postMessage:m=>messages.push(m),addEventListener:(_,fn)=>listener=fn,removeEventListener:()=>listener=null};
 const context=vm.createContext({Date:{now:()=>now},Map,page});
 vm.runInContext(source+';globalThis.clock=createBackgroundClock(page,{onWake:()=>page.wake()});',context); page.wake=()=>wake++;
 return {clock:context.clock,messages,timers,advance:ms=>now+=ms,receive:m=>listener?.({source:page,data:{source:'fabushi-extension',...m}}),wakes:()=>wake};
}
test('host response progresses a hidden page with withheld native timers exactly once',()=>{
 const f=fixture();let calls=0;f.clock.setTimeout(()=>calls++,100); const request=f.messages[0];
 f.receive({type:'background-clock.response',ok:true,requestId:request.requestId});assert.equal(calls,0);
 f.advance(100);f.receive({type:'background-clock.response',ok:true,requestId:request.requestId});f.receive({type:'background-clock.response',ok:true,requestId:request.requestId});assert.equal(calls,1);assert.equal(f.timers.size,0);
});
test('alarm flushes overdue waits without shortening deadlines and invokes runner wake',()=>{
 const f=fixture();let calls=0;f.clock.setTimeout(()=>calls++,100);f.receive({type:'background-wake'});assert.equal(calls,0);f.advance(100);f.receive({type:'background-wake'});assert.equal(calls,1);assert.equal(f.wakes(),2);
});
test('cancel and shutdown prevent late host replies or wake callbacks',()=>{
 const f=fixture();let calls=0;const id=f.clock.setTimeout(()=>calls++,10);f.clock.clearTimeout(id);f.advance(20);f.receive({type:'background-wake'});assert.equal(calls,0);f.clock.setTimeout(()=>calls++,10);f.clock.dispose();f.advance(20);f.receive({type:'background-wake'});assert.equal(calls,0);assert.equal(f.timers.size,0);
});
test('visible pages and missing host retain native fallback',()=>{
 for(const hidden of [false,true]){const f=fixture(hidden);let calls=0;f.clock.setTimeout(()=>calls++,10);assert.equal(f.messages.length,hidden?1:0);[...f.timers.values()][0]();assert.equal(calls,1);}
});

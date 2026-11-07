// 実ネットワークは使わず、Route Handler・UIを専用データと応答で実行する。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../frontend/node_modules/typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks={}, globals={}) {
  const js=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports={};
  const context={exports,require:n=>{if(n in mocks)return mocks[n];throw Error('Unexpected import: '+n)},Request,Response,AbortSignal,console,...globals};
  vm.runInNewContext(js,context,{filename:file});return exports;
}
const id='11111111-1111-4111-8111-111111111111';
const team='22222222-2222-4222-8222-222222222222';
const minute={id,team_id:team,title:'専用議事録',content:'専用本文',meeting_at:'2026-10-26T15:30:00Z'};
function route({session=true,status=200,data=minute,secret='test-only',ragStatus=200,ragData={success:true,minuteId:id},broken=false}={}){
 const calls=[];
 const {POST}=load('frontend/app/api/minutes/rag-retry/route.ts',{
  'next/headers':{cookies:async()=>({get:()=>session?{value:'test-session'}:undefined})},
  'next/server':{NextResponse:Response},
 },{process:{env:{RAG_INGEST_SECRET:secret}},fetch:async(url,options)=>{
  calls.push({url,options});if(broken)throw Error('test connection failure');
  return calls.length===1?Response.json(data,{status}):Response.json(ragData,{status:ragStatus});
 }});
 return {calls,send:body=>POST(new Request('http://test/api/minutes/rag-retry',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}))};
}
test('success uses stored data, JST date, no save/confirm and never forwards session to Mastra',async()=>{
 const r=route();assert.equal((await r.send({minuteId:id,teamId:'attacker',content:'attacker'})).status,200);
 assert.equal(r.calls.length,2);
 assert.match(r.calls[0].url,/\/api\/minutes\//);assert.equal(r.calls[0].options.method,undefined);
 const call=r.calls[1];const body=JSON.parse(call.options.body);
 assert.equal(body.teamId,team);assert.equal(body.content,minute.content);assert.equal(body.meetingAt,'2026-10-27');
 assert.equal(call.options.headers.Cookie,undefined);assert.equal(call.options.headers['x-rag-ingest-secret'],'test-only');
});
test('no session and malformed input never reach upstream',async()=>{
 let r=route({session:false});assert.equal((await r.send({minuteId:id})).status,401);assert.equal(r.calls.length,0);
 for(const b of ['{',{}, {minuteId:'bad'},null]){r=route();assert.equal((await r.send(b)).status,400);assert.equal(r.calls.length,0);}
});
test('auth, team and unconfirmed rejections never call Mastra',async()=>{
 for(const status of [401,403,404,409,500]){const r=route({status});assert.equal((await r.send({minuteId:id})).status,status===500?502:status);assert.equal(r.calls.length,1);}
});
test('invalid DB data and missing secret do not call Mastra',async()=>{
 for(const data of [{...minute,id:team},{...minute,content:''},{...minute,meeting_at:'invalid'},{...minute,meeting_at:'2026-10-27T00:30:00'}]){
 const r=route({data});assert.equal((await r.send({minuteId:id})).status,502);assert.equal(r.calls.length,1);}
 const r=route({secret:''});assert.equal((await r.send({minuteId:id})).status,503);assert.equal(r.calls.length,1);
});
test('Mastra errors and malformed success are not reported as success',async()=>{
 for(const opts of [{ragStatus:500},{ragData:{success:false}},{ragData:{success:true,minuteId:team}},{broken:true}]){
 const r=route(opts);assert.equal((await r.send({minuteId:id})).status,502);}
});
function harness(file, mocks={}, globals={}){
 const state=[];const refs=[];let cursor=0,ri=0;
 const react={useState:init=>{const i=cursor++;if(!(i in state))state[i]=init;return[state[i],v=>{state[i]=typeof v==='function'?v(state[i]):v}]},useRef:init=>{const i=ri++;return refs[i]??=( {current:init})}};
 const jsx=(type,props,key)=>({type,props:props??{},key});
 const mod=load(file,{'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},...mocks},globals);
 return {render:(name,props)=>{cursor=0;ri=0;return mod[name](props)}};
}
function nodes(n,predicate){if(!n||typeof n!=='object')return[];const a=Array.isArray(n)?n:[n.props?.children];return [...(!Array.isArray(n)&&predicate(n)?[n]:[]),...a.flatMap(x=>nodes(x,predicate))];}
test('retry button prevents rapid double submission, allows retry after failure, shows success',async()=>{
 const h=harness('frontend/components/rag-retry-button.tsx');let done,count=0;
 const props={minuteId:id,onRetry:()=>{count++;return new Promise((resolve,reject)=>{done={resolve,reject}})}};
 const render=()=>h.render('RagRetryButton',props);
 let button=nodes(render(),n=>n.type==='button')[0];const pending=button.props.onClick();await button.props.onClick();assert.equal(count,1);
 assert.equal(nodes(render(),n=>n.type==='button')[0].props.disabled,true);
 done.reject(Error('test failure'));await pending;assert.equal(nodes(render(),n=>n.props.role==='alert').length,1);
 button=nodes(render(),n=>n.type==='button')[0];const next=button.props.onClick();done.resolve();await next;
 assert.equal(count,2);assert.equal(nodes(render(),n=>n.type==='button').length,0);
});
test('client maps authorization errors without exposing backend details',async()=>{
 for(const status of [401,403,404,409,502]){
 const {retryMinuteRag}=load('frontend/lib/rag-retry.ts',{}, {fetch:async()=>Response.json({error:'private details'},{status})});
 await assert.rejects(retryMinuteRag(id),e=>!e.message.includes('private details'));
 }
});

test('minutes screen keeps saved ID, only shows retry after RAG failure and resets without a second save',async()=>{
 for(const failed of [true,false]){
  const calls=[];let release;
  const Button=()=>null;
  const h=harness('frontend/components/minutes/minutes-editor.tsx',{
   '../rag-retry-button':{RagRetryButton:Button},
   '../../lib/rag-retry':{retryMinuteRag:()=>new Promise(resolve=>{release=resolve})},
   './extraction-editor':{ExtractionEditor:()=>null},
  },{fetch:async(url,opts)=>{calls.push(url);return Response.json(url.includes('extract')?{summary3:['test'],decisions:[],undecided:[],todos:[]}:{minuteId:id,ragStatus:failed?'failed':'success',warning:'test failure'});}});
  const render=()=>h.render('MinutesEditor');
  let tree=render();const inputs=nodes(tree,n=>n.type==='input');
  inputs[0].props.onChange({target:{value:'専用タイトル'}});inputs[1].props.onChange({target:{value:'2026-10-27T00:30'}});
  nodes(tree,n=>n.type==='textarea')[0].props.onChange({target:{value:'専用本文'}});
  await nodes(render(),n=>n.type==='button'&&n.props.children==='AI で整理する')[0].props.onClick();
  await nodes(render(),n=>n.type==='button'&&n.props.children==='③ 保存する')[0].props.onClick();
  const buttons=nodes(render(),n=>n.type===Button);assert.equal(buttons.length,failed?1:0);
  if(failed){assert.equal(buttons[0].props.minuteId,id);const retry=buttons[0].props.onRetry(id);
   assert.equal(nodes(render(),n=>n.type==='button'&&n.props.children==='新しい議事録を入れる')[0].props.disabled,true);
   release();await retry;
  }
  nodes(render(),n=>n.type==='button'&&n.props.children==='新しい議事録を入れる')[0].props.onClick();
  assert.equal(nodes(render(),n=>n.type===Button).length,0);
  assert.equal(calls.filter(x=>x.includes('/save')).length,1);
 }
});

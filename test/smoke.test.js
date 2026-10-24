const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const port = 3317 + Math.floor(Math.random()*500);
const base = `http://127.0.0.1:${port}`;
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(),'wbcrm-test-'));
let child;
async function waitForServer(){for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/health');if(r.ok)return;}catch(_){}await new Promise(r=>setTimeout(r,150));}throw new Error('Server did not start');}
async function request(url,opts={},cookie=''){const headers={...(opts.headers||{})};if(cookie)headers.cookie=cookie;if(opts.body&&!headers['content-type'])headers['content-type']='application/json';const r=await fetch(base+url,{...opts,headers,redirect:'manual'});const text=await r.text();let body={};try{body=JSON.parse(text)}catch(_){}const setCookie=r.headers.get('set-cookie');return {status:r.status,body,cookie:setCookie?setCookie.split(';')[0]:cookie};}
test('CRM smoke tests', async t=>{
 child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,NODE_ENV:'test',PORT:String(port),DATA_DIR:dataDir,SESSION_SECRET:'test-secret-not-for-production-1234567890'},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
 await waitForServer();
 await t.test('health endpoint responds',async()=>{const r=await request('/api/health');assert.equal(r.status,200);assert.equal(r.body.ok,true);});
 let c1='',c2='',leadId;
 await t.test('workspace registration creates admin session',async()=>{const r=await request('/api/register',{method:'POST',body:JSON.stringify({company_name:'Company Alpha',name:'Alpha Admin',email:'alpha@example.com',password:'StrongPass123!'})});assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(r.body.user.role,'admin');c1=r.cookie;assert.ok(c1);});
 await t.test('admin creates a lead and can read it',async()=>{const r=await request('/api/leads',{method:'POST',body:JSON.stringify({customer_name:'Test Customer',phone:'+911234567890',source:'Test',message:'hello'})},c1);assert.equal(r.status,201,JSON.stringify(r.body));leadId=r.body.id;const list=await request('/api/leads?filter=available',{},c1);assert.ok(list.body.leads.some(l=>l.id===leadId));});
 await t.test('CSV import accepts valid rows',async()=>{const r=await request('/api/import.csv',{method:'POST',body:JSON.stringify({csv:'Customer Name,Phone,Source,Message\nCSV Customer,9876543210,Website,Demo'})},c1);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.added,1);});
 await t.test('separate workspace cannot see another workspace leads',async()=>{const r=await request('/api/register',{method:'POST',body:JSON.stringify({company_name:'Company Beta',name:'Beta Admin',email:'beta@example.com',password:'StrongPass456!'})});assert.equal(r.status,201,JSON.stringify(r.body));c2=r.cookie;const list=await request('/api/leads?filter=available',{},c2);assert.equal(list.status,200);assert.equal(list.body.leads.length,0);});
 await t.test('anonymous requests cannot read leads',async()=>{const r=await request('/api/leads');assert.equal(r.status,401);});
 if(child&&child.exitCode!==null)throw new Error('Server exited unexpectedly: '+logs);
});
after(()=>{if(child&&!child.killed)child.kill('SIGTERM');try{fs.rmSync(dataDir,{recursive:true,force:true});}catch(_){}});

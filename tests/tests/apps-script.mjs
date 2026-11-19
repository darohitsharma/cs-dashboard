import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const properties=new Map([['ADMIN_EMAIL','owner@example.org'],['ALLOWED_DOMAIN','example.org']]);
let active='viewer@example.org';let opens=0;
const sheets=new Map();
class Sheet {
 constructor(rows=[]){this.rows=rows;}
 getDataRange(){return {getValues:()=>this.rows};}
 getLastRow(){return this.rows.length;}
 appendRow(r){this.rows.push(r);return this;}
 deleteRow(r){this.rows.splice(r-1,1);}
 deleteRows(r,n){this.rows.splice(r-1,n);}
 getRange(r,c,n=1,w=1){return {getValues:()=>Array.from({length:n},(_,i)=>Array.from({length:w},(_,j)=>this.rows[r+i-1]?.[c+j-1]??'')),getValue:()=>this.rows[r-1]?.[c-1],setValues:values=>values.forEach((row,i)=>row.forEach((v,j)=>{this.rows[r+i-1]??=[];this.rows[r+i-1][c+j-1]=v;}))};}
}
sheets.set('Viewers',new Sheet([['email'],['viewer@example.org']]));sheets.set('Blocked',new Sheet([['email']]));sheets.set('Log',new Sheet([['ts','email','event','detail']]));
const store={getSheetByName:n=>sheets.get(n)||null,insertSheet:n=>{const sh=new Sheet();sheets.set(n,sh);return sh;}};
const context=vm.createContext({console,Date,JSON,Utilities:{formatDate:()=> '1 Jan 2026, 1:00 pm'},Session:{getActiveUser:()=>({getEmail:()=>active})},PropertiesService:{getScriptProperties:()=>({getProperty:k=>properties.get(k)||null,setProperty:(k,v)=>properties.set(k,v)})},SpreadsheetApp:{openById:id=>{opens++;assert.equal(id,'private-store');return store;}},MailApp:{sendEmail:()=>{throw Error('No real mail permitted in fixtures');}}});
properties.set('STORE_ID','private-store');
for(const name of ['Code.gs','CompetitorServer.gs','Charts.gs'])vm.runInContext(fs.readFileSync(new URL('../apps-script/'+name,import.meta.url),'utf8'),context);
let checks=0;const ok=(value,label)=>{checks++;assert.ok(value,label);};
ok(context.isDomainEmail_('viewer@example.org'),'exact domain');ok(!context.isDomainEmail_('viewer@example.org.evil.invalid'),'reject suffix');ok(!context.isDomainEmail_(''),'blank identity');properties.delete('ALLOWED_DOMAIN');ok(!context.isDomainEmail_('viewer@example.org'),'unconfigured denies');properties.set('ALLOWED_DOMAIN','example.org');
ok(context.isViewer_(active),'listed viewer');active='';ok(!context.isViewer_(active),'blank viewer denied');assert.throws(()=>context.loadAll(),/No access/);checks++;
active='viewer@example.org';assert.throws(()=>context.adminRefreshData(),/Admin only/);checks++;assert.throws(()=>context.adminRefreshCompetitor(),/Admin only/);checks++;
sheets.get('Blocked').appendRow(['removed@example.org']);ok(!context.grantAutoAccess_('removed@example.org'),'blocked no auto enrol');ok(!context.grantAutoAccess_('outside@elsewhere.org'),'outside no auto enrol');ok(context.grantAutoAccess_('new@example.org'),'configured domain enrol');
ok(!context.emailsEnabled_(),'access notifications off');ok(!context.assignmentEmailsEnabled_(),'assignment notifications off');assert.throws(()=>context.compSheetId_(),/COMP_SHEET_ID/);checks++;
const snapshot={summary:{meta:{}},themes:{},insights:{}};context.writeSnapshot_(snapshot);opens=0;const saved=context.loadAll();ok(!!saved.summary,'saved aggregate load');ok(opens>0,'saved private store read');
const large={text:'x'.repeat(110000)};context.writeSnapshot_(large);ok(context.readSnapshot_().pack.text===large.text,'multi-chunk snapshot round trip');
sheets.get('Viewers').rows=[['email']];assert.throws(()=>context.loadAll(),/No access/);checks++;
// Static guard checks supplement mocked runtime checks, not live deployment proof.
const code=fs.readFileSync(new URL('../apps-script/Code.gs',import.meta.url),'utf8');
ok(code.includes("filter((t) => t.getHandlerFunction() === 'purgeOldLogs_')"),'setup preserves unrelated triggers');
ok(!code.includes('getEffectiveUser().getEmail() ||'),'no deployer fallback for viewer identity');
console.log(`Apps Script template: ${checks} synthetic checks passed. No external service calls.`);

function sourceChartSnapshotSheet_() {
  const ss=storeSheet_();
  return ss.getSheetByName('ChartSnapshot') || ss.insertSheet('ChartSnapshot');
}
function loadSheetCharts() {
  if (!isViewer_(userEmail_())) throw new Error('No access.');
  const sh=storeSheet_().getSheetByName('ChartSnapshot');
  return sh ? readSnapshot_(sh) : null;
}
function adminRefreshSheetCharts() {
  requireAdmin_();
  const pack=readSheetChartTables_();
  const savedAt=writeSnapshot_(pack,sourceChartSnapshotSheet_());
  logEvent_(userEmail_(),'data_refresh','saved Summary/pivot chart tables');
  return {savedAt:savedAt,count:pack.charts.length};
}
function readSheetChartTables_() {
  const ss=SpreadsheetApp.openById(sheetId_());
  const sh=ss.getSheetByName('Summary');
  if(!sh) throw new Error('Summary tab missing. Previous charts kept.');
  const v=sh.getDataRange().getValues();
  const display=sh.getDataRange().getDisplayValues();
  const cell=(r,c)=>v[r-1]&&v[r-1][c-1];
  const txt=(r,c)=>String(display[r-1]&&display[r-1][c-1]||'').trim();
  const num=(r,c)=>Number(cell(r,c))||0;
  const anchors=[[9,3,'Monthly Query Movement'],[35,3,'Primary Intent Classification'],[46,3,'Product Related Queries - Classification'],[65,2,'Product Recommendation Queries - Classification'],[134,2,'Category X Concern Division - (Top 75% Concerns)'],[842,2,'Super Category X Secondary Intent'],[854,1,'First Intent by Category'],[854,10,'Secondary Intent by Category']];
  anchors.forEach(a=>{if(txt(a[0],a[1])!==a[2]) throw new Error('Summary layout changed near row '+a[0]+'. Previous charts kept; update source-table mapping.');});
  const charts=[];
  const add=(id,title,source,labels,series,unit,note)=>charts.push({id:id,title:title,source:source,labels:labels,series:series,unit:unit||'queries',note:note||''});
  const rows=(a,b)=>Array.from({length:b-a+1},(_,i)=>a+i);
  const months=rows(11,31).map(r=>txt(r,3));
  add('monthly','Monthly query movement','Summary!C9:F32',months,[{name:'Queries',values:rows(11,31).map(r=>num(r,4))}]);
  add('status','Existing vs opportunity - sheet labels','Summary!I12:K17',rows(14,16).map(r=>txt(r,9)),[{name:'Queries',values:rows(14,16).map(r=>num(r,10))}],'queries','These are the Sheet\'s existing/opportunity labels, not verified unmet demand. Untagged queries remain visible.');
  const mcols=[];for(let c=4;c<=sh.getLastColumn();c++) if(/^[A-Z][a-z]{2}-\d{4}$/.test(txt(36,c))) mcols.push(c);
  if(mcols.length!==months.length) throw new Error('Summary month columns changed. Previous charts kept.');
  const monthlySeries=(a,b,labelcol,skip)=>rows(a,b).filter(r=>txt(r,labelcol)&&!skip.test(txt(r,labelcol))).map(r=>({name:txt(r,labelcol),values:mcols.map(c=>num(r,c))}));
  add('primary','Primary intent classification','Summary!C35:AU42',months,monthlySeries(37,41,3,/Total$/));
  add('secondary','Product-related query classification','Summary!C46:AU61',months,monthlySeries(48,60,3,/Total$/),'queries','All secondary-intent rows are available in the series selector, including small groups.');
  let status='';const cats=[];
  for(let r=67;r<=123;r++) {if(txt(r,2)) status=txt(r,2);if(txt(r,3)) cats.push({name:status+' / '+txt(r,3),values:mcols.map(c=>num(r,c))});else if(/Total$|Untagged/.test(status))cats.push({name:status,values:mcols.map(c=>num(r,c))});}
  add('categories','Product category classification','Summary!B65:AU124',months,cats,'queries','The heading says Product Recommendation; its Grand Total equals all queries in the Sheet. Values are copied as-is, not treated as a recommendation-only base. Total rows are selectable, not added to the category rows.');
  let category='';const cq=[];const quarters=rows(5,11).map(c=>txt(135,c));
  for(let r=136;r<=826;r++){if(txt(r,3))category=txt(r,3);if(txt(r,4))cq.push({name:category+' / '+txt(r,4),values:rows(5,11).map(c=>num(r,c))});else if(/ Total$/.test(category))cq.push({name:category,values:rows(5,11).map(c=>num(r,c))});}
  add('category-concern','Category x concern, by quarter','Summary!C134:L827',quarters,cq,'queries','Uses the Sheet\'s existing Top 75% Concerns table exactly, including its included/excluded choices. Category totals are separately selectable and are not sums of only the displayed concerns.');
  add('super','Super category x secondary intent','Summary!B842:P850',rows(3,15).map(c=>txt(843,c)),rows(844,849).map(r=>({name:txt(r,2),values:rows(3,15).map(c=>num(r,c)*100)})),'percent','Each secondary-intent column sums to 100% across super categories. This is the share within each secondary intent, not within a super category. Overall source table; unaffected by the period and Number / % switches above.');
  add('category-primary','Primary intent by category','Summary!A854:G911',rows(2,6).map(c=>txt(855,c)),rows(856,909).map(r=>({name:txt(r,1),values:rows(2,6).map(c=>num(r,c)*100)})).filter(x=>x.name),'percent','Values are percentages of all queries, as in the Sheet. A category\'s bars need not sum to 100%. Overall source table; unaffected by the period and Number / % switches above.');
  const secCols=[];for(let c=11;c<=sh.getLastColumn();c++){if(txt(855,c)==='Grand Total')break;if(txt(855,c))secCols.push(c);}
  add('category-secondary','Secondary intent by category','Summary!J854:X911',secCols.map(c=>txt(855,c)),rows(856,909).map(r=>({name:txt(r,10),values:secCols.map(c=>num(r,c)*100)})).filter(x=>x.name),'percent','Values are percentages of Product Related queries, as in the Sheet. A category\'s bars need not sum to 100%. Overall source table; unaffected by the period and Number / % switches above.');
  const pv=ss.getSheetByName('Summary-pivot-1');
  if(!pv)throw new Error('Summary-pivot-1 missing. Previous charts kept.');
  const concerns=pv.getRange('O3:Q29').getValues();
  add('concerns','All concern labels in the pivot','Summary-pivot-1!O2:Q29',concerns.filter(r=>r[0]&&r[0]!=='Grand Total').map(r=>String(r[0])),[{name:'Queries',values:concerns.filter(r=>r[0]&&r[0]!=='Grand Total').map(r=>Number(r[1])||0)}],'queries','Includes Others and Generic Concern. Source pivot and Summary totals may differ; validate their bases before comparing them. Overall source table; unaffected by the period and Number / % switches above.');
  const inventory=ss.getSheets().map(s=>({sheet:s.getName(),hidden:s.isSheetHidden(),charts:s.getCharts().length,images:s.getImages().length}));
  return {charts:charts,inventory:inventory,note:'Graphs built from Summary and pivot tables. Review embedded objects separately if your workbook uses them. Source-table graphs keep their own full period; the controls above apply to the dashboard graphs only.'};
}

"use strict";
(function(root){
 const ratio=(a,b)=>b>0?a/b*100:null;
 function series(history,key){
  if(history?.version!==1||!Array.isArray(history.samples))return [];
  return history.samples.flatMap(sample=>{
   const c=sample.counts,time=Date.parse(sample.at);
   if(!Number.isFinite(time)||!c||['matches','points','methods','excluded'].some(k=>!Number.isSafeInteger(c[k])||c[k]<0)||c.points>c.matches||c.methods>c.matches)return [];
   const denominator=key==='accepted'?c.matches+c.excluded:c.matches,numerator=key==='accepted'?c.matches:c[key];
   return Number.isSafeInteger(numerator)?[{at:sample.at,time,value:ratio(numerator,denominator),numerator,denominator}]:[];
  }).sort((a,b)=>a.time-b.time);
 }
 function bounds(points){
  const values=points.map(p=>p.value).filter(n=>n!==null);
  if(!values.length)return [0,100];
  const min=Math.min(...values),max=Math.max(...values),pad=max-min<0.00001?2:Math.max(0.01,(max-min)*0.2);
  return [Math.max(0,Math.floor((min-pad)*100)/100),Math.min(100,Math.ceil((max+pad)*100)/100)];
 }
 function dayParts(at){return Object.fromEntries(new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'numeric',year:'numeric',timeZone:'Europe/Helsinki'}).formatToParts(new Date(at)).map(p=>[p.type,p.value]));}
 function shortDate(at){const p=dayParts(at);return Number(p.day)+'.'+Number(p.month)+'.';}
 function daily(points){
  const days=new Map();
  for(const point of [...points].sort((a,b)=>a.time-b.time)){const p=dayParts(point.at),day=p.year+'-'+p.month.padStart(2,'0')+'-'+p.day.padStart(2,'0');days.set(day,{...point,day});}
  return [...days.values()];
 }
 const api={series,bounds,shortDate,daily};if(typeof module==='object'&&module.exports){module.exports=api;return;}
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const lang=()=>({fi:'fi-FI',en:'en-GB',sv:'sv-SE'}[root.PAINI_I18N?.language]||'fi-FI');
 const number=n=>n===null?'—':n.toLocaleString(lang(),{maximumFractionDigits:2})+' %';
 const date=shortDate;
 function svgElement(tag,attributes,text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attributes))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
 function render(parent,history,key,label){
  const points=daily(series(history,key)),known=points.filter(p=>p.value!==null);
  if(!known.length){parent.append(node('p','Ei tallennettuja mittauspisteitä.','hint'));return;}
  const [low,high]=bounds(points),first=Date.parse(points[0].day),last=Date.parse(points.at(-1).day);
  const width=Math.max(400,points.length*60);
  const x=p=>first===last?width/2:70+(Date.parse(p.day)-first)/(last-first)*(width-96),y=value=>130-(value-low)/(high-low)*106;
  const svg=svgElement('svg',{viewBox:'0 0 '+width+' 178',class:'coverage-line-chart',role:'img','aria-label':label});
  for(const value of [high,(low+high)/2,low]){svg.append(svgElement('line',{x1:70,x2:width-26,y1:y(value),y2:y(value),class:'coverage-gridline'}),svgElement('text',{x:62,y:y(value)+4,'text-anchor':'end',class:'coverage-axis'},number(value)));}
  let path='',connected=false;
  for(const p of points){if(p.value===null){connected=false;continue;}path+=(connected?'L':'M')+x(p)+','+y(p.value);connected=true;}
  svg.append(svgElement('path',{d:path,class:'coverage-trend',fill:'none'}));
  for(const p of known){const dot=svgElement('circle',{cx:x(p),cy:y(p.value),r:3.5,class:'coverage-dot'});dot.append(svgElement('title',{},date(p.at)+' · '+number(p.value)+' · '+p.numerator+' / '+p.denominator));svg.append(dot);}
  for(const p of points)svg.append(svgElement('text',{x:x(p),y:161,'text-anchor':'middle',class:'coverage-date-label'},date(p.at)));
  if(points.length>6){svg.style.minWidth=width+'px';svg.style.height='178px';}
  const scroll=node('div',undefined,'coverage-chart-scroll');scroll.append(svg);parent.append(scroll);
  if(points.length===1)parent.append(node('p','Yksi mittauspäivä. Viiva muodostuu seuraavan mittauspäivän jälkeen.','hint'));
 }
 function table(parent,history){
  const points=series(history,'points');if(!points.length)return;
  const methods=series(history,'methods'),accepted=series(history,'accepted'),details=node('details',undefined,'coverage-history-details');details.append(node('summary','Mittauspisteet taulukkona'));
  const wrap=node('div',undefined,'table-wrap'),table=node('table',undefined,'yearly-table coverage-history-table'),head=node('thead'),tr=node('tr'),body=node('tbody');
  table.append(node('caption','Kattavuuden mittaushistoria'));
  for(const text of ['Mittauspäivä','Pisteet ilmoitettu','Voittotapa vahvistettu','Hyväksytyt käsitellyistä otteluista']){const th=node('th',text);th.scope='col';tr.append(th);}head.append(tr);
  points.forEach((p,i)=>{const row=node('tr'),th=node('th',date(p.at));th.scope='row';th.translate='no';row.append(th);for(const value of [p,methods[i],accepted[i]]){const td=node('td',number(value.value)+' · '+value.numerator+' / '+value.denominator);td.translate='no';row.append(td);}body.append(row);});
  table.append(head,body);wrap.append(table);details.append(wrap);parent.append(details);
 }
 root.PAINI_COVERAGE_CHART={...api,render,table};
})(typeof window==='undefined'?globalThis:window);

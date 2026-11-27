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
 const api={series,bounds};if(typeof module==='object'&&module.exports){module.exports=api;return;}
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const lang=()=>({fi:'fi-FI',en:'en-GB',sv:'sv-SE'}[root.PAINI_I18N?.language]||'fi-FI');
 const number=n=>n===null?'—':n.toLocaleString(lang(),{maximumFractionDigits:2})+' %';
 const date=at=>new Intl.DateTimeFormat(lang(),{day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Helsinki'}).format(new Date(at));
 function svgElement(tag,attributes,text){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attributes))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;return el;}
 function render(parent,history,key,label){
  const points=series(history,key),known=points.filter(p=>p.value!==null);
  if(!known.length){parent.append(node('p','Ei tallennettuja mittauspisteitä.','hint'));return;}
  const [low,high]=bounds(points),first=points[0].time,last=points.at(-1).time;
  const x=p=>first===last?210:44+(p.time-first)/(last-first)*330,y=value=>130-(value-low)/(high-low)*106;
  const svg=svgElement('svg',{viewBox:'0 0 400 156',class:'coverage-line-chart',role:'img','aria-label':label});
  for(const value of [high,(low+high)/2,low]){svg.append(svgElement('line',{x1:44,x2:374,y1:y(value),y2:y(value),class:'coverage-gridline'}),svgElement('text',{x:38,y:y(value)+4,'text-anchor':'end',class:'coverage-axis'},number(value)));}
  let path='',connected=false;
  for(const p of points){if(p.value===null){connected=false;continue;}path+=(connected?'L':'M')+x(p)+','+y(p.value);connected=true;}
  svg.append(svgElement('path',{d:path,class:'coverage-trend',fill:'none'}));
  for(const p of known){const dot=svgElement('circle',{cx:x(p),cy:y(p.value),r:3.5,class:'coverage-dot'});dot.append(svgElement('title',{},date(p.at)+' · '+number(p.value)+' · '+p.numerator+' / '+p.denominator));svg.append(dot);}
  parent.append(svg);
  const dates=node('div',undefined,'coverage-chart-dates');dates.append(node('span',date(points[0].at)));if(points.length>1)dates.append(node('span',date(points.at(-1).at)));parent.append(dates);
  if(points.length===1)parent.append(node('p','Yksi mittauspiste. Viiva muodostuu seuraavan mittauksen jälkeen.','hint'));
 }
 function table(parent,history){
  const points=series(history,'points');if(!points.length)return;
  const methods=series(history,'methods'),accepted=series(history,'accepted'),details=node('details',undefined,'coverage-history-details');details.append(node('summary','Mittauspisteet taulukkona'));
  const wrap=node('div',undefined,'table-wrap'),table=node('table',undefined,'yearly-table coverage-history-table'),head=node('thead'),tr=node('tr'),body=node('tbody');
  table.append(node('caption','Kattavuuden mittaushistoria'));
  for(const text of ['Mittausaika (Suomen aika)','Pisteet ilmoitettu','Voittotapa vahvistettu','Hyväksytyt käsitellyistä otteluista']){const th=node('th',text);th.scope='col';tr.append(th);}head.append(tr);
  points.forEach((p,i)=>{const row=node('tr'),th=node('th',date(p.at));th.scope='row';th.translate='no';row.append(th);for(const value of [p,methods[i],accepted[i]]){const td=node('td',number(value.value)+' · '+value.numerator+' / '+value.denominator);td.translate='no';row.append(td);}body.append(row);});
  table.append(head,body);wrap.append(table);details.append(wrap);parent.append(details);
 }
 root.PAINI_COVERAGE_CHART={...api,render,table};
})(typeof window==='undefined'?globalThis:window);

"use strict";
(() => {
 const media=window.matchMedia('(max-width: 700px)');
 const panels=['site-settings','result-filters','profile-share-details','result-help','profile-information','profile-charts','profile-coverage-details'];
 const labels={fi:['Etusivu','Tulokset','Ottelut','Seurat'],en:['Home','Results','Bouts','Clubs'],sv:['Hem','Resultat','Matcher','Klubbar']};
 function language(){const values=labels[window.PAINI_I18N?.language||'fi']||labels.fi;document.querySelectorAll('.nav-mobile-label').forEach((el,i)=>el.textContent=values[i]);}
 function layout(){for(const id of panels){const el=document.getElementById(id);if(el)el.open=!media.matches;}}
 function update(){
  const ids=['competition','result-style','result-year','club','category'],count=ids.filter(id=>document.getElementById(id)?.value).length+(document.getElementById('result-sort')?.value&&document.getElementById('result-sort').value!=='newest'?1:0);
  const badge=document.getElementById('filter-choice-count');if(badge){badge.textContent=String(count);badge.hidden=!count;}
  const reset=document.getElementById('reset-filters');if(reset)reset.hidden=!count&&!document.getElementById('search')?.value;
 }
 layout();language();update();media.addEventListener('change',layout);window.addEventListener('paini-language-change',language);
 document.addEventListener('input',update);document.addEventListener('change',update);window.addEventListener('paini-data-ready',update);
 window.PAINI_MOBILE={update};
})();

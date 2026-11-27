"use strict";
(() => {
 document.getElementById('brand-home')?.addEventListener('click',()=>{
  // Remove the view route before a full reload; favorites stay in local storage.
  const address=new URL(location.href);address.hash='';
  history.replaceState(null,'',address.href);
  window.scrollTo({top:0,left:0,behavior:'instant'});
  location.reload();
 });
})();

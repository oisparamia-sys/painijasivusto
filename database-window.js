"use strict";
document.getElementById('database-open')?.addEventListener('click',event=>{
 const link=event.currentTarget;
 // Keep the ordinary new-tab link as a fallback when popup windows are blocked.
 const popup=window.open(link.href,'paini-tietokanta','popup,width=1280,height=850,resizable=yes,scrollbars=yes');
 if(popup){popup.opener=null;event.preventDefault();popup.focus();}
});

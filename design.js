"use strict";
(() => {
 // Reuse the existing navigation, including its close-panels behavior.
 document.getElementById('brand-home')?.addEventListener('click',()=>document.getElementById('nav-home')?.click());
})();

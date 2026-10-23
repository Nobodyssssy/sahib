(async()=>{
 const checks=[],check=(name,pass)=>checks.push({name,pass:!!pass});
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function until(predicate){for(let i=0;i<100;i++){if(predicate())return true;await wait(100);}return false;}
 const violations=[];const onViolation=event=>violations.push(event.effectiveDirective);
 document.addEventListener('securitypolicyviolation',onViolation);
 try{
  check('Packaged app ready',await until(()=>window.SahibDesktop?.state&&document.querySelector('.side-nav-item[data-nav="practice"]')));
  // Exercise the real event handlers, not direct calls to navigation functions.
  for(const [nav,view]of [['practice','practice'],['cats','cats'],['prayer','prayer'],['hijri','hijri'],['asma','asma'],['books','books'],['tasbih','tasbih'],['home','home']]){
   const button=document.querySelector(`.side-nav-item[data-nav="${nav}"]`);
   button.click();check('Sidebar click '+nav,await until(()=>document.querySelector('.view.active')?.id===`view-${view}`));
  }
  document.querySelector('.side-nav-item[data-nav="settings"]').click();
  check('Settings click opens dialog',await until(()=>document.querySelector('#ov-settings.open')));
  for(const tab of ['prayer','alerts','data','about','appearance']){
   document.querySelector(`[data-settings-tab="${tab}"]`).click();
   check('Settings tab click '+tab,await until(()=>document.querySelector(`[data-settings-tab="${tab}"]`)?.getAttribute('aria-selected')==='true'&&document.querySelector('#settings-body')?.getAttribute('aria-busy')!=='true'));
  }
  const original=SAHIB_THEME.state.theme;
  const theme=document.querySelector('[data-theme-option="dracula"]');theme.click();
  check('Theme button click',await until(()=>document.documentElement.dataset.theme==='dracula'));
  document.querySelector(`[data-theme-option="${original}"]`).click();
  document.querySelector('#ov-settings .btn-close').click();
  check('Settings close button',await until(()=>!document.querySelector('#ov-settings.open')));
  document.querySelector('.side-nav-item[data-nav="search"]').click();
  check('Search button',await until(()=>document.querySelector('#ov-app-search.open')));
  document.querySelector('#ov-app-search .btn-close').click();
  document.querySelector('.side-nav-item[data-nav="cats"]').click();
  check('Adhkar page reopens',await until(()=>document.querySelector('#view-cats.active .cat-card')));
  document.querySelector('#view-cats .cat-card .cat-open').click();
  check('Generated category click',await until(()=>document.querySelector('#view-adkar.active .adkar-card')));
  document.querySelector('.side-nav-item[data-nav="home"]').click();
  check('No blocked event handlers',!violations.includes('script-src-attr'));
 }finally{document.removeEventListener('securitypolicyviolation',onViolation);}
 return checks;
})()

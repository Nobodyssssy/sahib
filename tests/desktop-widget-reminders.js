(async()=>{
 const checks=[],check=(name,pass)=>checks.push({name,pass:!!pass});await SahibPractice.init();
 const has=(date,id)=>SahibPractice.widgetReminders(date).some(r=>r.id.startsWith('tomorrow:'+id+':'));
 const find=(month,day)=>{for(let i=0;i<430;i++){const date=new Date(2026,0,1+i,12),h=getHijriParts(date);if(h.month===month&&h.day===day)return date;}throw Error('Hijri fixture unavailable');};
 check('Sunday previews the Monday fast',has(new Date(2026,9,25,12),'monday-thursday-fast'));
 check('Wednesday previews the Thursday fast',has(new Date(2026,9,28,12),'monday-thursday-fast'));
 check('Ordinary Friday does not preview a Monday or Thursday fast',!has(new Date(2026,9,23,12),'monday-thursday-fast'));
 check('Hijri day 12 previews the white days',has(find(5,12),'white-days-fast'));
 check('Excluded Tashriq day is not suggested for fasting',!has(find(12,12),'white-days-fast'));
 const state=await SahibDesktop.invoke('desktop_state');
 check('Widget has six daily prayer markers including sunrise',state.schedule.widgetDays.length>=30&&state.schedule.widgetDays.every(d=>d.prayers.length===6&&d.prayers.some(p=>p.name==='Sunrise')));
 check('Widget calendar boundaries include DST days',state.schedule.widgetDays.every(d=>d.end>d.start&&d.end-d.start<=26*3600000));
 return checks;
})()

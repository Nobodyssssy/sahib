'use strict';
/* Interface localization is deliberately separate from religious/user content.
   Local content-language controls keep working independently. */
window.SAHIB_I18N=(()=>{
 let language='en',ready=false,queued=false;
 const originals=new WeakMap(),attributes=new WeakMap();
 const pairs=`Home|الرئيسية
Practice|الورد
Daily practice|الورد اليومي
Daily Practice|الورد اليومي
Adkar|الأذكار
Adhkar|الأذكار
Prayer|الصلاة
Prayer times|مواقيت الصلاة
Hijri|هجري
Hijri calendar|التقويم الهجري
Hijri Calendar|التقويم الهجري
99 Names|الأسماء الحسنى
99 Names of Allah|أسماء الله الحسنى
Library|المكتبة
Tasbih|التسبيح
Search|البحث
Settings|الإعدادات
Reminders|التذكيرات
Favorites|المفضلة
More|المزيد
Appearance|المظهر
Alerts|التنبيهات
Data|البيانات
About|حول التطبيق
Close|إغلاق
Done|تم
Save|حفظ
Cancel|إلغاء
Back|رجوع
← Back|رجوع
Edit|تعديل
Delete|حذف
Reset|إعادة ضبط
Continue|متابعة
Continue reading|متابعة القراءة
View all|عرض الكل
View calendar|عرض التقويم
Open counter|فتح العداد
Get started|ابدأ
Start session|بدء الجلسة
Open practice|فتح الورد
Choose your routines|اختر عاداتك
A moment of dhikr|لحظة ذكر
Your library|مكتبتك
Words of remembrance|كلمات الذكر
From the 99 Names|من الأسماء الحسنى
Explore this name|تأمل هذا الاسم
Read dhikr|قراءة الذكر
Today's reading|قراءة اليوم
Your daily practice|وردك اليومي
In your calendar|في تقويمك
Good morning|صباح الخير
Good afternoon|طاب نهارك
Good evening|مساء الخير
Good night|طابت ليلتك
A little time for remembrance.|وقت قصير للذكر.
A little space for reflection.|ومساحة للتدبر.
Your practice, your pace. Saved on this device.|وردك على وتيرتك. محفوظ على هذا الجهاز.
Choose location|اختيار الموقع
Saved coordinates|إحداثيات محفوظة
Next prayer|الصلاة القادمة
Full timetable|جدول المواقيت
Remaining|المتبقي
Times use|تُعرض الأوقات حسب
Offline calculation|حساب دون اتصال
Prayer settings|إعدادات الصلاة
Set your location|حدد موقعك
Choose a city or enter coordinates to calculate your local prayer times.|اختر مدينة أو أدخل الإحداثيات لحساب مواقيت الصلاة المحلية.
Your day breakdown appears here once a location is set.|يظهر توزيع يومك هنا بعد تحديد الموقع.
Day rhythm|إيقاع اليوم
The rhythm of your day|إيقاع يومك
Maghrib to Maghrib|من المغرب إلى المغرب
Night|الليل
Day|النهار
First ⅓|الثلث الأول
Second ⅓|الثلث الثاني
Last ⅓|الثلث الأخير
Forenoon|الضحى
Islamic midnight|منتصف الليل الشرعي
Awwabin|الأوّابين
Restricted prayer windows|أوقات النهي
After Fajr until sunrise|من الفجر حتى طلوع الشمس
Solar zenith (Istiwa’)|استواء الشمس
After Asr until Maghrib|من العصر حتى المغرب
Choose a period to see its details and references.|اختر فترة لعرض تفاصيلها ومراجعها.
Fajr|الفجر
Sunrise|الشروق
Dhuhr|الظهر
Asr|العصر
Maghrib|المغرب
Isha|العشاء
Today|اليوم
Monthly|شهري
Timetable tools|أدوات الجدول
Print|طباعة
Export CSV|تصدير CSV
Monthly overview|الجدول الشهري
Updated|آخر تحديث
just now|الآن
Change|تغيير
Morning adhkar|أذكار الصباح
Evening adhkar|أذكار المساء
After Maghrib|بعد المغرب
Any time|في أي وقت
Undo|تراجع
Nothing set for today. Begin with one small practice you already keep.|لم تحدد وردًا لليوم. ابدأ بعمل صغير تحافظ عليه.
Add evening adhkar|إضافة أذكار المساء
Add morning adhkar|إضافة أذكار الصباح
Add Qur’an reading|إضافة قراءة القرآن
No open book.|لا يوجد كتاب مفتوح.
Browse the library|تصفح المكتبة
Search the whole app…|ابحث في التطبيق كله…
Search the whole app|البحث في التطبيق كله
Search pages, adhkar, books, names and practices…|ابحث في الصفحات والأذكار والكتب والأسماء والأوراد…
No results. Try another word.|لا توجد نتائج. جرّب كلمة أخرى.
Pages|الصفحات
Categories|الفئات
Books|الكتب
Names|الأسماء
Practices|الأوراد
Calendar events|مناسبات التقويم
Data and backup|البيانات والنسخ الاحتياطي
About Sahib|حول صاحب
Theme family|عائلة المظهر
Mode|الوضع
Light|فاتح
Dark|داكن
Navigation|التنقل
Sidebar position|موضع القائمة الجانبية
Left|يسار
Right|يمين
Typeface|الخط
Use theme font|استخدام خط المظهر
Reset appearance|إعادة ضبط المظهر
Reset|إعادة ضبط
Arabic text|النص العربي
Preferences are stored locally on this device|تُحفظ تفضيلاتك محليًا على هذا الجهاز
Physical side of the screen. Works independently of text direction.|الجهة الفعلية من الشاشة، مستقلة عن اتجاه النص.
The collapse control lives at the top of the sidebar. Its state is remembered on this device.|يوجد زر طي القائمة في أعلاها، ويُحفظ وضعها على هذا الجهاز.
Every theme family ships with a light and a dark palette. The choice is stored on this device.|لكل مظهر لوحة فاتحة وأخرى داكنة. يُحفظ اختيارك على هذا الجهاز.
Accents come from this theme’s own palette. Sahib remembers your choice for each theme.|ألوان التمييز من لوحة المظهر نفسه. يتذكر صاحب اختيارك لكل مظهر.
keeps a dedicated Arabic face for Quran, adhkar and the Hijri calendar.|يحتفظ بخط عربي مخصص للقرآن والأذكار والتقويم الهجري.
The typeface setting changes the interface around it.|يغيّر اختيار الخط واجهة التطبيق المحيطة به.
Sahib · light · sage · Tajawal|صاحب · فاتح · مريمي · تجوّل
Collapse sidebar|طي القائمة الجانبية
Expand sidebar|توسيع القائمة الجانبية
Open navigation menu|فتح قائمة التنقل
Toggle theme|تبديل الوضع
Search all adkar...|ابحث في كل الأذكار…
Search books & authors...|ابحث في الكتب والمؤلفين…
Search names...|ابحث في الأسماء…
New category|فئة جديدة
New dhikr|ذكر جديد
Add dhikr|إضافة ذكر
Manage categories|إدارة الفئات
All adhkar|كل الأذكار
Fortress of the Muslim|حصن المسلم
Your daily companion|رفيقك اليومي
Category collection|مجموعة الفئة
Saved adhkar|الأذكار المحفوظة
Favorite books|الكتب المفضلة
Saved library items|عناصر المكتبة المحفوظة
Times, countdown and daily cycle|المواقيت والعد التنازلي وإيقاع اليوم
Islamic dates and events|التواريخ والمناسبات الهجرية
Asma al-Husna|أسماء الله الحسنى
Books and reading|الكتب والقراءة
Digital counter|عداد الأذكار
A local daybook of chosen routines|سجل محلي لأورادك المختارة
No results|لا توجد نتائج
No results.|لا توجد نتائج.
Clear filters|مسح عوامل التصفية
All|الكل
Filter|تصفية
Category|الفئة
Grade|الدرجة
Favorite|مفضل
Add to favorites|إضافة إلى المفضلة
Remove from favorites|إزالة من المفضلة
Source|المصدر
Virtue|الفضل
Source & Virtue|المصدر والفضل
English|English
Play|تشغيل
Pause|إيقاف مؤقت
Meaning|المعنى
More info|مزيد من التفاصيل
About this name|حول هذا الاسم
In the Quran|في القرآن الكريم
Mark as memorized|تحديد كمحفوظ
Memorized|محفوظ
memorized|محفوظ
Not yet|لم يُحفظ بعد
Start flashcards|بدء المراجعة
Reveal|إظهار الإجابة
Show answer|إظهار الإجابة
I knew it|عرفتها
Again|مرة أخرى
Finish|إنهاء
Preview unavailable|المعاينة غير متاحة
Download for offline use|تنزيل للاستخدام دون اتصال
Finished|مكتمل
Your daybook|سجل يومك
A quiet record of what you choose to keep. Nothing is switched on for you.|سجل هادئ لما تختار المحافظة عليه. لا يُفعّل أي ورد تلقائيًا.
Add practice|إضافة ورد
Upcoming|القادم
Calendar|التقويم
All practices|كل الأوراد
A quiet beginning|بداية هادئة
Choose a few anchors, not a checklist.|اختر أورادًا قليلة تثبت عليها.
Nothing is switched on by default. Start with what you already intend to keep, and leave the rest for another season.|لا يُفعّل شيء افتراضيًا. ابدأ بما تنوي المحافظة عليه، واترك الباقي لوقت آخر.
Every day|كل يوم
Every week|كل أسبوع
Qur’an reading|قراءة القرآن
Ghusl for Jumu'ah|غسل الجمعة
Monday & Thursday fast|صيام الاثنين والخميس
Monday & Thursday|الاثنين والخميس
Friday|الجمعة
Add these five|إضافة هذه الأوراد الخمسة
Browse all practices|تصفح كل الأوراد
Not now|ليس الآن
Add|إضافة
Daily worship|الورد اليومي
Jumu'ah|الجمعة
Fitrah care|العناية بالفطرة
Weekly & monthly|أسبوعي وشهري
Seasons|المواسم
Personal|شخصي
Recommended|مستحب
Sunnah|سنة
Seasonal|موسمي
Enabled|مفعّل
Disabled|غير مفعّل
Enable|تفعيل
Disable|تعطيل
Snooze|تأجيل
Skip today|تجاوز اليوم
Mark done|تحديد كمكتمل
Done today|مكتمل اليوم
Details|التفاصيل
Schedule|الموعد
Reminder|تذكير
Title|العنوان
Arabic title|العنوان العربي
Notes|ملاحظات
Daily|يومي
Weekly|أسبوعي
Monthly · Gregorian day|شهري · يوم ميلادي
Monthly · Hijri day|شهري · يوم هجري
Yearly · Hijri date|سنوي · تاريخ هجري
Hijri season|موسم هجري
Every N days|كل عدد محدد من الأيام
One date|تاريخ واحد
No date yet|دون تاريخ بعد
When it returns|موعد التكرار
Rhythm|وتيرة التكرار
Days|الأيام
Day of month|يوم الشهر
Hijri days|الأيام الهجرية
comma separated|مفصولة بفواصل
Hijri month|الشهر الهجري
Start day|يوم البداية
End day|يوم النهاية
Date|التاريخ
Target|الهدف
Color|اللون
Theme|المظهر
Custom|مخصص
Count|العدد
Counter|العداد
Reset counter|تصفير العداد
Choose a dhikr|اختيار ذكر
Select a city|اختيار مدينة
City|المدينة
Latitude|خط العرض
Longitude|خط الطول
Use GPS|استخدام الموقع الجغرافي
Use my location|استخدام موقعي
Manual coordinates|إحداثيات يدوية
Save location|حفظ الموقع
Language|اللغة
Interface language|لغة الواجهة
English / Arabic|English / العربية
Use theme default|استخدام الإعداد الافتراضي للمظهر
Copy|نسخ
Open|فتح
Continue session|متابعة الجلسة
Previous|السابق
Next|التالي
Skip|تجاوز
Session complete|اكتملت الجلسة
Back to categories|العودة إلى الفئات
Try again|المحاولة مجددًا
Refresh|تحديث
Loading…|جارٍ التحميل…
Loading...|جارٍ التحميل…
Offline ready|جاهز دون اتصال
Local-first · offline ready|محلي أولًا · جاهز دون اتصال
No accounts · no tracking|دون حسابات أو تتبع
Reader settings|إعدادات القارئ
Scroll|تمرير
Flip|تقليب
Zoom|التكبير
Fit width|ملاءمة العرض
Bookmarks|العلامات المرجعية
Contents|الفهرس
Bookmarked pages|الصفحات المعلّمة
No bookmarks yet|لا توجد علامات بعد
Bookmark this page|إضافة علامة لهذه الصفحة
Remove bookmark|إزالة العلامة
Close reader|إغلاق القارئ
Font size|حجم الخط
Reading mode|وضع القراءة
Download|تنزيل
Downloaded|تم التنزيل
Offline library|المكتبة دون اتصال
Local books|الكتب المحلية
Import PDF|استيراد PDF
Add PDF|إضافة PDF
Storage|التخزين
Backup|نسخ احتياطي
Export|تصدير
Import|استيراد
About the day breakdown|حول توزيع اليوم
Previous prayer card|بطاقة الصلاة السابقة
Next prayer card|بطاقة الصلاة التالية
Prayer card|بطاقة الصلاة
Selected|محدد
Search your adhkar…|ابحث في الأذكار…`;
 const enAr=new Map(pairs.split('\n').map(line=>line.split('|'))),arEn=new Map([...enAr].map(([en,ar])=>[ar,en]));
 for(const line of (window.SAHIB_AR_EXTRA||'').split('\n')){const [en,ar]=line.split('|');if(en&&ar){enAr.set(en,ar);arEn.set(ar,en)}}
 const aliases=new Map([
 ['Adkar · الأذكار',['Adhkar','الأذكار']],['Prayer Times · الصلاة',['Prayer times','مواقيت الصلاة']],['Calendar · التقويم',['Hijri calendar','التقويم الهجري']],['Asma al-Husna · أسماء الله',['99 Names of Allah','أسماء الله الحسنى']],['Library · المكتبة',['Library','المكتبة']],['Tasbih · التسبيح',['Tasbih','التسبيح']],['Sahib · daily practice · وِرد',['Sahib · daily practice','صاحب · الورد اليومي']],
 ['النص العربي * / Arabic text *',['Arabic text *','النص العربي *']],['الموقف / Situation',['Situation','الموقف']],['Category / الفئة',['Category','الفئة']],['Reliability / الدرجة',['Reliability','الدرجة']],['Source / المصدر',['Source','المصدر']],['Virtue / الفضل',['Virtue','الفضل']],['Sahih صحيح',['Sahih','صحيح']],['Hasan حسن',['Hasan','حسن']]
 ]);
 const normalize=s=>s.replace(/\s+/g,' ').trim();
 function enrich(){
  const add=(en,ar)=>{if(en&&ar){if(!enAr.has(normalize(en)))enAr.set(normalize(en),ar);if(!arEn.has(normalize(ar)))arEn.set(normalize(ar),en)}};
  for(const c of (typeof cats==='undefined'?[]:cats)){add(c.en,c.ar);aliases.set(`${c.ar} - ${c.en}`,[c.en,c.ar]);}
  for(const b of (typeof BOOKS==='undefined'?[]:BOOKS)){add(b.titleEn,b.titleAr);add(b.authorEn,b.author);add(b.descriptionEn,b.descriptionAr);}
  for(const c of (typeof BOOK_CATEGORIES==='undefined'?[]:BOOK_CATEGORIES))add(c.en,c.ar);
  for(const p of (typeof SahibPractice==='undefined'?[]:SahibPractice.getAll())){add(p.title,p.titleAr);add(p.description,p.descriptionAr);}
 }
 function text(value){
  const key=normalize(value);if(!key)return value;
  if(aliases.has(key))return aliases.get(key)[language==='ar'?1:0];
  const translated=language==='ar'?enAr.get(key):arEn.get(key);
  if(translated)return (value.match(/^\s*/)?.[0]||'')+translated+(value.match(/\s*$/)?.[0]||'');
  if(language==='ar'){
   if(/^Delete “(.+)” and its local history\? This cannot be undone\.$/.test(key))return key.replace(/^Delete “(.+)” and its local history\? This cannot be undone\.$/,'حذف «$1» وسجله المحلي؟ لا يمكن التراجع.');
   if(/^This will bring local storage to about (\d+) MB\. Continue\?$/.test(key))return key.replace(/^This will bring local storage to about (\d+) MB\. Continue\?$/,'سيصبح التخزين المحلي نحو $1 ميغابايت. هل تريد المتابعة؟');
   if(/^Next dates: /.test(key))return 'المواعيد القادمة: '+text(key.slice(12));
   if(/^Updated · /.test(key))return 'آخر تحديث · '+text(key.slice(10));
   if(/^Accent · /.test(key))return 'لون التمييز · '+text(key.slice(9));
   const patterns=[[/^(\d+) adh?kar in your collection$/,'$1 ذكرًا في مجموعتك'],[/^(\d+) adh?kar$/,'$1 ذكرًا'],[/^(\d+) (?:practice|practices) today$/,'$1 من الأوراد اليوم'],[/^(\d+) books$/,'$1 كتابًا'],[/^(\d+) result\(s\)(.*)$/,'$1 نتيجة$2'],[/^(\d+)\/(\d+) today$/,'$1/$2 اليوم'],[/^Page (\d+) (?:of|\/) (\d+)$/,'الصفحة $1 من $2'],[/^(\d+)h (\d+)m$/,'$1 س $2 د'],[/^Accent · (.+)$/,'لون التمييز · $1'],[/^Times use (.+)$/,'تُعرض الأوقات حسب $1'],[/^Updated · (.+)$/,'آخر تحديث · $1'],[/^Mark (.+) done today$/,'تحديد $1 كمكتمل اليوم']];
   for(const [re,to]of patterns)if(re.test(key))return key.replace(re,to);
   if(key.includes(' · '))return key.split(' · ').map(part=>text(part)).join(' · ');
   const dates={Sunday:'الأحد',Monday:'الاثنين',Tuesday:'الثلاثاء',Wednesday:'الأربعاء',Thursday:'الخميس',Friday:'الجمعة',Saturday:'السبت',January:'يناير',February:'فبراير',March:'مارس',April:'أبريل',May:'مايو',June:'يونيو',July:'يوليو',August:'أغسطس',September:'سبتمبر',October:'أكتوبر',November:'نوفمبر',December:'ديسمبر'};
   if(/\b(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|January|February|March|April|May|June|July|August|September|October|November|December)\b/.test(key)&&/\d/.test(key))return key.replace(/\b[A-Za-z]+\b/g,word=>dates[word]||word);
   const dynamic=[[/^(\d+) min advance notice$/,'تنبيه قبل $1 دقيقة'],[/^(\d+) left$/,'المتبقي $1'],[/^(\d+) min before$/,'قبل $1 دقيقة'],[/^Target: (\d+)×$/,'الهدف: $1×'],[/^Cached: (\d+) books$/,'المحفوظ: $1 كتاب'],[/^Origin quota remaining: ([\d.]+) MB$/,'المساحة المتبقية: $1 ميغابايت'],[/^([\d.]+) MB to download$/,'$1 ميغابايت للتنزيل'],[/^(\d+) of (\d+) books not cached$/,'$1 من $2 كتاب غير محفوظ'],[/^(\d+) active$/,'$1 مفعّل'],[/^(\d+) practices$/,'$1 من الأوراد'],[/^saved just now$/,'حُفظ الآن'],[/^manual$/,'يدوي'],[/^updated just now$/,'حُدّث الآن'],[/^([\d.]+) MB used of about ([\d.]+) GB available$/,'المستخدم $1 ميغابايت من نحو $2 غيغابايت متاحة']];
   for(const [re,to]of dynamic)if(re.test(key))return key.replace(re,to);
  }
  return value;
 }
 const protectedSelector='script,style,svg,textarea,code,pre,[data-no-i18n],.arabic-big,.translit-swap,.session-arabic,.adkar-text,.src-text,.quote-text,.asma-detail-ar,.asma-detail-tafsir,.asma-detail-about,.asma-detail-quran,.book-cover,.garden-book-cover,.reader-body,.book-title,.book-author,.book-detail-title,.book-detail-desc,.asma-card-ar,.asma-card-sub,.asma-detail-translit,.asma-detail-meaning,.quote-tafsir-body,.day-repartition,.hijri-month-title,.hijri-weekday,.books-title,.books-subtitle,.books-list-title,.book-cat-badge';
 function translateNode(node){
  if(node.parentElement?.closest(protectedSelector))return;
  const current=node.nodeValue,previous=originals.get(node);const source=previous&&current===previous.last?previous.source:current;
  const next=text(source);originals.set(node,{source,last:next});if(next!==current)node.nodeValue=next;
 }
 function apply(root=document.body){
  if(!root)return;enrich();
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;while(node=walker.nextNode())translateNode(node);
  const elements=root.querySelectorAll?.('[placeholder],[aria-label],[title]')||[];
  for(const el of elements){if(el.closest('svg,[data-no-i18n]'))continue;let saved=attributes.get(el)||{};for(const name of ['placeholder','aria-label','title']){if(!el.hasAttribute(name))continue;const current=el.getAttribute(name),previous=saved[name],source=previous&&current===previous.last?previous.source:current,next=text(source);saved[name]={source,last:next};if(next!==current)el.setAttribute(name,next)}attributes.set(el,saved);}
  document.documentElement.lang=language;document.documentElement.dir=language==='ar'?'rtl':'ltr';document.documentElement.dataset.language=language;
  document.querySelectorAll('[data-app-language]').forEach(b=>{const on=b.dataset.appLanguage===language;b.classList.toggle('active',on);if(b.getAttribute('aria-pressed')!==String(on))b.setAttribute('aria-pressed',String(on))});
  document.querySelectorAll('[data-global-language]').forEach(b=>{const label=language==='ar'?'EN':'عربي';if(b.textContent!==label)b.textContent=label;const aria=language==='ar'?'Switch interface to English':'تغيير لغة الواجهة إلى العربية';if(b.getAttribute('aria-label')!==aria)b.setAttribute('aria-label',aria);const title=language==='ar'?'English':'العربية';if(b.title!==title)b.title=title});
 }
 function controls(){
  for(const host of document.querySelectorAll('.garden-toolbar,.header-left')){
   if(host.querySelector('[data-global-language]'))continue;
   const b=document.createElement('button');b.className='global-language-button';b.dataset.globalLanguage='';b.onclick=()=>setLanguage(language==='ar'?'en':'ar');host.append(b);
  }
 }
 async function setLanguage(lang){
  language=lang==='ar'?'ar':'en';await store.setMeta('appLanguage',language);
  // Page-level content controls remain independent after the global selection.
  if(typeof _booksLang!=='undefined')_booksLang=language;if(typeof _asmaLang!=='undefined')_asmaLang=language;if(typeof _calendarLang!=='undefined')_calendarLang=language;if(typeof _cycleLang!=='undefined')_cycleLang=language;if(typeof _quoteLang!=='undefined')_quoteLang=language;
  await store.setMeta('cycleLang',language);await store.setMeta('quoteLang',language);
  const active=document.querySelector('.view.active')?.id;
  if(active==='view-home')await renderHome();else if(active==='view-books')await renderBooksGrid();else if(active==='view-asma')renderAsmaGrid();else if(active==='view-hijri')renderHijriCalendar();else if(active==='view-prayer')renderPrayerView();else if(active==='view-practice')SahibPractice.render();
  if(document.getElementById('ov-settings')?.classList.contains('open'))await renderSettingsBody();
  controls();apply();window.dispatchEvent(new CustomEvent('sahib:languagechange',{detail:{language}}));
 }
 async function init(){
  if(ready){controls();apply();return;}
  language=await store.getMeta('appLanguage')==='ar'?'ar':'en';
  if(typeof _booksLang!=='undefined')_booksLang=language;if(typeof _asmaLang!=='undefined')_asmaLang=language;if(typeof _calendarLang!=='undefined')_calendarLang=language;
  // Saved global language initializes content defaults; later local buttons still work.
  if(await store.getMeta('appLanguage'))_cycleLang=await store.getMeta('cycleLang')||language;
  ready=true;controls();apply();
  const nativeConfirm=window.confirm.bind(window);window.confirm=message=>nativeConfirm(text(String(message)));

  new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;controls();apply()})}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title','aria-label']});
 }
 return {get language(){return language},init,setLanguage,apply,t:text,enAr,arEn};
})();

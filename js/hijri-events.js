'use strict';

/* Icon per event type - used by views/home.js and views/hijri.js */
const EVENT_ICONS = {
  weekly:      'quran',
  recommended: 'fasting',
  sacred:      'kaaba',
  major:       'mosque-filled',
  reflection:  'moon-filled',
};


/* ═══════════════════════════════════════════════════════════
   Hijri events — 21 events, sourced & verified
   Every claim has a source with a link where possible.
   ═══════════════════════════════════════════════════════════ */

const HIJRI_EVENTS = [

  /* ─── 1. ISLAMIC NEW YEAR ─── */
  {
    id: 'new-year',
    hijriDate: { month: 1, day: 1 },
    type: 'reflection',
    nameAr: 'رأس السنة الهجرية',
    nameEn: 'Islamic New Year',
    descAr: 'أول يوم من شهر محرم، وهو بداية السنة الهجرية. الهجرة النبوية كانت نقطة تحول في تاريخ الإسلام، ومنها اعتبر المسلمون بداية تقويمهم.',
    descEn: 'The first day of Muharram, marking the start of the Islamic Hijri year. The Prophet ﷺ’s migration was a turning point in Islamic history.',
    virtueAr: 'ليس في الشرع احتفال خاص برأس السنة، لكنها فرصة للمحاسبة والتخطيط.',
    virtueEn: 'There is no specific celebration prescribed, but it is a chance for reflection and planning.',
    actsAr: [
      'محاسبة النفس على ما مضى من العام',
      'التخطيط للعام الجديد بأهداف إيمانية',
      'الإكثار من الدعاء والاستغفار',
      'صيام أول أيام محرم تطوعًا'
    ],
    actsEn: [
      'Take account of the past year',
      'Set faith-based goals for the new year',
      'Increase in dua and seeking forgiveness',
      'Voluntary fasting on the early days of Muharram'
    ],
    prepAr: 'قبل بداية السنة، خصص وقتًا لمحاسبة النفس وكتابة أهدافك لهذا العام.',
    prepEn: 'Before the year begins, set aside time for self-reflection and writing down your goals.',
    specialDhikr: {
      ar: 'اللَّهُمَّ أَدْخِلْ عَلَيْنَا شَهْرَ مُحَرَّمٍ بِالْأَمْنِ وَالْإِيمَانِ وَالسَّلَامَةِ وَالْإِسْلَامِ',
      en: 'O Allah, enter upon us the month of Muharram with safety, faith, security, and Islam.',
      count: 'Once',
      source: { ref: 'Common dua', url: '' }
    },
    sources: [
      { ref: 'Sahih al-Bukhari 3934 — Context of Hijrah', url: 'https://sunnah.com/bukhari:3934' }
    ]
  },

  /* ─── 2. DAY OF ASHURA ─── */
  {
    id: 'ashura',
    hijriDate: { month: 1, day: 10 },
    type: 'major',
    nameAr: 'يوم عاشوراء',
    nameEn: 'Day of Ashura',
    descAr: 'اليوم الذي نجّى الله فيه موسى عليه السلام وقومه من فرعون، وأغرق فرعون وجنوده. صامه النبي ﷺ وأمر بصيامه.',
    descEn: 'The day Allah saved Musa عليه السلام and the Children of Israel from Pharaoh. The Prophet ﷺ fasted it and encouraged others to fast it.',
    virtueAr: 'قال النبي ﷺ: «صيام يوم عاشوراء أَحْتَسِبُ على الله أن يكفّر السنة التي قبله».',
    virtueEn: 'The Prophet ﷺ said: "Fasting the day of Ashura, I hope from Allah, expiates the sins of the preceding year."',
    actsAr: [
      'صيام اليوم العاشر من محرم',
      'صيام اليوم التاسع معه (تاسوعاء)',
      'أو صيام العاشر والحادي عشر',
      'الدعاء والاستغفار والصلاة على النبي ﷺ'
    ],
    actsEn: [
      'Fast the 10th of Muharram',
      'Fast the 9th with it',
      'Or fast the 10th and 11th',
      'Make dua, seek forgiveness, send blessings on the Prophet ﷺ'
    ],
    prepAr: 'خطط لصيام التاسع والعاشر مسبقًا، وحدد نيتك قبل الليلة.',
    prepEn: 'Plan ahead to fast the 9th and 10th. Set your intention before the night.',
    specialDhikr: {
      ar: 'حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ',
      en: 'Allah is sufficient for us, and He is the best Disposer of affairs.',
      count: 'Say abundantly',
      source: { ref: 'Quran 3:173', url: 'https://quran.com/3/173' }
    },
    sources: [
      { ref: 'Sahih al-Bukhari 2004', url: 'https://sunnah.com/bukhari:2004' },
      { ref: 'Sahih Muslim 1162', url: 'https://sunnah.com/muslim:1162' },
      { ref: 'Sahih Muslim 1131', url: 'https://sunnah.com/muslim:1131' }
    ]
  },

  /* ─── 3. WHITE DAYS ─── */
  {
    id: 'white-days',
    hijriDate: { month: 0, day: [13, 14, 15] },
    type: 'recommended',
    nameAr: 'الأيام البيض',
    nameEn: 'The White Days (Ayyam al-Beed)',
    descAr: 'الأيام الثالث عشر والرابع عشر والخامس عشر من كل شهر هجري، سُميت بذلك لأن القمر يكتمل فيها فيضيء الليل.',
    descEn: 'The 13th, 14th, and 15th of every Hijri month. Called "white" because the full moon shines brightly on those nights.',
    virtueAr: 'كان النبي ﷺ يصومها دائمًا، وأوصى بها أصحابه. وقال: «صيام ثلاثة أيام من كل شهر صيام الدهر».',
    virtueEn: 'The Prophet ﷺ consistently fasted them. He said: "Fasting three days of every month is like fasting a lifetime."',
    actsAr: [
      'صيام الأيام الثلاثة',
      'الإكثار من الذكر والاستغفار',
      'قيام الليل ولو بركعتين',
      'الصدقة'
    ],
    actsEn: [
      'Fast the three days',
      'Increase in dhikr and forgiveness',
      'Night prayer even two rak‘ahs',
      'Give charity'
    ],
    prepAr: 'علّم نفسك متابعة التاريخ الهجري لتصوم هذه الأيام شهريًا.',
    prepEn: 'Track the Hijri calendar so you can fast these three days every month.',
    specialDhikr: {
      ar: 'سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلَا إِلَهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ',
      en: 'Glory to Allah, praise to Allah, there is no god but Allah, and Allah is the Greatest.',
      count: 'Repeat frequently',
      source: { ref: 'Sahih Muslim 2137', url: 'https://sunnah.com/muslim:2137' }
    },
    sources: [
      { ref: 'Sahih al-Bukhari 1178', url: 'https://sunnah.com/bukhari:1178' },
      { ref: 'Sunan al-Tirmidhi 761', url: 'https://sunnah.com/tirmidhi:761' }
    ]
  },

  /* ─── 4. ISRA & MI'RAJ ─── */
  {
    id: 'isra-miraj',
    hijriDate: { month: 7, day: 27 },
    type: 'recommended',
    nameAr: 'الإسراء والمعراج',
    nameEn: "Isra' and Mi'raj",
    descAr: 'الليلة التي أُسري فيها بالنبي ﷺ من المسجد الحرام إلى المسجد الأقصى، ثم عُرج به إلى السماوات العُلى، وفُرضت فيها الصلوات الخمس.',
    descEn: 'The night the Prophet ﷺ was taken from Masjid al-Haram to Masjid al-Aqsa, then ascended through the heavens. The five daily prayers were prescribed on this night.',
    virtueAr: 'معجزة عظيمة كرّم الله بها نبيه ﷺ، وفيها فُرضت الصلاة التي هي عمود الدين.',
    virtueEn: 'A great miracle with which Allah honoured His Prophet ﷺ, and in which the prayer was ordained.',
    actsAr: [
      'قيام الليل والإكثار من الصلاة',
      'قراءة سورة الإسراء',
      'التأمل في عظمة النبي ﷺ',
      'التوبة والاستغفار'
    ],
    actsEn: [
      'Night prayer and increasing in salah',
      'Recite Surah al-Isra (17)',
      'Reflect on the greatness of the Prophet ﷺ',
      'Repent and seek forgiveness'
    ],
    prepAr: 'خصّص هذه الليلة للصلاة والذكر، واقرأ قصة الإسراء.',
    prepEn: 'Dedicate this night to prayer and dhikr. Read the story of Isra.',
    specialDhikr: {
      ar: 'سُبْحَانَ الَّذِي أَسْرَىٰ بِعَبْدِهِ لَيْلًا مِّنَ الْمَسْجِدِ الْحَرَامِ إِلَى الْمَسْجِدِ الْأَقْصَى',
      en: 'Exalted is He who took His Servant by night from al-Masjid al-Haram to al-Masjid al-Aqsa.',
      count: 'Once',
      source: { ref: 'Quran 17:1', url: 'https://quran.com/17/1' }
    },
    sources: [
      { ref: 'Sahih al-Bukhari 3207', url: 'https://sunnah.com/bukhari:3207' },
      { ref: 'Sahih Muslim 162', url: 'https://sunnah.com/muslim:162' },
      { ref: 'Quran 17:1', url: 'https://quran.com/17/1' }
    ]
  },

  /* ─── 5. MID-SHA'BAN ─── */
  {
    id: 'mid-shaban',
    hijriDate: { month: 8, day: 15 },
    type: 'recommended',
    nameAr: 'ليلة النصف من شعبان',
    nameEn: "Mid-Sha'ban (Laylat al-Bara'ah)",
    descAr: 'الليلة الخامسة عشرة من شعبان، وهي من الليالي التي يُستحب فيها القيام والدعاء.',
    descEn: "The 15th night of Sha'ban. Many scholars recommend night prayer and dua on this night.",
    virtueAr: 'وردت أحاديث في فضل هذه الليلة، منها: «إن الله يطلع على خلقه ليلة النصف من شعبان فيغفر لأهل الأرض إلا لمشرك أو مشاحن».',
    virtueEn: 'Narrations mention: "Allah looks at His creation on mid-Sha\'ban and forgives the people of the earth — except an idolater or one who harbours enmity."',
    actsAr: [
      'قيام الليل',
      'الدعاء والاستغفار',
      'صيام يوم 15 شعبان',
      'صفاء القلب مع المسلمين'
    ],
    actsEn: [
      'Night prayer',
      'Dua and seeking forgiveness',
      "Fast on the 15th of Sha'ban",
      'Purify your heart toward other Muslims'
    ],
    prepAr: 'قبل هذه الليلة، نظّف قلبك من الأحقاد وسامح من خاصمك.',
    prepEn: 'Before this night, cleanse your heart of grudges and forgive those who wronged you.',
    specialDhikr: {
      ar: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
      en: 'O Allah, You are Most Forgiving, and You love forgiveness; so forgive me.',
      count: 'Repeat often',
      source: { ref: 'Sunan al-Tirmidhi 3513', url: 'https://sunnah.com/tirmidhi:3513' }
    },
    sources: [
      { ref: "Sunan Ibn Majah 1389", url: 'https://sunnah.com/ibnmajah:1389' },
      { ref: 'Sunan al-Tirmidhi 3513', url: 'https://sunnah.com/tirmidhi:3513' }
    ]
  },

  /* ─── 6. SHA'BAN BEGINS ─── */
  {
    id: 'shaban-begins',
    hijriDate: { month: 8, day: 1 },
    type: 'reflection',
    nameAr: 'بداية شهر شعبان',
    nameEn: "Beginning of Sha'ban",
    descAr: 'شهر شعبان هو الشهر الذي يسبق رمضان، وكان النبي ﷺ يكثر فيه من الصيام استعدادًا لرمضان.',
    descEn: "Sha'ban is the month preceding Ramadan. The Prophet ﷺ used to fast abundantly in it as preparation for Ramadan.",
    virtueAr: 'قالت عائشة رضي الله عنها: «كان رسول الله ﷺ يصوم حتى نقول لا يفطر، ويفطر حتى نقول لا يصوم، وما رأيته أكثر صيامًا منه في شعبان».',
    virtueEn: 'Aisha said: "I never saw the Prophet ﷺ fast more in any month than Sha\'ban."',
    actsAr: [
      'الإكثار من الصيام',
      'قراءة القرآن استعدادًا لرمضان',
      'التوبة والاستغفار',
      'تعويد النفس على القيام'
    ],
    actsEn: [
      'Increase in voluntary fasting',
      'Recite Quran in preparation for Ramadan',
      'Repentance and seeking forgiveness',
      'Train yourself for night prayer'
    ],
    prepAr: 'ضع خطة لشعبان: عدد أيام الصيام، وردّك من القرآن، وقيام الليل.',
    prepEn: "Make a Sha'ban plan: fasting days, daily Quran portion, night prayer.",
    specialDhikr: {
      ar: 'اللَّهُمَّ بَارِكْ لَنَا فِي شَعْبَانَ وَبَلِّغْنَا رَمَضَانَ',
      en: "O Allah, bless us in Sha'ban and let us reach Ramadan.",
      count: 'Daily',
      source: { ref: 'Common dua', url: '' }
    },
    sources: [
      { ref: "Sahih al-Bukhari 1969", url: 'https://sunnah.com/bukhari:1969' },
      { ref: "Sahih Muslim 1156", url: 'https://sunnah.com/muslim:1156' }
    ]
  },

  /* ─── 7. RAJAB BEGINS ─── */
  {
    id: 'rajab-begins',
    hijriDate: { month: 7, day: 1 },
    type: 'sacred',
    nameAr: 'بداية شهر رجب',
    nameEn: 'Beginning of Rajab',
    descAr: 'رجب من الأشهر الحرم الأربعة التي عظّمها الله: ذو القعدة، ذو الحجة، محرم، ورجب.',
    descEn: "Rajab is one of the four sacred months Allah has honoured: Dhul-Qa'dah, Dhul-Hijjah, Muharram, and Rajab.",
    virtueAr: 'قال تعالى: ﴿إِنَّ عِدَّةَ الشُّهُورِ عِندَ اللَّهِ اثْنَا عَشَرَ شَهْرًا فِي كِتَابِ اللَّهِ يَوْمَ خَلَقَ السَّمَاوَاتِ وَالْأَرْضَ مِنْهَا أَرْبَعَةٌ حُرُمٌ﴾.',
    virtueEn: 'Allah says: "Indeed, the number of months with Allah is twelve, of which four are sacred." (Quran 9:36)',
    actsAr: [
      'الإكثار من الصيام',
      'ترك المعاصي تعظيمًا للشهر الحرام',
      'الاستغفار',
      'الدعاء'
    ],
    actsEn: [
      'Increase in voluntary fasting',
      'Avoid sins, honouring the sacred month',
      'Seek forgiveness',
      'Make dua'
    ],
    prepAr: 'استعد لاستقبال الشهر الحرام بتوبة صادقة وترك المعاصي.',
    prepEn: 'Prepare to receive this sacred month with sincere repentance.',
    specialDhikr: {
      ar: 'اللَّهُمَّ بَارِكْ لَنَا فِي رَجَبٍ وَشَعْبَانَ وَبَلِّغْنَا رَمَضَانَ',
      en: "O Allah, bless us in Rajab and Sha'ban and let us reach Ramadan.",
      count: 'Daily',
      source: { ref: 'Common dua', url: '' }
    },
    sources: [
      { ref: 'Quran 9:36', url: 'https://quran.com/9/36' },
      { ref: 'Sahih al-Bukhari 4662', url: 'https://sunnah.com/bukhari:4662' }
    ]
  },

  /* ─── 8. RAMADAN BEGINS ─── */
  {
    id: 'ramadan-begins',
    hijriDate: { month: 9, day: 1 },
    type: 'major',
    nameAr: 'بداية شهر رمضان',
    nameEn: 'Beginning of Ramadan',
    descAr: 'شهر رمضان هو الشهر الذي أُنزل فيه القرآن، وفيه فُرض الصيام، وهو أفضل شهور السنة.',
    descEn: 'Ramadan is the month in which the Quran was revealed and fasting was ordained. It is the best month of the year.',
    virtueAr: 'قال تعالى: ﴿شَهْرُ رَمَضَانَ الَّذِي أُنزِلَ فِيهِ الْقُرْآنُ هُدًى لِّلنَّاسِ﴾. وقال النبي ﷺ: «من صام رمضان إيمانًا واحتسابًا غُفر له ما تقدم من ذنبه».',
    virtueEn: 'Allah says: "The month of Ramadan in which was revealed the Quran, a guidance for mankind." The Prophet ﷺ said: "Whoever fasts Ramadan out of faith, his previous sins are forgiven."',
    actsAr: [
      'صيام الشهر كاملًا',
      'قيام الليل والتراويح',
      'ختم القرآن أو ورد يومي',
      'الصدقة والإحسان',
      'الاعتكاف في العشر الأواخر'
    ],
    actsEn: [
      'Fast the full month',
      'Night prayer and Taraweeh',
      'Complete the Quran or a daily portion',
      'Charity and good deeds',
      "I'tikaf in the last 10 nights"
    ],
    prepAr: 'قبل رمضان: اقضِ ما عليك من صيام، صافح القلوب، ضع خطة قرآنية.',
    prepEn: 'Before Ramadan: make up missed fasts, reconcile hearts, plan your Quran portion.',
    specialDhikr: {
      ar: 'اللَّهُمَّ سَلِّمْنِي لِرَمَضَانَ، وَسَلِّمْ رَمَضَانَ لِي، وَتَسَلَّمْهُ مِنِّي مُتَقَبَّلًا',
      en: 'O Allah, keep me safe for Ramadan, keep Ramadan safe for me, and accept it from me.',
      count: "Daily in Sha'ban",
      source: { ref: 'Common dua', url: '' }
    },
    sources: [
      { ref: 'Quran 2:185', url: 'https://quran.com/2/185' },
      { ref: 'Sahih al-Bukhari 38', url: 'https://sunnah.com/bukhari:38' },
      { ref: 'Sahih Muslim 760', url: 'https://sunnah.com/muslim:760' }
    ]
  },

  /* ─── 9. LAYLAT AL-QADR ─── */
  {
    id: 'laylat-al-qadr',
    hijriDate: { month: 9, day: [21, 23, 25, 27, 29] },
    type: 'sacred',
    nameAr: 'ليلة القدر',
    nameEn: 'Laylat al-Qadr (Night of Decree)',
    descAr: 'أفضل ليلة في السنة، أُنزل فيها القرآن، وهي خير من ألف شهر. تُلتمس في العشر الأواخر من رمضان، وأرجى الليالي هي الوترية: 21، 23، 25، 27، 29.',
    descEn: 'The greatest night of the year — the night the Quran was revealed. It is better than a thousand months. Sought in the last ten nights of Ramadan, most likely on the odd nights.',
    virtueAr: 'قال تعالى: ﴿لَيْلَةُ الْقَدْرِ خَيْرٌ مِّنْ أَلْفِ شَهْرٍ﴾. من قامها إيمانًا واحتسابًا غُفر له ما تقدم من ذنبه.',
    virtueEn: 'Allah says: "The Night of Decree is better than a thousand months." Whoever stands in prayer out of faith has his previous sins forgiven.',
    actsAr: [
      'قيام الليل',
      'الدعاء: اللهم إنك عفو تحب العفو فاعف عني',
      'الاعتكاف',
      'قراءة القرآن',
      'الصدقة'
    ],
    actsEn: [
      'Night prayer',
      'The dua: "O Allah, You are Most Forgiving..."',
      "I'tikaf",
      'Recite Quran',
      'Give charity'
    ],
    prepAr: 'خطط للعشر الأواخر: خفف الانشغالات، ضع برنامج عبادي، واستعد للاعتكاف.',
    prepEn: "Plan the last ten nights: reduce distractions, prepare a worship schedule, set up I'tikaf.",
    specialDhikr: {
      ar: 'اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي',
      en: 'O Allah, You are Most Forgiving, and You love forgiveness; so forgive me.',
      count: 'Repeat abundantly, especially on odd nights',
      source: { ref: 'Sunan al-Tirmidhi 3513', url: 'https://sunnah.com/tirmidhi:3513' }
    },
    sources: [
      { ref: 'Quran 97:1-5', url: 'https://quran.com/97' },
      { ref: 'Sahih al-Bukhari 2017', url: 'https://sunnah.com/bukhari:2017' },
      { ref: 'Sunan al-Tirmidhi 3513', url: 'https://sunnah.com/tirmidhi:3513' }
    ]
  },

  /* ─── 10. LAST TEN NIGHTS ─── */
  {
    id: 'last-ten-ramadan',
    hijriDate: { month: 9, from: 21, to: 30 },
    type: 'sacred',
    nameAr: 'العشر الأواخر من رمضان',
    nameEn: 'Last Ten Nights of Ramadan',
    descAr: 'أعظم عشر ليالٍ في السنة، فيها ليلة القدر، وكان النبي ﷺ يشد فيها المئزر ويحيي الليل ويوقظ أهله.',
    descEn: 'The greatest ten nights of the year. They contain Laylat al-Qadr. The Prophet ﷺ would strive harder, stay awake, and wake his family.',
    virtueAr: 'قالت عائشة رضي الله عنها: «كان النبي ﷺ إذا دخل العشر شدَّ مئزره وأحيا ليله وأيقظ أهله».',
    virtueEn: 'Aisha said: "When the last ten nights entered, the Prophet ﷺ would tighten his belt, stay up at night, and wake his family."',
    actsAr: [
      'قيام الليل أطول ما يمكن',
      'الاعتكاف',
      'الإكثار من الذكر والدعاء',
      'قراءة القرآن',
      'الصدقة',
      'التوبة والاستغفار'
    ],
    actsEn: [
      'Longer night prayer',
      "I'tikaf",
      'Abundant dhikr and dua',
      'Recite Quran',
      'Give charity',
      'Repentance and seeking forgiveness'
    ],
    prepAr: 'قبل دخول العشر: جهّز خطة عبادة واضحة، وأخبر أهلك لتشاركهم الأجر.',
    prepEn: 'Before the ten nights: prepare a clear worship plan and inform your family.',
    specialDhikr: {
      ar: 'سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلَا إِلَهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ',
      en: 'Glory to Allah, praise to Allah, there is no god but Allah, and Allah is the Greatest.',
      count: 'Repeat abundantly',
      source: { ref: 'Sahih Muslim 2137', url: 'https://sunnah.com/muslim:2137' }
    },
    sources: [
      { ref: 'Sahih al-Bukhari 2024', url: 'https://sunnah.com/bukhari:2024' },
      { ref: 'Sahih Muslim 1174', url: 'https://sunnah.com/muslim:1174' }
    ]
  },

  /* ─── 11. EID AL-FITR ─── */
  {
    id: 'eid-fitr',
    hijriDate: { month: 10, day: 1 },
    type: 'major',
    nameAr: 'عيد الفطر',
    nameEn: 'Eid al-Fitr',
    descAr: 'أول أيام شوال، وهو عيد المسلمين بعد إتمام صيام رمضان. يبدأ بصلاة العيد، وتُخرج زكاة الفطر قبل الصلاة.',
    descEn: 'The first day of Shawwal, the celebration after completing the fast of Ramadan. It begins with the Eid prayer, and Zakat al-Fitr is given before the prayer.',
    virtueAr: 'قال النبي ﷺ: «إن لكل قوم عيدًا، وهذا عيدنا».',
    virtueEn: 'The Prophet ﷺ said: "Every people has its Eid, and this is our Eid."',
    actsAr: [
      'صلاة العيد',
      'إخراج زكاة الفطر قبل الصلاة',
      'التكبير من ليلة العيد حتى الصلاة',
      'صلة الأرحام',
      'الصدقة وإدخال الفرح على الأطفال'
    ],
    actsEn: [
      'Eid prayer',
      'Give Zakat al-Fitr before the prayer',
      'Takbir from the night before until the prayer',
      'Maintain family ties',
      'Charity and bringing joy to children'
    ],
    prepAr: 'أخرج زكاة الفطر قبل العيد بيوم أو يومين، وجهّز ملابس العيد.',
    prepEn: 'Give Zakat al-Fitr a day or two before Eid, and prepare Eid clothes.',
    specialDhikr: {
      ar: 'اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، لَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، وَلِلَّهِ الْحَمْدُ',
      en: 'Allah is the Greatest, Allah is the Greatest. There is no god but Allah. Allah is the Greatest, Allah is the Greatest, and to Allah belongs all praise.',
      count: 'Recite from Maghrib of Eid night until the Eid prayer',
      source: { ref: 'Common takbir', url: '' }
    },
    sources: [
      { ref: 'Sahih al-Bukhari 953', url: 'https://sunnah.com/bukhari:953' },
      { ref: 'Sunan Abu Dawud 1609', url: 'https://sunnah.com/abudawud:1609' }
    ]
  },

  /* ─── 12. FIRST 10 DHUL-HIJJAH ─── */
  {
    id: 'dhulhijjah-10',
    hijriDate: { month: 12, from: 1, to: 10 },
    type: 'sacred',
    nameAr: 'عشر ذي الحجة',
    nameEn: 'First 10 Days of Dhul-Hijjah',
    descAr: 'أفضل أيام السنة على الإطلاق، قال النبي ﷺ: «ما من أيام أعظم عند الله ولا أحب إليه العمل فيهن من هذه الأيام العشر».',
    descEn: 'The best days of the entire year. The Prophet ﷺ said: "There are no days greater with Allah or more beloved for good deeds than these ten days."',
    virtueAr: 'قال تعالى: ﴿وَيَذْكُرُوا اسْمَ اللَّهِ فِي أَيَّامٍ مَّعْلُومَاتٍ﴾.',
    virtueEn: 'Allah says: "And mention the name of Allah on known days." (Quran 22:28)',
    actsAr: [
      'الصيام في التسع الأوائل (ولا سيما يوم عرفة)',
      'الإكثار من الذكر والتكبير والتهليل والتحميد',
      'الأضحية',
      'الصدقة',
      'قيام الليل',
      'تلاوة القرآن'
    ],
    actsEn: [
      'Fast on the first nine days (especially Arafah)',
      'Abundant dhikr, takbir, tahlil, tahmid',
      'The sacrifice (udhiyah)',
      'Charity',
      'Night prayer',
      'Recite Quran'
    ],
    prepAr: 'قبل دخول الشهر: جهّز نية الأضحية، خطط لأيام الصيام، واكتب وردك من الذكر.',
    prepEn: 'Before the month: intend your sacrifice, plan your fasting days, set your daily dhikr portion.',
    specialDhikr: {
      ar: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
      en: 'There is no god but Allah alone, with no partner. His is the dominion and His is the praise, and He is capable of all things.',
      count: 'Say abundantly throughout the 10 days',
      source: { ref: 'Musnad Ahmad 5446', url: 'https://sunnah.com/' }
    },
    sources: [
      { ref: 'Sahih al-Bukhari 969', url: 'https://sunnah.com/bukhari:969' },
      { ref: 'Sunan al-Tirmidhi 3891', url: 'https://sunnah.com/tirmidhi:3891' },
      { ref: 'Quran 22:28', url: 'https://quran.com/22/28' }
    ]
  },

  /* ─── 13. DAY OF TARWIYAH ─── */
  {
    id: 'tarwiyah',
    hijriDate: { month: 12, day: 8 },
    type: 'recommended',
    nameAr: 'يوم التروية',
    nameEn: 'Day of Tarwiyah',
    descAr: 'اليوم الثامن من ذي الحجة، وفيه يبدأ الحجاج التوجه إلى منى. سمي بذلك لأن الناس كانوا يتروّون من الماء استعدادًا ليوم عرفة.',
    descEn: 'The 8th of Dhul-Hijjah. On this day, pilgrims travel to Mina. It is called "Tarwiyah" because people used to drink water in preparation for Arafah.',
    virtueAr: 'من أيام العشر العظيمة، ويُستحب صيامه لغير الحجاج.',
    virtueEn: 'One of the great ten days, and it is recommended to fast it for non-pilgrims.',
    actsAr: [
      'الصيام لغير الحجاج',
      'التكبير والتهليل',
      'الاستعداد ليوم عرفة',
      'الدعاء والاستغفار'
    ],
    actsEn: [
      'Fast (for non-pilgrims)',
      'Takbir and tahlil',
      'Prepare for the day of Arafah',
      'Dua and seeking forgiveness'
    ],
    prepAr: 'خطّط لصيام هذا اليوم، واستعد لقيام ليلة عرفة.',
    prepEn: 'Plan to fast this day and prepare for the night of Arafah.',
    specialDhikr: {
      ar: 'اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، لَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، وَلِلَّهِ الْحَمْدُ',
      en: 'Allah is the Greatest, Allah is the Greatest, there is no god but Allah, Allah is the Greatest, Allah is the Greatest, and to Allah belongs all praise.',
      count: 'Repeat continuously',
      source: { ref: 'Sahih al-Bukhari 969', url: 'https://sunnah.com/bukhari:969' }
    },
    sources: [
      { ref: 'Sahih al-Bukhari 969', url: 'https://sunnah.com/bukhari:969' }
    ]
  },

  /* ─── 14. DAY OF ARAFAH ─── */
  {
    id: 'arafah',
    hijriDate: { month: 12, day: 9 },
    type: 'major',
    nameAr: 'يوم عرفة',
    nameEn: 'Day of Arafah',
    descAr: 'أعظم يوم في السنة. فيه يقف الحجاج على جبل عرفة، وهو أفضل يوم عند الله، وفيه أُكمل الدين.',
    descEn: 'The greatest day of the year. Pilgrims stand at Mount Arafah. It is the best day with Allah, and on it the religion was completed.',
    virtueAr: 'قال النبي ﷺ: «صيام يوم عرفة أحتسب على الله أن يكفّر السنة التي قبله والسنة التي بعده». وقال: «ما من يوم أكثر من أن يعتق الله فيه عبيدًا من النار من يوم عرفة».',
    virtueEn: 'The Prophet ﷺ said: "Fasting Arafah expiates the sins of the year before and the year after." He also said: "There is no day on which Allah frees more people from the Fire than Arafah."',
    actsAr: [
      'الصيام لغير الحجاج',
      'الدعاء (أفضل الدعاء دعاء يوم عرفة)',
      'قيام ليلة عرفة',
      'التوبة النصوح',
      'الإكثار من الذكر والتهليل'
    ],
    actsEn: [
      'Fast (for non-pilgrims)',
      'Dua — the best dua is the dua of Arafah',
      'Night prayer on the night of Arafah',
      'Sincere repentance',
      'Abundant dhikr and tahlil'
    ],
    prepAr: 'أعد قائمة أدعيتك قبل يوم عرفة حتى لا تضيع الوقت.',
    prepEn: 'Prepare your dua list the day before Arafah so no time is wasted.',
    specialDhikr: {
      ar: 'لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ',
      en: 'There is no god but Allah alone, with no partner. His is the dominion and His is the praise, and He is capable of all things.',
      count: 'The best dua of Arafah — repeat abundantly',
      source: { ref: 'Sunan al-Tirmidhi 3585', url: 'https://sunnah.com/tirmidhi:3585' }
    },
    sources: [
      { ref: 'Sahih Muslim 1162', url: 'https://sunnah.com/muslim:1162' },
      { ref: 'Sahih Muslim 1348', url: 'https://sunnah.com/muslim:1348' },
      { ref: 'Sunan al-Tirmidhi 3585', url: 'https://sunnah.com/tirmidhi:3585' }
    ]
  },

  /* ─── 15. EID AL-ADHA ─── */
  {
    id: 'eid-adha',
    hijriDate: { month: 12, day: 10 },
    type: 'major',
    nameAr: 'عيد الأضحى',
    nameEn: 'Eid al-Adha',
    descAr: 'يوم النحر الأكبر، وهو عيد المسلمين في كل مكان، يبدأ بعد وقوف الحجاج بعرفة. فيه تُذبح الأضاحي تقربًا إلى الله.',
    descEn: 'The day of the greater sacrifice. It comes right after Arafah and is celebrated by Muslims everywhere. On this day, the udhiyah (sacrifice) is offered.',
    virtueAr: 'قال تعالى: ﴿فَصَلِّ لِرَبِّكَ وَانْحَرْ﴾. وذكر النبي ﷺ أنه أفضل الأيام عند الله.',
    virtueEn: 'Allah says: "So pray to your Lord and sacrifice." The Prophet ﷺ described it as the greatest day with Allah.',
    actsAr: [
      'صلاة العيد',
      'ذبح الأضحية',
      'التكبير',
      'صلة الأرحام',
      'الأكل والشرب من الأضحية',
      'الفرح وإدخال السرور على الأهل'
    ],
    actsEn: [
      'Eid prayer',
      'Offer the udhiyah',
      'Takbir',
      'Maintain family ties',
      'Eat from the sacrifice',
      'Rejoice and bring joy to your family'
    ],
    prepAr: 'قبل العيد: اختر الأضحية، وقسّم الأموال للصدقة، وجهّز زيارات الأهل.',
    prepEn: 'Before Eid: choose your sacrifice, divide money for charity, plan family visits.',
    specialDhikr: {
      ar: 'اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، لَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، وَلِلَّهِ الْحَمْدُ',
      en: 'Allah is the Greatest, Allah is the Greatest. There is no god but Allah. Allah is the Greatest, Allah is the Greatest, and to Allah belongs all praise.',
      count: 'From Fajr of Arafah until Asr of the 13th',
      source: { ref: 'Common takbir', url: '' }
    },
    sources: [
      { ref: 'Sahih al-Bukhari 957', url: 'https://sunnah.com/bukhari:957' },
      { ref: 'Sunan Abu Dawud 2784', url: 'https://sunnah.com/abudawud:2784' },
      { ref: 'Quran 108:2', url: 'https://quran.com/108/2' }
    ]
  },

  /* ─── 16. DAYS OF TASHREEQ ─── */
  {
    id: 'tashreeq',
    hijriDate: { month: 12, from: 11, to: 13 },
    type: 'recommended',
    nameAr: 'أيام التشريق',
    nameEn: 'Days of Tashreeq',
    descAr: 'الأيام الحادي عشر والثاني عشر والثالث عشر من ذي الحجة، وهي أيام أكل وشرب وذكر لله، ويحرم صيامها.',
    descEn: 'The 11th, 12th, and 13th of Dhul-Hijjah. They are days of eating, drinking, and remembering Allah. Fasting them is prohibited.',
    virtueAr: 'قال النبي ﷺ: «أيام التشريق أيام أكل وشرب وذكر لله».',
    virtueEn: 'The Prophet ﷺ said: "The days of Tashreeq are days of eating, drinking, and remembering Allah."',
    actsAr: [
      'الإكثار من التكبير',
      'الأكل والشرب (لا صيام)',
      'صلة الأرحام',
      'الذكر والدعاء'
    ],
    actsEn: [
      'Abundant takbir',
      'Eat and drink (no fasting)',
      'Maintain family ties',
      'Dhikr and dua'
    ],
    prepAr: 'لا تصم هذه الأيام، وأكثر من التكبير.',
    prepEn: 'Do not fast these days, and increase in takbir.',
    specialDhikr: {
      ar: 'اللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، لَا إِلَهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، اللَّهُ أَكْبَرُ، وَلِلَّهِ الْحَمْدُ',
      en: 'Allah is the Greatest, Allah is the Greatest. There is no god but Allah.',
      count: 'Repeat continuously',
      source: { ref: 'Sahih Muslim 1141', url: 'https://sunnah.com/muslim:1141' }
    },
    sources: [
      { ref: 'Sahih Muslim 1141', url: 'https://sunnah.com/muslim:1141' }
    ]
  },

  /* ─── 17. SACRED MONTHS ─── */
  {
    id: 'sacred-months',
    hijriDate: { month: 0, day: 1 },
    type: 'sacred',
    nameAr: 'الأشهر الحرم',
    nameEn: 'The Sacred Months',
    descAr: 'أربعة أشهر عظّمها الله: ذو القعدة، ذو الحجة، محرم، ورجب. يُضاعف فيها أجر الحسنات، ويُعظَّم فيها الإثم.',
    descEn: "Four months Allah has honoured: Dhul-Qa'dah, Dhul-Hijjah, Muharram, and Rajab. Good deeds are multiplied and sins are more serious in them.",
    virtueAr: 'قال تعالى: ﴿مِنْهَا أَرْبَعَةٌ حُرُمٌ ۚ ذَٰلِكَ الدِّينُ الْقَيِّمُ ۚ فَلَا تَظْلِمُوا فِيهِنَّ أَنفُسَكُمْ﴾.',
    virtueEn: 'Allah says: "Of them, four are sacred. That is the correct religion, so do not wrong yourselves during them." (Quran 9:36)',
    actsAr: [
      'الإكثار من الصيام',
      'ترك المعاصي',
      'الصدقة',
      'الدعاء والاستغفار'
    ],
    actsEn: [
      'Increase voluntary fasting',
      'Avoid sins',
      'Give charity',
      'Dua and seeking forgiveness'
    ],
    prepAr: 'اعرف هذه الأشهر وتعامل معها باحترام إيماني أعمق.',
    prepEn: 'Know these months and treat them with deeper faith-consciousness.',
    specialDhikr: {
      ar: 'سُبْحَانَ اللَّهِ وَالْحَمْدُ لِلَّهِ وَلَا إِلَهَ إِلَّا اللَّهُ وَاللَّهُ أَكْبَرُ',
      en: 'Glory to Allah, praise to Allah, there is no god but Allah, and Allah is the Greatest.',
      count: 'Repeat frequently',
      source: { ref: 'Sahih Muslim 2137', url: 'https://sunnah.com/muslim:2137' }
    },
    sources: [
      { ref: 'Quran 9:36', url: 'https://quran.com/9/36' }
    ]
  },

  /* ─── 18. FIRST 10 OF MUHARRAM ─── */
  {
    id: 'first-ten-muharram',
    hijriDate: { month: 1, from: 1, to: 10 },
    type: 'recommended',
    nameAr: 'أول عشر من محرم',
    nameEn: 'First Ten Days of Muharram',
    descAr: 'أيام مباركة في الشهر الحرام، ويوم عاشوراء (العاشر) من أفضل أيام الصيام.',
    descEn: 'Blessed days in the sacred month, with Ashura (the 10th) as one of the best days for fasting.',
    virtueAr: 'قال النبي ﷺ: «أفضل الصيام بعد رمضان شهر الله المحرم».',
    virtueEn: 'The Prophet ﷺ said: "The best fasting after Ramadan is the month of Allah, Muharram."',
    actsAr: [
      'الصيام',
      'الدعاء والاستغفار',
      'الصدقة',
      'قيام الليل'
    ],
    actsEn: [
      'Fasting',
      'Dua and seeking forgiveness',
      'Charity',
      'Night prayer'
    ],
    prepAr: 'خطط للصيام في هذه الأيام، خاصة التاسع والعاشر.',
    prepEn: 'Plan to fast these days, especially the 9th and 10th.',
    specialDhikr: {
      ar: 'اللَّهُمَّ بَارِكْ لَنَا فِي شَهْرِ مُحَرَّمٍ',
      en: 'O Allah, bless us in the month of Muharram.',
      count: 'Daily',
      source: { ref: 'Common dua', url: '' }
    },
    sources: [
      { ref: 'Sahih Muslim 1163', url: 'https://sunnah.com/muslim:1163' }
    ]
  },

  /* ─── 19. FRIDAY (JUMU'AH) ─── */
  {
    id: 'jumuah',
    hijriDate: { month: 0, day: 0, weekdays: [5] },
    type: 'weekly',
    nameAr: 'يوم الجمعة',
    nameEn: 'Friday (Jumu\'ah)',
    descAr: 'أفضل أيام الأسبوع، فيه صلاة الجمعة، وساعة استجابة، ويُستحب فيه الإكثار من الصلاة على النبي ﷺ.',
    descEn: 'The best day of the week. It has the Friday prayer, an hour of answered dua, and it is recommended to send abundant blessings on the Prophet ﷺ.',
    virtueAr: 'قال النبي ﷺ: «خير يوم طلعت عليه الشمس يوم الجمعة». وقال: «من صلى عليَّ يوم الجمعة عشرًا صلى الله عليه مائةً من الرحمة».',
    virtueEn: 'The Prophet ﷺ said: "The best day on which the sun rises is Friday."',
    actsAr: [
      'الاغتسال والتطيب',
      'صلاة الجمعة',
      'الإكثار من الصلاة على النبي ﷺ',
      'قراءة سورة الكهف',
      'الدعاء في آخر ساعة قبل المغرب'
    ],
    actsEn: [
      'Ghusl and perfume',
      'The Friday prayer',
      'Abundant salawat on the Prophet ﷺ',
      'Recite Surah al-Kahf',
      'Dua in the last hour before Maghrib'
    ],
    prepAr: 'استعد من الخميس: اغتسل، جهّز ملابسك، واقرأ سورة الكهف صباح الجمعة.',
    prepEn: 'Prepare from Thursday: bathe, ready your clothes, and recite Surah al-Kahf on Friday morning.',
    specialDhikr: {
      ar: 'اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ وَعَلَى آلِ مُحَمَّدٍ',
      en: 'O Allah, send blessings upon Muhammad and upon the family of Muhammad.',
      count: 'Abundantly throughout Friday',
      source: { ref: 'Sunan Abu Dawud 1047', url: 'https://sunnah.com/abudawud:1047' }
    },
    sources: [
      { ref: 'Sahih Muslim 854', url: 'https://sunnah.com/muslim:854' },
      { ref: 'Sunan Abu Dawud 1047', url: 'https://sunnah.com/abudawud:1047' }
    ]
  },

  /* ─── 20. MONDAY & THURSDAY FASTS ─── */
  {
    id: 'monday-thursday',
    hijriDate: { month: 0, day: 0, weekdays: [1, 4] },
    type: 'recommended',
    nameAr: 'صيام الإثنين والخميس',
    nameEn: 'Monday & Thursday Fasts',
    descAr: 'كان النبي ﷺ يصوم الإثنين والخميس، وسُئل عن ذلك فقال: «إنهما يومان تُعرض فيهما الأعمال على الله».',
    descEn: 'The Prophet ﷺ used to fast Mondays and Thursdays. He said: "They are two days on which deeds are presented to Allah."',
    virtueAr: 'من صام الإثنين والخميس كان له أجر عظيم، وهو من السنن المؤكدة.',
    virtueEn: 'Great reward for fasting Monday and Thursday — an emphasised Sunnah.',
    actsAr: [
      'الصيام',
      'الذكر والاستغفار',
      'الصدقة'
    ],
    actsEn: [
      'Fast',
      'Dhikr and seeking forgiveness',
      'Charity'
    ],
    prepAr: 'اجعل الإثنين والخميس عادة أسبوعية ثابتة.',
    prepEn: 'Make Monday and Thursday a fixed weekly habit.',
    specialDhikr: {
      ar: 'سُبْحَانَ اللَّهِ وَبِحَمْدِهِ',
      en: 'Glory to Allah and praise to Him.',
      count: 'Repeat abundantly',
      source: { ref: 'Sahih Muslim 2692', url: 'https://sunnah.com/muslim:2692' }
    },
    sources: [
      { ref: 'Sunan al-Tirmidhi 747', url: 'https://sunnah.com/tirmidhi:747' }
    ]
  },

  /* ─── 21. LAST DAY OF SHA'BAN ─── */
  {
    id: 'last-shaban',
    hijriDate: { month: 8, day: 29 },
    type: 'reflection',
    nameAr: 'آخر يوم من شعبان',
    nameEn: "Last Day of Sha'ban",
    descAr: 'آخر يوم قبل رمضان، فرصة أخيرة للاستعداد. اختلف العلماء في صيام يوم الشك إذا لم تثبت الرؤية.',
    descEn: "The day before Ramadan — the last chance to prepare. Scholars differ on fasting the day of doubt if the moon hasn't been sighted.",
    virtueAr: 'قال النبي ﷺ: «لا تقدموا رمضان بصوم يوم ولا يومين، إلا رجل كان يصوم صومًا فليصمه».',
    virtueEn: 'The Prophet ﷺ said: "Do not precede Ramadan by fasting a day or two, except a man who is used to a fast, let him fast it."',
    actsAr: [
      'التوبة والاستغفار',
      'إعداد خطة رمضان',
      'قضاء الصيام الفائت',
      'قراءة القرآن'
    ],
    actsEn: [
      'Repentance and seeking forgiveness',
      'Prepare your Ramadan plan',
      'Make up missed fasts',
      'Recite Quran'
    ],
    prepAr: 'أكمل استعدادك: قضِ الصيام، ضع الخطة، وجهّز نفسك روحيًا.',
    prepEn: 'Complete your preparation: make up fasts, set your plan, prepare yourself spiritually.',
    specialDhikr: {
      ar: 'اللَّهُمَّ بَلِّغْنَا رَمَضَانَ',
      en: 'O Allah, let us reach Ramadan.',
      count: 'Daily',
      source: { ref: 'Common dua', url: '' }
    },
    sources: [
      { ref: 'Sahih al-Bukhari 1914', url: 'https://sunnah.com/bukhari:1914' }
    ]
  }

];

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

/* Find events happening ON a specific Hijri date */
function getEventsForHijriDate(month, day, gregorianDate){
  return HIJRI_EVENTS.filter(ev => {
    const d = ev.hijriDate;
    if(!d) return false;

    /* Weekday-based events (weekly: Friday, Monday/Thursday) */
    if(Array.isArray(d.weekdays) && gregorianDate){
      return d.weekdays.includes(gregorianDate.getDay());
    }

    /* If event has weekdays but no date provided, skip */
    if(Array.isArray(d.weekdays) && !gregorianDate){
      return false;
    }

    /* Specific day match */
    if(d.day === day && d.month === month) return true;

    /* Match across all months (month 0 = any) */
    if(d.month === 0 && Array.isArray(d.day) && d.day.includes(day)) return true;

    return false;
  });
}


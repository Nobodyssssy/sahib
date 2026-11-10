/* Home scene: original flat-vector scenery that follows the current prayer phase.
   No bitmap assets. Phase boundaries come from the day's timetable (Duha = sunrise+15 min to Dhuhr-5 min). */
(function(){
  const PHASES = ['fajr','sunrise','doha','dhuhr','asr','maghrib','isha'];

  const P = {
    fajr:    {sky:['#243556','#6f8cae','#efdcb0'], far:'#62799a', mid:'#3a4f70', tree:'#24334c', ground:'#1b2840', sun:null, stars:.55, lit:.0, ink:'#ffffff'},
    sunrise: {sky:['#5b80ae','#f0b07a','#f8d99c'], far:'#d4977a', mid:'#8a5d5c', tree:'#4a3944', ground:'#382b37', sun:{x:760,y:110,r:34,c:'#ffe7aa'}, stars:0, lit:.0, ink:'#26191a'},
    doha:    {sky:['#78b0de','#bfdcec','#f4e8bb'], far:'#9ab9a7', mid:'#6b9381', tree:'#3d6954', ground:'#2e5946', sun:{x:760,y:58,r:30,c:'#fff2b8'}, stars:0, lit:.0, ink:'#13281f'},
    dhuhr:   {sky:['#3f9be6','#9fd0f3','#d8eefb'], far:'#86c0ae', mid:'#4c9780', tree:'#2b6c54', ground:'#245f49', sun:{x:700,y:68,r:32,c:'#fffdf0', rays:true}, stars:0, lit:.0, ink:'#0f2c35'},
    asr:     {sky:['#6a9fce','#e7c58d','#f6d391'], far:'#c8a679', mid:'#8d7851', tree:'#485839', ground:'#3a492f', sun:{x:860,y:96,r:32,c:'#ffd98a'}, stars:0, lit:.0, ink:'#1d2418'},
    maghrib: {sky:['#473d78','#d9705c','#f7b469'], far:'#86486a', mid:'#4b2d56', tree:'#2d2044', ground:'#221a37', sun:{x:760,y:112,r:40,c:'#ffcf7a'}, stars:.12, lit:.8, ink:'#ffffff'},
    isha:    {sky:['#0c1330','#1b284f','#2a3a66'], far:'#1d2849', mid:'#131b37', tree:'#0b1126', ground:'#090e1f', sun:null, moon:{x:980,y:52,r:20,c:'#f4ecd0'}, stars:.95, lit:1, ink:'#ffffff'}
  };

  function rng(seed){ let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

  function tree(x, h, base){
    const w = 7 + h * .06;
    return `M${x - w} ${base}Q${x - w - 2} ${base - h * .5} ${x} ${base - h}Q${x + w + 2} ${base - h * .5} ${x + w} ${base}Z`;
  }

  function homeSceneSVG(phase){
    const p = P[phase] || P.isha, id = 'hs-' + phase, base = 150;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 200" preserveAspectRatio="xMidYMax slice" focusable="false" aria-hidden="true">`;
    out += `<defs><linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset=".62" stop-color="${p.sky[1]}"/><stop offset="1" stop-color="${p.sky[2]}"/></linearGradient>`;
    if(p.moon) out += `<mask id="${id}-m"><rect width="1600" height="200" fill="#fff"/><circle cx="${p.moon.x + p.moon.r * .55}" cy="${p.moon.y - p.moon.r * .2}" r="${p.moon.r * .9}" fill="#000"/></mask>`;
    out += `</defs><rect width="1600" height="200" fill="url(#${id}-sky)"/>`;

    if(p.stars){
      const r = rng(phase.length * 977 + 13), n = phase === 'isha' ? 46 : 18;
      for(let i = 0; i < n; i++){
        const x = Math.round(r() * 1600), y = Math.round(r() * (phase === 'isha' ? 110 : 55)), s = r() > .85 ? 1.8 : 1.1;
        out += `<circle cx="${x}" cy="${y}" r="${s}" fill="#fff" opacity="${(p.stars * (.5 + r() * .5)).toFixed(2)}"/>`;
      }
    }
    if(p.sun){
      const s = p.sun;
      if(s.rays){
        for(let i = 0; i < 16; i++){
          const a = i * Math.PI / 8, r1 = s.r + 10, r2 = s.r + (i % 2 ? 26 : 40);
          out += `<line x1="${(s.x + Math.cos(a) * r1).toFixed(1)}" y1="${(s.y + Math.sin(a) * r1).toFixed(1)}" x2="${(s.x + Math.cos(a) * r2).toFixed(1)}" y2="${(s.y + Math.sin(a) * r2).toFixed(1)}" stroke="${s.c}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`;
        }
      }
      out += `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${s.c}"/>`;
    }
    if(p.moon) out += `<circle cx="${p.moon.x}" cy="${p.moon.y}" r="${p.moon.r}" fill="${p.moon.c}" mask="url(#${id}-m)"/>`;

    out += `<path d="M0 150C150 110 300 125 450 118S750 100 900 122 1250 105 1400 118 1550 110 1600 120V200H0Z" fill="${p.far}"/>`;
    out += `<path d="M0 166C200 140 380 155 600 150S1000 138 1250 152 1500 148 1600 154V200H0Z" fill="${p.mid}" opacity=".7"/>`;

    /* mosque silhouette, right third */
    out += `<g fill="${p.mid}">`
      + `<rect x="1180" y="118" width="120" height="34"/>`
      + `<path d="M1190 118C1190 90 1215 78 1240 78S1290 90 1290 118Z"/>`
      + `<rect x="1239" y="64" width="2" height="14"/><circle cx="1240" cy="63" r="3"/>`
      + `<rect x="1324" y="72" width="12" height="80"/><rect x="1320" y="70" width="20" height="4"/><path d="M1324 70L1330 48 1336 70Z"/>`
      + `<rect x="1144" y="80" width="12" height="72"/><rect x="1140" y="78" width="20" height="4"/><path d="M1144 78L1150 58 1156 78Z"/>`
      + `<path d="M1160 130a20 20 0 0 1 40 0Z"/><path d="M1280 130a20 20 0 0 1 40 0Z"/>`
      + `</g>`;
    if(p.lit){
      out += `<g fill="#ffd98a" opacity="${p.lit}">`
        + `<rect x="1224" y="128" width="4" height="10" rx="2"/><rect x="1238" y="128" width="4" height="10" rx="2"/><rect x="1252" y="128" width="4" height="10" rx="2"/>`
        + `<rect x="1328" y="96" width="4" height="8" rx="2"/><rect x="1148" y="102" width="4" height="8" rx="2"/></g>`;
    }

    const trees = [[960,62],[1012,84],[1070,52],[1396,72],[1440,98],[1500,58],[1552,70]];
    out += `<g fill="${p.tree}">${trees.map(t => `<path d="${tree(t[0], t[1], base + 6)}"/>`).join('')}</g>`;
    out += `<path d="M0 176C220 160 420 170 640 166S1040 158 1280 168 1520 164 1600 170V200H0Z" fill="${p.ground}"/>`;
    return out + '</svg>';
  }

  function _mins(hm){
    if(typeof hm !== 'string') return null;
    const m = hm.match(/(\d{1,2}):(\d{2})/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  /* Current phase from today's timings object ({Fajr,Sunrise,Dhuhr,Asr,Maghrib,Isha}). */
  function homeScenePhase(timings, now){
    if(window._homeScenePhaseForce && PHASES.includes(window._homeScenePhaseForce)) return window._homeScenePhaseForce;
    if(!timings) return 'isha';
    const d = now || new Date(), n = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    const f = _mins(timings.Fajr), sr = _mins(timings.Sunrise), dh = _mins(timings.Dhuhr), as = _mins(timings.Asr), mg = _mins(timings.Maghrib), is = _mins(timings.Isha);
    if([f, sr, dh, as, mg, is].some(v => v == null)) return 'isha';
    if(n < f) return 'isha';
    if(n < sr) return 'fajr';
    if(n < Math.min(sr + 15, dh - 5)) return 'sunrise';
    if(n < dh - 5) return 'doha';
    if(n < as) return 'dhuhr';
    if(n < mg) return 'asr';
    if(n < is) return 'maghrib';
    return 'isha';
  }

  const LABEL = {
    fajr:['Fajr','الفجر'], sunrise:['Sunrise','الشروق'], doha:['Duha','الضحى'], dhuhr:['Dhuhr','الظهر'],
    asr:['Asr','العصر'], maghrib:['Maghrib','المغرب'], isha:['Isha','العشاء']
  };
  const NEXT = {fajr:'Sunrise', sunrise:'Dhuhr', doha:'Dhuhr', dhuhr:'Asr', asr:'Maghrib', maghrib:'Isha', isha:'Fajr'};
  const NEXT_AR = {Sunrise:'الشروق', Dhuhr:'الظهر', Asr:'العصر', Maghrib:'المغرب', Isha:'العشاء', Fajr:'الفجر'};

  /* "Dhuhr · until Asr 14:42" (decorative strip also carries its meaning as text). */
  function homeSceneLabel(phase, timings, ar){
    const nx = NEXT[phase], t = timings && timings[nx] ? String(timings[nx]).slice(0, 5) : '';
    const name = LABEL[phase][ar ? 1 : 0];
    if(!t) return name;
    return ar ? `${name} · حتى ${NEXT_AR[nx]} ${t}` : `${name} · until ${nx} ${t}`;
  }

  function refreshHomeScene(){
    const sec = document.querySelector('.garden-welcome');
    if(!sec) return;
    const timings = window._homeSceneTimings || null;
    const phase = homeScenePhase(timings);
    if(sec.dataset.phase !== phase){
      sec.dataset.phase = phase;
      const box = sec.querySelector('.garden-scene');
      if(box) box.innerHTML = homeSceneSVG(phase);
    }
    const lab = document.getElementById('garden-scene-phase');
    if(lab) lab.textContent = homeSceneLabel(phase, timings, window.SAHIB_I18N?.language === 'ar');
  }

  window.homeSceneSVG = homeSceneSVG;
  window.homeScenePhase = homeScenePhase;
  window.homeSceneLabel = homeSceneLabel;
  window.refreshHomeScene = refreshHomeScene;
  window.HOME_SCENE_PHASES = PHASES;
  setInterval(refreshHomeScene, 30000);
  document.addEventListener('visibilitychange', refreshHomeScene);
  window.addEventListener('focus', refreshHomeScene);
})();

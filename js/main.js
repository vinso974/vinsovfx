/* VIN'SO VFX — logique principale */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Préloader : barre de rendu ---------- */
  var preloader = document.getElementById('preloader');
  var fill = document.getElementById('preloader-fill');
  var pct = document.getElementById('preloader-pct');
  var disciplinesEl = document.getElementById('preloader-disciplines');
  var disciplines = ['RÉALISATION', 'MONTAGE', 'ÉTALONNAGE', 'VFX', 'COMPOSITING', 'SOUND DESIGN'];
  var progress = 0, di = 0;

  var discTimer = setInterval(function () {
    di = (di + 1) % disciplines.length;
    if (disciplinesEl) disciplinesEl.textContent = disciplines[di];
  }, 320);

  function finishPreloader() {
    clearInterval(discTimer);
    if (preloader) preloader.classList.add('done');
    document.body.classList.add('is-ready');
  }

  // Progression simulée bornée : 2,2 s max, termine dès que la page est chargée
  var loadDone = false;
  window.addEventListener('load', function () { loadDone = true; });
  var tick = setInterval(function () {
    progress += loadDone ? 34 : 9;
    if (progress >= 100) { progress = 100; clearInterval(tick); setTimeout(finishPreloader, 250); }
    if (fill) fill.style.width = progress + '%';
    if (pct) pct.textContent = progress + '%';
  }, 120);
  // Sécurité : jamais bloquer plus de 4 s
  setTimeout(function () { clearInterval(tick); finishPreloader(); }, 4000);

  /* ---------- Header : heure locale + météo (sans géolocalisation) ---------- */
  var ltHeader = document.getElementById('local-time-header');
  var lwHeader = document.getElementById('local-weather-header');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function updateClock() {
    var d = new Date();
    var str = pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (ltHeader) ltHeader.textContent = str;
  }
  updateClock();
  setInterval(updateClock, 20000);
  /* Météo : position approximative via l'adresse IP (aucune permission demandée), données Open-Meteo */
  var WMO = {0:'Dégagé',1:'Éclaircies',2:'Nuageux',3:'Couvert',45:'Brouillard',48:'Brouillard',51:'Bruine',53:'Bruine',55:'Bruine',56:'Bruine verglaçante',57:'Bruine verglaçante',61:'Pluie',63:'Pluie',65:'Pluie',66:'Pluie verglaçante',67:'Pluie verglaçante',71:'Neige',73:'Neige',75:'Neige',77:'Neige',80:'Averses',81:'Averses',82:'Averses',85:'Neige',86:'Neige',95:'Orage',96:'Orage',99:'Orage'};
  /* Ville approximative via l'adresse IP (aucune permission demandée), avec repli si le 1er service échoue */
  function geoLookup() {
    return fetch('https://ipapi.co/json/').then(function (r) { return r.json(); }).then(function (loc) {
      if (loc && loc.latitude && loc.longitude) return { city: loc.city || '', lat: loc.latitude, lon: loc.longitude };
      throw 0;
    }).catch(function () {
      return fetch('https://ipwho.is/').then(function (r) { return r.json(); }).then(function (loc) {
        if (loc && loc.success !== false && loc.latitude && loc.longitude) return { city: loc.city || '', lat: loc.latitude, lon: loc.longitude };
        throw 0;
      });
    });
  }
  function updateWeather() {
    if (!('fetch' in window)) return;
    geoLookup().then(function (g) {
      return fetch('https://api.open-meteo.com/v1/forecast?latitude=' + g.lat + '&longitude=' + g.lon + '&current=temperature_2m,weather_code&timezone=auto').then(function (r) { return r.json(); }).then(function (w) {
        if (!w || !w.current) throw 0;
        var t = Math.round(w.current.temperature_2m);
        var label = WMO[w.current.weather_code] || '';
        var city = g.city ? g.city + ' · ' : '';
        if (lwHeader) lwHeader.textContent = city + t + '°' + (label ? ' · ' + label : '');
      });
    }).catch(function () { /* météo indisponible : on garde juste l'heure */ });
  }
  updateWeather();
  setInterval(updateWeather, 1800000);

  /* ---------- Timecode du hero (faux compteur d'origine, inchangé) ---------- */
  var tcHero = document.getElementById('timecode-hero');
  var start = Date.now();
  function updateTC() {
    var el = (Date.now() - start) / 1000;
    var f = Math.floor((el % 1) * 25);
    var s = Math.floor(el % 60), m = Math.floor(el / 60 % 60), h = Math.floor(el / 3600);
    if (tcHero) tcHero.textContent = pad(h) + ':' + pad(m) + ':' + pad(s) + ':' + pad(f);
  }
  if (!reduceMotion) setInterval(updateTC, 40); else updateTC();

  /* ---------- Marquee : duplication pour boucle infinie ---------- */
  var track = document.getElementById('marquee-track');
  if (track && !reduceMotion) {
    track.innerHTML += track.innerHTML;
    track.innerHTML += track.innerHTML;
  }

  /* ---------- Reveals au scroll ---------- */
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Navigation active ---------- */
  var navLinks = document.querySelectorAll('.site-nav a');
  var sections = ['realisations', 'services', 'processus', 'contact'].map(function (id) {
    return document.getElementById(id);
  }).filter(Boolean);
  if ('IntersectionObserver' in window) {
    var nio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          navLinks.forEach(function (a) {
            a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id);
          });
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(function (s) { nio.observe(s); });
  }

  /* ---------- Menu burger (mobile) ---------- */
  var burger = document.getElementById('nav-burger');
  var siteNav = document.getElementById('site-nav');
  if (burger && siteNav) {
    function setNav(open) {
      document.body.classList.toggle('nav-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    }
    burger.addEventListener('click', function () {
      setNav(!document.body.classList.contains('nav-open'));
    });
    siteNav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setNav(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setNav(false);
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 900) setNav(false);
    });
  }

  /* ---------- Filtres + compteur ---------- */
  var filterBtns = document.querySelectorAll('.filter-btn');
  var works = Array.prototype.slice.call(document.querySelectorAll('.work'));
  var countEl = document.getElementById('works-count');
  var catNames = { clip: 'clip(s)', photo: 'visuel(s) photo', pochette: 'pochette(s) d\u2019album', video: 'vidéo(s)' };

  function updateCount(filter) {
    var visible = works.filter(function (w) { return !w.classList.contains('is-hidden'); });
    var label = filter === 'all' ? 'r\u00e9alisation(s)' : (catNames[filter] || '');
    if (countEl) countEl.textContent = '— ' + visible.length + ' ' + label + ' —';
  }

  filterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filterBtns.forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      var f = btn.getAttribute('data-filter');
      works.forEach(function (w) {
        var show = f === 'all' || w.getAttribute('data-cat') === f;
        w.classList.toggle('is-hidden', !show);
      });
      /* masquer les sous-blocs (catégories) sans carte visible */
      document.querySelectorAll('.works-group').forEach(function (g) {
        var anyVisible = Array.prototype.some.call(
          g.querySelectorAll('.work'),
          function (w) { return !w.classList.contains('is-hidden'); }
        );
        g.classList.toggle('is-hidden', !anyVisible);
      });
      updateCount(f);
    });
  });
  updateCount('all');

  /* ---------- Bascule grille / liste ---------- */
  var viewBtns = document.querySelectorAll('.view-btn');
  var worksEls = document.querySelectorAll('.works');
  viewBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      viewBtns.forEach(function (b) { b.classList.remove('is-active'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      var v = btn.getAttribute('data-view');
      worksEls.forEach(function (we) {
        we.classList.toggle('works-list', v === 'list');
        we.classList.toggle('works-grid', v !== 'list');
      });
    });
  });

  /* ---------- Overlays : vidéo + image ---------- */
  var videoOverlay = document.getElementById('video-overlay');
  var videoPlayer = document.getElementById('video-player');
  var videoTitle = document.getElementById('video-overlay-title');
  var imageOverlay = document.getElementById('image-overlay');
  var lightboxImg = document.getElementById('lightbox-img');
  var imageTitle = document.getElementById('image-overlay-title');
  var lastFocus = null;

  function openOverlay(overlay) {
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    var closeBtn = overlay.querySelector('.overlay-close');
    if (closeBtn) closeBtn.focus();
  }
  function closeOverlays() {
    [videoOverlay, imageOverlay].forEach(function (o) { o.hidden = true; });
    videoPlayer.innerHTML = '';
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.querySelectorAll('[data-close]').forEach(function (el) {
    el.addEventListener('click', closeOverlays);
  });
  document.addEventListener('keydown', function (e) {
    var open = !videoOverlay.hidden ? videoOverlay : (!imageOverlay.hidden ? imageOverlay : null);
    if (!open) return;
    if (e.key === 'Escape') { closeOverlays(); return; }
    /* Piège focus : Tab reste dans la visionneuse ouverte */
    if (e.key === 'Tab') {
      var focusables = open.querySelectorAll('button, a[href], video[controls], iframe');
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  document.querySelectorAll('.work').forEach(function (work) {
    var btn = work.querySelector('.work-media');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var type = work.getAttribute('data-type');
      var title = work.getAttribute('data-title') || 'Réalisation';
      if (type === 'video') {
        var id = work.getAttribute('data-yt');
        videoTitle.textContent = title.toUpperCase();
        videoPlayer.innerHTML = '<iframe src="https://www.youtube.com/embed/' + id +
          '?autoplay=1&rel=0" title="' + title.replace(/"/g, '') +
          '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>';
        openOverlay(videoOverlay);
      } else if (type === 'local-video') {
        var src = work.getAttribute('data-src');
        var cardVideo = btn.querySelector('video');
        videoTitle.textContent = title.toUpperCase();
        videoPlayer.innerHTML = '<video src="' + src + '" controls autoplay loop playsinline' +
          (cardVideo && cardVideo.poster ? ' poster="' + cardVideo.poster + '"' : '') + '></video>';
        openOverlay(videoOverlay);
      } else {
        var img = btn.querySelector('img');
        imageTitle.textContent = title.toUpperCase();
        lightboxImg.src = img.currentSrc || img.src;
        lightboxImg.alt = img.alt;
        openOverlay(imageOverlay);
      }
    });
  });

  /* ---------- E-mail copiable ---------- */
  var emailBtn = document.getElementById('email-copy');
  var emailHint = document.getElementById('email-hint');
  if (emailBtn) {
    emailBtn.addEventListener('click', function () {
      var address = 'vinsovfx@gmail.com';
      function done() {
        if (emailHint) emailHint.textContent = '✓ ADRESSE COPIÉE DANS LE PRESSE-PAPIERS';
        setTimeout(function () { if (emailHint) emailHint.textContent = ''; }, 3000);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(address).then(done, function () {
          window.location.href = 'mailto:' + address; done();
        });
      } else {
        window.location.href = 'mailto:' + address; done();
      }
    });
  }

  /* ---------- Hero 3D : chargement conditionnel ---------- */
  var hero = document.getElementById('hero');
  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!reduceMotion && webglOK()) {
    var s = document.createElement('script');
    s.type = 'module';
    s.src = 'js/hero3d.js';
    s.onerror = function () { hero.classList.add('no-webgl'); };
    document.body.appendChild(s);
    // Sécurité : si le module ne répond pas en 6 s, fallback statique
    setTimeout(function () {
      if (!hero.classList.contains('webgl-ready')) hero.classList.add('no-webgl');
    }, 6000);
  } else {
    hero.classList.add('no-webgl');
  }

  /* ---------- Scroll-vidéo : les 4 séquences pilotées au scroll ---------- */
  var scrollvids = document.querySelectorAll('section.scrollvid');
  if (scrollvids.length) {
    if (!reduceMotion) {
      var s2 = document.createElement('script');
      s2.src = 'js/scrollvideo.js';
      s2.onerror = function () {
        scrollvids.forEach(function (s) { s.classList.add('no-webgl'); });
      };
      document.body.appendChild(s2);
      // Sécurité : si une vidéo ne répond pas en 6 s, poster statique
      setTimeout(function () {
        scrollvids.forEach(function (s) {
          if (!s.classList.contains('webgl-ready')) s.classList.add('no-webgl');
        });
      }, 6000);
    } else {
      scrollvids.forEach(function (s) { s.classList.add('no-webgl'); });
    }
  }
})();

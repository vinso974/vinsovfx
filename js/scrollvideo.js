/* VIN'SO VFX — Scroll-vidéo : vidéos pilotées au scroll, sans texte.
   Un seul driver pour les 4 séquences du « Voyage dans la caméra » :
     - ANATOMIE   : 1 vidéo, sens normal  (caméra qui se déconstruit)
     - ENTRAILLES : 2 vidéos, relais à 50 % (capteur → circuits → châssis)
     - CAPTEUR    : 1 vidéo, sens normal  (la plongée se termine sur l'œil)
     - ÉPILOGUE   : 1 vidéo, sens INVERSÉ (la caméra se reconstruit)
   Configuration via data-attributes sur <section class="scrollvid"> :
     data-src / data-src2 : URL des vidéos | data-split : point de relais (0-1)
     data-reverse="1"     : scrub inversé
   Fiabilité mobile : chaque vidéo (~3 Mo) est téléchargée en mémoire (blob)
   quand sa section approche — seeks instantanés, même sur iOS. Repli :
   lecture progressive si le fetch échoue ; poster statique si pas de JS /
   mouvement réduit / vidéo inaccessible (.no-webgl). */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function clamp01(x) { return Math.min(Math.max(x, 0), 1); }

  /* Cache des blobs : anatomie et épilogue partagent la même vidéo —
     un seul téléchargement pour les deux sections. */
  var blobCache = {};

  /* ---------- Un scrubber par élément <video> (file de seeks, iOS-safe) ---------- */
  function Scrubber(video, done) {
    this.video = video;
    this.duration = 0;
    this.target = 0;
    this.lastSeek = -1;
    this.ready = false;
    this.seeking = false;
    this.pendingT = null;
    this.seekTimer = null;
    this.visible = true;
    this.reported = false;
    var self = this;
    function report(ok) {
      if (self.reported) return;
      self.reported = true;
      if (done) done(ok);
    }
    this.report = report;
    video.addEventListener('seeked', function () { self.releaseSeek(); });
    video.addEventListener('error', function () { self.report(false); }, true);
  }
  Scrubber.prototype.releaseSeek = function () {
    this.seeking = false;
    if (this.seekTimer) { clearTimeout(this.seekTimer); this.seekTimer = null; }
    if (this.pendingT !== null) { var p = this.pendingT; this.pendingT = null; this.requestSeek(p); }
  };
  Scrubber.prototype.requestSeek = function (t) {
    if (this.seeking) { this.pendingT = t; return; }
    if (Math.abs(t - this.lastSeek) < 1 / 30) return;
    this.seeking = true;
    this.lastSeek = t;
    try { this.video.currentTime = t; } catch (e) { this.releaseSeek(); return; }
    var self = this;
    this.seekTimer = setTimeout(function () { self.releaseSeek(); }, 300);
  };
  Scrubber.prototype.applyTarget = function () {
    if (!this.ready || !this.duration || !this.visible) return;
    var t = Math.min(this.target * this.duration, Math.max(this.duration - 0.05, 0));
    this.requestSeek(t);
  };
  Scrubber.prototype.loadBlob = function (url) {
    var self = this, video = this.video;
    function onMeta() {
      video.removeEventListener('loadedmetadata', onMeta);
      if (video.duration && isFinite(video.duration)) {
        self.duration = video.duration;
        self.ready = true;
        try { video.currentTime = 0.01; } catch (e) { /* ignore */ }
        self.lastSeek = 0.01;
        self.report(true);
      } else { self.report(false); }
    }
    function progressive() {
      if (video.readyState >= 1 && video.duration && isFinite(video.duration)) {
        self.duration = video.duration; self.ready = true;
        try { video.currentTime = 0.01; } catch (e) { /* ignore */ }
        self.lastSeek = 0.01;
        self.report(true);
      } else {
        video.addEventListener('loadedmetadata', onMeta);
        try { video.load(); } catch (e) { /* ignore */ }
        setTimeout(function () { if (!self.ready) self.report(false); }, 12000);
      }
    }
    if (!url || !window.fetch) { progressive(); return; }
    function useBlobURL(blobURL) {
      video.src = blobURL;
      video.addEventListener('loadedmetadata', onMeta);
      video.load();
    }
    if (blobCache[url]) {
      blobCache[url].then(useBlobURL).catch(progressive);
      return;
    }
    blobCache[url] = fetch(url).then(function (res) {
      if (!res.ok) throw new Error('http ' + res.status);
      return res.blob();
    }).then(function (blob) {
      if (!blob || !blob.size) throw new Error('empty');
      return URL.createObjectURL(blob);
    });
    blobCache[url].then(useBlobURL).catch(function () {
      delete blobCache[url];
      progressive();
    });
  };

  /* ---------- Une section = 1 ou 2 scrubbers + mapping du scroll ---------- */
  function initSection(section) {
    var videos = Array.prototype.slice.call(section.querySelectorAll('video.scrollvid-video'));
    if (!videos.length) return;
    var reverse = section.getAttribute('data-reverse') === '1';
    var split = parseFloat(section.getAttribute('data-split') || '0.5');
    if (!(split > 0 && split < 1)) split = 0.5;
    var dual = videos.length > 1;

    var readyCount = 0, failed = false, started = false;

    function setReady(ok) {
      if (failed) return;
      if (!ok) {
        failed = true;
        section.classList.add('no-webgl');
        return;
      }
      readyCount++;
      if (readyCount === videos.length && !started) {
        started = true;
        section.classList.remove('no-webgl');
        section.classList.add('webgl-ready');
        onScroll();
      }
    }

    var scrubbers = videos.map(function (v, i) {
      var s = new Scrubber(v, setReady);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          s.visible = entries[0].isIntersecting;
        }, { threshold: 0 }).observe(section);
      }
      return s;
    });

    /* Légende « scan » : révélée par le passage du scan, effacée à la suite du scroll */
    var caption = section.querySelector('.scrollvid-caption');
    var capText = caption ? caption.querySelector('.caption-text') : null;
    var capScan = caption ? caption.querySelector('.caption-scan') : null;
    function renderCaption(p) {
      if (!caption) return;
      var reveal = clamp01(p / 0.22); // le scan écrit le texte
      if (capText) capText.style.clipPath = 'inset(0 0 ' + (100 - reveal * 100).toFixed(1) + '% 0)';
      if (capScan) {
        if (reveal < 1) {
          capScan.style.opacity = '1';
          capScan.style.top = (reveal * 100).toFixed(1) + '%';
        } else {
          capScan.style.opacity = '0';
        }
      }
      var fade = 1 - clamp01((p - 0.32) / 0.18); // le texte disparaît au scroll
      caption.style.opacity = fade.toFixed(3);
      caption.style.transform = 'translateY(' + ((1 - fade) * -26).toFixed(1) + 'px)';
    }

    function progress() {
      var r = section.getBoundingClientRect();
      var total = Math.max(r.height - window.innerHeight, 1);
      return clamp01(-r.top / total);
    }

    var ticking = false;
    /* Anti-déchirure : pendant un scroll très rapide (fling), la vidéo garde
       sa dernière image nette au lieu d'enchaîner des seeks que le décodeur
       n'arrive pas à suivre (frames coupées en deux). Elle se repositionne
       proprement dès que le scroll ralentit. */
    var lastP = -1, lastT = 0;
    function render() {
      ticking = false;
      var p = progress();
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      var vel = 0;
      if (lastP >= 0) {
        var dt = Math.max(now - lastT, 1) / 1000;
        vel = Math.abs(p - lastP) / dt;
      }
      lastP = p; lastT = now;
      var fling = vel > 2;
      renderCaption(p);
      if (!started) return;
      if (dual) {
        var a = scrubbers[0], b = scrubbers[1];
        if (p <= split) {
          var pa = clamp01(p / split);
          a.target = reverse ? 1 - pa : pa;
          a.video.style.opacity = '1';
          b.video.style.opacity = '0';
        } else {
          var pb = clamp01((p - split) / (1 - split));
          b.target = reverse ? 1 - pb : pb;
          /* fondu court autour du point de relais (les deux plans se ressemblent) */
          var f = clamp01((p - split) / 0.06);
          a.video.style.opacity = String(1 - f);
          b.video.style.opacity = String(f);
        }
        if (!fling) { a.applyTarget(); b.applyTarget(); }
      } else {
        var s = scrubbers[0];
        s.target = reverse ? 1 - p : p;
        if (!fling) s.applyTarget();
      }
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(render); }
    }

    /* Le scroll pilote la légende dès le chargement ; la vidéo suit dès qu'elle est prête */
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();

    /* Chargement paresseux : on télécharge quand la section approche */
    var srcs = videos.map(function (v) {
      var s = v.querySelector('source');
      return s ? s.getAttribute('src') : null;
    });
    var loaded = false;
    function loadAll() {
      if (loaded) return;
      loaded = true;
      scrubbers.forEach(function (s, i) { s.loadBlob(srcs[i]); });
      /* Sécurité : le délai court à partir du début du téléchargement (pas du chargement de la page),
         sinon les sections lointaines basculaient en poster statique avant même d'être approchées. */
      setTimeout(function () { if (!started && !failed) section.classList.add('no-webgl'); }, 20000);
    }
    if (reduceMotion) { section.classList.add('no-webgl'); return; }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { loadAll(); io.disconnect(); }
      }, { rootMargin: '120% 0px 120% 0px', threshold: 0 });
      io.observe(section);
    } else {
      loadAll();
    }
  }

  document.querySelectorAll('section.scrollvid').forEach(initSection);
})();

/* VIN'SO VFX — Hero 3D : travelling à travers les réalisations.
   Chargé uniquement si WebGL disponible et pas de prefers-reduced-motion.
   En cas d'échec : bascule vers le poster statique (classe .no-webgl). */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

(function () {
  var hero = document.getElementById('hero');
  var canvas = document.getElementById('hero-canvas');
  var planLabel = document.getElementById('hero-plan');
  if (!hero || !canvas) return;

  function fail() { hero.classList.add('no-webgl'); }

  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (e) { fail(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x0b0b0d, 1);

  var scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0b0d, 0.038);

  var camera = new THREE.PerspectiveCamera(55, 1, 0.1, 120);
  camera.position.set(0, 0.4, 8);

  // ---- Cadres : les vraies images du studio ----
  // ---- Cadres : les vraies images du studio, classées par catégorie ----
  // Un seul couloir bien droit : un cadre centré par plan, espacés régulièrement.
  var shots = [
    { src: 'assets/img/hero-desert-clean.jpg',      label: 'PLAN 01 — TRAVELLING' },
    { src: 'assets/img/weezyang-rwipiT.jpg',        label: 'PLAN 02 — CLIP' },
    { src: 'assets/img/faz-mdroumche.jpg',          label: 'PLAN 03 — CLIP' },
    { src: 'assets/img/weezyang-tooshdid.jpg',      label: 'PLAN 04 — CLIP' },
    { src: 'assets/img/real-strawberry-hq.jpg?v=2',    label: 'PLAN 05 — PRODUIT' },
    { src: 'assets/img/real-pokka-melon-entier.jpg?v=2', label: 'PLAN 06 — PRODUIT' },
    { src: 'assets/img/real-abu-fruity.jpg?v=2',        label: 'PLAN 07 — PRODUIT' },
    { src: 'assets/img/pochette-chevalier.jpg?v=2',    label: 'PLAN 08 — POCHETTE' },
    { src: 'assets/img/pochette-spirit-ice.jpg?v=2',   label: 'PLAN 09 — POCHETTE' },
    { src: 'assets/img/pochette-rak-portail.jpg?v=2',   label: 'PLAN 10 — POCHETTE' }
  ];
  var SPACING = 7.5; // distance régulière entre deux plans

  var manager = new THREE.LoadingManager();
  var loader = new THREE.TextureLoader(manager);
  loader.setCrossOrigin('anonymous');
  var frames = [];
  var loaded = 0, errored = 0;

  shots.forEach(function (shot, i) {
    var z = -i * SPACING;
    var x = 0;      // couloir strictement centré : fini le zigzag
    var y = 0.35;
    var H = 3.8;    // hauteur commune des cadres
    var W = 6.2;    // largeur par défaut (16:10), ajustée au vrai format dès le chargement

    // Cadre (bordure sombre derrière l'image) — plans unitaires, mis à l'échelle
    var frameGeo = new THREE.PlaneGeometry(1, 1);
    var frameMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1f });
    var frame = new THREE.Mesh(frameGeo, frameMat);
    frame.scale.set(W + 0.4, H + 0.4, 1);
    frame.position.set(x, y, z - 0.02);

    // Image — jamais rognée : le cadre épouse son format réel
    var imgGeo = new THREE.PlaneGeometry(1, 1);
    var imgMat = new THREE.MeshBasicMaterial({ color: 0x222226 }); // gris d'attente
    var img = new THREE.Mesh(imgGeo, imgMat);
    img.scale.set(W, H, 1);
    img.position.set(x, y, z);

    // Liseré ambre sous le cadre (signature projecteur)
    var edgeGeo = new THREE.PlaneGeometry(1, 1);
    var edgeMat = new THREE.MeshBasicMaterial({ color: 0xe8a33d });
    var edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.scale.set(W + 0.4, 0.07, 1);
    edge.position.set(x, y - H / 2 - 0.08, z - 0.01);

    scene.add(frame); scene.add(img); scene.add(edge);
    frames.push({ z: z, label: shot.label, mesh: img, mat: imgMat });

    loader.load(shot.src,
      function (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        // Format réel de l'image : le cadre s'adapte, AUCUN rognage
        var ar = tex.image.width / tex.image.height;
        var w = Math.min(6.8, Math.max(2.4, H * ar));
        img.scale.set(w, H, 1);
        frame.scale.set(w + 0.4, H + 0.4, 1);
        edge.scale.set(w + 0.4, 0.07, 1);
        imgMat.map = tex; imgMat.color.set(0xffffff); imgMat.needsUpdate = true;
        loaded++;
      },
      undefined,
      function () { errored++; }
    );
  });

  manager.onLoad = startIfReady;
  manager.onError = function () { /* les erreurs unitaires sont comptées ; onLoad tranche */ };
  setTimeout(startIfReady, 5000); // ne jamais attendre indéfiniment

  var started = false;
  function startIfReady() {
    if (started) return;
    if (loaded === 0 && (loaded + errored) < shots.length) return; // encore en cours
    started = true;
    if (loaded === 0) { fail(); return; }
    hero.classList.add('webgl-ready');
    requestAnimationFrame(loop);
  }

  // ---- Poussières de projecteur ----
  var dustCount = 260;
  var dustGeo = new THREE.BufferGeometry();
  var dustPos = new Float32Array(dustCount * 3);
  for (var d = 0; d < dustCount; d++) {
    dustPos[d * 3] = (Math.random() - 0.5) * 22;
    dustPos[d * 3 + 1] = (Math.random() - 0.5) * 10;
    dustPos[d * 3 + 2] = 8 - Math.random() * 50;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  var dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe8a33d, size: 0.045, transparent: true, opacity: 0.55 }));
  scene.add(dust);

  // ---- Pilotage : scroll + souris ----
  var scrollP = 0, mouseX = 0, mouseY = 0, smx = 0, smy = 0;
  function onScroll() {
    var r = hero.getBoundingClientRect();
    // Progression sur toute la hauteur du hero : le travelling dure
    // tout le temps que le hero reste à l'écran.
    var total = Math.max(r.height, 1);
    scrollP = Math.min(Math.max(-r.top / total, 0), 1);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('pointermove', function (e) {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });

  function onResize() {
    var w = hero.clientWidth || window.innerWidth;
    var h = hero.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  onResize(); onScroll();

  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: 0 }).observe(hero);
  }

  var lastPlan = '';
  function frameDist() {
    // Distance pour que le cadre le plus large (~7 unités) tienne en entier
    // dans la largeur d'écran — sur mobile (écran étroit), la caméra recule.
    var a = camera.aspect || 1;
    var need = 7 / (2 * Math.tan(55 * Math.PI / 360) * a);
    return Math.max(8, need + 2);
  }
  function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;

    // Travelling : la caméra avance dans le couloir au fil du scroll du hero
    var dist = frameDist();
    var camZ = dist - scrollP * ((shots.length - 1) * SPACING);
    smx += (mouseX - smx) * 0.045;
    smy += (mouseY - smy) * 0.045;
    camera.position.set(smx * 1.4, 0.4 - smy * 0.7, camZ);
    camera.lookAt(smx * 0.7, 0.3, camZ - dist);

    // Poussières dérivantes
    var pos = dust.geometry.attributes.position;
    for (var i = 0; i < dustCount; i++) {
      pos.array[i * 3 + 1] += 0.004;
      if (pos.array[i * 3 + 1] > 5) pos.array[i * 3 + 1] = -5;
    }
    pos.needsUpdate = true;

    // Label du plan courant : suit la progression du scroll (01 → 10 en séquence)
    var idx = Math.min(frames.length - 1, Math.round(scrollP * (frames.length - 1)));
    var label = shots[idx] ? shots[idx].label : '';
    if (label && label !== lastPlan && planLabel) {
      planLabel.textContent = label;
      lastPlan = label;
    }

    renderer.render(scene, camera);
  }
})();

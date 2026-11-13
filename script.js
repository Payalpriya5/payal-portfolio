/* ============================================================
   Portfolio motion script (GSAP + ScrollTrigger)
   Everything is visible by default. Animations only enhance it,
   so the page still works if the CDN is blocked.
   ============================================================ */
(function () {
  // show the visitor's own photo (assets/profile.jpg|jpeg|png|webp) when it exists
  (function () {
    const exts = ['jpg', 'jpeg', 'png', 'webp'];
    let i = 0;
    const next = () => {
      if (i >= exts.length) return;
      const u = 'assets/profile.' + exts[i++];
      const im = new Image();
      im.onload = () => { document.documentElement.style.setProperty('--photo', "url('" + u + "')"); document.body.classList.add('has-photo'); };
      im.onerror = next;
      im.src = u;
    };
    next();
  })();
  'use strict';

  /* ---------- Always-on basics (no GSAP needed) ---------- */
  const nav = document.querySelector('.nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Smooth anchor scrolling done in JS (CSS scroll-behavior:smooth breaks ScrollTrigger)
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const t = id.length > 1 ? document.querySelector(id) : null;
      if (!t) return;
      e.preventDefault();
      window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 40, behavior: 'smooth' });
    });
  });

  // FAQ accordion (works without GSAP)
  document.querySelectorAll('.faq-item').forEach((item) => {
    const q = item.querySelector('.faq-q');
    const a = item.querySelector('.faq-a');
    q.addEventListener('click', () => {
      const open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach((o) => {
        o.classList.remove('open');
        o.querySelector('.faq-a').style.height = '0px';
      });
      if (!open) {
        item.classList.add('open');
        a.style.height = a.scrollHeight + 'px';
      }
    });
    a.style.transition = 'height .45s cubic-bezier(.2,.7,.2,1)';
  });

  // Services: hover / tap to switch
  const svcs = document.querySelectorAll('.svc');
  const desc = document.getElementById('svcDesc');
  const art = document.getElementById('svcArt');
  const artNum = document.getElementById('svcArtNum');
  const palettes = [
    'linear-gradient(160deg,#e23a56,#ff7a45)',
    'linear-gradient(160deg,#98000d,#e23a56)',
    'linear-gradient(160deg,#1b1030,#c0313f)',
    'linear-gradient(160deg,#ff7a45,#ac2c37)',
    'linear-gradient(160deg,#3a0810,#e23a56)',
    'linear-gradient(160deg,#c9525c,#98000d)',
    'linear-gradient(160deg,#ac2c37,#ff7a45)',
    'linear-gradient(160deg,#1b1030,#98000d)'
  ];
  // mobile: each item carries its own description + picture tile (opens inline under the title)
  svcs.forEach((s) => {
    const i = +s.dataset.img;
    const m = document.createElement('div');
    m.className = 'svc-m';
    const img = s.dataset.art;
    m.innerHTML = '<p>' + s.dataset.desc + '</p><div class="svc-m-art' + (img ? ' has-img' : '') + '" style="background:' + (img ? "url(" + img + ") center/cover no-repeat, " : '') + palettes[i] + '"><span>' + String(i + 1).padStart(2, '0') + '</span></div>';
    s.appendChild(m);
  });
  // ===== Expertise tile: WebGL "liquid" image engine ======================================
  // One shader draws the picture: noisy liquid dissolve between items (with a warm glow along the
  // edge), a lens that bulges under the cursor, RGB-split that reacts to mouse speed, slow idle
  // wave + breathing zoom, film grain, and a noise-mask reveal on first scroll-in.
  // If WebGL is missing (or "reduce motion" is on) the plain image layers below are used instead.
  const mk = (c) => { const d = document.createElement('div'); d.className = c; return d; };
  const par = mk('svc-par'), drift = mk('svc-drift'), layA = mk('svc-layer'), layB = mk('svc-layer');
  const gloss = mk('svc-gloss'), sweep = mk('svc-sweep');
  drift.append(layA, layB); par.append(drift);
  art.prepend(par); art.append(gloss, sweep);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hoverOK = window.matchMedia('(hover:hover)').matches;

  const VS = 'attribute vec2 a;varying vec2 vUv;void main(){vUv=a*.5+.5;gl_Position=vec4(a,0.,1.);}';
  const FS = `precision highp float;
varying vec2 vUv;
uniform sampler2D t0,t1;
uniform vec2 s0,s1,mouse,dir,res;
uniform float p,time,hover,reveal,vel;
float hash(vec2 q){return fract(sin(dot(q,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 q){vec2 i=floor(q),f=fract(q);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 q){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(q);q*=2.02;a*=.5;}return v;}
vec3 chroma(sampler2D t,vec2 s,vec2 uv,vec2 off){
  vec2 c=vec2(.5);
  float r=texture2D(t,(uv+off-c)*s+c).r;
  float g=texture2D(t,(uv-c)*s+c).g;
  float b=texture2D(t,(uv-off-c)*s+c).b;
  return vec3(r,g,b);}
void main(){
  vec2 uv=vUv;
  // idle: breathing zoom + gentle wave
  uv=(uv-.5)*(.955-.018*sin(time*.45))+.5;
  uv+=.0028*vec2(sin(uv.y*7.+time*.8),cos(uv.x*7.+time*.7));
  // cursor: parallax + magnifying lens
  uv+=(mouse-.5)*(-.035)*hover;
  vec2 d=uv-mouse;
  float r=length(d*vec2(1.,.68));
  float lens=exp(-r*r*13.);
  uv-=d*lens*.10*hover;
  // liquid dissolve between the two pictures
  float n=fbm(vUv*3.2+vec2(time*.05,time*.03));
  float edge=p*1.5-.25;
  float mkOld=smoothstep(edge-.18,edge+.18,vUv.x*.75+n*.5);
  float w=sin(p*3.14159);
  vec2 disp=vec2(n-.5,noise(vUv*4.+3.)-.5)*.06*w;
  vec2 off=dir*(.0007+.012*vel);
  vec3 c0=chroma(t0,s0,uv+disp*mkOld,off);
  vec3 c1=chroma(t1,s1,uv-disp*(1.-mkOld),off);
  vec3 col=mix(c1,c0,mkOld);
  // warm glow riding the dissolve edge
  float glow=1.-abs(mkOld*2.-1.);
  col+=vec3(1.,.48,.27)*glow*w*.3;
  // cursor sheen
  col+=hover*.13*lens*vec3(1.,.92,.88);
  // film grain (matches the illustrations)
  col+=(hash(vUv*res+fract(time))-.5)*.035;
  // first scroll-in reveal through the same noise
  float h=n*.6+vUv.y*.4;
  float a=smoothstep(h-.15,h+.15,reveal*1.3-.15);
  gl_FragColor=vec4(col*a,a);
}`;

  function initGL() {
    if (reduce) return null;
    const cv = document.createElement('canvas');
    cv.className = 'svc-gl';
    const gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    if (!gl) return null;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {};
    ['t0', 't1', 's0', 's1', 'mouse', 'dir', 'res', 'p', 'time', 'hover', 'reveal', 'vel'].forEach((k) => (U[k] = gl.getUniformLocation(prog, k)));
    gl.uniform1i(U.t0, 0); gl.uniform1i(U.t1, 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const cache = {};
    function load(src) {
      if (cache[src]) return cache[src];
      cache[src] = new Promise((res) => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => {
          const tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); } catch (e) { res(null); return; }
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          res({ tex, ar: im.naturalWidth / im.naturalHeight });
        };
        im.onerror = () => res(null);
        im.src = src;
      });
      return cache[src];
    }

    document.querySelectorAll('.svc[data-art]').forEach((li) => load(li.dataset.art));
    const st = { p: 0, reveal: 0, mx: 0.5, my: 0.5, tx: 0.5, ty: 0.5, hover: 0, ht: 0, vel: 0, dx: 1, dy: 0 };
    let A = null, B = null, tween = null, visible = false, raf = 0, shown = false, w = 0, h = 0, token = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(2, Math.round(art.clientWidth * dpr)); h = Math.max(2, Math.round(art.clientHeight * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      gl.viewport(0, 0, w, h);
    }
    const cover = (ar) => { const ca = w / h; return ca > ar ? [1, ar / ca] : [ca / ar, 1]; };

    function frame(t) {
      raf = 0;
      if (!visible || !A) return;
      // smooth pointer, hover and speed
      const px = st.mx, py = st.my;
      st.mx += (st.tx - st.mx) * 0.09; st.my += (st.ty - st.my) * 0.09;
      st.hover += (st.ht - st.hover) * 0.07;
      const sp = Math.hypot(st.mx - px, st.my - py) * 40;
      st.vel += (Math.min(sp, 1) - st.vel) * 0.12;
      if (sp > 0.002) { const l = Math.hypot(st.mx - px, st.my - py) || 1; st.dx = (st.mx - px) / l; st.dy = (st.my - py) / l; }
      const s0 = cover(A.ar), s1 = cover((B || A).ar);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.tex);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, (B || A).tex);
      gl.uniform2f(U.s0, s0[0], s0[1]); gl.uniform2f(U.s1, s1[0], s1[1]);
      gl.uniform2f(U.mouse, st.mx, st.my); gl.uniform2f(U.dir, st.dx, st.dy); gl.uniform2f(U.res, w, h);
      gl.uniform1f(U.p, st.p); gl.uniform1f(U.time, t / 1000); gl.uniform1f(U.hover, st.hover);
      gl.uniform1f(U.reveal, st.reveal); gl.uniform1f(U.vel, st.vel);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

    new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible && !shown && A) { shown = true; window.gsap ? gsap.to(st, { reveal: 1, duration: 1.9, ease: 'power2.out' }) : (st.reveal = 1); }
      kick();
    }, { threshold: 0.2 }).observe(art);
    new ResizeObserver(resize).observe(art);
    resize();
    art.prepend(cv);

    return {
      go(src, animate) {
        const my = ++token;                       // ignore stale loads when scrolling fast
        load(src).then((t) => {
          if (my !== token) return;
          if (!t) { art.classList.remove('gl'); cv.style.display = 'none'; showImage(src, animate); return; }   // WebGL texture blocked: use DOM layers
          if (!A) {
            A = t; B = null;
            if (visible && !shown) { shown = true; window.gsap ? gsap.to(st, { reveal: 1, duration: 1.9, ease: 'power2.out' }) : (st.reveal = 1); }
            if (!animate && shown === false && !visible) st.reveal = 0;
            kick(); return;
          }
          if (!window.gsap) { A = t; B = null; st.p = 0; kick(); return; }
          if (tween) { tween.kill(); A = st.p > 0.5 ? B : A; st.p = 0; }
          B = t; st.p = 0;
          tween = gsap.to(st, { p: 1, duration: 0.95, ease: 'power2.inOut', onComplete: () => { A = B; B = null; st.p = 0; tween = null; } });
          kick();
        });
      },
      mouse(nx, ny) { st.tx = nx; st.ty = 1 - ny; st.ht = 1; kick(); },
      leave() { st.ht = 0; st.tx = 0.5; st.ty = 0.5; }
    };
  }
  const GL = initGL();
  if (GL) art.classList.add('gl');

  let cur = layA;
  function showImage(src, animate) {                // fallback layers (no WebGL / reduced motion)
    const next = cur === layA ? layB : layA, prev = cur;
    next.style.backgroundImage = 'url(' + src + ')';
    cur = next;
    if (!window.gsap) { next.style.opacity = 1; prev.style.opacity = 0; return; }
    gsap.killTweensOf([next, prev, sweep]);
    gsap.set(next, { zIndex: 2 }); gsap.set(prev, { zIndex: 1 });
    if (animate && !reduce) {
      gsap.fromTo(next, { opacity: 0, scale: 1.22, rotation: 1.6 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.95, ease: 'power3.out' });
      gsap.to(prev, { opacity: 0, scale: 0.94, duration: 0.95, ease: 'power2.inOut' });
      gsap.fromTo(sweep, { xPercent: -160, opacity: 1, skewX: -18 }, { xPercent: 430, duration: 1.05, ease: 'power2.inOut', onComplete: () => gsap.set(sweep, { opacity: 0 }) });
    } else {
      gsap.set(next, { opacity: 1, scale: 1, rotation: 0 }); gsap.set(prev, { opacity: 0 });
    }
  }
  function applyArt(el, animate) {
    const i = +el.dataset.img, src = el.dataset.art;
    art.style.background = palettes[i];
    art.classList.toggle('has-img', !!src);
    if (!src) { layA.style.opacity = 0; layB.style.opacity = 0; return; }
    if (GL) GL.go(src, animate); else showImage(src, animate);
  }
  const first = document.querySelector('.svc.active');
  if (first) applyArt(first, false);

  // idle drift + cursor motion: the shader handles it in WebGL mode, DOM layers otherwise
  if (window.gsap && !reduce) {
    if (!GL) gsap.to(drift, { scale: 1.06, x: '1.2%', y: '-1%', duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    if (hoverOK) {
      const px = gsap.quickTo(par, 'x', { duration: 0.6, ease: 'power3' }), py = gsap.quickTo(par, 'y', { duration: 0.6, ease: 'power3' });
      art.addEventListener('mousemove', (e) => {
        const r = art.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width, ny = (e.clientY - r.top) / r.height;
        gsap.to(art, { rotationY: (nx - 0.5) * 8, rotationX: -(ny - 0.5) * 8, transformPerspective: 900, duration: 0.5, ease: 'power2.out', overwrite: 'auto' });
        if (GL) GL.mouse(nx, ny);
        else {
          px(-(nx - 0.5) * 28); py(-(ny - 0.5) * 20);
          art.style.setProperty('--gx', nx * 100 + '%'); art.style.setProperty('--gy', ny * 100 + '%'); gloss.style.opacity = 1;
        }
      });
      art.addEventListener('mouseleave', () => {
        gsap.to(art, { rotationX: 0, rotationY: 0, duration: 0.9, ease: 'elastic.out(1,.6)', overwrite: 'auto' });
        if (GL) GL.leave(); else { px(0); py(0); gloss.style.opacity = 0; }
      });
    }
  }
  function setService(el) {
    svcs.forEach((s) => s.classList.remove('active'));
    el.classList.add('active');
    const i = +el.dataset.img;
    desc.textContent = el.dataset.desc;
    applyArt(el, true);
    artNum.textContent = String(i + 1).padStart(2, '0');
    if (window.gsap) {
      gsap.fromTo(desc, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
      gsap.fromTo(artNum, { scale: 0.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' });
    }
  }
  let svcPin = null;                      // set while the scroll-driven (pinned) mode is on
  svcs.forEach((s, i) => {
    s.addEventListener('mouseenter', () => { if (!svcPin) setService(s); });
    s.addEventListener('click', () => {
      if (!svcPin) { setService(s); return; }
      // pinned mode: jump the scroll to this item's step
      window.scrollTo({ top: svcPin.start + ((i + 0.5) / svcs.length) * (svcPin.end - svcPin.start), behavior: 'smooth' });
    });
  });

  // Reel: plays by itself when it opens, with music. Browsers only allow sound after a first tap/click/key,
  // so if sound is blocked it starts muted and switches the music on at the visitor's first interaction.
  const reelVideo = document.querySelector('.reel-video');
  const reelSnd = document.querySelector('.reel-snd');
  let reelWantSound = true, reelArmed = false;
  function paintSnd() {
    if (!reelSnd || !reelVideo) return;
    const on = !reelVideo.muted;
    reelSnd.classList.toggle('on', on);
    reelSnd.setAttribute('aria-pressed', String(on));
    reelSnd.setAttribute('aria-label', on ? 'Mute sound' : 'Turn sound on');
    reelSnd.title = on ? 'Mute' : 'Unmute';
  }
  function armUnmute() {
    if (reelArmed) return; reelArmed = true;
    const evs = ['pointerdown', 'keydown', 'touchend'];
    const go = (e) => {
      if (e.target && e.target.closest && e.target.closest('.reel-snd')) return;
      if (reelWantSound && reelVideo.muted) { reelVideo.muted = false; paintSnd(); }
      evs.forEach((n) => window.removeEventListener(n, go, true)); reelArmed = false;
    };
    evs.forEach((n) => window.addEventListener(n, go, true));
  }
  function startReel() {
    if (!reelVideo) return;
    reelVideo.muted = !reelWantSound;
    reelVideo.play().then(paintSnd).catch(() => {
      reelVideo.muted = true;
      reelVideo.play().then(() => { paintSnd(); if (reelWantSound) armUnmute(); }).catch(() => {});
    });
  }
  if (reelSnd && reelVideo) {
    reelSnd.addEventListener('click', () => {
      reelWantSound = reelVideo.muted;            // muted now -> turn sound on; playing with sound -> turn off
      reelVideo.muted = !reelWantSound;
      if (reelVideo.paused) reelVideo.play().catch(() => {});
      paintSnd();
    });
  }

  // Tools orbit: readout line + reveal when scrolled into view (no GSAP needed)
  (function () {
    const stack = document.getElementById('tools');
    const out = document.getElementById('stackReadout');
    if (!stack || !out) return;
    const idle = '> hover a node to inspect';
    document.querySelectorAll('.node').forEach((n) => {
      n.addEventListener('mouseenter', () => { out.textContent = '> ' + n.dataset.n + '  //  ' + n.dataset.c; });
      n.addEventListener('mouseleave', () => { out.textContent = idle; });
      n.addEventListener('click', () => { out.textContent = '> ' + n.dataset.n + '  //  ' + n.dataset.c; });
    });
    if ('IntersectionObserver' in window) {
      stack.classList.add('pre');
      const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { stack.classList.remove('pre'); io.disconnect(); } }, { threshold: 0.15 });
      io.observe(stack);
      setTimeout(() => stack.classList.remove('pre'), 6000);
    }
  })();

  // FAQ as a scroll tunnel: the section pins and each question flies toward you as you scroll
  (function () {
    const sec = document.getElementById('faq');
    const wrap = sec && sec.querySelector('.faq-wrap');
    if (!wrap) return;
    const items = [...sec.querySelectorAll('.faq-item')].map((it) => ({
      q: it.querySelector('.faq-q span').textContent.trim(),
      a: it.querySelector('.faq-a p').textContent.trim()
    }));
    if (!items.length) return;
    sec.classList.add('faq-js');
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const M = items.length + 1;                         // questions + a closing "still curious?" step
    const tunnel = document.createElement('div');
    tunnel.className = 'tunnel';
    tunnel.style.height = 'calc(100vh + ' + (M - 1) * 75 + 'vh)';
    tunnel.innerHTML =
      '<div class="tunnel-stage">' +
        '<div class="tn-bg"><span>?</span></div><div class="tn-grid"></div>' +
        '<div class="tn-top"><span>FAQ</span><span class="tn-line"><i></i></span><span class="tn-pos"></span></div>' +
        '<div class="tn-scene">' +
          items.map((it, i) => '<article class="tn-item"><span class="tn-n">' + String(i + 1).padStart(2, '0') + '</span><h3 class="tn-q">' + esc(it.q) + '</h3><p class="tn-a">' + esc(it.a) + '</p></article>').join('') +
          '<article class="tn-item"><span class="tn-n">?</span><h3 class="tn-q">Still curious?</h3><p class="tn-a">Ask me directly. I read every message and reply personally.</p><a class="tn-cta" href="#contact">Send me a message &rarr;</a></article>' +
        '</div>' +
        '<div class="tn-ticks">' + Array.from({ length: M }, (_, i) => '<button type="button" aria-label="Go to question ' + (i + 1) + '">' + (i < M - 1 ? String(i + 1).padStart(2, '0') : '?') + '</button>').join('') + '</div>' +
        '<div class="tn-hint"><i></i>SCROLL</div>' +
      '</div>';
    sec.appendChild(tunnel);
    const stage = tunnel.querySelector('.tunnel-stage');
    const els = [...tunnel.querySelectorAll('.tn-item')];
    const answers = els.map((e) => e.querySelector('.tn-a'));
    const ticks = [...tunnel.querySelectorAll('.tn-ticks button')];
    const bg = tunnel.querySelector('.tn-bg span');
    const bar = tunnel.querySelector('.tn-line i');
    const pos = tunnel.querySelector('.tn-pos');
    const hint = tunnel.querySelector('.tn-hint');
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const pinTop = () => parseFloat(getComputedStyle(stage).top) || 0;
    const range = () => tunnel.offsetHeight - stage.offsetHeight;
    const raw = () => clamp((pinTop() - tunnel.getBoundingClientRect().top) / Math.max(1, range()), 0, 1);
    function render(p) {                      // p runs 0 .. M-1 (fractional while between questions)
      els.forEach((el, i) => {
        const d = i - p, ad = Math.abs(d);
        let z, y, o, b;
        if (d >= 0) { z = -d * 480; y = d * 12; o = Math.max(0, 1 - d * 0.88); b = Math.min(12, d * 8); }
        else { z = -d * 320; y = d * 11; o = Math.max(0, 1 + d * 1.7); b = Math.min(14, -d * 14); }
        el.style.transform = 'translate3d(0,' + y + 'vh,' + z + 'px)';
        el.style.opacity = o;
        el.style.filter = b > 0.2 ? 'blur(' + b + 'px)' : 'none';
        el.style.zIndex = 100 - Math.round(ad * 10);
        el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        el.style.pointerEvents = ad < 0.4 ? 'auto' : 'none';
        answers[i].style.opacity = clamp(1 - ad * 2.4, 0, 1);
        answers[i].style.transform = 'translateY(' + clamp(d, -1, 1) * 26 + 'px)';
      });
      const idx = Math.round(p);
      ticks.forEach((t, i) => t.classList.toggle('on', i === idx));
      pos.textContent = idx < M - 1 ? String(idx + 1).padStart(2, '0') + ' / ' + String(M - 1).padStart(2, '0') : 'ASK ME';
      bar.style.transform = 'scaleX(' + p / (M - 1) + ')';
      bg.style.transform = 'rotate(' + p * 70 + 'deg) scale(' + (1 + p * 0.06) + ')';
      hint.style.opacity = p > 0.15 ? 0 : 1;
    }
    let cur = 0, target = 0, running = false;
    function tick() {
      cur += (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.0008) cur = target;
      render(cur);
      if (cur !== target) requestAnimationFrame(tick); else running = false;
    }
    function update(jump) {
      target = raw() * (M - 1);
      if (jump) cur = target;
      if (!running) { running = true; requestAnimationFrame(tick); }
    }
    window.addEventListener('scroll', () => update(false), { passive: true });
    window.addEventListener('resize', () => update(true));
    ticks.forEach((t, i) => t.addEventListener('click', () => {
      const top = tunnel.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top - pinTop() + (i / (M - 1)) * range(), behavior: 'smooth' });
    }));
    tunnel.querySelector('.tn-cta').addEventListener('click', (e) => {
      e.preventDefault();
      const t = document.querySelector('#contact');
      if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 40, behavior: 'smooth' });
    });
    update(true);
    window.addEventListener('load', () => update(true));
  })();

  // Contact form: works with a real endpoint (Formspree etc.) or falls back to a ready-to-send email
  (function () {
    const form = document.querySelector('.contact-form');
    if (!form) return;
    const TO = 'payalpriyadarsini11@gmail.com';
    const done = form.querySelector('.form-done');
    const preview = form.querySelector('.fd-preview');
    const mailA = form.querySelector('.fd-mail');
    const sendBtn = form.querySelector('.ct-send');
    let errBox = null;
    const showErr = (t) => {
      if (!errBox) { errBox = document.createElement('p'); errBox.className = 'form-err'; sendBtn.after(errBox); }
      errBox.textContent = t;
    };
    const showDone = (title, note, withMail) => {
      form.classList.add('is-done'); done.hidden = false;
      done.querySelector('h3').textContent = title;
      done.querySelector('.fd-note').innerHTML = note;
      form.querySelector('.fd-actions').style.display = withMail ? '' : 'none';
      preview.style.display = withMail ? '' : 'none';
      done.focus({ preventScroll: true });
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await window.__ctFly(sendBtn);
      const fd = new FormData(form);
      const v = (k) => String(fd.get(k) || '').trim();
      const action = form.getAttribute('action') || '';
      if (errBox) errBox.textContent = '';
      const real = action && !/YOUR_FORM_ID/.test(action);
      if (real) {
        sendBtn.disabled = true;
        try {
          const r = await fetch(action, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
          if (!r.ok) throw new Error('bad');
          showDone('Message sent', 'Thanks ' + v('name').split(' ')[0] + '! I will get back to you personally.', false);
          form.reset();
        } catch (err) { showErr('Could not send right now. Please email ' + TO + ' directly.'); if (window.__ctReopen) window.__ctReopen(); }
        sendBtn.disabled = false;
        return;
      }
      const subject = 'Portfolio enquiry: ' + v('topic') + ' (' + v('name') + ')';
      const body = 'Name: ' + v('name') + '\nEmail: ' + v('email') + (v('company') ? '\nCompany: ' + v('company') : '') + '\nTopic: ' + v('topic') + '\n\n' + v('message');
      preview.textContent = 'To: ' + TO + '\nSubject: ' + subject + '\n\n' + body;
      mailA.href = 'mailto:' + TO + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      showDone('Your message is ready', 'Open it in your email app to send it to me. If nothing opens, copy it and email <b>' + TO + '</b>.', true);
    });
    form.querySelector('.fd-copy').addEventListener('click', (e) => {
      const b = e.currentTarget, old = b.textContent;
      const ok = () => { b.textContent = 'Copied'; setTimeout(() => (b.textContent = old), 1600); };
      try { navigator.clipboard.writeText(preview.textContent).then(ok, () => { b.textContent = 'Press Ctrl+C on the text'; }); }
      catch (err) { b.textContent = 'Select the text and copy'; }
    });
    form.querySelector('.fd-edit').addEventListener('click', () => { form.classList.remove('is-done'); done.hidden = true; });
  })();

  // Contact: boarding pass. Split-flap board, live ticket stub, tear-off + plane on check-in
  (function () {
    const form = document.querySelector('.fb-form');
    const board = document.getElementById('fbBoard');
    const ticket = document.getElementById('fbTicket');
    if (!form || !ticket) return;
    const $ = (id) => document.getElementById(id);
    const send = form.querySelector('.ct-send');
    const sl = send.querySelector('.sl'), sb = send.querySelector('.sb');
    // split-flap board
    if (board) {
      const rows = board.querySelectorAll('.fb-row'), W = 15;
      const msgs = [['NOW BOARDING', 'GATE A1 ON TIME'], ['TO CHANDIGARH', 'REPLY IN 24 HRS'], ['OPEN FOR HIRE', 'SAY HELLO NOW']];
      const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      rows.forEach((r) => { for (let i = 0; i < W; i++) { const s = document.createElement('span'); s.className = 'fl sp'; r.appendChild(s); } });
      let mi = 0, timers = [];
      function show(pair) {
        timers.forEach(clearTimeout); timers = [];
        rows.forEach((r, ri) => {
          const txt = (pair[ri] || '').padEnd(W, ' ');
          const cells = r.children;
          for (let i = 0; i < W; i++) {
            const ch = txt[i], cell = cells[i], steps = 5 + ((i * 3 + ri * 5) % 9);
            let n = 0;
            (function step() {
              if (n < steps && ch !== ' ') { cell.className = 'fl spin'; cell.textContent = abc[Math.floor(Math.random() * abc.length)]; n++; timers.push(setTimeout(step, 55)); }
              else { cell.className = ch === ' ' ? 'fl sp' : 'fl'; cell.textContent = ch === ' ' ? '' : ch; }
            })();
          }
        });
      }
      let started = false;
      function loop() { show(msgs[mi % msgs.length]); mi++; setTimeout(loop, 6500); }
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((es) => { if (es[0].isIntersecting && !started) { started = true; loop(); io.disconnect(); } }, { threshold: 0.4 });
        io.observe(board);
      } else loop();
      board.addEventListener('click', () => show(msgs[mi++ % msgs.length]));
    }
    // live stub
    const val = (n) => (form.elements[n].value || '').trim();
    const clsMap = { 'Job opportunity': 'FIRST \u00b7 HIRING', 'Collaboration': 'BUSINESS \u00b7 COLLAB', 'Project': 'PREMIUM \u00b7 PROJECT', 'Just saying hi': 'ECONOMY \u00b7 HELLO' };
    const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const bar = $('fbBar');
    function barcode(seed) {
      let x = 0, out = '', h = hash(seed) || 1;
      while (x < 198) {
        h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
        const w = 1 + (h % 4), gap = 1 + ((h >>> 5) % 3);
        out += '<rect x="' + x + '" y="0" width="' + w + '" height="54"/>'; x += w + gap;
      }
      bar.innerHTML = out;
    }
    $('fbDate').textContent = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).toUpperCase();
    function render() {
      const name = val('name'), topic = form.querySelector('input[name=topic]:checked').value, msg = form.elements.message.value;
      $('fbPax').textContent = (name || 'YOUR NAME').toUpperCase();
      $('fbCls').textContent = clsMap[topic];
      const row = 1 + Math.min(39, Math.floor(msg.length / 12)), letter = 'ABCDEF'[hash(name || 'x') % 6];
      $('fbSeat').textContent = row + letter;
      barcode(name + val('email') + topic + msg);
    }
    form.addEventListener('input', render);
    form.addEventListener('change', render);
    render();
    // 3D tilt + shine
    if (window.matchMedia && window.matchMedia('(hover:hover) and (min-width:901px)').matches) {
      ticket.addEventListener('mousemove', (e) => {
        const r = ticket.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        ticket.style.transform = 'rotateY(' + ((px - 0.5) * 5) + 'deg) rotateX(' + ((0.5 - py) * 4) + 'deg)';
        ticket.style.setProperty('--sx', px * 100 + '%'); ticket.style.setProperty('--sy', py * 100 + '%');
      });
      ticket.addEventListener('mouseleave', () => { ticket.style.transform = ''; });
    }
    // check-in: stamp, tear off the stub, plane flies across the screen
    const reset = () => { ticket.classList.remove('stamped', 'tear'); send.disabled = false; sl.textContent = 'Check in'; sb.style.transition = 'none'; sb.style.width = '0'; form.classList.remove('is-sending'); };
    function plane() {
      const NS = 'http://www.w3.org/2000/svg', s = document.createElementNS(NS, 'svg');
      s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'fb-plane');
      s.innerHTML = '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" transform="rotate(90 12 12)"/>';
      document.body.appendChild(s);
      const r = ticket.getBoundingClientRect(), y0 = r.top + r.height * 0.5, W = window.innerWidth;
      if (s.animate) s.animate([{ transform: 'translate(-90px,' + (y0 + 40) + 'px) rotate(-6deg) scale(.7)' }, { transform: 'translate(' + W * 0.5 + 'px,' + (y0 - 60) + 'px) rotate(-14deg) scale(1.1)', offset: 0.5 }, { transform: 'translate(' + (W + 120) + 'px,' + (y0 - 330) + 'px) rotate(-22deg) scale(.8)' }], { duration: 1500, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' }).onfinish = () => s.remove();
      else s.remove();
    }
    window.__ctFly = () => new Promise((resolve) => {
      form.classList.add('is-sending'); send.disabled = true; sl.textContent = 'Checking in...';
      sb.style.transition = 'width 1.4s linear'; requestAnimationFrame(() => (sb.style.width = '100%'));
      setTimeout(() => { ticket.classList.add('stamped'); sl.textContent = 'Checked in'; }, 1000);
      setTimeout(() => { ticket.classList.add('tear'); plane(); }, 1700);
      setTimeout(() => { resolve(); reset(); }, 3100);
    });
    window.__ctReopen = reset;
  })();

  /* ---------- GSAP-powered motion ---------- */
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  // Motion is the point of this portfolio, so it always runs (even if the OS
  // has "reduce animations" on). Remove this comment block's behavior if you
  // ever want to respect that setting.
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* 1. HERO intro ------------------------------------------------ */
  const intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
  intro
    .from('.hero-photo', { yPercent: -6, opacity: 0, duration: 1.4 })
    .from('.hero-line.l1', { yPercent: 40, opacity: 0, duration: 1.2 }, 0.2)
    .from('.hero-line.l2', { yPercent: 40, opacity: 0, duration: 1.2 }, 0.35)
    .from('.nav', { yPercent: -100, duration: 0.9 }, 0.4)
    .from('.socials li', { x: -30, opacity: 0, stagger: 0.1, duration: 0.7 }, 0.8)
    .from('.hang', { y: -380, duration: 1.6, ease: 'bounce.out', stagger: 0.18 }, 0.6)
    .from('.scroll-hint', { opacity: 0, duration: 1 }, 1.4);

  // counters
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const dec = +(el.dataset.dec || 0);
    const o = { v: 0 };
    gsap.to(o, { v: end, duration: 2.2, delay: 1.3, ease: 'power2.out', onUpdate: () => (el.textContent = o.v.toFixed(dec)) });
  });

  gsap.from('.hc-bars b', { scaleY: 0, stagger: 0.1, duration: 0.8, delay: 1.6, ease: 'back.out(1.6)' });
  const spark = document.querySelector('.hc-spark polyline');
  if (spark) { const L = spark.getTotalLength(); gsap.fromTo(spark, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.6, delay: 1.6, ease: 'power2.out' }); }

  // endless chain swing (pendulum)
  document.querySelectorAll('.hang').forEach((h, i) => {
    gsap.set(h, { rotation: i ? 4 : -4 });
    gsap.to(h, { rotation: i ? -4 : 4, duration: 2.4 + i * 0.5, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.8 });
  });

  // hero scroll story: GROWTH slides left, MARKETER slides right, the photo behind is revealed,
  // then the page continues. The hero stays pinned while this plays.
  const heroTl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: '.hero', start: 'top top', end: '+=100%', pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true }
  });
  heroTl
    .to('.hero-line.l1', { xPercent: -135, duration: 1 }, 0)
    .to('.hero-line.l2', { xPercent: 135, duration: 1 }, 0)
    .fromTo('.hero-photo', { scale: 1 }, { scale: 1.1, duration: 1.2 }, 0)
    .to('.hang', { opacity: 0, duration: 0.4 }, 0)
    .to('.scroll-hint,.socials', { opacity: 0, duration: 0.3 }, 0)
    .fromTo('.hero-tag', { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5 }, 0.6)
    .to({}, { duration: 0.3 });

  /* 2. TOOLS marquee -------------------------------------------- */
  gsap.from('.mid-title', { y: 40, opacity: 0, duration: 1, scrollTrigger: { trigger: '.mid-title', start: 'top 85%' } });

  /* 3. SPLIT-LETTER headings (letters rise, rotate and fade in on scroll) */
  document.querySelectorAll('.split-h').forEach((h) => {
    const text = h.dataset.text || h.textContent;
    h.setAttribute('aria-label', text);
    h.innerHTML = [...text].map((c) => `<span class="ch" aria-hidden="true">${c === ' ' ? '&nbsp;' : c}</span>`).join('');
    const chars = h.querySelectorAll('.ch');
    gsap.fromTo(chars,
      { yPercent: 55, rotation: (i) => (i % 2 ? 14 : -10), opacity: 0 },
      {
        yPercent: 0, rotation: 0, opacity: 1, ease: 'none', stagger: 0.12,
        scrollTrigger: { trigger: h, start: 'top 92%', end: 'top 38%', scrub: 0.8 }
      });
    gsap.from(h.parentElement.querySelector('.sec-our'), { x: -40, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 90%' } });
  });

  /* 4. ABOUT ------------------------------------------------------ */
  gsap.fromTo('.about-l', { xPercent: -45 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.about-heading', start: 'top 95%', end: 'center 55%', scrub: 0.8 } });
  gsap.fromTo('.about-r', { xPercent: 45 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: '.about-heading', start: 'top 95%', end: 'center 55%', scrub: 0.8 } });
  gsap.from('.about-photo', { scale: 0.85, y: 70, opacity: 0, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: '.about-photo', start: 'top 88%' } });
  gsap.from('.about-text', { y: 40, opacity: 0, duration: 1, scrollTrigger: { trigger: '.about-text', start: 'top 88%' } });
  gsap.from('.about-meta div', { y: 40, opacity: 0, stagger: 0.12, duration: 0.8, scrollTrigger: { trigger: '.about-meta', start: 'top 90%' } });
  // pills as a GROWTH CHART: pills drop in as a rising staircase, a trend line draws itself above them
  // with a glowing dot riding it, and every pill lights up red the moment the dot reaches it. Loops.
  (function () {
    const wrap = document.querySelector('.pills');
    if (!wrap) return;
    const ps = Array.from(wrap.querySelectorAll('span'));
    const NS = 'http://www.w3.org/2000/svg';
    const wide = () => window.matchMedia('(min-width:901px)').matches;
    let svg = null, intro = null, loop = null, entered = false;

    gsap.set(ps, { opacity: 0 });

    function smooth(pts) {                       // Catmull-Rom -> cubic bezier, so the trend line is a soft curve
      let d = 'M' + pts[0].x + ' ' + pts[0].y;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += ' C' + (p1.x + (p2.x - p0.x) / 6) + ' ' + (p1.y + (p2.y - p0.y) / 6) + ' ' +
          (p2.x - (p3.x - p1.x) / 6) + ' ' + (p2.y - (p3.y - p1.y) / 6) + ' ' + p2.x + ' ' + p2.y;
      }
      return d;
    }

    function teardown() {
      if (intro) intro.kill();
      if (loop) loop.kill();
      intro = loop = null;
      gsap.killTweensOf(ps);
      if (svg) { svg.remove(); svg = null; }
      ps.forEach((p) => p.classList.remove('lit'));
    }

    function start() {
      teardown();
      if (!wide()) {                             // phones / tablets: pills wrap, so just a bouncy pop-in
        wrap.style.paddingTop = ''; wrap.style.marginTop = '';
        gsap.fromTo(ps, { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, y: 0, stagger: 0.08, duration: 0.7, ease: 'back.out(2)' });
        return;
      }
      const n = ps.length;
      const rise = Math.min(64, wrap.clientWidth * 0.045), step = rise / (n - 1);
      const pad = rise + 40;
      wrap.style.paddingTop = pad + 'px';
      wrap.style.marginTop = (-34 - pad) + 'px';  // keeps the first pill where it always was

      // trend line points sit just above each pill, with small dips so it reads like a real growth chart
      const jit = [0, -8, 3, -10, 2, -12, 4, -14];
      const pts = ps.map((p, i) => ({ x: p.offsetLeft + p.offsetWidth / 2, y: p.offsetTop + pad * 0 - i * step - 18 + (jit[i] || 0) }));
      svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'pl-svg');
      svg.setAttribute('width', wrap.clientWidth); svg.setAttribute('height', wrap.clientHeight);
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', smooth(pts));
      const dot = document.createElementNS(NS, 'circle');
      dot.setAttribute('r', 8); dot.setAttribute('cx', pts[0].x); dot.setAttribute('cy', pts[0].y);
      svg.append(path, dot);
      wrap.prepend(svg);
      const len = path.getTotalLength();
      gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
      gsap.set(dot, { opacity: 0 });

      loop = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 0.6 });
      const o = { t: 0 };
      loop.call(() => { ps.forEach((p) => p.classList.remove('lit')); o.t = 0; })
        .set([path, dot], { opacity: 1 })
        .set(path, { strokeDashoffset: len })
        .to(o, {
          t: 1, duration: 3.6, ease: 'power1.inOut',
          onUpdate: () => {
            const pt = path.getPointAtLength(o.t * len);
            dot.setAttribute('cx', pt.x); dot.setAttribute('cy', pt.y);
            path.style.strokeDashoffset = len * (1 - o.t);
            ps.forEach((p, i) => {
              if (pt.x >= pts[i].x - 2 && !p.classList.contains('lit')) {
                p.classList.add('lit');
                gsap.fromTo(p, { scale: 1.2 }, { scale: 1, duration: 0.7, ease: 'elastic.out(1,.4)', overwrite: 'auto' });
              }
            });
          }
        })
        .to([path, dot], { opacity: 0, duration: 0.6 }, '+=1.4');

      intro = gsap.fromTo(ps,
        { opacity: 0, scale: 0.6, y: (i) => -90 - i * step },
        { opacity: 1, scale: 1, y: (i) => -i * step, duration: 0.9, ease: 'bounce.out', stagger: 0.1, onComplete: () => loop.play() });
    }

    ScrollTrigger.create({ trigger: wrap, start: 'top 92%', once: true, onEnter: () => { entered = true; start(); } });
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (entered) start(); }, 250); });

    if (window.matchMedia('(hover:hover)').matches) {
      ps.forEach((p) => {
        p.addEventListener('mouseenter', () => gsap.to(p, { scale: 1.12, duration: 0.3, ease: 'power2.out', overwrite: 'auto' }));
        p.addEventListener('mouseleave', () => gsap.to(p, { scale: 1, duration: 0.5, ease: 'elastic.out(1,.5)', overwrite: 'auto' }));
      });
    }
  })();

  /* 5. EXPERIENCE cards ------------------------------------------ */
  gsap.utils.toArray('.exp-card').forEach((c) => {
    gsap.from(c, { y: 70, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: c, start: 'top 90%' } });
  });

  /* 6. REEL: slow, smooth zoom-in. A full-screen frame is revealed through a
        clip window that opens up while the video inside scales down from 1.4x,
        so the picture seems to zoom toward you as you scroll. (GPU-friendly) */
  const frame = document.querySelector('.reel-frame');
  const reelMedia = document.querySelectorAll('.reel-video, .reel-fallback');
  const startClip = window.matchMedia('(max-width: 900px)').matches
    ? 'inset(14vh 8vw 14vh 8vw round 10px)'
    : 'inset(19vh 33vw 19vh 33vw round 10px)';
  gsap.set(frame, { clipPath: startClip });
  gsap.set(reelMedia, { scale: 1.4 });
  const rl = gsap.timeline({
    defaults: { ease: 'power1.inOut' },
    scrollTrigger: { trigger: '.reel', start: 'top top', end: 'bottom bottom', scrub: 1.2, invalidateOnRefresh: true }
  });
  rl.to(frame, { clipPath: 'inset(0vh 0vw 0vh 0vw round 0px)', duration: 1 }, 0)
    .to(reelMedia, { scale: 1, duration: 1 }, 0)
    ;

  if (reelVideo) {
    ScrollTrigger.create({
      trigger: '.reel', start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => { if (self.progress > 0.55 && reelVideo.paused) startReel(); },
      onLeave: () => reelVideo.pause(),
      onLeaveBack: () => reelVideo.pause(),
      onEnter: () => { reelVideo.preload = 'auto'; }
    });
  }

  /* 7. SERVICES rows slide in ------------------------------------ */
  // desktop: the section PINS and scrolling reveals the skills one by one (each with its picture).
  // phones / tablets: the normal tap-to-open list.
  const mmSvc = gsap.matchMedia();
  mmSvc.add('(min-width:901px) and (prefers-reduced-motion:no-preference)', () => {
    const sec = document.getElementById('services');
    const items = Array.from(sec.querySelectorAll('.svc'));
    const N = items.length;
    sec.classList.add('svc-pinned');
    const bar = document.createElement('div'); bar.className = 'svc-bar'; bar.innerHTML = '<i></i>';
    const count = document.createElement('div'); count.className = 'svc-count';
    const pad2 = (n) => String(n).padStart(2, '0');
    count.innerHTML = '<b>01</b> / ' + pad2(N);
    sec.append(bar, count);
    // ---- rotary dial: the 8 skills sit on a big wheel; scrolling turns it so the next skill clicks into place ----
    const list = sec.querySelector('.svc-list');
    const dial = document.createElement('div'); dial.className = 'svc-dial';
    dial.innerHTML = '<i class="d-tick"></i><i class="d-ring"></i><i class="d-out"></i>';
    list.prepend(dial);
    const ticks = dial.querySelector('.d-tick'), ring = dial.querySelector('.d-ring'), outer = dial.querySelector('.d-out');
    const prox = { v: 0 };
    let R = 480, stepDeg = 7, lw = 600;
    function layout() {
      const H = list.clientHeight, ih = items[0].offsetHeight;
      lw = list.clientWidth;
      R = Math.max(420, H * 1.15);
      stepDeg = ((ih + Math.max(10, H * 0.025)) / R) * 180 / Math.PI;
      items.forEach((it) => { it.style.top = '50%'; it.style.marginTop = (-ih / 2) + 'px'; });
      gsap.set(items, { transformOrigin: (-R) + 'px 50%' });
      [[ticks, R - 30], [ring, R], [outer, R + lw]].forEach(([el, r]) => {
        el.style.width = el.style.height = (2 * r) + 'px';
        el.style.left = (-R - r) + 'px'; el.style.top = 'calc(50% - ' + r + 'px)';
      });
      render();
    }
    function render() {
      items.forEach((it, i) => {
        const d = i - prox.v, ad = Math.abs(d);
        gsap.set(it, { rotation: d * stepDeg, opacity: Math.max(0.1, 1 - ad * 0.2), scale: 1 - Math.min(ad, 4) * 0.025, zIndex: 20 - Math.round(ad) });
      });
      gsap.set(ticks, { rotation: -prox.v * stepDeg * 1.0 });
    }
    layout();
    window.addEventListener('resize', layout);
    ScrollTrigger.addEventListener('refresh', layout);
    let idx = 0;
    const st = ScrollTrigger.create({
      trigger: sec, start: 'top top', end: () => '+=' + Math.round(window.innerHeight * N * 0.8),
      pin: true, invalidateOnRefresh: true,
      snap: { snapTo: [0, ...Array.from({ length: N }, (_, k) => (k + 0.5) / N), 1], duration: { min: 0.25, max: 0.7 }, delay: 0.12, ease: 'power2.inOut' },
      onUpdate: (self) => {
        gsap.set(bar.firstChild, { scaleX: self.progress });
        const i = Math.min(N - 1, Math.floor(self.progress * N));
        if (i === idx) return;
        idx = i;
        setService(items[i]);
        count.firstChild.textContent = pad2(i + 1);
        gsap.to(prox, { v: i, duration: 0.85, ease: 'back.out(1.25)', overwrite: true, onUpdate: render });
      }
    });
    svcPin = st;
    // when this runs again after a resize it is created LAST; put the triggers back in page order so Work/Process pins measure after it
    gsap.delayedCall(0.05, () => { ScrollTrigger.sort(); ScrollTrigger.refresh(); });
    return () => {
      svcPin = null; st.kill(true);
      window.removeEventListener('resize', layout); ScrollTrigger.removeEventListener('refresh', layout);
      gsap.killTweensOf(prox); dial.remove(); gsap.delayedCall(0.05, () => ScrollTrigger.refresh());
      sec.classList.remove('svc-pinned'); bar.remove(); count.remove();
      gsap.set(items, { clearProps: 'all' }); items.forEach((it) => { it.style.top = ''; it.style.marginTop = ''; });
    };
  });
  mmSvc.add('(max-width:900px), (prefers-reduced-motion:reduce)', () => {
    gsap.from('.svc', { x: -80, opacity: 0, stagger: 0.12, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: '.svc-list', start: 'top 85%' } });
    gsap.from('.svc-art', { y: 80, opacity: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: '.svc-wrap', start: 'top 80%' } });
  });

  /* 9. WORK: tilted cards glide sideways with scroll -------------- */
  const track = document.getElementById('workTrack');
  const getDist = () => Math.max(0, track.scrollWidth - window.innerWidth);
  gsap.fromTo(track, { x: 0 }, { x: () => -getDist(), ease: 'none', scrollTrigger: {
    trigger: '.work-pin', start: 'top top', end: () => '+=' + (getDist() + window.innerHeight * 0.4),
    pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true,
    onUpdate: (self) => gsap.set('#workBar', { scaleX: self.progress }) } });
  gsap.utils.toArray('.work-card').forEach((c, i) => {
    const tilt = i % 2 ? 4 : -4;
    gsap.fromTo(c, { rotation: tilt * 2.2, y: 40 }, { rotation: tilt, y: 0, ease: 'none', scrollTrigger: { trigger: '.work', start: 'top 90%', end: 'top 20%', scrub: true } });
    c.addEventListener('mouseenter', () => gsap.to(c, { rotation: 0, scale: 1.04, duration: 0.5, ease: 'power3.out' }));
    c.addEventListener('mouseleave', () => gsap.to(c, { rotation: tilt, scale: 1, duration: 0.5, ease: 'power3.out' }));
  });

  /* 9b. EXTRA MOTION -------------------------------------------- */
  // scroll progress bar
  gsap.to('.scroll-progress i', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } });

  // nav link highlights the section you are in
  [['#home', 'home'], ['#about', 'about'], ['#work', 'work'], ['#contact', 'contact']].forEach(([id, key]) => {
    const link = document.querySelector('.nav-links a[href="' + id + '"]');
    if (!link) return;
    ScrollTrigger.create({ trigger: id, start: 'top 55%', end: 'bottom 55%', onToggle: (self) => link.classList.toggle('active', self.isActive) });
  });

  // about paragraph: words light up as you read
  const at = document.querySelector('.about-text');
  if (at) {
    at.classList.add('words-reveal');
    at.innerHTML = at.textContent.trim().split(/\s+/).map((w) => '<span class="w">' + w + '</span>').join(' ');
    gsap.to('.about-text .w', { opacity: 1, ease: 'none', stagger: 0.06, scrollTrigger: { trigger: '.about-text', start: 'top 80%', end: 'bottom 45%', scrub: true } });
  }

  // gentle parallax on photos
  gsap.fromTo('.about-photo', { yPercent: 6 }, { yPercent: -6, ease: 'none', scrollTrigger: { trigger: '.about-heading', start: 'top bottom', end: 'bottom top', scrub: true } });

  // numbered badges spin in
  gsap.from('.ins-col article b', { rotation: -180, scale: 0, opacity: 0, stagger: 0.1, duration: 0.8, ease: 'back.out(1.7)', scrollTrigger: { trigger: '.ins-grid', start: 'top 80%' } });
  gsap.from('.ins-col h3', { x: -40, opacity: 0, duration: 0.8, stagger: 0.2, scrollTrigger: { trigger: '.ins-grid', start: 'top 88%' } });
  gsap.from('.foot-main > *', { y: 50, opacity: 0, stagger: 0.15, duration: 0.9, scrollTrigger: { trigger: '.foot-main', start: 'top 92%' } });

  // marquee-style skew: tool chips and pills lean with scroll speed
  const skewSet = gsap.quickTo('.pills', 'skewX', { duration: 0.4, ease: 'power3' });
  ScrollTrigger.create({ onUpdate: (self) => skewSet(gsap.utils.clamp(-8, 8, self.getVelocity() / -400)) });

  // 3D tilt on hover for info cards
  document.querySelectorAll('.about-meta div, .exp-card, .ins-col article').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      gsap.to(el, { rotationY: px * 6, rotationX: -py * 6, transformPerspective: 900, duration: 0.4, ease: 'power2.out' });
    });
    el.addEventListener('mouseleave', () => gsap.to(el, { rotationY: 0, rotationX: 0, duration: 0.6, ease: 'power3.out' }));
  });

  // magnetic buttons
  document.querySelectorAll('.nav-cta, .send').forEach((b) => {
    b.addEventListener('mousemove', (e) => {
      const r = b.getBoundingClientRect();
      gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * 0.25, y: (e.clientY - r.top - r.height / 2) * 0.35, duration: 0.3 });
    });
    b.addEventListener('mouseleave', () => gsap.to(b, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,.4)' }));
  });

  // cursor ring that grows over links and cards
  if (window.matchMedia('(hover:hover)').matches) {
    const cur = document.createElement('div');
    cur.className = 'cursor';
    document.body.appendChild(cur);
    const mx = gsap.quickTo(cur, 'x', { duration: 0.25, ease: 'power3' });
    const my = gsap.quickTo(cur, 'y', { duration: 0.25, ease: 'power3' });
    window.addEventListener('mousemove', (e) => { cur.classList.add('on'); mx(e.clientX); my(e.clientY); });
    document.addEventListener('mouseover', (e) => cur.classList.toggle('big', !!e.target.closest('a,button,.work-card,.svc,.faq-q,.chips label')));
  }

  /* 9c. HOW I WORK: pinned, one step at a time as you scroll ------- */
  (function () {
    const proc = document.getElementById('process');
    const pSteps = gsap.utils.toArray('.pstep');
    if (!proc || !pSteps.length) return;
    proc.classList.add('proc-js');
    const N = pSteps.length;
    const C = 2 * Math.PI * 88;
    const prog = proc.querySelector('.ring-prog');
    const nodes = gsap.utils.toArray('.rn');
    const ON = { backgroundColor: '#ac2c37', color: '#fff', scale: 1.25 };
    const OFF = { backgroundColor: '#e6e6e6', color: '#888', scale: 1 };
    prog.style.strokeDasharray = C;
    gsap.set(prog, { strokeDashoffset: C * (1 - 1 / N) });
    gsap.set(pSteps.slice(1), { autoAlpha: 0 });
    gsap.set(nodes[0].querySelector('b'), ON);
    gsap.set(nodes[0].querySelector('em'), { color: '#ac2c37' });

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: { trigger: '.proc-pin', start: 'top top', end: '+=' + N * 80 + '%', pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true }
    });
    // outer dotted ring keeps turning the whole way
    tl.to('.ring-dash', { rotation: 360, svgOrigin: '100 100', ease: 'none', duration: N + 0.5 }, 0);
    for (let i = 1; i < N; i++) {
      const t = 0.5 + (i - 1);
      const prev = pSteps[i - 1], cur = pSteps[i];
      // old step lifts away, new step rises in and its title wipes open
      tl.to(prev, { autoAlpha: 0, y: -60, duration: 0.35, ease: 'power2.in' }, t)
        .fromTo(cur, { autoAlpha: 0, y: 70 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' }, t + 0.2)
        .fromTo(cur.querySelector('.ps-name'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.5, ease: 'power3.out' }, t + 0.2)
        .fromTo(cur.querySelectorAll('.ps-text, .ps-tags li'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, stagger: 0.05, duration: 0.4, ease: 'power3.out' }, t + 0.35)
        // odometer number, ring fill, rail fill
        .to('.num-strip', { yPercent: -(100 / N) * i, duration: 0.5, ease: 'power3.inOut' }, t)
        .to(prog, { strokeDashoffset: C * (1 - (i + 1) / N), duration: 0.5 }, t)
        .to('.rail-fill', { scaleX: i / (N - 1), duration: 0.5 }, t)
        .to(nodes[i - 1].querySelector('b'), Object.assign({ duration: 0.3 }, OFF), t)
        .to(nodes[i - 1].querySelector('em'), { color: '#999', duration: 0.3 }, t)
        .to(nodes[i].querySelector('b'), Object.assign({ duration: 0.3 }, ON), t + 0.15)
        .to(nodes[i].querySelector('em'), { color: '#ac2c37', duration: 0.3 }, t + 0.15);
    }
    tl.to({}, { duration: 0.5 }, tl.duration()); // hold the last step before the page continues
  })();

  /* 10. INSIGHTS, FAQ, CONTACT ----------------------------------- */
  gsap.from('.ins-col article', { y: 50, opacity: 0, stagger: 0.1, duration: 0.8, scrollTrigger: { trigger: '.ins-grid', start: 'top 85%' } });

  /* 11. FOOTER marquee (reverses direction with scroll) ----------- */
  const footTween = gsap.to('.foot-row', { xPercent: -33.333, duration: 22, ease: 'none', repeat: -1 });
  ScrollTrigger.create({
    onUpdate: (self) => {
      const dir = self.direction;
      gsap.to(footTween, { timeScale: dir * 1.4, duration: 0.4, overwrite: true });
    }
  });
  gsap.from('.foot-logo', { y: 80, opacity: 0, duration: 1, scrollTrigger: { trigger: '.foot-main', start: 'top 90%' } });

  // refresh after fonts + images settle (giant type changes layout)
  window.addEventListener('load', () => ScrollTrigger.refresh());
  [400, 1200, 2800].forEach((t) => setTimeout(() => ScrollTrigger.refresh(), t));
  window.addEventListener('resize', () => ScrollTrigger.refresh());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
})();

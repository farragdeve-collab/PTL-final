/* PTL v1 — Chrome: page choreography. The WebGL letters live in ptl3d.js
   and read window.PTL.ptlProgress, which this file drives from scroll. */
(function () {
  var PTL = window.PTL;
  var motion = PTL.hasGsap;
  var rtl = PTL.rtl;
  var dirSign = rtl ? 1 : -1;
  PTL.ptlProgress = 0;
  PTL.geo = { p: 0, region: 0, inRegions: true }; // read by globe.js (final version)

  /* ---------- shipping-mode accordion (hover, focus or tap) ---------- */
  var modeCards = document.querySelectorAll(".mode");
  modeCards.forEach(function (m) {
    var open = function () { modeCards.forEach(function (o) { o.classList.toggle("is-open", o === m); }); };
    m.addEventListener("mouseenter", open);
    m.addEventListener("focus", open);
    m.addEventListener("click", open);
  });

  /* ---------- pointer spotlight on grid cards ---------- */
  document.querySelectorAll(".bento-card").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  if (!motion) {
    document.documentElement.classList.add("no-motion");
    var pl = document.querySelector(".preloader");
    if (pl) pl.remove();
    document.querySelectorAll(".ptl-panel").forEach(function (p) { p.style.opacity = 1; p.style.visibility = "visible"; });
    document.querySelectorAll(".station").forEach(function (s) { s.classList.add("on"); });
    return;
  }

  /* ---------- preloader → hero intro ---------- */
  function heroIntro() {
    var tl = gsap.timeline({ defaults: { ease: "power4.out" } });
    if (document.querySelector(".hero")) {
      tl.from(".hero-media img", { scale: 1.25, duration: 2.2, ease: "power3.out" }, 0)
        .from(".hero-title .line > span", { yPercent: 115, duration: 1.3, stagger: 0.12 }, 0.15)
        .from(".hero-kicker, .hero-sub, .hero-actions", { y: 30, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.55)
        .from(".hero-foot .hs, .hero-foot .scroll-btn", { y: 40, autoAlpha: 0, duration: 1, stagger: 0.07 }, 0.75);
    }
    tl.fromTo(".site-header", { yPercent: -100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1, clearProps: "transform,opacity,visibility" }, 0.3);
    return tl;
  }

  var preloader = document.querySelector(".preloader");
  // the intro plays once per visit; returning to the home page opens straight on the hero
  var introSeen = document.documentElement.classList.contains("intro-seen");
  try { sessionStorage.setItem("ptl-intro", "1"); } catch (e) {}
  if (preloader && introSeen) { preloader.remove(); preloader = null; }
  if (preloader) {
    if (PTL.lenis) PTL.lenis.stop();
    var count = preloader.querySelector(".pl-count span");
    var bar = preloader.querySelector(".pl-bar i");
    var state = { v: 0 };
    var ready = Promise.race([
      // wait only for what the first screen needs: fonts and the hero photo
      Promise.all([
        document.fonts ? document.fonts.ready : Promise.resolve(),
        (function () { var img = document.querySelector(".hero-media img"); return img && img.decode ? img.decode().catch(function () {}) : Promise.resolve(); })()
      ]),
      new Promise(function (res) { setTimeout(res, 2500); })
    ]);
    var climb = gsap.to(state, {
      v: 86, duration: 1.4, ease: "power2.out",
      onUpdate: function () { count.textContent = Math.round(state.v); bar.style.transform = "scaleX(" + state.v / 100 + ")"; }
    });
    ready.then(function () {
      climb.kill();
      gsap.timeline()
        .to(state, { v: 100, duration: 0.5, ease: "power2.inOut", onUpdate: function () { count.textContent = Math.round(state.v); bar.style.transform = "scaleX(" + state.v / 100 + ")"; } })
        .to(preloader.children, { y: -30, autoAlpha: 0, duration: 0.5, stagger: 0.05, ease: "power2.in" })
        .to(preloader, { clipPath: "inset(0 0 100% 0)", duration: 1, ease: "expo.inOut" }, "-=0.15")
        .add(function () { if (PTL.lenis) PTL.lenis.start(); }, "-=0.4")
        .add(heroIntro(), "-=0.55")
        .add(function () { preloader.remove(); ScrollTrigger.refresh(); });
    });
  } else {
    heroIntro();
  }

  PTL.initReveals();

  /* ---------- PTL letters sequence ---------- */
  var ptl = document.querySelector(".ptl-scene");
  if (ptl) {
    var panels = gsap.utils.toArray(".ptl-panel");
    var cur = ptl.querySelector(".ptl-progress .cur");
    var barFill = ptl.querySelector(".ptl-progress i b");
    // segments in scroll progress: [in-start, in-end, out-start, out-end]
    var seg = [[0.2, 0.26, 0.42, 0.46], [0.47, 0.53, 0.68, 0.72], [0.73, 0.79, 0.93, 0.97]];
    var intro = ptl.querySelector(".ptl-intro");
    var x = rtl ? 40 : -40;
    ScrollTrigger.create({
      trigger: ptl, start: "top top", end: "bottom bottom", scrub: true,
      onUpdate: function (self) {
        var p = self.progress;
        PTL.ptlProgress = p;
        intro.style.opacity = String(1 - gsap.utils.clamp(0, 1, (p - 0.08) / 0.08));
        var active = 0;
        panels.forEach(function (panel, i) {
          var s = seg[i];
          var a = p < s[0] ? 0 : p < s[1] ? (p - s[0]) / (s[1] - s[0]) : p < s[2] ? 1 : p < s[3] ? 1 - (p - s[2]) / (s[3] - s[2]) : 0;
          if (p >= s[0]) active = i;
          var ease = a * a * (3 - 2 * a);
          panel.style.opacity = String(ease);
          panel.style.visibility = ease > 0.01 ? "visible" : "hidden";
          panel.style.transform = (window.innerWidth > 760 ? "translateY(-50%) " : "") + "translateX(" + (1 - ease) * x + "px)";
        });
        cur.textContent = "0" + (active + 1);
        barFill.style.transform = "scaleX(" + gsap.utils.clamp(0, 1, (p - 0.2) / 0.77) + ")";
      }
    });
  }

  /* ---------- services ring ---------- */
  // Phones and short (landscape) screens get a swipe carousel instead of the 3D ring.
  var compactQ = window.matchMedia("(max-width: 759px), (max-height: 559px)");
  var shortQ = window.matchMedia("(max-height: 559px)");
  var compact = compactQ.matches;
  document.documentElement.classList.toggle("ring-compact", compact);
  document.documentElement.classList.toggle("kin-compact", shortQ.matches);
  compactQ.addEventListener("change", function () { location.reload(); });
  shortQ.addEventListener("change", function () { location.reload(); });

  var ringScene = document.querySelector(".ring-scene");
  if (ringScene) {
    var ring = ringScene.querySelector(".ring");
    var cards = gsap.utils.toArray(".ring-card");
    var counter = ringScene.querySelector(".ring-count .cur");
    var rbar = ringScene.querySelector(".ring-bar i");
    var n = cards.length;
    var setActive = function (idx, p) {
      counter.textContent = "0" + (idx + 1);
      rbar.style.transform = "scaleX(" + p + ")";
    };
    if (compact) {
      var onRow = function () {
        var max = ring.scrollWidth - ring.clientWidth;
        var p = max > 0 ? Math.abs(ring.scrollLeft) / max : 0;
        setActive(Math.round(p * (n - 1)), p);
      };
      ring.addEventListener("scroll", onRow, { passive: true });
      onRow();
      gsap.fromTo(cards, { y: 60, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, stagger: 0.08, ease: "power3.out", scrollTrigger: { trigger: ring, start: "top 85%" } });
    } else {
      var step = 360 / n;
      var side = rtl ? -1 : 1; // cards are laid out in reading direction (see --dir in CSS)
      var paintRing = function (p) {
        var rot = -side * p * step * (n - 1);
        ring.style.transform = "rotateX(-4deg) rotateY(" + rot + "deg)";
        cards.forEach(function (c, i) {
          var ang = ((side * i * step + rot) % 360 + 540) % 360 - 180; // 0 = facing the viewer
          var f = Math.cos(ang * Math.PI / 180);
          c.style.opacity = String(Math.max(0.08, (f + 0.35) / 1.35));
          c.style.filter = "brightness(" + (0.45 + 0.55 * Math.max(0, f)) + ")";
        });
        setActive(Math.round(p * (n - 1)), p);
      };
      paintRing(0);
      ScrollTrigger.create({
        trigger: ringScene, start: "top top", end: "bottom bottom", scrub: 0.6,
        onUpdate: function (self) { paintRing(self.progress); }
      });
      // animate the viewport, not .ring: GSAP would overwrite the ring's rotateY
      gsap.from(ringScene.querySelector(".ring-viewport"), { scale: 0.7, autoAlpha: 0, duration: 1.4, ease: "power3.out", scrollTrigger: { trigger: ringScene, start: "top 70%" } });
    }
  }

  /* ---------- kinetic words ---------- */
  var kin = document.querySelector(".kinetic");
  if (kin && shortQ.matches) {
    gsap.utils.toArray(".kw").forEach(function (k) { gsap.fromTo(k, { y: 50, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, ease: "power3.out", scrollTrigger: { trigger: k, start: "top 90%" } }); });
  } else if (kin) {
    var track = kin.querySelector(".kinetic-track");
    var words = gsap.utils.toArray(".kw-word");
    var distance = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    var setHeight = function () { kin.style.height = (distance() + window.innerHeight * 1.2) + "px"; };
    setHeight();
    ScrollTrigger.addEventListener("refreshInit", setHeight);
    var settle = null;
    var skewTo = gsap.quickTo(words, "skewX", { duration: 0.5, ease: "power3" });
    gsap.to(track, {
      x: function () { return dirSign * distance(); },
      ease: "none",
      scrollTrigger: {
        trigger: kin, start: "top top", end: "bottom bottom", scrub: 0.8, invalidateOnRefresh: true,
        onUpdate: function (self) {
          skewTo(gsap.utils.clamp(-12, 12, self.getVelocity() / -300) * (rtl ? -1 : 1));
          if (settle) settle.kill();
          settle = gsap.delayedCall(0.15, function () { skewTo(0); });
        }
      }
    });
    gsap.fromTo(".kinetic-head", { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1, scrollTrigger: { trigger: kin, start: "top 60%" } });
  }

  /* ---------- globe regions (final version): one region per scroll step ---------- */
  var geo = document.querySelector(".geo");
  if (geo) {
    var gHead = geo.querySelector(".geo-head");
    var gPanels = gsap.utils.toArray(".geo-panel");
    var gDots = geo.querySelectorAll(".geo-dots i");
    var gDotsWrap = geo.querySelector(".geo-dots");
    var gStart = 0.04, gN = gPanels.length, gSpan = (1 - gStart) / gN;
    var gMob = function () { return window.innerWidth <= 760 || window.innerWidth / window.innerHeight < 0.9; };
    ScrollTrigger.create({
      trigger: geo, start: "top top", end: "bottom bottom", scrub: true,
      onUpdate: function (self) {
        var p = self.progress;
        var headA = gsap.utils.clamp(0, 1, p / gStart);
        gHead.style.opacity = headA;
        gDotsWrap.style.opacity = headA;
        var region = Math.min(gN - 1, Math.max(0, Math.floor((p - gStart) / gSpan)));
        gPanels.forEach(function (panel, i) {
          var local = (p - (gStart + i * gSpan)) / gSpan;
          var a = local < 0 ? 0 : local < 0.18 ? local / 0.18 : local < 0.82 ? 1 : local < 1 ? (1 - local) / 0.18 : 0;
          if (i === gN - 1 && local >= 0.82) a = 1;
          if (i === 0 && local < 0.18) a = gsap.utils.clamp(0, 1, local / 0.18);
          panel.style.opacity = a;
          panel.style.visibility = a > 0.01 ? "visible" : "hidden";
          var low = gMob() || window.innerHeight < 560;
          panel.style.transform = low ? "translateY(" + (1 - a) * 30 + "px)" : "translateY(" + (-30 - (1 - a) * 10) + "%)";
        });
        gDots.forEach(function (d, i) { d.classList.toggle("on", i === region); });
        PTL.geo.p = p;
        PTL.geo.region = region;
      }
    });
  }

  /* ---------- route path (final version): the truck drives the line as you scroll ---------- */
  var map = document.querySelector(".route-map");
  if (map && window.innerWidth > 760) {
    var line = map.querySelector(".route-line");
    var truck = map.querySelector(".route-truck");
    var stations = map.querySelectorAll(".station");
    var len = line.getTotalLength();
    line.style.strokeDasharray = len;
    line.style.strokeDashoffset = len;
    var stops = [[390, 200], [610, 400], [390, 600], [610, 800], [390, 1000], [500, 1200]].map(function (pt) {
      var best = 0, bd = Infinity;
      for (var l = 0; l <= len; l += len / 600) {
        var q = line.getPointAtLength(l);
        var d = (q.x - pt[0]) * (q.x - pt[0]) + (q.y - pt[1]) * (q.y - pt[1]);
        if (d < bd) { bd = d; best = l; }
      }
      return best / len;
    });
    ScrollTrigger.create({
      trigger: map, start: "top 60%", end: "bottom 60%", scrub: 0.5,
      onUpdate: function (self) {
        var p = self.progress;
        line.style.strokeDashoffset = len * (1 - p);
        var q = line.getPointAtLength(len * p);
        truck.style.transform = "translate(" + (q.x / 1000 * map.clientWidth) + "px," + (q.y / 1200 * map.clientHeight) + "px)";
        stations.forEach(function (s, i) { s.classList.toggle("on", p >= stops[i] - 0.01); });
      }
    });
  } else {
    document.querySelectorAll(".station").forEach(function (s) { s.classList.add("on"); });
  }

  /* ---------- stacking cards ---------- */
  var stack = gsap.utils.toArray(".stack-card");
  stack.forEach(function (card, i) {
    var next = stack[i + 1];
    if (!next) return;
    gsap.to(card, {
      scale: 0.92, filter: "brightness(0.62)", ease: "none",
      scrollTrigger: { trigger: next, start: "top bottom", end: "top 20%", scrub: true }
    });
  });
})();

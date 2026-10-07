/* PTL v3 — Globe: page choreography. Drives window.PTL.geo for globe.js. */
(function () {
  var PTL = window.PTL;
  var motion = PTL.hasGsap;
  PTL.geo = { p: 0, region: -1, inRegions: false };

  /* ---------- pointer spotlight on cards ---------- */
  document.querySelectorAll(".bento-card, .glow-card").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", (e.clientX - r.left) + "px");
      card.style.setProperty("--my", (e.clientY - r.top) + "px");
    });
  });

  /* ---------- shipping-mode accordion ---------- */
  var modes = document.querySelectorAll(".mode");
  modes.forEach(function (m) {
    var open = function () { modes.forEach(function (o) { o.classList.toggle("is-open", o === m); }); };
    m.addEventListener("mouseenter", open);
    m.addEventListener("focus", open);
    m.addEventListener("click", open);
  });

  if (!motion) {
    document.documentElement.classList.add("no-motion");
    document.querySelectorAll(".station").forEach(function (s) { s.classList.add("on"); });
    return;
  }

  /* ---------- hero intro ---------- */
  var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
  tl.fromTo(".site-header", { y: -40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, clearProps: "transform,opacity,visibility" }, 0.1);
  if (document.querySelector(".geo-hero")) {
    tl.fromTo(".globe-canvas", { autoAlpha: 0, scale: 0.9 }, { autoAlpha: (window.innerWidth <= 760 || window.innerWidth / window.innerHeight < 0.9) ? 0.32 : 1, scale: 1, duration: 2.4, ease: "power3.out", clearProps: "transform" }, 0)
      .from(".geo-hero .hero-title .line > span", { yPercent: 115, duration: 1.4, stagger: 0.1 }, 0.2)
      .from(".geo-hero .tag, .geo-hero .hero-sub, .geo-hero .actions, .geo-hero .hs", { y: 24, autoAlpha: 0, duration: 1, stagger: 0.06 }, 0.5);
  }

  PTL.initReveals();

  /* ---------- globe regions ---------- */
  var geo = document.querySelector(".geo");
  if (geo) {
    var hero = geo.querySelector(".geo-hero");
    var head = geo.querySelector(".geo-head");
    var panels = gsap.utils.toArray(".geo-panel");
    var dots = geo.querySelectorAll(".geo-dots i");
    var dotsWrap = geo.querySelector(".geo-dots");
    var hint = geo.querySelector(".scroll-hint");
    var canvas = geo.querySelector(".globe-canvas");
    var start = 0.16, n = panels.length, span = (1 - start) / n;
    var mob = function () { return window.innerWidth <= 760 || window.innerWidth / window.innerHeight < 0.9; };
    ScrollTrigger.create({
      trigger: geo, start: "top top", end: "bottom bottom", scrub: true,
      onUpdate: function (self) {
        var p = self.progress;
        var heroA = 1 - gsap.utils.clamp(0, 1, (p - 0.06) / 0.08);
        hero.style.opacity = heroA;
        hero.style.visibility = heroA > 0.01 ? "visible" : "hidden";
        hero.style.filter = "blur(" + (1 - heroA) * 8 + "px)";
        hint.style.opacity = heroA;
        // small screens: the globe sits behind the hero text, so dim it until the regions start
        if (canvas) canvas.style.opacity = mob() ? String(0.32 + 0.68 * (1 - heroA)) : "";
        var inR = p >= start - 0.02;
        var headA = gsap.utils.clamp(0, 1, (p - start + 0.04) / 0.05);
        head.style.opacity = headA;
        dotsWrap.style.opacity = headA;
        var region = Math.min(n - 1, Math.max(0, Math.floor((p - start) / span)));
        panels.forEach(function (panel, i) {
          var a0 = start + i * span;
          var local = (p - a0) / span;
          var a = local < 0 ? 0 : local < 0.18 ? local / 0.18 : local < 0.82 ? 1 : local < 1 ? (1 - local) / 0.18 : 0;
          if (i === n - 1 && local >= 0.82) a = 1;
          if (i === 0 && local < 0.18) a = gsap.utils.clamp(0, 1, local / 0.18);
          panel.style.opacity = a;
          panel.style.visibility = a > 0.01 ? "visible" : "hidden";
          var low = mob() || window.innerHeight < 560;
          panel.style.transform = low ? "translateY(" + (1 - a) * 30 + "px)" : "translateY(" + (-30 - (1 - a) * 10) + "%)";
        });
        dots.forEach(function (d, i) { d.classList.toggle("on", i === region && inR); });
        PTL.geo.p = p;
        PTL.geo.inRegions = inR;
        PTL.geo.region = region;
      }
    });
  }

  /* ---------- route path ---------- */
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
})();

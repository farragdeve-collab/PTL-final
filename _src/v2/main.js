/* PTL v2 — Editorial: page choreography. */
(function () {
  var PTL = window.PTL;
  var motion = PTL.hasGsap;
  var rtl = PTL.rtl;
  var dirSign = rtl ? 1 : -1;

  /* ---------- reviews rotator (works without GSAP) ---------- */
  var quotes = document.querySelectorAll(".quote");
  var qbtns = document.querySelectorAll(".quote-nav button");
  var qi = 0, qtimer = null;
  function showQuote(i) {
    qi = (i + quotes.length) % quotes.length;
    quotes.forEach(function (q, k) { q.classList.toggle("is-active", k === qi); });
    qbtns.forEach(function (b, k) {
      b.classList.remove("is-active");
      if (k === qi) { void b.offsetWidth; b.classList.add("is-active"); }
    });
    clearTimeout(qtimer);
    if (!PTL.reduced) qtimer = setTimeout(function () { showQuote(qi + 1); }, 6000);
  }
  if (quotes.length) {
    qbtns.forEach(function (b, k) { b.addEventListener("click", function () { showQuote(k); }); });
    showQuote(0);
  }

  if (!motion) {
    document.documentElement.classList.add("no-motion");
    var c0 = document.querySelector(".curtain");
    if (c0) c0.remove();
    return;
  }

  /* ---------- curtain → hero ---------- */
  function heroIntro() {
    var tl = gsap.timeline({ defaults: { ease: "expo.out" } });
    tl.fromTo(".site-header", { y: -30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, clearProps: "transform,opacity,visibility" }, 0);
    if (document.querySelector(".hero-card")) {
      tl.from(".hero-card", { clipPath: "inset(6% 6% 6% 6% round 40px)", duration: 1.6, ease: "expo.inOut" }, 0)
        .from(".hero-bg", { scale: 1.3, duration: 2.2, ease: "power3.out" }, 0)
        .from(".hero-title .line > *", { yPercent: 110, duration: 1.4, stagger: 0.1 }, 0.5)
        .from(".hero-eyebrow, .hero-sub, .hero-actions", { y: 24, autoAlpha: 0, duration: 1.1, stagger: 0.08 }, 0.8)
        .from(".hero-bar .hs, .hero-bar .scroll-btn", { y: 30, autoAlpha: 0, duration: 1, stagger: 0.07 }, 1);
    }
    return tl;
  }
  var curtain = document.querySelector(".curtain");
  if (curtain) {
    if (PTL.lenis) PTL.lenis.stop();
    var ready = Promise.race([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise(function (r) { setTimeout(r, 2500); })
    ]);
    gsap.from(curtain.querySelector("img"), { y: 20, autoAlpha: 0, duration: 0.9, ease: "power3.out" });
    ready.then(function () {
      gsap.timeline({ delay: 0.5 })
        .to(curtain.querySelector("img"), { y: -20, autoAlpha: 0, duration: 0.5, ease: "power2.in" })
        .to(curtain, { yPercent: -100, duration: 1.1, ease: "expo.inOut" })
        .add(function () { if (PTL.lenis) PTL.lenis.start(); }, "-=0.6")
        .add(heroIntro(), "-=0.7")
        .add(function () { curtain.remove(); ScrollTrigger.refresh(); });
    });
  } else {
    heroIntro();
  }

  PTL.initReveals();

  /* ---------- expanding window ---------- */
  var win = document.querySelector(".window");
  if (win) {
    var small = window.innerWidth < 760 ? "inset(22% 8% 22% 8% round 20px)" : "inset(18% 22% 18% 22% round 28px)";
    gsap.timeline({ scrollTrigger: { trigger: win, start: "top top", end: "bottom bottom", scrub: true } })
      .fromTo(".window-frame", { clipPath: small }, { clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none", duration: 0.6 }, 0)
      .fromTo(".window-img", { scale: 1.25 }, { scale: 1, ease: "none", duration: 0.6 }, 0)
      .to(".window-meta", { autoAlpha: 0, duration: 0.2 }, 0.1)
      .to(".window-shade", { opacity: 1, duration: 0.25 }, 0.45)
      .fromTo(".window-copy", { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.25 }, 0.55)
      .to({}, { duration: 0.2 });
  }

  /* ---------- service cursor preview ---------- */
  var preview = document.querySelector(".cursor-preview");
  if (preview && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    var pimg = preview.querySelector("img");
    var px = gsap.quickTo(preview, "x", { duration: 0.6, ease: "power3" });
    var py = gsap.quickTo(preview, "y", { duration: 0.6, ease: "power3" });
    gsap.set(preview, { xPercent: -50, yPercent: -50 });
    window.addEventListener("pointermove", function (e) { px(e.clientX); py(e.clientY); }, { passive: true });
    document.querySelectorAll(".svc").forEach(function (row) {
      row.addEventListener("mouseenter", function () {
        pimg.src = row.dataset.img;
        gsap.to(preview, { autoAlpha: 1, scale: 1, rotate: rtl ? 4 : -4, duration: 0.5, ease: "power3.out" });
      });
      row.addEventListener("mouseleave", function () {
        gsap.to(preview, { autoAlpha: 0, scale: 0.6, rotate: 0, duration: 0.4, ease: "power3.in" });
      });
    });
  }

  /* ---------- horizontal journey ---------- */
  var jr = document.querySelector(".journey");
  if (jr) {
    var track = jr.querySelector(".journey-track");
    var fill = jr.querySelector(".journey-line i");
    var dots = jr.querySelectorAll(".journey-line b");
    var dist = function () { return Math.max(0, track.scrollWidth - window.innerWidth); };
    var setH = function () { jr.style.height = (dist() + window.innerHeight * 1.15) + "px"; };
    setH();
    ScrollTrigger.addEventListener("refreshInit", setH);
    gsap.to(track, {
      x: function () { return dirSign * dist(); }, ease: "none",
      scrollTrigger: {
        trigger: jr, start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true,
        onUpdate: function (self) {
          fill.style.transform = "scaleX(" + self.progress + ")";
          dots.forEach(function (d, k) { d.classList.toggle("on", self.progress >= k / (dots.length - 1) - 0.02); });
        }
      }
    });
    gsap.utils.toArray(".jcard-media img").forEach(function (img) {
      gsap.fromTo(img, { xPercent: rtl ? -6 : 6 }, {
        xPercent: rtl ? 6 : -6, ease: "none",
        scrollTrigger: { trigger: jr, start: "top top", end: "bottom bottom", scrub: true }
      });
    });
  }

  /* ---------- value images: wipe up ---------- */
  gsap.utils.toArray(".value-media").forEach(function (m) {
    gsap.to(m, { clipPath: "inset(0% 0 0 0 round 20px)", duration: 1.4, ease: "expo.out", scrollTrigger: { trigger: m, start: "top 85%" } });
  });
  gsap.utils.toArray(".page-photo-inner").forEach(function (m) {
    gsap.from(m, { clipPath: "inset(12% 12% 12% 12% round 26px)", ease: "none", scrollTrigger: { trigger: m, start: "top 95%", end: "top 25%", scrub: true } });
  });
})();

/* PTL core: i18n, smooth scroll, shared interactions.
   Loaded after content.js and (optionally) GSAP + ScrollTrigger + Lenis. */
(function () {
  var LANGS = ["ar", "en", "fr", "zh"];
  var DEFAULT = "ar";
  var C = window.PTL_CONTENT || {};

  function store(k, v) {
    try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  }

  var params = new URLSearchParams(location.search);
  var lang = params.get("lang");
  if (LANGS.indexOf(lang) < 0) lang = store("ptl-lang");
  if (LANGS.indexOf(lang) < 0) lang = DEFAULT;
  store("ptl-lang", lang);

  var dict = C[lang] || C[DEFAULT];
  var t = function (k) { return dict[k] != null ? dict[k] : (C[DEFAULT][k] != null ? C[DEFAULT][k] : k); };
  var rtl = lang === "ar";
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var root = document.documentElement;
  root.lang = lang === "zh" ? "zh-CN" : lang;
  root.dir = rtl ? "rtl" : "ltr";
  root.classList.add("lang-" + lang, "js");

  var PTL = (window.PTL = { lang: lang, t: t, rtl: rtl, reduced: reduced, lenis: null, langs: LANGS });

  /* ---------- translate ---------- */
  function translate(scope) {
    scope = scope || document;
    scope.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    scope.querySelectorAll("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.dataset.i18nHtml); });
    scope.querySelectorAll("[data-i18n-ph]").forEach(function (el) { el.setAttribute("placeholder", t(el.dataset.i18nPh)); });
    scope.querySelectorAll("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    var page = root.dataset.page;
    if (page) document.title = t("meta." + page);
    var md = document.querySelector('meta[name="description"]');
    if (md) md.setAttribute("content", t("meta.desc"));
  }
  translate();
  PTL.translate = translate;

  /* keep ?lang on internal links so language survives when storage is blocked */
  document.querySelectorAll('a[href$=".html"], a[href*=".html#"]').forEach(function (a) {
    var href = a.getAttribute("href");
    if (/^https?:/.test(href)) return;
    var parts = href.split("#");
    a.setAttribute("href", parts[0] + "?lang=" + lang + (parts[1] ? "#" + parts[1] : ""));
  });

  /* ---------- language switcher ---------- */
  document.querySelectorAll("[data-lang]").forEach(function (b) {
    if (b.dataset.lang === lang) { b.classList.add("is-active"); b.setAttribute("aria-current", "true"); }
    b.addEventListener("click", function (e) {
      e.preventDefault();
      var next = b.dataset.lang;
      if (next === lang) return;
      store("ptl-lang", next);
      var u = new URL(location.href);
      u.searchParams.set("lang", next);
      document.body.classList.add("is-leaving");
      setTimeout(function () { location.href = u.toString(); }, reduced ? 0 : 380);
    });
  });

  /* ---------- helpers ---------- */
  // Split into words only: splitting Arabic into letters breaks joining.
  PTL.splitWords = function (el, cls) {
    if (!el || el.dataset.split) return el ? el.querySelectorAll(".w > span") : [];
    var text = el.textContent.trim();
    el.textContent = "";
    text.split(/\s+/).forEach(function (word, i, arr) {
      var w = document.createElement("span");
      w.className = "w" + (cls ? " " + cls : "");
      var inner = document.createElement("span");
      inner.textContent = word;
      w.appendChild(inner);
      el.appendChild(w);
      if (i < arr.length - 1) el.appendChild(document.createTextNode(" "));
    });
    el.dataset.split = "1";
    return el.querySelectorAll(".w > span");
  };
  // Chinese has no spaces: split into characters there instead.
  PTL.splitSmart = function (el, cls) {
    if (lang !== "zh") return PTL.splitWords(el, cls);
    if (!el || el.dataset.split) return el.querySelectorAll(".w > span");
    var text = el.textContent.trim();
    el.textContent = "";
    // Keep CJK line-breaking rules: closing punctuation stays with the character before it,
    // opening punctuation with the one after, and Latin words/numbers stay whole.
    var CLOSE = "。，、．！？；：」』）》〉】〕”’…%", OPEN = "「『（《〈【〔“‘";
    var tokens = [];
    Array.from(text).forEach(function (ch) {
      var last = tokens[tokens.length - 1];
      if (last !== undefined && (CLOSE.indexOf(ch) >= 0 || OPEN.indexOf(last.slice(-1)) >= 0 ||
          (/[A-Za-z0-9.\-]/.test(ch) && /[A-Za-z0-9.\-]$/.test(last)))) tokens[tokens.length - 1] = last + ch;
      else tokens.push(ch);
    });
    tokens.forEach(function (tok) {
      if (/^\s+$/.test(tok)) { el.appendChild(document.createTextNode(" ")); return; }
      var w = document.createElement("span");
      w.className = "w" + (cls ? " " + cls : "");
      var inner = document.createElement("span");
      inner.textContent = tok;
      w.appendChild(inner);
      el.appendChild(w);
    });
    el.dataset.split = "1";
    return el.querySelectorAll(".w > span");
  };

  /* ---------- header + menu ---------- */
  var header = document.querySelector(".site-header");
  var lastY = 0;
  function onScroll() {
    var y = window.scrollY;
    if (header) {
      header.classList.toggle("is-scrolled", y > 40);
      header.classList.toggle("is-hidden", y > 400 && y > lastY && !document.body.classList.contains("menu-open"));
    }
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var toggle = document.querySelector(".menu-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("menu-open");
      toggle.setAttribute("aria-expanded", String(open));
      if (PTL.lenis) open ? PTL.lenis.stop() : PTL.lenis.start();
    });
    document.querySelectorAll(".mobile-menu a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
        if (PTL.lenis) PTL.lenis.start();
      });
    });
  }

  /* ---------- FAQ ---------- */
  document.querySelectorAll("[data-faq] .faq-q").forEach(function (q) {
    q.addEventListener("click", function () {
      var item = q.closest(".faq-item");
      var open = item.classList.toggle("is-open");
      q.setAttribute("aria-expanded", String(open));
      var a = item.querySelector(".faq-a");
      a.style.maxHeight = open ? a.scrollHeight + "px" : "0px";
      if (window.ScrollTrigger) setTimeout(function () { ScrollTrigger.refresh(); }, 450);
    });
  });

  /* ---------- open now (Cairo, Sat–Thu 9:00–20:00) ---------- */
  document.querySelectorAll("[data-open-status]").forEach(function (el) {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
      var get = function (type) { return (parts.find(function (p) { return p.type === type; }) || {}).value; };
      var day = get("weekday"), h = parseInt(get("hour"), 10), m = parseInt(get("minute"), 10);
      var open = day !== "Fri" && (h * 60 + m) >= 540 && (h * 60 + m) < 1200;
      el.classList.add(open ? "is-open" : "is-closed");
      el.querySelector("[data-open-label]").textContent = t(open ? "open.now" : "open.closed");
      var clock = el.querySelector("[data-open-time]");
      if (clock) clock.textContent = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + " " + t("open.cairo");
    } catch (e) { el.hidden = true; }
  });

  /* ---------- contact form → WhatsApp ---------- */
  document.querySelectorAll("[data-wa-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = new FormData(form);
      var err = form.querySelector(".form-error");
      if (!String(f.get("name") || "").trim() || !String(f.get("phone") || "").trim()) {
        if (err) { err.textContent = t("form.err"); err.hidden = false; }
        return;
      }
      if (err) err.hidden = true;
      var lines = [t("wa.msg"), "",
        t("form.name") + ": " + f.get("name"),
        t("form.phone") + ": " + f.get("phone")];
      if (f.get("email")) lines.push(t("form.email") + ": " + f.get("email"));
      if (f.get("service")) lines.push(t("form.service") + ": " + f.get("service"));
      if (f.get("message")) lines.push(t("form.msg") + ": " + f.get("message"));
      window.open("https://wa.me/" + window.PTL_CONTACT.whatsapp + "?text=" + encodeURIComponent(lines.join("\n")), "_blank", "noopener");
    });
  });
  document.querySelectorAll("[data-wa-link]").forEach(function (a) {
    a.href = "https://wa.me/" + window.PTL_CONTACT.whatsapp + "?text=" + encodeURIComponent(t("wa.msg"));
  });

  /* ---------- motion ---------- */
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  // Scroll-driven motion runs even with "reduce motion" on: it only moves when the visitor scrolls.
  // Self-running motion (loops, idle spins, auto-rotation) checks PTL.reduced and stays still.
  PTL.hasGsap = hasGsap;

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger);
    if (!reduced && window.Lenis) {
      var lenis = new Lenis({ duration: 1.15, smoothWheel: true, easing: function (x) { return Math.min(1, 1.001 - Math.pow(2, -10 * x)); } });
      PTL.lenis = lenis;
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
      document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener("click", function (e) {
          var id = a.getAttribute("href");
          if (id.length < 2) { e.preventDefault(); lenis.scrollTo(0); return; }
          var target = document.querySelector(id);
          if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: -40 }); }
        });
      });
    }
  }

  // Generic reveals; versions call PTL.initReveals() after their own setup.
  PTL.initReveals = function () {
    if (!PTL.hasGsap) {
      return;
    }
    gsap.utils.toArray("[data-reveal]").forEach(function (el) {
      // fromTo, not from: end values must not depend on the element's state at creation
      gsap.fromTo(el, { y: 50, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 1.1, ease: "power3.out",
        delay: parseFloat(el.dataset.delay || 0),
        scrollTrigger: { trigger: el, start: "top 88%" }
      });
    });
    gsap.utils.toArray("[data-reveal-words]").forEach(function (el) {
      var words = PTL.splitSmart(el);
      gsap.fromTo(words, { yPercent: 110 }, {
        yPercent: 0, duration: 1, ease: "power4.out", stagger: lang === "zh" ? 0.02 : 0.045,
        scrollTrigger: { trigger: el, start: "top 86%" }
      });
    });
    gsap.utils.toArray("[data-scrub-words]").forEach(function (el) {
      var words = PTL.splitSmart(el, "scrub");
      gsap.fromTo(words, { opacity: 0.14 }, {
        opacity: 1, stagger: 0.1, ease: "none",
        scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 45%", scrub: true }
      });
    });
    gsap.utils.toArray("[data-count]").forEach(function (el) {
      var raw = el.dataset.count || el.textContent.trim();
      var n = parseFloat(raw);
      var suffix = raw.replace(/[\d.]/g, "");
      var o = { v: 0 };
      gsap.to(o, {
        v: n, duration: 2, ease: "power2.out",
        scrollTrigger: { trigger: el, start: "top 90%" },
        onUpdate: function () { el.textContent = Math.round(o.v) + suffix; }
      });
    });
    gsap.utils.toArray("[data-parallax]").forEach(function (el) {
      var amt = parseFloat(el.dataset.parallax) || 12;
      gsap.fromTo(el, { yPercent: -amt }, {
        yPercent: amt, ease: "none",
        scrollTrigger: { trigger: el.parentElement, start: "top bottom", end: "bottom top", scrub: true }
      });
    });
  };

  // Fonts change line metrics; refresh triggers once they settle.
  if (document.fonts && document.fonts.ready && hasGsap) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  window.addEventListener("load", function () { if (hasGsap) ScrollTrigger.refresh(); });

  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();

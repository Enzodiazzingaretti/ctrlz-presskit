/* CTRL.Z — Press Kit
   El HTML ya trae todo el contenido escrito (sirve sin JS y para SEO).
   Si existe content.json, sobreescribe ese contenido: eso es lo que edita
   el panel en /admin.html. Después: barra, reveals y visor de fotos. */

(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  /* ══ Helpers de contenido ══════════════════════════════════ */

  // Marcado mínimo y seguro: *texto* → <b>texto</b>. Nada de HTML crudo,
  // así lo que se escribe en el panel nunca puede inyectar etiquetas.
  function rich(el, text) {
    el.textContent = '';
    String(text == null ? '' : text).split(/\*([^*]+)\*/).forEach(function (chunk, i) {
      if (!chunk) return;
      if (i % 2) {
        var b = document.createElement('b');
        b.textContent = chunk;
        el.appendChild(b);
      } else {
        el.appendChild(document.createTextNode(chunk));
      }
    });
  }

  function text(sel, value, root) {
    var el = $(sel, root);
    if (el && value != null && value !== '') el.textContent = value;
  }

  function setImg(sel, src) {
    var el = $(sel);
    if (el && src) el.setAttribute('src', src);
  }

  // Reemplaza los hijos de un contenedor por una lista nueva
  function fill(el, items, build) {
    if (!el || !Array.isArray(items)) return;
    el.textContent = '';
    items.forEach(function (item, i) { el.appendChild(build(item, i)); });
  }

  function li(cls) {
    var el = document.createElement('li');
    if (cls) el.className = cls;
    return el;
  }

  /* ══ Hidratación ═══════════════════════════════════════════ */

  function hydrate(c) {
    if (!c || typeof c !== 'object') return;

    /* — secciones on/off — */
    var secs = c.sections || {};
    $$('[data-sec]').forEach(function (sec) {
      if (secs[sec.dataset.sec] === false) sec.style.display = 'none';
    });
    // Un enlace del menú que apunte a una sección apagada sobra
    $$('.bar__nav a').forEach(function (a) {
      var target = document.querySelector(a.getAttribute('href'));
      if (target && target.style.display === 'none') a.style.display = 'none';
    });

    /* — artista — */
    var a = c.artist || {};
    if (a.name) {
      $$('.cover__logo, .bar__brand img, .foot__logo').forEach(function (img) {
        img.alt = a.name;
      });
    }
    if (a.pressKit) {
      $$('[data-presskit]').forEach(function (el) { el.href = a.pressKit; });
    }

    var phones = a.phones || {};
    function phoneRow(slot, value) {
      var row = $('[data-row="' + slot + '"]');
      if (!row || !value) return;
      text('.row__v', value, row);
      row.href = 'https://wa.me/' + value.replace(/[^\d]/g, '');
    }
    phoneRow('manager', phones.manager);
    phoneRow('dj', phones.dj);

    var mail = $('[data-row="mail"]');
    if (mail && a.email) {
      text('.row__v', a.email, mail);
      mail.href = 'mailto:' + a.email;
    }

    var socials = a.socials || {};
    Object.keys(socials).forEach(function (key) {
      var el = $('[data-soc="' + key + '"]');
      var data = socials[key] || {};
      if (!el) return;
      if (data.url) el.href = data.url;
      text('span', data.handle, el);
    });

    /* — portada — */
    var cover = c.cover || {};
    text('.cover__kicker', cover.kicker);
    fill($('.cover__meta'), cover.meta, function (t) {
      var el = li();
      el.textContent = t;
      return el;
    });

    /* — ticker de géneros (se duplica para que el loop sea continuo) — */
    var track = $('.ticker__track');
    if (track && Array.isArray(c.genres) && c.genres.length) {
      track.textContent = '';
      for (var pass = 0; pass < 2; pass++) {
        c.genres.forEach(function (g) {
          var s = document.createElement('span');
          s.textContent = g;
          var sep = document.createElement('i');
          sep.textContent = '◆';
          track.appendChild(s);
          track.appendChild(sep);
        });
      }
    }

    /* — biografía — */
    var bio = c.bio || {};
    text('#bio .chrome', bio.title);
    if (bio.caption) {
      var cap = $('.bio__fig figcaption');
      if (cap) cap.textContent = bio.caption;
    }
    var card = $('.bio__card');
    if (card && (bio.lead || bio.paras || bio.quote)) {
      card.textContent = '';
      if (bio.lead) {
        var lead = document.createElement('p');
        lead.className = 'bio__lead';
        rich(lead, bio.lead);
        card.appendChild(lead);
      }
      (bio.paras || []).forEach(function (t) {
        var p = document.createElement('p');
        rich(p, t);
        card.appendChild(p);
      });
      if (bio.quote) {
        var q = document.createElement('p');
        q.className = 'bio__quote';
        q.textContent = bio.quote;
        card.appendChild(q);
      }
    }

    fill($('.facts'), c.facts, function (f) {
      var el = li();
      var b = document.createElement('b');
      b.textContent = f.value || '';
      var s = document.createElement('span');
      s.textContent = f.label || '';
      el.appendChild(b);
      el.appendChild(s);
      return el;
    });

    /* — compartió escenario — */
    var shared = c.shared || {};
    text('.shared__label', shared.label);
    fill($('.shared__list'), shared.items, function (item) {
      var el = li();
      el.appendChild(document.createTextNode(item.name || ''));
      if (item.note) {
        var em = document.createElement('em');
        em.textContent = item.note;
        el.appendChild(em);
      }
      return el;
    });

    /* — escenarios — */
    var stages = c.stages || {};
    text('#escenarios .chrome', stages.title);
    text('#escenarios .head__sub', stages.sub);
    fill($('.stages__list'), stages.items, function (item) {
      var el = li('reveal');
      var b = document.createElement('b');
      b.textContent = item.name || '';
      var s = document.createElement('span');
      s.textContent = item.city || '';
      el.appendChild(b);
      el.appendChild(s);
      return el;
    });
    if (stages.note) rich($('.stages__note'), stages.note);

    /* — press photos — */
    var shots = c.shots || {};
    text('#fotos .chrome', shots.title);
    text('#fotos .head__sub', shots.sub);
    var strip = $('#strip');
    if (strip && Array.isArray(c.gallery) && c.gallery.length) {
      strip.textContent = '';
      c.gallery.forEach(function (shot) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'shot';
        btn.dataset.src = shot.src;
        var img = document.createElement('img');
        img.src = shot.src;
        img.alt = shot.alt || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.appendChild(img);
        strip.appendChild(btn);
      });
    }

    /* — rider — */
    var rider = c.rider || {};
    text('#rider .chrome', rider.title);
    text('#rider .head__sub', rider.sub);
    text('#rider .sub', rider.reqsTitle);
    var opts = $('.opts');
    if (opts && Array.isArray(rider.options)) {
      opts.textContent = '';
      rider.options.forEach(function (opt) {
        var art = document.createElement('article');
        art.className = 'opt reveal';
        var tag = document.createElement('span');
        tag.className = 'opt__tag';
        tag.textContent = opt.tag || '';
        var h3 = document.createElement('h3');
        h3.textContent = opt.title || '';
        var p = document.createElement('p');
        rich(p, opt.detail);
        art.appendChild(tag);
        art.appendChild(h3);
        art.appendChild(p);
        opts.appendChild(art);
      });
    }
    fill($('#rider .reqs'), rider.reqs, function (t) {
      var el = li('reveal');
      rich(el, t);
      return el;
    });

    /* — hospitalidad — */
    var hosp = c.hosp || {};
    text('#hospitalidad .chrome', hosp.title);
    fill($('#hospitalidad .reqs'), hosp.items, function (t) {
      var el = li('reveal');
      rich(el, t);
      return el;
    });

    /* — booking — */
    var booking = c.booking || {};
    text('#booking .chrome', booking.title);
    text('#booking .head__sub', booking.sub);

    /* — imágenes — */
    var img = c.images || {};
    setImg('.cover__media img', img.cover);
    setImg('.bio__fig img', img.bio);
    setImg('.shared__bg img', img.shared);
    setImg('.stages__bg img', img.stages);
    setImg('.hosp__bg img', img.hosp);
    setImg('.rider__fig img', img.riderDiagram);
    setImg('.booking__media img', img.booking);
  }

  /* ══ Barra: fondo sólido apenas se sale de la portada ═══════ */

  var bar = document.getElementById('bar');
  function onScroll() { bar.classList.toggle('is-stuck', window.scrollY > 40); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ══ Reveals ═══════════════════════════════════════════════ */

  var io = null;

  // Se puede llamar varias veces: la hidratación crea nodos nuevos y hay que
  // observarlos también. Los ya observados quedan marcados.
  function initReveals() {
    var targets = $$('.reveal').filter(function (el) { return !el.dataset.seen; });
    if (!targets.length) return;

    if (reduce || !('IntersectionObserver' in window)) {
      targets.forEach(function (el) {
        el.dataset.seen = '1';
        el.classList.add('is-in');
      });
      return;
    }

    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          // Escalona los hermanos de una misma lista para que entren en cascada
          var siblings = Array.prototype.slice.call(entry.target.parentNode.children);
          var i = siblings.indexOf(entry.target);
          entry.target.style.transitionDelay = Math.min(i, 8) * 55 + 'ms';
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    }

    targets.forEach(function (el) {
      el.dataset.seen = '1';
      io.observe(el);
    });
  }

  /* ══ Visor de fotos ════════════════════════════════════════ */

  var lightboxReady = false;

  // Los botones se resuelven en el momento del clic: así la galería puede
  // reconstruirse desde content.json sin volver a enganchar nada.
  function initLightbox() {
    if (lightboxReady) return;

    var lb = document.getElementById('lb');
    var lbImg = document.getElementById('lbImg');
    var strip = document.getElementById('strip');
    if (!lb || !strip) return;
    lightboxReady = true;

    var current = 0;
    function shots() { return $$('.shot', strip); }

    function show(i) {
      var list = shots();
      if (!list.length) return;
      current = (i + list.length) % list.length;
      var btn = list[current];
      lbImg.src = btn.dataset.src;
      lbImg.alt = btn.querySelector('img').alt;
    }

    function open(i) {
      show(i);
      lb.classList.add('is-open');
      lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      document.getElementById('lbClose').focus();
    }

    function close() {
      lb.classList.remove('is-open');
      lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      var list = shots();
      if (list[current]) list[current].focus();
    }

    strip.addEventListener('click', function (e) {
      var btn = e.target.closest('.shot');
      if (btn) open(shots().indexOf(btn));
    });

    document.getElementById('lbClose').addEventListener('click', close);
    document.getElementById('lbPrev').addEventListener('click', function () { show(current - 1); });
    document.getElementById('lbNext').addEventListener('click', function () { show(current + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });

    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') show(current - 1);
      else if (e.key === 'ArrowRight') show(current + 1);
    });
  }

  /* ══ Arranque ══════════════════════════════════════════════ */

  function start() {
    initReveals();
    initLightbox();
  }

  // El sitio funciona sin content.json: si falla, sigue con lo que trae el HTML.
  // El timeout evita que una respuesta colgada deje el contenido escondido.
  var load = fetch('content.json', { cache: 'no-cache' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) { hydrate(data); })
    .catch(function () { /* sin content.json queda el contenido del HTML */ });

  var timeout = new Promise(function (resolve) { setTimeout(resolve, 2500); });

  // Si gana el timeout se arranca igual con el contenido del HTML; cuando la
  // carga termine se vuelve a llamar para enganchar lo que se haya reemplazado.
  Promise.race([load, timeout]).then(start);
  load.then(start);
})();

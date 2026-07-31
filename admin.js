/* ============================================================
   CTRL.Z — Consola
   Misma lógica que los press kits anteriores: no hay base de datos,
   el repositorio es la base de datos. El panel lee y escribe
   content.json (e imágenes en img/) vía la API de GitHub.

   Dos modos de entrada:
     'api'   → la función serverless guarda el token (login con contraseña)
     'token' → el navegador guarda un PAT (respaldo: preview local, etc.)
   ============================================================ */

(function () {
  'use strict';

  var OWNER = 'enzodiazzingaretti27-design';
  var REPO = 'ctrlz-presskit';
  var BRANCH = 'main';
  var CONTENT_FILE = 'content.json';
  var TOKEN_KEY = 'ctrlz-admin-token';

  var $ = function (id) { return document.getElementById(id); };
  var mode = 'token';
  var token = localStorage.getItem(TOKEN_KEY) || '';
  var content = null;
  var sha = null;
  var dirty = false;

  /* ══ Utilidades ════════════════════════════════════════════ */

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    bytes.forEach(function (b) { bin += String.fromCharCode(b); });
    return btoa(bin);
  }
  function b64decode(b64) {
    return new TextDecoder().decode(
      Uint8Array.from(atob(String(b64).replace(/\n/g, '')), function (c) { return c.charCodeAt(0); })
    );
  }

  function setStatus(el, msg, cls) {
    el.textContent = msg;
    el.className = 'status' + (el.id === 'saveStatus' ? ' status--bar' : '') + (cls ? ' status--' + cls : '');
  }

  function markDirty() {
    dirty = true;
    $('dirtyFlag').classList.add('pending');
    $('dirtyText').textContent = 'Cambios sin publicar';
    setStatus($('saveStatus'), '', '');
  }
  function clearDirty() {
    dirty = false;
    $('dirtyFlag').classList.remove('pending');
    $('dirtyText').textContent = 'Todo publicado';
  }

  function getPath(obj, path) {
    return path.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setPath(obj, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var target = keys.reduce(function (o, k) {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
      return o[k];
    }, obj);
    target[last] = value;
  }

  function el(tag, cls, txt) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (txt != null) node.textContent = txt;
    return node;
  }

  /* ══ Lectura y escritura ═══════════════════════════════════ */

  var ghHeaders = function () {
    return {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  };
  var ghUrl = function (path) {
    return 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path;
  };

  function readContent() {
    if (mode === 'api') {
      return fetch('/api/content?file=' + encodeURIComponent(CONTENT_FILE), { credentials: 'same-origin' })
        .then(function (res) {
          if (res.status === 401) throw new Error('La sesión expiró. Volvé a entrar');
          if (!res.ok) throw new Error('No se pudo leer content.json');
          return res.json();
        })
        .then(function (json) { return json.data; });
    }
    return fetch(ghUrl(CONTENT_FILE) + '?ref=' + BRANCH, { headers: ghHeaders() })
      .then(function (res) {
        if (res.status === 401 || res.status === 403) {
          throw new Error('El token no es válido o no tiene permiso de escritura');
        }
        if (!res.ok) throw new Error('GitHub respondió ' + res.status);
        return res.json();
      })
      .then(function (json) {
        sha = json.sha;
        return JSON.parse(b64decode(json.content));
      });
  }

  function writeContent(data) {
    if (mode === 'api') {
      return fetch('/api/content', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: CONTENT_FILE, data: data, message: 'update: contenido desde la consola' })
      }).then(function (res) {
        if (res.status === 401) throw new Error('La sesión expiró. Volvé a entrar');
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (err) {
            throw new Error(err.error ? 'No se pudo guardar: ' + err.error : 'No se pudo guardar');
          });
        }
      });
    }
    var body = {
      message: 'update: contenido desde la consola',
      content: b64encode(JSON.stringify(data, null, 2) + '\n'),
      branch: BRANCH
    };
    if (sha) body.sha = sha;
    return fetch(ghUrl(CONTENT_FILE), { method: 'PUT', headers: ghHeaders(), body: JSON.stringify(body) })
      .then(function (res) {
        if (res.status === 409) throw new Error('content.json cambió por fuera. Recargá y volvé a guardar');
        if (!res.ok) throw new Error('No se pudo guardar (' + res.status + ')');
        return res.json();
      })
      .then(function (json) { sha = json.content.sha; });
  }

  /* ══ Imágenes ══════════════════════════════════════════════ */

  // Redimensiona y convierte a WebP en el navegador: nunca sube el original.
  function toWebp(file, maxW) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var w = img.naturalWidth;
        var h = img.naturalHeight;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function (blob) {
          if (!blob) return reject(new Error('No se pudo convertir la imagen'));
          var reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
          reader.onerror = function () { reject(new Error('No se pudo leer la imagen')); };
          reader.readAsDataURL(blob);
        }, 'image/webp', 0.82);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('El archivo no es una imagen válida'));
      };
      img.src = url;
    });
  }

  function uploadImage(slot, b64) {
    if (mode === 'api') {
      return fetch('/api/upload', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: slot, data: b64 })
      }).then(function (res) {
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (err) {
            throw new Error(err.error || 'No se pudo subir la imagen');
          });
        }
        return res.json();
      }).then(function (json) { return json.path; });
    }
    var path = 'img/' + slot.toLowerCase() + '-' + Date.now() + '.webp';
    return fetch(ghUrl(path), {
      method: 'PUT',
      headers: ghHeaders(),
      body: JSON.stringify({ message: 'update: imagen ' + slot, content: b64, branch: BRANCH })
    }).then(function (res) {
      if (!res.ok) throw new Error('No se pudo subir la imagen (' + res.status + ')');
      return path;
    });
  }

  /* ══ Definiciones de formulario ════════════════════════════ */

  var ARTIST_FIELDS = [
    { path: 'artist.name',                     label: 'Nombre artístico' },
    { path: 'artist.realName',                 label: 'Nombre real' },
    { path: 'artist.location',                 label: 'Ciudad y país' },
    { path: 'artist.email',                    label: 'Email de booking' },
    { path: 'artist.phones.manager',           label: 'Teléfono del manager' },
    { path: 'artist.phones.dj',                label: 'Teléfono de la DJ' },
    { path: 'artist.pressKit',                 label: 'Press kit (Drive)' },
    { path: 'artist.socials.instagram.url',    label: 'Instagram · link' },
    { path: 'artist.socials.instagram.handle', label: 'Instagram · usuario' },
    { path: 'artist.socials.youtube.url',      label: 'YouTube · link' },
    { path: 'artist.socials.youtube.handle',   label: 'YouTube · usuario' },
    { path: 'artist.socials.soundcloud.url',   label: 'SoundCloud · link' },
    { path: 'artist.socials.soundcloud.handle',label: 'SoundCloud · usuario' },
    { path: 'artist.socials.spotify.url',      label: 'Spotify · link' },
    { path: 'artist.socials.spotify.handle',   label: 'Spotify · usuario' }
  ];

  var TEXT_FIELDS = [
    { group: 'Portada', fields: [
      { path: 'cover.kicker', label: 'Bajada del logo' },
      { path: 'cover.meta.0', label: 'Dato 1' },
      { path: 'cover.meta.1', label: 'Dato 2' },
      { path: 'cover.meta.2', label: 'Dato 3' }
    ]},
    { group: 'Biografía', fields: [
      { path: 'bio.title',   label: 'Título' },
      { path: 'bio.caption', label: 'Pie de la foto' },
      { path: 'bio.lead',    label: 'Párrafo de entrada', big: true },
      { path: 'bio.paras.0', label: 'Párrafo 2', big: true },
      { path: 'bio.paras.1', label: 'Párrafo 3', big: true },
      { path: 'bio.quote',   label: 'Frase destacada' }
    ]},
    { group: 'Compartió escenario', fields: [
      { path: 'shared.label', label: 'Encabezado' }
    ]},
    { group: 'Escenarios', fields: [
      { path: 'stages.title', label: 'Título' },
      { path: 'stages.sub',   label: 'Subtítulo' },
      { path: 'stages.note',  label: 'Nota al pie', big: true }
    ]},
    { group: 'Press photos', fields: [
      { path: 'shots.title', label: 'Título' },
      { path: 'shots.sub',   label: 'Subtítulo' }
    ]},
    { group: 'Rider', fields: [
      { path: 'rider.title',     label: 'Título' },
      { path: 'rider.sub',       label: 'Subtítulo' },
      { path: 'rider.reqsTitle', label: 'Título de requerimientos' }
    ]},
    { group: 'Hospitalidad', fields: [
      { path: 'hosp.title', label: 'Título' }
    ]},
    { group: 'Booking', fields: [
      { path: 'booking.title', label: 'Título' },
      { path: 'booking.sub',   label: 'Subtítulo' }
    ]}
  ];

  var IMAGE_SLOTS = [
    { key: 'cover',        slot: 'cover',        name: 'Portada',       desc: 'Fondo del inicio, detrás del logo', maxW: 1920 },
    { key: 'bio',          slot: 'bio',          name: 'Biografía',     desc: 'Retrato junto al texto',            maxW: 1400 },
    { key: 'shared',       slot: 'shared',       name: 'Compartió',     desc: 'Fondo de la franja de artistas',    maxW: 1600 },
    { key: 'stages',       slot: 'stages',       name: 'Escenarios',    desc: 'Foto de fondo del listado',         maxW: 1800 },
    { key: 'riderDiagram', slot: 'riderdiagram', name: 'Equipos',       desc: 'Diagrama del rider técnico',        maxW: 1600 },
    { key: 'hosp',         slot: 'hosp',         name: 'Hospitalidad',  desc: 'Fondo de la sección',               maxW: 1600 },
    { key: 'booking',      slot: 'booking',      name: 'Booking',       desc: 'Fondo del bloque de contacto',      maxW: 1600 }
  ];

  var SECTION_LIST = [
    { key: 'bio',     name: 'Biografía',   desc: 'Foto, texto y datos destacados' },
    { key: 'shared',  name: 'Compartió',   desc: 'Artistas con los que compartió escenario' },
    { key: 'stages',  name: 'Escenarios',  desc: 'Listado de clubes y festivales' },
    { key: 'shots',   name: 'Press photos',desc: 'Galería de fotos en vivo' },
    { key: 'rider',   name: 'Rider',       desc: 'Opciones de cabina y requerimientos' },
    { key: 'hosp',    name: 'Hospitalidad',desc: 'Pasajes, hotel, traslados' },
    { key: 'booking', name: 'Booking',     desc: 'Contacto y redes' }
  ];

  /* ══ Render de formularios ═════════════════════════════════ */

  function inputFor(path, big) {
    var input = document.createElement(big ? 'textarea' : 'input');
    if (!big) input.type = 'text';
    var v = getPath(content, path);
    input.value = v == null ? '' : v;
    input.addEventListener('input', function () {
      setPath(content, path, input.value);
      markDirty();
    });
    return input;
  }

  function fieldBlock(def) {
    var wrap = el('div', 'field');
    wrap.appendChild(el('label', 'label', def.label));
    wrap.appendChild(inputFor(def.path, def.big));
    return wrap;
  }

  function renderArtist() {
    var box = $('artistFields');
    box.textContent = '';
    var grid = el('div', 'grid2');
    ARTIST_FIELDS.forEach(function (f) { grid.appendChild(fieldBlock(f)); });
    box.appendChild(grid);
  }

  function renderTexts() {
    var box = $('textFields');
    box.textContent = '';
    TEXT_FIELDS.forEach(function (group) {
      var det = el('details', 'grp');
      det.appendChild(el('summary', null, group.group));
      var grid = el('div', 'grid2');
      group.fields.forEach(function (f) { grid.appendChild(fieldBlock(f)); });
      det.appendChild(grid);
      box.appendChild(det);
    });
    var first = box.querySelector('.grp');
    if (first) first.open = true;
  }

  /* ── Listas ── */

  // Cada lista declara dónde vive, qué campos tiene y cómo luce una fila vacía.
  var LISTS = {
    genres:  { host: 'genres',  count: 'cGenres',  path: 'genres',         plain: true, empty: '' },
    facts:   { host: 'facts',   count: 'cFacts',   path: 'facts',          cols: [{ k: 'value', ph: 'Valor' }, { k: 'label', ph: 'Etiqueta' }], empty: { value: '', label: '' } },
    shared:  { host: 'shared',  count: 'cShared',  path: 'shared.items',   cols: [{ k: 'name', ph: 'Artista' }, { k: 'note', ph: 'Nota (opcional)' }], empty: { name: '', note: '' } },
    stages:  { host: 'stages',  count: 'cStages',  path: 'stages.items',   cols: [{ k: 'name', ph: 'Escenario' }, { k: 'city', ph: 'Ciudad' }], empty: { name: '', city: '' } },
    options: { host: 'options', count: 'cOptions', path: 'rider.options',  cols: [{ k: 'tag', ph: 'Etiqueta' }, { k: 'title', ph: 'Título' }, { k: 'detail', ph: 'Equipo', big: true }], empty: { tag: '', title: '', detail: '' } },
    reqs:    { host: 'reqs',    count: 'cReqs',    path: 'rider.reqs',     plain: true, big: true, empty: '' },
    hosp:    { host: 'hosp',    count: 'cHosp',    path: 'hosp.items',     plain: true, big: true, empty: '' }
  };

  function listData(key) {
    var arr = getPath(content, LISTS[key].path);
    if (!Array.isArray(arr)) {
      arr = [];
      setPath(content, LISTS[key].path, arr);
    }
    return arr;
  }

  function renderList(key) {
    var def = LISTS[key];
    var host = $(def.host);
    var data = listData(key);
    host.textContent = '';

    if (!data.length) host.appendChild(el('p', 'empty', 'Vacío. No se muestra nada en el sitio.'));

    data.forEach(function (item, i) {
      var row = el('div', 'row');
      var stack = el('div', 'row__stack');

      if (def.plain) {
        var input = document.createElement(def.big ? 'textarea' : 'input');
        if (!def.big) input.type = 'text';
        input.value = item == null ? '' : item;
        input.addEventListener('input', function () {
          listData(key)[i] = input.value;
          markDirty();
        });
        stack.appendChild(input);
      } else {
        def.cols.forEach(function (col) {
          var input = document.createElement(col.big ? 'textarea' : 'input');
          if (!col.big) input.type = 'text';
          input.placeholder = col.ph;
          input.value = (item && item[col.k]) || '';
          input.addEventListener('input', function () {
            var target = listData(key)[i];
            if (target && typeof target === 'object') {
              target[col.k] = input.value;
              markDirty();
            }
          });
          stack.appendChild(input);
        });
      }

      var ctrl = el('div', 'row__ctrl');
      var up = el('button', 'btn--move', '▲');
      up.type = 'button';
      up.title = 'Subir';
      up.addEventListener('click', function () { move(key, i, -1); });
      var down = el('button', 'btn--move', '▼');
      down.type = 'button';
      down.title = 'Bajar';
      down.addEventListener('click', function () { move(key, i, 1); });
      ctrl.appendChild(up);
      ctrl.appendChild(down);

      var del = el('button', 'btn--x', '✕');
      del.type = 'button';
      del.title = 'Quitar';
      del.addEventListener('click', function () {
        listData(key).splice(i, 1);
        markDirty();
        renderList(key);
      });

      row.appendChild(stack);
      row.appendChild(ctrl);
      row.appendChild(del);
      host.appendChild(row);
    });

    $(def.count).textContent = data.length || '';
  }

  function move(key, i, delta) {
    var data = listData(key);
    var j = i + delta;
    if (j < 0 || j >= data.length) return;
    var tmp = data[i];
    data[i] = data[j];
    data[j] = tmp;
    markDirty();
    renderList(key);
  }

  function addTo(key) {
    var def = LISTS[key];
    var value = def.plain ? '' : JSON.parse(JSON.stringify(def.empty));
    listData(key).push(value);
    markDirty();
    renderList(key);
  }

  function renderLists() { Object.keys(LISTS).forEach(renderList); }

  /* ── Imágenes ── */

  function renderSlots() {
    var host = $('slots');
    host.textContent = '';

    IMAGE_SLOTS.forEach(function (def) {
      var card = el('div', 'slot');
      var thumb = el('div', 'slot__thumb');
      var src = getPath(content, 'images.' + def.key);
      if (src) thumb.style.backgroundImage = 'url("' + src + '")';

      var body = el('div', 'slot__body');
      body.appendChild(el('div', 'slot__name', def.name));
      body.appendChild(el('p', 'slot__desc', def.desc));

      var label = el('label', 'btn btn--ghost btn--sm', 'Cambiar');
      var file = document.createElement('input');
      file.type = 'file';
      file.accept = 'image/*';
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        label.textContent = 'Subiendo…';
        toWebp(f, def.maxW)
          .then(function (b64) { return uploadImage(def.slot, b64); })
          .then(function (path) {
            setPath(content, 'images.' + def.key, path);
            thumb.style.backgroundImage = 'url("' + path + '")';
            label.textContent = 'Cambiar';
            markDirty();
            setStatus($('saveStatus'), 'Imagen subida. Publicá para que se vea en el sitio.', 'ok');
          })
          .catch(function (err) {
            label.textContent = 'Cambiar';
            setStatus($('saveStatus'), err.message, 'err');
          });
        file.value = '';
      });
      label.appendChild(file);
      body.appendChild(label);

      card.appendChild(thumb);
      card.appendChild(body);
      host.appendChild(card);
    });
  }

  function galleryData() {
    if (!Array.isArray(content.gallery)) content.gallery = [];
    return content.gallery;
  }

  function renderGallery() {
    var host = $('gallery');
    var data = galleryData();
    host.textContent = '';

    if (!data.length) host.appendChild(el('p', 'empty', 'Sin fotos. La galería no se muestra.'));

    data.forEach(function (shot, i) {
      var row = el('div', 'gshot');
      var thumb = el('div', 'gshot__thumb');
      if (shot.src) thumb.style.backgroundImage = 'url("' + shot.src + '")';

      var alt = document.createElement('input');
      alt.type = 'text';
      alt.placeholder = 'Descripción de la foto';
      alt.value = shot.alt || '';
      alt.addEventListener('input', function () {
        galleryData()[i].alt = alt.value;
        markDirty();
      });

      var ctrl = el('div', 'row__ctrl');
      var up = el('button', 'btn--move', '▲');
      up.type = 'button';
      up.addEventListener('click', function () {
        if (i === 0) return;
        var d = galleryData();
        var t = d[i]; d[i] = d[i - 1]; d[i - 1] = t;
        markDirty(); renderGallery();
      });
      var down = el('button', 'btn--move', '▼');
      down.type = 'button';
      down.addEventListener('click', function () {
        var d = galleryData();
        if (i >= d.length - 1) return;
        var t = d[i]; d[i] = d[i + 1]; d[i + 1] = t;
        markDirty(); renderGallery();
      });
      ctrl.appendChild(up);
      ctrl.appendChild(down);

      var del = el('button', 'btn--x', '✕');
      del.type = 'button';
      del.addEventListener('click', function () {
        galleryData().splice(i, 1);
        markDirty();
        renderGallery();
      });

      row.appendChild(thumb);
      row.appendChild(alt);
      row.appendChild(ctrl);
      row.appendChild(del);
      host.appendChild(row);
    });

    $('cGallery').textContent = data.length || '';
  }

  /* ── Secciones ── */

  function renderSwitches() {
    var host = $('switches');
    host.textContent = '';
    if (!content.sections || typeof content.sections !== 'object') content.sections = {};

    SECTION_LIST.forEach(function (def) {
      var row = el('label', 'sw');
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = content.sections[def.key] !== false;
      box.addEventListener('change', function () {
        content.sections[def.key] = box.checked;
        markDirty();
      });
      var txt = el('div');
      txt.appendChild(el('div', 'sw__name', def.name));
      txt.appendChild(el('div', 'sw__desc', def.desc));
      row.appendChild(box);
      row.appendChild(txt);
      host.appendChild(row);
    });
  }

  function renderAll() {
    renderArtist();
    renderTexts();
    renderLists();
    renderSlots();
    renderGallery();
    renderSwitches();
    clearDirty();
  }

  /* ══ Entrada ═══════════════════════════════════════════════ */

  function enter() {
    setStatus($('gateStatus'), 'Cargando contenido…', '');
    return readContent().then(function (data) {
      content = data;
      $('gate').hidden = true;
      $('app').hidden = false;
      renderAll();
    }).catch(function (err) {
      setStatus($('gateStatus'), err.message, 'err');
      throw err;
    });
  }

  $('pwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('pw').value;
    if (!pw) return;
    setStatus($('gateStatus'), 'Verificando…', '');
    fetch('/api/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    }).then(function (res) {
      if (res.status === 401) throw new Error('Contraseña incorrecta');
      if (!res.ok) throw new Error('No se pudo entrar');
      $('pw').value = '';
      return enter();
    }).catch(function (err) {
      setStatus($('gateStatus'), err.message, 'err');
    });
  });

  $('tokenForm').addEventListener('submit', function (e) {
    e.preventDefault();
    token = $('tk').value.trim();
    if (!token) return;
    localStorage.setItem(TOKEN_KEY, token);
    $('tk').value = '';
    enter().catch(function () { localStorage.removeItem(TOKEN_KEY); });
  });

  $('logout').addEventListener('click', function () {
    if (dirty && !confirm('Hay cambios sin publicar. ¿Salir igual?')) return;
    if (mode === 'api') {
      fetch('/api/logout', { method: 'POST', credentials: 'same-origin' })
        .then(function () { location.reload(); });
    } else {
      localStorage.removeItem(TOKEN_KEY);
      location.reload();
    }
  });

  $('publish').addEventListener('click', function () {
    var btn = $('publish');
    btn.disabled = true;
    setStatus($('saveStatus'), 'Publicando…', '');
    writeContent(content).then(function () {
      clearDirty();
      setStatus($('saveStatus'), 'Publicado. El sitio se actualiza en ~1 minuto.', 'ok');
    }).catch(function (err) {
      setStatus($('saveStatus'), err.message, 'err');
    }).then(function () {
      btn.disabled = false;
    });
  });

  window.addEventListener('beforeunload', function (e) {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  });

  /* ══ Tabs ══════════════════════════════════════════════════ */

  $('tabs').addEventListener('click', function (e) {
    var btn = e.target.closest('.tab');
    if (!btn) return;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) {
      t.classList.toggle('is-active', t === btn);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.pane'), function (p) {
      p.classList.toggle('is-active', p.dataset.pane === btn.dataset.tab);
    });
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-add]');
    if (btn) addTo(btn.dataset.add);
  });

  $('galleryAdd').addEventListener('change', function () {
    var input = $('galleryAdd');
    var f = input.files && input.files[0];
    if (!f) return;
    setStatus($('saveStatus'), 'Subiendo foto…', '');
    toWebp(f, 1200)
      .then(function (b64) { return uploadImage('gallery', b64); })
      .then(function (path) {
        galleryData().push({ src: path, alt: '' });
        markDirty();
        renderGallery();
        setStatus($('saveStatus'), 'Foto subida. Publicá para que se vea en el sitio.', 'ok');
      })
      .catch(function (err) { setStatus($('saveStatus'), err.message, 'err'); });
    input.value = '';
  });

  /* ══ Arranque: ¿hay API configurada? ═══════════════════════ */

  fetch('/api/session', { credentials: 'same-origin' })
    .then(function (res) { return res.ok ? res.json() : null; })
    .catch(function () { return null; })
    .then(function (info) {
      if (info && info.configured) {
        mode = 'api';
        if (info.authenticated) return enter().catch(function () { $('pwForm').hidden = false; });
        $('pwForm').hidden = false;
        return;
      }
      // Sin API (o sin variables cargadas) queda el modo token
      mode = 'token';
      $('tokenForm').hidden = false;
      if (token) {
        enter().catch(function () { localStorage.removeItem(TOKEN_KEY); token = ''; });
      } else {
        setStatus($('gateStatus'), 'El login con contraseña no está configurado en este deploy.', '');
      }
    });
})();

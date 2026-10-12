/* Carnet de fonte : comptes (Erwann / Lucie) et stockage local sur l'iPhone.
   Chaque compte a ses propres données. Le choix du compte est demandé à chaque ouverture de l'app. */
(function () {
  var PROFILES = [
    { id: 'erwann', name: 'Erwann', color: '#C4342A' },
    { id: 'lucie',  name: 'Lucie',  color: '#2356A3' }
  ];
  var SESSION_KEY = 'cdf:profile';

  /* ---------- copie de départ de chaque compte ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function seedFor(id) {
    var seed = window.CDF_SEED ? clone(window.CDF_SEED) : { exercises: {}, sessions: {} };
    if (id === 'erwann') return seed;
    // Autres comptes : mêmes exercices, sans historique ni charges
    var ex = {};
    Object.keys(seed.exercises || {}).forEach(function (k) {
      var e = seed.exercises[k];
      e.last = null;
      if (e.plan) Object.keys(e.plan).forEach(function (p) { e.plan[p] = p === 'note' ? '' : null; });
      if (/\d/.test(e.cues || '')) e.cues = ''; // consignes contenant des charges d'Erwann
      ex[k] = e;
    });
    return { exercises: ex, sessions: {} };
  }

  /* ---------- base de données locale (même interface que l'artefact) ---------- */
  function openDb(profileId) {
    var KEY = 'cdf:db:v1:' + profileId;
    var data;
    try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }
    if (!data && profileId === 'erwann') {
      // Reprise d'une installation précédente (avant les comptes)
      try { data = JSON.parse(localStorage.getItem('cdf:db:v1') || 'null'); } catch (e) { data = null; }
    }
    if (!data) data = seedFor(profileId);
    persist();

    function persist() { localStorage.setItem(KEY, JSON.stringify(data)); }
    function coll(name) { return data[name] || (data[name] = {}); }
    var listeners = [];
    function notify(name) {
      listeners.forEach(function (l) { if (l.name === name) setTimeout(l.fire, 0); });
    }
    function makeQuery(name, order, lim) {
      return {
        orderBy: function (field, dir) { return makeQuery(name, { field: field, dir: dir || 'asc' }, lim); },
        limit: function (n) { return makeQuery(name, order, n); },
        onSnapshot: function (cb, err) {
          var l = {
            name: name,
            fire: function () {
              try {
                var c = coll(name);
                var docs = Object.keys(c).map(function (id) {
                  return { id: id, data: function () { return clone(c[id]); } };
                });
                if (order) {
                  var f = order.field, s = order.dir === 'desc' ? -1 : 1;
                  docs.sort(function (a, b) {
                    var x = c[a.id][f], y = c[b.id][f];
                    return x === y ? 0 : (x > y ? s : -s);
                  });
                }
                if (lim) docs = docs.slice(0, lim);
                cb({ docs: docs, size: docs.length, empty: !docs.length });
              } catch (e) { if (err) err(e); }
            }
          };
          listeners.push(l);
          setTimeout(l.fire, 0);
          return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
        },
        doc: function (id) {
          return {
            id: id,
            set: function (obj) { coll(name)[id] = clone(obj); persist(); notify(name); return Promise.resolve(); },
            update: function (obj) {
              var c = coll(name);
              if (!c[id]) return Promise.reject({ code: 'not_found' });
              Object.keys(obj).forEach(function (k) { c[id][k] = clone(obj[k]); });
              persist(); notify(name); return Promise.resolve();
            },
            delete: function () { delete coll(name)[id]; persist(); notify(name); return Promise.resolve(); },
            get: function () {
              var d = coll(name)[id];
              return Promise.resolve({ id: id, exists: !!d, data: function () { return d ? clone(d) : undefined; } });
            }
          };
        }
      };
    }
    window.CDF_export = function () { return JSON.stringify(data); };
    window.CDF_import = function (json) { data = JSON.parse(json); persist(); location.reload(); };
    return { collection: function (name) { return makeQuery(name, null, null); } };
  }

  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

  /* ---------- démarrage ---------- */
  function boot(p) {
    try { sessionStorage.setItem(SESSION_KEY, p.id); } catch (e) {}
    window.CDF_PROFILE = p;
    var db = openDb(p.id);
    window.claude = { use: function (cap) { return Promise.resolve(cap === 'db' ? db : null); } };
    var src = document.getElementById('cdf-app');
    var s = document.createElement('script');
    s.textContent = src.textContent;
    document.body.appendChild(s);
  }

  window.CDF_switch = function () {
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    location.reload();
  };
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-cdf-switch]')) window.CDF_switch();
  });

  function chooser() {
    var css = document.createElement('style');
    css.textContent =
      '.who{min-height:100vh;min-height:100dvh;display:grid;align-content:center;gap:28px;max-width:420px;margin:0 auto;padding:24px 0}' +
      '.who h1{font:700 34px/1 "Barlow Condensed","Arial Narrow",sans-serif;text-transform:uppercase;text-align:center}' +
      '.who h1 small{display:block;font:500 13px Barlow,sans-serif;color:var(--muted);letter-spacing:.08em;margin-top:6px}' +
      '.who-list{display:grid;gap:12px}' +
      '.who-btn{display:flex;align-items:center;gap:16px;width:100%;text-align:left;background:var(--surface);border:1.5px solid transparent;border-radius:14px;padding:16px;box-shadow:var(--shadow);font:inherit;color:var(--ink);cursor:pointer;transition:transform .1s,border-color .15s}' +
      '.who-btn:active{transform:scale(.98)}' +
      '@media (hover:hover){.who-btn:hover{border-color:var(--pc)}}' +
      '.who-btn:focus-visible{outline:2px solid var(--focus);outline-offset:2px}' +
      '.who-av{flex:none;width:54px;height:54px;border-radius:50%;background:var(--pc);color:#fff;display:grid;place-items:center;font:700 24px "Barlow Condensed",sans-serif;box-shadow:inset 0 0 0 4px rgba(0,0,0,.18)}' +
      '.who-n{font:700 26px/1 "Barlow Condensed",sans-serif;text-transform:uppercase}' +
      '.who-m{font-size:13px;color:var(--muted);margin-top:3px}' +
      '.who-go{margin-left:auto;font-weight:600;color:var(--pc);white-space:nowrap}';
    document.head.appendChild(css);

    var app = document.getElementById('app');
    var wrap = document.createElement('div');
    wrap.className = 'who';
    wrap.innerHTML = '<h1>Carnet de fonte<small>Qui s’entraîne ?</small></h1><div class="who-list"></div>';
    var list = wrap.querySelector('.who-list');
    PROFILES.forEach(function (p) {
      var n = 0;
      try {
        var d = JSON.parse(localStorage.getItem('cdf:db:v1:' + p.id) || 'null');
        n = d ? Object.keys(d.sessions || {}).length : (p.id === 'erwann' && window.CDF_SEED ? Object.keys(window.CDF_SEED.sessions || {}).length : 0);
      } catch (e) {}
      var b = document.createElement('button');
      b.className = 'who-btn';
      b.style.setProperty('--pc', p.color);
      b.innerHTML = '<span class="who-av">' + p.name[0] + '</span><span><div class="who-n">' + p.name +
        '</div><div class="who-m">' + (n ? n + ' séance' + (n > 1 ? 's' : '') + ' enregistrée' + (n > 1 ? 's' : '') : 'Aucune séance pour l’instant') +
        '</div></span><span class="who-go">Ouvrir →</span>';
      b.addEventListener('click', function () { wrap.remove(); app.style.display = ''; boot(p); });
      list.appendChild(b);
    });
    app.style.display = 'none';
    app.parentNode.insertBefore(wrap, app);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var saved = null;
    try { saved = sessionStorage.getItem(SESSION_KEY); } catch (e) {}
    var p = PROFILES.filter(function (x) { return x.id === saved; })[0];
    if (p) boot(p); else chooser();
  });
})();

/* Carnet de fonte : stockage local sur l'iPhone.
   Remplace la base de données de l'artefact Claude par le stockage du téléphone,
   avec la même interface (collection / doc / set / update / delete / onSnapshot). */
(function () {
  var KEY = 'cdf:db:v1';
  var data;
  try { data = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { data = null; }
  if (!data) {
    // Premier lancement : on reprend les exercices et séances de l'artefact
    data = (window.CDF_SEED && JSON.parse(JSON.stringify(window.CDF_SEED))) || {};
    persist();
  }
  // Demande à iOS de ne pas effacer ces données
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { console.error('Sauvegarde impossible', e); throw e; }
  }
  function coll(name) { return data[name] || (data[name] = {}); }

  var listeners = [];
  function notify(name) {
    listeners.forEach(function (l) { if (l.name === name) setTimeout(function () { l.fire(); }, 0); });
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
                var d = c[id];
                return { id: id, data: function () { return JSON.parse(JSON.stringify(d)); } };
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
          set: function (obj) { coll(name)[id] = JSON.parse(JSON.stringify(obj)); persist(); notify(name); return Promise.resolve(); },
          update: function (obj) {
            var c = coll(name);
            if (!c[id]) return Promise.reject({ code: 'not_found' });
            Object.keys(obj).forEach(function (k) { c[id][k] = JSON.parse(JSON.stringify(obj[k])); });
            persist(); notify(name); return Promise.resolve();
          },
          delete: function () { delete coll(name)[id]; persist(); notify(name); return Promise.resolve(); },
          get: function () {
            var d = coll(name)[id];
            return Promise.resolve({ id: id, exists: !!d, data: function () { return d ? JSON.parse(JSON.stringify(d)) : undefined; } });
          }
        };
      }
    };
  }

  var db = { collection: function (name) { return makeQuery(name, null, null); } };
  window.claude = { use: function (cap) { return Promise.resolve(cap === 'db' ? db : null); } };

  // Sauvegarde / restauration manuelles (utilisables depuis la console si besoin)
  window.CDF_export = function () { return JSON.stringify(data); };
  window.CDF_import = function (json) { data = JSON.parse(json); persist(); location.reload(); };
})();

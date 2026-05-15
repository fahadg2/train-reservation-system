requireAuth(['Admin']);
initStorage();
renderNav();

var deleteTargetId = null;

function formatDuration(minutes) {
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  if (h > 0 && m > 0) return h + 'h ' + m + 'm';
  if (h > 0) return h + 'h';
  return m + 'm';
}

function renderStats(routes) {
  var cities = [];
  routes.forEach(function(r) {
    r.stops.forEach(function(s) {
      if (cities.indexOf(s) === -1) cities.push(s);
    });
  });
  var avgDist = routes.length > 0 ? Math.round(routes.reduce(function(s, r) { return s + r.distanceKm;  }, 0) / routes.length) : 0;
  var avgDur  = routes.length > 0 ? Math.round(routes.reduce(function(s, r) { return s + r.durationMin; }, 0) / routes.length) : 0;
  document.getElementById('stat-grid').innerHTML =
    '<div class="stat-card"><div class="stat-icon blue">' + ICONS.routes + '</div><div><div class="stat-value">' + routes.length + '</div><div class="stat-label">Total Routes</div></div></div>' +
    '<div class="stat-card"><div class="stat-icon green"><span class="apple-emoji">🏙️</span></div><div><div class="stat-value">' + cities.length + '</div><div class="stat-label">Unique Cities</div></div></div>' +
    '<div class="stat-card"><div class="stat-icon amber"><span class="apple-emoji">🛤️</span></div><div><div class="stat-value">' + avgDist + ' km</div><div class="stat-label">Avg Distance</div></div></div>' +
    '<div class="stat-card"><div class="stat-icon red"><span class="apple-emoji">⏱️</span></div><div><div class="stat-value">' + formatDuration(avgDur) + '</div><div class="stat-label">Avg Duration</div></div></div>';
}

async function renderTable(query) {
  var routes = await loadFromStorage(STORAGE_KEYS.routes);
  var q = ((query !== undefined ? query : document.getElementById('search-input').value) || '').trim().toLowerCase();

  var filtered = q ? routes.filter(function(r) {
    return r.name.toLowerCase().indexOf(q) !== -1 || r.routeId.toLowerCase().indexOf(q) !== -1;
  }) : routes;

  renderStats(routes);
  document.getElementById('table-heading').textContent = q ? 'Search Results' : 'All Routes';
  document.getElementById('table-count').textContent   = filtered.length + ' record(s)';

  var tbody = document.getElementById('routes-body');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No records found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(r) {
    return '<tr>' +
      '<td><strong>' + r.routeId + '</strong></td>' +
      '<td>' + r.name + '</td>' +
      '<td>' + r.stops.join(' → ') + '</td>' +
      '<td>' + r.distanceKm + ' km</td>' +
      '<td>' + formatDuration(r.durationMin) + '</td>' +
      '<td><div class="table-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="openEditModal(\'' + r.routeId + '\')">Edit</button>' +
        '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'' + r.routeId + '\')">Delete</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add Route';
  document.getElementById('r-id').value              = '';
  document.getElementById('f-name').value            = '';
  document.getElementById('f-stops').value           = '';
  document.getElementById('f-dist').value            = '';
  document.getElementById('f-dur').value             = '';
  clearValidation(document.getElementById('route-form'));
  openModal('route-modal');
}

async function openEditModal(id) {
  var routes = await loadFromStorage(STORAGE_KEYS.routes);
  var r = routes.find(function(x) { return x.routeId === id; });
  if (!r) return;
  document.getElementById('modal-title').textContent = 'Edit Route';
  document.getElementById('r-id').value              = r.routeId;
  document.getElementById('f-name').value            = r.name;
  document.getElementById('f-stops').value           = r.stops.join(', ');
  document.getElementById('f-dist').value            = r.distanceKm;
  document.getElementById('f-dur').value             = r.durationMin;
  clearValidation(document.getElementById('route-form'));
  openModal('route-modal');
}

async function confirmDelete(id) {
  var routes = await loadFromStorage(STORAGE_KEYS.routes);
  var r = routes.find(function(x) { return x.routeId === id; });
  if (!r) return;
  deleteTargetId = id;
  document.getElementById('del-confirm-text').textContent =
    'Delete route "' + r.name + '" (' + r.routeId + ')? This action cannot be undone.';
  openModal('del-modal');
}

document.getElementById('del-confirm-btn').addEventListener('click', async function() {
  if (!deleteTargetId) return;
  var routes = await loadFromStorage(STORAGE_KEYS.routes);
  var idx = routes.findIndex(function(r) { return r.routeId === deleteTargetId; });
  if (idx !== -1) {
    var name = routes[idx].name;
    routes.splice(idx, 1);
    try {
      await saveToStorage(STORAGE_KEYS.routes, routes);
      showToast(name + ' deleted successfully.', 'success');
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Could not delete ' + name + '. Check the console.', 'error');
    }
  }
  deleteTargetId = null;
  closeModal('del-modal');
  await renderTable();
});

async function submitForm() {
  var id       = document.getElementById('r-id').value;
  var name     = document.getElementById('f-name').value.trim();
  var stopsRaw = document.getElementById('f-stops').value.trim();
  var distRaw  = document.getElementById('f-dist').value.trim();
  var durRaw   = document.getElementById('f-dur').value.trim();
  var dist     = parseFloat(distRaw);
  var dur      = parseInt(durRaw, 10);
  var stopsArr = stopsRaw.split(',').map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; });
  var valid    = true;

  clearValidation(document.getElementById('route-form'));

  if (!name || name.length < 2 || name.length > 100) {
    setError('f-name', 'f-name-err', 'Name must be 2–100 characters');
    valid = false;
  }

  if (stopsArr.length < 2) {
    setError('f-stops', 'f-stops-err', 'Enter at least 2 stops, separated by commas');
    valid = false;
  }

  if (!distRaw || isNaN(dist) || dist <= 0) {
    setError('f-dist', 'f-dist-err', 'Distance must be a positive number');
    valid = false;
  }

  if (!durRaw || isNaN(dur) || dur < 1) {
    setError('f-dur', 'f-dur-err', 'Duration must be at least 1 minute');
    valid = false;
  }

  if (!valid) return;

  var routes = await loadFromStorage(STORAGE_KEYS.routes);

  try {
    if (id) {
      var idx = routes.findIndex(function(r) { return r.routeId === id; });
      if (idx !== -1) {
        routes[idx].name        = name;
        routes[idx].stops       = stopsArr;
        routes[idx].distanceKm  = dist;
        routes[idx].durationMin = dur;
        await saveToStorage(STORAGE_KEYS.routes, routes);
        showToast(name + ' updated successfully.', 'success');
      }
    } else {
      routes.push({
        routeId:     generateId('R'),
        name:        name,
        stops:       stopsArr,
        distanceKm:  dist,
        durationMin: dur,
      });
      await saveToStorage(STORAGE_KEYS.routes, routes);
      showToast(name + ' added successfully.', 'success');
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('Could not save changes. Check the console for details.', 'error');
    return;
  }

  closeModal('route-modal');
  await renderTable();
}

document.getElementById('search-input').addEventListener('input', function() {
  renderTable(this.value);
});

[['f-name',  'f-name-err',  'input'],
 ['f-stops', 'f-stops-err', 'input'],
 ['f-dist',  'f-dist-err',  'input'],
 ['f-dur',   'f-dur-err',   'input']
].forEach(function(trio) {
  var el = document.getElementById(trio[0]);
  if (el) el.addEventListener(trio[2], function() { clearError(trio[0], trio[1]); });
});

(async function init() {
  await renderTable();
})();
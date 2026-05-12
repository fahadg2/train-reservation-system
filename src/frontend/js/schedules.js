requireAuth(['Admin']);
initStorage();
renderNav();

var deleteTargetId = null;

document.getElementById('add-btn').hidden = false;

function scheduleStatus(sch, train) {
  if (!train) return { label: '—', cls: 'badge-gray' };
  if (sch.delayMinutes > 0) return { label: 'Delayed +' + sch.delayMinutes + 'm', cls: 'badge-warning' };
  if (train.status === 'Full') return { label: 'Full', cls: 'badge-danger' };
  if (train.status === 'Delayed') return { label: 'Delayed', cls: 'badge-warning' };
  return { label: 'On Time', cls: 'badge-success' };
}

async function buildRouteFilter() {
  var trains = await loadFromStorage(STORAGE_KEYS.trains);
  var routes = [];
  trains.forEach(function(t) {
    var r = t.from + ' → ' + t.to;
    if (routes.indexOf(r) === -1) routes.push(r);
  });
  var sel = document.getElementById('filter-route');
  routes.sort().forEach(function(r) {
    var opt = document.createElement('option');
    opt.value = r;
    opt.textContent = r;
    sel.appendChild(opt);
  });
}

async function renderTable() {
  var schedules = await loadFromStorage(STORAGE_KEYS.schedules);
  var trains    = await loadFromStorage(STORAGE_KEYS.trains);
  var routeF    = document.getElementById('filter-route').value;
  var dateF     = document.getElementById('filter-date').value;

  var filtered = schedules.filter(function(s) {
    var train = trains.find(function(t) { return t.id === s.trainId; });
    if (routeF && (!train || (train.from + ' → ' + train.to) !== routeF)) return false;
    if (dateF && s.date !== dateF) return false;
    return true;
  });

  filtered.sort(function(a, b) {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return a.trainId < b.trainId ? -1 : a.trainId > b.trainId ? 1 : 0;
  });

  var isFiltered = routeF || dateF;
  document.getElementById('table-heading').textContent = isFiltered ? 'Filtered Schedules' : 'All Schedules';
  document.getElementById('table-count').textContent   = filtered.length + ' record(s)';

  var thead = '<thead><tr>' +
    '<th>ID</th><th>Train</th><th>Route</th><th>Date</th>' +
    '<th>Departure</th><th>Arrival</th><th>Platform</th>' +
    '<th>Avail. Seats</th><th>Status</th>' +
    '<th>Actions</th>' +
    '</tr></thead>';

  var tbodyContent;
  if (filtered.length === 0) {
    tbodyContent = '<tr class="empty-row"><td colspan="10">No records found</td></tr>';
  } else {
    tbodyContent = filtered.map(function(s) {
      var train  = trains.find(function(t) { return t.id === s.trainId; });
      var tName  = train ? train.name : s.trainId;
      var route  = train ? train.from + ' → ' + train.to : '—';
      var dep    = train ? train.departure  : '—';
      var arr    = train ? train.arrival    : '—';
      var seats  = s.seatsAvailable != null ? s.seatsAvailable : (train ? train.seatsTotal : '—');
      var st     = scheduleStatus(s, train);
      var actTd  = '<td><div class="table-actions">' +
            '<button class="btn btn-secondary btn-sm" onclick="openEditModal(\'' + s.scheduleId + '\')">Edit</button>' +
            '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'' + s.scheduleId + '\')">Delete</button>' +
          '</div></td>';
      return '<tr>' +
        '<td><strong>' + s.scheduleId + '</strong></td>' +
        '<td>' + tName + '<br><small class="text-muted">' + s.trainId + '</small></td>' +
        '<td>' + route + '</td>' +
        '<td>' + formatDate(s.date) + '</td>' +
        '<td>' + dep + '</td>' +
        '<td>' + arr + '</td>' +
        '<td>' + s.platform + '</td>' +
        '<td>' + seats + '</td>' +
        '<td><span class="badge ' + st.cls + '">' + st.label + '</span></td>' +
        actTd +
        '</tr>';
    }).join('');
  }

  document.getElementById('schedules-table').innerHTML = thead + '<tbody>' + tbodyContent + '</tbody>';
}

async function buildTrainSelect(selectedId) {
  var sel    = document.getElementById('f-train');
  var trains = await loadFromStorage(STORAGE_KEYS.trains);
  while (sel.options.length > 1) sel.remove(1);
  trains.forEach(function(t) {
    var opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name + ' (' + t.from + ' → ' + t.to + ')';
    if (selectedId && t.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

async function updateTrainPreview() {
  var trainId = document.getElementById('f-train').value;
  var preview = document.getElementById('train-preview');
  if (!trainId) { preview.hidden = true; return; }
  var trains = await loadFromStorage(STORAGE_KEYS.trains);
  var train  = trains.find(function(t) { return t.id === trainId; });
  if (!train) { preview.hidden = true; return; }
  var sClass = train.status === 'On Time' ? 'badge-success' : train.status === 'Delayed' ? 'badge-warning' : 'badge-danger';
  document.getElementById('train-preview-grid').innerHTML =
    '<div><div class="detail-label">Route</div><div class="detail-value">' + train.from + ' → ' + train.to + '</div></div>' +
    '<div><div class="detail-label">Departure</div><div class="detail-value">' + train.departure + '</div></div>' +
    '<div><div class="detail-label">Arrival</div><div class="detail-value">' + train.arrival + '</div></div>' +
    '<div><div class="detail-label">Train Capacity</div><div class="detail-value">' + train.seatsTotal + ' seats</div></div>' +
    '<div><div class="detail-label">Train Status</div><div class="detail-value"><span class="badge ' + sClass + '">' + train.status + '</span></div></div>';
  preview.hidden = false;
}

async function openAddModal() {
  document.getElementById('modal-title').textContent   = 'Add Schedule';
  document.getElementById('f-sched-id').value          = '';
  document.getElementById('f-date').value              = '';
  document.getElementById('f-platform').value          = '';
  document.getElementById('f-delay').value             = '0';
  document.getElementById('f-seats').value             = '';
  document.getElementById('train-preview').hidden      = true;
  await buildTrainSelect('');
  clearValidation(document.getElementById('sched-form'));
  openModal('sched-modal');
}

async function openEditModal(id) {
  var schedules = await loadFromStorage(STORAGE_KEYS.schedules);
  var s = schedules.find(function(x) { return x.scheduleId === id; });
  if (!s) return;
  document.getElementById('modal-title').textContent = 'Edit Schedule';
  document.getElementById('f-sched-id').value        = s.scheduleId;
  document.getElementById('f-date').value            = s.date;
  document.getElementById('f-platform').value        = s.platform;
  document.getElementById('f-delay').value           = s.delayMinutes || 0;
  document.getElementById('f-seats').value           = s.seatsAvailable != null ? s.seatsAvailable : '';
  await buildTrainSelect(s.trainId);
  clearValidation(document.getElementById('sched-form'));
  await updateTrainPreview();
  openModal('sched-modal');
}

async function confirmDelete(id) {
  var schedules   = await loadFromStorage(STORAGE_KEYS.schedules);
  var s           = schedules.find(function(x) { return x.scheduleId === id; });
  if (!s) return;
  var bookings    = await loadFromStorage(STORAGE_KEYS.bookings);
  var activeCount = bookings.filter(function(b) {
    return b.trainId === s.trainId && b.date === s.date && b.status === 'Active';
  }).length;
  if (activeCount > 0) {
    showToast('Cannot delete: ' + activeCount + ' active booking(s) exist for this schedule.', 'error');
    return;
  }
  deleteTargetId = id;
  var trains = await loadFromStorage(STORAGE_KEYS.trains);
  var train  = trains.find(function(t) { return t.id === s.trainId; });
  document.getElementById('del-confirm-text').textContent =
    'Delete schedule ' + id + ' (' + (train ? train.name : s.trainId) + ' on ' + formatDate(s.date) + ')? This cannot be undone.';
  openModal('del-modal');
}

document.getElementById('del-confirm-btn').addEventListener('click', async function() {
  if (!deleteTargetId) return;
  var schedules = await loadFromStorage(STORAGE_KEYS.schedules);
  var idx = schedules.findIndex(function(s) { return s.scheduleId === deleteTargetId; });
  if (idx !== -1) {
    var sid = schedules[idx].scheduleId;
    schedules.splice(idx, 1);
    try {
      await saveToStorage(STORAGE_KEYS.schedules, schedules);
      showToast('Schedule ' + sid + ' deleted.', 'success');
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Could not delete schedule. Check the console.', 'error');
    }
  }
  deleteTargetId = null;
  closeModal('del-modal');
  await renderTable();
});

async function submitForm() {
  var id       = document.getElementById('f-sched-id').value;
  var trainId  = document.getElementById('f-train').value;
  var dateVal  = document.getElementById('f-date').value;
  var platRaw  = document.getElementById('f-platform').value.trim();
  var delayRaw = document.getElementById('f-delay').value.trim();
  var seatsRaw = document.getElementById('f-seats').value.trim();
  var platform = parseInt(platRaw, 10);
  var delay    = parseInt(delayRaw, 10);
  var seats    = seatsRaw === '' ? null : parseInt(seatsRaw, 10);
  var valid    = true;

  clearValidation(document.getElementById('sched-form'));

  if (!trainId) {
    setError('f-train', 'f-train-err', 'Please select a train');
    valid = false;
  }

  if (!dateVal) {
    setError('f-date', 'f-date-err', 'Please select a date');
    valid = false;
  }

  if (!platRaw || isNaN(platform) || platform < 1 || platform > 20) {
    setError('f-platform', 'f-platform-err', 'Platform must be between 1 and 20');
    valid = false;
  }

  if (delayRaw === '' || isNaN(delay) || delay < 0 || delay > 999) {
    setError('f-delay', 'f-delay-err', 'Delay must be between 0 and 999 minutes');
    valid = false;
  }

  // Seats is optional — leave blank to auto-fill from the train's capacity.
  // If provided, must be 0 or positive and not exceed the train's total.
  if (seatsRaw !== '') {
    if (isNaN(seats) || seats < 0) {
      setError('f-seats', 'f-seats-err', 'Seats must be 0 or a positive number');
      valid = false;
    } else if (trainId) {
      var trainsCheck = await loadFromStorage(STORAGE_KEYS.trains);
      var t = trainsCheck.find(function(x) { return x.id === trainId; });
      if (t && seats > t.seatsTotal) {
        setError('f-seats', 'f-seats-err', 'Cannot exceed train capacity (' + t.seatsTotal + ')');
        valid = false;
      }
    }
  }

  if (!valid) return;

  var schedules = await loadFromStorage(STORAGE_KEYS.schedules);

  try {
    if (id) {
      // Edit: forbid moving this schedule onto a (trainId, date) that another schedule already occupies
      var clash = schedules.find(function(s) {
        return s.trainId === trainId && s.date === dateVal && s.scheduleId !== id;
      });
      if (clash) {
        showToast('Another schedule (' + clash.scheduleId + ') already exists for this train on this date.', 'warning');
        return;
      }

      var idx = schedules.findIndex(function(s) { return s.scheduleId === id; });
      if (idx !== -1) {
        schedules[idx].trainId        = trainId;
        schedules[idx].date           = dateVal;
        schedules[idx].platform       = platform;
        schedules[idx].delayMinutes   = delay;
        // If admin left seats blank during edit, keep existing value.
        // If they typed something, use it.
        if (seats !== null) {
          schedules[idx].seatsAvailable = seats;
        }
        await saveToStorage(STORAGE_KEYS.schedules, schedules);
        showToast('Schedule ' + id + ' updated.', 'success');
      }
    } else {
      var duplicate = schedules.find(function(s) {
        return s.trainId === trainId && s.date === dateVal;
      });
      if (duplicate) {
        showToast('A schedule for this train on this date already exists (' + duplicate.scheduleId + ').', 'warning');
        return;
      }
      // New schedule: default seats to the train's full capacity if admin didn't specify
      var defaultSeats = seats;
      if (defaultSeats === null) {
        var trainsForDefault = await loadFromStorage(STORAGE_KEYS.trains);
        var trainForDefault  = trainsForDefault.find(function(x) { return x.id === trainId; });
        defaultSeats = trainForDefault ? trainForDefault.seatsTotal : 0;
      }
      var newSched = {
        scheduleId:     generateId('S'),
        trainId:        trainId,
        date:           dateVal,
        platform:       platform,
        delayMinutes:   delay,
        seatsAvailable: defaultSeats,
      };
      schedules.push(newSched);
      await saveToStorage(STORAGE_KEYS.schedules, schedules);
      showToast('Schedule ' + newSched.scheduleId + ' added.', 'success');
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('Could not save schedule. Check the console for details.', 'error');
    return;
  }

  closeModal('sched-modal');
  await renderTable();
}

async function clearFilters() {
  document.getElementById('filter-route').value = '';
  document.getElementById('filter-date').value  = '';
  await renderTable();
}

document.getElementById('filter-route').addEventListener('change', renderTable);
document.getElementById('filter-date').addEventListener('change', renderTable);

document.getElementById('f-train').addEventListener('change', async function() {
  clearError('f-train', 'f-train-err');
  await updateTrainPreview();
});

[['f-date',     'f-date-err',     'change'],
 ['f-platform', 'f-platform-err', 'input'],
 ['f-delay',    'f-delay-err',    'input'],
 ['f-seats',    'f-seats-err',    'input']
].forEach(function(trio) {
  var el = document.getElementById(trio[0]);
  if (el) el.addEventListener(trio[2], function() { clearError(trio[0], trio[1]); });
});

(async function init() {
  await buildRouteFilter();
  await renderTable();
})();
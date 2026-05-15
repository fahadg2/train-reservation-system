requireAuth(['Admin', 'Staff', 'Passenger']);
initStorage();
renderNav();

var fromSelect = document.getElementById('from');
var toSelect   = document.getElementById('to');
var dateInput  = document.getElementById('search-date');

dateInput.min = new Date().toISOString().split('T')[0];

fromSelect.addEventListener('change', function() { clearError('from', 'from-error'); });
toSelect.addEventListener('change', function() { clearError('to', 'to-error'); });
dateInput.addEventListener('change', function() { clearError('search-date', 'date-error'); });

document.getElementById('search-form').addEventListener('submit', async function(e) {
  e.preventDefault();

  var from  = fromSelect.value;
  var to    = toSelect.value;
  var date  = dateInput.value;
  var cls   = document.getElementById('search-class').value;
  var today = new Date().toISOString().split('T')[0];
  var valid = true;

  if (!from) {
    setError('from', 'from-error', 'Select a departure city');
    valid = false;
  } else {
    clearError('from', 'from-error');
  }

  if (!to) {
    setError('to', 'to-error', 'Select a destination');
    valid = false;
  } else if (from && from === to) {
    setError('to', 'to-error', 'Destination must differ from departure');
    valid = false;
  } else {
    clearError('to', 'to-error');
  }

  if (date && date < today) {
    setError('search-date', 'date-error', 'Date cannot be in the past');
    valid = false;
  } else {
    clearError('search-date', 'date-error');
  }

  if (!valid) return;

  var trains    = await loadFromStorage(STORAGE_KEYS.trains);
  var schedules = await loadFromStorage(STORAGE_KEYS.schedules);

  var matchingTrains = trains.filter(function(t) { return t.from === from && t.to === to; });

  var rows = [];
  matchingTrains.forEach(function(t) {
    var trainSchedules = schedules.filter(function(s) {
      if (s.trainId !== t.id) return false;
      if (date) {
        // Specific date requested — exact match only
        if (s.date !== date) return false;
      } else {
        // No date specified — hide past schedules so users don't see
        // (or try to book) trips that have already departed
        if (s.date < today) return false;
      }
      return true;
    });
    trainSchedules.forEach(function(s) {
      rows.push({ train: t, schedule: s });
    });
  });

  rows.sort(function(a, b) {
    if (a.schedule.date !== b.schedule.date) return a.schedule.date < b.schedule.date ? -1 : 1;
    return a.train.departure < b.train.departure ? -1 : 1;
  });

  renderResults(rows, cls);
});

function renderResults(rows, cls) {
  var section  = document.getElementById('results-section');
  var tbody    = document.getElementById('results-body');
  var countEl  = document.getElementById('results-count');

  section.hidden = false;
  countEl.textContent = rows.length + ' departure(s) found';

  if (rows.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No trains found for this route and date</td></tr>';
    section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  tbody.innerHTML = rows.map(function(row) {
    var t = row.train;
    var s = row.schedule;
    var fare = cls === 'Business' ? t.fareBusiness : t.fareEconomy;
    var sClass = t.status === 'On Time' ? 'badge-success' : t.status === 'Delayed' ? 'badge-warning' : 'badge-danger';

    // Read seats from the schedule (per-date), fall back to train if missing
    var seatsLeft = s.seatsAvailable != null ? s.seatsAvailable : t.seatsAvailable;

    var action = seatsLeft > 0
      ? '<a href="booking.html?trainId=' + t.id + '&date=' + s.date + '&class=' + encodeURIComponent(cls) + '&scheduleId=' + s.scheduleId + '" class="btn btn-primary btn-sm">Book</a>'
      : '<button class="btn btn-secondary btn-sm" disabled>Full</button>';

    return '<tr>' +
      '<td><strong>' + t.name + '</strong><br><small class="text-muted">' + t.id + '</small></td>' +
      '<td>' + t.from + ' → ' + t.to + '</td>' +
      '<td>' + s.date + '<br><small class="text-muted">' + t.departure + '</small></td>' +
      '<td>' + t.arrival + '</td>' +
      '<td><span class="badge ' + sClass + '">' + t.status + '</span></td>' +
      '<td>' + formatCurrency(fare) + '</td>' +
      '<td>' + seatsLeft + '</td>' +
      '<td>' + action + '</td>' +
      '</tr>';
  }).join('');

  section.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

(async function init() {
  var trains = await loadFromStorage(STORAGE_KEYS.trains);
  var fromCities = [];
  var toCities = [];

  trains.forEach(function(t) {
    if (fromCities.indexOf(t.from) === -1) fromCities.push(t.from);
    if (toCities.indexOf(t.to) === -1) toCities.push(t.to);
  });

  fromCities.sort().forEach(function(city) {
    var opt = document.createElement('option');
    opt.value = city;
    opt.textContent = city;
    fromSelect.appendChild(opt);
  });

  toCities.sort().forEach(function(city) {
    var opt = document.createElement('option');
    opt.value = city;
    opt.textContent = city;
    toSelect.appendChild(opt);
  });
})();
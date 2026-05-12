requireAuth(['Admin']);
initStorage();
renderNav();

var currentType   = 'Daily';
var chartInstance = null;
var lastGrouped   = [];

function setDefaultDates(type) {
  var today  = new Date();
  var end    = today.toISOString().split('T')[0];
  var startD = new Date(today);
  if (type === 'Daily')   startD.setDate(startD.getDate() - 6);
  if (type === 'Weekly')  startD.setDate(startD.getDate() - 27);
  if (type === 'Monthly') startD.setDate(startD.getDate() - 89);
  document.getElementById('start-date').value = startD.toISOString().split('T')[0];
  document.getElementById('end-date').value   = end;
}

function getWeekStart(dateStr) {
  var d   = new Date(dateStr + 'T00:00:00');
  var day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().split('T')[0];
}

function groupByWeek(records) {
  var groups = {};
  var order  = [];
  records.forEach(function(r) {
    var ws = getWeekStart(r.date);
    if (!groups[ws]) {
      groups[ws] = { period: 'Week of ' + formatDate(ws), chartLabel: ws.slice(5), totalBookings: 0, totalRevenue: 0, cancellations: 0 };
      order.push(ws);
    }
    groups[ws].totalBookings += r.totalBookings;
    groups[ws].totalRevenue  += r.totalRevenue;
    groups[ws].cancellations += r.cancellations;
  });
  return order.sort().map(function(k) { return groups[k]; });
}

function groupByMonth(records) {
  var groups = {};
  var order  = [];
  records.forEach(function(r) {
    var key   = r.date.substring(0, 7);
    var d     = new Date(r.date + 'T00:00:00');
    var label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    var short = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    if (!groups[key]) {
      groups[key] = { period: label, chartLabel: short, totalBookings: 0, totalRevenue: 0, cancellations: 0 };
      order.push(key);
    }
    groups[key].totalBookings += r.totalBookings;
    groups[key].totalRevenue  += r.totalRevenue;
    groups[key].cancellations += r.cancellations;
  });
  return order.sort().map(function(k) { return groups[k]; });
}

function renderCards(totalB, totalR, totalC, occupancy) {
  document.getElementById('stat-grid').innerHTML =
    '<div class="stat-card"><div class="stat-icon blue">' + ICONS.myBookings + '</div><div><div class="stat-value">' + totalB + '</div><div class="stat-label">Total Bookings</div></div></div>' +
    '<div class="stat-card"><div class="stat-icon green"><span class="apple-emoji">💰</span></div><div><div class="stat-value">' + formatCurrency(totalR) + '</div><div class="stat-label">Total Revenue</div></div></div>' +
    '<div class="stat-card"><div class="stat-icon red">' + ICONS.cancel + '</div><div><div class="stat-value">' + totalC + '</div><div class="stat-label">Cancellations</div></div></div>' +
    '<div class="stat-card"><div class="stat-icon amber">' + ICONS.reports + '</div><div><div class="stat-value">' + occupancy + '%</div><div class="stat-label">Fleet Occupancy</div></div></div>';
}

function renderChart(grouped) {
  var area = document.getElementById('chart-area');
  if (!area) return;

  if (typeof Chart !== 'undefined') {
    area.innerHTML = '<canvas id="report-chart"></canvas>';
    if (chartInstance) chartInstance.destroy();
    var ctx = document.getElementById('report-chart').getContext('2d');
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: grouped.map(function(r) { return r.chartLabel; }),
        datasets: [{
          label: 'Bookings',
          data: grouped.map(function(r) { return r.totalBookings; }),
          backgroundColor: '#0A2342',
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  } else {
    if (grouped.length === 0) { area.innerHTML = '<div class="css-chart"></div>'; return; }
    var max = Math.max.apply(null, grouped.map(function(r) { return r.totalBookings; })) || 1;
    var barsHtml = grouped.map(function(r) {
      return '<div class="css-bar" data-v="' + r.totalBookings + '">' +
        '<span class="css-bar-label">' + r.chartLabel + '</span>' +
        '</div>';
    }).join('');
    area.innerHTML = '<div class="css-chart">' + barsHtml + '</div>';
    area.querySelectorAll('.css-bar').forEach(function(bar) {
      var v = parseInt(bar.getAttribute('data-v'), 10);
      bar.style.height = Math.round(v / max * 130) + 'px';
    });
  }
}

function renderTableBody(grouped) {
  var tbody = document.getElementById('report-body');
  if (grouped.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No records found for this period</td></tr>';
    return;
  }
  tbody.innerHTML = grouped.map(function(r) {
    var total = r.totalBookings + r.cancellations;
    var occ   = total > 0 ? Math.round(r.totalBookings / total * 100) + '%' : '—';
    return '<tr>' +
      '<td>' + r.period + '</td>' +
      '<td>' + r.totalBookings + '</td>' +
      '<td>' + formatCurrency(r.totalRevenue) + '</td>' +
      '<td>' + r.cancellations + '</td>' +
      '<td>' + occ + '</td>' +
      '</tr>';
  }).join('');
}

async function renderReport() {
  var allRevenue = await loadFromStorage(STORAGE_KEYS.revenue);
  var startVal   = document.getElementById('start-date').value;
  var endVal     = document.getElementById('end-date').value;

  var filtered = allRevenue.filter(function(r) {
    if (startVal && r.date < startVal) return false;
    if (endVal   && r.date > endVal)   return false;
    return true;
  });

  var grouped;
  if (currentType === 'Weekly') {
    grouped = groupByWeek(filtered);
  } else if (currentType === 'Monthly') {
    grouped = groupByMonth(filtered);
  } else {
    grouped = filtered.map(function(r) {
      return {
        period:        formatDate(r.date),
        chartLabel:    r.date.slice(5),
        totalBookings: r.totalBookings,
        totalRevenue:  r.totalRevenue,
        cancellations: r.cancellations,
      };
    });
  }

  var totalB = grouped.reduce(function(s, r) { return s + r.totalBookings; }, 0);
  var totalR = grouped.reduce(function(s, r) { return s + r.totalRevenue;  }, 0);
  var totalC = grouped.reduce(function(s, r) { return s + r.cancellations; }, 0);

 // Fleet occupancy: across all schedules in the date range, how many seats are booked vs total capacity?
  // Each schedule's "capacity" comes from its train's seats_total. Booked = total - currently available.
  var trains       = await loadFromStorage(STORAGE_KEYS.trains);
  var allSchedules = await loadFromStorage(STORAGE_KEYS.schedules);
  var trainCapMap  = {};
  trains.forEach(function(t) { trainCapMap[t.id] = t.seatsTotal; });

  var filteredSchedules = allSchedules.filter(function(s) {
    if (startVal && s.date < startVal) return false;
    if (endVal   && s.date > endVal)   return false;
    return true;
  });

  var totalSeats  = 0;
  var bookedSeats = 0;
  filteredSchedules.forEach(function(s) {
    var capacity = trainCapMap[s.trainId] || 0;
    var avail    = s.seatsAvailable != null ? s.seatsAvailable : capacity;
    totalSeats  += capacity;
    bookedSeats += (capacity - avail);
  });
  var occupancy = totalSeats > 0 ? Math.round(bookedSeats / totalSeats * 100) : 0;

  lastGrouped = grouped;

  renderCards(totalB, totalR, totalC, occupancy);
  renderChart(grouped);
  renderTableBody(grouped);
  document.getElementById('chart-title').textContent = currentType + ' Bookings';
  document.getElementById('table-title').textContent = currentType + ' Report';
}

async function setReportType(type) {
  currentType = type;
  document.querySelectorAll('.filter-tab').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-type') === type);
  });
  setDefaultDates(type);
  await renderReport();
}

function exportCsv() {
  if (!lastGrouped || lastGrouped.length === 0) {
    showToast('No data to export.', 'warning');
    return;
  }
  var headers = ['Period', 'Bookings', 'Revenue', 'Cancellations', 'Occ %'];
  var lines   = [headers.join(',')];
  lastGrouped.forEach(function(r) {
    var total = r.totalBookings + r.cancellations;
    var occ   = total > 0 ? Math.round(r.totalBookings / total * 100) : 0;
    var row   = [r.period, r.totalBookings, r.totalRevenue.toFixed(2), r.cancellations, occ];
    lines.push(row.map(function(cell) {
      var s = String(cell);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(','));
  });
  var blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'report-' + currentType.toLowerCase() + '-' + new Date().toISOString().split('T')[0] + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV exported successfully.', 'success');
}

var startEl = document.getElementById('start-date');
var endEl   = document.getElementById('end-date');

// Cap both pickers at today (covers calendar picker; doesn't cover typed input)
var todayStr = new Date().toISOString().split('T')[0];
startEl.max = todayStr;
endEl.max   = todayStr;

function validateAndFixDates() {
  var today  = new Date().toISOString().split('T')[0];
  var fixed  = false;

  if (startEl.value && startEl.value.length === 10 && startEl.value > today) {
    startEl.value = today;
    fixed = true;
  }
  if (endEl.value && endEl.value.length === 10 && endEl.value > today) {
    endEl.value = today;
    fixed = true;
  }
  if (startEl.value && endEl.value &&
      startEl.value.length === 10 && endEl.value.length === 10 &&
      endEl.value < startEl.value) {
    endEl.value = startEl.value;
    fixed = true;
  }

  if (fixed) {
    showToast('Date range adjusted — future dates and reversed ranges aren\'t allowed.', 'warning');
  }
}

// Validate only when the user is fully done with the field (loses focus).
// Don't validate on 'change' while focused — Chrome fires change events as
// each segment (month/day/year) updates during typing, which would interrupt.
startEl.addEventListener('blur', function() {
  validateAndFixDates();
  renderReport();
});

endEl.addEventListener('blur', function() {
  validateAndFixDates();
  renderReport();
});

// Calendar picker selections fire 'change' but may not blur the input.
// Only validate via 'change' when the field is NOT currently focused
// (meaning: user clicked a date in the picker, didn't type).
startEl.addEventListener('change', function() {
  if (document.activeElement !== startEl) {
    validateAndFixDates();
    renderReport();
  }
});

endEl.addEventListener('change', function() {
  if (document.activeElement !== endEl) {
    validateAndFixDates();
    renderReport();
  }
});

(async function init() {
  await setReportType('Daily');
  endEl.min   = startEl.value;
  startEl.max = endEl.value;
})();
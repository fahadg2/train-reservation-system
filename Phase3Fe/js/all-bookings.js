// =====================================================================
// TrainMS — All Bookings (Admin and Staff)
// Lists every booking in the system with filter tabs (All / Active /
// Cancelled) and search across booking ID, passenger name, and passenger
// ID. Read-only view — to cancel a booking, the Cancel button per row
// links to cancellation.html which handles the seat refund flow.
// =====================================================================

requireAuth(['Admin', 'Staff']);
initStorage();
renderNav();

var currentFilter = 'All';
var allBookings   = [];
var trains        = [];
var passengers    = [];
var paxMap        = {};   // passengerId -> passenger object (fast lookup)
var trainMap      = {};   // trainId -> train object (fast lookup)

function renderStats() {
  var active    = allBookings.filter(function(b) { return b.status === 'Active'; }).length;
  var cancelled = allBookings.filter(function(b) { return b.status === 'Cancelled'; }).length;
  var revenue   = allBookings.reduce(function(sum, b) {
    return b.status === 'Active' ? sum + b.fare : sum;
  }, 0);

  document.getElementById('stat-grid').innerHTML =
    '<div class="stat-card">' +
      '<div class="stat-icon blue"><span class="apple-emoji">🎫</span></div>' +
      '<div><div class="stat-value">' + allBookings.length + '</div>' +
      '<div class="stat-label">Total Bookings</div></div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-icon green"><span class="apple-emoji">✅</span></div>' +
      '<div><div class="stat-value">' + active + '</div>' +
      '<div class="stat-label">Active</div></div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-icon red"><span class="apple-emoji">❌</span></div>' +
      '<div><div class="stat-value">' + cancelled + '</div>' +
      '<div class="stat-label">Cancelled</div></div>' +
    '</div>' +
    '<div class="stat-card">' +
      '<div class="stat-icon amber"><span class="apple-emoji">💰</span></div>' +
      '<div><div class="stat-value">' + formatCurrency(revenue) + '</div>' +
      '<div class="stat-label">Active Revenue</div></div>' +
    '</div>';
}

function renderTable() {
  var q = (document.getElementById('search-input').value || '').trim().toLowerCase();

  // Step 1: status filter
  var rows = currentFilter === 'All'
    ? allBookings.slice()
    : allBookings.filter(function(b) { return b.status === currentFilter; });

  // Step 2: search filter — match against booking ID, passenger name,
  // or passenger ID. A bit forgiving: admin can paste any of them.
  if (q) {
    rows = rows.filter(function(b) {
      var pax = paxMap[b.passengerId];
      var paxName = pax ? pax.name.toLowerCase() : '';
      return (b.bookingId && b.bookingId.toLowerCase().indexOf(q) !== -1) ||
             (b.passengerId && b.passengerId.toLowerCase().indexOf(q) !== -1) ||
             (paxName && paxName.indexOf(q) !== -1);
    });
  }

  // Step 3: newest first — bookings come from DB sorted by created_at
  // ascending (see utils.js), so reverse for display.
  rows.reverse();

  // Update heading + count
  var headings = {
    All:       q ? 'Search Results' : 'All Bookings',
    Active:    q ? 'Active — Search Results' : 'Active Bookings',
    Cancelled: q ? 'Cancelled — Search Results' : 'Cancelled Bookings'
  };
  document.getElementById('bookings-heading').textContent = headings[currentFilter] || 'Bookings';
  document.getElementById('bookings-count').textContent   = rows.length + ' record(s)';

  var tbody = document.getElementById('bookings-body');
  if (rows.length === 0) {
    var emptyMsg = q
      ? 'No bookings match your search'
      : (currentFilter === 'All'
          ? 'No bookings yet'
          : 'No ' + currentFilter.toLowerCase() + ' bookings');
    tbody.innerHTML = '<tr class="empty-row"><td colspan="10">' + emptyMsg + '</td></tr>';
    return;
  }

  // Build "today" once for the cancel-button gate. We hide Cancel on
  // trips that already departed since cancellation.js itself rejects
  // past-date cancellations — better not to offer a button that fails.
  var today = new Date().toISOString().split('T')[0];

  tbody.innerHTML = rows.map(function(b) {
    var train = trainMap[b.trainId];
    var pax   = paxMap[b.passengerId];

    var trainName = train ? train.name : (b.trainId || '—');
    var route     = train ? (train.from + ' → ' + train.to) : '—';
    var paxName   = pax ? pax.name : '—';
    var paxId     = b.passengerId || '—';
    var badge     = b.status === 'Active' ? 'badge-success' : 'badge-danger';

    // Cancel is only meaningful for active bookings on a future date.
    // Past-date or already-cancelled rows get an em-dash placeholder.
    var action;
    if (b.status === 'Active' && b.date >= today) {
      action = '<a href="cancellation.html?bookingId=' + encodeURIComponent(b.bookingId) +
               '" class="btn btn-danger btn-sm">Cancel</a>';
    } else {
      action = '<span class="text-muted">—</span>';
    }

    return '<tr>' +
      '<td><strong>' + b.bookingId + '</strong></td>' +
      '<td>' + paxName + '<br><small class="text-muted">' + paxId + '</small></td>' +
      '<td>' + trainName + '</td>' +
      '<td>' + route + '</td>' +
      '<td>' + formatDate(b.date) + '</td>' +
      '<td>' + b.class + '</td>' +
      '<td>' + b.seats + '</td>' +
      '<td>' + formatCurrency(b.fare) + '</td>' +
      '<td><span class="badge ' + badge + '">' + b.status + '</span></td>' +
      '<td>' + action + '</td>' +
      '</tr>';
  }).join('');
}

// ---- Wire up filter tabs ----
document.querySelectorAll('.filter-tab').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.filter-tab').forEach(function(b) { b.classList.remove('active'); });
    this.classList.add('active');
    currentFilter = this.getAttribute('data-status');
    renderTable();
  });
});

// ---- Wire up search ----
document.getElementById('search-input').addEventListener('input', renderTable);

// ---- Initial load ----
(async function init() {
  try {
    allBookings = await loadFromStorage(STORAGE_KEYS.bookings);
    trains      = await loadFromStorage(STORAGE_KEYS.trains);
    passengers  = await loadFromStorage(STORAGE_KEYS.passengers);

    // Build lookup maps once — faster than .find() on every row render
    paxMap   = {};
    trainMap = {};
    passengers.forEach(function(p) { paxMap[p.id] = p; });
    trains.forEach(function(t) { trainMap[t.id] = t; });

    renderStats();
    renderTable();
  } catch (err) {
    console.error('All-bookings load failed:', err);
    document.getElementById('bookings-body').innerHTML =
      '<tr class="empty-row"><td colspan="10">Could not load bookings. Check the console.</td></tr>';
    showToast('Could not load bookings.', 'error');
  }
})();

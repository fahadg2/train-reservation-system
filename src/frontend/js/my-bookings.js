requireAuth(['Passenger']);
initStorage();
renderNav();

var user          = getCurrentUser();
var currentFilter = 'All';
var trains        = [];

async function loadTrains() {
  trains = await loadFromStorage(STORAGE_KEYS.trains);
}

async function getMyBookings() {
  var all = await loadFromStorage(STORAGE_KEYS.bookings);
  return all.filter(function(b) {
    return b.passengerId === user.passengerId;
  });
}

async function renderBookings(status) {
  currentFilter = status || 'All';
  var all = await getMyBookings();
  var filtered = currentFilter === 'All' ? all : all.filter(function(b) { return b.status === currentFilter; });

  var headings = { All: 'All Bookings', Active: 'Active Bookings', Cancelled: 'Cancelled Bookings' };
  document.getElementById('bookings-heading').textContent = headings[currentFilter] || 'Bookings';
  document.getElementById('bookings-count').textContent   = filtered.length + ' record(s)';

  var tbody = document.getElementById('bookings-body');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="9">No ' + (currentFilter !== 'All' ? currentFilter.toLowerCase() + ' ' : '') + 'bookings found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.slice().reverse().map(function(b) {
    var train  = trains.find(function(t) { return t.id === b.trainId; });
    var route  = train ? train.from + ' → ' + train.to : '—';
    var name   = train ? train.name : b.trainId;
    var badge  = b.status === 'Active' ? 'badge-success' : 'badge-danger';
    var action = b.status === 'Active'
      ? '<a href="cancellation.html?bookingId=' + b.bookingId + '" class="btn btn-danger btn-sm">Cancel</a>'
      : '<span class="text-muted">—</span>';

    return '<tr>' +
      '<td><strong>' + b.bookingId + '</strong></td>' +
      '<td>' + name + '</td>' +
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

document.querySelectorAll('.filter-tab').forEach(function(btn) {
  btn.addEventListener('click', async function() {
    document.querySelectorAll('.filter-tab').forEach(function(b) { b.classList.remove('active'); });
    this.classList.add('active');
    await renderBookings(this.getAttribute('data-status'));
  });
});

(async function init() {
  await loadTrains();
  await renderBookings('All');
})();
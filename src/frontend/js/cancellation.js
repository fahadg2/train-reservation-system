// NOTE: Cancellation touches 2 tables (bookings, schedules).
// These are separate Supabase writes — there is no transaction.
// If the second write fails, the first is NOT rolled back. For a demo
// this is acceptable; production would need a Postgres RPC for atomicity.

requireAuth(['Admin', 'Staff', 'Passenger']);
initStorage();
renderNav();

var role           = getCurrentRole();
var user           = getCurrentUser();
var currentBooking = null;
var isSubmitting   = false;

var params    = new URLSearchParams(window.location.search);
var bookingId = params.get('bookingId');

var backLink = document.getElementById('back-link');
if (role !== 'Passenger') {
  backLink.href = 'dashboard.html';
  backLink.textContent = '← Dashboard';
}

(async function init() {
  if (bookingId) {
    await loadBooking(bookingId);
    return;
  }

  document.getElementById('lookup-section').hidden = false;

  document.getElementById('lookup-btn').addEventListener('click', async function() {
    var val = document.getElementById('lookup-input').value.trim().toUpperCase();
    if (!val) {
      setError('lookup-input', 'lookup-error', 'Please enter a booking ID');
      return;
    }
    clearError('lookup-input', 'lookup-error');
    await loadBooking(val);
  });

  document.getElementById('lookup-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') document.getElementById('lookup-btn').click();
  });

  document.getElementById('lookup-input').addEventListener('input', function() {
    clearError('lookup-input', 'lookup-error');
  });
})();

async function loadBooking(id) {
  var bookings = await loadFromStorage(STORAGE_KEYS.bookings);
  var booking  = bookings.find(function(b) { return b.bookingId === id; });

  if (!booking) {
    if (document.getElementById('lookup-section').hidden === false) {
      setError('lookup-input', 'lookup-error', 'Booking ID not found');
    } else {
      showToast('Booking ID not found: ' + id, 'error');
    }
    return;
  }

  // Authorization: a Passenger can only see and cancel their own bookings.
  if (role === 'Passenger' && booking.passengerId !== user.passengerId) {
    if (document.getElementById('lookup-section').hidden === false) {
      setError('lookup-input', 'lookup-error', 'Booking ID not found');
    } else {
      showToast('You can only cancel your own bookings.', 'error');
      setTimeout(function() { window.location.href = 'my-bookings.html'; }, 1500);
    }
    return;
  }

  if (booking.status === 'Cancelled') {
    document.getElementById('lookup-section').hidden = true;
    document.getElementById('already-cancelled-section').hidden = false;
    return;
  }

  currentBooking = booking;
  document.getElementById('lookup-section').hidden = true;
  await renderDetails(booking);
  document.getElementById('details-section').hidden = false;
}

async function renderDetails(b) {
  var trains     = await loadFromStorage(STORAGE_KEYS.trains);
  var passengers = await loadFromStorage(STORAGE_KEYS.passengers);
  var train      = trains.find(function(t) { return t.id === b.trainId; });
  var passenger  = passengers.find(function(p) { return p.id === b.passengerId; });

  var fee    = b.fare * 0.10;
  var refund = b.fare * 0.90;

  document.getElementById('booking-details-body').innerHTML =
    '<tr><td><strong>Booking ID</strong></td><td>' + b.bookingId + '</td></tr>' +
    '<tr><td><strong>Passenger</strong></td><td>' + (passenger ? passenger.name : b.passengerId) + '</td></tr>' +
    '<tr><td><strong>Train</strong></td><td>' + (train ? train.name + ' (' + b.trainId + ')' : b.trainId) + '</td></tr>' +
    '<tr><td><strong>Route</strong></td><td>' + (train ? train.from + ' → ' + train.to : '—') + '</td></tr>' +
    '<tr><td><strong>Travel Date</strong></td><td>' + formatDate(b.date) + '</td></tr>' +
    '<tr><td><strong>Class</strong></td><td>' + b.class + '</td></tr>' +
    '<tr><td><strong>Seats</strong></td><td>' + b.seats + '</td></tr>' +
    '<tr><td><strong>Original Fare</strong></td><td>' + formatCurrency(b.fare) + '</td></tr>';

  document.getElementById('refund-summary').innerHTML =
    '<div class="booking-summary-row"><span>Original fare:</span><span>' + formatCurrency(b.fare) + '</span></div>' +
    '<div class="booking-summary-row"><span>Cancellation fee (10%):</span><span>−' + formatCurrency(fee) + '</span></div>' +
    '<div class="booking-summary-row total"><span>Refund amount:</span><span class="refund-highlight">' + formatCurrency(refund) + '</span></div>';

  document.getElementById('go-back-link').href = role === 'Passenger' ? 'my-bookings.html' : 'dashboard.html';

  // Replace the button so any previous click handlers are gone
  var oldBtn = document.getElementById('confirm-cancel-btn');
  var newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  newBtn.addEventListener('click', confirmCancellation);
}

async function confirmCancellation() {
  if (isSubmitting) return;
  if (!currentBooking) return;

  var booking = currentBooking;
  var btn     = document.getElementById('confirm-cancel-btn');

  isSubmitting = true;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Cancelling…';
  }

  try {
    // ---- Write #1: mark booking as Cancelled ----
    try {
      var bookings = await loadFromStorage(STORAGE_KEYS.bookings);
      var idx = bookings.findIndex(function(b) { return b.bookingId === booking.bookingId; });
      if (idx === -1) {
        showToast('Booking no longer exists.', 'error');
        return;
      }
      if (bookings[idx].status === 'Cancelled') {
        showToast('This booking was already cancelled.', 'warning');
        return;
      }
      bookings[idx].status = 'Cancelled';
      await saveToStorage(STORAGE_KEYS.bookings, bookings);
    } catch (err) {
      console.error('Booking status update failed:', err);
      showToast('Could not cancel booking. Please try again.', 'error');
      return;
    }

    // ---- Write #2: refund seats to the schedule ----
    // Prefer scheduleId (added in the new schema). Fall back to
    // (trainId, date) lookup for old bookings created before the
    // schedule_id column existed.
    try {
      var schedules = await loadFromStorage(STORAGE_KEYS.schedules);
      var sIdx = -1;

      if (booking.scheduleId) {
        sIdx = schedules.findIndex(function(s) {
          return s.scheduleId === booking.scheduleId;
        });
      }

      // Fallback for legacy bookings without a scheduleId
      if (sIdx === -1) {
        sIdx = schedules.findIndex(function(s) {
          return s.trainId === booking.trainId && s.date === booking.date;
        });
        if (sIdx !== -1 && !booking.scheduleId) {
          console.warn('Booking ' + booking.bookingId + ' had no scheduleId; refunded via legacy lookup.');
        }
      }

      if (sIdx !== -1) {
        var cur = schedules[sIdx].seatsAvailable != null ? schedules[sIdx].seatsAvailable : 0;
        schedules[sIdx].seatsAvailable = cur + booking.seats;
        await saveToStorage(STORAGE_KEYS.schedules, schedules);
      } else {
        console.warn('No schedule found for booking ' + booking.bookingId +
                     ' — cancelled but seats not refunded.');
      }
    } catch (err) {
      console.error('Schedule seat refund failed (booking ' + booking.bookingId + ' WAS cancelled):', err);
      showToast('Booking cancelled but seat count may be off. Contact support.', 'warning');
    }

    var refund = booking.fare * 0.90;
    await showSuccess(refund, booking);
    currentBooking = null;
  } finally {
    isSubmitting = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Confirm Cancellation';
    }
  }
}

async function showSuccess(refund, booking) {
  document.getElementById('details-section').hidden = true;

  var trains = await loadFromStorage(STORAGE_KEYS.trains);
  var train  = trains.find(function(t) { return t.id === booking.trainId; });

  document.getElementById('success-heading').textContent = 'Booking ' + booking.bookingId + ' Cancelled';
  document.getElementById('success-details').innerHTML =
    (train ? '<strong>' + train.name + '</strong><br>' + train.from + ' → ' + train.to + '<br>' : '') +
    formatDate(booking.date) + ' · ' + booking.seats + ' × ' + booking.class + '<br>' +
    'Refund: <strong class="refund-highlight">' + formatCurrency(refund) + '</strong>';

  var actionsHtml = role === 'Passenger'
    ? '<a href="my-bookings.html" class="btn btn-primary">My Bookings</a><a href="dashboard.html" class="btn btn-secondary">Dashboard</a>'
    : '<a href="dashboard.html" class="btn btn-primary">Dashboard</a><a href="search.html" class="btn btn-secondary">Search Trains</a>';
  document.getElementById('success-actions').innerHTML = actionsHtml;

  document.getElementById('success-section').hidden = false;
  showToast('Booking cancelled. Refund: ' + formatCurrency(refund), 'info');
}
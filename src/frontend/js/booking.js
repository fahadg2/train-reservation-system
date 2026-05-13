// NOTE: Booking confirmation touches 3 tables (bookings, schedules, passengers).
// These are 3 separate Supabase writes — there is no transaction.
// If a later write fails, earlier writes are NOT rolled back. For a demo this
// is acceptable; production would need a Postgres function/RPC for atomicity.

requireAuth(['Admin', 'Staff', 'Passenger']);
initStorage();
renderNav();

var user = getCurrentUser();
var role = user.role;
var currentTrain = null;
var currentSchedule = null;
var bookingDate = '';
var bookingClass = 'Economy';
var scheduleId = '';
var selectedPaxId = '';
var isSubmitting = false;

var params = new URLSearchParams(window.location.search);
var trainId = params.get('trainId');
bookingDate = params.get('date') || '';
bookingClass = params.get('class') || 'Economy';
scheduleId = params.get('scheduleId') || '';

(async function init() {
  if (!trainId || !bookingDate) {
    document.getElementById('no-train-section').hidden = false;
    return;
  }

  var trains = await loadFromStorage(STORAGE_KEYS.trains);
  var schedules = await loadFromStorage(STORAGE_KEYS.schedules);
  currentTrain = trains.find(function (t) { return t.id === trainId; });

  // Find the matching schedule. Prefer scheduleId from URL; otherwise look up
  // by trainId + date so old links / direct visits still work.
  if (scheduleId) {
    currentSchedule = schedules.find(function (s) { return s.scheduleId === scheduleId; });
  }
  if (!currentSchedule) {
    currentSchedule = schedules.find(function (s) {
      return s.trainId === trainId && s.date === bookingDate;
    });
  }

  if (!currentTrain || !currentSchedule) {
    document.getElementById('no-train-section').hidden = false;
    return;
  }

  document.getElementById('booking-form-section').hidden = false;
  buildTrainInfo();
  await buildPassengerSelector();
  setupFareCalc();

  if (role === 'Passenger') {
    await prefillPassenger();
  }
})();

function buildTrainInfo() {
  var sClass = currentTrain.status === 'On Time' ? 'badge-success' : currentTrain.status === 'Delayed' ? 'badge-warning' : 'badge-danger';
  var seatsLeft = currentSchedule.seatsAvailable != null ? currentSchedule.seatsAvailable : currentTrain.seatsAvailable;

  document.getElementById('train-info').innerHTML =
    '<div><div class="detail-label">Train</div><div class="detail-value">' + currentTrain.name + '</div></div>' +
    '<div><div class="detail-label">Route</div><div class="detail-value">' + currentTrain.from + ' → ' + currentTrain.to + '</div></div>' +
    '<div><div class="detail-label">Date</div><div class="detail-value">' + formatDate(bookingDate) + '</div></div>' +
    '<div><div class="detail-label">Departure</div><div class="detail-value">' + currentTrain.departure + '</div></div>' +
    '<div><div class="detail-label">Arrival</div><div class="detail-value">' + currentTrain.arrival + '</div></div>' +
    '<div><div class="detail-label">Status</div><div class="detail-value"><span class="badge ' + sClass + '">' + currentTrain.status + '</span></div></div>' +
    '<div><div class="detail-label">Seats Available</div><div class="detail-value">' + seatsLeft + '</div></div>';

  var classSelect = document.getElementById('pax-class');
  classSelect.value = bookingClass;
}

async function buildPassengerSelector() {
  if (role !== 'Admin' && role !== 'Staff') return;

  var group = document.getElementById('pax-selector-group');
  group.hidden = false;

  // Admin/Staff workflow: the manual fields are read-only previews of the
  // selected passenger. Booking for a brand-new passenger requires adding
  // them via the Passengers page first. This keeps booking and passenger
  // records in sync and avoids two ways to create a passenger.
  lockPassengerFields();

  // Helpful hint above the manual fields
  var hint = document.createElement('div');
  hint.className = 'info-box info';
  hint.style.cssText = 'margin-bottom: 12px; font-size: 13px;';
  hint.textContent = 'Select an existing passenger above. To book for a new person, add them in the Passengers page first.';
  group.parentNode.insertBefore(hint, group.nextSibling);

  var select = document.getElementById('pax-selector');
  var passengers = await loadFromStorage(STORAGE_KEYS.passengers);
  passengers.forEach(function (p) {
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + ' (' + p.id + ')';
    select.appendChild(opt);
  });

  select.addEventListener('change', function () {
    var pid = this.value;
    if (!pid) {
      selectedPaxId = '';
      document.getElementById('pax-name').value = '';
      document.getElementById('pax-age').value = '';
      document.getElementById('pax-gender').value = '';
      document.getElementById('pax-contact').value = '';
      return;
    }
    var p = passengers.find(function (x) { return x.id === pid; });
    if (!p) return;
    document.getElementById('pax-name').value = p.name;
    document.getElementById('pax-age').value = p.age;
    document.getElementById('pax-gender').value = p.gender;
    document.getElementById('pax-contact').value = p.contact;
    selectedPaxId = p.id;
    clearAllErrors();
  });
}

// Make the passenger identity fields read-only. Used for both Admin/Staff
// (who pick from the dropdown) and Passenger (whose own profile is fixed).
// A Passenger should not be able to type a different name/age/gender/contact
// onto their own booking — those come from their passenger record.
function lockPassengerFields() {
  var manualFields = ['pax-name', 'pax-age', 'pax-gender', 'pax-contact'];
  manualFields.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      if (el.tagName === 'SELECT') {
        // <select> has no readOnly attribute. Block user interaction via CSS
        // and a keydown blocker so the value can still be set programmatically
        // and submitted with the form (unlike `disabled`, which strips it).
        el.style.pointerEvents = 'none';
        el.setAttribute('tabindex', '-1');
        el.addEventListener('keydown', function (e) { e.preventDefault(); });
      } else {
        el.readOnly = true;
        // Block autocomplete suggestions on read-only inputs (browsers
        // sometimes still show them, especially on tel/email fields).
        el.setAttribute('autocomplete', 'off');
      }
      // Translucent overlay so it tones down but text stays readable
      // in both light and dark themes (inherits the theme's text color).
      el.style.background = 'rgba(29, 29, 29, 0.81)';
      el.style.cursor = 'not-allowed';
      el.style.opacity = '0.85';
    }
  });
}

async function prefillPassenger() {
  var pid = user.passengerId;
  if (!pid) return;
  var passengers = await loadFromStorage(STORAGE_KEYS.passengers);
  var p = passengers.find(function (x) { return x.id === pid; });
  if (!p) return;
  document.getElementById('pax-name').value = p.name;
  document.getElementById('pax-age').value = p.age;
  document.getElementById('pax-gender').value = p.gender;
  document.getElementById('pax-contact').value = p.contact;
  selectedPaxId = p.id;
  // Passengers cannot edit their own identity from the booking page.
  // To update name/contact/etc., they'd use a profile page (not yet built).
  lockPassengerFields();
}

function setupFareCalc() {
  updateFare();
  document.getElementById('pax-seats').addEventListener('input', updateFare);
  document.getElementById('pax-class').addEventListener('change', updateFare);
}

function updateFare() {
  var cls = document.getElementById('pax-class').value;
  var seats = parseInt(document.getElementById('pax-seats').value, 10) || 0;
  var perSeat = cls === 'Business' ? currentTrain.fareBusiness : currentTrain.fareEconomy;
  var total = perSeat * (seats > 0 ? seats : 0);

  document.getElementById('fare-per-seat').textContent = formatCurrency(perSeat);
  document.getElementById('fare-seats').textContent = seats > 0 ? seats : 0;
  document.getElementById('fare-total').textContent = formatCurrency(total);
}

function clearAllErrors() {
  ['pax-name', 'pax-age', 'pax-gender', 'pax-contact', 'pax-seats'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('error');
  });
  ['name-error', 'age-error', 'gender-error', 'contact-error', 'seats-error'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.textContent = '';
  });
}

['pax-name', 'pax-age', 'pax-gender', 'pax-contact', 'pax-seats'].forEach(function (id, i) {
  var errIds = ['name-error', 'age-error', 'gender-error', 'contact-error', 'seats-error'];
  var el = document.getElementById(id);
  if (el) el.addEventListener('input', function () { clearError(id, errIds[i]); });
});

document.getElementById('booking-form').addEventListener('submit', async function (e) {
  e.preventDefault();

  if (isSubmitting) return;

  var submitBtn = e.target.querySelector('button[type="submit"]');

  var name = document.getElementById('pax-name').value.trim();
  var age = parseInt(document.getElementById('pax-age').value, 10);
  var gender = document.getElementById('pax-gender').value;
  var contact = document.getElementById('pax-contact').value.trim();
  var seats = parseInt(document.getElementById('pax-seats').value, 10);
  var cls = document.getElementById('pax-class').value;
  var valid = true;

  var nameRegex = /^[A-Za-z\s]{2,50}$/;
  if (!name || !nameRegex.test(name)) {
    setError('pax-name', 'name-error', 'Name must be 2–50 letters only');
    valid = false;
  } else {
    clearError('pax-name', 'name-error');
  }

  if (!age || age < 1 || age > 120) {
    setError('pax-age', 'age-error', 'Age must be between 1 and 120');
    valid = false;
  } else {
    clearError('pax-age', 'age-error');
  }

  if (!gender) {
    setError('pax-gender', 'gender-error', 'Please select a gender');
    valid = false;
  } else {
    clearError('pax-gender', 'gender-error');
  }

  if (!/^05\d{8}$/.test(contact)) {
    setError('pax-contact', 'contact-error', 'Contact must be exactly 10 digits');
    valid = false;
  } else {
    clearError('pax-contact', 'contact-error');
  }

  if (!seats || seats < 1 || seats > 6) {
    setError('pax-seats', 'seats-error', 'Seats must be between 1 and 6');
    valid = false;
  } else {
    clearError('pax-seats', 'seats-error');
  }

  if ((role === 'Admin' || role === 'Staff') && !selectedPaxId) {
    showToast('Please select an existing passenger from the dropdown.', 'error');
    valid = false;
  }

  if (!valid) return;

  isSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Booking…';
  }

  try {
    // Fresh seat re-check from the SCHEDULE (not the train)
    var freshSchedules = await loadFromStorage(STORAGE_KEYS.schedules);
    var freshSchedule = freshSchedules.find(function (s) {
      return s.scheduleId === currentSchedule.scheduleId;
    });
    if (!freshSchedule) {
      showToast('Schedule no longer exists. Please search again.', 'error');
      return;
    }
    var freshSeats = freshSchedule.seatsAvailable != null ? freshSchedule.seatsAvailable : 0;
    if (seats > freshSeats) {
      setError('pax-seats', 'seats-error', 'Only ' + freshSeats + ' seat(s) available now');
      showToast('Seats just got taken — please reduce the count.', 'warning');
      currentSchedule = freshSchedule;
      buildTrainInfo();
      updateFare();
      return;
    }

    var farePerSeat = cls === 'Business' ? currentTrain.fareBusiness : currentTrain.fareEconomy;
    var totalFare = farePerSeat * seats;
    var newId = generateId('B');

    var paxId = selectedPaxId;
    if (!paxId && role === 'Passenger') paxId = user.passengerId;

    if (!paxId) {
      showToast('Could not determine passenger ID. Please refresh and try again.', 'error');
      return;
    }

    var newBooking = {
      bookingId: newId,
      passengerId: paxId,
      trainId: currentTrain.id,
      scheduleId: currentSchedule.scheduleId,
      date: bookingDate,
      seats: seats,
      class: cls,
      fare: totalFare,
      status: 'Active',
    };
    // ---- Write #1: insert booking ----
    try {
      var bookings = await loadFromStorage(STORAGE_KEYS.bookings);
      bookings.push(newBooking);
      await saveToStorage(STORAGE_KEYS.bookings, bookings);
    } catch (err) {
      console.error('Booking insert failed:', err);
      showToast('Could not create booking. Please try again.', 'error');
      return;
    }

    // ---- Write #2: decrement SCHEDULE seats (not train seats) ----
    try {
      var allSchedules = await loadFromStorage(STORAGE_KEYS.schedules);
      var sIdx = allSchedules.findIndex(function (s) {
        return s.scheduleId === currentSchedule.scheduleId;
      });
      if (sIdx !== -1) {
        var cur = allSchedules[sIdx].seatsAvailable != null ? allSchedules[sIdx].seatsAvailable : 0;
        allSchedules[sIdx].seatsAvailable = Math.max(0, cur - seats);
        await saveToStorage(STORAGE_KEYS.schedules, allSchedules);
      }
    } catch (err) {
      console.error('Schedule seat update failed (booking ' + newId + ' WAS created):', err);
      showToast('Booking saved but seat count may be off. Contact support with ID ' + newId + '.', 'warning');
    }


    showBookingSuccess(newBooking, name, cls, seats, totalFare);
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirm Booking';
    }
  }
});

function showBookingSuccess(booking, name, cls, seats, fare) {
  document.getElementById('booking-form-section').hidden = true;
  document.getElementById('booking-success').hidden = false;

  document.getElementById('success-booking-id').textContent = 'Booking Confirmed — ' + booking.bookingId;
  document.getElementById('success-details').innerHTML =
    '<strong>' + currentTrain.name + '</strong><br>' +
    currentTrain.from + ' → ' + currentTrain.to + '<br>' +
    formatDate(bookingDate) + ' · ' + seats + ' × ' + cls + '<br>' +
    '<strong>Total: ' + formatCurrency(fare) + '</strong>';

  if (role === 'Passenger') {
    document.getElementById('btn-my-bookings').hidden = false;
  }

  showToast('Booking ' + booking.bookingId + ' confirmed!', 'success');
}
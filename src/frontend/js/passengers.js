requireAuth(['Admin', 'Staff']);
initStorage();
renderNav();

var deleteTargetId = null;

async function getBookingCountMap() {
  var bookings = await loadFromStorage(STORAGE_KEYS.bookings);
  var map = {};
  bookings.forEach(function(b) {
    map[b.passengerId] = (map[b.passengerId] || 0) + 1;
  });
  return map;
}

function renderStats(passengers) {
  var male   = passengers.filter(function(p) { return p.gender === 'Male'; }).length;
  var female = passengers.filter(function(p) { return p.gender === 'Female'; }).length;
  document.getElementById('stat-grid').innerHTML =
    '<div class="stat-card"><div class="stat-icon blue">' + ICONS.passengers + '</div><div><div class="stat-value">' + passengers.length + '</div><div class="stat-label">Total Passengers</div></div></div>' +
    '<div class="stat-card"><div class="stat-icon blue"><span class="apple-emoji">👨</span></div><div><div class="stat-value">' + male + '</div><div class="stat-label">Male</div></div></div>' +
    '<div class="stat-card"><div class="stat-icon green"><span class="apple-emoji">👩</span></div><div><div class="stat-value">' + female + '</div><div class="stat-label">Female</div></div></div>';
}

async function renderTable(query) {
  var passengers = await loadFromStorage(STORAGE_KEYS.passengers);
  var bookingMap = await getBookingCountMap();
  var q = ((query !== undefined ? query : document.getElementById('search-input').value) || '').trim().toLowerCase();

  var filtered = q ? passengers.filter(function(p) {
    return p.name.toLowerCase().indexOf(q) !== -1 || p.id.toLowerCase().indexOf(q) !== -1;
  }) : passengers;

  renderStats(passengers);
  document.getElementById('table-heading').textContent = q ? 'Search Results' : 'All Passengers';
  document.getElementById('table-count').textContent   = filtered.length + ' record(s)';

  var tbody = document.getElementById('passengers-body');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No records found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(p) {
    var count = bookingMap[p.id] || 0;
    var countBadge = count > 0
      ? '<span class="badge badge-info">' + count + '</span>'
      : '<span class="badge badge-gray">0</span>';
    return '<tr>' +
      '<td><strong>' + p.id + '</strong></td>' +
      '<td>' + p.name + '</td>' +
      '<td>' + p.age + '</td>' +
      '<td>' + p.gender + '</td>' +
      '<td>' + p.contact + '</td>' +
      '<td>' + p.email + '</td>' +
      '<td>' + countBadge + '</td>' +
      '<td><div class="table-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="openEditModal(\'' + p.id + '\')">Edit</button>' +
        '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'' + p.id + '\')">Delete</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add Passenger';
  document.getElementById('pax-id').value      = '';
  document.getElementById('f-name').value      = '';
  document.getElementById('f-age').value       = '';
  document.getElementById('f-gender').value    = '';
  document.getElementById('f-contact').value   = '';
  document.getElementById('f-email').value     = '';
  clearValidation(document.getElementById('pax-form'));
  openModal('pax-modal');
}

async function openEditModal(id) {
  var passengers = await loadFromStorage(STORAGE_KEYS.passengers);
  var p = passengers.find(function(x) { return x.id === id; });
  if (!p) return;
  document.getElementById('modal-title').textContent = 'Edit Passenger';
  document.getElementById('pax-id').value     = p.id;
  document.getElementById('f-name').value     = p.name;
  document.getElementById('f-age').value      = p.age;
  document.getElementById('f-gender').value   = p.gender;
  document.getElementById('f-contact').value  = p.contact;
  document.getElementById('f-email').value    = p.email;
  clearValidation(document.getElementById('pax-form'));
  openModal('pax-modal');
}

async function confirmDelete(id) {
  var passengers = await loadFromStorage(STORAGE_KEYS.passengers);
  var p = passengers.find(function(x) { return x.id === id; });
  if (!p) return;
  var bookings    = await loadFromStorage(STORAGE_KEYS.bookings);
  var activeCount = bookings.filter(function(b) { return b.passengerId === id && b.status === 'Active'; }).length;
  if (activeCount > 0) {
    showToast(p.name + ' has ' + activeCount + ' active booking(s). Cancel those bookings first.', 'error');
    return;
  }
  deleteTargetId = id;
  document.getElementById('del-confirm-text').textContent =
    'Delete "' + p.name + '" (' + p.id + ')? This action cannot be undone.';
  openModal('del-modal');
}

document.getElementById('del-confirm-btn').addEventListener('click', async function() {
  if (!deleteTargetId) return;
  var passengers = await loadFromStorage(STORAGE_KEYS.passengers);
  var idx = passengers.findIndex(function(p) { return p.id === deleteTargetId; });
  if (idx !== -1) {
    var name = passengers[idx].name;
    passengers.splice(idx, 1);
    try {
      await saveToStorage(STORAGE_KEYS.passengers, passengers);
      showToast(name + ' deleted successfully.', 'success');
    } catch (err) {
      console.error('Delete error:', err);
      showToast('Could not delete ' + name + '. They may have related records.', 'error');
    }
  }
  deleteTargetId = null;
  closeModal('del-modal');
  await renderTable();
});

async function submitForm() {
  var id      = document.getElementById('pax-id').value;
  var name    = document.getElementById('f-name').value.trim();
  var ageRaw  = document.getElementById('f-age').value.trim();
  var age     = parseInt(ageRaw, 10);
  var gender  = document.getElementById('f-gender').value;
  var contact = document.getElementById('f-contact').value.trim();
  var email   = document.getElementById('f-email').value.trim();
  var valid   = true;

  clearValidation(document.getElementById('pax-form'));

  if (!name || !/^[A-Za-z\s]{2,50}$/.test(name)) {
    setError('f-name', 'f-name-err', 'Name must be 2–50 letters only');
    valid = false;
  }

  if (!ageRaw || isNaN(age) || age < 1 || age > 120) {
    setError('f-age', 'f-age-err', 'Age must be between 1 and 120');
    valid = false;
  }

  if (!gender) {
    setError('f-gender', 'f-gender-err', 'Please select a gender');
    valid = false;
  }

  if (!/^05\d{8}$/.test(contact)) {
  setError('f-contact', 'f-contact-err', 'Contact must start with 05 and be 10 digits');
  valid = false;
}

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setError('f-email', 'f-email-err', 'Enter a valid email address');
    valid = false;
  }

  if (!valid) return;

  var passengers = await loadFromStorage(STORAGE_KEYS.passengers);

  // Duplicate-email check (covers BOTH add and edit). On edit we exclude
  // the current passenger from the comparison so they can save without
  // changing their own email.
  var emailClash = passengers.find(function(p) {
    return p.email.toLowerCase() === email.toLowerCase() && p.id !== id;
  });
  if (emailClash) {
    setError('f-email', 'f-email-err', 'Another passenger (' + emailClash.id + ') already uses this email');
    return;
  }

  try {
    if (id) {
      var idx = passengers.findIndex(function(p) { return p.id === id; });
      if (idx !== -1) {
        passengers[idx].name    = name;
        passengers[idx].age     = age;
        passengers[idx].gender  = gender;
        passengers[idx].contact = contact;
        passengers[idx].email   = email;
        await saveToStorage(STORAGE_KEYS.passengers, passengers);
        showToast(name + ' updated successfully.', 'success');
      }
    } else {
      passengers.push({
        id:            generateId('P'),
        name:          name,
        age:           age,
        gender:        gender,
        contact:       contact,
        email:         email,
      });
      await saveToStorage(STORAGE_KEYS.passengers, passengers);
      showToast(name + ' added successfully.', 'success');
    }
  } catch (err) {
    console.error('Save error:', err);
    showToast('Could not save changes. Check the console for details.', 'error');
    return;
  }

  closeModal('pax-modal');
  await renderTable();
}

document.getElementById('search-input').addEventListener('input', function() {
  renderTable(this.value);
});

[['f-name',    'f-name-err',    'input'],
 ['f-age',     'f-age-err',     'input'],
 ['f-gender',  'f-gender-err',  'change'],
 ['f-contact', 'f-contact-err', 'input'],
 ['f-email',   'f-email-err',   'input']
].forEach(function(trio) {
  var el = document.getElementById(trio[0]);
  if (el) el.addEventListener(trio[2], function() { clearError(trio[0], trio[1]); });
});

renderTable();
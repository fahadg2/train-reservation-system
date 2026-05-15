// =====================================================================
// TrainMS — Staff management (Admin only)
// ---------------------------------------------------------------------
// The `users` table is RLS-locked, so every read/write here goes through
// a Postgres RPC. The required RPCs are:
//   - list_staff_users()                       → returns Staff rows
//   - check_username_available(p_username)     → existing
//   - create_staff_user(...)                   → for Admin-created Staff
//   - update_staff_user(p_username, p_display_name, p_new_password)
//   - delete_user(p_username)
// The SQL for these is in staff-rpcs.sql + create-staff-user-rpc.sql.
// If any RPC is missing, the page surfaces a clear setup message.
// =====================================================================

requireAuth(['Admin']);
initStorage();
renderNav();

var deleteTargetUsername = null;
var currentUser = getCurrentUser();

// ---------------------------------------------------------------------
// Data layer
// ---------------------------------------------------------------------

async function loadStaff() {
  var result = await sb.rpc('list_staff_users');
  if (result.error) {
    console.error('list_staff_users RPC failed:', result.error);
    return { ok: false, error: result.error, data: [] };
  }
  // Normalize column names — Postgres returns snake_case
  var rows = (result.data || []).map(function(r) {
    return {
      username: r.username,
      displayName: r.display_name || r.username,
      role: r.role,
    };
  });
  return { ok: true, data: rows };
}

// ---------------------------------------------------------------------
// UI rendering
// ---------------------------------------------------------------------

function renderStats(staffList) {
  document.getElementById('stat-grid').innerHTML =
    '<div class="stat-card">' +
      '<div class="stat-icon blue">' + ICONS.passengers + '</div>' +
      '<div><div class="stat-value">' + staffList.length + '</div>' +
      '<div class="stat-label">Total Staff</div></div>' +
    '</div>';
}

function renderSetupError(err) {
  var grid = document.getElementById('stat-grid');
  grid.innerHTML = '';

  var tbody = document.getElementById('staff-body');
  var msg = err && err.message ? err.message : 'Unknown error';
  // PGRST202 = function not found. Anything else = real error.
  var notFound = err && (err.code === 'PGRST202' || /could not find the function|does not exist/i.test(msg));

  if (notFound) {
    tbody.innerHTML =
      '<tr class="empty-row"><td colspan="4" style="text-align: left; padding: 16px;">' +
        '<strong>Setup required:</strong> the <code>list_staff_users</code> ' +
        'database function is missing. Apply the SQL in ' +
        '<code>staff-rpcs.sql</code> to your Supabase project, then reload.' +
      '</td></tr>';
  } else {
    tbody.innerHTML =
      '<tr class="empty-row"><td colspan="4">Could not load staff: ' + msg + '</td></tr>';
  }
  document.getElementById('table-count').textContent = '';
}

async function renderTable(query) {
  var result = await loadStaff();
  if (!result.ok) {
    renderSetupError(result.error);
    return;
  }
  var staff = result.data;
  renderStats(staff);

  var q = ((query !== undefined ? query : document.getElementById('search-input').value) || '').trim().toLowerCase();
  var filtered = q ? staff.filter(function(s) {
    return s.username.toLowerCase().indexOf(q) !== -1 ||
           (s.displayName && s.displayName.toLowerCase().indexOf(q) !== -1);
  }) : staff;

  document.getElementById('table-heading').textContent = q ? 'Search Results' : 'All Staff';
  document.getElementById('table-count').textContent   = filtered.length + ' record(s)';

  var tbody = document.getElementById('staff-body');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="4">No staff found</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(s) {
    // Escape the username for safe HTML embedding (could contain anything
    // that passes the [a-zA-Z0-9_] regex, but better safe than sorry).
    var safeUsername = String(s.username).replace(/'/g, "\\'");
    return '<tr>' +
      '<td><strong>' + s.username + '</strong></td>' +
      '<td>' + (s.displayName || '—') + '</td>' +
      '<td><span class="badge badge-info">' + s.role + '</span></td>' +
      '<td><div class="table-actions">' +
        '<button class="btn btn-secondary btn-sm" onclick="openEditModal(\'' + safeUsername + '\')">Edit</button>' +
        '<button class="btn btn-danger btn-sm" onclick="confirmDelete(\'' + safeUsername + '\')">Delete</button>' +
      '</div></td>' +
      '</tr>';
  }).join('');
}

// ---------------------------------------------------------------------
// Add / Edit modal
// ---------------------------------------------------------------------

function openAddModal() {
  document.getElementById('modal-title').textContent = 'Add Staff';
  document.getElementById('s-orig-username').value   = '';
  document.getElementById('f-display-name').value    = '';
  document.getElementById('f-username').value        = '';
  document.getElementById('f-password').value        = '';
  document.getElementById('f-username').readOnly     = false;
  document.getElementById('password-hint').textContent = '';
  document.getElementById('password-group').style.display = '';
  clearValidation(document.getElementById('staff-form'));
  openModal('staff-modal');
}

async function openEditModal(username) {
  var result = await loadStaff();
  if (!result.ok) {
    showToast('Could not load staff records.', 'error');
    return;
  }
  var s = result.data.find(function(x) { return x.username === username; });
  if (!s) {
    showToast('Staff member not found.', 'error');
    return;
  }

  document.getElementById('modal-title').textContent = 'Edit Staff';
  document.getElementById('s-orig-username').value   = s.username;
  document.getElementById('f-display-name').value    = s.displayName || '';
  document.getElementById('f-username').value        = s.username;
  document.getElementById('f-password').value        = '';
  // Username is the primary key — making it editable would require a
  // multi-step rename across the users table and any references. Keep it
  // read-only on edit; admin can delete + recreate if they really need to.
  document.getElementById('f-username').readOnly     = true;
  document.getElementById('password-hint').textContent =
    'Leave blank to keep current password.';
  clearValidation(document.getElementById('staff-form'));
  openModal('staff-modal');
}

// ---------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------

function confirmDelete(username) {
  // Don't let an admin accidentally delete themselves while logged in.
  // (They could still get locked out by another admin, but at least one
  // admin can't lock themselves out via this UI.)
  if (username === currentUser.username) {
    showToast("You can't delete your own account while signed in.", 'error');
    return;
  }

  deleteTargetUsername = username;
  document.getElementById('del-confirm-text').textContent =
    'Delete staff account "' + username + '"? This cannot be undone.';
  openModal('del-modal');
}

document.getElementById('del-confirm-btn').addEventListener('click', async function() {
  if (!deleteTargetUsername) return;
  var btn = document.getElementById('del-confirm-btn');

  btn.disabled = true;
  btn.textContent = 'Deleting…';

  try {
    var result = await sb.rpc('delete_user', { p_username: deleteTargetUsername });
    if (result.error) {
      console.error('delete_user RPC failed:', result.error);
      var msg = result.error.message || 'Unknown error';
      if (result.error.code === 'PGRST202' || /could not find|does not exist/i.test(msg)) {
        showToast('Setup required: delete_user RPC missing. See staff-rpcs.sql.', 'error');
      } else {
        showToast('Could not delete: ' + msg, 'error');
      }
      return;
    }
    showToast('Staff account "' + deleteTargetUsername + '" deleted.', 'success');
  } finally {
    deleteTargetUsername = null;
    btn.disabled = false;
    btn.textContent = 'Delete';
    closeModal('del-modal');
    await renderTable();
  }
});

// ---------------------------------------------------------------------
// Submit (add or edit)
// ---------------------------------------------------------------------

async function submitForm() {
  var origUsername = document.getElementById('s-orig-username').value;
  var displayName  = document.getElementById('f-display-name').value.trim();
  var username     = document.getElementById('f-username').value.trim();
  var password     = document.getElementById('f-password').value;
  var isEdit       = origUsername !== '';
  var valid        = true;

  clearValidation(document.getElementById('staff-form'));

  // Display name: 2–50 chars. Must start with a letter, can include spaces,
  // hyphens (Al-Zahra), apostrophes (O'Brien), and periods (John A. Smith).
  if (!displayName || !/^[A-Za-z][A-Za-z\s'\-\.]{1,49}$/.test(displayName)) {
    setError('f-display-name', 'f-display-name-err', 'Name must be 2–50 characters (letters, spaces, hyphens, apostrophes)');
    valid = false;
  }

  // Username: matches the signup regex
  if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    setError('f-username', 'f-username-err', 'Username: 3–20 chars, letters/numbers/underscores');
    valid = false;
  }

  // Password rules:
  //   - Add mode: required, min 6 chars
  //   - Edit mode: optional; if provided, must be at least 6 chars
  if (!isEdit) {
    if (!password || password.length < 6) {
      setError('f-password', 'f-password-err', 'Password must be at least 6 characters');
      valid = false;
    }
  } else {
    if (password && password.length < 6) {
      setError('f-password', 'f-password-err', 'Password must be at least 6 characters (or leave blank)');
      valid = false;
    }
  }

  if (!valid) return;

  var btn = document.querySelector('#staff-modal .modal-footer .btn-primary');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    if (isEdit) {
      // ---- EDIT ----
      var update = await sb.rpc('update_staff_user', {
        p_username:     origUsername,
        p_display_name: displayName,
        p_new_password: password || null,  // null = don't change password
      });
      if (update.error) {
        console.error('update_staff_user RPC failed:', update.error);
        var emsg = update.error.message || 'Unknown error';
        if (update.error.code === 'PGRST202' || /could not find|does not exist/i.test(emsg)) {
          showToast('Setup required: update_staff_user RPC missing. See staff-rpcs.sql.', 'error');
        } else {
          showToast('Could not update: ' + emsg, 'error');
        }
        return;
      }
      showToast('Staff "' + origUsername + '" updated.', 'success');
    } else {
      // ---- ADD ----
      // Check username availability first (clearer error than waiting for
      // the unique-constraint violation in create_user).
      var check = await sb.rpc('check_username_available', { p_username: username });
      if (check.error) {
        console.error('Username check failed:', check.error);
        showToast('Could not verify username. Please try again.', 'error');
        return;
      }
      if (check.data === false) {
        setError('f-username', 'f-username-err', 'Username already taken');
        return;
      }

      var create = await sb.rpc('create_staff_user', {
        p_username:     username,
        p_password:     password,
        p_display_name: displayName,
      });
      if (create.error) {
        console.error('create_staff_user RPC failed:', create.error);
        var cmsg = create.error.message || 'Unknown error';
        if (create.error.code === 'PGRST202' || /could not find|does not exist/i.test(cmsg)) {
          showToast('Setup required: create_staff_user RPC missing. See create-staff-user-rpc.sql.', 'error');
        } else {
          showToast('Could not create staff account: ' + cmsg, 'error');
        }
        return;
      }
      showToast('Staff "' + username + '" created.', 'success');
    }

    closeModal('staff-modal');
    await renderTable();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save';
  }
}

// ---------------------------------------------------------------------
// Wire up live error clearing + search
// ---------------------------------------------------------------------

document.getElementById('search-input').addEventListener('input', function() {
  renderTable(this.value);
});

[['f-display-name', 'f-display-name-err', 'input'],
 ['f-username',     'f-username-err',     'input'],
 ['f-password',     'f-password-err',     'input']
].forEach(function(trio) {
  var el = document.getElementById(trio[0]);
  if (el) el.addEventListener(trio[2], function() { clearError(trio[0], trio[1]); });
});

renderTable();

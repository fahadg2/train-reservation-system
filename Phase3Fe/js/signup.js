// =====================================================================
// TrainMS — Sign up flow
// Creates a passenger row AND a user row (Passenger role only).
// No transaction support — if user insert fails, the orphan passenger
// gets cleaned up. Not bulletproof but acceptable for the demo.
//
// Note: the users table is protected by RLS. Username checks and user
// creation go through Postgres functions (check_username_available,
// create_user) instead of direct table access.
// =====================================================================

initStorage();

if (sessionStorage.getItem('userRole')) {
  window.location.href = 'dashboard.html';
}

var isSubmitting = false;

// Wire input events to clear errors as the user types
['full-name', 'email', 'contact', 'age', 'gender', 'username', 'password'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', function() { clearError(id, id + '-error'); });
    if (el.tagName === 'SELECT') {
      el.addEventListener('change', function() { clearError(id, id + '-error'); });
    }
  }
});

document.getElementById('signup-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (isSubmitting) return;

  var submitBtn = e.target.querySelector('button[type="submit"]');

  var fullName = document.getElementById('full-name').value.trim();
  var email    = document.getElementById('email').value.trim();
  var contact  = document.getElementById('contact').value.trim();
  var age      = parseInt(document.getElementById('age').value, 10);
  var gender   = document.getElementById('gender').value;
  var username = document.getElementById('username').value.trim();
  var password = document.getElementById('password').value;
  var valid    = true;

  // --- Validation ---
  // Names: 2–50 chars. Must start with a letter, can include spaces,
  // hyphens (Al-Zahra), apostrophes (O'Brien), and periods (John A. Smith).
  var nameRegex = /^[A-Za-z][A-Za-z\s'\-\.]{1,49}$/;
  if (!fullName || !nameRegex.test(fullName)) {
    setError('full-name', 'full-name-error', 'Name must be 2–50 characters (letters, spaces, hyphens, apostrophes)');
    valid = false;
  }

  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    setError('email', 'email-error', 'Enter a valid email address');
    valid = false;
  }

  if (!/^05\d{8}$/.test(contact)) {
    setError('contact', 'contact-error', 'Phone must be exactly 10 digits starting with 05');
    valid = false;
  }

  if (!age || age < 1 || age > 120) {
    setError('age', 'age-error', 'Age must be between 1 and 120');
    valid = false;
  }

  if (!gender) {
    setError('gender', 'gender-error', 'Please select a gender');
    valid = false;
  }

  var usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!username || !usernameRegex.test(username)) {
    setError('username', 'username-error', 'Username: 3–20 chars, letters/numbers/underscores');
    valid = false;
  }

  if (!password || password.length < 6) {
    setError('password', 'password-error', 'Password must be at least 6 characters');
    valid = false;
  }

  if (!valid) return;

  isSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account…';
  }

  var createdPassengerId = null;

  try {
    // --- Pre-check: username already taken? (RPC — users table is RLS-locked) ---
    var usernameCheck = await sb.rpc('check_username_available', {
      p_username: username,
    });
    if (usernameCheck.error) {
      console.error('Username lookup failed:', usernameCheck.error);
      showToast('Could not verify username. Please try again.', 'error');
      return;
    }
    if (usernameCheck.data === false) {
      setError('username', 'username-error', 'Username already taken');
      return;
    }

    // --- Pre-check: email already registered? ---
    var emailCheck = await sb.from('passengers').select('id').eq('email', email);
    if (emailCheck.error) {
      console.error('Email lookup failed:', emailCheck.error);
      showToast('Could not verify email. Please try again.', 'error');
      return;
    }
    if (emailCheck.data && emailCheck.data.length > 0) {
      setError('email', 'email-error', 'An account with this email already exists');
      return;
    }

    // --- Generate a fresh passenger ID (P011, P012, ...).
    //     Two simultaneous signups could compute the same next ID, so we
    //     retry on PK collision up to 5 times.
    var newPassengerId = null;
    var paxInsert = null;
    var attempts = 0;
    while (attempts < 5) {
      attempts++;
      var allPassengers = await sb.from('passengers').select('id');
      var maxNum = 0;
      if (allPassengers.data) {
        allPassengers.data.forEach(function(p) {
          var n = parseInt(p.id.replace(/\D/g, ''), 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        });
      }
      newPassengerId = 'P' + String(maxNum + attempts).padStart(3, '0');

      // --- Write #1: insert passenger ---
      paxInsert = await sb.from('passengers').insert({
        id:      newPassengerId,
        name:    fullName,
        age:     age,
        gender:  gender,
        contact: contact,
        email:   email,
      });

      if (!paxInsert.error) break;

      // 23505 = unique_violation; retry with a new ID
      if (paxInsert.error.code === '23505') {
        console.warn('Passenger ID ' + newPassengerId + ' collided, retrying...');
        continue;
      }

      // Any other error — bail
      console.error('Passenger insert failed:', paxInsert.error);
      showToast('Could not create account. Please try again.', 'error');
      return;
    }

    if (paxInsert.error) {
      console.error('Passenger insert failed after retries:', paxInsert.error);
      showToast('Could not create account. Please try again.', 'error');
      return;
    }
    createdPassengerId = newPassengerId;

    // --- Write #2: insert user row via RPC (users table is RLS-locked) ---
    var userInsert = await sb.rpc('create_user', {
      p_username:     username,
      p_password:     password,
      p_role:         'Passenger',
      p_display_name: fullName,
      p_passenger_id: newPassengerId,
    });
    if (userInsert.error) {
      console.error('User insert failed:', userInsert.error);
      // Cleanup: remove the orphan passenger we just created
      await sb.from('passengers').delete().eq('id', createdPassengerId);
      showToast('Could not create account. Please try again.', 'error');
      return;
    }

    showToast('Account created! Signing you in…', 'success');
    setTimeout(function() {
      window.location.href = 'index.html';
    }, 1200);

  } catch (err) {
    console.error('Signup failed:', err);
    if (createdPassengerId) {
      try { await sb.from('passengers').delete().eq('id', createdPassengerId); } catch (_) {}
    }
    showToast('Something went wrong. Please try again.', 'error');
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  }
});
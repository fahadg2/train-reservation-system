// =====================================================================
// TrainMS — Forgot Password
// Demo behavior: we don't actually send emails (no SMTP server).
// This learning project prioritizes UX over user-enumeration protection —
// we tell the user explicitly whether the email exists. A production app
// would show the same success message either way to prevent attackers
// from probing which emails are registered. If the email matches, we
// log to the console so you can see the flow in dev tools.
// =====================================================================

initStorage();

if (sessionStorage.getItem('userRole')) {
  window.location.href = 'dashboard.html';
}

var isSubmitting = false;

document.getElementById('email').addEventListener('input', function() {
  clearError('email', 'email-error');
});

document.getElementById('forgot-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  if (isSubmitting) return;

  var submitBtn = e.target.querySelector('button[type="submit"]');
  var email = document.getElementById('email').value.trim();

  var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    setError('email', 'email-error', 'Enter a valid email address');
    return;
  }

  isSubmitting = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
  }

  try {
    // Look up the email in the DB — but DON'T tell the user what we found.
    var paxResult = await sb.from('passengers').select('id, name').eq('email', email);

    if (paxResult.error) {
      console.error('Email lookup failed:', paxResult.error);
      showToast('Something went wrong. Please try again.', 'error');
      return;
    }

var emailExists = paxResult.data && paxResult.data.length > 0;

    if (!emailExists) {
      setError('email', 'email-error', 'No account found with this email');
      return;
    }

    // In a real app, we'd generate a reset token and email a secure link.
    // Here, just log it so you can see the flow working in dev tools.
    console.log('[forgot-password] Reset link would be sent to:', email,
                '(passenger:', paxResult.data[0].name + ')');

    // Small artificial delay so it feels like something happened
    await new Promise(function(r) { setTimeout(r, 600); });

    // Show success
    document.getElementById('form-state').hidden = true;
    document.getElementById('sent-email').textContent = email;
    document.getElementById('success-state').hidden = false;

  } catch (err) {
    console.error('Forgot-password flow failed:', err);
    showToast('Something went wrong. Please try again.', 'error');
  } finally {
    isSubmitting = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Reset Link';
    }
  }
});
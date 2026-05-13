// Supabase-backed auth. Public API unchanged except login() is now async.
// sessionStorage keys preserved: userRole, username, displayName, passengerId.
//
// Login goes through the verify_login() Postgres function instead of
// querying the users table directly. The users table is protected by RLS
// and the anon key cannot read it, so passwords cannot be extracted by
// anyone with DevTools.

async function login(username, password) {
  var cleanUsername = username.toLowerCase().trim();

  try {
    var result = await sb.rpc('verify_login', {
      p_username: cleanUsername,
      p_password: password,
    });

    if (result.error) {
      console.error('Login RPC error:', result.error);
      return false;
    }
    if (!result.data || result.data.length === 0) {
      return false;
    }

    var user = result.data[0];
    sessionStorage.setItem('userRole', user.role);
    sessionStorage.setItem('username', user.username);
    sessionStorage.setItem('displayName', user.display_name || user.username);
    sessionStorage.setItem('passengerId', user.passenger_id || '');
    return true;
  } catch (err) {
    console.error('Login network error:', err);
    return false;
  }
}

function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

function requireAuth(allowedRoles) {
  const role = sessionStorage.getItem('userRole');
  if (!role) {
    window.location.href = 'index.html';
    return false;
  }
  if (allowedRoles && allowedRoles.length && allowedRoles.indexOf(role) === -1) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

function getCurrentRole() {
  return sessionStorage.getItem('userRole');
}

function getCurrentUser() {
  return {
    role: sessionStorage.getItem('userRole'),
    username: sessionStorage.getItem('username'),
    displayName: sessionStorage.getItem('displayName'),
    passengerId: sessionStorage.getItem('passengerId'),
  };
}
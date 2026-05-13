var ICONS = {
  dashboard:  '<span class="apple-emoji">🏠</span>',
  schedules:  '<span class="apple-emoji">📅</span>',
  search:     '<span class="apple-emoji">🔍</span>',
  passengers: '<span class="apple-emoji">👥</span>',
  reports:    '<span class="apple-emoji">📊</span>',
  routes:     '<span class="apple-emoji">📍</span>',
  cancel:     '<span class="apple-emoji">🚫</span>',
  myBookings: '<span class="apple-emoji">🎫</span>',
  logo:       '<span class="apple-emoji">🚆</span>'
};

var NAV_LINKS = {
  Admin: [
    { label: 'Dashboard',     href: 'dashboard.html',   icon: ICONS.dashboard },
    { label: 'Schedules',     href: 'schedules.html',   icon: ICONS.schedules },
    { label: 'Search Trains', href: 'search.html',      icon: ICONS.search },
    { label: 'Passengers',    href: 'passengers.html',  icon: ICONS.passengers },
    { label: 'Reports',       href: 'reports.html',     icon: ICONS.reports },
    { label: 'Routes',        href: 'routes.html',      icon: ICONS.routes },
  ],
  Staff: [
    { label: 'Dashboard',     href: 'dashboard.html',     icon: ICONS.dashboard },
    { label: 'Search Trains', href: 'search.html',        icon: ICONS.search },
    { label: 'Passengers',    href: 'passengers.html',    icon: ICONS.passengers },
    { label: 'Cancel Ticket', href: 'cancellation.html',  icon: ICONS.cancel },
  ],
  Passenger: [
    { label: 'Dashboard',     href: 'dashboard.html',     icon: ICONS.dashboard },
    { label: 'Search Trains', href: 'search.html',        icon: ICONS.search },
    { label: 'My Bookings',   href: 'my-bookings.html',   icon: ICONS.myBookings },
    { label: 'Cancel Ticket', href: 'cancellation.html',  icon: ICONS.cancel },
  ],
};

function renderNav() {
  var sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  var user = getCurrentUser();
  var role = user.role || 'Passenger';
  var links = NAV_LINKS[role] || [];
  var current = window.location.pathname.split('/').pop() || 'dashboard.html';

  var linksHtml = links.map(function(link) {
    var isActive = current === link.href ? ' active' : '';
    return '<a href="' + link.href + '" class="nav-link' + isActive + '">' +
      '<span class="nav-icon">' + link.icon + '</span>' +
      link.label +
      '</a>';
  }).join('');

  sidebar.innerHTML =
    '<div class="sidebar-brand">' +
      '<h2>' + ICONS.logo + ' TrainMS</h2>' +
      '<p>Management System</p>' +
    '</div>' +
    '<nav class="sidebar-nav">' + linksHtml + '</nav>' +
    '<div class="sidebar-footer">' +
      '<div class="sidebar-user">' +
        '<strong>' + (user.displayName || user.username || 'User') + '</strong>' +
        role +
      '</div>' +
      '<button class="btn btn-secondary btn-sm btn-full" onclick="logout()">Sign Out</button>' +
    '</div>';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('active');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('active');
}
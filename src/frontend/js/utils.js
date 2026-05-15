// =====================================================================
// TrainMS — utils.js (Supabase-backed)
// =====================================================================
// Translates between Supabase snake_case rows and the camelCase fields
// used throughout the existing JS code. The rest of the app does not
// need to know it's talking to Postgres.
// =====================================================================


// ---------------------------------------------------------------------
// Storage key → Supabase table mapping
// ---------------------------------------------------------------------
const TABLE_MAP = {
  tms_trains: 'trains',
  tms_schedules: 'schedules',
  tms_passengers: 'passengers',
  tms_bookings: 'bookings',
  tms_routes: 'routes',
  tms_revenue: 'revenue',
  tms_users: 'users',
};


// ---------------------------------------------------------------------
// Row translators — Supabase row  ⇄  app-format object
// ---------------------------------------------------------------------
const TRANSLATORS = {

  trains: {
    fromDb: function (r) {
      return {
        id: r.id,
        name: r.name,
        from: r.from_city,
        to: r.to_city,
        departure: r.departure ? r.departure.slice(0, 5) : '',
        arrival: r.arrival ? r.arrival.slice(0, 5) : '',
        fareEconomy: Number(r.fare_economy),
        fareBusiness: Number(r.fare_business),
        seatsTotal: r.seats_total,
        seatsAvailable: r.seats_available,
        status: r.status,
      };
    },
    toDb: function (o) {
      return {
        id: o.id,
        name: o.name,
        from_city: o.from,
        to_city: o.to,
        departure: o.departure,
        arrival: o.arrival,
        fare_economy: o.fareEconomy,
        fare_business: o.fareBusiness,
        seats_total: o.seatsTotal,
        seats_available: o.seatsAvailable,
        status: o.status,
      };
    },
    pk: 'id',
  },

  schedules: {
    fromDb: function (r) {
      return {
        scheduleId: r.schedule_id,
        trainId: r.train_id,
        date: r.date,
        platform: r.platform,
        delayMinutes: r.delay_minutes,
        seatsAvailable: r.seats_available,
      };
    },
    toDb: function (o) {
      return {
        schedule_id: o.scheduleId,
        train_id: o.trainId,
        date: o.date,
        platform: o.platform,
        delay_minutes: o.delayMinutes,
        seats_available: o.seatsAvailable,
      };
    },
    pk: 'schedule_id',
  },

  passengers: {
    fromDb: function (r) {
      return {
        id: r.id,
        name: r.name,
        age: r.age,
        gender: r.gender,
        contact: r.contact,
        email: r.email,
        // totalBookings is computed live by pages that need it
      };
    },
    toDb: function (o) {
      return {
        id: o.id,
        name: o.name,
        age: o.age,
        gender: o.gender,
        contact: o.contact,
        email: o.email,
      };
    },
    pk: 'id',
  },

  bookings: {
    fromDb: function (r) {
      return {
        bookingId: r.booking_id,
        passengerId: r.passenger_id,
        trainId: r.train_id,
        scheduleId: r.schedule_id,
        date: r.date,
        seats: r.seats,
        class: r.class,
        fare: Number(r.fare),
        status: r.status,
      };
    },
    toDb: function (o) {
      return {
        booking_id: o.bookingId,
        passenger_id: o.passengerId,
        train_id: o.trainId,
        schedule_id: o.scheduleId,
        date: o.date,
        seats: o.seats,
        class: o.class,
        fare: o.fare,
        status: o.status,
      };
    },
    pk: 'booking_id',
  },

  routes: {
    fromDb: function (r) {
      return {
        routeId: r.route_id,
        name: r.name,
        stops: r.stops || [],
        distanceKm: Number(r.distance_km),
        durationMin: r.duration_min,
      };
    },
    toDb: function (o) {
      return {
        route_id: o.routeId,
        name: o.name,
        stops: o.stops,
        distance_km: o.distanceKm,
        duration_min: o.durationMin,
      };
    },
    pk: 'route_id',
  },

  revenue: {
    fromDb: function (r) {
      return {
        date: r.date,
        totalBookings: r.total_bookings,
        totalRevenue: Number(r.total_revenue),
        cancellations: r.cancellations,
      };
    },
    toDb: function (o) {
      return {
        date: o.date,
        total_bookings: o.totalBookings,
        total_revenue: o.totalRevenue,
        cancellations: o.cancellations,
      };
    },
    pk: 'date',
  },

  users: {
    fromDb: function (r) {
      return {
        username: r.username,
        role: r.role,
        displayName: r.display_name,
        passengerId: r.passenger_id,
      };
    },
    toDb: function (o) {
      return {
        username: o.username,
        role: o.role,
        display_name: o.displayName,
        passenger_id: o.passengerId,
      };
    },
    pk: 'username',
  },

};


// ---------------------------------------------------------------------
// In-memory cache so synchronous code that reads right after a write
// still sees the updated data. Populated by loadFromStorage().
// ---------------------------------------------------------------------
const _cache = {};


// ---------------------------------------------------------------------
// initStorage()  —  kept as a no-op for API compatibility
// (data lives permanently in Supabase, no seeding needed client-side)
// ---------------------------------------------------------------------
function initStorage() {
  // intentionally empty
}


// ---------------------------------------------------------------------
// loadFromStorage(key)  —  async; returns array of app-format objects
// ---------------------------------------------------------------------
async function loadFromStorage(key) {
  const table = TABLE_MAP[key];
  if (!table) {
    console.error('Unknown storage key:', key);
    return [];
  }

  const t = TRANSLATORS[table];

  // Order revenue by date for the dashboard's "last 7" slice
  let query = sb.from(table).select('*');
  if (table === 'revenue') query = query.order('date', { ascending: true });
  if (table === 'bookings') query = query.order('created_at', { ascending: true });

  const { data, error } = await query;
  if (error) {
    console.error('loadFromStorage(' + key + ') failed:', error.message);
    return _cache[key] || [];
  }

  const translated = data.map(t.fromDb);
  _cache[key] = translated;
  return translated;
}


// ---------------------------------------------------------------------
// saveToStorage(key, data)  —  async; upserts the full array
// Matches the existing API: callers pass the WHOLE collection.
// We diff against current rows to handle deletes.
// ---------------------------------------------------------------------
async function saveToStorage(key, dataArray) {
  const table = TABLE_MAP[key];
  if (!table) {
    console.error('Unknown storage key:', key);
    return false;
  }

  // SAFETY: refuse to wipe a table by passing an empty array.
  // If a caller genuinely wants to clear a table, they should do it explicitly
  // via direct sb.from(table).delete() rather than passing []. This guard
  // prevents a buggy filter from nuking production data.
  const { count: rowCount, error: countErr } = await sb.from(table).select('*', { count: 'exact', head: true });
  if (!countErr && rowCount > 0 && dataArray.length === 0) {
    console.error('saveToStorage(' + key + ') refused: would delete all ' + rowCount + ' rows. Pass non-empty array or delete explicitly.');
    return false;
  }

  const t = TRANSLATORS[table];
  const pk = t.pk;

  // 1. Translate incoming objects to DB format
  const dbRows = dataArray.map(t.toDb);

  // 2. Fetch current PKs to figure out what to delete
  const { data: existing, error: fetchErr } = await sb.from(table).select(pk);
  if (fetchErr) {
    console.error('saveToStorage(' + key + ') fetch failed:', fetchErr.message);
    return false;
  }

  const incomingPks = new Set(dbRows.map(function (r) { return r[pk]; }));
  const toDelete = existing
    .map(function (r) { return r[pk]; })
    .filter(function (id) { return !incomingPks.has(id); });

  // 3. Delete removed rows
  if (toDelete.length > 0) {
    const { error: delErr } = await sb.from(table).delete().in(pk, toDelete);
    if (delErr) {
      console.error('saveToStorage(' + key + ') delete failed:', delErr.message);
      return false;
    }
  }

  // 4. Upsert remaining rows (insert if new, update if existing)
  if (dbRows.length > 0) {
    const { error: upsertErr } = await sb.from(table).upsert(dbRows, { onConflict: pk });
    if (upsertErr) {
      console.error('saveToStorage(' + key + ') upsert failed:', upsertErr.message);
      return false;
    }
  }

  // 5. Update local cache so subsequent reads are fresh
  _cache[key] = dataArray.slice();
  return true;
}

// ---------------------------------------------------------------------
// STORAGE_KEYS  —  re-exposed here so pages don't need mockData.js
// ---------------------------------------------------------------------
const STORAGE_KEYS = {
  trains: 'tms_trains',
  schedules: 'tms_schedules',
  passengers: 'tms_passengers',
  bookings: 'tms_bookings',
  routes: 'tms_routes',
  revenue: 'tms_revenue',
  users: 'tms_users',
};


// =====================================================================
// UI helpers — UNCHANGED from original utils.js
// =====================================================================

function showToast(message, type) {
  type = type || 'success';
  const container = document.getElementById('toast-container');
  if (!container) return;
  const titles = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = '<div class="toast-title">' + (titles[type] || 'Notice') + '</div><div>' + message + '</div>';
  container.appendChild(el);
  setTimeout(function () { el.remove(); }, 3000);
}

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatCurrency(amount) {
  return Number(amount).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' SAR';
}

function generateId(prefix) {
  return prefix + Date.now().toString().slice(-6) + String(Math.floor(Math.random() * 100)).padStart(2, '0');
}

function clearValidation(formEl) {
  formEl.querySelectorAll('input, select').forEach(function (el) {
    el.classList.remove('error');
  });
  formEl.querySelectorAll('span.error').forEach(function (el) {
    el.textContent = '';
  });
}

function setError(inputId, errorId, msg) {
  const input = document.getElementById(inputId);
  const span = document.getElementById(errorId);
  if (input) input.classList.add('error');
  if (span) span.textContent = msg;
}

function clearError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const span = document.getElementById(errorId);
  if (input) input.classList.remove('error');
  if (span) span.textContent = '';
}
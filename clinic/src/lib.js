// The clinic works in Tanzanian time whatever the device clock says.
export const CLINIC_TZ = 'Africa/Dar_es_Salaam';

export const STATUSES = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
export const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};
export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Selects an appointment with the names staff need to see.
export const APPT_SELECT =
  '*, patient:patients(id, full_name, phone), doctor:doctors(name, specialty), service:clinic_services(name, fee)';

export function clinicToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const hhmm = (t) => (t ? t.slice(0, 5) : '');

export const longDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', {
  timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
});

export const money = (n) => 'TZS ' + Math.round(Number(n || 0)).toLocaleString('en-US');

export function age(birthDate) {
  if (!birthDate) return null;
  const today = clinicToday();
  let years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  if (today.slice(5) < birthDate.slice(5)) years -= 1;
  return years;
}

export const workDays = (days) => (days || []).slice().sort().map((d) => DAYS[d]).join(', ');

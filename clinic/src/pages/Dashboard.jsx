import { useCallback, useEffect, useState } from 'react';
import AppointmentModal from '../components/AppointmentModal';
import AppointmentTable from '../components/AppointmentTable';
import { addDays, APPT_SELECT, clinicToday, longDate } from '../lib';
import { db } from '../supabase';

export default function Dashboard() {
  const today = clinicToday();
  const [todayRows, setTodayRows] = useState([]);
  const [pending, setPending] = useState([]);
  const [upcoming, setUpcoming] = useState(0);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    const [t, p, u] = await Promise.all([
      db.from('appointments').select(APPT_SELECT).eq('appt_date', today).order('start_time'),
      db.from('appointments').select(APPT_SELECT).eq('status', 'pending').gte('appt_date', today)
        .order('appt_date').order('start_time').limit(50),
      db.from('appointments').select('id', { count: 'exact', head: true })
        .gt('appt_date', today).lte('appt_date', addDays(today, 7)).in('status', ['pending', 'confirmed']),
    ]);
    const err = t.error || p.error || u.error;
    setError(err ? err.message : '');
    setTodayRows(t.data || []);
    setPending(p.data || []);
    setUpcoming(u.count || 0);
  }, [today]);

  useEffect(() => { load(); }, [load]);

  const count = (s) => todayRows.filter((a) => a.status === s).length;
  const active = todayRows.filter((a) => a.status !== 'cancelled');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">{longDate(today)}</p>
        </div>
      </div>
      {error && <p className="msg error">{error}</p>}

      <div className="stats">
        <div className="stat"><span>Today</span><strong>{active.length}</strong></div>
        <div className="stat"><span>Waiting for confirmation</span><strong>{pending.length}</strong></div>
        <div className="stat"><span>Completed today</span><strong>{count('completed')}</strong></div>
        <div className="stat"><span>Next 7 days</span><strong>{upcoming}</strong></div>
      </div>

      <section className="card">
        <h2>Today’s schedule</h2>
        <AppointmentTable rows={todayRows} onOpen={setOpen} empty="No appointments today." />
      </section>

      <section className="card">
        <h2>Bookings to confirm</h2>
        <p className="muted small">Call the patient, then confirm or cancel.</p>
        <AppointmentTable rows={pending} showDate onOpen={setOpen} empty="Nothing waiting. 🎉" />
      </section>

      {open && (
        <AppointmentModal appt={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />
      )}
    </>
  );
}

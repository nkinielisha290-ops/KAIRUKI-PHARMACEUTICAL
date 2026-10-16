import { useEffect, useState } from 'react';
import { addDays, clinicToday, hhmm, money, workDays } from '../lib';
import { db } from '../supabase';

const EMPTY = {
  serviceId: '', doctorId: '', date: '', time: '',
  name: '', phone: '', email: '', gender: '', birthDate: '', reason: '',
};

// Used by the public booking page and by staff for phone and walk-in bookings.
export default function BookingForm({ staff = false, onBooked }) {
  const today = clinicToday();
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({ ...EMPTY, date: today });
  const [slots, setSlots] = useState(null); // null: pick a doctor first, 'loading', or a list
  const [reloadSlots, setReloadSlots] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      db.from('clinic_services').select('id, name, fee').eq('active', true).order('name'),
      db.from('doctors').select('id, name, specialty, work_days, start_time, end_time')
        .eq('active', true).order('name'),
    ]).then(([s, d]) => {
      if (s.error || d.error) setError((s.error || d.error).message);
      setServices(s.data || []);
      setDoctors(d.data || []);
    });
  }, []);

  useEffect(() => {
    if (!form.doctorId || !form.date) {
      setSlots(null);
      return;
    }
    let cancelled = false;
    setSlots('loading');
    db.rpc('available_slots', { p_doctor: form.doctorId, p_date: form.date }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) setError(error.message);
      setSlots(error ? [] : data.map((r) => r.slot));
    });
    return () => { cancelled = true; };
  }, [form.doctorId, form.date, reloadSlots]);

  const set = (key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, [key]: value, ...(key === 'doctorId' || key === 'date' ? { time: '' } : {}) }));
  };

  async function submit(e) {
    e.preventDefault();
    if (!form.time) {
      setError('Please choose a time.');
      return;
    }
    setBusy(true);
    setError('');
    const { data, error } = await db.rpc('book_appointment', {
      p_doctor: form.doctorId,
      p_service: form.serviceId || null,
      p_date: form.date,
      p_time: form.time,
      p_name: form.name,
      p_phone: form.phone,
      p_email: form.email || null,
      p_gender: form.gender || null,
      p_birth_date: form.birthDate || null,
      p_reason: form.reason || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      if (error.message.includes('no longer available')) {
        setForm((f) => ({ ...f, time: '' }));
        setReloadSlots((n) => n + 1);
      }
      return;
    }
    onBooked?.(data);
  }

  const doctor = doctors.find((d) => d.id === form.doctorId);

  return (
    <form className="booking-form" onSubmit={submit}>
      <fieldset>
        <legend><span className="step">1</span> Service and doctor</legend>
        <div className="grid-2">
          <label>
            Service
            <select value={form.serviceId} onChange={set('serviceId')} required>
              <option value="">Choose a service…</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.name} · {money(s.fee)}</option>
              ))}
            </select>
          </label>
          <label>
            Doctor
            <select value={form.doctorId} onChange={set('doctorId')} required>
              <option value="">Choose a doctor…</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>{d.name} ({d.specialty})</option>
              ))}
            </select>
          </label>
        </div>
        {doctor && (
          <p className="hint">
            Available {workDays(doctor.work_days)}, {hhmm(doctor.start_time)}–{hhmm(doctor.end_time)}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend><span className="step">2</span> Date and time</legend>
        <label className="date-field">
          Date
          <input type="date" value={form.date} min={today} max={addDays(today, 90)}
            onChange={set('date')} required />
        </label>
        <div className="slots" role="radiogroup" aria-label="Available times">
          {slots === null && <p className="muted">Choose a doctor to see free times.</p>}
          {slots === 'loading' && <p className="muted">Loading times…</p>}
          {Array.isArray(slots) && slots.length === 0 && (
            <p className="muted">No free times on this day. Try another date.</p>
          )}
          {Array.isArray(slots) && slots.map((t) => (
            <button key={t} type="button" role="radio" aria-checked={form.time === t}
              className={'slot' + (form.time === t ? ' selected' : '')}
              onClick={() => setForm((f) => ({ ...f, time: t }))}>
              {hhmm(t)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend><span className="step">3</span> Patient details</legend>
        <div className="grid-2">
          <label>
            Full name
            <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={120} />
          </label>
          <label>
            Phone number
            <input type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel"
              placeholder="07XX XXX XXX" required />
          </label>
          <label>
            <span>Email <span className="optional">(optional)</span></span>
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" />
          </label>
          <label>
            <span>Gender <span className="optional">(optional)</span></span>
            <select value={form.gender} onChange={set('gender')}>
              <option value="">—</option>
              <option>Female</option>
              <option>Male</option>
            </select>
          </label>
          <label>
            <span>Date of birth <span className="optional">(optional)</span></span>
            <input type="date" value={form.birthDate} max={today} onChange={set('birthDate')} />
          </label>
        </div>
        <label>
          <span>Reason for visit <span className="optional">(optional)</span></span>
          <textarea rows={3} value={form.reason} onChange={set('reason')} maxLength={1000}
            placeholder="Briefly describe the symptoms or reason" />
        </label>
      </fieldset>

      {error && <p className="msg error" role="alert">{error}</p>}
      <button className="btn primary block" disabled={busy}>
        {busy ? 'Booking…' : staff ? 'Book and confirm' : 'Book appointment'}
      </button>
    </form>
  );
}

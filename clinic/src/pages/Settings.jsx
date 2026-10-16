import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import Modal from '../components/Modal';
import { DAYS, hhmm, money, workDays } from '../lib';
import { db } from '../supabase';

const NEW_DOCTOR = {
  name: '', specialty: 'General', work_days: [1, 2, 3, 4, 5],
  start_time: '08:00', end_time: '17:00', slot_minutes: 30, active: true,
};
const NEW_SERVICE = { name: '', fee: 0, active: true };

export default function Settings() {
  const { role } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [editDoctor, setEditDoctor] = useState(null);
  const [editService, setEditService] = useState(null);

  const load = useCallback(async () => {
    const [d, s] = await Promise.all([
      db.from('doctors').select('*').order('name'),
      db.from('clinic_services').select('*').order('name'),
    ]);
    setError((d.error || s.error)?.message ?? '');
    setDoctors(d.data || []);
    setServices(s.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (role !== 'admin') return <Navigate to="/staff" replace />;

  const saved = () => { setEditDoctor(null); setEditService(null); load(); };

  return (
    <>
      <div className="page-head"><h1>Doctors &amp; services</h1></div>
      {error && <p className="msg error">{error}</p>}

      <section className="card">
        <div className="section-head">
          <h2>Doctors</h2>
          <button className="btn primary small" onClick={() => setEditDoctor(NEW_DOCTOR)}>+ Add doctor</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Specialty</th><th className="hide-sm">Days</th><th className="hide-sm">Hours</th><th>Status</th></tr></thead>
            <tbody>
              {doctors.map((d) => (
                <tr key={d.id} className="clickable" tabIndex={0} onClick={() => setEditDoctor(d)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditDoctor(d)}>
                  <td><strong>{d.name}</strong></td>
                  <td>{d.specialty}</td>
                  <td className="hide-sm">{workDays(d.work_days)}</td>
                  <td className="hide-sm">{hhmm(d.start_time)}–{hhmm(d.end_time)} · {d.slot_minutes} min</td>
                  <td>{d.active ? <span className="badge status-confirmed">Active</span> : <span className="badge status-cancelled">Inactive</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-head">
          <h2>Services</h2>
          <button className="btn primary small" onClick={() => setEditService(NEW_SERVICE)}>+ Add service</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Service</th><th>Fee</th><th>Status</th></tr></thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="clickable" tabIndex={0} onClick={() => setEditService(s)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditService(s)}>
                  <td><strong>{s.name}</strong></td>
                  <td>{money(s.fee)}</td>
                  <td>{s.active ? <span className="badge status-confirmed">Active</span> : <span className="badge status-cancelled">Inactive</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Staff accounts are shared with the pharmacy POS. Manage them on its Staff page.</p>
      </section>

      {editDoctor && <DoctorModal doctor={editDoctor} onClose={() => setEditDoctor(null)} onSaved={saved} />}
      {editService && <ServiceModal service={editService} onClose={() => setEditService(null)} onSaved={saved} />}
    </>
  );
}

function useSaver(table, id, onSaved) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(op) {
    setBusy(true);
    setError('');
    const { error } = await op(db.from(table));
    setBusy(false);
    if (error) {
      setError({
        23503: 'This record is used by existing appointments. Mark it inactive instead.',
        23505: 'That name is already in use.',
        23514: 'Please check the values. The end time must be after the start time.',
      }[error.code] ?? error.message);
    }
    else onSaved();
  }
  return {
    error, busy,
    save: (values) => run((t) => (id ? t.update(values).eq('id', id) : t.insert(values))),
    remove: () => window.confirm('Delete permanently?') && run((t) => t.delete().eq('id', id)),
  };
}

function DoctorModal({ doctor, onClose, onSaved }) {
  const [form, setForm] = useState({
    ...doctor, start_time: hhmm(doctor.start_time), end_time: hhmm(doctor.end_time),
  });
  const { error, busy, save, remove } = useSaver('doctors', doctor.id, onSaved);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const toggleDay = (d) => setForm((f) => ({
    ...f, work_days: f.work_days.includes(d) ? f.work_days.filter((x) => x !== d) : [...f.work_days, d],
  }));

  return (
    <Modal title={doctor.id ? 'Edit doctor' : 'Add doctor'} onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault();
        save({
          name: form.name.trim(), specialty: form.specialty.trim() || 'General', work_days: form.work_days,
          start_time: form.start_time, end_time: form.end_time,
          slot_minutes: Number(form.slot_minutes), active: form.active,
        });
      }}>
        <label>Name<input value={form.name} onChange={set('name')} required placeholder="Dr. …" /></label>
        <label>Specialty<input value={form.specialty} onChange={set('specialty')} /></label>
        <fieldset className="days">
          <legend>Working days</legend>
          {DAYS.map((label, d) => (
            <label key={d} className="check">
              <input type="checkbox" checked={form.work_days.includes(d)} onChange={() => toggleDay(d)} /> {label}
            </label>
          ))}
        </fieldset>
        <div className="grid-3">
          <label>Starts<input type="time" value={form.start_time} onChange={set('start_time')} required /></label>
          <label>Ends<input type="time" value={form.end_time} onChange={set('end_time')} required /></label>
          <label>Slot (min)<input type="number" min={5} max={240} step={5} value={form.slot_minutes} onChange={set('slot_minutes')} required /></label>
        </div>
        <label className="check"><input type="checkbox" checked={form.active} onChange={set('active')} /> Accepting bookings</label>
        {error && <p className="msg error" role="alert">{error}</p>}
        <div className="modal-actions">
          {doctor.id && <button type="button" className="btn danger" disabled={busy} onClick={remove}>Delete</button>}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

function ServiceModal({ service, onClose, onSaved }) {
  const [form, setForm] = useState(service);
  const { error, busy, save, remove } = useSaver('clinic_services', service.id, onSaved);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <Modal title={service.id ? 'Edit service' : 'Add service'} onClose={onClose}>
      <form onSubmit={(e) => {
        e.preventDefault();
        save({ name: form.name.trim(), fee: Number(form.fee), active: form.active });
      }}>
        <label>Name<input value={form.name} onChange={set('name')} required /></label>
        <label>Fee (TZS)<input type="number" min={0} step={500} value={form.fee} onChange={set('fee')} required /></label>
        <label className="check"><input type="checkbox" checked={form.active} onChange={set('active')} /> Shown on booking form</label>
        {error && <p className="msg error" role="alert">{error}</p>}
        <div className="modal-actions">
          {service.id && <button type="button" className="btn danger" disabled={busy} onClick={remove}>Delete</button>}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

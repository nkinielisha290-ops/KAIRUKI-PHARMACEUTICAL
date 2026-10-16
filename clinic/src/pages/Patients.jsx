import { useEffect, useState } from 'react';
import AppointmentModal from '../components/AppointmentModal';
import AppointmentTable from '../components/AppointmentTable';
import Modal from '../components/Modal';
import { age, APPT_SELECT } from '../lib';
import { db } from '../supabase';

export default function Patients() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    // Characters that would break PostgREST's or() filter syntax are dropped.
    const term = search.trim().replace(/[,()*%\\]/g, '');
    const timer = setTimeout(async () => {
      let q = db.from('patients').select('*').order('created_at', { ascending: false }).limit(100);
      if (term) q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`);
      const { data, error } = await q;
      setError(error ? error.message : '');
      setRows(data || []);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, reload]);

  return (
    <>
      <div className="page-head">
        <h1>Patients</h1>
      </div>
      <div className="filters card">
        <input type="search" placeholder="Search by name or phone" value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>
      {error && <p className="msg error">{error}</p>}
      <section className="card">
        {rows.length === 0 ? <p className="empty">No patients found.</p> : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Name</th><th>Phone</th><th className="hide-sm">Gender</th><th className="hide-sm">Age</th><th className="hide-sm">Registered</th></tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="clickable" tabIndex={0} onClick={() => setOpen(p)}
                    onKeyDown={(e) => e.key === 'Enter' && setOpen(p)}>
                    <td><strong>{p.full_name}</strong></td>
                    <td>{p.phone}</td>
                    <td className="hide-sm">{p.gender ?? '—'}</td>
                    <td className="hide-sm">{age(p.birth_date) ?? '—'}</td>
                    <td className="hide-sm">{new Date(p.created_at).toLocaleDateString('en-GB')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && (
        <PatientModal patient={open} onClose={() => setOpen(null)}
          onSaved={() => { setOpen(null); setReload((n) => n + 1); }} />
      )}
    </>
  );
}

function PatientModal({ patient, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: patient.full_name, phone: patient.phone, email: patient.email ?? '',
    gender: patient.gender ?? '', birth_date: patient.birth_date ?? '', notes: patient.notes ?? '',
  });
  const [history, setHistory] = useState([]);
  const [appt, setAppt] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    db.from('appointments').select(APPT_SELECT).eq('patient_id', patient.id)
      .order('appt_date', { ascending: false }).order('start_time', { ascending: false })
      .then(({ data }) => setHistory(data || []));
  }, [patient.id, reload]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await db.from('patients').update({
      full_name: form.full_name.trim(),
      phone: form.phone.replace(/[\s()-]/g, ''),
      email: form.email.trim() || null,
      gender: form.gender || null,
      birth_date: form.birth_date || null,
      notes: form.notes.trim() || null,
    }).eq('id', patient.id);
    setBusy(false);
    if (error) {
      setError(error.code === '23505' ? 'Another patient already uses this phone number.' : error.message);
      return;
    }
    onSaved();
  }

  if (appt) {
    return <AppointmentModal appt={appt} onClose={() => setAppt(null)}
      onSaved={() => { setAppt(null); setReload((n) => n + 1); }} />;
  }

  return (
    <Modal title={patient.full_name} wide onClose={onClose}>
      <form onSubmit={save}>
        <div className="grid-2">
          <label>Full name<input value={form.full_name} onChange={set('full_name')} required /></label>
          <label>Phone<input type="tel" value={form.phone} onChange={set('phone')} required /></label>
          <label>Email<input type="email" value={form.email} onChange={set('email')} /></label>
          <label>
            Gender
            <select value={form.gender} onChange={set('gender')}>
              <option value="">—</option><option>Female</option><option>Male</option>
            </select>
          </label>
          <label>Date of birth<input type="date" value={form.birth_date} onChange={set('birth_date')} /></label>
        </div>
        <label>
          Medical notes
          <textarea rows={4} value={form.notes} onChange={set('notes')}
            placeholder="Allergies, chronic conditions, previous treatment…" />
        </label>
        {error && <p className="msg error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" disabled={busy}>Save patient</button>
        </div>
      </form>
      <h3>Visit history</h3>
      <AppointmentTable rows={history} showDate onOpen={setAppt} empty="No appointments yet." />
    </Modal>
  );
}

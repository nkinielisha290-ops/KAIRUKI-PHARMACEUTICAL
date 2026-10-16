import { useCallback, useEffect, useState } from 'react';
import AppointmentModal from '../components/AppointmentModal';
import AppointmentTable from '../components/AppointmentTable';
import BookingForm from '../components/BookingForm';
import Modal from '../components/Modal';
import { addDays, APPT_SELECT, clinicToday, STATUSES, STATUS_LABEL } from '../lib';
import { db } from '../supabase';

export default function Appointments() {
  const [date, setDate] = useState(clinicToday());
  const [doctorId, setDoctorId] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    db.from('doctors').select('id, name').order('name').then(({ data }) => setDoctors(data || []));
  }, []);

  const load = useCallback(async () => {
    let q = db.from('appointments').select(APPT_SELECT).eq('appt_date', date).order('start_time');
    if (doctorId) q = q.eq('doctor_id', doctorId);
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    setError(error ? error.message : '');
    setRows(data || []);
  }, [date, doctorId, status]);

  useEffect(() => { load(); }, [load]);

  const term = search.trim().toLowerCase();
  const shown = term
    ? rows.filter((a) => [a.ref_no, a.patient?.full_name, a.patient?.phone]
      .some((v) => v?.toLowerCase().includes(term)))
    : rows;

  return (
    <>
      <div className="page-head">
        <h1>Appointments</h1>
        <button className="btn primary" onClick={() => setCreating(true)}>+ New appointment</button>
      </div>

      <div className="filters card">
        <div className="date-nav">
          <button className="btn small" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button className="btn small" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
          <button className="btn small" onClick={() => setDate(clinicToday())}>Today</button>
        </div>
        <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} aria-label="Doctor">
          <option value="">All doctors</option>
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <input type="search" placeholder="Search name, phone or ref" value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error && <p className="msg error">{error}</p>}
      <section className="card">
        <p className="muted small">{shown.length} appointment{shown.length === 1 ? '' : 's'}</p>
        <AppointmentTable rows={shown} onOpen={setOpen} empty="No appointments for this day." />
      </section>

      {open && (
        <AppointmentModal appt={open} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />
      )}
      {creating && (
        <Modal title="New appointment" wide onClose={() => setCreating(false)}>
          <BookingForm staff onBooked={(b) => {
            setCreating(false);
            if (b.appt_date === date) load(); else setDate(b.appt_date);
          }} />
        </Modal>
      )}
    </>
  );
}

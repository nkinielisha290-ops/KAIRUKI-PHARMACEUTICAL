import { useState } from 'react';
import { hhmm, longDate, money, STATUSES, STATUS_LABEL } from '../lib';
import { db } from '../supabase';
import Modal from './Modal';
import StatusBadge from './StatusBadge';

export default function AppointmentModal({ appt, onClose, onSaved }) {
  const [status, setStatus] = useState(appt.status);
  const [notes, setNotes] = useState(appt.notes ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(nextStatus = status) {
    setBusy(true);
    setError('');
    const { error } = await db.from('appointments')
      .update({ status: nextStatus, notes: notes.trim() || null }).eq('id', appt.id);
    setBusy(false);
    if (error) {
      setError(error.message.includes('appointments_slot_uniq')
        ? 'Another appointment already holds this time slot.' : error.message);
      return;
    }
    onSaved();
  }

  return (
    <Modal title={`Appointment ${appt.ref_no}`} onClose={onClose}>
      <dl className="details">
        <dt>Patient</dt>
        <dd>{appt.patient?.full_name} · <a href={`tel:${appt.patient?.phone}`}>{appt.patient?.phone}</a></dd>
        <dt>When</dt>
        <dd>{longDate(appt.appt_date)} at {hhmm(appt.start_time)}</dd>
        <dt>Doctor</dt>
        <dd>{appt.doctor?.name} ({appt.doctor?.specialty})</dd>
        <dt>Service</dt>
        <dd>{appt.service ? `${appt.service.name} · ${money(appt.service.fee)}` : '—'}</dd>
        <dt>Reason</dt>
        <dd>{appt.reason || '—'}</dd>
        <dt>Booked</dt>
        <dd>{appt.source === 'online' ? 'Online' : 'By staff'}, {new Date(appt.created_at).toLocaleString('en-GB')}</dd>
        <dt>Status</dt>
        <dd><StatusBadge status={appt.status} /></dd>
      </dl>

      <div className="quick-actions">
        {appt.status === 'pending' && (
          <button className="btn primary" disabled={busy} onClick={() => save('confirmed')}>Confirm</button>
        )}
        {['pending', 'confirmed'].includes(appt.status) && (
          <>
            <button className="btn" disabled={busy} onClick={() => save('completed')}>Mark completed</button>
            <button className="btn" disabled={busy} onClick={() => save('no_show')}>No-show</button>
            <button className="btn danger" disabled={busy} onClick={() => save('cancelled')}>Cancel</button>
          </>
        )}
      </div>

      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </label>
      <label>
        Notes
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {error && <p className="msg error" role="alert">{error}</p>}
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn primary" disabled={busy} onClick={() => save()}>Save</button>
      </div>
    </Modal>
  );
}

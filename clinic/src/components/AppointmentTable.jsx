import { hhmm, longDate } from '../lib';
import StatusBadge from './StatusBadge';

export default function AppointmentTable({ rows, showDate = false, onOpen, empty = 'No appointments.' }) {
  if (!rows.length) return <p className="empty">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {showDate && <th>Date</th>}
            <th>Time</th>
            <th>Patient</th>
            <th>Doctor</th>
            <th className="hide-sm">Service</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="clickable" onClick={() => onOpen(a)} tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(a)}>
              {showDate && <td>{longDate(a.appt_date)}</td>}
              <td className="nowrap"><strong>{hhmm(a.start_time)}</strong></td>
              <td>
                {a.patient?.full_name}
                <div className="sub">{a.patient?.phone} · {a.ref_no}</div>
              </td>
              <td>{a.doctor?.name}</td>
              <td className="hide-sm">{a.service?.name ?? '—'}</td>
              <td><StatusBadge status={a.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

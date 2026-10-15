import { Link, Navigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import { db } from '../supabase';

export function Brand() {
  return (
    <span className="brand">
      <img src="/favicon.svg" alt="" width="28" height="28" />
      Kairuki Clinic
    </span>
  );
}

export function NotStaff({ email }) {
  return (
    <div className="center-screen">
      <div className="card narrow">
        <Brand />
        <h1>No access</h1>
        <p>{email} is not on the staff list. Ask an admin to add you, then sign in again.</p>
        <button className="btn" onClick={() => db.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
}

export default function StaffLayout() {
  const { loading, user, role } = useAuth();
  if (loading) return <div className="center-screen muted">Loading…</div>;
  if (!user) return <Navigate to="/staff/login" replace />;
  if (!role) return <NotStaff email={user.email} />;

  return (
    <div className="staff">
      <header className="topbar">
        <Brand />
        <nav>
          <NavLink to="/staff" end>Dashboard</NavLink>
          <NavLink to="/staff/appointments">Appointments</NavLink>
          <NavLink to="/staff/patients">Patients</NavLink>
          {role === 'admin' && <NavLink to="/staff/settings">Doctors &amp; services</NavLink>}
        </nav>
        <div className="user">
          <Link to="/" className="muted">Booking page</Link>
          <span className="who" title={user.email}>{user.email} · {role}</span>
          <button className="btn small" onClick={() => db.auth.signOut()}>Sign out</button>
        </div>
      </header>
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}

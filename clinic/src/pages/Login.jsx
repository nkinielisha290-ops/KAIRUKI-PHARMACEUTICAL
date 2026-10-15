import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { Brand, NotStaff } from '../components/StaffLayout';
import { db } from '../supabase';

export default function Login() {
  const { loading, user, role } = useAuth();
  const [signUp, setSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState({ text: '', kind: '' });
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="center-screen muted">Loading…</div>;
  if (user && role) return <Navigate to="/staff" replace />;
  if (user) return <NotStaff email={user.email} />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg({ text: '', kind: '' });
    try {
      if (signUp) {
        const { data, error } = await db.auth.signUp({
          email, password, options: { emailRedirectTo: location.origin + '/staff' },
        });
        if (error) throw error;
        if (!data.session) setMsg({ text: 'Check your email to confirm your account, then sign in.', kind: 'ok' });
      } else {
        const { error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setMsg({ text: err.message, kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card narrow" onSubmit={submit}>
        <Brand />
        <h1>{signUp ? 'Create staff account' : 'Staff sign in'}</h1>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6}
            autoComplete={signUp ? 'new-password' : 'current-password'} required />
        </label>
        {msg.text && <p className={'msg ' + msg.kind} role="alert">{msg.text}</p>}
        <button className="btn primary block" disabled={busy}>{signUp ? 'Create account' : 'Sign in'}</button>
        <p className="muted small">
          {signUp ? 'Already have an account? ' : 'New staff member? '}
          <button type="button" className="link" onClick={() => { setSignUp(!signUp); setMsg({ text: '', kind: '' }); }}>
            {signUp ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </form>
    </div>
  );
}

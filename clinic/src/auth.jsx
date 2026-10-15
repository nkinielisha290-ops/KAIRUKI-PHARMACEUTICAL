import { createContext, useContext, useEffect, useState } from 'react';
import { db } from './supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, role: null });

  useEffect(() => {
    let active = true;
    async function load(session) {
      const user = session?.user ?? null;
      let role = null;
      if (user) {
        const { data } = await db.from('staff').select('role')
          .eq('email', user.email.toLowerCase()).maybeSingle();
        role = data?.role ?? null;
      }
      if (active) setState({ loading: false, user, role });
    }
    // Defer the query: Supabase must not be called from inside the auth callback itself.
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session), 0);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

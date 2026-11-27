import { useEffect, useState } from 'react';
import Dashboard from './dashboard/Dashboard';
import { parseRoute } from './dashboard/state';
import { ForgotPassword, Login, Register } from './landing/Auth';
import Landing from './landing/Landing';
import Team from './landing/Team';

export default function App() {
  const [route, setRoute] = useState(window.location.hash);
  useEffect(() => {
    const change = () => {
      setRoute(window.location.hash);
      if (window.location.hash.startsWith('#/')) window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  if (route.startsWith('#/dashboard')) return <Dashboard page={parseRoute(route).page} />;
  if (route.startsWith('#/login')) return <Login />;
  if (route.startsWith('#/register')) return <Register />;
  if (route.startsWith('#/forgot-password')) return <ForgotPassword />;
  if (route.startsWith('#/team')) return <Team />;
  return <Landing />;
}

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, Building2, Check, Eye, EyeOff, LoaderCircle, Mail, User } from 'lucide-react';
import { Site } from './Site';

/*
 * Login / register / forgot-password screens.
 * Placeholder only: no authentication or storage is connected yet.
 * Login accepts any input and goes straight to the dashboard.
 */

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <Site showDashboard={false}>
      {() => (
        <section className="lp-page lp-auth">
          <div className="lp-auth-card">
            <h1>{title}</h1>
            <p className="lp-auth-sub">{subtitle}</p>
            {children}
          </div>
        </section>
      )}
    </Site>
  );
}

function Field({
  label,
  type = 'text',
  name,
  autoComplete,
}: {
  label: string;
  type?: string;
  name: string;
  autoComplete: string;
}) {
  return (
    <label className="lp-field">
      <span>{label}</span>
      <input type={type} name={name} autoComplete={autoComplete} required />
    </label>
  );
}

export function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(navTimer.current), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;

    const trimmedUser = username.trim();
    if (!trimmedUser && !password) {
      setError('Please enter your username or email and password.');
      return;
    }
    if (!trimmedUser) {
      setError('Username or email is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }

    setError('');
    setLoading(true);
    const startedAt = performance.now();
    // Existing placeholder auth completes immediately; keep the authenticating state visible for ~1.4s total.
    const remaining = Math.max(0, 1400 - (performance.now() - startedAt));
    navTimer.current = window.setTimeout(() => {
      window.location.hash = '#/dashboard';
    }, remaining);
  };

  return (
    <AuthCard title="Login" subtitle="Sign in to open the dashboard.">
      <form className="lp-form" onSubmit={submit} noValidate>
        {error && (
          <div className="lp-auth-error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        <label className="lp-field">
          <span>Username or email</span>
          <div className="lp-input-wrap has-leading">
            <User size={16} className="lp-input-icon" aria-hidden="true" />
            <input
              type="text"
              name="username"
              autoComplete="username"
              placeholder="e.g. researcher@example.com"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
              }}
              aria-invalid={!!error && !username.trim()}
              required
            />
          </div>
        </label>
        <label className="lp-field">
          <span>Password</span>
          <div className="lp-input-wrap has-trailing">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              aria-invalid={!!error && !password}
              required
            />
            <button
              type="button"
              className="lp-pwd-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
        <div className="lp-form-row">
          <a className="lp-link" href="#/forgot-password">
            Forgot password?
          </a>
        </div>
        <button className="lp-btn lp-btn-primary lp-btn-block lp-auth-submit" type="submit" disabled={loading}>
          {loading ? (
            <>
              <LoaderCircle size={16} className="lp-spin" aria-hidden="true" />
              Authenticating...
            </>
          ) : (
            'Login'
          )}
        </button>
      </form>
      <p className="lp-auth-alt">
        New user? <a href="#/register">Register</a>
      </p>
    </AuthCard>
  );
}

export function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [organisation, setOrganisation] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registeredName, setRegisteredName] = useState('');
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (loading || registeredName) return;

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedOrg = organisation.trim();

    if (!trimmedName && !trimmedEmail && !trimmedOrg && !password && !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!trimmedName) {
      setError('Full name is required.');
      return;
    }
    if (!trimmedEmail) {
      setError('Email is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!trimmedOrg) {
      setError('Organisation is required.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!confirmPassword) {
      setError('Please confirm your password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);
    // Existing placeholder registration completes immediately; show brief loading, then success confirmation before redirecting to login.
    timers.current.push(
      window.setTimeout(() => {
        setLoading(false);
        setRegisteredName(trimmedName);
        timers.current.push(
          window.setTimeout(() => {
            window.location.hash = '#/login';
          }, 1600),
        );
      }, 600),
    );
  };

  return (
    <AuthCard title="Register" subtitle="Create an account to use the dashboard.">
      {registeredName ? (
        <div className="lp-auth-success" role="status" aria-live="polite">
          <div className="lp-success-badge" aria-hidden="true">
            <Check size={24} strokeWidth={2.5} />
          </div>
          <h2>Welcome, {registeredName}!</h2>
          <p>Your account has been created successfully. Redirecting to login…</p>
        </div>
      ) : (
        <form className="lp-form" onSubmit={submit} noValidate>
          {error && (
            <div className="lp-auth-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          <label className="lp-field">
            <span>Full name</span>
            <div className="lp-input-wrap has-leading">
              <User size={16} className="lp-input-icon" aria-hidden="true" />
              <input
                type="text"
                name="name"
                autoComplete="name"
                placeholder="e.g. Anish Sharma"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (error) setError('');
                }}
                aria-invalid={!!error && !fullName.trim()}
                required
              />
            </div>
          </label>
          <label className="lp-field">
            <span>Email</span>
            <div className="lp-input-wrap has-leading">
              <Mail size={16} className="lp-input-icon" aria-hidden="true" />
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="e.g. anish@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                aria-invalid={!!error && (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))}
                required
              />
            </div>
          </label>
          <label className="lp-field">
            <span>Organisation</span>
            <div className="lp-input-wrap has-leading">
              <Building2 size={16} className="lp-input-icon" aria-hidden="true" />
              <input
                type="text"
                name="organisation"
                autoComplete="organization"
                placeholder="e.g. KJ Somaiya Institute of Technology"
                value={organisation}
                onChange={(e) => {
                  setOrganisation(e.target.value);
                  if (error) setError('');
                }}
                aria-invalid={!!error && !organisation.trim()}
                required
              />
            </div>
          </label>
          <label className="lp-field">
            <span>Password</span>
            <div className="lp-input-wrap has-trailing">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                placeholder="Create your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                aria-invalid={!!error && (!password || password.length < 6)}
                required
              />
              <button
                type="button"
                className="lp-pwd-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <label className="lp-field">
            <span>Confirm password</span>
            <div className="lp-input-wrap has-trailing">
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirm"
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (error) setError('');
                }}
                aria-invalid={!!error && (!confirmPassword || password !== confirmPassword)}
                required
              />
              <button
                type="button"
                className="lp-pwd-toggle"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                aria-pressed={showConfirm}
                title={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <button className="lp-btn lp-btn-primary lp-btn-block lp-auth-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <LoaderCircle size={16} className="lp-spin" aria-hidden="true" />
                Creating account...
              </>
            ) : (
              'Register'
            )}
          </button>
        </form>
      )}
      <p className="lp-auth-alt">
        Already registered? <a href="#/login">Login</a>
      </p>
    </AuthCard>
  );
}

export function ForgotPassword() {
  const [sent, setSent] = useState(false);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSent(true);
  };
  return (
    <AuthCard title="Forgot password" subtitle="Enter your registered email to reset your password.">
      {sent ? (
        <p className="lp-auth-note" role="status">
          Password reset is not connected yet. Please contact the administrator.
        </p>
      ) : (
        <form className="lp-form" onSubmit={submit}>
          <Field label="Email" type="email" name="email" autoComplete="email" />
          <button className="lp-btn lp-btn-primary lp-btn-block" type="submit">
            Send reset link
          </button>
        </form>
      )}
      <p className="lp-auth-alt">
        <a href="#/login">Back to login</a>
      </p>
    </AuthCard>
  );
}

import { useState, type FormEvent, type ReactNode } from 'react';
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
  const submit = (e: FormEvent) => {
    e.preventDefault();
    window.location.hash = '#/dashboard';
  };
  return (
    <AuthCard title="Login" subtitle="Sign in to open the dashboard.">
      <form className="lp-form" onSubmit={submit}>
        <Field label="Username or email" name="username" autoComplete="username" />
        <Field label="Password" type="password" name="password" autoComplete="current-password" />
        <div className="lp-form-row">
          <a className="lp-link" href="#/forgot-password">
            Forgot password?
          </a>
        </div>
        <button className="lp-btn lp-btn-primary lp-btn-block" type="submit">
          Login
        </button>
      </form>
      <p className="lp-auth-alt">
        New user? <a href="#/register">Register</a>
      </p>
    </AuthCard>
  );
}

export function Register() {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    window.location.hash = '#/login';
  };
  return (
    <AuthCard title="Register" subtitle="Create an account to use the dashboard.">
      <form className="lp-form" onSubmit={submit}>
        <Field label="Full name" name="name" autoComplete="name" />
        <Field label="Email" type="email" name="email" autoComplete="email" />
        <Field label="Organisation" name="organisation" autoComplete="organization" />
        <Field label="Password" type="password" name="password" autoComplete="new-password" />
        <Field label="Confirm password" type="password" name="confirm" autoComplete="new-password" />
        <button className="lp-btn lp-btn-primary lp-btn-block" type="submit">
          Register
        </button>
      </form>
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

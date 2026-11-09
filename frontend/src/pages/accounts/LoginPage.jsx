/** Present a controlled browser-local demo account workflow. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PublicNavbar } from '../../components/PublicNavbar.jsx';
import { DemoWarning } from '../../components/DemoWarning.jsx';
import { FormField } from '../../components/FormField.jsx';
import { loginAccount } from '../../utils/accounts.js';

/** Keep inputs on failure and navigate only after all required writes succeed. */
export default function LoginPage() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  /** Validate current input against freshly read persistence on explicit submit. */
  function submit(event) {
    event.preventDefault();
    const result = loginAccount(form);
    setErrors(result.errors ?? {});
    setMessage(result.message ?? '');
    if (result.ok) navigate(result.destination, { replace: true });
  }

  /** Preserve controlled values and stable field identity between keystrokes. */
  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  return (
    <>
      <PublicNavbar />
      <main className="mx-auto max-w-lg px-6 py-16">
        <h1 className="font-display text-4xl">Log in to WriteSpace</h1>
        <p className="mt-4 text-foreground-muted">Welcome back to your browser-local writing space.</p>
        <form noValidate onSubmit={submit} className="mt-8 space-y-6">
          <FormField
            id="username"
            name="username"
            label="Username"
            type="text"
            autoComplete="username"
            value={form.username}
            onChange={change}
            error={errors.username}
          />
          <FormField
            id="password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={change}
            error={errors.password}
          />
          {message && (
            <p role="alert" className="text-sm text-error">
              {message}
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded-control bg-primary-600 px-5 py-3 font-medium text-surface
              hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Log in
          </button>
        </form>
        <p className="mt-6 text-sm text-foreground-muted">
          Fixed demo Admin: username admin, password admin.
        </p>
        <p className="mt-6 text-sm text-foreground-muted">
          New to WriteSpace?{' '}
          <Link to="/register" className="rounded-control underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">
            Register
          </Link>
        </p>
        <Link to="/" className="mt-6 inline-block rounded-control text-sm underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">
          Back to WriteSpace
        </Link>
        <div className="mt-12">
          <DemoWarning />
        </div>
      </main>
    </>
  );
}

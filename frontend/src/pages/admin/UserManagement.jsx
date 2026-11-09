/** Create demo accounts for either role while preserving all account-deletion gates. */
import { useState } from 'react';
import { Navbar } from '../../components/Navbar.jsx';
import { FormField } from '../../components/FormField.jsx';
import { UserRow } from '../../components/UserRow.jsx';
import { DemoWarning } from '../../components/DemoWarning.jsx';
import { getUsers } from '../../utils/storage.js';
import { getSession } from '../../utils/auth.js';
import { createAdminAccount } from '../../utils/admin.js';

const emptyForm = { displayName: '', username: '', password: '', confirmPassword: '', role: 'user' };
const fixedAdmin = { id: 'admin', displayName: 'Demo Admin', username: 'admin', role: 'admin' };

/** Keep inputs on any failure and refresh the account list only after a checked save. */
export default function UserManagement() {
  const [users, setUsers] = useState(getUsers);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState('');
  const session = getSession();

  /** Change only the selected controlled field. */
  function change(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  /** Submit explicitly; shared handler rechecks persisted Admin and latest uniqueness. */
  function submit(event) {
    event.preventDefault();
    setSuccess('');
    const result = createAdminAccount(form);
    setErrors(result.errors ?? {});
    setMessage(result.message ?? '');
    if (!result.ok) return;
    setUsers(getUsers());
    setSuccess('Account created. The new account can now log in.');
    setForm(emptyForm);
  }

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:z-30 focus:bg-surface focus:p-4">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="font-display text-4xl">User management</h1>
        <p className="mt-4 max-w-prose text-foreground-muted">
          Create a User or Admin for this browser only. Account deletion remains unavailable until post disposition is decided.
        </p>
        <div className="mt-10 grid gap-16 lg:grid-cols-2">
          <section aria-labelledby="create-account">
            <h2 id="create-account" className="font-display text-2xl">Create account</h2>
            <form onSubmit={submit} noValidate className="mt-6 space-y-5">
              <FormField id="displayName" name="displayName" label="Display name"
                value={form.displayName} onChange={change} error={errors.displayName} autoComplete="off" />
              <FormField id="username" name="username" label="Username"
                value={form.username} onChange={change} error={errors.username} autoComplete="off" />
              <FormField id="password" name="password" label="Password" type="password"
                value={form.password} onChange={change} error={errors.password} autoComplete="new-password" />
              <FormField id="confirmPassword" name="confirmPassword" label="Confirm password" type="password"
                value={form.confirmPassword} onChange={change} error={errors.confirmPassword} autoComplete="new-password" />
              <FormField id="role" name="role" label="Role" as="select"
                value={form.role} onChange={change} error={errors.role}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </FormField>
              {message && (
                <p role="alert" className="text-sm text-error">{message}</p>
              )}
              <p role="status" className="text-sm text-success">{success}</p>
              <button type="submit"
                className="rounded-control bg-primary-600 px-5 py-3 font-medium text-surface
                  hover:bg-primary-700 focus-visible:outline-none focus-visible:ring-2
                  focus-visible:ring-ring focus-visible:ring-offset-2">
                Create account
              </button>
            </form>
            <div className="mt-8">
              <DemoWarning />
            </div>
          </section>
          <section aria-labelledby="account-list">
            <h2 id="account-list" className="font-display text-2xl">Accounts</h2>
            {!users.length && (
              <p className="mt-4 text-foreground-muted">No stored accounts yet. The fixed Admin is always available.</p>
            )}
            <ul aria-label="Accounts" className="mt-4">
              <UserRow account={fixedAdmin} session={session} />
              {users.map((account) => (
                <UserRow key={account.id} account={account} session={session} />
              ))}
            </ul>
          </section>
        </div>
      </main>
    </>
  );
}

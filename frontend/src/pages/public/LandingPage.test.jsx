/** Exercise discovery through real routing, browser adapters and explicit user actions. */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import App from '../../App.jsx';
import LandingPage from './LandingPage.jsx';
import { PublicNavbar } from '../../components/PublicNavbar.jsx';
import { getSession, setSession } from '../../utils/auth.js';
import { getPosts, savePosts, saveUsers } from '../../utils/storage.js';

const session = { userId: 'admin', username: 'admin', displayName: 'Demo Admin', role: 'admin' };
const posts = [1, 4, 2, 3].map((day) => ({
  id: `53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1a${day}`, title: `Story ${day}`,
  content: day === 4 ? 'a'.repeat(121) : '<script>plain text</script>',
  createdAt: `2026-11-0${day}T08:00:00.000Z`, authorId: 'admin', authorName: 'Demo Admin',
}));

/** Mount the production route table at one initial entry. */
function mount(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

it('renders the hero, exactly three features, empty state, footer and full disclosure without writes', () => {
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  mount();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Room for your words.');
  const features = screen.getByRole('region', { name: 'Less noise. More story.' });
  expect(within(features).getAllByRole('article')).toHaveLength(3);
  expect(screen.getByText(/No stories yet/)).toBeInTheDocument();
  expect(screen.getByRole('contentinfo')).toHaveTextContent('local demo');
  const warning = screen.getByRole('complementary', { name: 'Demo limitations' });
  expect(warning).toHaveTextContent('plaintext in localStorage');
  expect(warning).toHaveTextContent('admin/admin');
  expect(warning).toHaveTextContent('Client-side guards are not security');
  expect(warning).toHaveTextContent('Do not use real credentials or sensitive information');
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(localStorage.length).toBe(0);
});

it('shows newest three posts with author, date, exact excerpt and text-safe content', () => {
  savePosts(posts);
  mount();
  const latest = screen.getByRole('region', { name: 'Latest stories' });
  expect(within(latest).getAllByRole('heading', { level: 3 }).map((node) => node.textContent)).toEqual(['Story 4', 'Story 3', 'Story 2']);
  expect(within(latest).getAllByRole('article')).toHaveLength(3);
  expect(screen.queryByText('Story 1')).not.toBeInTheDocument();
  expect(within(latest).getByText(`${'a'.repeat(120)}…`)).toBeInTheDocument();
  expect(within(latest).getAllByText('<script>plain text</script>')).toHaveLength(2);
  expect(within(latest).getByText(/Nov 4, 2026/)).toBeInTheDocument();
  expect(latest.querySelector('script')).toBeNull();
  expect(getPosts()).toEqual(posts);
});

it.each([0, 1, 2, 3])('renders exactly %s previews when fewer than four posts exist', (count) => {
  savePosts(posts.slice(0, count));
  mount();
  const latest = screen.getByRole('region', { name: 'Latest stories' });
  expect(within(latest).queryAllByRole('article')).toHaveLength(count);
});

it.each(['{', '{}', '[{"title":null}]'])('degrades corrupt posts %s to the empty state', (raw) => {
  localStorage.setItem('writespace_posts', raw);
  mount();
  expect(screen.getByText(/No stories yet/)).toBeInTheDocument();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});

it('fails closed to guest navigation and empty previews when reads are denied', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied'); });
  mount();
  expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
  expect(screen.getByText(/No stories yet/)).toBeInTheDocument();
});

it('uses guest login destinations for previews and all account entry links', async () => {
  savePosts(posts);
  const user = userEvent.setup();
  mount();
  expect(screen.getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/register');
  expect(screen.getByRole('link', { name: /Already have/ })).toHaveAttribute('href', '/login');
  expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/register');
  expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  await user.click(screen.getByRole('link', { name: 'Read Story 4' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
  expect(getSession()).toBeNull();
  await user.click(screen.getByRole('link', { name: 'Back to WriteSpace' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Room for your words.');
});

it.each(['user', 'admin'])('shows %s identity with correct signed-in preview and navigation links', (role) => {
  setSession({ ...session, role });
  savePosts(posts);
  mount();
  expect(screen.getByText('Demo Admin')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Explore blogs' })).toHaveAttribute('href', '/blogs');
  expect(screen.getByRole('link', { name: 'Read Story 4' })).toHaveAttribute('href', `/blog/${posts[1].id}`);
  expect(screen.queryByRole('link', { name: 'Get started' })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Admin dashboard' }) !== null).toBe(role === 'admin');
});

it('toggles mobile disclosure, closes on Escape and link navigation', async () => {
  const user = userEvent.setup();
  mount();
  const toggle = screen.getByRole('button', { name: 'Open navigation' });
  const nav = screen.getByRole('navigation');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(nav).toHaveClass('hidden');
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  expect(nav).toHaveClass('flex');
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle);
  screen.getByRole('link', { name: 'Log in' }).focus();
  await user.keyboard('{Escape}');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle);
  await user.click(screen.getByRole('link', { name: 'Log in' }));
  expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
});

it('clears only session on explicit logout and re-reads guest previews in the same landing', async () => {
  setSession(session);
  savePosts(posts);
  saveUsers([]);
  const user = userEvent.setup();
  mount();
  await user.click(screen.getByRole('button', { name: 'Log out' }));
  expect(getSession()).toBeNull();
  expect(getPosts()).toEqual(posts);
  expect(localStorage.getItem('writespace_users')).toBe('[]');
  expect(screen.getByRole('link', { name: 'Get started' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Read Story 4' })).toHaveAttribute('href', '/login');
});

it('keeps current session, open menu and route on failed logout; explicit retry succeeds', async () => {
  setSession(session);
  savePosts(posts);
  const user = userEvent.setup();
  mount('/missing');
  await user.click(screen.getByRole('button', { name: 'Open navigation' }));
  const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Denied'); });
  await user.click(screen.getByRole('button', { name: 'Log out' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save in this browser. Your changes have not been saved. You are still signed in.');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
  expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
  expect(getSession()).toEqual(session);
  expect(getPosts()).toEqual(posts);
  spy.mockRestore();
  await user.click(screen.getByRole('button', { name: 'Log out' }));
  expect(getSession()).toBeNull();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Room for your words.');
});

it('supports successful logout without an optional notification prop', async () => {
  setSession(session);
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <PublicNavbar />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: 'Log out' }));
  expect(getSession()).toBeNull();
});

it('re-reads current session and posts when the route view renders again', () => {
  const view = render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
  savePosts(posts.slice(0, 1));
  setSession(session);
  view.rerender(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Read Story 1' })).toHaveAttribute('href', `/blog/${posts[0].id}`);
  expect(screen.getByRole('link', { name: 'Explore blogs' })).toBeInTheDocument();
});

it('does not mutate persisted data during StrictMode mounting or unsupported route rendering', () => {
  setSession(session);
  savePosts(posts);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const remove = vi.spyOn(Storage.prototype, 'removeItem');
  render(
    <React.StrictMode>
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>
    </React.StrictMode>,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Page not found');
  expect(write).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(getSession()).toEqual(session);
  expect(getPosts()).toEqual(posts);
});

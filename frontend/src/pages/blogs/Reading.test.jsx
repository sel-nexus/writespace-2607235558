/** Exercise reading, cards and navigation using real adapters and route wiring. */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import App from '../../App.jsx';
import { BlogCard } from '../../components/BlogCard.jsx';
import { Navbar } from '../../components/Navbar.jsx';
import { Avatar } from '../../components/Avatar.jsx';
import { getPosts, savePosts } from '../../utils/storage.js';
import { setSession, getSession, clearSession } from '../../utils/auth.js';
import { SAVE_ERROR } from '../../utils/accounts.js';

const owner = { userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user' };
const post = {
  id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1aa', title: 'First story',
  content: '<script>window.bad = true</script>\n  Second line\n\nLast line',
  createdAt: '2026-11-01T08:00:00.000Z', authorId: 'writer', authorName: 'Writer' };
const other = { ...post, id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1ab', title: 'Newest story', content: 'a'.repeat(121), createdAt: '2026-11-02T08:00:00.000Z', authorId: 'other', authorName: 'Other writer' };

/** Mount the production route table at one direct initial entry. */
function mount(path = '/blogs') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

it.each(['/blogs', '/blog/' + post.id])('redirects guest direct entry %s to login without mutations', (path) => {
  savePosts([post]); mount(path);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Log in to WriteSpace');
  expect(getPosts()).toEqual([post]); expect(getSession()).toBeNull();
});
it.each(['user', 'admin'])('renders newest-first %s collection with exact previews, dates, role identity and links', (role) => {
  setSession({ ...owner, role }); savePosts([post, other]); mount();
  expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual(['Newest story', 'First story']);
  expect(screen.getByText('a'.repeat(120) + '…')).toBeInTheDocument();
  expect(screen.getByText(/Nov 2, 2026/)).toBeInTheDocument();
  expect(screen.getByRole('img', { name: role === 'admin' ? 'Admin avatar' : 'User avatar' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Read First story' })).toHaveAttribute('href', '/blog/' + post.id);
  expect(screen.getByRole('link', { name: 'Edit First story' })).toHaveAttribute('href', '/edit/' + post.id);
  expect(screen.queryByRole('button', { name: 'Delete Newest story' }) !== null).toBe(role === 'admin');
  expect(screen.queryByRole('link', { name: 'Admin dashboard' }) !== null).toBe(role === 'admin');
  expect(screen.queryByRole('link', { name: 'User management' }) !== null).toBe(role === 'admin');
  expect(screen.getByRole('link', { name: 'Write a post' })).toHaveAttribute('href', '/write');
  expect(screen.getByRole('link', { name: 'Blogs', exact: true })).toHaveAttribute('aria-current', 'page');
  expect(getPosts()).toEqual([post, other]);
});
it.each(['[]', '{', '[{"title":"broken"}]'])('renders an honest empty list for %s without repairing storage', (raw) => {
  setSession(owner); localStorage.setItem('writespace_posts', raw); mount();
  expect(screen.getByText(/No posts yet/)).toBeInTheDocument();
  expect(localStorage.getItem('writespace_posts')).toBe(raw);
});
it('renders full body as whitespace-preserving text and returns through the list link', async () => {
  const user = userEvent.setup(); setSession(owner); savePosts([post, other]); mount();
  await user.click(screen.getByRole('link', { name: 'Read First story' }));
  const article = screen.getByRole('article');
  const content = article.querySelector('.whitespace-pre-wrap');
  expect(content.textContent).toBe(post.content);
  expect(content).toHaveClass('break-words');
  expect(article.querySelector('script')).toBeNull(); expect(window.bad).toBeUndefined();
  expect(screen.getByRole('link', { name: 'Edit post' })).toHaveAttribute('href', '/edit/' + post.id);
  await user.click(screen.getByRole('link', { name: 'Back to blogs' }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stories in this browser');
});
it('shows missing exact ID and a working back link', async () => {
  const user = userEvent.setup(); setSession(owner); savePosts([post]); mount('/blog/missing');
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Post not found');
  expect(screen.queryByRole('article')).not.toBeInTheDocument();
  await user.click(screen.getByRole('link', { name: 'Back to blogs' }));
  expect(screen.getByRole('link', { name: 'Read First story' })).toBeInTheDocument();
  expect(getPosts()).toEqual([post]);
});
it('hides both reader controls from a non-owner', () => {
  setSession(owner); savePosts([other]); mount('/blog/' + other.id);
  expect(screen.queryByRole('link', { name: 'Edit post' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Delete post' })).not.toBeInTheDocument();
});
it.each(['list', 'reader'])('cancelled %s deletion preserves the collection and view', async (view) => {
  const user = userEvent.setup(); setSession(owner); savePosts([post, other]);
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  mount(view === 'list' ? '/blogs' : '/blog/' + post.id);
  await user.click(screen.getByRole('button', { name: view === 'list' ? 'Delete First story' : 'Delete post' }));
  expect(getPosts()).toEqual([post, other]); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(view === 'list' ? 'Stories in this browser' : 'First story');
});
it.each(['list', 'reader'])('failed %s deletion remains in workflow and explicit resubmission succeeds', async (view) => {
  const user = userEvent.setup(); setSession(owner); savePosts([post, other]);
  vi.spyOn(window, 'confirm').mockReturnValue(true); mount(view === 'list' ? '/blogs' : '/blog/' + post.id);
  const fault = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota'); });
  await user.click(screen.getByRole('button', { name: view === 'list' ? 'Delete First story' : 'Delete post' }));
  expect(screen.getByRole('alert')).toHaveTextContent(SAVE_ERROR); expect(getPosts()).toEqual([post, other]);
  fault.mockRestore();
  await user.click(screen.getByRole('button', { name: view === 'list' ? 'Delete First story' : 'Delete post' }));
  expect(getPosts()).toEqual([other]); expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stories in this browser');
});
it.each(['user', 'admin'])('confirmed reader deletion as %s removes only the eligible target and routes to list', async (role) => {
  const user = userEvent.setup(); setSession({ ...owner, role }); savePosts([post, other]);
  const target = role === 'admin' ? other : post;
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true); mount('/blog/' + target.id);
  await user.click(screen.getByRole('button', { name: 'Delete post' }));
  expect(confirm).toHaveBeenCalledWith('Delete this post? This cannot be undone.');
  expect(getPosts()).toEqual(role === 'admin' ? [post] : [other]);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stories in this browser');
});
it.each(['list', 'reader'])('rejects stale %s controls before confirming after current session or target changes', async (view) => {
  const user = userEvent.setup(); setSession(owner); savePosts([post]);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true); mount(view === 'list' ? '/blogs' : '/blog/' + post.id);
  setSession({ ...owner, userId: 'other' });
  await user.click(screen.getByRole('button', { name: view === 'list' ? 'Delete First story' : 'Delete post' }));
  expect(confirm).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('You cannot manage this post.');
  expect(getPosts()).toEqual([post]);
});
it.each(['list', 'reader'])('reports a %s record removed after render without confirmation or writes', async (view) => {
  const user = userEvent.setup(); setSession(owner); savePosts([post]);
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true); mount(view === 'list' ? '/blogs' : '/blog/' + post.id);
  savePosts([]);
  await user.click(screen.getByRole('button', { name: view === 'list' ? 'Delete First story' : 'Delete post' }));
  expect(confirm).not.toHaveBeenCalled(); expect(screen.getByRole('alert')).toHaveTextContent('Post not found'); expect(getPosts()).toEqual([]);
});
it.each(['list', 'reader'])('rechecks %s session after confirmation and refuses deletion when session disappears', async (view) => {
  const user = userEvent.setup(); setSession(owner); savePosts([post]);
  vi.spyOn(window, 'confirm').mockImplementation(() => { clearSession(); return true; });
  mount(view === 'list' ? '/blogs' : '/blog/' + post.id);
  await user.click(screen.getByRole('button', { name: view === 'list' ? 'Delete First story' : 'Delete post' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Please log in to manage posts.'); expect(getPosts()).toEqual([post]);
});
it.each(['list', 'reader'])('rechecks %s current post after confirmation and preserves changed ownership', async (view) => {
  const user = userEvent.setup(); setSession(owner); savePosts([post]);
  const changed = { ...post, authorId: 'other' };
  vi.spyOn(window, 'confirm').mockImplementation(() => { savePosts([changed]); return true; });
  mount(view === 'list' ? '/blogs' : '/blog/' + post.id);
  await user.click(screen.getByRole('button', { name: view === 'list' ? 'Delete First story' : 'Delete post' }));
  expect(screen.getByRole('alert')).toHaveTextContent('You cannot manage this post.'); expect(getPosts()).toEqual([changed]);
});
it('renders card without management for guest and supports authorized optional callback omission', () => {
  const view = render(
    <MemoryRouter>
      <BlogCard post={post} />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('link', { name: 'Edit First story' })).not.toBeInTheDocument();
  view.rerender(
    <MemoryRouter>
      <BlogCard post={post} session={owner} />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Edit First story' })).toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('toggles mobile navigation, closes on Escape and link click, then logs out only session', async () => {
  const user = userEvent.setup(); setSession(owner); savePosts([post]); mount('/blog/' + post.id);
  const toggle = screen.getByRole('button', { name: 'Open navigation' });
  expect(screen.getByRole('navigation')).toHaveClass('hidden');
  await user.click(toggle); expect(toggle).toHaveAttribute('aria-expanded', 'true');
  screen.getByRole('link', { name: 'Blogs', exact: true }).focus(); await user.keyboard('{Escape}');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await user.click(toggle); await user.click(screen.getByRole('link', { name: 'Blogs', exact: true }));
  expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false');
  await user.click(screen.getByRole('button', { name: 'Log out' }));
  expect(getSession()).toBeNull(); expect(getPosts()).toEqual([post]);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Room for your words.');
});
it('failed mobile logout keeps menu, session, collection and reader; explicit retry succeeds', async () => {
  const user = userEvent.setup(); setSession(owner); savePosts([post]); mount('/blog/' + post.id);
  await user.click(screen.getByRole('button', { name: 'Open navigation' }));
  const fault = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Denied'); });
  await user.click(screen.getByRole('button', { name: 'Log out' }));
  expect(screen.getByRole('alert')).toHaveTextContent('You are still signed in.'); expect(getSession()).toEqual(owner); expect(getPosts()).toEqual([post]);
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('First story');
  expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true');
  fault.mockRestore(); await user.click(screen.getByRole('button', { name: 'Log out' })); expect(getSession()).toBeNull();
});
it('navbar falls back to login after absent identity without privileged links', () => {
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>,
  );
  expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  expect(screen.queryByRole('link', { name: 'Admin dashboard' })).not.toBeInTheDocument();
});
it.each(['user', 'admin'])('renders the required %s SVG role mapping', (role) => {
  render(<Avatar role={role} />);
  const avatar = screen.getByRole('img', { name: role === 'admin' ? 'Admin avatar' : 'User avatar' });
  expect(avatar).toHaveClass(role === 'admin' ? 'bg-violet-100' : 'bg-indigo-100');
  expect(avatar.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
});
it('unknown omitted avatar role defaults to User rather than Admin', () => {
  render(<Avatar />); expect(screen.getByRole('img')).toHaveAccessibleName('User avatar');
});
it.each(['/blogs', '/blog/' + post.id])('StrictMode mount %s never writes or removes data', (path) => {
  setSession(owner); savePosts([post]);
  const write = vi.spyOn(Storage.prototype, 'setItem'); const remove = vi.spyOn(Storage.prototype, 'removeItem');
  render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </React.StrictMode>,
  );
  expect(write).not.toHaveBeenCalled(); expect(remove).not.toHaveBeenCalled(); expect(getPosts()).toEqual([post]);
});

it.each(['list', 'reader'])('refuses %s deletion when record disappears during confirmation', async (view) => {
  const user = userEvent.setup();
  setSession(owner);
  savePosts([post, other]);
  vi.spyOn(window, 'confirm').mockImplementation(() => { savePosts([other]); return true; });
  mount(view === 'list' ? '/blogs' : '/blog/' + post.id);
  await user.click(screen.getByRole('button', { name: view === 'list' ? 'Delete First story' : 'Delete post' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Post not found');
  expect(getPosts()).toEqual([other]);
});

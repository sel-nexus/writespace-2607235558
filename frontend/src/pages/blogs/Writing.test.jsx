/** Verify authoring through real routes, shared operations and browser storage. */
import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App.jsx';
import { getPosts, savePosts } from '../../utils/storage.js';
import { setSession } from '../../utils/auth.js';

const owner = { userId: 'writer', username: 'writer', displayName: 'Local Writer', role: 'user' };
const other = { userId: 'other', username: 'other', displayName: 'Other Writer', role: 'user' };
const admin = { userId: 'admin', username: 'admin', displayName: 'Demo Admin', role: 'admin' };
const original = {
  id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1aa', title: 'Original title',
  content: 'First line\n  Second line', createdAt: '2026-11-01T08:00:00.000Z',
  authorId: owner.userId, authorName: owner.displayName,
};

/** Mount the actual route table with isolated local demo state. */
function open(path = '/write', session = owner, posts = []) {
  if (session) setSession(session);
  savePosts(posts);
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
}

/** Enter original text through stable accessible controls. */
async function fill(user, title = '  A new title  ', content = '  First line\n\n<script>text only</script>  ') {
  await user.clear(screen.getByLabelText('Title'));
  await user.type(screen.getByLabelText('Title'), title);
  await user.clear(screen.getByLabelText('Content'));
  await user.type(screen.getByLabelText('Content'), content);
}

describe('plain-text writing', () => {
  it('does not write on StrictMode mount, typing or cancelled creation', async () => {
    const user = userEvent.setup();
    open('/write', owner, [original]);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await fill(user);
    expect(screen.getByLabelText('Content')).toHaveFocus();
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([original]);
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stories in this browser');
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([original]);
  });

  it('creates exact UUID/ISO/session fields, preserves original text and latest records, then reads saved text', async () => {
    const user = userEvent.setup();
    open();
    await fill(user);
    const latest = { ...original, id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1ab', title: 'Another tab' };
    expect(savePosts([latest])).toBe(true);
    setSession(other);
    const before = Date.now();
    await user.click(screen.getByRole('button', { name: 'Publish post' }));
    const after = Date.now();
    const posts = getPosts();
    expect(posts).toHaveLength(2);
    expect(posts[0]).toEqual(latest);
    const created = posts[1];
    expect(created).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
      title: '  A new title  ', content: '  First line\n\n<script>text only</script>  ',
      createdAt: expect.any(String), authorId: other.userId, authorName: other.displayName,
    });
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
    expect(Date.parse(created.createdAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(created.createdAt)).toBeLessThanOrEqual(after);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A new title');
    expect(screen.getByRole('article').querySelector('p.whitespace-pre-wrap').textContent).toBe(created.content);
    expect(screen.getByRole('article').querySelector('script')).toBeNull();
    expect(localStorage.getItem('writespace_users')).toBeNull();
  });

  it.each([
    ['', '', ['Title is required.', 'Content is required.']],
    ['   ', 'Valid content', ['Title is required.']],
    ['Valid title', ' \n  ', ['Content is required.']],
  ])('rejects blank create fields (%j, %j) with associated errors and no write', async (title, content, messages) => {
    const user = userEvent.setup();
    open();
    if (title) await user.type(screen.getByLabelText('Title'), title);
    if (content) await user.type(screen.getByLabelText('Content'), content);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    await user.click(screen.getByRole('button', { name: 'Publish post' }));
    expect(screen.getAllByRole('alert').map((element) => element.textContent)).toEqual(messages);
    for (const field of ['Title', 'Content']) {
      const control = screen.getByLabelText(field);
      expect(control).toHaveAttribute('aria-required', 'true');
      if (messages.includes(field + ' is required.')) {
        expect(control).toHaveAttribute('aria-invalid', 'true');
        expect(control).toHaveAccessibleDescription(field + ' is required.');
      }
    }
    expect(write).not.toHaveBeenCalled();
    expect(getPosts()).toEqual([]);
    expect(screen.getByLabelText('Title')).toHaveValue(title);
    expect(screen.getByLabelText('Content')).toHaveValue(content);
  });

  it.each([owner, admin])('prefills eligible $role edit and changes only text on the latest record', async (session) => {
    const user = userEvent.setup();
    open('/edit/' + original.id, session, [original]);
    expect(screen.getByLabelText('Title')).toHaveValue(original.title);
    expect(screen.getByLabelText('Content')).toHaveValue(original.content);
    await fill(user);
    const latest = { ...original, createdAt: '2026-10-01T00:00:00.000Z', authorName: 'Updated stored name' };
    const neighbor = { ...original, id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1ac', title: 'Untouched' };
    expect(savePosts([neighbor, latest])).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(getPosts()).toEqual([neighbor, {
      ...latest, title: '  A new title  ', content: '  First line\n\n<script>text only</script>  ',
    }]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('A new title');
    expect(screen.getByRole('article')).toHaveTextContent('Updated stored name');
  });

  it('rejects invalid edit without changing metadata or other records and allows explicit correction', async () => {
    const user = userEvent.setup();
    open('/edit/' + original.id, owner, [original]);
    await fill(user, ' ', ' \n ');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(getPosts()).toEqual([original]);
    await fill(user, 'Corrected', 'Corrected body');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(getPosts()).toEqual([{ ...original, title: 'Corrected', content: 'Corrected body' }]);
  });

  it.each(['/write', '/edit/' + original.id])('denies guest initial entry %s', (path) => {
    open(path, null, [original]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Log in to WriteSpace');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([original]);
  });

  it('redirects a non-owner direct edit to blogs without a form or mutation', () => {
    open('/edit/' + original.id, other, [original]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stories in this browser');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([original]);
  });

  it('shows missing ID feedback and a working back link, never another record form', async () => {
    const user = userEvent.setup();
    open('/edit/missing', owner, [original]);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Post not found');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to blogs' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stories in this browser');
    expect(getPosts()).toEqual([original]);
  });

  it.each([
    ['/write', 'removed'], ['/write', 'malformed'],
    ['/edit/' + original.id, 'removed'], ['/edit/' + original.id, 'malformed'],
  ])('rechecks %s session %s at submit', async (path, state) => {
    const user = userEvent.setup();
    open(path, owner, [original]);
    await fill(user);
    if (state === 'removed') localStorage.removeItem('writespace_session');
    else localStorage.setItem('writespace_session', JSON.stringify({ ...owner, role: 'unknown' }));
    await user.click(screen.getByRole('button', { name: path === '/write' ? 'Publish post' : 'Save changes' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Log in to WriteSpace');
    expect(getPosts()).toEqual([original]);
  });

  it.each(['session', 'ownership'])('rejects stale edit when %s changed after render', async (change) => {
    const user = userEvent.setup();
    open('/edit/' + original.id, owner, [original]);
    await fill(user);
    const latest = change === 'ownership' ? { ...original, authorId: other.userId } : original;
    expect(savePosts([latest])).toBe(true);
    if (change === 'session') setSession(other);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Stories in this browser');
    expect(getPosts()).toEqual([latest]);
  });

  it('shows not found without recreating a post removed after render', async () => {
    const user = userEvent.setup();
    open('/edit/' + original.id, owner, [original]);
    await fill(user);
    savePosts([]);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Post not found');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(getPosts()).toEqual([]);
  });

  it.each(['/write', '/edit/' + original.id])('failed write on %s preserves draft and storage, then explicit retry rereads current state', async (path) => {
    const user = userEvent.setup();
    open(path, owner, [original]);
    await fill(user);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Denied', 'QuotaExceededError');
    });
    const button = path === '/write' ? 'Publish post' : 'Save changes';
    await user.click(screen.getByRole('button', { name: button }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save in this browser. Your changes have not been saved.');
    expect(screen.getByLabelText('Title')).toHaveValue('  A new title  ');
    expect(screen.getByLabelText('Content')).toHaveValue('  First line\n\n<script>text only</script>  ');
    expect(getPosts()).toEqual([original]);
    expect(write).toHaveBeenCalledTimes(1);
    write.mockRestore();
    const neighbor = { ...original, id: '53f2b35c-fc1a-4e66-9a42-2c2a2e4fb1ac' };
    expect(savePosts([original, neighbor])).toBe(true);
    await user.click(screen.getByRole('button', { name: button }));
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
    expect(getPosts().find((post) => post.id === neighbor.id)).toEqual(neighbor);
    expect(getPosts()).toHaveLength(path === '/write' ? 3 : 2);
  });

  it('UUID generation failure reports approved error without writing or losing text', async () => {
    const user = userEvent.setup();
    open();
    await fill(user);
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => { throw new Error('Unavailable'); });
    await user.click(screen.getByRole('button', { name: 'Publish post' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save in this browser. Your changes have not been saved.');
    expect(getPosts()).toEqual([]);
    expect(screen.getByLabelText('Title')).toHaveValue('  A new title  ');
  });

  it('cancelled edit leaves storage unchanged and route re-entry reads latest text', async () => {
    const user = userEvent.setup();
    open('/edit/' + original.id, owner, [original]);
    await fill(user);
    await user.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(getPosts()).toEqual([original]);
    const latest = { ...original, title: 'Latest text', content: 'Fresh body' };
    expect(savePosts([latest])).toBe(true);
    await user.click(screen.getByRole('link', { name: 'Edit post' }));
    expect(screen.getByLabelText('Title')).toHaveValue(latest.title);
    expect(screen.getByLabelText('Content')).toHaveValue(latest.content);
  });
});

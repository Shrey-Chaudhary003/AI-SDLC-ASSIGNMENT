import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import App from '../web/App.jsx';

const T1 = {
  id: 'task-001',
  title: 'Read book',
  priority: 'medium',
  tags: ['work'],
  status: 'todo',
  createdAt: '2026-11-01T10:00:00.000Z',
};

function task(overrides = {}) {
  return { ...T1, ...overrides };
}

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function mockFetch(...responses) {
  const fetchMock = vi.fn();
  for (const result of responses) {
    fetchMock.mockResolvedValueOnce(result);
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function waitForTask(title) {
  return screen.findByText(title);
}

test('AC-063: task view renders content and accessible controls', async () => {
  mockFetch(response([T1]));
  render(<App />);
  await waitForTask('Read book');
  expect(screen.getByText('work')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Add task' })).toBeTruthy();
  expect(screen.getByRole('textbox', { name: 'Filter by tag' })).toBeTruthy();
});

test('AC-064: create submits a task and renders the API result', async () => {
  const created = task({ id: 'task-new', title: 'Buy milk' });
  const fetchMock = mockFetch(response([]), response(created, 201), response([created]));
  render(<App />);
  await screen.findByText('A clear page is a good place to start.');
  fireEvent.change(screen.getByLabelText('Task name'), { target: { value: 'Buy milk' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add task' }));
  await waitForTask('Buy milk');
  expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Buy milk', description: '', priority: 'medium', tags: [] }),
  });
  expect(fetchMock.mock.calls.filter((call) => call[1] && call[1].method === 'POST')).toHaveLength(1);
});

test('AC-065: start task sends the exact status transition', async () => {
  const started = task({ status: 'in_progress' });
  const fetchMock = mockFetch(response([T1]), response(started), response([started]));
  render(<App />);
  await screen.findByText('Read book');
  fireEvent.click(screen.getByRole('button', { name: 'Start task' }));
  await waitFor(() => expect(screen.getByText('in progress')).toBeTruthy());
  expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/tasks/task-001/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });
});

test('AC-066: failed task load displays the exact accessible error', async () => {
  mockFetch(response({ error: 'storage error' }, 500));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not load tasks. Please try again.');
});

test('AC-069: task content is rendered as literal text rather than markup', async () => {
  const unsafeTitle = '<img src=x onerror=alert(1)>';
  mockFetch(response([task({ title: unsafeTitle })]));
  render(<App />);
  await waitForTask(unsafeTitle);
  expect(document.querySelectorAll('img')).toHaveLength(0);
});

test('AC-070: clearing optional description and tags is sent to the API', async () => {
  const initial = task({ description: 'Note', tags: ['work'] });
  const updated = task({ tags: [] });
  const fetchMock = mockFetch(response([initial]), response(updated), response([updated]));
  render(<App />);
  await screen.findByText('Read book');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Read book' }));
  fireEvent.change(screen.getByLabelText(/A few details/), { target: { value: '' } });
  fireEvent.change(screen.getByLabelText('Tags'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/tasks/task-001', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Read book', description: '', priority: 'medium', tags: [] }),
  });
  await waitForTask('Read book');
  expect(screen.queryByText('work')).toBeNull();
  expect(screen.queryByText('Note')).toBeNull();
});

test('AC-073: editing updates fields and displays the saved task', async () => {
  const updated = task({ title: 'New title', priority: 'high', tags: ['home'] });
  const fetchMock = mockFetch(response([T1]), response(updated), response([updated]));
  render(<App />);
  await screen.findByText('Read book');
  fireEvent.click(screen.getByRole('button', { name: 'Edit Read book' }));
  fireEvent.change(screen.getByLabelText('Task name'), { target: { value: 'New title' } });
  fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'high' } });
  fireEvent.change(screen.getByLabelText('Tags'), { target: { value: 'home' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitForTask('New title');
  expect(fetchMock.mock.calls[1][1].method).toBe('PATCH');
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).title).toBe('New title');
});

test('AC-074: an in-progress task can be marked done', async () => {
  const active = task({ status: 'in_progress' });
  const done = task({ status: 'done' });
  const fetchMock = mockFetch(response([active]), response(done), response([done]));
  render(<App />);
  await screen.findByText('Read book');
  fireEvent.click(screen.getByRole('button', { name: 'Mark done' }));
  await waitFor(() => expect(screen.getByText('done')).toBeTruthy());
  expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ status: 'done' }));
});

test('AC-075: completed tasks can be reopened', async () => {
  const done = task({ status: 'done' });
  const reopened = task();
  const fetchMock = mockFetch(response([done]), response(reopened), response([reopened]));
  render(<App />);
  await screen.findByText('Read book');
  fireEvent.click(screen.getByRole('button', { name: 'Reopen task' }));
  await waitFor(() => expect(screen.getByText('todo')).toBeTruthy());
  expect(fetchMock.mock.calls[1][0]).toBe('/api/tasks/task-001/reopen');
  expect(fetchMock.mock.calls[1][1].method).toBe('POST');
});

test('AC-076: deleting a task removes it from the visible list', async () => {
  const fetchMock = mockFetch(response([T1]), response({ deleted: true, id: T1.id }), response([]));
  render(<App />);
  await screen.findByText('Read book');
  fireEvent.click(screen.getByRole('button', { name: 'Delete Read book' }));
  expect(await screen.findByText('A clear page is a good place to start.')).toBeTruthy();
  expect(fetchMock.mock.calls[1][1].method).toBe('DELETE');
});

test('AC-077: comma-separated tag filters use exact AND query parameters', async () => {
  const fetchMock = mockFetch(response([T1]), response([]));
  render(<App />);
  await screen.findByText('Read book');
  fireEvent.change(screen.getByRole('textbox', { name: 'Filter by tag' }), { target: { value: 'work, home' } });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1][0]).toBe('/api/tasks?tag=work&tag=home');
});

test('AC-078: priority sorting is sent to the API', async () => {
  const fetchMock = mockFetch(response([T1]), response([T1]));
  render(<App />);
  await screen.findByText('Read book');
  fireEvent.change(screen.getByRole('combobox', { name: 'Sort tasks' }), { target: { value: 'priority' } });
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(fetchMock.mock.calls[1][0]).toBe('/api/tasks?sort=priority');
});

test('AC-079: an empty task collection displays the empty state', async () => {
  mockFetch(response([]));
  render(<App />);
  expect(await screen.findByText('A clear page is a good place to start.')).toBeTruthy();
});

test('AC-080: failed mutations display an error and preserve the task', async () => {
  mockFetch(response([T1]), response({ error: 'storage error' }, 500));
  render(<App />);
  await screen.findByText('Read book');
  fireEvent.click(screen.getByRole('button', { name: 'Start task' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not update task.');
  expect(screen.getByText('Read book')).toBeTruthy();
});

test('AC-086: an in-progress task can be moved back to todo', async () => {
  const active = task({ status: 'in_progress' });
  const todo = task();
  const fetchMock = mockFetch(response([active]), response(todo), response([todo]));
  render(<App />);
  await screen.findByText('Read book');
  fireEvent.click(screen.getByRole('button', { name: 'Move to to-do' }));
  await waitFor(() => expect(screen.getByText('todo')).toBeTruthy());
  expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ status: 'todo' }));
});

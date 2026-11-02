import { useEffect, useState } from 'react';

const TASKS_URL = '/api/tasks';

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'request failed');
  }
  return body;
}

function App() {
  const board = useBoard();
  return <Page board={board} />;
}

function useBoard() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    loadTasks(filter, sort, setTasks, setError, setLoading);
  }, [filter, sort]);
  return {
    tasks, loading, error, filter, sort, editing, form,
    setFilter, setSort,
    save: (event) => saveTask(event, { editing, form, setEditing, setForm, refresh: () => loadTasks(filter, sort, setTasks, setError, setLoading), setError }),
    edit: (task) => editTask(task, setEditing, setForm),
    reset: () => resetForm(setEditing, setForm),
    status: (task, value) => updateStatus(task, value, setError, () => loadTasks(filter, sort, setTasks, setError, setLoading)),
    reopen: (task) => reopenTask(task, setError, () => loadTasks(filter, sort, setTasks, setError, setLoading)),
    remove: (task) => deleteTask(task, setError, () => loadTasks(filter, sort, setTasks, setError, setLoading)),
    field: (name, value) => updateField(name, value, setForm),
  };
}

function Page({ board }) {
  return (
    <main className="app-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <Header />
      <Welcome board={board} />
      <Workspace board={board} />
      <footer><span>Small steps count.</span><span>Made for a calmer kind of productive.</span></footer>
    </main>
  );
}

function Header() {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Daymark home">
        <span className="brand-mark">✦</span><span>daymark</span>
      </a>
      <span className="local-badge"><span /> Flow mode active</span>
    </header>
  );
}

function Welcome({ board }) {
  const counts = board.tasks.reduce((totals, task) => {
    totals[task.status] += 1;
    return totals;
  }, { todo: 0, in_progress: 0, done: 0 });

  return (
    <section className="welcome">
      <div className="welcome-copy">
        <p className="eyebrow">YOUR DAY, IN FOCUS</p>
        <h1>Make room for<br /><em>what matters.</em></h1>
        <p className="intro">A little structure goes a long way. Pick a task and get moving.</p>
        <div className="welcome-stats" aria-label="Daily focus stats">
          <span><strong>{counts.todo}</strong> to do</span>
          <span><strong>{counts.in_progress}</strong> in progress</span>
          <span><strong>{counts.done}</strong> completed</span>
        </div>
      </div>
      <div className="welcome-art" aria-hidden="true">
        <div className="mood-card">
          <span className="mini-label">FLOW</span>
          <strong>{board.tasks.length} tasks</strong>
          <small>in your current view</small>
        </div>
        <span className="sun" />
        <span className="orbit orbit-one" />
        <span className="orbit orbit-two" />
        <span className="art-leaf leaf-one" />
        <span className="art-leaf leaf-two" />
      </div>
    </section>
  );
}

function Workspace({ board }) {
  return (
    <section className="workspace">
      <SectionHeading board={board} />
      <div className="content-grid">
        <TaskList board={board} />
        <TaskForm board={board} />
      </div>
    </section>
  );
}

function SectionHeading({ board }) {
  return (
    <div className="section-heading">
      <div><p className="eyebrow">THE OVERVIEW</p><h2>Your tasks <span className="task-count">{board.tasks.length}</span></h2></div>
      <TaskFilters board={board} />
    </div>
  );
}

function TaskFilters({ board }) {
  return (
    <div className="filters">
      <label>
        <span className="sr-only">Filter by tag</span><span className="filter-icon" aria-hidden="true">⌕</span>
        <input aria-label="Filter by tag" placeholder="Filter by tag" value={board.filter} onChange={(event) => board.setFilter(event.target.value)} />
      </label>
      <label className="sort-label">
        <span className="sr-only">Sort tasks</span>
        <select aria-label="Sort tasks" value={board.sort} onChange={(event) => board.setSort(event.target.value)}>
          <option value="">Recently added</option><option value="priority">Priority</option>
        </select>
      </label>
    </div>
  );
}

function TaskList({ board }) {
  if (board.loading) {
    return <section className="task-panel" aria-label="Task list"><p className="state-message">Gathering your tasks…</p></section>;
  }
  if (board.error && board.tasks.length === 0) {
    return <section className="task-panel" aria-label="Task list"><p className="state-message error-message" role="alert">{board.error}</p></section>;
  }
  if (board.tasks.length === 0) {
    return <section className="task-panel" aria-label="Task list"><EmptyState /></section>;
  }
  return (
    <section className="task-panel" aria-label="Task list">
      {board.error ? <p className="state-message error-message" role="alert">{board.error}</p> : null}
      <ul className="task-list">
        {board.tasks.map((task) => <TaskCard key={task.id} task={task} board={board} />)}
      </ul>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">✳</span>
      <h3>A clear page is a good place to start.</h3>
      <p>Add your first task and turn an idea into a next step.</p>
    </div>
  );
}

function TaskCard({ task, board }) {
  return (
    <li className={`task-card status-${task.status}`}>
      <div className="task-check" aria-hidden="true">{task.status === 'done' ? '✓' : ''}</div>
      <div className="task-main">
        <TaskTitle task={task} />
        {task.description ? <p className="task-description">{task.description}</p> : null}
        <div className="task-meta">
          {task.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
          <span className="status-text">{task.status.replace('_', ' ')}</span>
        </div>
        <TaskActions task={task} board={board} />
      </div>
    </li>
  );
}

function TaskTitle({ task }) {
  return (
    <div className="task-title-line">
      <h3>{task.title}</h3><span className={`priority priority-${task.priority}`}>{task.priority}</span>
    </div>
  );
}

function TaskActions({ task, board }) {
  return (
    <div className="task-actions">
      {task.status === 'todo' ? <button className="task-button" type="button" onClick={() => board.status(task, 'in_progress')}>Start task</button> : null}
      {task.status === 'in_progress' ? <button className="task-button" type="button" onClick={() => board.status(task, 'done')}>Mark done</button> : null}
      {task.status === 'in_progress' ? <button className="task-button" type="button" onClick={() => board.status(task, 'todo')}>Move to to-do</button> : null}
      {task.status === 'done' ? <button className="task-button" type="button" onClick={() => board.reopen(task)}>Reopen task</button> : null}
      <button className="task-button" type="button" aria-label={`Edit ${task.title}`} onClick={() => board.edit(task)}>Edit</button>
      <button className="task-button" type="button" aria-label={`Delete ${task.title}`} onClick={() => board.remove(task)}>Delete</button>
    </div>
  );
}

function TaskForm({ board }) {
  return (
    <form className="task-form" onSubmit={board.save}>
      <p className="eyebrow">{board.editing ? 'MAKE IT YOURS' : 'A FRESH START'}</p>
      <h3>{board.editing ? 'Edit task' : 'Add a task'}</h3>
      <TextField id="task-title" label="Task name" value={board.form.title} onChange={(value) => board.field('title', value)} placeholder="What needs doing?" maxLength="100" required />
      <TextField id="task-description" label="A few details" hint="optional" value={board.form.description} onChange={(value) => board.field('description', value)} placeholder="Add a note…" multiline />
      <FormRow board={board} />
      <button className="primary-button" type="submit">{board.editing ? 'Save changes' : 'Add task'} <span aria-hidden="true">↗</span></button>
      {board.editing ? <button className="text-button" type="button" onClick={board.reset}>Cancel editing</button> : null}
    </form>
  );
}

function TextField({ id, label, hint, value, onChange, placeholder, maxLength, required, multiline }) {
  const control = multiline
    ? <textarea id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows="3" />
    : <input id={id} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} maxLength={maxLength} required={required} />;
  return <label className="field">{fieldLabel(label, hint)}{control}</label>;
}

function fieldLabel(label, hint) {
  return <span className="field-label">{label}{hint ? <span> {hint}</span> : null}</span>;
}

function FormRow({ board }) {
  return (
    <div className="form-row">
      <label className="field"><span className="field-label">Priority</span>
        <select value={board.form.priority} onChange={(event) => board.field('priority', event.target.value)}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </select>
      </label>
      <TextField label="Tags" value={board.form.tags} onChange={(value) => board.field('tags', value)} placeholder="home, work" />
    </div>
  );
}

function emptyForm() {
  return { title: '', description: '', priority: 'medium', tags: '' };
}

async function loadTasks(filter, sort, setTasks, setError, setLoading) {
  setLoading(true);
  setError('');
  try {
    setTasks(await requestJson(buildTasksUrl(filter, sort)));
  } catch {
    setError('Could not load tasks. Please try again.');
  } finally {
    setLoading(false);
  }
}

async function saveTask(event, board) {
  event.preventDefault();
  const payload = {
    title: board.form.title,
    description: board.form.description,
    priority: board.form.priority,
    tags: parseTags(board.form.tags),
  };
  const method = board.editing ? 'PATCH' : 'POST';
  const taskId = board.editing ? `/${encodeURIComponent(board.editing.id)}` : '';
  const task = await mutateTask(`${TASKS_URL}${taskId}`, method, payload, 'Could not save task.', board.setError, board.refresh);
  if (task) {
    resetForm(board.setEditing, board.setForm);
  }
}

async function mutateTask(url, method, payload, failureMessage, setError, refresh) {
  setError('');
  try {
    const options = requestOptions(method, payload);
    const result = await requestJson(url, options);
    await refresh();
    return result;
  } catch {
    setError(failureMessage);
    return null;
  }
}

function requestOptions(method, payload) {
  const options = { method, headers: { 'Content-Type': 'application/json' } };
  if (payload) {
    options.body = JSON.stringify(payload);
  }
  return options;
}

async function updateStatus(task, status, setError, refresh) {
  const url = `${TASKS_URL}/${encodeURIComponent(task.id)}/status`;
  await mutateTask(url, 'PATCH', { status }, 'Could not update task.', setError, refresh);
}

async function reopenTask(task, setError, refresh) {
  const url = `${TASKS_URL}/${encodeURIComponent(task.id)}/reopen`;
  await mutateTask(url, 'POST', null, 'Could not reopen task.', setError, refresh);
}

async function deleteTask(task, setError, refresh) {
  const url = `${TASKS_URL}/${encodeURIComponent(task.id)}`;
  await mutateTask(url, 'DELETE', null, 'Could not delete task.', setError, refresh);
}

function editTask(task, setEditing, setForm) {
  setEditing(task);
  setForm({ title: task.title, description: task.description || '', priority: task.priority, tags: task.tags.join(', ') });
}

function resetForm(setEditing, setForm) {
  setEditing(null);
  setForm(emptyForm());
}

function updateField(name, value, setForm) {
  setForm((current) => {
    if (name === 'title') {
      return { ...current, title: value };
    }
    if (name === 'description') {
      return { ...current, description: value };
    }
    if (name === 'priority') {
      return { ...current, priority: value };
    }
    return { ...current, tags: value };
  });
}

function parseTags(value) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean);
}

function buildTasksUrl(filter, sort) {
  const query = new URLSearchParams();
  for (const tag of parseTags(filter)) {
    query.append('tag', tag);
  }
  if (sort) {
    query.set('sort', sort);
  }
  const suffix = query.toString();
  return suffix ? `${TASKS_URL}?${suffix}` : TASKS_URL;
}

export default App;

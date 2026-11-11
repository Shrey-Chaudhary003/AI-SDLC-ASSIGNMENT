# AI SDLC Assignment

Welcome! This repository contains two related projects, each with a different
way to make everyday planning a little easier. Part 1A is for managing tasks;
Part 1B understands written reminder requests and turns them into structured
details.

## A quick tour

### Part 1A - Smart Todo

Smart Todo lets you manage your tasks from either the terminal or a browser:

- A command-line tool for adding, viewing, updating, completing, reopening,
  filtering, sorting, and deleting tasks.
- A browser interface backed by a local REST API, so you can manage tasks
  without leaving the browser.

Your tasks are saved in a local JSON file, shared by both interfaces. Add a
task in the browser, and you can find it from the CLI too.

### Part 1B - Natural Language Reminder Agent

The Reminder Agent takes a request like “remind me to call Sam tomorrow at
6 PM” and uses Gemini to turn it into structured reminder details. If the
request is unclear or missing something important, it asks for clarification
rather than guessing.

Try it from the command line, or open the local browser page to see the result
and how it was checked.

## What you will need

- Node.js 20 or newer and npm.
- For Part 1B only: a Gemini API key and a Gemini model name.

## Run it on your computer

You can run either part on its own. Just make sure to run the commands from
that part's folder.

### Part 1A: Smart Todo

First, open a terminal in the repository folder, then install Part 1A's
dependencies:

```powershell
cd Part-1A
npm install
```

Run the CLI:

```powershell
node src/cli.js add --title "Buy milk" --priority high --tag home
node src/cli.js list --tag home --sort priority
```

The `add` command prints the new task and its ID. Use that ID with commands
like `get <id>`, `update <id> ...`, `status <id> in_progress`, `reopen <id>`,
or `delete <id>`. By default, tasks are saved in `Part-1A/todo.json`; set
`TODO_FILE` if you'd like to use a different file.

To run the CLI and API tests:

```powershell
npm test
```

Want to include the browser UI tests too? Run:

```powershell
npm run test:all
```

To try the browser app, start the API and frontend in two terminals. Run both
from `Part-1A`:

```powershell
# Terminal 1
npm start
```

```powershell
# Terminal 2
npm run dev
```

Open the Vite URL printed in the second terminal (usually
`http://localhost:5173`). The frontend connects to the API running locally on
port 3001.

### Part 1B: Reminder Agent

From the repository folder, move into Part 1B:

```powershell
cd Part-1B
```

Before making a real request, create a `.env` file inside `Part-1B` and add
your Gemini model and API key:

```dotenv
LLM_MODEL=your-gemini-model-name
GEMINI_API_KEY=your-gemini-api-key
```

Keep this file private: `.env` is ignored by Git, so your key won't be added to
a commit by accident. Don't paste the key into your source code.

You can run the tests without an API key. They use fake Gemini responses and
don't make real model requests:

```powershell
npm test
```

Start the browser app:

```powershell
node src/server.js
```

Now open [http://127.0.0.1:3000](http://127.0.0.1:3000) and try a sample
request. The default timezone is `Asia/Kolkata`. If you prefer the terminal,
try:

```powershell
node src/cli.js "Remind me to call Sam tomorrow at 6 PM" "2026-11-11T10:00:00+05:30" "Asia/Kolkata"
```

The CLI expects the reminder text, a reference date and time (including its
UTC offset), and an IANA timezone. That reference time is used to understand
words like “tomorrow” instead of relying on your computer's clock.

## Before you go

- Part 1A and Part 1B are separate projects, so run each from its own folder.
- Part 1A's CLI and browser app share the same task file. Part 1B interprets
  reminder requests; it doesn't save or send reminders.
- A real Part 1B request needs your Gemini settings, but its tests work offline.
- For the detailed requirements and API behavior, take a look in each part's
  `specs` and `contracts` folders.

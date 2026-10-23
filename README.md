# foodlab

My external memory for food: foods, the products I buy and what I think of them, where they're
sold, recipes built on foods, and what I've learned. It answers "what can I eat?", starting
with "what do I bring for lunch tomorrow?". Desktop and Android, at https://foodlab.evans.tools.

- **[DESIGN.md](DESIGN.md)**: what it is and why (the spec).
- **[CLAUDE.md](CLAUDE.md)**: how the code is put together, for working on it with Claude.
- **[docs/runbook.md](docs/runbook.md)**: hosting on the mini PC.

## Run it

```sh
npm install
npm run dev      # http://localhost:5174 (server on 8788)
npm test
```

Same stack and conventions as sideshow: TypeScript, React + Vite, Node + Hono, SQLite.

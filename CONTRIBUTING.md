# Contributing to Roost

Thanks for your interest in improving Roost! By contributing you agree that
your contributions are licensed under the project's [Apache 2.0 License](LICENSE),
and that you understand and accept the [DISCLAIMER](DISCLAIMER.md).

## Ground rules

- Roost is a tool for **authorized network administration only**. Please do
  not contribute features whose primary purpose is to attack third parties,
  evade access controls you don't own, or hide activity from network owners.
- Be respectful. Assume good faith.

## Development setup

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cd frontend && npm install && cd ..
```

Run the backend with `--reload` and the frontend dev server (`npm run dev`,
which proxies `/api` and `/ws` to port 5000).

## Tests

- **Unit tests** live in `tests/unit/` and must run **without** admin privileges
  or a live network (mock Scapy / network I/O). Run them with:
  ```bash
  pytest -m "not integration"
  ```
- **Integration / e2e tests** live in `tests/e2e/`, are marked `@pytest.mark.integration`,
  and require a running backend (and, for some, a live LAN). Run them with:
  ```bash
  pytest -m integration
  ```

Please add unit tests for new backend logic.

## Coding style

- **Python:** follow the existing style; keep network/Scapy I/O off the asyncio
  event loop (use `run_in_executor` for blocking calls).
- **TypeScript/React:** functional components, React Query for server state,
  Zustand for client state.

## Pull requests

1. Branch from `main`.
2. Keep PRs focused; describe what and why.
3. Ensure `pytest -m "not integration"` and `npm run build` pass.
4. Note any change that affects privileges, the hosts file, or network behavior.

# Contributing Guide

## Branching Strategy

We use a layered branching strategy:
- **`main`**: Production-ready code. Always deployable.
- **`dev`**: Integration branch. All features are merged here first for testing.
- **`feature/*`**: Individual feature branches (e.g., `feature/auth-flow`, `feature/logging-screen`).

### Workflow
1. Create a new branch from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/my-feature
   ```
2. Make your changes and commit.
3. Push to origin:
   ```bash
   git push origin feature/my-feature
   ```
4. Create a Pull Request (PR) to merge `feature/my-feature` into `dev`.
5. Once stable in `dev`, we merge `dev` into `main`.

## Directory Structure
- **`src/`**: All source code.
  - **`components/`**: Shared UI components.
  - **`features/`**: Domain specific logic (optional).
  - **`hooks/`**: Global hooks.
  - **`lib/`**: External services (Supabase, API).
- **`app/`**: Expo Router pages (remains at root).

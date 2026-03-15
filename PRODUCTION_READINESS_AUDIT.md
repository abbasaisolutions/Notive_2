# Production Readiness Audit

Audit date: March 14, 2026

## What was validated

- Backend TypeScript build and typecheck: passing
- Frontend TypeScript typecheck: passing
- Frontend internal link audit: passing
- Frontend UI audit: passing

## What was fixed in this pass

- Fixed the frontend production export path by changing the Next.js scripts to run from the actual app root instead of `src`.
- Aligned Capacitor with the real static export output directory (`out`) so Android packaging follows the same production artifact.
- Added a single backend AI runtime seam in [backend/src/config/ai.ts](/c:/Users/mtabe/Notive/backend/src/config/ai.ts) so chat, tagging, NLP, health insights, and embeddings no longer each bootstrap their own vendor client.
- Changed AI analysis metadata from vendor-specific `openai` to vendor-neutral `llm` so future provider swaps do not mislabel results.
- Added a provider-based SSO auth path (`/api/v1/auth/sso/google/credential`) and updated the frontend auth flow to use a generic SSO credential method.
- Hardened Google SSO config validation so empty client IDs fail clearly instead of producing ambiguous token verification behavior.
- Stopped production error responses from leaking raw server exception text.
- Upgraded frontend `next` from `14.1.0` to `14.2.35`.
- Applied backend audit fixes so runtime dependencies now report zero high-severity vulnerabilities.
- Reclassified Capacitor CLI and platform packages as dev-only dependencies so frontend runtime audit results better reflect shipped web/runtime risk.

## Current blockers and risks

### Critical

- None currently.

### High

- Frontend runtime dependency audit still reports one high-severity `next` advisory that `npm audit` only resolves via `next@16.x`, which is a breaking upgrade.

### Moderate

- Frontend full dependency audit still reports a moderate advisory through `@capacitor/cli` and `native-run`, but this is now scoped to dev/build tooling rather than shipped web runtime.

## Recommended next production steps

1. Plan a deliberate Next.js major upgrade path to `16.x` or document the accepted residual risk if you continue serving a static export without a Next server runtime.
2. Decide whether the remaining `@capacitor/cli` moderate advisory is acceptable as build-only tooling risk or whether you want to pursue a separate native tooling update.
3. Run a full post-upgrade smoke pass for login, Google SSO, entry creation, imports, portfolio export, and Android sync.
4. Add environment documentation for the new vendor-neutral AI settings:
   - `LLM_PROVIDER`
   - `LLM_API_KEY`
   - `LLM_MODEL`
   - `LLM_*_MODEL`
5. Add one end-to-end auth test that covers password login, SSO login, refresh rotation, and sensitive-action re-auth.

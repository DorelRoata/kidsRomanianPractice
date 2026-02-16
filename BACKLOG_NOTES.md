# Backlog Notes

## Deferred (Not Current Focus)

Recorded on February 16, 2026:

- Restrict role assignment in `POST /api/auth/register` so users cannot self-register as `parent`.
- Validate/sanitize lesson IDs used for file paths to prevent path traversal in lesson create/update/delete routes.
- Move session secret and default credentials to environment variables and remove hardcoded defaults.
- Add stronger session cookie settings for non-local deployments.
- Reduce `innerHTML` injection risk by escaping user/lesson content before rendering.

## Current Focus

- Build more Pre-K audio-first lessons for non-readers using `listen_and_select` (tap play, then pick item/action).

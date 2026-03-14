# UI Quality Checklist

Use this checklist for any visual/UI change.

## Design System
- Use semantic tokens (`ink`, `surface`, `primary`, `accent`) instead of direct palette utilities where possible.
- Avoid introducing new one-off card/button/input styles when an existing primitive can be reused.
- Keep text readability high; avoid `text-[9px]`, `text-[10px]`, `text-[11px]` unless required by dense metadata.

## Motion
- Use purposeful motion only for key transitions and feedback.
- Do not add new infinite animations unless the element communicates active state.
- Verify `prefers-reduced-motion` still produces usable screens.

## Accessibility
- Ensure interactive controls have visible focus states.
- Confirm touch targets are at least 44px tall/wide for primary actions.
- Check color contrast for labels, helper text, and disabled states.

## Shell + Layout
- Avoid adding redundant persistent context panels to global chrome.
- Keep page header hierarchy clear: title, short description, primary action.
- Ensure desktop and mobile action hierarchy remains consistent.

## Gates
- Run `npm run ui:audit` before opening a PR.
- For strict enforcement in CI or release prep, run `npm run ui:audit:strict`.
- Run `npm run link:audit` to confirm internal navigation targets still map to real routes.

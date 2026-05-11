# Service Happy Path Checklist

Date/time: 2026-05-08
Phase: external demo service flow correction
Verification used: `npm run check`, `npm audit --audit-level=moderate`, HTTP 200 on `http://localhost:3000`, and `happy-path.test.ts` state-flow simulation

## Steps

- [x] Public service intro page is the first screen.
- [x] Login accepts configured credentials.
- [x] Workspace can be selected as first-run setup.
- [x] Company/onboarding data is visible as first-run setup.
- [x] Initial dashboard starts with no Entity/Event definitions.
- [x] Source data upload creates visible uploaded files.
- [x] Analysis job progresses to review-ready.
- [x] Candidates can be viewed by Entity, Event, Relation, and Metric categories.
- [x] One candidate can be edited.
- [x] One candidate can be excluded.
- [x] Remaining candidates can be confirmed.
- [x] Dashboard shows Entity -> Event -> Relation -> Metric -> Decision connection.
- [x] Relation/Metric-backed insight creates a Decision agenda.
- [x] User can vote approve/reject/abstain on the Decision agenda.
- [x] Vote summary updates.
- [x] Decision can be finalized after voting rule is satisfied.
- [x] AI verification hash and audit timeline are generated.
- [x] Outcome record can be saved.
- [x] Reanalysis result and repeat loop are shown.

Known gaps: Browser click automation is not available in this environment, so the full journey is locked by reducer/policy simulation plus build and HTTP verification rather than a recorded browser script.

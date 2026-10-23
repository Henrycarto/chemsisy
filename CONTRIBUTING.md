# Contributing to Chemsisy

Thank you for helping. Chemsisy is small and its content matters more than its code: a clear, correct, sourced note is the most useful contribution there is.

## Correct or suggest a chemistry note

Open an issue with the "Suggest or correct a chemistry note" form. It asks for the drug, the group, what should change and a source. A suggestion without a source cannot be merged, however right it is.

Rules every note follows:

- Written in our own words. Never copy sentences from a source.
- Every claim is backed by a source a reader can open: an open-access review, a ChEBI entry, a PubChem record, an openly licensed textbook. Paywalled-only claims are left out.
- Chemistry and mechanism only. No indications, doses, side effects or anything that reads as clinical advice; the drug page links to the official product information for that.
- Where the science is unsettled, the note says so and cites that.
- British English, no em dashes.

Notes live in `content/notes/<drug>.yaml`, one entry per functional group, keyed by the rule id the app detects (see `src/chem/rules.ts`). The content is licensed CC BY 4.0.

### Review status

Every note shows its review status. "Sourced, not yet reviewed" is the default. A note is marked "Reviewed by [name, role]" only after a named person has checked every claim against its sources. To review a drug's notes:

```sh
node scripts/review-sheet.mjs amoxicillin      # writes review/amoxicillin.html
# open it, check each note, tick the ones you checked, press "Save review file"
node scripts/apply-review.mjs review/amoxicillin-review.json
npm run data
```

Only ticked notes change. The build refuses a "reviewed" note without a name and role.

## Run it

Node 22 or newer.

```sh
npm ci
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
npm run preview      # serve the build, with the offline service worker
```

The starter-set data in `public/data/` is generated and committed. Rebuild it after changing drugs, rules or notes:

```sh
npm run data                     # uses the cache in data/cache, fetches only what is missing
npm run data -- --check-links    # also checks every product-information link
```

## Test it

```sh
npm run typecheck
npm run lint
npm test                 # unit tests: SMARTS rules, search, orientation, labels, content rules
npx playwright install chromium
npm run test:e2e         # browser tests: offline, tooltips, tour, keyboard, accessibility (axe)
npm run size             # build-size budget, after npm run build
npm run check            # privacy and house rules
```

CI runs all of these on every pull request.

## Propose a change to the code

1. Open an issue first for anything larger than a fix, so we can agree on the approach.
2. Branch from `main`, keep the change focused, and add or update tests.
3. Run the checks above, then open a pull request using the template.

Some ground rules for the code:

- No tracking, analytics, cookies or third-party requests from the app. Requests made by the data scripts identify themselves as `Chemsisy/0.1 (https://henrycarto.com)` and carry no personal data.
- New functional-group rules need positive and negative test molecules in `tests/unit/rules.test.ts`.
- Keep the interface quiet: one accent colour for state, borders over shadows, motion only where it teaches and never without honouring reduced motion.
- Accessibility is not optional: keyboard access, screen-reader labels, WCAG AA in both themes.

## Code of conduct

Everyone taking part agrees to the [code of conduct](CODE_OF_CONDUCT.md).

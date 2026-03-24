# THB Weekly Newsletter Pack

This workspace was empty, so this pack sets up a reusable workflow for a weekly THB newsletter focused on India and the Middle East.

## What this pack does

- Defines the weekly issue window as Sunday through Friday in IST.
- Scopes coverage to `Hospitals & Providers`, `Diagnostics`, and `Pharma`.
- Rejects weak article links that land on home pages, category pages, interstitials, or the wrong story.
- Keeps THB action summaries tied only to THB solutions for hospitals/providers, diagnostics, and pharma.
- Excludes health-tech as a THB action theme.

## Weekly operating model

- Coverage window: Sunday `00:00` IST through Friday `23:59` IST.
- Publish cadence: Saturday morning IST.
- Target volume: 20 validated articles per segment.
- Stretch volume: up to 50 validated articles per segment when high-quality coverage is available.
- Floor rule: if strict validation leaves fewer than 20 articles in a segment, publish only the validated items and record the coverage gap instead of using weak links.

## Files

- `newsletter/config/editorial-rules.json`: machine-readable issue rules.
- `newsletter/config/source-catalog.md`: curated source map from the supplied source list.
- `newsletter/prompts/codex-weekly-newsletter-prompt.md`: automation-ready prompt for weekly issue generation.
- `newsletter/templates/weekly-newsletter-template.md`: issue template.
- `newsletter/scripts/validate-newsletter-structure.mjs`: checks segment counts and required fields.
- `newsletter/scripts/validate-newsletter-links.mjs`: follows URLs and flags likely landing pages or mismatched redirects.

## Suggested workflow

1. Generate a draft issue from the template.
2. Run `npm run newsletter:check-structure -- <issue-file>`.
3. Run `npm run newsletter:check-links -- <issue-file>`.
4. Replace any failed links with other validated sources from the approved catalog.
5. Publish only after both checks are clean.

## Notes

- There were no existing issue files in the repository, so this pack sets up the workflow for all future issues rather than retrofitting old ones.
- The prompt and validators are intentionally conservative. They prefer missing an article over shipping a misleading redirect.

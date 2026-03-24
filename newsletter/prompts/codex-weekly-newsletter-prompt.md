# Codex Weekly Newsletter Prompt

Create or refresh the latest THB weekly newsletter covering only India and the Middle East. Treat the issue as a live weekly file refreshed hourly from Sunday through Saturday IST, with each issue covering the full Sunday-to-Saturday window.

If a new Sunday-through-Saturday issue window has started and the issue file does not yet exist, create that new weekly issue automatically, add it to the issue list, and make sure it appears in the site dropdown alongside prior issues.

Use only validated news and press-release items from the approved THB source list. Build exactly three segments:

1. `Hospitals & Providers`
2. `Diagnostics`
3. `Pharma`

For each segment, target 20 validated articles and expand up to 50 only when there is strong, relevant coverage. If strict quality checks leave fewer than 20 usable stories in a segment, keep only the validated stories and record a short `Coverage gap` note instead of using weak links.

For every candidate story:

- Open the final URL and confirm it lands on the same specific story, not a home page, category page, tag page, press-room index, search page, interstitial, or a different article.
- Reject any link that redirects to a general website, another story, an awards page, an about page, or a company home page.
- Reject partner content, advertorials, sponsored stories, and ET HealthWorld pages marked `Brand Connect Initiative`.
- Reject Gulf News pages marked `PARTNER CONTENT`.
- Reject sources without enough readable story text for a user to review the article in detail.
- Replace every rejected story with another validated story from the approved source pool.
- If the same news appears across multiple sources, keep only one version and retain the strongest direct readable article link.
- For the current active issue, mark a story as `Just In: Yes` only when it is newly added in that refresh run compared with the issue file that existed before the refresh.
- For carried-forward stories already present in the issue before the refresh, set `Just In: No`.

Every accepted article must include:

- Headline
- Region: `India` or `Middle East`
- Country
- Source
- Published date
- `Just In` flag
- Direct `Read full story` URL
- A 2-sentence summary
- A `THB Action` tied only to THB offerings for `Hospitals & Providers`, `Diagnostics`, or `Pharma`

THB action rules:

- Do not position THB around health-tech.
- Keep actions practical and commercial.
- Link the action clearly to provider workflows, diagnostics operations, or pharma workflows only.

Output requirements:

- Write the issue in Markdown using the structure from `newsletter/templates/weekly-newsletter-template.md`.
- Save the file to `newsletter/issues/YYYY-MM-DD-weekly-newsletter.md`.
- Update the issue index / manifest so any newly created week appears automatically in the issue dropdown.
- Add a `QA Log` section at the end listing rejected links and the replacement source used.
- Do not publish until every `Read full story` link passes a redirect check.

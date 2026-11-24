# Kane CLI Online Hackathon: requirements side by side

Source: `https://www.kaneclihack.sh/`, read live on 2026-11-24. Organiser: TestMu AI. Slack for questions: linked on the page. Email: conferences@testmuai.com.

## Facts
- Runs 12 to 26 November 2026. **Deadline Thu 26 Nov, 11:59 PM IST** (10:29 AM PT, 18:29 UTC). Extended from 19 Nov. No pushes after the deadline. Submissions can be updated until then.
- Prizes: $3,000 cash. 1st $1,500, 2nd $1,000, 3rd $500, each plus $250 OpenAI credits. Winners also get a 1:1 with the founders, 3 months of Kane CLI Pro, a featured blog post. Every team that ships gets a "Verified with Kane CLI" badge. Every team that submits gets a certificate.
- Eligibility: 18 or older, anywhere, solo or teams of up to four, no application.
- Last edition (Aug 19 to 31, 2026): 69 submissions. Winners: demo.studio (gold), GuardianKane (silver), KANE vs. ABLE (bronze).
- This edition: 113 GitHub repos created since Nov 12 mention Kane CLI. The real submission count is not public.

## What to submit (one form, `https://www.kaneclihack.sh/o/submit`)
1. GitHub URL: public repo, **initialized on or after 12 Nov** (commit history is checked).
2. About the app: what you built, which agent, what Kane does.
3. Demo video on YouTube, about 3 to 5 minutes.
4. Live URL (optional).
5. Launch buzz (required, with bonus): at least two public posts about the project on Hacker News, X, Reddit or LinkedIn. More posts and engagement earn brownie points.

## Before any code
- Register on TestMu AI (same email on both) and claim 10,000 free credits (valid one month): `https://www.testmuai.com/kane-cli/#creditOffer`.
- `npm install -g @testmuai/kane-cli`, run at least one flow. "You must be signed up on testmuai.com and have run Kane CLI to be eligible."

## Judging
Three TestMu AI engineers. Three bars first, then four equal dimensions. Missing a bar means the rest is not scored.
- **Bars:** (1) it works end to end; (2) Kane CLI caught or proved something meaningful; (3) your agent and Kane CLI talked to each other.
- **Ships 25%:** a real flow that runs end to end, not slides.
- **Verified 25%:** Kane caught or confirmed something meaningful.
- **Closed loop 25%:** Kane's result feeds back to the agent. Tighter is better.
- **Craft 25%:** "Would a developer want to install this tonight?"
- Ties break on Verified, then Closed loop.

## Rules
- Any agent, framework or stack. Kane CLI is the only requirement.
- Judges must be able to run it: hand over working credentials for any login or paid service and include a fallback (a recorded run or backup deploy) for third-party services.
- Demos are recorded YouTube videos. Repo public, video on YouTube, two posts.
- One submission per team; the captain receives the prize.
- Entries judged fraudulent, automated, duplicated or gaming may be disqualified. TestMu may feature projects in marketing. Code stays yours.
- Official ideas lanes: web and mobile apps that prove themselves; workflows with a spine (on save, on push, on a schedule); agents with hands (Kane as the agent's hands on the real web); wildcard.

## Side by side with KaneJury

| Requirement | KaneJury answer | State |
|---|---|---|
| Register and claim credits, run Kane | Needed first | **Owner action** |
| Public repo from Nov 12 | `Datwebguy/kanejury`, first commit after Nov 12 | Repo exists, empty |
| Bar 1: works end to end | judge, calibrate, verify run end to end on test images | Built on test images; **not on Kane output** |
| Bar 2: Kane caught or proved something | Needs a real Kane failure or false verdict on a real app | **At risk, depends on real runs** |
| Bar 3: agent and Kane talk | Stop-hook loop with a real coding agent | **Not built** |
| Ships | One command start, README "for judges", live replay page | Partly planned |
| Verified | Receipts with signed evidence, calibration, scoreboard | Receipts built; scoreboard not built |
| Closed loop | Only quorum-confirmed failures go to the agent; Kane re-verifies; re-run Kane only on split votes | Not built |
| Craft | CLI, MCP tool, GitHub Action; plain README; honest limits | CLI built; others planned |
| Judges can run it | Committed real runs plus recording; verify needs no key | Verify works with the shipped example |
| Demo and posts | Script planned | **Owner records and posts** |

## Two gaps found in the side-by-side
1. Craft is judged through a developer's eyes, so the installer must be a developer (CLI, MCP, GitHub Action).
2. The loop must involve a real coding agent. The agent that builds KaneJury should also use Kane to verify KaneJury's own CLI and replay page, as both strong past winners did for their own apps.

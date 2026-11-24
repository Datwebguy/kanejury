# Bench: 25 real Kane CLI runs, Kane alone versus KaneJury

Run on 2026-11-24 with kane-cli 0.10.8 (headless Chrome) on three public sites built for testing: the Playwright TodoMVC demo, "the-internet" practice site and the Swag Labs demo shop (including its deliberately buggy `problem_user`). Each case has a known right answer, from how the page is built; two (S4, S7) were settled by looking at the screenshot. Files: `cases.tsv` (what Kane was asked), `results.csv` (every verdict).

**This is a small, easy, self-authored benchmark.** Read the numbers as a first look, not a measurement of how KaneJury performs in general.

## What happened
| | Result |
|---|---|
| Kane alone | **23 of 24** correct where it produced evidence. One miss: a false green (T10). |
| KaneJury vision jury on the last step screenshot (policy `cautious`) | **21 of 24** correct, 1 undecided, 2 wrong. **No accuracy gain over Kane.** |
| Cost of a Kane run | about 21 credits and 44 seconds per run (balance change: 517.7 credits over 25 runs; Kane's own `run_end` figures add up to 448.9, so it reports about 13% less than the balance moved). |
| Cost of judging | a fraction of a cent per case (three small hosted models). |

## The five cases that taught something
- **T10, false green by improvisation.** Objective: add "x", click Clear completed. Kane **marked x as completed on its own**, then cleared it, and reported "Objective completed". The final screenshot really was an empty list, so the jury agreed with Kane. Only the **step trail** shows what Kane did that nobody asked for.
- **S2, phantom failure.** Kane said "fail" because the browser crashed (`TargetClosedError`) and left no screenshots. The label happens to match the truth. A gate would have sent the coding agent after a bug that was not there. KaneJury's plain-code classifier flags it as infrastructure and calls no model. Across all 25 real packs it flagged exactly this one and nothing else.
- **T7, false red by the jury.** A completed item is a faint struck-through "x". Vision models could not read it; Kane read it from the page. On this kind of evidence Kane is the better reader.
- **T6.** One juror wrongly said pass; the other two said fail. The quorum overruled it. This is the only case where the jury changed an outcome for the better.
- **T8.** The jury was undecided; Kane was right.

## Experimental: trail audit
A text check asks the same hosted models whether the agent did anything the objective did not ask for. It flagged T10 in both runs, but it also raised false alarms: 1 of 25 in the first run, and 6 of 12 in a second run on a subset. **Too noisy to trust yet.** It is not part of the default verdict.

## Limits
- Three sites, 25 cases, written by us; the sites are simple.
- Jurors saw only the last screenshot.
- The jurors are small open models; model output varies between runs even at temperature 0.
- Ground truth for S4 and S7 was set by inspecting the screenshots.
- KaneJury did not change the outcome of any run except T6, and it found no error that Kane made, except the false green and the crash that Kane's own evidence already contained.

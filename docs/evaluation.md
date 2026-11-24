# Evaluation

25 real Kane CLI runs (kane-cli 0.10.8, headless Chrome) on three public practice sites: the Playwright TodoMVC demo, the-internet.herokuapp.com, and the Swag Labs demo shop including its `problem_user`. Each case has a known answer from how the page is built. `bench/cases.tsv` lists what Kane was asked; `bench/results.csv` has every verdict.

## Results

| Measure | Result |
|---|---|
| Kane matched the known answer | 23 of 24 where it left evidence |
| Vision jury on the last screenshot (policy `cautious`) | 21 of 24 matched, 1 undecided, 2 differed |
| Infrastructure classifier | 1 of 1 browser crash identified, 0 false alarms in 25 |
| Cost per Kane run | about 21 credits, 44 seconds |

## Cases worth reading

- **T10, improvisation.** Asked to add "x" and click Clear completed, Kane first marked "x" as completed on its own, then cleared it, and reported success. The final screenshot was a correct empty list, so only the step list shows the extra action.
- **S2, crash.** The browser crashed (`TargetClosedError`) and no screenshots were saved. Kane's label was "fail". The classifier identifies it as infrastructure and no model is called.
- **T6, quorum.** One juror misread the page; the other two outvoted it.
- **T7.** A completed item is a faint struck-through "x". The vision jurors could not read it; Kane read it from the page itself. For text like this the page's own text is the better source.
- **T8.** The jury could not decide; Kane was right.

## Reading the numbers

The bench is deliberately small and easy: three simple sites, cases written for known answers, ground truth for S4 and S7 settled by looking at the screenshot. It shows how each check behaves on real evidence, and it is a starting point rather than a general accuracy figure. The vision jury is most useful as a second look alongside the step checks, which cover what a single screenshot cannot show.

An experimental text audit of the step trail (asking models whether the agent did anything unrequested) flagged T10 but also raised false alarms (1 of 25, then 6 of 12 on a subset), so it is not part of the verdict.

## Live loop

In `demo/`, Kane in its default mode repaired the page to pass in 3 of 3 runs. The repair-to-pass check flagged it, strict mode failed honestly, a coding model fixed the bug, and Kane passed. See `demo/README.md` for the three recorded runs, including one that failed because an added "be strict" sentence broke Kane's parser; the gate now treats Kane's own parser failures as `rerun`.

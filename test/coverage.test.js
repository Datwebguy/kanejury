import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requestedActions, coverageGaps, postActionInputs } from '../src/evidence.js';
const pack = (objective, summaries) => ({ tests: [{ objective, steps: summaries.map((summary, i) => ({ ordinal: i + 1, kind: 'click', summary })) }] });
test('extracts the named clicks from an objective', () => {
  assert.deepEqual(requestedActions('Add a todo item called x, mark it completed, click Clear completed, then verify the todo list is empty'), ['clear completed']);
  assert.deepEqual(requestedActions('Add a todo, click the Completed filter, then verify the list shows x'), ['completed']);
  assert.deepEqual(requestedActions('Click Add Element once, then verify a Delete button appears'), ['add element']);
  assert.deepEqual(requestedActions('Click the Start button, wait for loading to finish, then verify Hello'), ['start']);
});
test('ignores negated clicks such as "without clicking anything"', () => { assert.deepEqual(requestedActions('Verify the page shows Hello World! without clicking anything'), []); assert.deepEqual(requestedActions("Do not press Submit, then verify the form"), []); });
test('reports a requested click that is missing from the recorded steps', () => {
  const g = coverageGaps(pack('Add x, mark it completed, click Clear completed, then verify empty', ['click: Clicking the checkbox to mark the Todo item completed']));
  assert.deepEqual(g.missing, ['clear completed']);
});
test('reports nothing when the click is recorded', () => { assert.deepEqual(coverageGaps(pack('Add x, click Clear completed, then verify empty', ['click: Clicking Clear completed'])).missing, []); });
test('an objective with no named click has nothing to check', () => { assert.deepEqual(coverageGaps(pack('Verify the page has exactly two checkboxes', [])).checked, []); });

test('typing after the last requested click is reported', () => {
  const p = { tests: [{ objective: 'Add a, add b, mark a completed, click Clear completed, then verify the list shows b', steps: [{ ordinal: 1, kind: 'type', summary: 'type b' }, { ordinal: 2, kind: 'click', summary: 'click: Clicking Clear completed' }, { ordinal: 3, kind: 'type', summary: 'Typing b into the new todo input' }, { ordinal: 4, kind: 'press_key', summary: 'submit b with Enter' }, { ordinal: 5, kind: 'assert', summary: 'the list shows b' }] }] };
  assert.deepEqual(postActionInputs(p).steps.map((s) => s.ordinal), [3, 4]);
});
test('nothing is reported when the last requested click ends the actions, or there is no named click', () => {
  assert.deepEqual(postActionInputs({ tests: [{ objective: 'click Clear completed then verify', steps: [{ ordinal: 1, kind: 'click', summary: 'Clicking Clear completed' }, { ordinal: 2, kind: 'assert', summary: 'ok' }] }] }).steps, []);
  assert.deepEqual(postActionInputs({ tests: [{ objective: 'Log in then verify 6 products', steps: [{ ordinal: 1, kind: 'type', summary: 'x' }] }] }).steps, []);
});

# Workflow

How sessions plan and do work. Planning runs in its own sessions, and each task session does one briefed task.

## Roles

- **The user** sets goals and scope, makes decisions (decisions.md), and approves merges and spending.
- **Planning session** (`/replan`): keeps the checklist and task briefs, and integrates finished tasks. Writes no project code.
- **Task session** (`/do-task [ID]`): does one task from its brief. It picks its own method, not its next task.

## Files

| File | Edited by | Holds |
|---|---|---|
| [checklist.md](checklist.md) | Planning sessions | Task status |
| `tasks/<ID>-<slug>/README.md` | Brief: planning sessions. The rest: the task | Brief, Progress, Result, Outputs, For integration |
| plan.md, decisions.md, AGENTS.md | Planning sessions | As before. Task sessions propose edits under For integration |
| `docs/areas/<area>.md` | Tasks whose brief lists them | Verified facts about an area (AGENTS.md, Areas) |

A task folder also holds the task's evidence, small outputs and task-specific scripts. Reusable code goes where the brief says. Facts that outlast the task go into area notes if the brief lists them, and otherwise under For integration. The folder stays as the record.

Only planning sessions edit the shared docs, so parallel task branches don't conflict on them. For example, S1, S3 and S4 all replace plan.md's Compute estimates.

## Permissions

The user approved these on 2026-11-23:

- Planning sessions may commit and push to `main` changes limited to checklist.md and task briefs, without asking.
- Task sessions may commit and push their own `task/*` branch and open a PR. They never merge.

Anything else reaching `main` needs the user's OK each time: task merges, and planning sessions' edits to plan.md, decisions.md and AGENTS.md. So does spending money.

## When to plan

Run `/replan` when any of these happens. The checklist names the one expected next.

- A task has a PR waiting, or stopped on one of its stop conditions.
- A result crosses a gate in plan.md or decisions.md, such as D2's $8 per million games, D7's 30% calc rule or S5's 10% transfer target.
- A phase's exit criteria are met.
- The user has answered something under Needs you.
- The Ready list is empty.

## Planning session

1. **Reconcile.** Fetch. For each Active task, read Progress and Result on its branch or PR. Check its files and any running jobs rather than trusting the status line.
2. **Review finished tasks.** Run the brief's acceptance checks. Then get an independent pass from a separate Opus agent, briefed on what the task did and told not to trust earlier checks. A number that drives a decision is reproduced, not just read. Fixes made after that pass get their own short pass.
3. **Merge, with the user's OK.** Prepare the merge locally. A separate commit applies the task's For integration edits and removes that section. The user sees both and approves pushing them.
4. **Replan.** Decide whether the results change the route to the milestone, and update the checklist. Write briefs only for tasks in the current milestone whose inputs exist and whose decisions are decided (AGENTS.md, Rules). Leave later work in plan.md. Follow-up work gets a new ID. A replaced task is marked superseded, with a link to its successor.
5. **Ask the user.** List pending decisions under Needs you, each with a recommendation, and ask about them together. Record the answers in decisions.md or in the brief they affect.
6. **Close.** Set the next replan trigger, then commit and push the checklist and briefs. Say which Ready tasks can run in parallel because they share no files.

## Task session

1. Read the brief and follow AGENTS.md (Starting a task). If an input is missing, or a decision the brief needs isn't decided, stop and report.
2. Claim or resume:
   - If `origin` has no `task/<ID>-*` branch, branch from `origin/main` as `task/<ID>-<slug>`, commit a first Progress entry and push it, so other sessions see the claim.
   - If the branch exists and its latest Progress entry ends with `Handoff: open`, or the user told you to take it over, resume from it (Checkpoints, below).
   - Otherwise another session has the task, so stop.
3. Change only the paths the brief allows. Put proposed edits to anything else under For integration, with the exact text.
4. If a stop condition is met, stop and report rather than work around it.
5. Checkpoint (below) after any expensive step and at the end of every session.
6. To finish, run the acceptance checks, fill in Result and Outputs, set State to `done`, and open a PR. Don't merge. The task closes when a planning session merges it.

### Checkpoints

Progress tells the next session what it can reuse, how to check it, and what to do first. Keep the latest entry at the top:

```text
State: active | blocked (<what's missing>) | waiting_for_job (<how to check>) | done
Verified: <what passed, with input and code versions>
Pending: <checks not yet passing>
Next: <first concrete action, and what result decides the step after>
Handoff: open   (only when a session ends with the task unfinished)
```

Commit and push the branch, and confirm the remote has the commit. A resuming session claims the task by replacing `Handoff: open` with a new entry and pushing it, then checks the actual files and jobs before trusting State.

## Brief template

````markdown
# T<NN>: <title>

## Brief

- **Objective:** what this establishes or builds, and why now.
- **Inputs:** files, pinned versions, other tasks' outputs at a commit, and the decisions it relies on.
- **Deliverables:** what exists when done, and where.
- **Acceptance checks:** runnable or observable. Done means these pass.
- **May change:** paths. Anything else goes under For integration.
- **Limits:** sessions, wall time, money.
- **Stop and report if:** results that should go back to planning.

## Progress

## Result

Findings, numbers with the commands that produced them, and limits.

## Outputs

How to reproduce or retrieve each output.

## For integration

Proposed edits to shared docs, each with the exact text.
````

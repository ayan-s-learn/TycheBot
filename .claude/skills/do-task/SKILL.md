---
name: do-task
description: Do one TycheBot task from its brief in tasks/, per docs/workflow.md.
argument-hint: "[task ID, e.g. T01]"
disable-model-invocation: true
---

Do task $ARGUMENTS as described in docs/workflow.md (Task session). Its brief is `tasks/$ARGUMENTS-*/README.md`. If no ID was given, take the first Ready task in docs/checklist.md that has no `task/<ID>-*` branch on `origin`.

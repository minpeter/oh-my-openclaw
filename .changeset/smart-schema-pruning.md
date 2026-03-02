---
"oh-my-openclaw": patch
---

Improve apex preset compatibility with strict OpenClaw schema validation by removing unsupported `routing` and `agents.defaults.tools` keys during apply. This also hardens deep merge behavior so null tombstones are stripped from newly added nested branches.

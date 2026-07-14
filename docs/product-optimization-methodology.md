# Product Optimization Methodology Intake

Before every Time Butler product/tool optimization, Codex must read AmosTan product methodology first. This is required context, not optional inspiration.

## Required Read Order

The AmosTan knowledge base is Obsidian-native and no longer maintains README route indexes inside each knowledge domain. Always use this order before deciding or implementing an optimization:

1. Read `/Users/amos/AmosTan/AGENTS.md`.
2. Read `/Users/amos/AmosTan/rag/README.md`.
3. From `/Users/amos/AmosTan`, query the optimization question with local RAG:

```bash
./tools/rag query "<optimization question>"
```

4. Use the results and `rag/runtime/latest_context_pack.md` only as retrieval guidance.
5. Read the matched original `.md` files before making decisions. Do not treat the context pack or a missing historical README as the methodology source.

Route the query toward these current original-note domains when relevant:

- User need, scenario, task, pain, false demand: `产品基本功/业务分析/1-需求原点/需求原点实操*.md`.
- Product core, MVP, minimal loop, core experience: `产品基本功/业务分析/2-产品内核/产品内核*.md`.
- Low-cost validation, key assumptions, experiments: `产品基本功/业务落地/精益实验/低成本验证*.md`.
- Funnel, activation, friction, motivation, touchpoint: `产品基本功/业务落地/转化率/转化率黑客*.md`, `武器库_阻力消除策略.md`, or `武器库_触点策略.md`.
- Metrics, business formula, parameters, hypothesis pool: original notes under `产品基本功/业务落地/业务公式/`.

The legacy `python3 tools/knowledge_rag.py query ...` entry remains compatible, but new workflow documentation should use `./tools/rag query`.

## Product Optimization Frame

Treat the user as the user, not as the product manager. Codex owns product/design judgment for small Time Butler improvements.

For each optimization, write or internally answer:

1. **User path**: What was the actual path, signal, or friction? Use `app_events`, sessions, tasks, completion reviews, page content, or user feedback.
2. **Demand extraction**: What user/scenario/problem is behind it? Do not start from a feature idea.
3. **Key assumption**: What must be true for the improvement to help?
4. **Smallest product core**: What is the smallest change that can improve or validate the path?
5. **Validation**: What local check proves the change works? Prefer tests, build, script syntax checks, SQL verification, or a reproducible UI path.
6. **Risk boundary**: Does it touch active timer state, user data, private logs, or broad workflows?

## Autonomy

The user has delegated product and design decisions. Default to making a reasonable product choice and implementing it when:

- The change is scoped to Time Butler.
- The expected work is no more than 4 pomodoros.
- The change is reversible through git or database backup.
- It can be validated locally.
- It does not require rewriting user task/session data.
- It does not need a Tauri dev server restart while the user may be timing.

Ask the user only when the decision changes data semantics, removes user data, introduces an external service, changes privacy posture, or has a blast radius that cannot be locally verified.

## Output Expectations

When reporting the optimization, include:

- The product signal or methodology lens used.
- What changed.
- What was deliberately not changed and why.
- Validation result.
- Any follow-up product hypothesis worth watching in `app_events`.

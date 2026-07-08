# Product Optimization Methodology Intake

Before every Time Butler product/tool optimization, Codex must read AmosTan product methodology first. This is required context, not optional inspiration.

## Required Read Order

Always read these files before deciding or implementing an optimization:

1. `/Users/amos/AmosTan/AGENTS.md`
2. `/Users/amos/AmosTan/README.md`
3. `/Users/amos/AmosTan/AI_RETRIEVAL_GUIDE.md`
4. `/Users/amos/AmosTan/产品基本功/README.md`
5. `/Users/amos/AmosTan/产品基本功/业务分析/README.md`
6. `/Users/amos/AmosTan/产品基本功/业务落地/README.md`

Then read the relevant original method notes based on the problem:

- User need, scenario, task, pain, false demand: `/Users/amos/AmosTan/产品基本功/业务分析/需求分析/README.md`, then the relevant `需求实操*.md`.
- Product core, MVP, minimal loop, core experience: `/Users/amos/AmosTan/产品基本功/业务分析/产品内核/README.md`, then the relevant `产品内核*.md`.
- Low-cost validation, key assumptions, experiments: `/Users/amos/AmosTan/产品基本功/业务落地/精益实验/README.md`, then the relevant `低成本验证*.md`.
- Funnel, activation, friction, motivation, touchpoint: `/Users/amos/AmosTan/产品基本功/业务落地/转化率/README.md`, then the relevant `转化率黑客*.md`, `阻力消除策略.md`, or `触点策略.md`.
- Metrics, business formula, parameters, hypothesis pool: `/Users/amos/AmosTan/产品基本功/业务落地/业务公式/业务公式_认知篇.md` and related `业务公式*.md`.

If the right file is unclear, run local RAG from `/Users/amos/AmosTan`:

```bash
python3 tools/knowledge_rag.py query "<optimization question>"
```

Use the context pack only as retrieval guidance; read the original matched `.md` files before making decisions.

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

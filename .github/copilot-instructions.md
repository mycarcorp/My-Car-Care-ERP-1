# Copilot instructions

Before building or changing anything in this repo, read `docs/agent-os/AGENT_OS.md` and apply it.

- Every automated action writes an `agent_events` row (section 8).
- Add an approval step wherever a human gate applies (section 6).
- Choose models by tier (section 3); never hard-code one model.
- Customer messages must meet the compliance baseline (section 7).
- Map each workflow to an agent in the roster (section 4).
- Never commit secrets. Don't commit or push without asking.
- When the work adds an agent, gate or step, update AGENT_OS.md and bump its version.

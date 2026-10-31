# MyCar Agent OS — standing spec for the ERP

> **Every AI assistant working in this repo (Copilot, Claude, Codex, Cursor) must read and apply this file before building any feature.**
> If a change touches customers, money, messages, documents, or staff, it must fit this spec: emit agent events, respect human gates, and register in the agent roster.

Version 1.0 · Owner: CEO · Review quarterly

---

## 1. Mission

Run every company in the portfolio by system, not by hustle. Agents do the work. Humans approve only what the rules send them. Goal: owner independence, a 5-minute daily executive report per business, and an operating record clean enough for IPO-grade audits.

**Principles**
1. Automate first. A human is the last option, not the first.
2. One system of record: the ERP. Every agent reads from it and writes back to it.
3. Every agent action is logged. If it isn't in the event log, it didn't happen.
4. Agents may retry, reroute, hand off and spawn helpers. They may not move money, sign, or change their own permissions without a human.
5. Start in draft-and-approve mode. Earn full autonomy with two weeks of clean results.

---

## 2. Architecture

| Layer | What | Already in this repo? |
|---|---|---|
| System of record | ERP: customers, vehicles, repair orders, estimates, invoices, payments, expenses, vendors, staff | Yes (`packages/core`) |
| Agent runtime inside the ERP | Embedded AI agent with tool loop, approval requests, page/form control | Yes (`packages/plugins/ai-chat`, `ai-chat-react-ui`) |
| Model providers | Gemini, OpenAI, Anthropic, Grok, others; per-tenant keys (BYOK) | Yes (`packages/plugins/ai-provider-*`) |
| ERP tools for outside agents | MCP server exposing ERP actions | Yes (`packages/mcp-server`, `apps/mcp`) |
| Switchboard and schedules | n8n: triggers, routing, cron, retries | To build |
| Email and documents | Google Workspace: Gmail, Drive, Calendar, Workspace Studio | Owned |
| Phone and texting | Twilio number, 10DLC registered | To build |
| Payments | Stripe payment links and webhooks | To build |
| Social and ads | Meta, Google Business Profile, TikTok, YouTube APIs | To build |
| Agent event log | `agent_events` table + API, feeds the Agent Grid dashboard | To build (section 8) |

---

## 3. Model policy: the most expert model for each job

Pick the model by the stakes of the task, not by habit. Re-benchmark every quarter and update this table.

| Tier | Use for | Default model | Fallback |
|---|---|---|---|
| **T1 Volume** | Sorting, tagging, extraction, routine replies, status texts, filing | Gemini Flash | GPT-5.x mini class |
| **T2 Judgment** | Sales conversations, complaints, negotiations, content, analysis | Claude Sonnet 5.5 or GPT-6 | The other one |
| **T3 Expert / high stakes** | Contracts, legal and compliance review, tax positions, financial statements, anything over a money limit | Claude Opus 5.5 or GPT-6, with mandatory human sign-off | The other one |
| **Build** | Code, ERP features, landing pages, apps | Claude Code or Codex | The other one |

Routing rules:
- The Switchboard tags every task with a tier. Low confidence moves the task up one tier.
- Legal words, threats, refunds, contracts, or tax questions are always T3.
- A model error or timeout reruns the task on the fallback before any human is alerted.
- Track cost and accuracy per agent per month in the event log.

---

## 4. Agent roster

Each agent has: a job, the systems it can touch, its default tier, its backup, and its human gate. Start with MyCar Business Services and My Car Care; clone the roster for the other companies once stable.

### Command
| Agent | Job | Backup | Human gate |
|---|---|---|---|
| **Supervisor** | Watches heartbeats, runs the repair ladder, reassigns queues, alerts humans | Orchestrator | Stuck after repair ladder |
| **Orchestrator** (Chief of Staff) | Breaks big goals into tasks, assigns agents, spawns helpers via the Agent Factory | Supervisor | New permanent agent types |
| **Agent Factory** | Creates helper agents from approved templates (section 5) | — | Any template outside the approved list |
| **Analyst** | Daily 6:45 AM CEO report, KPI rollups, cost per lead, margins by line | Supervisor | None (read only) |

### Revenue
| Agent | Job | Backup | Human gate |
|---|---|---|---|
| **Alex** (existing) | Answers leads in under a minute, qualifies, quotes, books | Concierge | Discounts over limit, fleet deals |
| **Scout** | Pulls and scores leads from ads, social, Google, web; dedupes; hands hot leads to Alex | Analyst | None |
| **Fleet & Insurance BD** | B2B outreach to fleets, insurers, dealers; follow-up sequences; tracks contracts | Alex | All contract terms |
| **Acquisition Scout** | Watches auctions and trade-in channels for vehicles that fit buy criteria | Analyst | Every bid or purchase |

### Customer
| Agent | Job | Backup | Human gate |
|---|---|---|---|
| **Concierge** | Repair order status, questions, pickup follow-up, feedback | Alex | Complaints, comebacks, refunds |
| **Reputation** | Review requests, review replies, rating monitoring | Herald | 1–2 star replies |

### Marketing & Brand
| Agent | Job | Backup | Human gate |
|---|---|---|---|
| **Herald** | Posts, comments, DMs across social in brand voice | Reputation | New campaigns |
| **Content Studio** | Scripts, captions, short-video plans, blog and email content from the content library | Herald | New content style, CEO on-camera scripts |
| **Ads Manager** | Runs and tunes ad spend within budget, pauses losers, reports cost per lead | Analyst | Budget increases |

### Operations
| Agent | Job | Backup | Human gate |
|---|---|---|---|
| **Clerk** | All Gmail inboxes: sort, save attachments to Drive, forward, log in ERP | Supervisor queue | Contracts, legal notices |
| **Scheduler** | Bays, technicians, appointments, reminders, no-show follow-up | Concierge | None |
| **Parts & Inventory** | Parts ordering, stock levels, vehicle inventory status | Clerk | Orders over limit |
| **Vendor Desk** | Vendor outreach, quotes, purchase orders, delivery follow-up | Parts & Inventory | New vendors, POs over limit |

### Finance & Accounting
| Agent | Job | Backup | Human gate |
|---|---|---|---|
| **Cashier (AR)** | Payment links on invoice, posting payments, reminders at 3 and 7 days | Concierge | Refunds, disputes, write-offs |
| **Payables (AP)** | Captures bills, matches to POs, schedules payment for approval | Clerk | Every payment release |
| **Bookkeeper** | Categorizes transactions, bank reconciliation, month-end close checklist | Payables | Month-end sign-off |
| **Tax Prep** | Sales-tax tracking, 1099 vendor list, year-end package for the CPA | Bookkeeper | **All filings are signed by the CPA** |
| **Payroll Prep** | Hours, commissions, flat-rate tech pay calculations, payroll file | Bookkeeper | Every payroll run |

### Legal & Compliance
| Agent | Job | Backup | Human gate |
|---|---|---|---|
| **Compliance Watch** | Checks outbound messages, ads and documents against the rules in section 7; flags risk | Orchestrator | Any flag |
| **Contract Desk** | Drafts and redlines contracts from approved templates, tracks renewals | Compliance Watch | **All contracts reviewed by counsel or CEO** |

### People
| Agent | Job | Backup | Human gate |
|---|---|---|---|
| **Staff Comms** | Shift messages, announcements, policy questions, onboarding checklists | Scheduler | Discipline, termination, pay disputes |
| **Recruiter** | Job posts, screening, interview scheduling | Staff Comms | Offers |

### Build
| Agent | Job | Backup | Human gate |
|---|---|---|---|
| **Builder** | ERP features, landing pages, booking pages, apps; opens pull requests | — | **Every release** |
| **QA & Security** | Tests, dependency and secret scans on every pull request | Builder | Failing security checks |

---

## 5. Agent Factory: agents creating agents

Agents may create helper agents to finish a job. Guardrails make this safe:

1. **Templates only.** Helpers are created from an approved template list (e.g. "research helper", "outreach sequence helper", "document extraction helper"). A new template needs CEO approval.
2. **Permissions never grow.** A helper gets equal or fewer permissions than its parent. No new credentials.
3. **Budget and time cap.** Every helper has a spend cap and an expiry (default 24 hours).
4. **Never allowed for helpers:** moving money, signing anything, deleting records, sending to more than 50 recipients, changing permissions or prompts.
5. **Logged.** Creation, every action, and shutdown go to `agent_events` with the parent agent's ID.

"By any means" is limited to lawful means within these rules. Speed never overrides section 6 or 7.

---

## 6. Autonomy levels and human gates

| Level | Meaning | Who can promote |
|---|---|---|
| L0 Draft | Agent drafts; human sends | — |
| L1 Approve | Agent acts after one-tap approval | GM |
| L2 Auto + audit | Agent acts; humans review a daily sample | CEO |
| L3 Full auto | Agent acts; exceptions only | CEO, after 30 days clean at L2 |

Always human, at every level: refunds and write-offs over the limit, contracts, tax filings, payroll release, payments to vendors, hiring and firing, legal responses, and any agent stuck after the repair ladder.

Approvals arrive as one text or chat card with Approve / Reject, routed to: **CEO** (contracts, budget, new agents), **GM Tahid** (customers, refunds, operations), **Philippines team** (content QA, queue triage, call fallback).

---

## 7. Compliance baseline (agents must follow; humans must verify)

Agents assist with compliance; they are not the lawyer or the CPA. Have counsel and your CPA confirm this list for Virginia and each business line.

- **Texting:** TCPA consent before marketing texts; opt-out (STOP) honored instantly; Twilio 10DLC registration before launch.
- **Email:** CAN-SPAM: real sender, physical address, working unsubscribe.
- **Customer data:** dealers that arrange financing fall under the FTC Safeguards Rule: written security program, MFA, encryption, access logs. Agents get least-privilege access only.
- **Vehicle sales:** FTC Used Car Rule (Buyers Guide), Virginia Motor Vehicle Dealer Board rules on licensing and advertising.
- **Repair:** written estimates and authorization before work, per Virginia consumer protection rules.
- **Ads and reviews:** FTC endorsement and fake-review rules; no incentivized reviews without disclosure.
- **Records:** keep financial and transaction records per CPA guidance; agents never delete source documents.

---

## 8. Event log: how the Agent Grid becomes live

Every agent writes one event per action. The Supervisor and the Agent Grid dashboard read only from here.

```text
agent_events
  id            uuid
  occurred_at   timestamp
  company       enum (mycar_sales, my_car_care, home_value_builder, inbackoffice, drama_king, estate_holdings)
  agent         text          -- e.g. "cashier"
  parent_agent  text nullable -- set for Agent Factory helpers
  kind          enum (heartbeat, task_started, task_done, handoff, escalation, error, recovered, approval_requested, approval_given)
  task_ref      text          -- e.g. RO-2381, INV-1094, lead id
  model         text          -- model actually used
  tier          enum (T1, T2, T3, build)
  cost_usd      numeric
  summary       text          -- one plain sentence
  needs_human   boolean
```

Heartbeat rule: each agent sends a heartbeat at least every 10 minutes while active. Two missed heartbeats start the repair ladder:
1. Retry 3 times (1, 5, 15 minutes). 2. Switch to the fallback model. 3. Reassign the queue to the backup agent. 4. Text GM Tahid with what broke and what was tried. 5. Open a fix ticket for the Builder; a human approves the fix.

---

## 9. Build steps (in order)

Each step ships, runs two weeks in L0/L1, then moves on.

| Step | What | Done when |
|---|---|---|
| 0 | Run the ERP locally (`yarn start`, demo login) | Service Center screens load |
| 1 | Commit this file plus the assistant instruction files | Copilot and Claude cite it when building |
| 2 | Configure AI providers in the ERP: Gemini (T1), Anthropic + OpenAI (T2/T3) keys in Settings → AI; default provider Gemini Flash | ERP chat answers using Gemini |
| 3 | Build the `agent_events` module (entity, API, permissions) and connect the Agent Grid page to it | Dashboard shows real events |
| 4 | Enable the ERP MCP server for outside agents with a scoped service account | n8n can read and write a repair order |
| 5 | n8n + Workspace: Clerk and Analyst (6:45 AM report) | Report arrives daily; inbox sorted |
| 6 | Twilio 10DLC, Alex on the main number, Concierge status texts | Customers get status texts automatically |
| 7 | Stripe: Cashier, then Payables and Bookkeeper | Invoices paid by link and posted to ERP |
| 8 | Scout, Herald, Content Studio, Ads Manager, Reputation | Leads and impressions flow into ERP with source |
| 9 | Compliance Watch, Contract Desk, Tax Prep, Payroll Prep, Staff Comms | Every outbound message is compliance-checked |
| 10 | Orchestrator and Agent Factory with templates | Agents spawn helpers within caps, all logged |
| 11 | Clone roster for Home Value Builder, inBackOffice, Drama King, My Estate Holdings | Each company has its own 6:45 AM report |

---

## 10. Rules for AI coding assistants in this repo

When you build or change anything:
1. Check which agent in section 4 owns the workflow. If none does, propose one; don't build an orphan.
2. Every automated action must write an `agent_events` row.
3. Respect section 6: add an approval step wherever a human gate applies.
4. Use the tier policy in section 3; never hard-code one model.
5. Never put secrets in code or chat. Keys live in `.env` or ERP Settings → AI.
6. Messages to customers must pass section 7 checks (consent, opt-out, disclosures).
7. Don't commit or push without the human's go-ahead.
8. Update this file when you add an agent, a gate, or a step. Bump the version.

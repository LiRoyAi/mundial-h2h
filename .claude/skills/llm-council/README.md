# LLM Council

A Claude skill that turns one question into five expert opinions, then a single clear verdict.

Works in **Claude Code** and **Claude on the web** (claude.ai).

> Credit where it's due: this skill was created by [Ole Lehmann](https://x.com/itsolelehmann), based on Andrej Karpathy's [LLM Council](https://github.com/karpathy/llm-council) methodology. This repo is my lightly rewritten version, packaged so it's easy to install and share.

---

## What's a skill?

A skill is a small set of instructions you hand to Claude. Think of it as a job description for one specific task. You install it once, then trigger it with a phrase, and Claude knows exactly how to handle that job from then on.

This skill teaches Claude how to run a "council" for you. When you've got a hard question or a real decision to make, Claude spins up five different advisors. Each one looks at your problem from a completely different angle, they critique each other's thinking, and then a chairman pulls it all together into one straight answer.

---

## What it does

Ask one AI a question and you get one answer. It might be brilliant. It might be average. The problem is you can't tell, because you only ever saw a single point of view.

The council fixes that. It runs your question through five independent advisors, each reasoning from a different angle. They peer-review each other's work. Then a chairman synthesises everything into a final recommendation: where the advisors agree, where they disagree, and what you should actually do about it.

The five advisors are:

- **The Contrarian** — hunts for the fatal flaw you're avoiding.
- **The First Principles Thinker** — asks whether you're even solving the right problem.
- **The Expansionist** — finds the upside everyone else is missing.
- **The Outsider** — has zero context and reacts purely to what's in front of them.
- **The Executor** — only cares whether it can actually be done, and what to do first.

---

## When to use it

The council earns its keep when being wrong is expensive and the answer isn't obvious.

**Good council questions:**

- "Should I launch a £97 workshop or a £497 course?"
- "Which of these 3 positioning angles is strongest?"
- "I'm thinking of pivoting from X to Y. Am I crazy?"
- "Here's my landing page copy. What's weak?"
- "Should I hire a VA or build an automation first?"

**Bad council questions:**

- "What's the capital of France?" — one right answer, no perspectives needed.
- "Write me a tweet" — that's a creation task, not a decision.
- "Summarise this article" — processing, not judgment.

The council shines when there's genuine uncertainty and a bad call costs you. If you already know the answer and just want a pat on the back, fair warning: the council will probably tell you things you don't want to hear. That's the whole point.

---

## How to install it (no terminal needed)

Pick whichever option feels easier. Both work in Claude Code and Claude on the web.

### Option 1: Let Claude install it for you

Open a new chat in Claude and paste this in:

> Please install this Claude skill for me. The SKILL.md file lives in this GitHub repo: https://github.com/oliwoodman/llm-council-skill
>
> Set it up so I can start using it, and walk me through anything you need from me.

Claude will grab the file and drop it in the right place. If your setup needs a manual step, it'll tell you exactly what to click.

### Option 2: Download the file and ask Claude to set it up

1. Click [SKILL.md](./SKILL.md) at the top of this repo.
2. Use the download button on the right of the file view to save it to your computer.
3. Open Claude and paste this in:

> I just downloaded a file called SKILL.md for the LLM Council skill. Can you install it for me and walk me through where to put it?

Claude takes it from there.

---

## How to use it

Once it's installed, drop one of these into any Claude conversation:

- "council this"
- "run the council on [your question]"
- "pressure-test this"
- "stress-test this"
- "war room this"

Claude spins up the five advisors, runs the peer review, and hands you the chairman's verdict.

---

## Credit

Built by [Ole Lehmann](https://x.com/itsolelehmann) — go follow him, he cooks. The methodology is adapted from Andrej Karpathy's [LLM Council](https://github.com/karpathy/llm-council).

This repo just makes the skill easy to install and pass on to anyone who wants to try it.

# Per-task ChatGPT model / reasoning tier selection — v2.10.7

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-28

## 1. Live DOM evidence

The current signed-in ChatGPT composer on `gloria-macbook-air` exposes its model/reasoning control as:

```html
<button
  aria-label="选择 ChatGPT 模型"
  data-codex-intelligence-trigger="true"
  data-composer-navigation-target="reasoning"
  data-selected-reasoning-effort="max"
  aria-haspopup="menu"
  aria-expanded="false"
>...</button>
```

Opening this control exposes a Radix menu containing:

```html
<div role="menu">
  <div role="menuitem" aria-label="强度" data-reasoning-slider="true">
    ...
    <span
      role="slider"
      aria-valuemin="0"
      aria-valuemax="4"
      aria-valuenow="3"
    ></span>
  </div>
</div>
```

The slider advertises `ArrowLeft ArrowRight` keyboard control.

Live mapping, verified by moving the real slider and reading the DOM after each step:

| slider value | ChatGPT label | trigger effort |
| ---: | --- | --- |
| 0 | 即时 | `none` |
| 1 | 中 | `medium` |
| 2 | 高 | `high` |
| 3 | 极高 | `max` |
| 4 | Pro | combined power-slider model tier; trigger effort may report `medium` |

The fifth position is not simply another reasoning-effort string: on the live page it switches the combined power slider to the `Pro` model tier. Therefore the persistent task value must be the slider tier, not only `data-selected-reasoning-effort`.

## 2. Problem

Fabushi currently does not inspect or set the ChatGPT model/reasoning picker before dispatch. Whatever ChatGPT last selected is silently inherited.

The task composer also currently exposes only:

- task mode
- automatic authorization
- Send

There is no persisted per-task model-tier field.

This violates the desired behavior: the tier selected in the Fabushi task form must be applied to ChatGPT before each Work/review dispatch.

## 3. Goal

Add an explicit model-tier selector to the Fabushi task submission form and make dispatch fail closed until ChatGPT confirms the matching slider position.

## 4. Task tiers

Persist exactly one of:

- `instant` — slider 0 — 即时
- `medium` — slider 1 — 中
- `high` — slider 2 — 高
- `max` — slider 3 — 极高
- `pro` — slider 4 — Pro

Default for newly created and legacy tasks: `max` (极高).

This keeps the existing project requirement that ordinary automated work should use the strongest non-Pro reasoning tier unless the task explicitly selects another tier.

## 5. Requirements

- R1: Task composer adds a visible/selectable model-tier control with all five tiers.
- R2: New tasks persist the selected tier.
- R3: Existing persisted tasks without a tier migrate to `max`.
- R4: Task sidebar/detail UI shows the persisted tier so the selected dispatch configuration is auditable.
- R5: The tier persists across Work → review → next Work rounds for the same task.
- R6: `enqueue_tasks` accepts `modelTier` / `reasoningTier` and defaults to `max`.
- R7: Before any prompt text is sent, Fabushi must locate the ChatGPT reasoning/model trigger.
- R8: Fabushi opens the menu only when needed, locates `[data-reasoning-slider=true] [role=slider]`, reads `aria-valuenow`, and moves by bounded ArrowLeft/ArrowRight steps.
- R9: Each step must be observed in the DOM; synthetic input is not assumed successful.
- R10: The final slider value must equal the task's desired tier before the Send button may be clicked.
- R11: If the requested tier cannot be selected, the task must not send under a different model/tier.
- R12: The menu is closed after successful verification.
- R13: Repeated supervision is idempotent: if the page already matches the task tier, no unnecessary slider mutation occurs.
- R14: A fresh ChatGPT page, a resumed task, a review phase, and every later round all re-verify the tier immediately before dispatch.
- R15: Existing model picker state outside Fabushi is not changed while Fabushi is only supervising an already-sent conversation.
- R16: Existing local-route, fallback-turn, final reply, attachments, authorization, and bounded recovery behavior remains green.
- R17: Release as v2.10.7 only after exact-head and canonical-main tests pass.

## 6. Detection strategy

Primary trigger:

`button[data-codex-intelligence-trigger="true"][data-composer-navigation-target="reasoning"]`

Fallback trigger:

a visible button with `data-selected-reasoning-effort` and ChatGPT-model semantics.

Slider:

`[data-reasoning-slider="true"] [role="slider"]`

Stable verification:

- `aria-valuemin`
- `aria-valuemax`
- `aria-valuenow`

For slider positions 0–3, `data-selected-reasoning-effort` is useful secondary evidence.
For position 4, the slider value itself is authoritative because the combined Pro tier does not map 1:1 to a reasoning-effort string.

## 7. Dispatch ordering

Correct order:

1. navigate to fresh ChatGPT composer;
2. wait for page/composer readiness;
3. ensure selected model tier;
4. ensure attachments;
5. populate exact prepared prompt;
6. re-check tier is still correct;
7. click Send once.

The second verification protects against a renderer remount between attachment upload and final click.

## 8. UI behavior

Fabushi task form adds:

`模型档位: 即时 / 中 / 高 / 极高 / Pro`

Default: `极高`.

Task rows/details display the chosen tier.

Changing the form selection affects only newly submitted tasks; an existing task keeps its persisted tier through all phases/rounds.

## 9. Regression tests

1. new task defaults to `max`;
2. explicit task tier persists;
3. legacy task migrates to `max`;
4. model selector renders all five options;
5. already-correct slider requires no key steps;
6. max → high sends one ArrowLeft;
7. instant → max sends three ArrowRight steps;
8. max → Pro reaches slider value 4 even though trigger effort becomes `medium`;
9. unavailable/non-moving slider blocks Send;
10. slider/menu missing blocks Send;
11. tier is re-verified immediately before clicking Send;
12. review/next-round dispatch keeps the same task tier;
13. API enqueue accepts `modelTier`;
14. existing full suite remains green.

## 10. Acceptance

Selecting `极高` in Fabushi must guarantee that the ChatGPT composer is at slider position 3 before the task is sent. Selecting any other tier must similarly guarantee its exact live slider position; Fabushi must never silently inherit the page's previous selection.

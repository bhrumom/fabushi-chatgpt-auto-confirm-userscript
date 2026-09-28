# Per-task ChatGPT reasoning/model preset enforcement — v2.10.7

Status: active
Owner: Fabushi ChatGPT Auto-confirm
Last updated: 2026-09-28

## 1. Live ChatGPT structure

The current signed-in Mac Chrome page was inspected directly. The composer exposes a stable trigger:

```html
<button
  aria-label="选择 ChatGPT 模型"
  aria-haspopup="menu"
  data-codex-intelligence-trigger="true"
  data-composer-navigation-target="reasoning"
  data-selected-reasoning-effort="max">
  极高
</button>
```

When opened, the menu contains:

```html
<div role="menu" data-state="open">
  <div role="menuitem"
       aria-label="强度"
       data-reasoning-slider="true"
       aria-keyshortcuts="ArrowLeft ArrowRight">
    <span role="slider"
          aria-valuemin="0"
          aria-valuemax="4"
          aria-valuenow="3"></span>
  </div>
</div>
```

The live five-position slider was walked one detent at a time with trusted keyboard input. Exact mappings observed:

| Slider index | UI label | data-selected-reasoning-effort |
| ---: | --- | --- |
| 0 | 即时 / Instant | none |
| 1 | 中 / Medium | medium |
| 2 | 高 / High | high |
| 3 | 极高 / Extra High | max |
| 4 | Pro | medium |

The fifth position is a model/preset transition to Pro, so `data-selected-reasoning-effort` alone cannot distinguish index 1 from index 4. The canonical identity must therefore be the slider index while the menu is open.

## 2. Goal

Add a per-task ChatGPT model/thinking preset in the Fabushi task composer and enforce that exact five-position ChatGPT preset before every task dispatch.

The task must never be sent first and corrected afterward.

## 3. Requirements

- R1: New-task UI exposes exactly the five live presets: 即时、中、高、极高、Pro.
- R2: New tasks persist one preset index `0..4` as part of task state.
- R3: Default preset is index 3, 极高 / Extra High.
- R4: The selected preset applies to Work, review/planning, continuation, and every later round of the same task.
- R5: Before a fresh ChatGPT Send click, the script reads the live model trigger and opens the picker if needed.
- R6: Enforcement uses `[data-reasoning-slider="true"] [role="slider"]` and `aria-valuenow`, not only `data-selected-reasoning-effort`.
- R7: The script moves the slider with ArrowLeft/ArrowRight keyboard events one detent at a time, with bounded waits for React state to settle.
- R8: After adjustment, the script re-reads `aria-valuenow`; Send remains blocked until it equals the task preset.
- R9: If the model trigger, menu, slider, or target position cannot be confirmed, the task waits with a clear status and does not click Send.
- R10: If the already-selected live index equals the desired task preset, no UI mutation is performed.
- R11: Pro index 4 is distinguished from Medium index 1 by slider index.
- R12: The menu is closed after successful confirmation so it cannot cover composer controls.
- R13: Existing persisted tasks without a preset migrate logically to index 3 (极高) without rewriting their prompt/token/conversation identity.
- R14: The task detail feed displays its configured preset.
- R15: Programmatic API enqueue accepts an optional `reasoningPreset`; omitted values default to 极高.
- R16: Model/preset adjustment does not create a second Send click, regenerate a task token, or alter attachment state.
- R17: Existing transient-route, fallback-turn, final-reply, recovery, and attachment regressions remain green.
- R18: Release as v2.10.7 only after exact-head and canonical-main tests pass.

## 4. Implementation design

Introduce:

- `REASONING_PRESETS`
- `normalizeReasoningPreset()`
- `reasoningPresetLabel()`
- `reasoningPickerTrigger()`
- `openReasoningSlider()`
- `ensureTaskReasoningPreset(task, signal)`

Enforcement is placed in `send()` after the fresh page is hydrated and known blockers are cleared, but before task attachments/prompt typing and before Send-button lookup.

The slider menu is controlled through the same DOM contract ChatGPT exposes for keyboard accessibility. Synthetic bubbling/cancelable `KeyboardEvent('keydown')` was verified on the live Mac page to update the React/Radix picker, so this does not require pixel coordinates.

## 5. Verification

Focused tests:

1. default enqueue stores 极高 index 3.
2. explicit 0/1/2/3/4 selections are preserved.
3. already-correct index performs zero Arrow mutations.
4. Medium -> Extra High walks exactly two detents and verifies index 3.
5. Extra High -> Pro reaches index 4 even though both Pro/Medium can expose `medium` effort in other states.
6. missing picker blocks Send.
7. slider that fails to update blocks Send.
8. Send integration proves the preset is confirmed before the sole Send click.
9. task detail displays configured preset.
10. legacy tasks without a preset resolve to 极高.
11. full suite remains green.

## 6. Acceptance

A task configured as 极高 must cause ChatGPT to be visibly and structurally at slider index 3 before its prompt is sent. A task configured as any other preset must likewise select that corresponding live slider index first.

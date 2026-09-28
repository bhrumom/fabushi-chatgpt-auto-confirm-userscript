# Live fallback-turn renderer support — v2.10.5

Status: active  
Owner: Fabushi ChatGPT Auto-confirm  
Last updated: 2026-09-28

## 1. Live reproduction

The bug was reproduced on the online macOS device `gloria-macbook-air` against the signed-in Chrome tab:

`https://chatgpt.com/c/6ab9b036-3c10-83e8-a4f8-d9b52cae22ad`

The page visibly contained the completed conversation, user messages, assistant replies, Copy controls, and the composer, but the userscript still logged that the message area was not mounted.

A direct JavaScript inspection of the live page showed:

- `[data-message-author-role]`: 0
- `[data-turn="user|assistant"]`: 0
- `[data-author-role="user|assistant"]`: 0
- `[data-content-search-turn-key]`: 5
- `[data-content-search-unit-key]`: 9
- assistant units ending in `:assistant`: 4
- user units ending in `:user`: 5
- `[data-conversation-role]`: 4
- `[data-markdown-text-style="assistant-message"]`: 5

Therefore v2.10.4 still missed the actual renderer used by this live Chrome build.

## 2. Actual renderer structure

The current renderer groups one logical user→assistant exchange in one outer turn:

```html
<div data-content-search-turn-key="fallback-turn-3">
  ...
  <div data-content-search-unit-key="fallback-turn-3:0:user">
    <div data-user-message-bubble="true">...</div>
    <button aria-label="复制消息">...</button>
  </div>

  ...

  <div
    data-content-search-unit-key="fallback-turn-3:2:assistant"
    data-chatgpt-search-unit-key="fallback-turn-3:2:assistant"
    data-chatgpt-search-message-ids="..."
  >
    <h4 data-conversation-role="assistant">ChatGPT 说：</h4>
    <div data-chatgpt-selection-message-id="...">
      <div data-markdown-text-style="assistant-message">...</div>
    </div>
  </div>

  <div class="turn-action-controls">
    <button aria-label="复制">...</button>
  </div>
</div>
```

Important properties:

1. The user and assistant messages share one `data-content-search-turn-key` container.
2. User and assistant message identity is carried by separate `data-content-search-unit-key` values ending in `:user` / `:assistant`.
3. The assistant Copy toolbar is outside the assistant unit but inside the same outer turn.
4. The user Copy button is inside the user unit. It must never satisfy assistant finality.
5. The assistant unit can also expose `data-conversation-role="assistant"` and `data-markdown-text-style="assistant-message"`.
6. A user unit can expose `data-user-message-bubble="true"` and, for rich text, `data-markdown-text-tone="user-message"`.

## 3. Root cause

v2.10.4 added `data-turn` and `data-author-role` support, but the live renderer exposes none of those attributes.

There is a second structural trap: one `data-content-search-turn-key` contains both user and assistant units. Any helper that de-duplicates only by the outer turn will collapse the two roles into one message and can also bind the user's Copy button to the assistant reply.

## 4. Goals

- Recognize the live `fallback-turn` renderer as a mounted conversation.
- Preserve task marker lookup, exact-route ownership, final reply detection, error handling, approvals, and progress tracking.
- Keep user Copy and assistant Copy strictly separated.
- Never treat a user-rich-text block as assistant content.
- Preserve all legacy/current renderer paths.

## 5. Requirements

- R1: Canonical role discovery supports:
  - `data-message-author-role`
  - `data-turn`
  - `data-author-role`
  - `data-content-search-unit-key` suffix `:user` / `:assistant`
  - `data-chatgpt-search-unit-key` suffix `:user` / `:assistant`
  - `data-conversation-role`
  - `data-user-message-bubble="true"`
  - `data-markdown-text-style="assistant-message"`
  - `data-markdown-text-tone="user-message"`
- R2: For the fallback renderer, the canonical message boundary is the content-search unit, not the outer content-search turn.
- R3: De-duplication is by message boundary + role, not by outer turn.
- R4: `visibleConversationHasMessages()` returns true when a rendered fallback user or assistant unit is present.
- R5: `pageLoadingState()` does not classify a complete fallback transcript as a shell-only page.
- R6: `taskMarkerUser()` can find a Fabushi marker inside a fallback user unit.
- R7: `latestTurn(task)` pairs the latest fallback user unit with following assistant unit(s).
- R8: Assistant content extraction is scoped to the assistant unit and must not include rich user Markdown from the same outer turn.
- R9: A user Copy control inside the user unit cannot mark the assistant reply final.
- R10: An assistant Copy control after the assistant unit but inside the same outer fallback turn is valid final UI evidence when Stop/streaming are absent.
- R11: Existing old/foreign toolbar protections remain fail-closed.
- R12: Progress fingerprinting and transcript handoff use canonical message units.
- R13: Approval-card scanning remains bounded to recent conversation surfaces and does not regress.
- R14: Existing durable renderer-recovery exhaustion from v2.10.4 remains unchanged.
- R15: Release as v2.10.5 only after exact-head and canonical-main tests succeed.

## 6. Implementation strategy

Introduce explicit concepts:

- `contentSearchUnitRole(node)`
- `conversationMessageUnit(node, role)`
- expanded `conversationRole(node)`
- expanded `conversationRoleNodes(role, scope)`

Use the assistant message unit as the content/streaming scope and the outer content-search turn as the response-action lane scope.

Response action ownership rules:

1. Controls inside a user unit are rejected for assistant finality.
2. Controls inside the assistant unit are accepted.
3. Controls inside the same outer fallback turn but outside a unit are accepted only if they follow the assistant unit in document order.
4. Controls from older turns remain rejected.

## 7. Verification

Add regression fixtures matching the live DOM:

1. fallback transcript counts as mounted.
2. fallback transcript is not shell loading.
3. fallback task marker ownership works.
4. fallback assistant Copy outside assistant unit completes the latest reply.
5. user Copy inside user unit cannot complete an assistant reply when assistant Copy is absent.
6. rich user Markdown is excluded from assistant text.
7. legacy `data-message-author-role` and v2.10.4 `data-turn` paths remain green.
8. full regression suite remains green.

## 8. Acceptance

- The exact live renderer shape observed on the Mac is represented by tests.
- The user's visible completed conversation no longer falls into “消息区仍未挂载”.
- No cross-role or cross-turn Copy misbinding is introduced.
- v2.10.4 bounded-refresh behavior remains intact.

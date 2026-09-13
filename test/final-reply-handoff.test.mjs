import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = await fs.readFile(new URL('../chatgpt-auto-confirm.user.js', import.meta.url), 'utf8');
const instrumentedSource = source.replace(
  '  mount();',
  `  window.__fabushiFinalReplyTestHooks = Object.freeze({ latestTurn, classify, abnormalEndSince, finish, plannerPrompt });
  mount();`,
);

async function createHarness(body) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'https://chatgpt.com/',
  });
  const { window } = dom;
  window.Element.prototype.getClientRects = () => [{ width: 1, height: 1 }];
  window.navigator.locks = {
    request(_name, _options, callback) {
      return Promise.resolve(callback({}));
    },
  };
  if (!window.crypto.randomUUID) {
    Object.defineProperty(window.crypto, 'randomUUID', { configurable: true, value: () => `${Date.now()}-${Math.random()}` });
  }
  await window.eval(instrumentedSource);
  return { dom, window, hooks: window.__fabushiFinalReplyTestHooks };
}

test('semantic response actions recognize a completed reply when ChatGPT changes data-testid values', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">请完成任务 [Fabushi:turn-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant">
        <div data-message-author-role="assistant" data-message-id="assistant-turn-1">
          <div class="markdown">已完成目标，并已通过验收检查。</div>
        </div>
        <div class="response-toolbar">
          <button data-testid="reply-copy-action" aria-label="复制回复"></button>
          <button data-testid="good-response-turn-action-button-v2"></button>
          <button data-testid="bad-response-turn-action-button-v2"></button>
          <button data-testid="reply-regenerate-action" aria-label="重新生成"></button>
          <button data-testid="reply-more-action" aria-label="更多操作"></button>
        </div>
      </article>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.text, '已完成目标，并已通过验收检查。');
    assert.equal(turn.responseActionsComplete, true);
    assert.equal(turn.final, true);
    const sample = { rateLimit: '', blocker: '', owned: true, cards: 0, stop: false, loading: false, final: turn.final, text: turn.text };
    const previous = { clear: true, text: turn.text, since: 0, idleSince: 0, endedAt: 0 };
    assert.equal(hooks.classify(sample, previous, 5000).state, 'complete');
    assert.equal(hooks.abnormalEndSince(sample, previous, 5000), 0);
    assert.equal(hooks.classify({ ...sample, stop: true }, previous, 5000).state, 'generating');
    assert.equal(hooks.classify({ ...sample, loading: true }, previous, 5000).state, 'loading');
    assert.equal(hooks.classify({ ...sample, cards: 1 }, previous, 5000).state, 'approval');
    assert.equal(hooks.classify({ ...sample, text: '正文仍在变化' }, previous, 5000).state, 'waiting');
  } finally {
    dom.window.close();
  }
});

test('an active or incomplete response is not promoted to a final reply by partial controls', async () => {
  const { dom, window, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">继续工作 [Fabushi:turn-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant" data-is-streaming="true">
        <div data-message-author-role="assistant" data-message-id="assistant-turn-2">
          <div class="markdown">仍在生成中的部分内容</div>
        </div>
        <div class="response-toolbar">
          <button data-testid="reply-copy-action" aria-label="复制回复"></button>
        </div>
      </article>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.responseActionsComplete, false);
    assert.equal(turn.final, false);
    window.document.querySelector('.markdown').textContent = '';
    assert.equal(hooks.latestTurn().final, false);
  } finally {
    dom.window.close();
  }
});

test('a portaled action row must explicitly identify the latest assistant turn', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">请检查当前结果 [Fabushi:turn-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant">
        <div data-message-author-role="assistant" data-message-id="assistant-turn-3">
          <div class="markdown">这是当前 Work 的完整最终回复。</div>
        </div>
      </article>
      <div id="response-actions-portal" data-message-id="assistant-turn-3">
        <button data-testid="copy-action-v3"></button>
        <button data-testid="good-response-action-v3"></button>
        <button data-testid="bad-response-action-v3"></button>
        <button data-testid="regenerate-action-v3"></button>
      </div>
      <div id="old-response-actions">
        <button data-testid="copy-old-response"></button>
        <button data-testid="good-old-response"></button>
        <button data-testid="bad-old-response"></button>
      </div>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.responseActionsComplete, true);
    assert.equal(turn.final, true);
  } finally {
    dom.window.close();
  }
});

test('a confirmed Work reply is copied verbatim into the next review prompt', async () => {
  const { dom, hooks } = await createHarness('<main></main>');
  try {
    const finalReply = '已完成目标。\n证据：PR #2580 已合并，exact-main packaged run 正在验证。';
    const task = {
      id: 'TFI-USERSCRIPT-RECOVERY-009-test',
      mode: 'continuous',
      phase: 'work',
      round: 1,
      goal: '修复最终回复识别并交给验收会话。',
      goalRevision: 3,
      dispatchGoalRevision: 3,
      url: 'https://chatgpt.com/c/work-turn-1',
      token: 'work-turn-token',
      state: 'waiting',
      attempted: true,
      messages: [],
      history: [],
      attachments: [],
    };

    hooks.finish(task, finalReply);

    assert.equal(task.phase, 'review');
    assert.equal(task.state, 'queued');
    assert.equal(task.result, finalReply);
    assert.match(hooks.plannerPrompt(task), new RegExp(`Work 自然结果：${finalReply.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`));
  } finally {
    dom.window.close();
  }
});

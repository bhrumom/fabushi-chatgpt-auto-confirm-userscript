import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = await fs.readFile(new URL('../chatgpt-auto-confirm.user.js', import.meta.url), 'utf8');
const instrumentedSource = source.replace(
  '  mount();',
  `  window.__fabushiFinalReplyTestHooks = Object.freeze({ latestTurn, classify, abnormalEndSince, stalledProgressSignature, refreshStalledConversation, queueReviewRepair, parseReview, finish, workPrompt, plannerPrompt, inspect, data, start, pause });
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

test('copy plus one visible feedback button is enough despite a stale streaming marker', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">继续执行 [Fabushi:buttons-only-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant" data-is-streaming="true">
        <div data-message-author-role="assistant" data-message-id="assistant-buttons-only">
          <div class="markdown">最终回复已经显示。</div>
        </div>
        <div class="response-toolbar">
          <button aria-label="复制"></button>
          <button aria-label="赞"></button>
        </div>
      </article>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.responseActionsComplete, true);
    assert.equal(turn.final, true);
    assert.equal(turn.responseActions.includes('copy'), true);
    assert.equal(turn.responseActions.includes('like'), true);
  } finally {
    dom.window.close();
  }
});


test('static completion markers survive renderer transitions without legacy turn ids', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">继续执行 [Fabushi:turn-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant">
        <div data-message-author-role="assistant">
          <div class="markdown" data-is-streaming="false">页面轮换后已经完整结束。</div>
        </div>
      </article>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.explicitFinal, true);
    assert.equal(turn.final, true);

    const sample = {
      rateLimit: '',
      blocker: '',
      owned: true,
      cards: 0,
      stop: false,
      loading: false,
      final: turn.final,
      text: turn.text,
    };
    assert.equal(hooks.classify(sample, {
      clear: false,
      final: false,
      text: '',
      since: 0,
      finalSince: 0,
    }, 1000).state, 'waiting');

    assert.equal(hooks.classify(sample, {
      clear: true,
      final: true,
      finalSince: 1000,
      text: turn.text,
      since: 1000,
      idleSince: 1000,
      endedAt: 0,
    }, 5000).state, 'complete');
  } finally {
    dom.window.close();
  }
});

test('a stalled conversation refresh preserves the active task and stops at a bounded limit', async () => {
  const { dom, window, hooks } = await createHarness('<main></main>');
  try {
    window.history.pushState({}, '', '/c/stalled-conversation');
    const task = {
      id: 'stalled-conversation',
      mode: 'once',
      phase: 'work',
      round: 1,
      state: 'generating',
      url: 'https://chatgpt.com/c/stalled-conversation',
      token: 'stalled-token',
      attempted: false,
      attachments: [{ id:'image-1', name:'画稿.png' }],
      messages: [],
    };
    hooks.data.tasks.push(task);
    assert.equal(hooks.refreshStalledConversation(task, false, 181_000), true);
    assert.equal(task.stalledRefreshAttempts, 1);
    assert.equal(task.url, 'https://chatgpt.com/c/stalled-conversation');
    assert.equal(task.token, 'stalled-token');
    assert.deepEqual(task.attachments, [{ id:'image-1', name:'画稿.png' }]);
    assert.equal(task.phase, 'work');
    assert.match(task.messages.at(-1).text, /连续 3 分钟没有可见变化/);

    assert.equal(hooks.refreshStalledConversation(task, false, 181_001), false, 'the cooldown prevents an immediate second reload');
    assert.equal(hooks.refreshStalledConversation(task, false, 197_000), true);
    assert.equal(task.stalledRefreshAttempts, 2);
    assert.equal(hooks.refreshStalledConversation(task, false, 213_000), false);
    assert.equal(task.stalledRefreshExhausted, true);
    assert.equal(task.result || '', '');
  } finally {
    dom.window.close();
  }
});

test('review parsing recovers a wrapped report with unescaped human quotes', async () => {
  const { dom, hooks } = await createHarness('<main></main>');
  try {
    const task = { id:'review-json-recovery', round:2 };
    const reply = '验收结果如下：\n```json\n{"taskId":"review-json-recovery","round":2,"status":"next","summary":"已检查“绘画”结果，发现 "尺寸" 需要继续处理","next":"重新绘画后复核"}\n```';
    assert.deepEqual(hooks.parseReview(reply, task), {
      taskId:'review-json-recovery',
      round:2,
      status:'next',
      summary:'已检查“绘画”结果，发现 "尺寸" 需要继续处理',
      next:'重新绘画后复核',
    });
  } finally {
    dom.window.close();
  }
});

test('malformed review reports requeue only the review phase and never discard Work result', async () => {
  const { dom, hooks } = await createHarness('<main></main>');
  try {
    const task = {
      id:'review-repair',
      mode:'continuous',
      phase:'review',
      round:1,
      state:'reviewing',
      url:'https://chatgpt.com/c/review-repair',
      token:'review-token',
      result:'Work 已完成，不能重复执行。',
      attachments:[{ id:'clip', name:'clip.mp4' }],
      messages:[],
    };
    hooks.data.tasks.push(task);
    assert.equal(hooks.queueReviewRepair(task, '验收回复 JSON 无法解析'), 'queued');
    assert.equal(task.phase, 'review');
    assert.equal(task.state, 'queued');
    assert.equal(task.url, '');
    assert.equal(task.token, '');
    assert.equal(task.result, 'Work 已完成，不能重复执行。');
    assert.deepEqual(task.attachments, [{ id:'clip', name:'clip.mp4' }]);
    assert.equal(task.reviewRepairAttempts, 1);
    assert.equal(hooks.queueReviewRepair(task, '验收回复 JSON 无法解析'), 'queued');
    assert.equal(task.reviewRepairAttempts, 2);
    assert.equal(hooks.queueReviewRepair(task, '验收回复 JSON 无法解析'), 'blocked');
    assert.equal(task.state, 'blocked');
    assert.equal(task.result, 'Work 已完成，不能重复执行。');
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

test('parallel task markers scope the latest turn and reject a newer foreign user turn', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user-a">
        <div data-message-author-role="user">任务 A [Fabushi:token-a]</div>
      </article>
      <article data-testid="conversation-turn-assistant-a">
        <div data-message-author-role="assistant">
          <div class="markdown" data-is-streaming="false">A 的最终回复</div>
        </div>
      </article>
      <article data-testid="conversation-turn-user-b">
        <div data-message-author-role="user">任务 B [Fabushi:token-b]</div>
      </article>
      <article data-testid="conversation-turn-assistant-b">
        <div data-message-author-role="assistant">
          <div class="markdown" data-is-streaming="false">B 的最终回复</div>
        </div>
      </article>
    </main>
  `);
  try {
    const taskA = { id: 'task-a', token: 'token-a' };
    const taskB = { id: 'task-b', token: 'token-b' };
    assert.equal(hooks.latestTurn(taskB).text, 'B 的最终回复');
    assert.equal(hooks.latestTurn(taskB).owned, true);
    const staleA = hooks.latestTurn(taskA);
    assert.equal(staleA.owned, false);
    assert.equal(staleA.text, '');
  } finally {
    dom.window.close();
  }
});

test('parallel inspection never completes task A from task B response', async () => {
  const { dom, window, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">任务 B [Fabushi:token-b]</div>
      </article>
      <article data-testid="conversation-turn-assistant">
        <div data-message-author-role="assistant">
          <div class="markdown" data-is-streaming="false">B 已经完成</div>
        </div>
      </article>
    </main>
  `);
  try {
    window.history.pushState({}, '', '/c/task-a');
    const taskA = {
      id: 'task-a', goal: 'A', mode: 'once', phase: 'work', round: 1,
      state: 'waiting', url: 'https://chatgpt.com/c/task-a', token: 'token-a', messages: [],
    };
    hooks.data.tasks.push(taskA);
    await hooks.start();
    await hooks.inspect(taskA, null);
    assert.equal(taskA.state, 'waiting');
    assert.equal(taskA.preview || '', '');
    assert.equal(taskA.messages.some(item => item.role === 'assistant'), false);
    hooks.pause();
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
      attachments: [{ id: 'evidence-image', name: 'evidence.png', type: 'image/png', size: 4, lastModified: 1 }],
    };

    hooks.finish(task, finalReply);

    assert.equal(task.phase, 'review');
    assert.equal(task.state, 'queued');
    assert.equal(task.result, finalReply);
    assert.deepEqual(task.attachments, [{ id: 'evidence-image', name: 'evidence.png', type: 'image/png', size: 4, lastModified: 1 }]);
    assert.match(hooks.plannerPrompt(task), new RegExp(`Work 自然结果：${finalReply.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`));
    assert.match(hooks.plannerPrompt(task), /evidence\.png/);
  } finally {
    dom.window.close();
  }
});

test('a review result that requests more work keeps the same attachments for the next Work round', async () => {
  const { dom, hooks } = await createHarness('<main></main>');
  try {
    const task = {
      id: 'attachment-next-round',
      mode: 'continuous',
      phase: 'review',
      round: 2,
      goal: '继续验证附件驱动的任务',
      goalRevision: 1,
      dispatchGoalRevision: 1,
      url: 'https://chatgpt.com/c/review-round-2',
      token: 'review-round-token',
      state: 'waiting',
      attempted: true,
      messages: [],
      history: [],
      attachments: [{ id: 'sample-video', name: 'sample.mp4', type: 'video/mp4', size: 4, lastModified: 1 }],
    };

    hooks.finish(task, JSON.stringify({
      taskId: task.id,
      round: task.round,
      status: 'next',
      summary: '需要带着同一份视频继续验证',
      next: '检查视频中的第二个场景',
    }));

    assert.equal(task.phase, 'work');
    assert.equal(task.state, 'queued');
    assert.deepEqual(task.attachments, [{ id: 'sample-video', name: 'sample.mp4', type: 'video/mp4', size: 4, lastModified: 1 }]);
    assert.match(hooks.workPrompt(task), /sample\.mp4/);
  } finally {
    dom.window.close();
  }
});

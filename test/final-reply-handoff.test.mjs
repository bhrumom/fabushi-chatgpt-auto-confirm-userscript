import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = await fs.readFile(new URL('../chatgpt-auto-confirm.user.js', import.meta.url), 'utf8');
const instrumentedSource = source.replace(
  '  mount();',
  `  window.__fabushiFinalReplyTestHooks = Object.freeze({ latestTurn, taskTurnForInspection, armRecoveredFinalIdentity, ownedFinalReplyReady, recoverStalledRoute, prepareTaskForRecovery, classify, stalledProgressSignature, refreshStalledConversation, queueReviewRepair, parseReview, finish, workPrompt, plannerPrompt, inspect, data, start, pause });
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
    const previous = { clear: true, text: turn.text, since: 0, idleSince: 0, final: true, finalSince: 0 };
    assert.equal(hooks.classify(sample, previous, 5000).state, 'complete');
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

test('copy plus a visible share button is enough despite a stale streaming marker', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">继续执行 [Fabushi:share-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant" data-is-streaming="true">
        <div data-message-author-role="assistant" data-message-id="assistant-share-turn">
          <div class="markdown">复制和分享按钮已经显示，回复正文完整。</div>
        </div>
        <div class="response-toolbar">
          <button data-testid="copy-turn-action-button" aria-label="复制"></button>
          <button data-testid="share-turn-action-button" aria-label="分享"></button>
          <button data-testid="regenerate-turn-action-button" aria-label="重新生成"></button>
        </div>
      </article>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.responseActionsComplete, true);
    assert.equal(turn.final, true);
    assert.equal(turn.responseActions.includes('copy'), true);
    assert.equal(turn.responseActions.includes('share'), true);
    assert.equal(turn.responseActions.includes('like'), false);
    assert.equal(turn.responseActions.includes('dislike'), false);
  } finally {
    dom.window.close();
  }
});

test('copy plus ChatGPT’s localized rate-response control is enough', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">继续执行 [Fabushi:rate-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant" data-is-streaming="true">
        <div data-message-author-role="assistant" data-message-id="assistant-rate-turn">
          <div class="markdown">实际页面的回复操作栏已经出现。</div>
        </div>
        <div class="response-toolbar">
          <button data-testid="copy-turn-action-button" aria-label="复制回复"></button>
          <button data-testid="rate-response-action-button" aria-label="评价回复"></button>
          <button data-testid="regenerate-turn-action-button" aria-label="重新生成"></button>
          <button data-testid="more-turn-action-button" aria-label="更多操作"></button>
        </div>
      </article>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.responseActionsComplete, true);
    assert.equal(turn.final, true);
    assert.equal(turn.responseActions.includes('copy'), true);
    assert.equal(turn.responseActions.includes('feedback'), true);
  } finally {
    dom.window.close();
  }
});

test('a share button without copy, or a page-level share button, cannot complete a reply', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <header><button aria-label="分享此对话"></button></header>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">继续工作 [Fabushi:share-incomplete-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant" data-is-streaming="true">
        <div data-message-author-role="assistant" data-message-id="assistant-share-incomplete">
          <div class="markdown">只有分享按钮，不能证明回复已完成。</div>
        </div>
        <div class="response-toolbar">
          <button data-testid="share-turn-action-button" aria-label="分享"></button>
        </div>
      </article>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.responseActionsComplete, false);
    assert.equal(turn.final, false);
    assert.equal(turn.responseActions.includes('share'), true);
    assert.equal(turn.responseActions.length, 1);
  } finally {
    dom.window.close();
  }
});

test('a portaled copy and share row must explicitly identify the latest assistant turn', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">请检查当前结果 [Fabushi:share-portal-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant">
        <div data-message-author-role="assistant" data-message-id="assistant-share-portal">
          <div class="markdown">当前回复已经显示完整。</div>
        </div>
      </article>
      <div id="response-actions-portal" data-message-id="assistant-share-portal">
        <button data-testid="copy-action-v4"></button>
        <button data-testid="share-action-v4" aria-label="Share response"></button>
      </div>
      <div id="old-response-actions" data-message-id="assistant-old-share-portal">
        <button data-testid="copy-old-response"></button>
        <button data-testid="share-old-response" aria-label="分享"></button>
      </div>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.responseActionsComplete, true);
    assert.equal(turn.final, true);
    assert.deepEqual(new Set(turn.responseActions), new Set(['copy', 'share']));
  } finally {
    dom.window.close();
  }
});


test('static completion markers are diagnostic only and never replace the final reply toolbar', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">继续执行 [Fabushi:turn-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant">
        <div data-message-author-role="assistant">
          <div class="markdown" data-is-streaming="false">工具阶段暂时静止，但操作栏还没出现。</div>
        </div>
      </article>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.explicitFinal, true);
    assert.equal(turn.responseActionsComplete, false);
    assert.equal(turn.final, false);

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
      clear: true,
      final: false,
      text: turn.text,
      since: 1000,
      idleSince: 1000,
      endedAt: 1000,
    }, 901000).state, 'waiting');
  } finally {
    dom.window.close();
  }
});

test('a stalled conversation refresh preserves the active task and continues every fifteen minutes', async () => {
  const { dom, window, hooks } = await createHarness('<main></main>');
  try {
    window.history.pushState({}, '', '/c/stalled-conversation');
    const task = {
      id: 'stalled-conversation',
      goal: '等待停滞会话恢复',
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
    assert.equal(hooks.refreshStalledConversation(task, false, 901_000), true);
    assert.equal(task.stalledRefreshAttempts, 1);
    assert.equal(task.url, 'https://chatgpt.com/c/stalled-conversation');
    assert.equal(task.token, 'stalled-token');
    assert.deepEqual(task.attachments, [{ id:'image-1', name:'画稿.png' }]);
    assert.equal(task.phase, 'work');
    assert.match(task.messages.at(-1).text, /连续 15 分钟没有可见变化/);

    assert.equal(hooks.refreshStalledConversation(task, false, 1_800_999), false, 'the fifteen-minute interval prevents an immediate second reload');
    assert.equal(hooks.refreshStalledConversation(task, false, 1_801_000), true);
    assert.equal(task.stalledRefreshAttempts, 2);
    assert.equal(hooks.refreshStalledConversation(task, false, 1_801_001), false, 'the next interval starts after the second reload');
    assert.equal(hooks.refreshStalledConversation(task, false, 2_701_000), true);
    assert.equal(task.stalledRefreshAttempts, 3);
    assert.equal(hooks.refreshStalledConversation(task, false, 3_601_000), true, 'a fourth reload remains allowed');
    assert.equal(task.stalledRefreshAttempts, 4);
    assert.equal(task.stalledRefreshExhausted, false);
    assert.ok(task.messages.every(message => !/刷新上限/u.test(message.text)));
    assert.equal(task.result || '', '');
  } finally {
    dom.window.close();
  }
});

test('a legacy stalled-refresh exhaustion flag is migrated without blocking recovery', async () => {
  const { dom, window, hooks } = await createHarness('<main></main>');
  try {
    window.history.pushState({}, '', '/c/legacy-stalled-conversation');
    const task = {
      id: 'legacy-stalled-conversation',
      goal: '恢复历史停滞会话',
      mode: 'once',
      phase: 'work',
      round: 1,
      state: 'waiting',
      url: 'https://chatgpt.com/c/legacy-stalled-conversation',
      token: 'legacy-stalled-token',
      attempted: false,
      stalledRefreshURL: 'https://chatgpt.com/c/legacy-stalled-conversation',
      stalledRefreshAttempts: 2,
      stalledRefreshExhausted: true,
      stalledRefreshAt: 0,
      messages: [],
    };
    hooks.data.tasks.push(task);

    assert.equal(hooks.refreshStalledConversation(task, false, 901_000), true);
    assert.equal(task.stalledRefreshAttempts, 3);
    assert.equal(task.stalledRefreshExhausted, false);
    assert.ok(task.messages.some(message => /已解除历史停滞刷新次数上限/u.test(message.text)));
  } finally {
    dom.window.close();
  }
});

test('review parsing recovers a wrapped report with unescaped human quotes', async () => {
  const { dom, hooks } = await createHarness('<main></main>');
  try {
    const task = { id:'review-json-recovery', round:2 };
    const reply = '验收结果如下：\n```json\n{"taskId":"review-json-recovery","round":2,"status":"next","summary":"已检查“绘画”结果，发现 "尺寸" 需要继续处理","next":"重新绘画后复核"}\n```';
    assert.deepEqual(JSON.parse(JSON.stringify(hooks.parseReview(reply, task))), {
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

test('review recovery selects the exact current task and round when quoted evidence contains an older report', async () => {
  const { dom, hooks } = await createHarness('<main></main>');
  try {
    const task = { id:'current-review-task', round:4 };
    const reply = '验收说明：旧记录 {"taskId":"old-task","round":1,"status":"next","summary":"旧轮次","next":"旧下一步"}；当前报告如下： {"taskId":"current-review-task","round":4,"status":"next","summary":"当前轮仍缺少真实安装验收证据","next":"只补当前轮人工验收证据"}';
    assert.deepEqual(JSON.parse(JSON.stringify(hooks.parseReview(reply, task))), {
      taskId:'current-review-task',
      round:4,
      status:'next',
      summary:'当前轮仍缺少真实安装验收证据',
      next:'只补当前轮人工验收证据',
    });
    assert.match(hooks.plannerPrompt({
      ...task,
      goal:'完成当前目标',
      result:'历史材料里包含 {"taskId":"old-task","round":1}',
      token:'review-token',
    }), /本次验收身份固定为 taskId="current-review-task"、round=4/);
  } finally {
    dom.window.close();
  }
});

test('a mismatched review identity is a repairable review error, not a terminal task error', async () => {
  const { dom, hooks } = await createHarness('<main></main>');
  try {
    const task = { id:'expected-task', round:3 };
    assert.throws(
      () => hooks.parseReview('{"taskId":"wrong-task","round":2,"status":"next","summary":"需要继续","next":"下一步"}', task),
      error => error?.code === 'invalid-review-json' && /期望 taskId=expected-task、round=3/.test(error.message),
    );
  } finally {
    dom.window.close();
  }
});

test('malformed review reports requeue only the review phase and never discard Work result', async () => {
  const { dom, hooks } = await createHarness('<main></main>');
  try {
    const task = {
      id:'review-repair',
      goal:'修复验收回复',
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
    assert.equal(hooks.queueReviewRepair(task, '验收回复 JSON 无法解析'), 'queued');
    assert.equal(task.state, 'queued');
    assert.equal(task.url, '');
    assert.equal(task.token, '');
    assert.equal(task.result, 'Work 已完成，不能重复执行。');
    assert.match(task.messages.at(-1).text, /新的 ChatGPT 会话/);
    assert.match(task.messages.at(-1).text, /自动重发/);
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

test('a live streaming marker keeps a no-Stop reply generating instead of triggering abnormal recovery', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">继续工作 [Fabushi:streaming-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant" data-is-streaming="true">
        <div data-message-author-role="assistant" data-message-id="assistant-streaming">
          <div class="markdown">文字仍在流式输出中</div>
        </div>
      </article>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.streaming, true);
    assert.equal(turn.final, false);
    const sample = {
      rateLimit: '', blocker: '', owned: true, cards: 0, stop: false,
      streaming: turn.streaming, loading: false, final: false, text: turn.text,
    };
    assert.equal(hooks.classify(sample, null, 60_000).state, 'generating');
  } finally {
    dom.window.close();
  }
});

test('non-streaming completion marker plus response-local Copy is enough when secondary actions mount late', async () => {
  const { dom, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">验收当前结果 [Fabushi:static-copy-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant">
        <div data-message-author-role="assistant" data-message-id="assistant-static-copy">
          <div class="markdown" data-is-streaming="false">最终回复已完整显示。</div>
        </div>
        <div class="response-toolbar">
          <button data-testid="copy-turn-action-button" aria-label="复制回复"></button>
        </div>
      </article>
    </main>
  `);
  try {
    const turn = hooks.latestTurn();
    assert.equal(turn.explicitFinal, true);
    assert.equal(turn.streaming, false);
    assert.equal(turn.responseActions.includes('copy'), true);
    assert.equal(turn.responseActionsComplete, false);
    assert.equal(turn.final, true);
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

test('recovered exact-route final reply survives marker virtualization and suppresses route recovery', async () => {
  const { dom, window, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-assistant">
        <div data-message-author-role="assistant" data-message-id="assistant-recovered-final">
          <div class="markdown">恢复后的最终回复已经完整显示。</div>
        </div>
        <div class="response-toolbar">
          <button aria-label="复制回复"></button>
          <button aria-label="评价回复"></button>
        </div>
      </article>
    </main>
  `);
  try {
    window.history.pushState({}, '', '/c/recovered-final');
    const task = {
      id:'recovered-final',
      goal:'继续完成恢复任务',
      goalRevision:2,
      mode:'once',
      phase:'work',
      round:3,
      state:'waiting',
      url:'https://chatgpt.com/c/recovered-final',
      token:'recovered-final-token',
      attempted:false,
      messages:[],
    };
    hooks.data.tasks.push(task);
    assert.equal(hooks.latestTurn(task).owned, false, 'the marker-bearing user turn is intentionally virtualized');
    assert.equal(hooks.armRecoveredFinalIdentity(task), true);

    const recovered = hooks.taskTurnForInspection(task);
    assert.equal(recovered.owned, true);
    assert.equal(recovered.recoveredRouteOwned, true);
    assert.equal(recovered.final, true);
    assert.equal(recovered.text, '恢复后的最终回复已经完整显示。');
    assert.equal(hooks.ownedFinalReplyReady(task), true);

    const sample = {
      rateLimit:'', blocker:'', routeOwned:true, owned:true, cards:0, stop:false,
      streaming:false, loading:false, final:true, text:recovered.text,
    };
    assert.equal(hooks.classify(sample, {
      final:true,
      text:recovered.text,
      finalSince:1_000,
      since:1_000,
    }, 5_000).state, 'complete', 'the existing four-second stability gate still decides completion');

    task.routeRecoveryAttempts = 0;
    assert.equal(hooks.recoverStalledRoute(new window.URL(task.url), task), false);
    assert.equal(task.routeRecoveryAttempts, 0, 'a completed recovered reply must not increment route recovery');
  } finally {
    dom.window.close();
  }
});

test('manual task recovery arms the final-reply fallback identity for the exact phase and round', async () => {
  const { dom, window, hooks } = await createHarness('<main></main>');
  try {
    window.history.pushState({}, '', '/c/manual-recovery');
    const task = {
      id:'manual-recovery',
      goal:'恢复当前任务',
      goalRevision:4,
      mode:'once',
      phase:'review',
      round:2,
      state:'blocked',
      url:'https://chatgpt.com/c/manual-recovery',
      token:'manual-recovery-token',
      attempted:false,
      messages:[],
    };
    hooks.data.tasks.push(task);
    assert.equal(hooks.prepareTaskForRecovery(task), true);
    assert.deepEqual(JSON.parse(JSON.stringify(task.recoveredFinalIdentity)), {
      url:'https://chatgpt.com/c/manual-recovery',
      token:'manual-recovery-token',
      phase:'review',
      round:2,
      goalRevision:4,
    });
  } finally {
    dom.window.close();
  }
});

test('recovered final fallback refuses a foreign task marker on the same route', async () => {
  const { dom, window, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">另一个任务 [Fabushi:foreign-final-token]</div>
      </article>
      <article data-testid="conversation-turn-assistant">
        <div data-message-author-role="assistant"><div class="markdown">另一个任务的最终回复</div></div>
        <button aria-label="复制回复"></button>
        <button aria-label="评价回复"></button>
      </article>
    </main>
  `);
  try {
    window.history.pushState({}, '', '/c/recovered-foreign-marker');
    const target = {
      id:'target-final',
      goal:'目标任务',
      goalRevision:1,
      mode:'once',
      phase:'work',
      round:1,
      state:'waiting',
      url:'https://chatgpt.com/c/recovered-foreign-marker',
      token:'missing-target-token',
      attempted:false,
      messages:[],
    };
    const foreign = {
      id:'foreign-final',
      goal:'其他任务',
      mode:'once',
      phase:'work',
      round:1,
      state:'waiting',
      url:'https://chatgpt.com/c/elsewhere',
      token:'foreign-final-token',
      attempted:false,
      messages:[],
    };
    hooks.data.tasks.push(target, foreign);
    hooks.armRecoveredFinalIdentity(target);
    const turn = hooks.taskTurnForInspection(target);
    assert.equal(turn.owned, false);
    assert.equal(turn.text, '');
    assert.equal(hooks.ownedFinalReplyReady(target), false);
  } finally {
    dom.window.close();
  }
});

test('recovered final fallback refuses a visible non-task user turn even on the exact route', async () => {
  const { dom, window, hooks } = await createHarness(`
    <main>
      <article data-testid="conversation-turn-user">
        <div data-message-author-role="user">用户后来手动发送的其他问题</div>
      </article>
      <article data-testid="conversation-turn-assistant">
        <div data-message-author-role="assistant"><div class="markdown">手动问题的完整回复</div></div>
        <button aria-label="复制回复"></button>
        <button aria-label="评价回复"></button>
      </article>
    </main>
  `);
  try {
    window.history.pushState({}, '', '/c/recovered-manual-turn');
    const task = {
      id:'recovered-manual-turn',
      goal:'自动任务',
      goalRevision:1,
      mode:'once',
      phase:'work',
      round:1,
      state:'waiting',
      url:'https://chatgpt.com/c/recovered-manual-turn',
      token:'virtualized-auto-token',
      attempted:false,
      messages:[],
    };
    hooks.data.tasks.push(task);
    hooks.armRecoveredFinalIdentity(task);
    const turn = hooks.taskTurnForInspection(task);
    assert.equal(turn.owned, false);
    assert.equal(turn.text, '');
    assert.equal(hooks.ownedFinalReplyReady(task), false);
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

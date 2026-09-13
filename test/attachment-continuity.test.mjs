import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const source = await fs.readFile(new URL('../chatgpt-auto-confirm.user.js', import.meta.url), 'utf8');
const instrumentedSource = source.replace(
  '  mount();',
  `  window.__fabushiAttachmentTestHooks = Object.freeze({ attachmentReady, ensureTaskAttachments, failAttachmentUpload });
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
  return { dom, window, hooks: window.__fabushiAttachmentTestHooks };
}

test('confirmation follows the active composer surface but ignores unrelated page filenames', async () => {
  const { dom, window, hooks } = await createHarness(`
    <main>
      <div id="composer-shell">
        <form id="chat">
          <textarea id="prompt-textarea"></textarea>
          <input id="picker" type="file" multiple>
        </form>
        <div data-testid="file-attachment" data-file-name="clip.mp4">clip.mp4</div>
      </div>
      <div data-file-name="outside.pdf">outside.pdf</div>
    </main>
  `);
  try {
    const input = window.document.querySelector('#prompt-textarea');
    assert.equal(hooks.attachmentReady([{ name: 'clip.mp4', size: 4, type: 'video/mp4' }], input), true);
    assert.equal(hooks.attachmentReady([{ name: 'outside.pdf', size: 11, type: 'application/pdf' }], input), false);
  } finally {
    dom.window.close();
  }
});

test('a matching native FileList confirms a portal-style attachment without a preview node', async () => {
  const { dom, window, hooks } = await createHarness(`
    <main>
      <form id="chat">
        <textarea id="prompt-textarea"></textarea>
        <input id="picker" type="file" multiple>
      </form>
    </main>
  `);
  try {
    const input = window.document.querySelector('#prompt-textarea');
    const picker = window.document.querySelector('#picker');
    const file = new window.File(['clip'], 'clip.mp4', { type: 'video/mp4', lastModified: 1 });
    Object.defineProperty(picker, 'files', { configurable: true, value: [file] });
    assert.equal(hooks.attachmentReady([{ name: 'clip.mp4', size: 4, type: 'video/mp4' }], input), true);
    const task = {
      attachments: [{ name: 'clip.mp4', size: 4, type: 'video/mp4' }],
      attachmentUploadPending: true,
      attachmentLastAttemptAt: Date.now(),
    };
    assert.equal(hooks.attachmentReady(task, input), false);
    task.attachmentLastAttemptAt = Date.now() - 1000;
    assert.equal(hooks.attachmentReady(task, input), true);
  } finally {
    dom.window.close();
  }
});

test('transient attachment timeout stays resumable and schedules automatic backoff', async () => {
  const { dom, hooks } = await createHarness('<main><form><textarea id="prompt-textarea"></textarea></form></main>');
  try {
    const task = { id: 'retry-task', state: 'uploading', attachments: [{ name: 'clip.mp4' }], messages: [] };
    const before = Date.now();
    assert.equal(hooks.failAttachmentUpload(task, '等待 ChatGPT 显示附件已超过 45 秒。'), false);
    assert.equal(task.state, 'uploading');
    assert.equal(task.attachmentUploadFailed, true);
    assert.equal(task.attachmentUploadRetryCount, 1);
    assert.ok(task.attachmentUploadRetryAt >= before + 4500);
    assert.ok(task.attachmentUploadRetryAt <= before + 6500);
    assert.match(task.messages.at(-1).text, /自动重试/);
  } finally {
    dom.window.close();
  }
});

test('ensureTaskAttachments keeps a backoff task on the scheduler path', async () => {
  const { dom, window, hooks } = await createHarness('<main><form><textarea id="prompt-textarea"></textarea></form></main>');
  try {
    const task = {
      id: 'backoff-task',
      state: 'uploading',
      attachments: [{ name: 'clip.mp4', size: 4, type: 'video/mp4' }],
      attachmentUploadFailed: true,
      attachmentUploadRetryAt: Date.now() + 10000,
      messages: [],
    };
    const input = window.document.querySelector('#prompt-textarea');
    assert.equal(await hooks.ensureTaskAttachments(task, input), false);
    assert.equal(task.state, 'uploading');
    assert.ok(task.attachmentUploadRetryAt > Date.now());
  } finally {
    dom.window.close();
  }
});

test('missing local attachment remains a manual-action blocker', async () => {
  const { dom, hooks } = await createHarness('<main><form><textarea id="prompt-textarea"></textarea></form></main>');
  try {
    const task = { id: 'blocked-task', state: 'uploading', attachments: [{ name: 'missing.pdf' }], messages: [] };
    assert.equal(hooks.failAttachmentUpload(task, '本地附件“missing.pdf”已不存在，请重新选择。'), false);
    assert.equal(task.state, 'blocked');
    assert.equal(task.attachmentUploadRetryAt, 0);
    assert.match(task.messages.at(-1).text, /停止发送纯文字目标/);
  } finally {
    dom.window.close();
  }
});

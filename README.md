# Fabushi 独立自动确认工作台 2.10.25

这是 Fabushi 的独立油猴脚本源码仓库：
`https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript`。
入口文件是 `chatgpt-auto-confirm.user.js`，当前版本为 `2.10.25`。Fabushi 宿主可直接运行该发布资产；不需要同时安装油猴副本。

## 2.10.25 连接中断直接按异常会话新开接力

- `Connection interrupted. Waiting for the complete answer` / `连接已中断，正在等待完整回复` 不再进入“原会话等 5 分钟再刷新”的专用恢复循环；一旦在当前任务已绑定会话中确认该产品级中断，就把当前派发归类为**异常中断**。
- 为避免在授权卡正要出现/刚 remount 时误切会话，破坏性 handoff 仍保持授权安全门：先做一次 wide 实时授权扫描，等待至少 8 秒，再做第二次实时扫描；期间出现授权卡就留在当前会话处理授权。没有授权卡后立即进入 fresh-chat handoff。
- fresh handoff 会先提取当前异常会话中可安全归属的 assistant 可见回复与实际工作步骤，并排除中断提示本身；随后清理旧会话派发 identity，新开 ChatGPT 会话，把这些现场作为已完成进度接力继续。
- 即使旧会话仍残留 Stop 按钮，也不再等待 Stop 自然消失、不再刷新旧会话；中断提示本身就是本次派发的异常终止证据。旧会话输入框不会发送“继续完成所有”或任何补偿消息。
- 老版本持久化下来的 `pendingContinuationReason` 也按同一策略迁移：完成 8 秒授权复核后直接新开会话接力，不再恢复旧 5 分钟同会话刷新状态。
- 普通页面无变化的 5 分钟 stall 刷新、会话无法加载的 30 秒/7 次恢复、rate-limit 等其它策略不变；本次只改变明确的 connection-interrupted 产品状态。
- 新增/更新回归覆盖：Stop 仍存在时照样 fresh handoff、无 Stop 时 fresh handoff、可见工作步骤被带入新提示、虚拟化 task article 的异常接力、旧 continuation 状态迁移，以及不再出现连接中断 5 分钟同会话刷新合同。
- 所有测试与发布仍只通过 GitHub Actions 或 htch-runtime，不在本地运行。
- 详细规格见 [v2.10.25](docs/specs/connection-interruption-fresh-handoff-v2.10.25.md)。
## 2.10.24 最近 2 小时操作记录 + 连接中断恢复可见化

> 历史说明：本节中的“连接中断等待 5 分钟刷新同一会话”策略已由 v2.10.25 取代；最近 2 小时活动记录机制仍继续保留。

- 修复工作台“什么记录都没有”的根因：v2.10.18 为了保证 `localStorage` 永远不会被脚本日志撑满，把 `messages/history` 从 canonical durable snapshot 中彻底删除；因此每次 ChatGPT 页面刷新/恢复后，内存中的操作记录都会消失。连接中断路径恰好会按 5 分钟刷新同一会话，所以用户最需要看到恢复记录时反而最容易变成空白。
- canonical `localStorage` 继续保持 latest-only，不重新把大量日志塞回去；新增独立的**最近 2 小时滚动活动记录**，优先写 IndexedDB，同时写一个严格有界的 sessionStorage 同标签页副本。页面刷新、SPA 会话切换和普通恢复都会重新加载这些记录。
- 最近活动记录保存状态日志和 assistant 最终内容；在页面刷新/切换前，如果当前会话已有可安全归属的可见工作内容，还会保存一条“最近可见工作内容快照”，这样可以回看刚才实际做到哪里，而不只是看到“等待响应”。
- 记录严格只保留最近 2 小时，并同时有条数/字符硬上限；工作台渲染也独立限流，避免再次出现长日志导致 Chrome 主线程卡顿或存储配额问题。
- `Connection interrupted. Waiting for the complete answer` 仍按既定策略：无进展连续 5 分钟才刷新同一会话，不重复发送原任务；现在工作台会直接显示“约 X 分 X 秒后刷新当前会话 · 已刷新 N 次”，不再看起来像无限卡死。
- 新增回归：2 小时内记录能在恢复后重建、超过 2 小时自动淘汰、canonical localStorage 仍不包含 diagnostic history、连接中断 5 分钟恢复倒计时/刷新次数可见。
- 所有测试与发布继续只通过 GitHub Actions 或 htch-runtime，不在本地运行。
- 详细规格见 [v2.10.24](docs/specs/recent-two-hour-activity-log-v2.10.24.md)。

## 2.10.23 验收最终结果与 Work 共用完成识别

- 修复验收会话已经给出本轮最终结果，但 ChatGPT 虚拟化原始任务 user turn、或最终 response remount 后结构 key 变化，导致脚本仍把该会话当作“结束但没有最终回复”并不断新开验收的问题。
- 验收现在和 Work 一样先判断“当前这一轮是否已经真正结束”，然后读取**当前最终 assistant 结果**。对于 Review，`parseReview()` 成功解析出的精确 `taskId + round + status + summary (+ next)` 本身就是强语义完成证据，不再要求 renderer 的 `data-content-search-turn-key` / message key 必须从生成期间一直稳定到最终 DOM。
- 该 fallback 仍要求：同一 exact conversation、同一 dispatch identity 曾观察到生成、Stop 已消失、无授权卡、无其它任务 owner/marker，并且最终正文是当前 Review 的精确 taskId/round；错误 taskId/round、普通自然语言、旧回复都不会被接收。
- 原有 response-local Copy/toolbar 与结构边界仍作为普通 Work/非结构化回复的最终证据和 Review 的额外证据；只是 Review 不再被 renderer remount 的实现细节卡住。
- 新增回归：无 structural response key 仍能消费正确 Review 结果、response remount 换 key 仍能完成、错误 taskId/round 仍 fail-closed。
- 所有测试和构建仍只通过 GitHub Actions 或 htch-runtime 执行，不在本地运行。
- 详细规格见 [v2.10.23](docs/specs/review-final-result-recognition-v2.10.23.md)。

## 2.10.22 修复连接中断等待导致的页面主线程卡死

- 定位到 v2.10.21 的新连接中断监督路径会在可见标签页的普通 4 秒 runner tick 上持续进入 `superviseConnectionInterrupted()`；即使中断页面完全没有变化，也会更新 `updatedAt`、写本地工作区并触发 Fabushi `paint()`，同时再次计算中断进度指纹。长会话/高内存页面上这会重新制造此前 v2.9.86 专门消除过的主线程卡顿模式。
- 连接中断状态现在改为**低开销等待**：第一次识别时持久化一次，随后最多每 **15 秒**做一次恢复复核；在 probe deadline 之前 scheduler 直接跳过该任务，不再每 4 秒重复 inspect。
- 未变化的中断状态不再重复 `save()`、不更新 `updatedAt`、不追加日志，也不触发工作台 repaint；即使有外部/手工重复 inspect，也保持幂等，不会不断向后滑动 probe deadline。
- 中断专用进度签名改用当前 response boundary、当前 assistant 文本尾部和 Stop/streaming/final 状态，不再为这个错误页周期性调用普通 `visibleConversationProgressFingerprint()` 的全量 bounded activity 扫描。
- 仍保持原语义：真实进展会重新开始 5 分钟计时；连续 5 分钟无进展才刷新同一会话；刷新后仍中断继续新的 5 分钟恢复窗口；不会重复发送原任务。
- 新增性能回归合同：明确证明 interrupted wait 在 15 秒 probe 前不会被 scheduler 再次选择，重复 inspect 不产生新的持久化/日志/paint。
- 所有测试和发布验证继续只通过 GitHub Actions。
- 详细规格见 [v2.10.22](docs/specs/interruption-main-thread-stall-v2.10.22.md)。
## 2.10.21 刷新后连接中断优先于 inherited Stop hydration

- 修复 v2.10.20 的遗漏：第一次 `Connection interrupted. Waiting for the complete answer` 能触发 5 分钟刷新，但刷新后的新 document 可能先命中上一份页面留下的 Stop observation / hydration gate，于是在真正执行连接中断识别之前就提前 `return`，工作台只显示“页面刷新后仍在恢复当前任务内容”，从而再次卡住。
- 现在**可见的连接中断提示在同一已绑定会话中是更高优先级的恢复证据**。它会在 inherited Stop / reload hydration 早退逻辑之前被处理。
- 即使刷新后当前 Stop 控件暂时无法被 selector 识别，只要 exact conversation 上明确显示连接中断，仍会建立/续接独立的 5 分钟恢复窗口，不会退回无限 hydration 等待，也不会因为一次 selector/虚拟化差异立即丢弃当前任务现场。
- 增加专门回归：模拟 previous-document Stop observation + 当前页面明确连接中断 + 当前 Stop 未识别，证明脚本会记录“已识别 ChatGPT 连接中断”、保持原 URL，并在 5 分钟无进展后安排同会话刷新。
- 所有测试与发布验证继续只通过 GitHub Actions。
- 详细规格见 [v2.10.21](docs/specs/interruption-preempts-reload-hydration-v2.10.21.md)。
## 2.10.20 连接中断/会话加载失败主动刷新 + 5 分钟停滞刷新

- 识别当前 ChatGPT 英文提示 `Connection interrupted. Waiting for the complete answer`；当该状态仍伴随 Stop/生成状态时，不再无限等待。页面连续 **5 分钟**没有可见进展就刷新当前绑定会话，之后仍异常则继续按 5 分钟无进展窗口周期刷新，不重复发送任务。
- 识别当前 ChatGPT 英文页面错误 `Could not load this ChatGPT conversation`。即使 `Try again` 只是普通文字、没有渲染成 button/role=button，只要错误位于主内容区且消息区没有挂载，也进入现有会话加载失败恢复：等待 30 秒后刷新同一会话，最多 7 次，再安全接力到新会话。
- 通用“页面没有变化”刷新阈值由 **15 分钟改为 5 分钟**；可见消息/工作步骤变化会重新开始 5 分钟计时。
- 连接中断的专项刷新不受普通“三段停滞后新会话”计数限制，避免在错误页上静止等待；它持续刷新原绑定会话，直到页面恢复、Stop 消失后进入既有异常接力，或状态发生其它可判定变化。
- 所有验证只通过 GitHub Actions。
- 详细规格见 [v2.10.20](docs/specs/interrupted-load-failure-five-minute-refresh-v2.10.20.md)。
## 2.10.19 连续异常接力始终使用最新中断会话

- 修复连续异常 fresh-chat 接力时，第二次或后续中断可能错误复用第一次异常会话实时回复/工作步骤的问题。
- 根因是旧 `handoffReplySnapshot` 只绑定 phase/round/goalRevision，没有强制绑定其来源 conversation URL；新会话中断时如果 assistant DOM 正好暂时丢失，旧快照会被当成当前会话兜底。
- 现在 durable snapshot 必须同时匹配**当前任务实际绑定的 canonical conversation URL**；旧会话快照即使 phase/round 完全相同，也不能跨会话读取。
- replacement prompt 成功发送并确认绑定新的 `/c/<id>` 后，上一异常会话已经消费过的 `abnormalFreshCarry` 与 `handoffReplySnapshot` 会立即退休。新的会话随后只会生成自己的实时 carry/snapshot。
- 如果最新异常会话当下既没有可安全读取的 assistant 正文/工作步骤，也没有该**同一会话**的 durable snapshot，下一次恢复宁可不附带异常工作记录，也绝不会拿更早会话的内容冒充最新现场。
- 新增连续异常回归：C1 异常 → C2 成功绑定 → C2 DOM 丢失 → C3 不得出现 C1；以及 C2 已有 durable snapshot 时，C3 必须只携带 C2、排除 C1。
- 所有测试与发布验证只通过 GitHub Actions。
- 详细规格见 [v2.10.19](docs/specs/latest-abnormal-session-handoff-v2.10.19.md)。

## 2.10.15 缺少模型/思考强度选择器时主动刷新

- 修复“未找到 ChatGPT 模型/思考强度选择器”后可能长期只等待、不再主动恢复的问题。
- 现在把缺少模型/思考强度 UI 视为**可恢复的发送前 renderer 状态**：先持续检查，不会静默使用页面默认模型发送。
- 如果选择器连续 **60 秒**仍未出现，脚本会刷新**当前 ChatGPT 页面**重新检查；刷新后仍缺失，则继续按同样 60 秒间隔重复恢复，没有永久停止自动刷新的次数上限。
- 这条恢复链与普通 renderer 的“两次恢复上限”独立；即使普通恢复已经 exhausted，也不会让模型选择器缺失状态永久卡死。
- 刷新期间保留 task、phase、round、目标/next、附件和原发送意图，不会重复点击 Send。
- 如果模型菜单已经打开但思考强度滑块没有挂载、调整中消失或校验失败，也进入同一主动恢复链。
- 一旦选择器重新出现，会清空专用恢复计数，然后继续正常的五档模型/思考强度验证。
- 所有验证仅通过 GitHub Actions 运行。
- 详细规格见 [v2.10.15](docs/specs/reasoning-picker-active-refresh-v2.10.15.md)。

## 2.10.14 真实授权卡漏检 + Stop 消失二次复核

- 直接重新打开了本次 **10:12** 被错误接力的旧 Work 会话；现场仍然清楚显示 GitHub 授权卡，而 Stop 已经消失，assistant 仍处于“正在思考/工具工作”状态。这证明本次不是“点完授权后的 disabled 竞态”，而是 **授权卡从一开始就可能被旧的 role-derived 扫描范围漏掉**。
- 当前真实 ChatGPT 卡片有稳定的 `@container/approval-card` surface，内部是“允许 ChatGPT 使用 GitHub？”以及“拒绝 / 允许一次 / 审批选项”。脚本现在把 `approval-card` surface 作为一等授权范围，不再依赖 user/assistant role node 是否恰好挂载。
- 同时直接纳入最近的 content-search turn root，并从最新 response boundary 同时向前、向后扫描相邻 surface，覆盖授权卡插在 user 与 assistant 之间的 renderer 布局。
- **Stop 消失不再立即切会话。** 到达这个破坏性边界时会放弃之前缓存的授权扫描结果，重新读取当前 DOM，并执行一次仅用于 handoff 的宽范围结构扫描；只认“Reject + Allow/Allow once + split-menu”完整授权结构。
- 即使这次实时复核仍返回 0 张卡，也不会立即新开会话：先进入至少 **8 秒**二次复核窗口，再重新读取一次实时 DOM。只要期间卡片出现/重挂载，就取消异常接力并继续原会话。
- 只有“Stop 已消失 + 两轮实时扫描均无授权卡 + 8 秒确认窗口已过 + 没有强最终回复/限流/blocker”等条件全部成立，才允许使用原来的异常 fresh-session 接力。
- v2.10.13 的保护仍保留：disabled 授权卡继续视为 pending；点击“允许本次会话”后的 12 秒 settlement latch 也继续生效。
- 新增 GitHub Actions 回归覆盖真实 `@container/approval-card`、role scope 外授权卡、critical wide scan、单次零卡不得切会话以及 8 秒稳定确认后才允许真实异常接力。
- 详细规格见 [v2.10.14](docs/specs/live-approval-surface-stop-handoff-v2.10.14.md)。

## 2.10.13 授权提交竞态彻底修复

- 修复连接器授权已经被脚本识别并点击后，ChatGPT 在提交授权期间暂时禁用或重挂载授权卡，随后 Stop 同时消失，脚本却把这一瞬间误判成“没有授权卡”并立即切换新会话的问题。
- 授权卡现在分成“结构仍存在”和“当前可点击”两个状态：即使“拒绝 / 允许一次 / 审批选项”暂时 disabled，只要同一授权结构仍在页面上，就继续视为待授权，绝不会触发 Stop-disappearance fresh-session handoff。
- 点击“允许本次会话”后新增 **12 秒任务级授权提交保护期**，绑定 exact conversation URL、token、phase 和 round。即使 React/Radix 在提交过程中让整张卡瞬时从 DOM 消失一帧，脚本仍留在原会话等待，不会因为单次零卡扫描切走。
- 不再把“允许”按钮 disabled 当作“授权已经生效”的证据。disabled 只表示正在处理；授权后的真实结果由后续页面状态决定。
- 授权保护期同时阻断异常结束、可重试错误、加载失败和输入框清理等会导致错误接力的恢复路径；保护期结束后，若确实不存在授权卡和最终回复，原有 Stop-disappearance 恢复策略才重新生效。
- 新增 GitHub Actions 回归：授权按钮全部 disabled + Stop 消失、授权点击后卡片瞬时 DOM gap、保护期结束后恢复正常接力，以及现有“允许一次 → 允许本次会话”真实形态和普通 Allow 排除。
- 详细规格见 [v2.10.13](docs/specs/authorization-settlement-race-v2.10.13.md)。

## 2.10.11 验收最终回复 Stop 消失后的收尾识别

- 修复规划/验收会话已经给出最终 JSON，却因为 Stop 在最终回复/工具栏完全挂载前短暂消失而被插件误判为“停止按钮消失接力”，从而反复新开验收会话的问题。
- 已直接检查用户 Mac 当前真实验收页：外层为 `data-content-search-turn-key="fallback-turn-0"`，当前 user/assistant 分别是 `:0:user` 与 `:2:assistant`；最终 assistant Copy 是外层 action row 的 `aria-label="复制"`，user Copy 则是 `aria-label="复制消息"`。最终 JSON 本身可被现有 fallback-turn parser 正确读取，真实根因是 **Review 收尾时序竞态**，不是 settled DOM selector 缺失。
- Work 仍保持原来的 Stop-disappearance 恢复规则；只有 `phase="review"` 改成有界收尾等待：Stop 消失后不立即新开验收，最多等待 **2 分钟**让最终回复/工具栏完成挂载，期间正文或工作步骤变化都会继续重置“无最终回复”稳定计时。
- 对规划/验收特有的严格 `MAHAYANA_TASK_REPORT_V1` JSON，若 `taskId`、`round`、`status`、`summary`、`next` 全部通过既有 `parseReview()` 校验，Stop 已消失且不再流式，即使 Copy 工具栏还在 hydration，也可作为当前验收最终回复证据；仍经过既有 final stability 后才进入 `finish()/parseReview()`。
- 如果 task marker 已被虚拟化，上述 JSON 快速收尾仍必须与 **Stop 可见时记录的同一个 assistant response boundary** 完全匹配；不同 response、foreign task/route owner、授权卡、blocker、rate limit 都继续 fail-closed。
- 若验收会话真的结束且 2 分钟内既没有有效报告也没有新进展，才继续使用原有异常 fresh-session 接力，避免永久等待。
- 新增真实 fallback-turn 结构、Stop 消失后延迟 settlement、marker 虚拟化同 response JSON、两分钟 bounded recovery 回归测试；Work 的即时 Stop-disappearance 现有回归保持不变。
- 详细规格见 [v2.10.11](docs/specs/review-final-settlement-v2.10.11.md)。

## 2.10.10 异常接力携带可见回复 + 实际工作步骤

- 修复异常中断后新会话只带普通 assistant 回复、却丢掉 ChatGPT Agent 可见执行步骤的问题。
- 当前 ChatGPT renderer 会把“下载并检查工作流构建产物”“定位首个根因”“等待 Rust 编译完成”“轮询 GitHub Actions …”等进度显示为 `assistant-message + tertiary`。这些节点继续**不参与最终回复判定**，但现在会进入异常接力上下文。
- 异常 handoff 会把当前 response 的普通 assistant prose 和这些 tertiary 工作步骤按页面出现顺序合并，再写入现有 bounded carry / pagehide snapshot。
- 普通 15 分钟“页面无变化”判定现在也把可见 tertiary 工作步骤纳入进度指纹；只要工作步骤新增或变化，就重新开始 15 分钟计时，但这些步骤仍然不作为最终回复、任务归属或验收结果证据。
- 如果任务 marker 被虚拟化，只允许 exact conversation、无 foreign marker/owner 的安全回退，并只取最新 content-search response turn，避免把旧轮次的 activity 混进来。
- 下一轮 Work 提示词现在明确包含“异常会话实时工作记录（可见回复 + 实际工作步骤）”；后续验收异常接力也携带同一 combined trace。
- 后续轮次仍保留“上一轮已完成 Work 最终回复 + 当前异常工作记录 + 原始目标”的优先级，当前 `next` / 当前任务和原始目标始终优先。
- v2.10.9 的验收最终回复识别、v2.10.8 的“无法加载此 ChatGPT 对话”30 秒 × 7 恢复和普通 15 分钟停滞策略均不变。
- 详细规格见 [v2.10.10](docs/specs/abnormal-visible-work-trace-carry-v2.10.10.md)。

## 2.10.9 验收会话任务标识虚拟化后的最终回复识别

- 修复规划/验收会话已经给出完整最终回复，但 ChatGPT 恰好把本轮带 `[Fabushi:...]` 的 user turn 虚拟化后，脚本把它误判成“停止按钮消失接力”的问题。
- 现在 Stop 可见时会额外记录当前 assistant response 的**结构边界 identity**（优先使用 current renderer 的 content-search turn/message/unit key），不保存回复正文作为身份。
- 如果之后任务标识被虚拟化，只有在**同一 exact conversation、同一 phase/round/token/goalRevision、无其它任务 owner/marker、同一个 Stop-observed assistant response boundary、最终 Copy toolbar 已出现且 Stop 已消失**时，才把这条回复恢复为本任务的最终回复。
- 这样验收最终正文会进入原来的 `parseReview()`：`status:"next"` 会读取它的 `next` 并派发下一轮 Work；`status:"complete"` 会正常结束。
- 如果最终 toolbar 属于另一个 response，或当前 renderer 无法提供可验证的 response boundary，则仍然 fail-closed，继续使用原有异常接力，不会把旧回复误认成本轮结果。
- v2.10.8 的“无法加载此 ChatGPT 对话”30 秒 × 7 恢复、15 分钟普通停滞策略、授权/请求频繁/附件等逻辑不变。
- 详细规格见 [v2.10.9](docs/specs/review-virtualized-marker-final-recognition-v2.10.9.md)。

## 2.10.8 会话加载失败 30 秒 × 7 恢复 + 最终回复优先识别

- ChatGPT 明确显示“无法加载此 ChatGPT 对话”且真实消息区未挂载时，不再落入通用的两次 renderer recovery 后永久等待。
- 该明确错误现在按 **30 秒**间隔只刷新当前绑定会话，最多 **7 次**；第 7 次刷新后仍是同一加载错误，就保留任务、阶段、轮次、附件和可安全提取的进度，在当前标签页新开 ChatGPT 会话继续。
- 故障旧会话不会再次点击发送，也不会因为这个专项恢复改变通用的 15 分钟无进展策略。
- 当前 ChatGPT 的 content-search renderer（`:user` / `:assistant`）以及最终回复按钮 `复制` / `评价回复` / `分享` 已按实站结构复核。
- 如果同一派发曾经出现 Stop，但现在最新、归属明确的 assistant 回复已经出现 response-local `复制` 且 Stop/streaming 均消失，最终回复证据优先，不再被旧的“Stop 消失就新开会话”规则抢先接力。
- 详细规格见 [v2.10.8](docs/specs/conversation-load-failure-final-precedence-v2.10.8.md)。

## 2.10.7 每个任务发送前强制选择 ChatGPT 模型 / 思考档位

- 已在 Mac 真实 ChatGPT 页面检查当前模型选择器：触发器为 `data-codex-intelligence-trigger="true"`，当前选择可见于 `data-selected-reasoning-effort`；菜单内真正的五档选择使用 `data-reasoning-slider="true"`，滑块为 `role="slider"`、`aria-valuemin="0"`、`aria-valuemax="4"`。
- 真实五档映射为：**即时(0 / none)、中(1 / medium)、高(2 / high)、极高(3 / max)、Pro(4)**。Pro 与“中”不能只靠 effort 属性区分，所以脚本以滑块 index 为最终事实来源。
- Fabushi 新任务输入区现在增加“ChatGPT 模型 / 思考强度”列表；默认选 **极高**。每个任务都会持久保存自己的档位，后续 Work、规划/验收和下一轮继续使用同一档位。
- 每次新会话真正发送前，脚本先打开 ChatGPT 模型选择器，逐档用左右方向键事件把真实滑块移动到任务配置的位置，再重新读取 `aria-valuenow` 验证。**只有验证成功才会继续上传附件、填写提示词并点击 Send。**
- 如果模型选择器、菜单或滑块没有出现，或者滑块无法移动到目标档位，本轮保持等待并显示原因，绝不会静默沿用页面默认值后发送。
- 旧任务没有保存档位时按 **极高** 迁移解释，不修改旧任务的 token、会话链接或附件。
- 规格与真实页面结构见 [v2.10.7](docs/specs/per-task-reasoning-preset-v2.10.7.md)。

## 2.10.6 修复新会话误记录 `local-chatgpt:` 临时链接

- ChatGPT 新会话发送后可能先短暂进入 `/c/local-chatgpt:<uuid>`，再替换成服务器真实 `/c/<id>`。这个本地临时路由现在与旧的 `WEB:` 一样，永远不能成为任务的持久 conversation identity。
- `canonicalConversationURL()` 会在 URL decode 后拒绝 `local-chatgpt:`，因此编码形式 `local-chatgpt%3A...` 也不会被记录。
- Send 后即使当前任务的 `[Fabushi:<token>]` 已经出现在临时路由中，也只保持“原发送待确认”；脚本继续等待服务器真实链接，不会因为临时 marker 提前确认，也不会再次点击 Send。
- 一旦真正的服务器 `/c/<id>` 出现并能确认本任务归属，只记录这个真实链接；临时链接不会进入 `task.url` / `sessionUrl` / `sessionUrls`。
- 已被旧版本写入的 `local-chatgpt:` 当前绑定会在升级时自动隔离：保留 token、phase、round、目标、附件和原发送意图，恢复到有界的发送确认状态；不会拿旧 `sessionUrls` 中的历史会话冒充当前会话。
- 如果任务当时处于暂停，升级后继续保持暂停；只有用户恢复任务时才重新开始 90 秒发送确认窗口，避免长时间暂停后立刻误判超时并重复发送。
- 规格和验收见 [v2.10.6](docs/specs/transient-local-chatgpt-route-v2.10.6.md)。

## 2.10.5 按 Mac 真实 ChatGPT DOM 修复 fallback-turn 消息识别

- 已在在线 Mac 的真实登录态 Chrome 中复现“页面明明有完整消息，脚本仍判断消息区未挂载”。现场 DOM 中 `data-message-author-role`、`data-turn`、`data-author-role` 都为 **0**，因此 v2.10.4 新增的三类 selector 仍然无法命中当前 renderer。
- 当前真实结构使用 `data-content-search-turn-key="fallback-turn-N"` 作为一轮外层容器，再用 `data-content-search-unit-key="fallback-turn-N:0:user"` 与 `...:2:assistant` 区分 user / assistant message unit。脚本现在把 **message unit** 作为角色与文本边界，而不是把整个 outer turn 当成一条消息。
- 同时支持现场可见的 `data-chatgpt-search-unit-key`、`data-conversation-role`、`data-user-message-bubble`、`data-markdown-text-style="assistant-message"` 与 `data-markdown-text-tone="user-message"` 作为结构证据。
- 真实 renderer 的 assistant Copy 在 assistant unit 外、但仍位于同一个 outer `fallback-turn`；user Copy 则位于 `:user` unit 内。现在明确拒绝 user-unit Copy，只接受当前 assistant unit 自身或其后的同 outer-turn assistant action lane，避免把“复制消息”错当成最终回复按钮。
- assistant 文本读取严格限制在 `:assistant` message unit，防止同一个 outer turn 中的 rich user Markdown 被拼进 assistant 回复。
- v2.10.4 已修好的 renderer 恢复上限继续保持：同一会话恢复预算耗尽后不会因时间经过重新开始无限刷新。
- 真实 DOM、约束与验收记录见 [v2.10.5 规格](docs/specs/live-fallback-turn-renderer-v2.10.5.md)。

## 2.10.4 修复“消息区未挂载”误判与无限刷新

- 消息结构不再只认 `data-message-author-role`；统一支持 `data-message-author-role`、`data-turn`、`data-author-role` 三类 user/assistant 角色宿主，并按真实 conversation turn 去重。
- task marker、消息区挂载、页面 loading、当前 assistant、进度指纹、回复 toolbar 归属、恢复边界、授权扫描、发送前旧消息检查统一走同一套 role-node 识别，避免刷新前后 renderer DOM 不同导致互相矛盾。
- 修复真正的无限刷新：旧逻辑达到 `2/2` 后只等 60 秒就把 `routeRecoveryAttempts` 清零，所以同一会话会永久重新进入 `1/2 → 2/2`。现在同一 conversation / phase / round / goal revision 的恢复预算耗尽后保持 exhausted，时间流逝不会重新武装自动刷新。
- 达到恢复上限后仍继续监督当前页面；只有真实消息重新挂载/出现进展、进入新的会话/轮次或明确的新派发，才会通过已有 reset 路径解除恢复上限。
- 不新增重复 Send，也不因为 shell-only 直接新开会话。
- 规格与验收见 [v2.10.4](docs/specs/renderer-shell-hydration-bounded-recovery-v2.10.4.md)。

## 2.10.3 修复会话已结束但最终回复未识别

- 最终回复判定重新对齐产品规则：**当前任务最新 assistant 回复已出现、Stop 已消失、该回复自己的 Copy/复制按钮已出现**，即可作为最终 UI 证据；不再强制要求 Share / 评价 / Like / Source / More 等第二个动作按钮同时存在。
- Copy 的归属仍严格绑定最新 assistant turn / response lane；旧回复、其他任务或无法关联的动作栏不能把当前回复误判成完成。
- 对于 ChatGPT 再次改变动作栏、导致 Copy 也无法被现有语义识别的情况，新增严格的 8 秒自然回复兜底：必须是精确任务会话、强任务归属、自然语言回复、Stop/流式/授权/加载/错误/限流全部消失、输入框就绪且为空，且文本连续 8 秒不变化，才会确认完成。
- 自然回复兜底稳定期间不会再被“会话已经结束但没有最终回复”路径提前新开会话；文本变化会重新计时。
- 已使用 `htch-runtime` 尝试直接检查真实 ChatGPT DOM；该设备 Chromium 可启动，但 Hatch 沙箱浏览器出口对 ChatGPT 返回 `ERR_EMPTY_RESPONSE`，且设备没有已登录 ChatGPT 会话，因此没有把失败的现场访问伪装成 DOM 证据。具体约束与验收标准见 [v2.10.3 规格](docs/specs/final-reply-structure-recognition-v2.10.3.md)。

## 2.10.2 识别已显示但 role 宿主为零矩形的消息区

- 修复 ChatGPT 消息已经完整显示，但 `[data-message-author-role]` 只是 `display: contents` / 零尺寸布局宿主时，脚本仍误报“消息区仍未挂载”的问题。
- 消息可见性现在不再只看 role 宿主自己的 `getClientRects()`：宿主本身可见、已知语义消息子节点可见，或所属 conversation turn 可见且 role 宿主确实包含文本，都会被认定为消息已经挂载。
- 页面加载判断、活跃 assistant 判断、消息区恢复判断和最近进度指纹统一使用同一套 renderer-aware 判定，因此已经显示的消息不会再错误进入 2.10.1 的 30 秒空壳恢复路径。
- hidden / inert / `display:none` / `visibility:hidden` 内容仍然不会算作可见消息；任务归属、最终回复工具栏、授权、限流和阻塞安全边界不变。
- 详见 [v2.10.2 规格](docs/specs/zero-rect-visible-message-hosts-v2.10.2.md)。

## 2.10.1 修复刷新后空会话壳永久等待

- 修复精确会话 URL 和输入框已经恢复、但 ChatGPT 没有挂载任何可见 user/assistant 消息节点时，继承 Stop 恢复门槛会反复提前返回、永远到不了页面恢复逻辑的问题。
- 这类“空会话壳”现在会保留原任务、原会话和历史 Stop 证据，并从页面壳真正就绪时开始最多等待 30 秒；消息区仍为空时，只调用现有的同 URL renderer recovery，不新开会话、不重复发送任务。
- 空会话壳不再被误当作 renderer 已健康，因此不会在每次检查前把 `routeRecoveryAttempts` 清零；现有恢复次数和退避策略继续有效。
- 一旦消息节点或 Stop 重新出现，会立即退出 shell-only 恢复路径并回到 2.10.0 的正常继承 Stop / 最终回复处理。
- 详见 [v2.10.1 规格](docs/specs/reload-shell-route-recovery-v2.10.1.md)。

## 2.10.0 修复恢复后最终回复卡死

- 修复页面刷新后仍保留旧 Stop 观察时，暂停/恢复任务即使已经显示完整最终回复也会一直停在“等待响应”的问题。精确会话、恢复身份和最终回复工具栏均匹配时，现在会进入正常稳定确认，不再被历史 Stop 门槛永久挡住。
- 刷新保护仍保持严格：其他任务占用同一 URL、外来任务标记、授权卡、Stop、限流、阻塞或发送结果不明确时，都不能接管回复。
- 修复“监督中但扫描 0 次”的无声提前返回。继承 Stop 的页面恢复等待现在会记录有界观察和扫描计数，并在页面尚未恢复时写入一次可诊断状态。
- Fabushi 宿主为唯一运行入口时，应移除同页油猴副本，避免旧版本重复注入和重复任务记录。
- 详见 [v2.10.0 规格](docs/specs/resume-final-reply-before-inherited-stop-gate-v2.10.0.md)。

## 2.9.99 移除内存自动刷新限制

- 移除此前 1.75 GiB JS 堆阈值触发的自动同标签页重载。无论内存估算达到 1.8 GiB、超过 2 GiB，还是连续多次处于“高”状态，只要网页本身仍在运行，脚本都继续监督和处理当前任务，不会因为内存读数释放 runner/workspace、刷新页面、切换会话或请求宿主回收标签页。
- 内存监测保留为诊断信息；高内存时只允许执行不打断任务的脚本本地清理（压缩旧日志、清理陈旧观察/脱离对象等）。状态栏会明确显示“仅诊断，不会自动刷新或中断任务”。
- 手动 `cleanup_memory` 仍保留；只有用户显式调用时才允许沿用宿主内存回收请求。旧版本遗留的 `memoryPressureReloadAt` / `memoryPressureReloadURL` 不再参与任何执行判断。
- 详见 [v2.9.99 规格](docs/specs/continuous-task-no-memory-auto-reload-v2.9.99.md)。

## 2.9.98 刷新后等待页面稳定，并保证携带上一会话回复

- 修复刷新/重载后的误判：上一份页面虽然已经看见过 Stop，但新页面刚开始恢复时 Stop 可能要几秒才挂载。现在跨 document 的 Stop 观察只作为历史证据；必须等当前会话路由、消息和输入框完成恢复，并且页面指纹连续稳定 8 秒仍没有 Stop，才允许新开会话。若这期间 Stop 重新出现，会立即绑定到当前页面，之后只在这个页面里真正 Stop→消失时接力。
- 同一页面里的正常 Stop→消失仍然立即接力，不额外等待 8 秒；授权卡、限流、阻塞和任务归属仍然优先。
- 在页面刷新/卸载前，会把当前任务可安全识别的 assistant 回复持久化为有 phase/round/goalRevision 约束的快照。新会话接力时优先使用实时捕获内容；若刷新期间 DOM 还没恢复完整，则回退到这份快照。
- 新开的 Work/规划会话会明确携带上一会话已经回复的实际工作内容，不再因为刷新竞态退化成与上一轮完全一样的原始提示词。
- 详见 [v2.9.98 规格](docs/specs/reload-hydration-and-reply-carry-v2.9.98.md)。

## 2.9.97 停止按钮消失即新会话接力

- 不再在旧会话自动发送“继续完成所有”。当前任务本轮一旦观察到 Stop，之后检测到 Stop 消失且没有授权卡片，就立即提取当前可归属的 assistant 工作内容，清理旧 URL/发送标识，并在同一标签页新开 ChatGPT 会话接力。
- 新会话提示词继续携带当前 phase/round、当前提示词/next、上一轮 Work 结果（如有）、原始目标、附件和刚刚结束会话的实时工作内容；不会只发送一句续发口令。
- 最终回复工具栏不再覆盖这个边界：如果本轮已经看见过 Stop，那么 Stop→消失会先进入新会话接力，即使 Copy/Share 等最终操作栏已经出现。
- 授权卡片优先：授权仍在时不切会话；授权消失后若 Stop 已经消失，则继续执行新会话接力。连接中断也不再点击 Stop 或在旧会话续发。
- 详见 [v2.9.97 规格](docs/specs/stop-disappeared-fresh-session-v2.9.97.md)。

## 2.9.96 关闭标签页不再自动自恢复

- 用户主动关闭原任务标签页后，不再扫描陈旧 workspace 并自动接管，也不再通过 host recovery capability 请求外部恢复，因此不会自己重新打开/接管标签页。
- 历史说明：2.9.96 当时仍保留内存压力的“同一标签页释放并恢复”；该自动内存重载已在 2.9.99 按要求彻底取消。
- 手动“恢复工作区”以及手动“拖到新标签页处理”仍保留，只有用户显式操作才会打开/接管标签页。

## 2.9.95 异常结束优先于残留加载刷新

- 修复“回复已经异常停止，但页面残留 Loading，脚本仍等 15 分钟并反复刷新”的路径：精确会话下的恢复静态回复在无 Stop/流式/授权/阻塞/限流且输入框可用时，残留页面加载标记不再压住异常结束识别。
- 保留现有 8 秒稳定门槛；稳定后转到新的 ChatGPT 会话接力当前可安全提取的 assistant 工作，不会先触发 15 分钟同会话刷新，也不会把异常停止的静态文本误判为成功完成。
- 没有残留加载标记时，原有人工恢复静态最终回复判定保持不变；最终工具栏、任务归属、草稿清理和安全保护均保持原规则。
- 历史说明：2.9.95 曾把内存自动恢复阈值设为连续两次 1.75 GiB；该阈值触发的自动重载已在 2.9.99 移除，当前只保留诊断和非中断式本地清理。
- 详见 [修复规格](docs/specs/abnormal-end-stale-loader-v2.9.95.md)。

## 2.9.94 识别 Stream cache expired 异常结束

- 识别当前回复及其旁边的缓存过期错误卡；停止生成后稳定 8 秒，自动点击当前会话的“重试”。
- 残留加载/流式标记不会掩盖该错误；同一失败回复仅点击一次，未恢复时保留原有 15 分钟停滞恢复。
- 错误不会被当作成功完成；仍保留最终回复、任务归属与授权检查。
- 详见 [修复规格](docs/specs/stream-cache-expired-v2.9.94.md)。

## 2.9.93 恢复会话正确识别最终回复

- 自动恢复或接管的新会话即使没有挂载隐藏的 Fabushi 消息标记，也会记录当前用户消息边界；该边界不变且最新回复已出现复制与分享、评价或更多等最终操作按钮时，可正确完成本轮。
- 页面残留的加载标记不再压住这类强最终回复证据，也不会继续触发 1/2 次加载恢复；后来手动发送了新消息时边界会变化，脚本仍会拒绝误认旧回复。
- 详见 [`recovered-final-toolbar-wins-loading-v2.9.93.md`](docs/specs/recovered-final-toolbar-wins-loading-v2.9.93.md)。

## 2.9.92 三段停滞后接力到新会话

- 同一会话连续三段 15 分钟没有可见进展时，在当前标签页新开 ChatGPT 会话接着当前工作继续；前两段仍刷新原会话等待恢复。
- 真实可见进展会清零连续停滞计数；仅刷新页面不会清零。新会话会携带可安全识别的当前助手工作、原任务、阶段、轮次、上一轮结果、下一步和附件。
- 停止按钮消失后，不再把“正在思考”或残留的助手忙碌标记当作无限期生成证据；助手回复文本稳定 8 秒后，异常结束检测可以继续，回复文字仍在变化时会继续等待。
- 详见 [`three-stalled-windows-fresh-chat-carry-v2.9.92.md`](docs/specs/three-stalled-windows-fresh-chat-carry-v2.9.92.md)。

## 2.9.91 下一轮 Work 携带上一轮结果

- 验收要求继续处理时，下一轮 Work 会话会收到上一轮已经完成的 Work 最终回复、当前验收给出的具体下一步和原始目标。
- 异常恢复的新会话会同时收到上一轮完成结果和当前中断会话的实时进度，避免重复工作或丢失上下文。
- 详见 [`previous-work-result-next-round-carry-v2.9.91.md`](docs/specs/previous-work-result-next-round-carry-v2.9.91.md)。

## 2.9.90 网络错误后清除残留活动标记

- 当前任务的网络错误卡带有可见 Retry/重试按钮且停止按钮已消失时，将错误视为本轮已结束；过期的流式/加载标记不再阻止异常结束识别。
- 仍要求精确会话归属、8 秒稳定观察、无最终回复/授权/阻塞/限流、发送状态不含糊；若停止按钮仍在则继续等待。
- 输入框草稿只会在安全归属条件成立后清理，并重新开始完整稳定计时。
- 详见 [`stale-activity-on-network-error-v2.9.90.md`](docs/specs/stale-activity-on-network-error-v2.9.90.md)。

## 2.9.89 异常结束自动转新会话恢复

- 当前任务会话没有最终回复、停止按钮和授权卡时，稳定观察 8 秒后自动排入新会话继续，不在失败会话里反复续发。
- 长会话任务标记被虚拟化时仍按唯一会话链接检查最新回复；输入框内容只有在当前路由归属明确、没有生成/授权/加载等活动时才会清空，并重新开始稳定计时。
- 识别带可见 Retry/重试控件的英文/中文网络错误作为诊断证据；旧错误、引用文本或缺少重试按钮不会覆盖较新的最终回复。
- 详见 [`retry-generic-network-error-v2.9.89.md`](docs/specs/retry-generic-network-error-v2.9.89.md)。

## 2.9.88 虚拟化任务标记后的最终回复识别

- 当长会话卸载原始任务标记消息时，仅在精确会话 URL、单一任务归属、没有其他任务标记，并且最新用户消息确认为脚本已发送的“继续完成所有”时，才建立回复边界。
- 仍只识别该边界之后最新助手回复自己的复制与完成操作栏；旧回复按钮、活动生成和外部任务不会完成当前任务。
- 详见 [`final-reply-toolbar-virtualized-marker-v2.9.88.md`](docs/specs/final-reply-toolbar-virtualized-marker-v2.9.88.md)。

## 2.9.87 同标签页加载恢复

- 连续两次快速刷新仍未恢复时，继续由当前标签页持有任务并等待 60 秒，再刷新同一会话；不再请求宿主新开标签页交接任务。
- 详见 [`same-tab-stalled-route-recovery-v2.9.87.md`](docs/specs/same-tab-stalled-route-recovery-v2.9.87.md)。

## 2.9.86 降低运行时页面卡顿

- 任务监督把弹窗处理与状态分类放到同一检查周期，并共享惰性页面文字快照，删去普通会话扫描前的重复全页检查。
- 活跃任务处理弹窗时，独立弹窗计时器会让出扫描；页面通知只查 ChatGPT 主内容和语义化弹窗区域。
- 授权卡识别限制在最近消息与明确弹层，不再读取历史消息工具栏的按钮标签和布局。
- 详见 [`runner-main-thread-performance-v2.9.86.md`](docs/specs/runner-main-thread-performance-v2.9.86.md)。

## 2.9.85 页面加载期间提前显示脚本

- 将油猴注入时机提前到 `document-start`，ChatGPT 会话仍在加载时就挂载工作台；页面正文尚未创建时挂载在文档根节点。
- 保留 2.9.84 的启动失败重试和恢复票据保护。
- 详见 [`early-userscript-injection-v2.9.85.md`](docs/specs/early-userscript-injection-v2.9.85.md)。

## 2.9.84 启动失败自动恢复

- 如果工作区锁等启动步骤异常，脚本会清理本次启动标记并进行有限重试；连续失败时显示可重试提示，不再静默留下没有工作台的页面。
- 启动恢复不刷新或切换 ChatGPT 会话，也不绕过工作区与任务运行锁。
- 详见 [`bootstrap-failure-retry-v2.9.84.md`](docs/specs/bootstrap-failure-retry-v2.9.84.md)。

脚本头部固定声明 `@updateURL` 和 `@downloadURL`。油猴脚本管理器以及 Fabushi
宿主会直接检查该地址的 `@version`；发布新版本时只需更新脚本本身和版本号，不需要
同步修改 Marketplace 目录。

## 2.9.66 中断续发先停止生成

检测到当前任务会话显示“连接已中断，正在等待完整回复”且仍挂着停止生成按钮时，先在原会话点击停止；等停止按钮消失后再填入并发送“继续完成所有”。等待期间保留同一会话和任务状态，不重复点击停止、不刷新或新开会话。其他续发情形仍不会代替用户停止正常生成。

## 2.9.69 活跃回复不触发页面恢复

有可见对话内容时，暂时的会话归属不匹配不会触发 30 秒的空路由恢复；页面变化签名继续计时，15 分钟完全没有变化时仍会刷新，即使 Stop 仍可见。新回复或回复文本更新会从变化时重新计满 15 分钟。空白路由仍保留原有加载恢复。

## 2.9.70 刷新后的中断恢复容忍空会话节点

页面刷新后，如果任务归属标记暂时不匹配，脚本仍会安全处理页面级的“连接已中断”状态；空的会话 DOM 作用域不会再抛异常或错误地切换到新会话。

## 2.9.71 长度接力等待完整回复并复制当前轮

检测到会话长度上限后，先等当前 assistant 停止生成，再按当前任务消息边界收集本轮全部可见回复；不再只读最后一个 DOM 节点，也不会把旧回复或长度提示带到新会话。当前回复归属不明确时保留原会话等待。

## 2.9.73 兼容新版“允许一次”授权卡

- 兼容 ChatGPT 新版连接器授权卡的“允许一次 / Allow once”主按钮，同时忽略按钮内 `aria-hidden` 的 Enter 快捷键提示。
- 仍只在同一卡片存在“拒绝 + 主批准按钮 + 审批选项箭头”时识别授权卡；不会把普通“允许一次”按钮当成授权。
- 仍然打开 `aria-haspopup="menu"` 的分裂箭头，并只选择 `Allow GitHub for this conversation` 等本次会话授权；不会直接点击主按钮，也不会接受永久授权。

## 2.9.74 恢复时识别仍可见的授权卡

- 恢复任务时，即使 ChatGPT 暂时虚拟化了包含任务标记的旧用户消息，只要当前页面仍是任务已绑定的精确会话、且没有其他任务占用，就会继续识别可见授权卡并进入审批状态，不再误判成页面加载恢复。
- 该精确会话判断仅用于发现授权卡，不会把 assistant 回复归属给任务；其他任务标记和会话所有权冲突仍然拦截。
- 检测本身不点击授权。只有已启用自动授权时，才沿用现有的箭头菜单和“允许本次会话”流程。

## 2.9.75 恢复失败时释放旧标签页并降低重复扫描

- 新文档恢复导航在 8 秒内没有卸载旧文档时，旧标签页停止任务监督并释放工作区锁，保留原任务、会话、发送标识和恢复票据，让 Fabushi 宿主打开的带票据恢复标签页能接管，而不是被旧标签页锁挡住后变成空工作区。
- 普通同会话恢复仍沿用原有监督行为；只有明确的 `document-recovery` 交接会让出所有权，避免误抢活跃会话。
- 上述跨文档交接仅为历史版本行为；自 `2.9.87` 起页面卡顿恢复固定在当前标签页执行，连续两次失败后等待 60 秒再刷新同一会话。
- 页面加载识别只遍历一次包含 `main` 与应用级覆盖层的页面范围，减少长会话中重复扫描。
- `2.9.75` 的恢复交接与重复扫描修复已并入 `2.9.76`。

## 2.9.76 stream recovery 超时接力到新会话

- 当前任务的 assistant 回复出现 `ChatGPT stream recovery polling timed out` 且同一错误区域存在可见 Retry/重试操作时，不再盲目等待或在失败会话重复发送；脚本保存本轮可见工作并为同一任务排入新会话。
- 新会话提示包含本轮 `next` 指令、异常会话已完成的可见工作和原始目标；超时状态本身会从接力内容剔除，任务阶段、轮次和附件保持不变。
- 只处理当前绑定会话中的独立错误状态；引用/代码中的错误文字、旧错误、无重试操作或已出现最终回复都不会触发接力。
- `2.9.76` 已发布：[GitHub Release](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/tag/v2.9.76)，[直接安装脚本](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/download/v2.9.76/chatgpt-auto-confirm.user.js)。
- 本地 `npm test` 215 项中 208 通过、0 失败、7 项明确跳过；`node --check` 与 `git diff --check` 通过。canonical-main Test run [36088624251](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36088624251) 和自动 Release run [36088661110](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36088661110) 均成功。Release 指向提交 `4565b8344a7d34def7def8486023b37f015840c7`；脚本资产 SHA-256：`25ed1099095dbcfbd205b8b1c3427297583e85744b8a7f93457513865f00b9aa`。

## 2.9.77 same-tab memory recovery and continuation cap

- 在网页 JS 堆估算连续两次达到 1 GiB、且当前只有一个精确会话任务可恢复时，保存任务/会话状态并在原标签页重新加载当前会话；不依赖扩展宿主回收活动标签，也不新开重复标签。草稿、附件待上传、授权、发送/上传中或会话不匹配时不刷新。
- 同一 ChatGPT 会话最多发送 3 次“继续完成所有”。第 4 次之前保存当前可归属的 assistant 工作内容（剔除 stream timeout 等状态文本）并排入新会话继续，保留 task/phase/round/goal/next/attachments。
- 已发布：[GitHub Release](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/tag/v2.9.77)，[直接安装脚本](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/download/v2.9.77/chatgpt-auto-confirm.user.js)。主分支测试 run [36090932461](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36090932461) 和自动 Release run [36090980390](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36090980390) 均成功；Release 资产 SHA-256：`5771973ccd134321a781898af8c8b08738937fd1ab90928fe08efdbe62d57cf9`。
- 单元和 DOM 测试通过；Chrome 实站内存压力重载恢复仍需真实页面验收。

## 2.9.78 防止内存恢复刷新循环并降低长会话扫描开销

- 每个任务会话路由最多自动执行一次内存压力重载。长会话重新加载后若 JS 堆仍高，脚本会明确记录“避免循环刷新”，保留任务并继续监督；切换到新的会话路由后可重新评估。
- 加载检测优先检查 ChatGPT 主内容区，不再遍历整页 SVG 并逐个读取动画样式；页面进度指纹只对最近 8 条消息执行可见性/布局检查。
- 已发布：[GitHub Release](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/tag/v2.9.78)，[直接安装脚本](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/download/v2.9.78/chatgpt-auto-confirm.user.js)。Exact-source Test run [36093974738](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36093974738) 成功；发布提交 `fb65b1f6a73d257860c24e7a6020858207694473`，Release asset SHA-256：`43240530a14083d758594c117ec012786f02656aea8e78155cf9db14913c38b4`。
- 单测与语法验证通过；实站内存恢复和页面流畅度仍需你用新版在 Chrome 中验收。

## 2.9.80 修复恢复后的页面卡顿并补充扫描诊断

- 页面级限流、超时、连接中断和会话长度提示扫描会跳过整棵历史消息子树；当前响应的错误卡片和多段 assistant 回复仍在有界范围内单独检查，避免发送“继续完成所有”后每轮都重新遍历整段会话。
- 授权卡扫描先按“允许/Allow”标签筛选候选按钮，再执行可见性和布局检查，避免长页面上对所有按钮逐个读取布局。
- 慢扫描日志现在额外记录页面文字扫描、当前回复文字扫描和授权候选按钮的耗时与计数，仍不记录消息内容、任务目标、URL、token 或附件数据，便于在 Chrome 实测时定位卡顿阶段。

## 2.9.81 修复“恢复任务”后的工作台重绘卡死

- 修复恢复任务时的平方级工作台开销：旧版为每一条任务行重复读取并解析整份持久化任务数据，再为全部标签页重新创建任务行和“分配到”菜单；任务记录较多时会立即占满页面主线程。
- 同一次界面刷新现在只使用一份工作区快照；任务状态、归属、轮次等侧栏数据没有变化时不再重建所有任务行。普通状态日志只更新当前任务详情。
- 持久化日志仍保留原有上限，但工作台只渲染最近 30 条并明确提示完整记录仍在浏览器中，避免一次恢复把数十万字符重新插入 DOM。
- 工作台状态栏新增最近界面刷新耗时和侧栏重建次数；超过 500 ms 时控制台输出不含任务内容的“慢界面刷新诊断”。

## 2.9.82 修复任务运行期间的大型页面文字扫描卡顿

- 请求频率检查不再对每一个普通页面文字节点读取其所有祖先的完整文字；只有文字本身匹配限流提示时，才检查它是否属于“仅限制历史记录访问”的提示。
- 历史记录限流提示的祖先文本只读取有界尾部，避免重复复制大型主页面文本。
- 慢扫描诊断增加请求频率检查的耗时和历史提示祖先检查计数，用于确认页面恢复/续发后这条路径保持有界。

## 2.9.83 合并每轮页面状态扫描并限制大容器文本读取

- 一次任务检查中的限流、连接中断、会话长度和页面错误检测现在按需共享同一份页面文字快照；此前同一轮可能完整遍历页面四次。
- 会话长度提示先匹配短文本，再检查可见性；普通叶节点不再做冗余父级读取，跨节点提示只读取最多 600 字符的嵌套容器文本并缓存结果，超长容器会提前终止读取。
- 检测范围仍排除对话历史和 Fabushi 面板；慢扫描计数可直接确认每次检查的完整页面文字遍历是否降为最多一次。
- 已发布：[GitHub Release](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/tag/v2.9.83)，[直接安装脚本](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/releases/download/v2.9.83/chatgpt-auto-confirm.user.js)。Exact-HEAD Test run [36161307859](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36161307859) 和自动 Release run [36161369304](https://github.com/bhrumom/fabushi-chatgpt-auto-confirm-userscript/actions/runs/36161369304) 成功；发布资产 SHA-256：`a14efa788b56c2078c5380678d95d28c9fcf3abd41149fd80c7b6b71dcfd2018`。

## 2.9.72 中断后 Stop 卡住自动刷新重试

连接中断恢复中点击 Stop 后，如果 Stop 持续存在且对话连续 15 分钟没有新进展，会刷新原会话并保留“继续完成所有”的待恢复状态；页面恢复后再次处理 Stop 并重试。刷新按 15 分钟冷却，不重复派发目标；可见对话更新会重新开始无响应计时。

## 使用

在 ChatGPT 页面点击 **Fabushi 脚本**。左侧选择任务，右侧查看消息、状态和实时回复；底部输入任务，选择“单次任务”或“持续目标”后发送。

### 2.9.67 跨标签页任务分配

任务行可拖到左侧其他标签页工作区，让目标标签页接管该任务；同一工作区可以包含多个任务，继续由该标签页按会话链接轮换监控。也可以把任务拖到“新标签页”投放区，或用任务行“分配到…”菜单键盘操作。迁移只更改任务归属，保留当前阶段、轮次、目标/next、会话链接、发送标识和附件。Chrome 原生标签栏不接收网页脚本的拖放事件，所以投放目标位于 Fabushi 面板内。

- 单次任务：发送一次，确认当前轮最终回复后结束。
- 持续目标：工作会话只返回自然语言；工作结束后插件自动在同一标签页新开规划/验收会话，解析绑定任务 ID 和轮次的 JSON，完成则停止，未完成则把 `next` 原文交给新的 Work 会话。
- 会话切换：把 ChatGPT 的 `https://chatgpt.com/c/<会话ID>`（或对应 `chat.openai.com` 地址）作为唯一会话身份并持久记录，不读取也不等待侧边栏。发送后只有在本轮 `[Fabushi:任务标识]` 出现在页面时才记录浏览器实际生成的会话链接；切换期间短暂露出的旧链接、已被其他任务占用的链接都不会绑定到新任务。恢复时只打开当前阶段的 `task.url`，页面尚在加载只原地等待，不刷新、不重复导航，也不会因为侧栏延迟而等待 4 次。旧版的 `WEB:` 合成地址不会被强制打开；若当前页面带有本轮标识，会自动校正为真实链接。页面重载会保留正常任务的会话地址、链接历史和轮次标识，不会误判为未推进并反复新开 Chat。历史 `sessionUrl/sessionUrls/history` 仅用于展示证据，不会把上一轮 Work 链接当成当前目标恢复。任务详情里的“打开已记录会话链接”是带固定 `href` 的浏览器原生链接，显示哪个任务 URL 就只会打开该 URL；点击只切换查看目标并写入代际绑定的页面交接票据，不会暂停任务。若任务 URL 在界面渲染后发生变化，旧控件会拒绝导航而不是打开其他任务。新建目标或恢复任务时优先处理当前选中的任务，不会被旧失效会话阻塞；旧版留下的侧栏等待记录恢复时也会直接采用当前 `task.url`。
- 公平调度：导航保护、发送间隔、附件重试和异常退避都是任务自己的下一次可运行时间。一个任务等待时，调度器会继续检查其他已派发会话；只有所有任务都暂不可运行时才睡到最早截止时间。导航保护不会再显示成 ChatGPT 限流，也不会让整个标签页等待。
- 编辑目标：选中任务后点击“编辑目标”即可修改持久化目标；正在发送的当前会话不被改写，验收中的旧 `next` 会被丢弃，下一轮 Work 使用新目标。
- 消息历史：任务消息会保留最近 80 条、每条最多 12000 字符且每个任务总计最多约 320000 字符；任务目标、结果、附件元数据和恢复标识单独保存，不会因压缩丢失。
- 限流识别：只读取 ChatGPT 自己的可见页面提示，排除插件面板和聊天正文；插件写下的限流状态不会反过来触发新的限流等待。每个任务记录独立的限流恢复轮次；前三个独立 cooldown episode 继续等待，第 4 次会清除旧 conversation/token、切换到新 Chat 并原样重发当前 phase/round，目标与附件保持不变。
- 全页面授权：在“设置”中开启后，独立扫描任何 ChatGPT 会话里的授权卡。识别只看同一卡片中的“拒绝 + 允许/允许一次 + 下拉箭头”结构，完全不读取卡片正文；随后点击批准主按钮旁的箭头并选择本次会话选项。支持 `Allow GitHub for this conversation` 这类包含连接器名称的菜单文案，不依赖任务是否由脚本派发，也拒绝永久授权选项。
- ChatGPT 弹窗：持续扫描 ChatGPT 的对话/模态弹窗，发现明确的关闭、×、稍后或跳过控件就自动关闭；包含授权卡的弹窗交给授权流程处理，不会误点授权卡。
- 恢复已取消任务：选中已取消任务后点击“恢复任务”。已有持久化会话时继续监控原会话，尚未派发时回到等待队列。
- 删除旧任务：已完成、已取消、已暂停或需要处理的旧任务可在任务详情中删除；发送中或等待中的任务必须先暂停/取消，避免误删正在运行的会话身份。
- 绑定会话的最终回复：`停止回答` 按钮消失本身不再代表会话结束。授权卡、工具调用和 renderer 过渡都可能暂时隐藏 Stop；只要当前最新 assistant turn 还没有出现“复制回复 + 分享/评价/点赞/点踩”这一组最终回复操作栏，脚本就保留原 conversation URL、token、轮次和附件继续等待。已绑定会话的异常恢复只在原会话续写；只有尚未绑定真实会话且经过有界恢复仍无法确认归属的歧义发送，才允许 fresh-session 恢复。
- 消息错误/发送超时：页面出现“消息错误，请重试”“消息发送超时，请重试”或等价可重试错误时，只要本轮已有明确会话链接，插件就在当前会话输入并发送“继续完成所有”，保留原 URL、token、phase、round 和附件；若再次异常仍继续在同一会话恢复，直到出现真正最终回复。错误卡必须属于当前最新任务回复；更早的旧错误卡不会覆盖更新的最终回复。尚未绑定真实会话链接时仍保留原发送标识并拒绝盲目重复点击。
- 发送结果接管：如果 ChatGPT 已经创建了唯一的新会话，但 renderer 没有及时渲染本轮 `[Fabushi:任务标识]`，脚本会在超时后只接管当前唯一、未被其他任务占用的新会话链接，保留原 token、轮次和附件后直接检查最终回复，不会重复点击发送。发送结果仍无法安全归属时保持原 token 等待，不会盲目重发。
- 连接中断：当前 owned ChatGPT 会话出现“连接已中断。正在等待完整回复。”或 `Connection interrupted. Waiting for the complete answer` 时，如果 Stop 仍存在，保留原绑定会话并按“连续 5 分钟无可见进展”周期刷新同一 URL，不重复发送；页面有新进展会重新计时。Stop 已消失且仍没有最终回复时，沿用异常接力到新会话，并携带当前任务可安全提取的最新工作现场。
- 页面加载态：根页面或尚未归属当前任务的 renderer 仍按 spinner/`aria-busy`/进度条等待；但在已经绑定并确认属于当前任务的 `/c/<会话ID>` 中，真正生成必须以输入框旁仍存在 Stop 为准。若 Stop 已消失、没有授权卡、没有最终回复操作栏且 composer 已恢复，可见 spinner 不再掩盖异常结束；状态稳定 15 秒后在原会话发送“继续完成所有”。
- 任务附件：在任务目标下方可一次选择多个图片、视频或其他文件。文件本体只保存在当前浏览器的 IndexedDB，任务记录和发送文字只保存文件名、类型、大小等元数据；派发前脚本把原文件交给 ChatGPT 的原生文件输入或粘贴入口，并等待附件名称、预览或上传状态确认后才点击发送。无法找到控件、上传失败或超过 45 秒未确认时会停在“需要处理”，不会发送没有附件的纯文字目标；可在任务详情中重试。
- 左侧任务分组：左侧列表把当前标签页和每个可恢复标签页分别分组，任务行直接显示中文状态、轮次及当前运行标记；关闭标签页留下的记录和恢复动作都在对应的“可恢复标签页”组内，不再使用工作台顶部的恢复横条。
- 同页导航身份保持：ChatGPT 从 `/` 与 `/c/<id>` 之间完整跳转时，脚本会在旧文档释放 Web Lock 的短暂窗口内保留原标签页身份；只有确认是另一个真实标签页且锁持续占用后才分配新工作区，避免同一标签页的任务被误列为“可恢复标签页”。
- 热更新连续运行：脚本版本替换或同页重新注入时，会先等待旧实例真正释放标签页工作区锁，再用原标签页身份启动；不会把正在等待最终回复或准备验收的持续目标误放进“可恢复标签页”。同一页面遗留的重复工作台根节点和样式会一并清理，只保留一个活动实例。
- 多个任务：同一标签页只允许一个发送、发送确认或授权动作，避免重复派发；已经有真实会话链接的任务会按固定时间片轮换打开并检查，多个会话可同时在服务器端生成。切换监督不会新建会话，也不会因为轮询打断生成；没有 URL 的任务仍排队等待唯一一次发送。当前会话链接是唯一身份，不依赖侧边栏。
- 任务控制：点击任务行或“详情”查看该任务的目标、状态、轮次、会话链接、附件和完整日志；“暂停当前任务/继续当前任务”只影响选中的一条，其他任务继续调度。设置中单独提供“暂停全部任务/继续全部任务”，全局动作才会把当前标签页所有未完成任务标记为“已暂停”并启用跨标签版本屏障。运行中的任务会显示禁用的“删除”按钮，先暂停或取消后即可只删除该任务及其本地附件；已经交给 ChatGPT 服务器的生成不会被撤回，可在 ChatGPT 点击停止回答。普通 ChatGPT 页面刷新、切换或脚本更新只会停止该页面自己的调度并保留任务状态。
- 需要处理任务恢复：发送确认超时形成的“需要处理”不再被当成不可恢复终态。顶部“恢复任务”和任务详情按钮会区分已有会话、附件上传失败和发送中的不确定点击：已有 URL 只检查原会话；不确定点击保留 token 并等待恢复票据；未点击发送的任务才重新排队。任一分支都保留附件元数据，并在新 composer 中重新确认附件。
- 内存感知与标签页清理：脚本每 30 秒读取可用的 Chromium `performance.memory`，界面明确标注为“网页 JS 堆估算”，连续两次偏高或高压且达到 1 GiB 时先压缩自身日志、清理闲置观察和预览资源，再通过 Fabushi Chrome 宿主请求回收非活动标签页。宿主使用真实 `sender.tab.id` 调用 `tabs.discard()`；活动标签页、发送/上传/审批/导航、未保存输入和冷却期间均拒绝回收。标签页再次激活后依靠持久化任务与恢复票据继续运行。浏览器不提供 JS heap 指标时仍可手动请求宿主，但不会伪称拿到了整个标签页进程内存。
- 宿主恢复能力：在 Fabushi Chrome 扩展中，运行中的脚本会显式请求 `tab-recovery` 能力。宿主只登记 owner、任务状态、会话 URL、恢复 token、轮次和附件 ID 等元数据，并通过 `tabs` 生命周期与定时 watchdog 检测 `chrome-error://`、崩溃标题、discarded 或超时心跳；检测到后优先在原标签页打开一次性恢复 URL，原标签不可用时才接管新标签。暂停、取消、已完成任务不会登记恢复租约；独立油猴脚本没有宿主时仍使用同源 localStorage、IndexedDB 和新文档接管。
- 受控页面切换：多任务轮换前会向 Fabushi Chrome 宿主申请 `tab-navigation-guard`，宿主跨文档记录切换冷却、短时窗口和熔断状态；脚本自身也保留同样的本地节流，即使没有宿主也不会快速反复完整刷新。切换使用替换式导航避免无界增长浏览历史；宿主拒绝时保留任务与导航票据，冷却后再检查，不会重发任务。
- 脚本主动发起的同标签导航直接使用已记录的唯一会话链接，并凭 10 分钟内的一次性导航记录恢复；普通刷新会从已持久化的正常任务状态继续，不会清空原会话地址、链接历史或所有权标识。已完成 Work、尚未派发验收的任务恢复时不会误开上一轮链接。若 ChatGPT 路由长时间没有完成加载，只执行有限次数的单次恢复加载，随后保留发送意图等待，不会无限刷新同一页面。
- 输入框草稿：派发前若 ChatGPT 输入框里有与当前任务不同的旧草稿，会自动清空并替换为已持久化的本轮指令；即使输入框为空、ChatGPT 尚未显示发送按钮，也会先填入任务内容再查找发送控件，不会卡在“等待发送按钮”。
- 旧版任务保留在原存储中并标记暂停，不自动导入运行。

## 完成识别

本轮初始用户消息必须包含随机任务标识；脚本因异常恢复自动追加的“继续完成所有”可作为该标识之后的受控续发 turn 继续归属于同一任务。当前 assistant 回复在**同一个最新回复 turn** 满足以下任一完成证据且 `停止回答` 不存在、没有待授权卡、连续稳定至少 4 秒时才判定完成：①“复制回复/Copy” + 分享、评价回复/Rate response、点赞或点踩之一；② renderer 明确为非流式完成（如 `data-is-streaming=false` / `aria-busy=false` / `data-complete=true`）且当前回复本身已经出现“复制回复/Copy”。静态完成标记单独存在仍不能证明结束。反过来，若当前 assistant turn 仍有 `data-is-streaming=true` 或 `aria-busy=true`，即使 Stop 暂时消失，也保持“正在生成”，不会触发异常续发或加载恢复。任何加载恢复在真正提交刷新前都会重新检查一次最终回复；若最终回复已经出现，立即取消刷新。绑定会话连续 5 分钟没有可见进展时刷新同一 URL，不重发目标；Stop、streaming/busy、授权或会话加载期间不累计空闲停滞时间。最新八条可见对话消息的新增或文本更新会重置该空闲计时；若消息归属不明确，只会记作页面有变化，不会把它当成当前任务结果。Work 真正完成后才把自然语言结果写入同一任务的 `result`，再由新的规划/验收会话依据原目标、附件和该结果判断是否进入下一轮。规划/验收提示还会固定当前 `taskId` 与 `round`，历史 Work 文本里出现的旧报告身份只作为材料，不能覆盖当前验收身份。

授权限定为匹配卡片内的箭头菜单及“允许本次会话”，选择后验证卡片解除。ChatGPT 的 Radix 分裂按钮使用 `pointerdown` 展开，插件会先发送指针动作再点击，兼容菜单项为 `div[role=menuitem]` 的真实结构。没有匹配到菜单就保持等待。授权作用于用户启用自动授权的任务。

## 资源策略

任务调度器前台约 2 秒、后台约 4 秒采样，并用轻量定时器检查当前工作标签页中可关闭的 ChatGPT 弹窗；不监听全页面 MutationObserver；不运行跨标签心跳。没有任务或未开启本页授权扫描的个人标签页不会被脚本操作。任务日志最多保留 80 条、每条 12000 字符、每任务约 320000 字符，实时预览截取 6000 字符；内存监测每 30 秒采样，压力连续升高时先做脚本自身清理，再由宿主按安全条件 discard 非活动标签页。使用 Web Locks 防止两个标签页同时运行调度。

## 验证记录（2026-09-25，2.9.74）

运行 `npm test`：210 项测试中 203 项通过、7 项明确跳过、0 项失败。新增恢复回归覆盖任务标记被虚拟化时仍能在精确绑定会话识别授权卡、授权识别不授予回复归属、以及外来任务标记拦截；既有授权回归覆盖新版“允许一次 + aria-hidden 快捷键 + 审批选项”结构、真实 Radix `pointerdown` 菜单、GitHub 连接器命名的本次会话授权、永久授权拒绝和普通按钮排除。其余调度、附件、恢复、会话身份、限流、最终回复和内存回归也全部保持通过。canonical-main Test run `36078630086` 与 Release run `36078676229` 均成功；Release `v2.9.74` 指向源码提交 `552a887701272af8149ea0c45b56faded5628324`，脚本资产 SHA-256 为 `64c93916116a0a04fd113e5d903017477eb1929c03f0b79252d2f94d02b5dff9`。

运行 `node preview-server.mjs`，访问 `http://127.0.0.1:4178` 可查看明确标注的本地模拟页面。已通过实际界面操作完成：

1. 从脚本输入框发送单次模拟任务；识别授权卡，点击箭头和本次会话；等待模拟最终回复，状态变为已完成。
2. 从脚本输入框发送持续模拟目标；完成工作会话，自动打开同标签验收会话；读取匹配 JSON 后停止。

以上是模拟页面测试，不是 ChatGPT 实站执行证据。Fabushi 扩展 0.4.1 起由油猴脚本运行器动态注册和更新此脚本，不再把它写死为扩展内容脚本。本次架构切换需要在 `chrome://extensions` 对 Fabushi 最后点击一次“重新加载”；以后在 Fabushi Marketplace 搜索“ChatGPT 自动确认”，有新版本时按钮会显示“更新油猴脚本”。点击后直接读取市场指定版本、替换已安装脚本并接管已经打开的 ChatGPT 页面，不需要操作本地文件，也不再重新加载整个扩展。2.9.11 发布后页面根节点的 `data-version` 应为 `2.9.11`。更新检查会在本地内置脚本和远程版本之间选择较新的一个。实站显示的“工作区有成员达到使用上限”横幅不等同于当前账号已无法发送，只有独立的“请求过于频繁”提示才会触发休息等待。

脚本源码已独立提交到上述仓库；Fabushi Marketplace 仍通过其自身的脚本版本发布流程提供更新。旧版备份不纳入此独立仓库。

## 2.9.2 标签页隔离修正

每个标签页独立保存任务、暂停状态和授权开关。同页仅有一个任务且会话地址一致时不导航；只有同页多个目标才轮换。新轮次不接受该目标历史会话地址。使用浏览器的标签页生命周期锁防止复制标签页继承原页面任务身份，兼容 Fabushi 注入运行器，不依赖油猴专属接口。没有任务且未开启本页授权扫描的页面不自动关闭弹窗。

关闭标签页期间脚本无法执行；任务、完整消息记录和最新会话地址仍保留。重新打开 ChatGPT 后，旧工作区会按原标签页分组显示在工作台左侧。空白新标签页可从对应分组直接接管已关闭标签页的工作区，并立即显示进行中、已暂停、已完成或已取消的历史任务；当前标签页已经有任务时则从分组另开专用恢复标签页，避免覆盖当前工作区。原标签页仍开着（包括暂停状态）时拒绝重复恢复；手动暂停会保留，需要在恢复页点击继续。浏览器或扩展完全关闭期间无法进行后台监督。

## 2.9.3 关闭标签页后的任务记录恢复

- 旧工作区不再藏在“设置”中；只要本机存储里存在其他标签页的任务记录，工作台顶部就显示恢复入口。
- 新开的空白 ChatGPT 标签页可以直接接管已关闭标签页的工作区，不再额外打开第三个标签页。
- 恢复范围包括未完成任务和历史终态记录，避免“任务已完成后关标签页就看不到”的错觉。
- 接管前继续使用同源 Web Locks 做互斥确认；旧标签页仍存活或另一个标签页抢先恢复时会拒绝接管，不会让两个调度器同时操作同一任务。

轻量验证（2026-09-11）：`node --check chatgpt-auto-confirm.user.js` 通过；`npm test` 共 66 项通过，其中新增关闭标签页后原地恢复及已完成任务历史恢复回归。实站更新、发布与视觉证据仍需在 2.9.3 发布后完成。

### 2.9.4 会话异常结束恢复

监督器现在会在第一次看到“正确会话已稳定、无停止按钮、无最终回复、无授权卡”时启动 15 秒短倒计时，即使多任务轮询或页面恢复导致它没有亲眼看到停止按钮消失。可见 assistant 文本发生变化会重置计时；停止按钮、授权卡、最终回复、阻塞或限流状态会取消计时。倒计时到期后继续使用既有最多四次的新会话原样重发路径。

### 2.9.5 连接中断刷新与左侧任务分组

新增页面级“连接已中断。正在等待完整回复。”检测：在生成状态判断前受控刷新当前会话，同一会话最多两次，不清空会话身份或发送意图。任务工作台左侧现在以当前标签页和可恢复标签页为组，持续展示每个任务的状态、轮次和运行标记，恢复动作也收进对应标签页组内。

### 2.9.6 热更新工作区交接

同一文档替换脚本实例时，旧实例关闭现在会等待 Web Lock 完成释放，新实例只在确认同页旧实例后有限等待并重取原工作区；真正复制出来且原 owner 仍存活的标签页继续获得独立身份。启动和关闭都清理全部重复根节点/样式，避免多个工作台实例并存。这样持续目标的 Work 最终回复仍由原任务消费，并继续新开规划/验收会话。

### 2.9.8 同页导航工作区身份保持

完整页面导航或刷新会先等待旧文档释放工作区锁，再决定是否分配新的标签页身份。这样 ChatGPT 在 `/` 与 `/c/<id>` 之间切换时不会把同一标签页的任务误拆到“可恢复标签页”；只有确认是另一个仍占用锁的真实标签页时才会隔离工作区。

### 2.9.9 防止同页重复注入

脚本启动时先用同步 DOM 哨兵锁定当前文档，避免多个注入实例在异步初始化期间同时挂载工作台并争抢同一个标签页工作区。热更新仍会先关闭旧实例并安全替换哨兵。

### 2.9.10 页面加载态与异常结束隔离

脚本现在识别当前会话主内容区的可见 spinner、`aria-busy="true"`、进度条和加载语义。识别到加载中时显示“正在加载”，保持当前会话和任务占用，等待页面完全渲染；不会把空白加载画面误判为停止生成，不会启动无最终回复的 15 秒/5 分钟恢复路径，也不会因加载中的侧栏或工作台元素触发判断。加载标志消失后，异常结束观察会从新的稳定扫描重新开始。

轻量验证（2026-09-12）：`node --check chatgpt-auto-confirm.user.js` 通过；`npm test` 共 81 项通过，其中新增可见 spinner 识别、加载期间不启动异常结束、过滤聊天正文/输入框/侧栏/工作台指示器，以及加载信号消失后重新开始观察的回归。源仓库 CI、2.9.10 发布和 ChatGPT 实站 Chrome 视觉证据仍需在后续发布门禁中完成。

### 2.9.7 发送超时持续恢复

页面级“消息发送超时，请重试”和异常结束快速重试耗尽现在统一进入可持续的延迟恢复队列。插件先执行最多四次快速重发，仍失败则按 5、10、20、30 分钟封顶的持久化退避继续自动新开会话；任务不会被自动改成暂停，浏览器刷新或脚本更新后仍能从倒计时继续。仅在已确认真实会话链接时处理页面发送超时；尚未确认的点击继续采用不重复发送的安全策略。

### 2.9.11 任务目标附件输入

任务输入框现在支持一次选择多个图片、视频和其他文件。附件本体只保存在当前浏览器的 IndexedDB，`localStorage`、任务目标和发送提示词只保留文件名、类型、大小等元数据，不把文件内容写入日志或目标文字。派发前优先使用 ChatGPT 当前会话的原生文件输入，必要时回退到带 `DataTransfer` 的粘贴事件；随后等待当前 composer 中出现对应文件名、预览或附件卡片，并排除上传中的状态，确认成功后才发送任务。控件缺失、上传报错、浏览器清理附件或 45 秒内无法确认时，任务会停在“需要处理”，不会降级发送纯文字目标；详情页可重试。

轻量验证（2026-09-13）：`node --check chatgpt-auto-confirm.user.js` 通过；`npm test` 共 84 项通过，其中新增多文件任务输入、附件元数据不含文件内容、附件名称提示、当前 composer 附件确认范围和上传中任务调度占用回归。ChatGPT 实站的视频/图片/其他文件上传仍需在发布后的安全样本环境中完成视觉与行为证据验证。

### 2.9.16 附件上传、页面加载与入口恢复

- 根路径 `chatgpt.com/` 的可见加载转圈、主内容区水合和文档未完成加载现在都会被识别为“页面正在加载”，不会在会话尚未渲染时开始上传、点击发送或启动异常结束恢复。
- 页面加载期间会清除本轮临时上传计时，但保留 IndexedDB 中的附件；页面完全渲染后自动重新注入附件，并在确认附件预览/名称出现后才发送任务。
- 兼容 ChatGPT 将原生文件选择器 portal 到 composer 表单之外的页面结构；优先使用表单内控件，找不到时回退到页面级控件，同时排除 Fabushi 自己的文件选择器。
- 能识别上一版本留下的“附件上传未确认、等待超过 45 秒”阻塞记录，恢复为安全重试队列，不发送没有附件的纯文字目标。

轻量验证（2026-09-13）：`node --check chatgpt-auto-confirm.user.js` 通过；`npm test` 共 88 项通过，其中新增根路径加载转圈阻止派发、main 外应用加载层识别、表单外原生文件控件回退、旧附件超时记录安全恢复回归。在线文件曾因传输截断提示导致 2.9.14 无法启动，2.9.15 已用完整源码覆盖并递增版本号；2.9.16 进一步覆盖 ChatGPT 应用级加载层，确保油猴重新拉取后不会在 spinner 仍存在时开始附件上传。ChatGPT 实站上传仍需在更新后由用户使用实际图片/视频验证。

### 2.9.17 附件确认超时后的连续调度

- 附件上传确认的瞬时超时、控件暂不可用和一般上传错误不再把持续目标写成终态“需要处理”；任务保留在上传中，以 5–60 秒持久化退避自动重试，runner 会在下一次重试时间唤醒并继续后续任务。
- 不可恢复的本地附件缺失、重新选择、文件类型/大小不支持以及浏览器存储错误仍保持 fail-closed，必须由用户处理，不会降级发送无附件的纯文字目标。
- 附件确认范围覆盖当前 composer 附近的 portal/picker 链，但排除主内容、导航、侧栏、聊天正文和 Fabushi 自己的文件选择器；原生 FileList 还需与任务文件逐一匹配并稳定至少 1 秒后才算确认，避免误判。
- 新增附件连续调度回归，覆盖 portal 预览、原生 FileList、瞬时 45 秒超时退避、到点重试和永久错误阻断。

轻量验证（2026-09-13）：`node --check chatgpt-auto-confirm.user.js` 通过；focused JSDOM regression `5/5` 通过。完整 `npm test` 与 GitHub Actions 结果以本版本 PR 的 CI 为准。ChatGPT 实站图片/视频上传仍需在发布后的安全样本环境完成登录态行为与视觉证据验证。

### 2.9.20 标签页崩溃、发送确认和宿主恢复

- 运行中的工作区每 15 秒写入不含目标正文和文件本体的心跳。心跳保存任务、阶段、轮次、会话 URL、发送 token、恢复 URL 和附件 ID；重载或 renderer 恢复后沿用 IndexedDB 文件，在新的 ChatGPT composer 中重新上传并确认。
- 发送点击超过确认时限后，若当前标签页只有一个从根路径创建的新会话，脚本会安全绑定该 URL；若无法证明唯一归属，则保留发送 token 而不是清除 token 重发。原先被标为“需要处理”的不确定发送可通过“恢复任务”回到发送中等待，已有会话则转为只检查、不重发。
- Fabushi Chrome 宿主新增显式 `tab-recovery` 能力请求与持久租约。宿主通过崩溃页、崩溃标题、discarded 和 stale heartbeat 触发一次恢复，在原标签页或一次性新标签打开脚本恢复票据；关闭标签页只清理租约，不自动重开用户主动关闭的标签。

轻量验证（2026-09-14）：`node --check` 与完整 source regression 通过；新增恢复能力请求不携带任务正文/文件本体、唯一新会话接管、需要处理任务恢复和宿主 watchdog 合同测试。真实 Chrome renderer 崩溃旅程及 Fabushi Chrome 打包/E2E/线上扩展发布仍以受保护 `main` 的 CI 证据为准。

### 2.9.22 内存感知、脚本清理与宿主标签页回收

- 任务日志现在有 80 条、单条 12000 字符、单任务约 320000 字符的上限；压缩只处理日志，不删除任务目标、结果、附件元数据或恢复状态。
- 附件 dispatch context 只保留 composer 的 `WeakRef`；脚本实例关闭时会撤销预览 Blob URL、清理已选文件引用、取消内存监测定时器和全局事件监听，避免 SPA 重渲染/热更新留下旧闭包。
- 设置中新增“清理当前标签页内存”。脚本每 30 秒读取可用 Chromium JS heap 估算；连续两次偏高或高压且达到 1 GiB 后，先做本地有界清理，再通过 `tab-memory.request` 请求 Fabushi MV3 宿主。
- 宿主只依据消息发送方的真实标签页 ID，在 ChatGPT、非活动、无危险操作且不在冷却的条件下调用 `chrome.tabs.discard()`；活动标签页或不安全状态返回明确原因，不会静默刷新或丢失正在输入的任务。
- `performance.memory` 只估算网页 JS 堆，不代表 Chrome 标签页完整内存/进程 RSS；指标不可用时界面会明示。`chrome.tabs.discard()` 只能卸载非活动标签页并在下次激活时重载页面，不能让活动标签页保持运行同时回到初始内存。宿主回收请求仍保持最小诊断字段且不携带目标文字、会话 token 或附件内容。

轻量验证（2026-09-14）：`node --check` 通过；source regression `111/111` 通过，覆盖 JS heap 诊断、日志上限、任务/附件元数据保留和宿主请求脱敏。宿主静态契约、GitHub Actions、protected merge、Chrome packaged/现场证据与正式发布仍按 `TFI-USERSCRIPT-RECOVERY-013` 门禁。

### 2.9.21 任务级暂停、详情与安全删除

- 顶部按钮在选中可运行任务时只暂停当前任务；其他任务继续按单标签页调度。全局暂停/继续移入“设置”中的独立按钮，避免把两个动作混为一谈。
- 任务行现在直接显示“详情”和任务级“暂停/继续/恢复”操作；点击详情会在右侧展示该任务的目标、状态、轮次、附件、会话链接和完整日志。
- 每条任务行都有“删除”入口。运行中任务的删除按钮可见但禁用，必须先暂停或取消；暂停、取消、完成或需要处理的任务才允许只删除自身记录和本地附件。
- 单项暂停/取消不会写入全局自动恢复屏障；异步操作在下一次检查前停止副作用，也不会把人为暂停误记为“需要处理”。

轻量验证（2026-09-14）：`node --check chatgpt-auto-confirm.user.js` 通过；`npm test` 共 108 项通过，其中新增单任务暂停/继续不影响兄弟任务、任务详情入口、取消隔离和安全删除回归。真实登录态 Chrome 的逐步截图、完整视频和 trace/diagnostics 仍需发布后现场验收。

### 2.9.23 宿主更新契约清理

移除 `@updateURL` / `@downloadURL` 远程自更新元数据。脚本版本由 Fabushi 的已校验安装/宿主链路管理，避免用户脚本绕过宿主版本和来源校验。


### 2.9.25 最终回复闭环与下一轮派发

- 兼容 ChatGPT 在页面轮换/恢复后把 `data-is-streaming="false"` 放到 markdown 内容节点、或放到没有旧版 message/turn id 的会话包装节点；这些节点已经绑定到最后一条用户消息之后的 assistant 回复，因此不再因缺少旧 ID 把已结束回复留在“等待响应”。
- 最终标记在之前的加载/生成观察之后出现时，单独记录最终状态并稳定 4 秒确认，不再要求上一轮观察也必须是“clear”；确认后按 `等待响应 → 等待派发 → 新会话` 转换。
- “等待派发”是已确认结束后的跨会话安全节流（当前为 60 秒），用于避免多任务轮换造成连续导航、重复点击和 renderer 崩溃；它不是最终回复识别失败。没有安全节流时不会等待，已有会话仍按监督时间片轮换检查。


### 2.9.26 发送超时错误卡片与人工查看暂停标识

- ChatGPT 将“消息发送超时，请重试”渲染在 assistant 错误卡片内时，只要同一错误卡片附近存在可见“重试”控件，脚本会立即把本轮转入“等待派发”，清除旧会话地址并按恢复队列新开 Work/规划会话；没有重试控件的引用文字不会触发重复派发。
- 发送超时进入持续恢复队列，不会调用任务暂停逻辑；快速重试耗尽后仍以持久化退避等待，任务保持可自动恢复。
- “已暂停当前任务，正在打开已记录会话”改为明确记录用户点击了“打开已记录会话链接”，并提示通过“继续此任务”恢复，避免把人工查看与调度器自动暂停混淆。

### 2.9.28 并行任务会话归属隔离

- 多任务轮换时，结束识别不再读取页面全局最后一条用户/助手消息，而是只读取当前任务自己的 `[Fabushi:任务标识]` 用户轮次及其后续回复。
- 当前 URL 与任务标识必须同时匹配，才会读取停止按钮、授权卡和最终回复；页面交接期间残留的另一个任务消息会进入可恢复等待，不会被记录为当前任务的完成、超时或重试。
- 交接期间的页面错误提示也不会跨任务消耗重试预算；若当前任务消息长时间未重新渲染，只执行有限的页面恢复，不会把另一个任务的回复作为新一轮输入。

### 2.9.32 最终回复按钮、停滞刷新与验收恢复

- 最终回复识别以当前任务的 assistant turn 为边界；只要正文已显示并同时出现“复制”与“点赞/点踩”反馈按钮，即可作为最终回复证据。兼容图标按钮的 `aria-label`、`title`、tooltip、`data-testid` 和 SVG 语义属性；stale streaming 标记不会压过已经出现的完成操作栏，Stop、授权、限流和其他任务仍会优先阻断完成。
- 绑定会话连续 180 秒没有正文、操作按钮、加载、授权或任务状态变化时，刷新同一 ChatGPT URL，最多两次。刷新保留当前 phase、round、会话 token、附件和不重复发送保证；刷新后重新扫描授权卡和回复操作，不把刷新变成新一轮 Work。
- 验收回复严格 JSON 解析失败时，会有限恢复包裹文本、代码围栏和人类说明中的未转义引号；只在 taskId/round/status/summary/next 可验证时继续。恢复失败最多重新打开两次 review，会保留已完成的 Work 结果且不重复执行 Work，超过上限才显示需要处理。

### 2.9.33 停滞会话持续刷新

- 绑定会话连续 3 分钟没有可见变化时刷新当前页面；如果刷新后仍没有变化，之后每隔 3 分钟继续刷新，不再因为两次刷新而进入终态。
- 刷新次数和最近刷新时间仍持久化，保留任务 URL、phase、round、会话 token、附件和不重复发送保证；暂停、取消、最终回复、限流、阻塞和发送歧义等安全边界不变。
- 旧版本留下的 `stalledRefreshExhausted` 标记会自动迁移为可继续恢复状态，不会再阻断后续刷新。

### 2.9.34 分享按钮最终回复识别

- 最终回复操作栏现在接受“复制 + 分享”作为完成证据，同时继续支持“复制 + 点赞/点踩”。中英文按钮、图标按钮语义属性、stale streaming 标记、传送到文档外的已绑定操作栏，以及无关页面分享按钮都分别经过回归验证。

### 2.9.35 真实回复操作栏兼容

- 根据真实 ChatGPT 页面当前暴露的回复操作栏，补充识别“复制回复”与“评价回复/Rate response”组合；页面顶部的无关“分享”按钮不会单独完成任意回复。分享、评价、点赞/点踩共用同一个当前 assistant turn 归属校验。

### 2.9.38 油猴式自更新地址

- 在脚本元数据中固定 `@updateURL` / `@downloadURL`，由脚本管理器和 Fabushi 宿主直接读取远端 `@version`。
- 后续脚本发布不再依赖 Marketplace 目录同步版本；目录只作为首次安装和兼容发现入口。


### 2.9.39 授权期间 Stop 消失不再误判结束

- 修复连接器授权卡、工具调用或 renderer 过渡时 `停止回答` 暂时消失却被当作异常结束的问题。
- 已绑定会话不再从 Stop 消失推导 `no-final-reply`，因此不会因为授权中的短暂状态清空当前 URL/token 并新开会话重复发送。
- 正常完成只接受当前 assistant turn 的最终回复操作栏：复制 + 分享/评价/点赞/点踩，并要求该证据稳定后才进入下一轮。
- 静态 completion marker 仅保留为诊断信息；没有最终操作栏时保持 waiting。3 分钟停滞恢复继续只刷新原会话 URL。

### 2.9.40 异常中断只在原会话续写

- 已绑定会话遇到“消息错误/发送超时，请重试”时，不再清空会话并 fresh-session 重发原任务，而是在原会话直接发送“继续完成所有”。
- “连接已中断。正在等待完整回复。”持续超过 30 分钟后，在同一会话发送“继续完成所有”；一般已绑定会话连续 30 分钟仍无最终回复时也采用同一续写恢复。
- 续发 user turn 保持原 Fabushi task 归属；旧错误卡只在它仍属于当前最新回复时才可触发恢复，不能覆盖之后已经出现的最终回复。
- 最终完成边界不变：当前最新 assistant turn 必须出现复制 + 分享/评价/点赞/点踩的最终操作栏、Stop 不存在并稳定。只有该条件确认后，持续目标才会新开下一轮 Work/Review 会话。

### 2.9.41 三次中断刷新、限流升级与 Stop/loading 边界

- “连接已中断。正在等待完整回复。”采用连续三次同 URL 恢复预算；第 3 次刷新后仍存在直接原会话续发“继续完成所有”。
- 同一任务第 4 个独立“请求过于频繁” cooldown episode 会切换 fresh Chat 并重发当前任务，保留目标、phase、round 和附件。
- 已绑定且属于当前任务的会话不再仅凭 spinner 判定生成中；Stop 缺失 + 无授权卡 + 无最终操作栏 + composer 可用稳定 15 秒即视为异常停止并原会话续发。
- Stop 存在仍是生成中，授权卡仍优先处理，最终回复操作栏仍是唯一正常完成边界。

### 2.9.42 对话长度上限自动接力

- 当前任务会话出现“你已达到此对话的长度上限，你可以开始新聊天以继续对话。”或等价英文提示时，不把它当作最终回复；先保存当前页面最新 assistant 回复，再清理当前 conversation/token 并新开 ChatGPT 会话。
- 新会话继续使用原任务、当前 phase/round 和附件，同时把上一会话最后回复作为接力上下文明确放入 prompt，要求从停止处继续、不要重做已完成步骤。
- Work 与规划/验收都支持接力；Review 会继续保留 Work 自然结果和 MAHAYANA_TASK_REPORT_V1 输出契约。
- 若新会话再次达到长度上限，继续重复 fresh-chat 接力；每次只携带最新页面回复，避免无限累积。只有真正最终回复操作栏确认后才结束接力并清除临时 carry 状态。
- 检测排除用户引用、blockquote/code 引用和 Fabushi 自己的日志，避免脚本讨论这段提示时自触发。

### 2.9.43 连接中断计数保持

- `连接已中断。正在等待完整回复。` 现在既支持页面状态栏，也支持当前 owned assistant 实时回复区域的独立错误文本。
- 同一 `/c/<id>` 的中断刷新计数不会因为 reload 后短暂出现“正在加载/正在生成”或 banner 暂时消失而归零。
- 中断恢复使用独立 10 秒节流：第 1/3、2/3、3/3 次刷新都会保留计数；第三次刷新后仍检测到中断时，在原会话发送 `继续完成所有`。
- 只有 conversation URL 改变、真正发送 continuation、或收到真正最终回复时才清空本次中断预算。

### 2.9.44 3/3 后强制续发保证真实提交

- 连接中断达到 3/3 后不再只做一次 `sendContinuation()` 尝试，而是先持久化同会话 `pending continuation`。
- 若此时 ChatGPT 仍显示“停止回答”，脚本会先点击 Stop 结束已经失败的生成，并保留 pending；输入框/发送按钮恢复后继续重试，直到真的点击发送 `继续完成所有`。
- pending 不依赖“连接已中断”提示继续存在，因此 Stop 后 banner 消失也不会丢失续发。
- 强制续发绕过普通 60 秒 continuation cooldown；重复保护由单一 pending intent 和实际 Send click 后立即清理负责。
- 授权卡、限流、安全 blocker 仍优先处理；这些状态消失后 pending 自动继续。

### 2.9.45 加载恢复不再静默停机

- 修复同一 `/c/<id>` 页面长时间加载时只打印“第 1/2 次单次加载恢复”却没有真正刷新、随后 scheduler 完全停止的问题。
- same-route recovery 现在执行真实 document reload；普通 same-route 导航仍保持 no-op。
- 导航被拒绝、ticket 过期或取消后会重新唤醒 scheduler；已提交的 reload/replace 若 8 秒内文档没有卸载，也会由 watchdog 自动解除 `navigating` 并继续检查。
- 历史版本曾在 1/2 -> 2/2 后进入 fresh-document recovery；自 `2.9.87` 起改为当前标签页等待 60 秒后继续刷新。

### 2.9.46 通用停滞刷新改为 15 分钟

- 普通已绑定 ChatGPT 会话只有连续 15 分钟没有可见进展时才执行 generic stall refresh；后续重复 generic refresh 也至少间隔 15 分钟。
- 未绑定的 ambiguous send 恢复仍保持独立 3 分钟节奏；连接中断、限流、loading renderer recovery、授权和最终回复边界不受此次调整影响。


### 2.9.47 连接中断刷新改为 15 分钟

- “连接已中断。正在等待完整回复。”不再使用 10 秒快速恢复；首次检测先保留原会话等待 15 分钟，满 15 分钟后才执行第 1/3 次刷新。
- 第 2/3 和第 3/3 次刷新也分别要求再等待至少 15 分钟，不会连续快速刷新。
- 第 3 次刷新后仍中断时，继续沿用 v2.9.44 的 durable pending continuation，在原会话停止失败生成并真正发送“继续完成所有”；不会新建会话。
- 普通 generic stall 仍保持 v2.9.46 的 15 分钟阈值；ambiguous-send 恢复仍保持独立 3 分钟节奏；限流、授权、loading renderer recovery 与最终回复边界不变。
- 本节覆盖 2.9.43 中关于连接中断 10 秒节流的历史行为。


### 2.9.48 连接中断直接新开会话重发

- “连接已中断。正在等待完整回复。”现在是立即 fresh-chat 的明确恢复信号，不再执行 v2.9.47 的 15 分钟等待与 1/3→3/3 同会话刷新。
- 检测到中断后立即记录旧 conversation URL 到 history，清空旧 dispatch URL/token/发送状态，保留同一 task、phase、round、目标/next 和附件，并重新排队。
- 新会话使用新的随机发送标识和新的 conversation identity，通过现有 Work/planner prompt 自动发送当前阶段完整消息；连接中断恢复使用一次性 immediate-dispatch 标记，不受普通会话间发送冷却影响。
- 旧版本遗留的 pending interruption continuation 也会迁移到 fresh-chat，而不会在旧会话继续发送“继续完成所有”。
- 普通 generic stall 仍为 15 分钟；ambiguous-send、限流、授权、loading renderer recovery、消息错误/发送超时的同会话恢复以及真正最终回复判定保持不变。
- 本节覆盖 v2.9.41–v2.9.47 中所有“连接中断刷新/原会话续发”历史策略。

### 2.9.49 流式最终回复与验收身份恢复

- 当前 assistant turn 的 `data-is-streaming=true` / `aria-busy=true` 现在直接保持生成态；Stop 临时消失不再触发 15 秒异常续发或“页面长时间没有恢复”加载恢复。
- 已完成回复除了“复制 + 分享/评价/点赞/点踩”外，也接受“明确非流式完成标记 + 当前回复 Copy”作为完成证据，兼容 ChatGPT 二级操作按钮延迟挂载的 UI。
- 加载恢复在计数/日志前以及真正提交 reload 前都会重新读取当前 owned turn；若最终回复已经出现，取消刷新并继续进入完成处理，避免“最终回复已经显示却被刷新”。
- 规划/验收提示固定当前 `taskId` 与 `round`，解析器在混杂旧报告/引用材料时优先选择与当前任务和轮次精确匹配的报告；身份不匹配按可修复验收错误处理，只重开验收，不重复 Work。


### 2.9.50 异常会话实时回复接力

- 当前 owned 会话因“连接已中断”等异常必须切换到 fresh Chat 时，不再只原样重发上一轮提示词；脚本会先读取异常会话当前 assistant turn 已经显示的实时回复，去掉独立的连接中断状态文本并做有界保存，再清理旧 conversation/token。
- 新 Work 会话的恢复提示固定分成三部分并保持这个顺序：①规划/验收会话最终给出的本轮提示词（首轮则为当前任务提示）；②异常会话里 ChatGPT 已经工作的实时回复；③原始目标。新会话被明确要求承接第二部分、从中断处继续第一部分，不重新执行已经完成的步骤，并始终受第三部分原始目标约束。
- 异常接力内容与当前 phase/round 绑定；若连续多个异常会话接力，只保存最新异常会话的实时回复而不无限累积。人工编辑目标或当前阶段取得真正最终回复后会清空接力内容，避免污染后续轮次。
- 连接中断之外，限流升级和其他需要清理旧派发并 fresh-chat 自动恢复的异常路径也会在能够证明当前页面属于该任务时保存 owned assistant 回复；无法证明归属时 fail closed，不带入其他会话内容。
- 规划/验收阶段若自身异常 fresh-chat，也会携带该异常验收会话已经输出的实时回复，同时仍强制当前 taskId/round 为唯一报告身份，历史文本只能作为验收材料。


### 2.9.51 虚拟化任务标识时仍可提取异常会话工作内容

- 修复 v2.9.50 的安全归属条件过严问题：ChatGPT 长回复期间可能把包含 `[Fabushi:token]` 的 user turn 从当前 DOM 虚拟化/卸载，但当前 assistant 回复和页面级“连接已中断”状态仍然可见。旧逻辑因此能确认会话需要 fresh-chat，却因 `turn.owned=false` 拒绝提取明明可见的工作内容。
- 新逻辑仍优先使用正常 marker-owned assistant turn；若 marker 暂时不在 DOM，则先使用同一 URL、同一 phase/round 下此前已确认归属的实时 preview；仍没有时，只在 inspect 已确认“当前精确 conversation URL 属于该任务且页面没有任何 foreign task marker/其他 URL owner”时，回退读取当前页面最新 assistant turn。
- exact-route 回退只服务于已经决定要丢弃该异常会话的安全边界，不会放宽正常任务完成/验收的 ownership 判定；出现其他任务标识时继续 fail closed。
- fresh-chat 前会清理 preview 的 URL/phase/round 元数据，防止下一异常会话误用上一跳的预览；真正 final 和人工改目标也继续清理异常 carry。

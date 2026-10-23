  const DEFAULT_EXECUTION_RULES = "【强制执行与完成门槛】\n最终回复模板只是每轮的机器可读状态报告，不是停止工作的许可。只有在当前轮可执行工作已经真实落地后，才输出该模板；整个任务仍有要求未完成时，必须使用 status=next 继续后续 Work 轮次，绝不能提前使用 status=complete 结束任务。\n\n必须在内部逐项列出原始目标和每项明确要求/验收条件，然后逐项完成实际动作并核对证据。分析、方案、建议、任务拆解、代码片段、尚未应用的 diff 或口头声称均不等于完成；不得把“我将会”“建议下一步”或“已经分析”当作落地交付。严格按原始任务权限和范围执行：实现任务必须实际修改目标文件、配置或数据并按要求提交到云端；如果任务明确要求 PR、合并、发布、部署或其他交付步骤，必须完成对应步骤。若任务明确是只读审计，必须完成每一项真实读取、SHA/调用方/唯一状态 owner/生产接线/责任账本锚点等核验并保存可复核证据，绝不能为了通过门槛而修改被禁止改动的代码、账本或其他文件。\n\n只有每项要求和验收条件都已按原始范围实际完成，且有真实、可追溯的证据，才允许 status=complete。代码变更需要构建或测试时，必须核对绑定当前 exact commit/head 的 GitHub Actions 结果；queued/in_progress、失败、缺少证据、未提交变更或任务要求的交付步骤仍未完成，都不算通过。不得虚构测试、SHA、提交、合并、发布或部署结果。\n\n只要还有任何可执行的实现、核验、提交或交付工作，必须立即继续执行，不得因已经分析完、写好报告、上下文变长或接近回复边界而停止。遇到阻塞时先继续其他独立可做的事项；没有状态变化不得反复执行同一个失败动作。若仍有未完成项，必须使用 status=next，summary 只写已核实进展和缺口，next 写一条当前可以立即执行的具体动作。若仅剩外部阻塞，也不能标 complete；准确说明阻塞和解除后可执行的下一步，并在阻塞未变化时继续推进其他可做工作。若当前轮属于最终报告修复，使用已保存的证据，不重复已完成的生产修改；若证据揭示真实缺口，仍不得标 complete，必须补齐或使用 status=next 继续落地。\n";
  function normalizePromptConfig(value) {
    const config = value && typeof value === 'object' ? value : {};
    return { executionRules:typeof config.executionRules === 'string' ? config.executionRules.slice(0,8000) : DEFAULT_EXECUTION_RULES,
      additions:(Array.isArray(config.additions) ? config.additions : []).slice(0,8).map((item,index)=>({
        id:String(item?.id || `section-${index}`).slice(0,80), title:String(item?.title || '附加提示词').slice(0,80),
        text:String(item?.text || '').slice(0,2000), enabled:item?.enabled !== false,
      })) };
  }
  function prepareTaskPrompt(task) {
    task.promptConfigSnapshot=normalizePromptConfig(data.promptConfig);
    task.githubDeliveryRequired=true;task.githubDeliveryPending=false;
    task.githubDeliveryAttempts=0;task.githubDeliveryBoundary='';task.githubDeliveryReportBoundary='';task.githubDeliveryLimitNoted=false;
    task.preparedPrompt=workPrompt(task);
    return task.preparedPrompt;
  }
  function githubDeliveryEvidence(report) {
    const proof=report?.githubDelivery;
    if(!proof || proof.verified !== true || typeof proof.sha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(proof.sha)) return false;
    try {
      const url=new URL(proof.commitUrl);
      const match=url.pathname.match(/^\/[^/]+\/[^/]+\/commit\/([a-f0-9]{40}|[a-f0-9]{64})\/?$/i);
      return Boolean(url.protocol==='https:' && url.hostname==='github.com' && !url.port && !url.username && !url.password
        && !url.search && !url.hash && match && match[1].toLowerCase()===proof.sha.toLowerCase());
    } catch {return false;}
  }
  function githubDeliveryInstruction(task) {
    return `【GitHub 提交与结束会话的强制门槛】
在输出本轮任何最终报告（status=next 或 complete）、结束本次会话之前，必须先把本轮实际工作结果按任务允许范围提交并推送到 GitHub，并通过 GitHub 连接器/API 回读核验远端提交、文件内容与完整 SHA。只在本地 commit、尚未 push、仅提供计划/补丁、只开 PR 而无可回读提交、口头声称提交均不算完成。
只读审计可在获准路径提交审计结果/证据，不得修改禁止改动的生产代码、账本或其他受保护文件。不得为满足本门槛伪造提交或擅自扩大权限；没有写入权限时继续处理其他获准事项并等待权限恢复，不得给出宣称提交完成的最终报告。
最终 JSON 必须附上 githubDelivery:{"commitUrl":"https://github.com/OWNER/REPO/commit/FULL_SHA","sha":"完整真实提交 SHA","verified":true}，且 URL 和 SHA 必须一致；verified=true 只能在远端回读成功后填写。提交结果必须属于本任务本轮，而不是引用无关或旧提交。taskId=${task.id}，round=${task.round}。`;
  }
  function openPromptComposer(task) {
    document.getElementById('fabushi-prompt-composer')?.remove();
    let draft=normalizePromptConfig(data.promptConfig);
    const overlay=element('section');overlay.id='fabushi-prompt-composer';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','提示词组合');
    overlay.style.cssText='position:fixed;inset:6vh 8vw;z-index:2147483647;overflow:auto;background:#252525;color:#eee;padding:22px;border:1px solid #777;border-radius:16px;font:14px system-ui;box-shadow:0 12px 80px #0009';
    const appendButton=(parent,label,action)=>{const button=element('button',label);button.type='button';button.style.cssText='margin:4px;padding:7px 12px;cursor:pointer';button.onclick=action;parent.append(button);return button;};
    const render=()=>{
      overlay.replaceChildren();
      const title=element('h2','提示词组合');overlay.append(title);
      appendButton(overlay,'关闭提示词编辑器',()=>overlay.remove());
      const status=element('p','修改后保存，从下一次尚未准备的发送生效；已准备或已发送的提示词保持不变。');overlay.append(status);
      const rules=element('textarea');rules.value=draft.executionRules;rules.maxLength=8000;rules.setAttribute('aria-label','执行规则提示词');rules.style.cssText='display:block;width:98%;min-height:160px;background:#333;color:#eee';
      overlay.append(element('h3','可编辑执行规则（最多 8000 字符）'),rules);
      rules.oninput=()=>{draft.executionRules=rules.value;refresh();};
      const additions=element('div');overlay.append(element('h3','附加提示词（最多 8 段，每段 2000 字符）'),additions);
      draft.additions.forEach((part,index)=>{
        const card=element('section');card.style.cssText='border:1px solid #666;padding:10px;margin:10px 0';
        const enabled=element('input');enabled.type='checkbox';enabled.checked=part.enabled;enabled.setAttribute('aria-label',`启用附加提示词 ${index+1}`);enabled.onchange=()=>{part.enabled=enabled.checked;refresh();};
        const name=element('input');name.value=part.title;name.maxLength=80;name.setAttribute('aria-label',`附加提示词标题 ${index+1}`);name.oninput=()=>{part.title=name.value;refresh();};
        const body=element('textarea');body.value=part.text;body.maxLength=2000;body.setAttribute('aria-label',`附加提示词内容 ${index+1}`);body.style.cssText='display:block;width:98%;min-height:80px;background:#333;color:#eee';body.oninput=()=>{part.text=body.value;refresh();};
        card.append(enabled,name,body);
        appendButton(card,'上移',()=>{if(index){[draft.additions[index-1],draft.additions[index]]=[part,draft.additions[index-1]];render();}});
        appendButton(card,'下移',()=>{if(index<draft.additions.length-1){[draft.additions[index+1],draft.additions[index]]=[part,draft.additions[index+1]];render();}});
        appendButton(card,'删除此段',()=>{draft.additions.splice(index,1);render();});additions.append(card);
      });
      appendButton(overlay,'新增提示词',()=>{if(draft.additions.length<8){draft.additions.push({id:id(),title:'附加提示词',text:'',enabled:true});render();}});
      appendButton(overlay,'恢复默认提示词',()=>{draft=normalizePromptConfig(null);render();});
      appendButton(overlay,'保存提示词组合',()=>{data.promptConfig=normalizePromptConfig(draft);save();status.textContent='已保存；从下一次新准备的发送生效。';refresh();});
      const list=element('div');overlay.append(element('h3','实际组合顺序'),list);
      const preview=element('textarea');preview.readOnly=true;preview.setAttribute('aria-label','下一次发送完整提示词预览');preview.style.cssText='display:block;width:98%;min-height:260px;background:#191919;color:#ddd';overlay.append(element('h3','下一次发送完整预览'),preview);
      if(task?.preparedPrompt){const prepared=element('textarea');prepared.readOnly=true;prepared.value=task.preparedPrompt;prepared.setAttribute('aria-label','当前已准备的发送原文');prepared.style.cssText='display:block;width:98%;min-height:120px;background:#191919;color:#ddd';overlay.append(element('h3','当前已准备的原文（保持不变）'),prepared);}
      function refresh(){
        const target={...(task || {id:'新任务预览',round:1,token:'发送时生成',goal:'（在任务目标中填写）',phase:'work',attachments:[]}),promptConfigSnapshot:normalizePromptConfig(draft)};
        const parts=workPromptSections(target);list.replaceChildren();
        parts.forEach((part,index)=>{const details=element('details');details.append(element('summary',`${index+1}. ${part.title}${part.editable?' · 可编辑':' · 自动组合/固定要求'}`),element('pre',part.text));details.style.cssText='padding:6px;border-bottom:1px solid #444';const pre=details.querySelector('pre');pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere';list.append(details);});
        preview.value=parts.map(part=>part.text).join('\n');
      }
      refresh();
    };
    render();(document.getElementById(ROOT) || document.body || document.documentElement).append(overlay);
  }

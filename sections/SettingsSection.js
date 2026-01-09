export default class SettingsSection {
    constructor(root, { onAddRule, onUpdateRule, onDeleteRule, onUpdateScope, onRunGrouping }) {
        this.root = root;
        this.onAddRule = onAddRule || (() => {});
        this.onUpdateRule = onUpdateRule || (() => {});
        this.onDeleteRule = onDeleteRule || (() => {});
        this.onUpdateScope = onUpdateScope || (() => {});
        this.onRunGrouping = onRunGrouping || (() => {});
    }

    render({ rules, scope, windows }) {
        const typeOptions = (value) => `
            <option value="domain" ${value === 'domain' ? 'selected' : ''}>域名</option>
            <option value="keyword" ${value === 'keyword' ? 'selected' : ''}>关键词</option>
            <option value="regex" ${value === 'regex' ? 'selected' : ''}>正则</option>
        `;
        const windowOptions = windows
            .map((item) => `<option value="window:${item.id}">窗口 ${item.id}</option>`)
            .join('');

        this.root.innerHTML = `
            <div class="settings-panel">
                <div class="settings-header">
                    <div>
                        <div class="settings-title">设置</div>
                        <div class="settings-sub">支持域名/关键词/正则规则，关键词与正则匹配标题+URL，域名规则可匹配子域名。</div>
                    </div>
                </div>

                <div class="settings-section">
                    <div class="settings-section-title">按域名分组</div>
                    <div class="settings-scope">
                        <label class="settings-label">
                            执行窗口
                            <select class="settings-select" data-scope>
                                <option value="current" ${scope === 'current' ? 'selected' : ''}>当前窗口</option>
                                <option value="all" ${scope === 'all' ? 'selected' : ''}>所有窗口</option>
                                ${windowOptions}
                            </select>
                        </label>
                        <button class="settings-btn primary" data-run>立即执行</button>
                    </div>

                    <div class="settings-add">
                        <select class="settings-select" data-rule-type>
                            ${typeOptions('domain')}
                        </select>
                        <input class="settings-input" data-domain placeholder="域名/关键词/正则" />
                        <input class="settings-input" data-group placeholder="分组名称，如 GitHub" />
                        <button class="settings-btn" data-add>添加规则</button>
                    </div>

                    <div class="settings-list">
                        ${rules
                            .map(
                                (rule) => `
                                <div class="settings-rule" data-rule-id="${rule.id}">
                                    <select class="settings-select" data-edit-type>
                                        ${typeOptions(rule.type)}
                                    </select>
                                    <input class="settings-input" data-edit-domain value="${rule.pattern}" />
                                    <input class="settings-input" data-edit-group value="${rule.groupName}" />
                                    <button class="settings-btn" data-save>保存</button>
                                    <button class="settings-btn ghost" data-delete>删除</button>
                                </div>
                            `
                            )
                            .join('')}
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    }

    bindEvents() {
        const scopeSelect = this.root.querySelector('[data-scope]');
        if (scopeSelect) {
            scopeSelect.addEventListener('change', () => {
                this.onUpdateScope(scopeSelect.value);
            });
        }

        const runButton = this.root.querySelector('[data-run]');
        if (runButton) {
            runButton.addEventListener('click', () => this.onRunGrouping());
        }

        const addButton = this.root.querySelector('[data-add]');
        if (addButton) {
            addButton.addEventListener('click', () => {
                const domainInput = this.root.querySelector('[data-domain]');
                const groupInput = this.root.querySelector('[data-group]');
                const typeSelect = this.root.querySelector('[data-rule-type]');
                const domain = domainInput ? domainInput.value : '';
                const groupName = groupInput ? groupInput.value : '';
                const ruleType = typeSelect ? typeSelect.value : 'domain';
                this.onAddRule(ruleType, domain, groupName);
            });
        }

        this.root.querySelectorAll('.settings-rule').forEach((row) => {
            const ruleId = row.dataset.ruleId;
            const domainInput = row.querySelector('[data-edit-domain]');
            const groupInput = row.querySelector('[data-edit-group]');
            const typeSelect = row.querySelector('[data-edit-type]');
            const saveButton = row.querySelector('[data-save]');
            const deleteButton = row.querySelector('[data-delete]');

            if (saveButton) {
                saveButton.addEventListener('click', () => {
                    const ruleType = typeSelect ? typeSelect.value : 'domain';
                    const domainValue = domainInput ? domainInput.value : '';
                    const groupValue = groupInput ? groupInput.value : '';
                    this.onUpdateRule(ruleId, ruleType, domainValue, groupValue);
                });
            }

            if (deleteButton) {
                deleteButton.addEventListener('click', () => {
                    this.onDeleteRule(ruleId);
                });
            }
        });
    }
}

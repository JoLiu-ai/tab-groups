import GroupSidebar from '../sections/GroupSidebar.js';
import GroupDetail from '../sections/GroupDetail.js';
import SettingsSection from '../sections/SettingsSection.js';
import ChromeService from '../services/ChromeService.js';
import StorageService from '../services/StorageService.js';
import SessionsService from '../services/SessionsService.js';

export default class App {
    constructor(root) {
        this.root = root;
        this.sidebarRoot = null;
        this.detailRoot = null;
        this.modalRoot = null;
        this.state = {
            activeGroups: [],
            closedGroups: [],
            selectedGroupId: null,
            viewMode: 'active',
            searchTerm: '',
            collapsedCategories: new Set(),
            categories: [],
            categoryMap: {},
            lockedSignatures: new Set(),
            starredSignatures: new Set(),
            page: 'list',
            domainRules: [],
            domainScope: 'current',
            windowOptions: []
        };
    }

    async init() {
        this.renderShell();
        this.sidebar = new GroupSidebar(this.sidebarRoot, {
            onSelectGroup: (groupId) => this.setSelectedGroup(groupId),
            onSearch: (term) => this.setSearchTerm(term),
            onCreateCategory: () => this.handleCreateCategory(),
            onToggleAll: () => this.toggleAllCategories(),
            onToggleCategory: (category) => this.handleToggleCategory(category),
            onImportClosed: () => this.importClosedFromSessions(),
            onGroupByDomain: () => this.groupByDomain(),
            onDropTab: (tabId, targetGroupId, sourceGroupId) => this.moveTabToGroup(tabId, targetGroupId, sourceGroupId),
            onMergeWindows: () => this.mergeWindows()
        });
        this.detail = new GroupDetail(this.detailRoot, {
            onToggleView: (mode) => this.setViewMode(mode),
            onArchiveGroup: () => this.archiveCurrentGroup(),
            onRestoreGroup: () => this.restoreCurrentGroup(),
            onDeleteGroup: () => this.deleteCurrentGroup(),
            onOpenGroup: () => this.openCurrentGroup(),
            onToggleLockGroup: () => this.toggleLockCurrentGroup(),
            onToggleStarGroup: () => this.toggleStarCurrentGroup(),
            onMoveGroup: (payload) => this.openMoveTabsModal(payload),
            onCopyLinks: () => this.copyCurrentGroupLinks(),
            onDedupeGroup: () => this.dedupeCurrentGroup(),
            onMoreActions: () => this.moreCurrentGroupActions()
        });
        this.settings = new SettingsSection(this.detailRoot, {
            onAddRule: (ruleType, pattern, groupName) => this.addDomainRule(ruleType, pattern, groupName),
            onUpdateRule: (ruleId, ruleType, pattern, groupName) =>
                this.updateDomainRule(ruleId, ruleType, pattern, groupName),
            onDeleteRule: (ruleId) => this.deleteDomainRule(ruleId),
            onUpdateScope: (scope) => this.updateDomainScope(scope),
            onRunGrouping: () => this.groupByDomain()
        });
        this.bindTopbar();
        await this.loadData();
        this.render();
    }

    renderShell() {
        this.root.innerHTML = `
            <div class="app-shell">
                <header class="topbar">
                    <div class="topbar-left">
                        <div class="topbar-brand">Tab Groups</div>
                        <nav class="topbar-nav">
                            <button class="topbar-nav-item is-active" data-page="list">
                                <span class="topbar-icon">&#8962;</span>
                                <span>列表</span>
                            </button>
                            <button class="topbar-nav-item" data-page="settings">
                                <span class="topbar-icon">&#9881;</span>
                                <span>设置</span>
                            </button>
                            <button class="topbar-nav-item">
                                <span class="topbar-icon">&#8681;</span>
                                <span>导入/导出</span>
                            </button>
                            <button class="topbar-nav-item">
                                <span class="topbar-icon">&#8635;</span>
                                <span>同步</span>
                            </button>
                            <button class="topbar-nav-item">
                                <span class="topbar-icon">&#9851;</span>
                                <span>回收站</span>
                            </button>
                        </nav>
                    </div>
                    <div class="topbar-right">
                        <div class="topbar-version">版本: 2.8.4</div>
                        <button class="topbar-icon-btn">&#9786;</button>
                        <button class="topbar-icon-btn">&#9728;</button>
                    </div>
                </header>
                <main class="main-layout">
                    <aside class="sidebar" id="group-sidebar"></aside>
                    <section class="content" id="group-detail"></section>
                </main>
                <div id="modal-root"></div>
            </div>
        `;
        this.sidebarRoot = this.root.querySelector('#group-sidebar');
        this.detailRoot = this.root.querySelector('#group-detail');
        this.modalRoot = this.root.querySelector('#modal-root');
    }

    bindTopbar() {
        this.root.querySelectorAll('.topbar-nav-item').forEach((button) => {
            button.addEventListener('click', () => {
                const page = button.dataset.page;
                if (page) {
                    this.setPage(page);
                } else {
                    window.alert('该功能正在开发中。');
                }
            });
        });
    }

    ensureModalRoot() {
        if (this.modalRoot) {
            return this.modalRoot;
        }
        let modalRoot = document.getElementById('modal-root');
        if (!modalRoot) {
            modalRoot = document.createElement('div');
            modalRoot.id = 'modal-root';
            document.body.appendChild(modalRoot);
        }
        this.modalRoot = modalRoot;
        return modalRoot;
    }

    async loadData() {
        const categories = StorageService.getCategories();
        const categoryMap = StorageService.getCategoryMap();
        const lockedSignatures = new Set(StorageService.getLockedSignatures());
        const starredSignatures = new Set(StorageService.getStarredSignatures());
        const domainRules = this.normalizeDomainRules(StorageService.getDomainRules());
        const domainScope = StorageService.getDomainScope();
        this.state.categories = categories;
        this.state.categoryMap = categoryMap;
        this.state.lockedSignatures = lockedSignatures;
        this.state.starredSignatures = starredSignatures;
        this.state.domainRules = domainRules;
        this.state.domainScope = domainScope;
        await this.refreshActiveGroups();
        await this.refreshWindowOptions();
    }

    async refreshWindowOptions() {
        const windows = await ChromeService.getWindowsSummary();
        this.state.windowOptions = windows;
    }

    getFirstId(list) {
        if (!list || !list.length) {
            return null;
        }
        return list[0].id;
    }

    setSelectedGroup(groupId) {
        this.state.selectedGroupId = groupId;
        this.render();
    }

    setPage(page) {
        if (this.state.page === page) {
            return;
        }
        this.state.page = page;
        if (page === 'settings') {
            this.refreshWindowOptions().then(() => this.render());
            return;
        }
        this.render();
    }

    setSearchTerm(term) {
        this.state.searchTerm = term.trim();
        this.render();
    }

    setViewMode(mode) {
        if (this.state.viewMode === mode) {
            return;
        }
        this.state.viewMode = mode;
        this.render();
    }

    archiveCurrentGroup() {
        if (this.state.viewMode !== 'active') {
            return;
        }
        const selectedGroup = this.getSelectedGroup();
        if (!selectedGroup) {
            return;
        }
        if (this.isGroupLocked(selectedGroup)) {
            window.alert('该标签组已锁定，无法移入回收站。');
            return;
        }
        const groups = this.state.activeGroups.slice();
        const groupIndex = groups.findIndex((group) => String(group.id) === String(selectedGroup.id));
        if (groupIndex === -1) {
            return;
        }
        const [group] = groups.splice(groupIndex, 1);
        const closedGroups = [
            {
                ...group,
                id: `archived-${group.id}`,
                category: '回收站',
                updatedAt: Date.now(),
                signature: this.createGroupSignature(group)
            },
            ...this.state.closedGroups
        ];
        this.state.activeGroups = groups;
        this.state.closedGroups = closedGroups;
        StorageService.saveClosedGroups(closedGroups);
        this.state.selectedGroupId = this.getFirstId(groups) || this.getFirstId(closedGroups);
        this.render();
    }

    restoreCurrentGroup() {
        if (this.state.viewMode !== 'closed') {
            return;
        }
        const selectedGroup = this.getSelectedGroup();
        if (!selectedGroup) {
            return;
        }
        const groups = this.state.closedGroups.slice();
        const groupIndex = groups.findIndex((group) => String(group.id) === String(selectedGroup.id));
        if (groupIndex === -1) {
            return;
        }
        const [group] = groups.splice(groupIndex, 1);
        const activeGroups = [
            {
                ...group,
                id: `restored-${group.id}`,
                category: group.category === '回收站' ? '未分类' : group.category
            },
            ...this.state.activeGroups
        ];
        this.state.activeGroups = activeGroups;
        this.state.closedGroups = groups;
        StorageService.saveClosedGroups(groups);
        this.state.selectedGroupId = this.getFirstId(activeGroups) || this.getFirstId(groups);
        this.state.viewMode = 'active';
        this.render();
    }

    handleCreateCategory() {
        if (this.state.viewMode !== 'active') {
            this.state.viewMode = 'active';
        }
        ChromeService.createNewGroup().then((groupId) => {
            if (!groupId) {
                window.alert('创建标签组失败。');
                return;
            }
            this.refreshActiveGroups({ selectedGroupId: groupId }).then(() => this.render());
        });
    }

    handleToggleExpand() {
        this.state.collapsedCategories = new Set();
        this.render();
    }

    handleToggleCollapse() {
        const currentGroups = this.getCurrentGroups();
        const categories = currentGroups.map((group) => group.category || '未分类');
        this.state.collapsedCategories = new Set(categories);
        this.render();
    }

    toggleAllCategories() {
        if (this.state.collapsedCategories.size) {
            this.handleToggleExpand();
        } else {
            this.handleToggleCollapse();
        }
    }

    handleToggleCategory(category) {
        const next = new Set(this.state.collapsedCategories);
        if (next.has(category)) {
            next.delete(category);
        } else {
            next.add(category);
        }
        this.state.collapsedCategories = next;
        this.render();
    }

    async importClosedFromSessions() {
        const sessionGroups = await SessionsService.getRecentlyClosedGroups({ maxResults: 60 });
        if (!sessionGroups.length) {
            window.alert('没有可导入的最近关闭记录。');
            return;
        }

        const preparedSessions = sessionGroups.map((group) => ({
            ...group,
            signature: this.createGroupSignature(group)
        }));
        const mergedGroups = this.mergeHistoryGroups(preparedSessions, this.state.closedGroups);
        const withCategories = mergedGroups.map((group) => {
            const signature = group.signature || this.createGroupSignature(group);
            const mappedCategory = this.state.categoryMap[signature];
            return {
                ...group,
                signature,
                category: mappedCategory || group.category || '未分类'
            };
        });
        this.state.closedGroups = withCategories;
        StorageService.saveClosedGroups(withCategories);
        this.state.viewMode = 'closed';
        this.state.selectedGroupId = this.getFirstId(withCategories);
        this.render();
    }

    getSelectedGroup() {
        const currentGroups = this.getCurrentGroups();
        return currentGroups.find((group) => String(group.id) === String(this.state.selectedGroupId)) || null;
    }

    getGroupSignature(group) {
        return group.signature || this.createGroupSignature(group);
    }

    isGroupLocked(group) {
        return this.state.lockedSignatures.has(this.getGroupSignature(group));
    }

    isGroupStarred(group) {
        return this.state.starredSignatures.has(this.getGroupSignature(group));
    }

    updateGroupMetadataInState(signature, updater) {
        this.state.activeGroups = this.state.activeGroups.map((group) => {
            if (this.getGroupSignature(group) !== signature) {
                return group;
            }
            return updater(group);
        });
        this.state.closedGroups = this.state.closedGroups.map((group) => {
            if (this.getGroupSignature(group) !== signature) {
                return group;
            }
            return updater(group);
        });
    }

    deleteCurrentGroup() {
        const selectedGroup = this.getSelectedGroup();
        if (!selectedGroup) {
            return;
        }
        if (this.isGroupLocked(selectedGroup)) {
            window.alert('该标签组已锁定，无法删除。');
            return;
        }
        if (this.state.viewMode === 'active') {
            if (!window.confirm('确定要删除该标签组并关闭所有标签页吗？')) {
                return;
            }
            ChromeService.closeGroupTabs(selectedGroup.id).then(() => {
                this.refreshActiveGroups().then(() => this.render());
            });
            return;
        }

        if (!window.confirm('确定要从历史中删除该标签组吗？')) {
            return;
        }
        const remaining = this.state.closedGroups.filter(
            (group) => String(group.id) !== String(selectedGroup.id)
        );
        this.state.closedGroups = remaining;
        StorageService.saveClosedGroups(remaining);
        this.state.selectedGroupId = this.getFirstId(remaining);
        this.render();
    }

    openCurrentGroup() {
        const selectedGroup = this.getSelectedGroup();
        if (!selectedGroup) {
            return;
        }
        if (this.state.viewMode === 'active') {
            ChromeService.focusGroup(selectedGroup.id);
            return;
        }
        ChromeService.createGroupFromSnapshot(selectedGroup).then((created) => {
            if (!created) {
                window.alert('打开标签组失败。');
                return;
            }
            this.refreshActiveGroups().then(() => this.render());
        });
    }

    toggleLockCurrentGroup() {
        const selectedGroup = this.getSelectedGroup();
        if (!selectedGroup) {
            return;
        }
        const signature = this.getGroupSignature(selectedGroup);
        const locked = new Set(this.state.lockedSignatures);
        if (locked.has(signature)) {
            locked.delete(signature);
        } else {
            locked.add(signature);
        }
        this.state.lockedSignatures = locked;
        StorageService.saveLockedSignatures(Array.from(locked));
        this.render();
    }

    toggleStarCurrentGroup() {
        const selectedGroup = this.getSelectedGroup();
        if (!selectedGroup) {
            return;
        }
        const signature = this.getGroupSignature(selectedGroup);
        const starred = new Set(this.state.starredSignatures);
        if (starred.has(signature)) {
            starred.delete(signature);
        } else {
            starred.add(signature);
        }
        this.state.starredSignatures = starred;
        StorageService.saveStarredSignatures(Array.from(starred));
        this.render();
    }

    moveCurrentGroupToCategory() {
        const selectedGroup = this.getSelectedGroup();
        if (!selectedGroup) {
            return;
        }
        if (this.isGroupLocked(selectedGroup)) {
            window.alert('该标签组已锁定，无法移动分类。');
            return;
        }
        const options = this.state.categories.length
            ? `可选分类：${this.state.categories.join('、')}\n`
            : '';
        const name = window.prompt(`${options}请输入分类名称`, selectedGroup.category || '');
        if (!name) {
            return;
        }
        const trimmed = name.trim();
        if (!trimmed) {
            return;
        }
        const signature = this.getGroupSignature(selectedGroup);
        const categoryMap = { ...this.state.categoryMap, [signature]: trimmed };
        this.state.categoryMap = categoryMap;
        StorageService.saveCategoryMap(categoryMap);
        if (!this.state.categories.includes(trimmed)) {
            const updated = [...this.state.categories, trimmed];
            this.state.categories = updated;
            StorageService.saveCategories(updated);
        }
        this.updateGroupMetadataInState(signature, (group) => ({
            ...group,
            category: trimmed
        }));
        this.render();
    }

    openMoveTabsModal(payload = {}) {
        if (this.state.viewMode !== 'active') {
            window.alert('回收站视图暂不支持移动标签页。');
            return;
        }
        const selectedTabIds = payload.selectedTabIds || [];
        if (!selectedTabIds.length) {
            window.alert('请先选择要移动的标签页。');
            return;
        }
        const sourceGroupId = payload.sourceGroupId;
        const sourceGroup = this.state.activeGroups.find(
            (group) => String(group.id) === String(sourceGroupId)
        );
        if (sourceGroup && this.isGroupLocked(sourceGroup)) {
            window.alert('该标签组已锁定，无法移动其中的标签页。');
            return;
        }

        const targetGroups = this.state.activeGroups.filter(
            (group) => String(group.id) !== String(sourceGroupId)
        );
        const categoryEntries = this.buildCategoryEntries(targetGroups, this.state.categories);
        const listMarkup = categoryEntries
            .map(([category, groups]) => {
                const items = groups.length
                    ? groups
                          .map(
                              (group) => `
                                <label class="modal-group-option">
                                    <input type="radio" name="move-target" value="${group.id}">
                                    <span class="modal-group-name">${group.title}</span>
                                    <span class="modal-group-count">${group.tabs.length}</span>
                                </label>
                            `
                          )
                          .join('')
                    : '<div class="modal-group-empty">暂无分组</div>';
                return `
                    <div class="modal-category">
                        <div class="modal-category-title">${category}</div>
                        <div class="modal-group-list">${items}</div>
                    </div>
                `;
            })
            .join('');

        const modalRoot = this.ensureModalRoot();
        modalRoot.innerHTML = `
            <dialog class="modal-dialog">
                <div class="modal-card" role="dialog" aria-modal="true">
                    <div class="modal-header">
                        <div class="modal-title">移动到</div>
                        <button class="modal-close" data-modal-close="true">×</button>
                    </div>
                    <div class="modal-options">
                        <label class="modal-option">
                            <input type="checkbox" data-move-copy>
                            复制所选项
                        </label>
                        <label class="modal-option">
                            <input type="checkbox" data-move-merge>
                            是否合并重复项
                        </label>
                    </div>
                    <div class="modal-list">
                        ${listMarkup}
                    </div>
                    <div class="modal-error" data-modal-error>请选择分类</div>
                    <div class="modal-actions">
                        <button class="modal-btn ghost" data-modal-cancel>取消</button>
                        <button class="modal-btn primary" data-modal-confirm>确定</button>
                    </div>
                </div>
            </dialog>
        `;

        const dialog = modalRoot.querySelector('.modal-dialog');
        const closeButtons = modalRoot.querySelectorAll('[data-modal-close="true"], [data-modal-cancel]');
        const confirmButton = modalRoot.querySelector('[data-modal-confirm]');
        const errorBox = modalRoot.querySelector('[data-modal-error]');

        const closeModal = () => {
            if (dialog && dialog.open) {
                dialog.close();
            }
            modalRoot.innerHTML = '';
        };

        closeButtons.forEach((button) => {
            button.addEventListener('click', () => closeModal());
        });

        if (dialog) {
            dialog.addEventListener('click', (event) => {
                if (event.target === dialog) {
                    closeModal();
                }
            });
        }

        if (confirmButton) {
            confirmButton.addEventListener('click', async () => {
                const selected = modalRoot.querySelector('input[name="move-target"]:checked');
                if (!selected) {
                    if (errorBox) {
                        errorBox.classList.add('is-visible');
                    }
                    return;
                }
                const copyInput = modalRoot.querySelector('[data-move-copy]');
                const mergeInput = modalRoot.querySelector('[data-move-merge]');
                const copyChecked = Boolean(copyInput && copyInput.checked);
                const mergeChecked = Boolean(mergeInput && mergeInput.checked);
                await this.moveSelectedTabs({
                    selectedTabIds,
                    targetGroupId: Number(selected.value),
                    sourceGroupId,
                    copySelected: copyChecked,
                    mergeDuplicates: mergeChecked
                });
                closeModal();
            });
        }

        if (dialog && typeof dialog.showModal === 'function') {
            dialog.showModal();
        }
    }

    async moveSelectedTabs({ selectedTabIds, targetGroupId, sourceGroupId, copySelected, mergeDuplicates }) {
        const targetGroup = this.state.activeGroups.find(
            (group) => String(group.id) === String(targetGroupId)
        );
        if (!targetGroup) {
            window.alert('未找到目标标签组。');
            return;
        }

        const tabs = await ChromeService.getTabsByIds(selectedTabIds);
        if (!tabs.length) {
            window.alert('未找到可移动的标签页。');
            return;
        }

        const targetUrls = new Set(
            (targetGroup.tabs || []).map((tab) => tab.url).filter(Boolean)
        );
        const filteredTabs = tabs.filter((tab) => {
            const url = tab.url || tab.pendingUrl || '';
            if (!mergeDuplicates || !url) {
                return true;
            }
            if (targetUrls.has(url)) {
                return false;
            }
            targetUrls.add(url);
            return true;
        });

        if (!filteredTabs.length) {
            window.alert('没有可移动的标签页（全部为重复项）。');
            return;
        }

        if (copySelected) {
            const urls = filteredTabs
                .map((tab) => tab.url || tab.pendingUrl)
                .filter(Boolean);
            if (!urls.length) {
                window.alert('所选标签页没有可复制的链接。');
                return;
            }
            await ChromeService.createTabsInGroup(urls, targetGroupId, targetGroup.windowId);
        } else {
            for (const tab of filteredTabs) {
                await ChromeService.moveTabToGroup(tab.id, targetGroupId);
            }
        }

        await this.refreshActiveGroups({ selectedGroupId: targetGroupId });
        this.render();
    }

    async copyCurrentGroupLinks() {
        const selectedGroup = this.getSelectedGroup();
        if (!selectedGroup) {
            return;
        }
        const links = (selectedGroup.tabs || [])
            .map((tab) => tab.url)
            .filter(Boolean)
            .join('\n');
        if (!links) {
            window.alert('该标签组没有可复制的链接。');
            return;
        }
        const copied = await this.copyToClipboard(links);
        if (!copied) {
            window.alert('复制失败，请重试。');
        }
    }

    async dedupeCurrentGroup() {
        const selectedGroup = this.getSelectedGroup();
        if (!selectedGroup) {
            return;
        }
        if (this.isGroupLocked(selectedGroup)) {
            window.alert('该标签组已锁定，无法去重。');
            return;
        }
        if (this.state.viewMode === 'active') {
            const removed = await ChromeService.dedupeGroupTabs(selectedGroup.id);
            if (removed === 0) {
                window.alert('没有可去重的标签页。');
                return;
            }
            await this.refreshActiveGroups({ selectedGroupId: selectedGroup.id });
            this.render();
            return;
        }

        const dedupedTabs = this.dedupeTabs(selectedGroup.tabs || []);
        if (dedupedTabs.length === selectedGroup.tabs.length) {
            window.alert('没有可去重的标签页。');
            return;
        }
        const signature = this.getGroupSignature(selectedGroup);
        const updatedGroup = { ...selectedGroup, tabs: dedupedTabs };
        this.state.closedGroups = this.state.closedGroups.map((group) =>
            this.getGroupSignature(group) === signature ? updatedGroup : group
        );
        StorageService.saveClosedGroups(this.state.closedGroups);
        this.render();
    }

    async moreCurrentGroupActions() {
        const selectedGroup = this.getSelectedGroup();
        if (!selectedGroup) {
            return;
        }
        const payload = JSON.stringify(
            {
                title: selectedGroup.title,
                category: selectedGroup.category,
                color: selectedGroup.color,
                tabs: (selectedGroup.tabs || []).map((tab) => ({
                    title: tab.title,
                    url: tab.url
                }))
            },
            null,
            2
        );
        const copied = await this.copyToClipboard(payload);
        if (copied) {
            window.alert('已复制该标签组的 JSON 信息。');
        } else {
            window.alert('复制失败，请重试。');
        }
    }

    dedupeTabs(tabs) {
        const seen = new Set();
        return tabs.filter((tab) => {
            const key = tab.url || tab.title || '';
            if (!key || seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
    }

    async copyToClipboard(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (error) {
                return this.copyToClipboardLegacy(text);
            }
        }
        return this.copyToClipboardLegacy(text);
    }

    copyToClipboardLegacy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        let success = false;
        try {
            success = document.execCommand('copy');
        } catch (error) {
            success = false;
        }
        document.body.removeChild(textarea);
        return success;
    }

    async refreshActiveGroups({ selectedGroupId } = {}) {
        const activeGroups = this.applyGroupMetadata(await ChromeService.getActiveGroups());
        const storedGroups = this.state.closedGroups.length
            ? this.state.closedGroups
            : StorageService.getClosedGroups();
        const snapshotTime = Date.now();
        const historySnapshots = activeGroups.map((group, index) => {
            return {
                id: `history-${snapshotTime}-${index}`,
                title: group.title,
                color: group.color,
                category: group.category || '历史',
                updatedAt: snapshotTime,
                tabs: group.tabs,
                signature: this.createGroupSignature(group)
            };
        });
        const mergedClosedGroups = this.mergeHistoryGroups(historySnapshots, storedGroups);
        this.state.activeGroups = activeGroups;
        this.state.closedGroups = mergedClosedGroups.map((group) => {
            const signature = group.signature || this.createGroupSignature(group);
            const mappedCategory = this.state.categoryMap[signature];
            return {
                ...group,
                signature,
                category: mappedCategory || group.category || '未分类'
            };
        });
        StorageService.saveClosedGroups(mergedClosedGroups);
        this.state.selectedGroupId =
            selectedGroupId || this.getFirstId(activeGroups) || this.getFirstId(mergedClosedGroups);
    }

    mergeHistoryGroups(newGroups, existingGroups) {
        const normalizedExisting = existingGroups.map((group) => ({
            ...group,
            signature: group.signature || this.createGroupSignature(group)
        }));
        const signatureSet = new Set(normalizedExisting.map((group) => group.signature));
        const merged = normalizedExisting.slice();

        newGroups.forEach((group) => {
            if (!group.signature || signatureSet.has(group.signature)) {
                return;
            }
            signatureSet.add(group.signature);
            merged.push(group);
        });

        return merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    createGroupSignature(group) {
        const title = group.title || '';
        const tabs = Array.from(
            new Set(
                (group.tabs || [])
                    .map((tab) => tab.url || tab.title || '')
                    .filter(Boolean)
            )
        )
            .sort()
            .join('|');
        return `${title}|${tabs}`;
    }

    applyGroupMetadata(groups) {
        return groups.map((group) => {
            const signature = this.createGroupSignature(group);
            const mappedCategory = this.state.categoryMap[signature];
            return {
                ...group,
                signature,
                category: mappedCategory || group.category || '未分类'
            };
        });
    }

    async groupByDomain() {
        if (!this.state.domainRules.length) {
            window.alert('请先在设置中添加域名分组规则。');
            return;
        }
        const result = await ChromeService.groupUngroupedTabsByRules({
            rules: this.state.domainRules,
            windowScope: this.state.domainScope
        });
        if (!result.movedTabs) {
            window.alert('没有匹配规则的标签页。');
            return;
        }
        await this.refreshActiveGroups();
        this.render();
    }

    async moveTabToGroup(tabId, targetGroupId, sourceGroupId) {
        if (this.state.viewMode !== 'active') {
            return;
        }
        const sourceGroup = this.state.activeGroups.find(
            (group) => String(group.id) === String(sourceGroupId)
        );
        if (sourceGroup && this.isGroupLocked(sourceGroup)) {
            window.alert('该标签组已锁定，无法移动其中的标签页。');
            return;
        }
        const targetId = Number(targetGroupId);
        const sourceId = Number(sourceGroupId);
        if (Number.isNaN(targetId) || targetId === sourceId) {
            return;
        }
        const moved = await ChromeService.moveTabToGroup(Number(tabId), targetId);
        if (!moved) {
            window.alert('移动标签页失败，请确认目标分组在同一窗口内。');
            return;
        }
        await this.refreshActiveGroups({ selectedGroupId: targetId });
        this.render();
    }

    async mergeWindows() {
        if (!window.confirm('将其他窗口的标签页合并到当前窗口？')) {
            return;
        }
        const result = await ChromeService.mergeAllWindowsIntoCurrent();
        if (!result.movedTabs) {
            window.alert('没有可合并的窗口或标签页。');
            return;
        }
        await this.refreshActiveGroups();
        this.render();
        window.alert(`已合并 ${result.movedWindows} 个窗口，移动 ${result.movedTabs} 个标签页。`);
    }

    render() {
        const currentGroups = this.getCurrentGroups();
        const filteredGroups = this.filterGroups(currentGroups, this.state.searchTerm);
        const selectedGroupId = this.resolveSelectedGroupId(filteredGroups);
        this.state.selectedGroupId = selectedGroupId;
        const filteredCategories = this.filterCategories(this.state.categories, this.state.searchTerm);
        const isCollapsed = this.state.collapsedCategories.size > 0;

        const counts = this.calculateCounts(currentGroups);
        if (this.state.page === 'list') {
            this.sidebar.render({
                groups: filteredGroups,
                categories: filteredCategories,
                selectedGroupId,
                searchTerm: this.state.searchTerm,
                counts,
                collapsedCategories: this.state.collapsedCategories,
                isCollapsed
            });

            const selectedGroup = filteredGroups.find((group) => String(group.id) === String(selectedGroupId));
            this.detail.render({
                group: selectedGroup,
                viewMode: this.state.viewMode,
                stats: counts,
                isLocked: selectedGroup ? this.isGroupLocked(selectedGroup) : false,
                isStarred: selectedGroup ? this.isGroupStarred(selectedGroup) : false
            });
        } else {
            this.sidebarRoot.innerHTML = '';
            this.settings.render({
                rules: this.state.domainRules,
                scope: this.state.domainScope,
                windows: this.state.windowOptions
            });
        }

        this.updateTopbarActive();
        this.updateLayoutForPage();
    }

    updateTopbarActive() {
        this.root.querySelectorAll('.topbar-nav-item').forEach((button) => {
            const page = button.dataset.page;
            if (!page) {
                return;
            }
            button.classList.toggle('is-active', page === this.state.page);
        });
    }

    updateLayoutForPage() {
        const layout = this.root.querySelector('.main-layout');
        if (!layout) {
            return;
        }
        layout.classList.toggle('is-settings', this.state.page === 'settings');
    }

    normalizeDomainInput(value) {
        if (!value) {
            return '';
        }
        const trimmed = value.trim().toLowerCase();
        if (!trimmed) {
            return '';
        }
        try {
            const url = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
            const parsed = new URL(url);
            return parsed.hostname.replace(/^www\./, '');
        } catch (error) {
            return trimmed.replace(/^www\./, '').split('/')[0];
        }
    }

    sanitizeRuleType(ruleType) {
        if (ruleType === 'keyword' || ruleType === 'regex' || ruleType === 'domain') {
            return ruleType;
        }
        return 'domain';
    }

    normalizeRulePattern(ruleType, pattern) {
        const trimmed = (pattern || '').trim();
        if (!trimmed) {
            return '';
        }
        if (ruleType === 'domain') {
            return this.normalizeDomainInput(trimmed);
        }
        if (ruleType === 'regex') {
            const match = trimmed.match(/^\/(.+)\/([gimsuy]*)$/);
            if (match) {
                return match[1];
            }
        }
        return trimmed;
    }

    isValidRulePattern(ruleType, pattern) {
        if (!pattern) {
            return false;
        }
        if (ruleType === 'regex') {
            try {
                new RegExp(pattern, 'i');
                return true;
            } catch (error) {
                return false;
            }
        }
        return true;
    }

    normalizeDomainRules(rules) {
        if (!Array.isArray(rules)) {
            return [];
        }
        return rules
            .map((rule, index) => {
                if (rule && rule.pattern && rule.type) {
                    const type = this.sanitizeRuleType(rule.type);
                    return {
                        id: rule.id || `rule-${Date.now()}-${index}`,
                        type,
                        pattern: this.normalizeRulePattern(type, rule.pattern),
                        groupName: rule.groupName || ''
                    };
                }
                const domain = rule ? rule.domain || rule.pattern || '' : '';
                return {
                    id: rule && rule.id ? rule.id : `rule-${Date.now()}-${index}`,
                    type: 'domain',
                    pattern: this.normalizeDomainInput(domain),
                    groupName: rule && rule.groupName ? rule.groupName : ''
                };
            })
            .filter((rule) => rule.pattern && rule.groupName);
    }

    addDomainRule(ruleType, pattern, groupName) {
        const type = this.sanitizeRuleType(ruleType);
        const normalizedPattern = this.normalizeRulePattern(type, pattern);
        const trimmedGroup = (groupName || '').trim();
        if (!normalizedPattern || !trimmedGroup) {
            window.alert('请填写规则内容和分组名称。');
            return;
        }
        if (!this.isValidRulePattern(type, normalizedPattern)) {
            window.alert('正则表达式无效。');
            return;
        }
        const exists = this.state.domainRules.some(
            (rule) => rule.type === type && rule.pattern.toLowerCase() === normalizedPattern.toLowerCase()
        );
        if (exists) {
            window.alert('该规则已存在。');
            return;
        }
        const rule = {
            id: `rule-${Date.now()}`,
            type,
            pattern: normalizedPattern,
            groupName: trimmedGroup
        };
        const updated = [...this.state.domainRules, rule];
        this.state.domainRules = updated;
        StorageService.saveDomainRules(updated);
        this.render();
    }

    updateDomainRule(ruleId, ruleType, pattern, groupName) {
        const type = this.sanitizeRuleType(ruleType);
        const normalizedPattern = this.normalizeRulePattern(type, pattern);
        const trimmedGroup = (groupName || '').trim();
        if (!normalizedPattern || !trimmedGroup) {
            window.alert('请填写规则内容和分组名称。');
            return;
        }
        if (!this.isValidRulePattern(type, normalizedPattern)) {
            window.alert('正则表达式无效。');
            return;
        }
        const updated = this.state.domainRules.map((rule) => {
            if (rule.id !== ruleId) {
                return rule;
            }
            return {
                ...rule,
                type,
                pattern: normalizedPattern,
                groupName: trimmedGroup
            };
        });
        this.state.domainRules = updated;
        StorageService.saveDomainRules(updated);
        this.render();
    }

    deleteDomainRule(ruleId) {
        const updated = this.state.domainRules.filter((rule) => rule.id !== ruleId);
        this.state.domainRules = updated;
        StorageService.saveDomainRules(updated);
        this.render();
    }

    updateDomainScope(scope) {
        this.state.domainScope = scope;
        StorageService.saveDomainScope(scope);
    }

    getCurrentGroups() {
        return this.state.viewMode === 'active' ? this.state.activeGroups : this.state.closedGroups;
    }

    filterGroups(groups, term) {
        if (!term) {
            return groups;
        }
        const normalized = term.toLowerCase();
        return groups.filter((group) => {
            const title = (group.title || '').toLowerCase();
            const category = (group.category || '').toLowerCase();
            return title.includes(normalized) || category.includes(normalized);
        });
    }

    filterCategories(categories, term) {
        if (!term) {
            return categories;
        }
        const normalized = term.toLowerCase();
        return categories.filter((name) => name.toLowerCase().includes(normalized));
    }

    buildCategoryEntries(groups, categories) {
        const categoryMap = new Map();
        const ordered = [];

        const addCategory = (name) => {
            if (!name || categoryMap.has(name)) {
                return;
            }
            categoryMap.set(name, []);
            ordered.push(name);
        };

        categories.forEach((name) => addCategory(name));
        groups.forEach((group) => addCategory(group.category || '未分类'));
        groups.forEach((group) => {
            const category = group.category || '未分类';
            const list = categoryMap.get(category);
            if (list) {
                list.push(group);
            }
        });

        return ordered.map((name) => [name, categoryMap.get(name) || []]);
    }

    resolveSelectedGroupId(groups) {
        const hasSelection = groups.some((group) => String(group.id) === String(this.state.selectedGroupId));
        if (hasSelection) {
            return this.state.selectedGroupId;
        }
        return this.getFirstId(groups);
    }

    calculateCounts(groups) {
        const categorySet = new Set([
            ...this.state.categories,
            ...groups.map((group) => group.category || '未分类')
        ]);
        const tabCount = groups.reduce((total, group) => total + group.tabs.length, 0);
        return {
            categoryCount: categorySet.size,
            groupCount: groups.length,
            tabCount
        };
    }
}

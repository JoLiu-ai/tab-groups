import DateService from '../services/DateService.js';

export default class GroupDetail {
    constructor(root, {
        onToggleView,
        onArchiveGroup,
        onRestoreGroup,
        onDeleteGroup,
        onOpenGroup,
        onToggleLockGroup,
        onToggleStarGroup,
        onMoveGroup,
        onCopyLinks,
        onDedupeGroup,
        onMoreActions
    }) {
        this.root = root;
        this.onToggleView = onToggleView;
        this.onArchiveGroup = onArchiveGroup;
        this.onRestoreGroup = onRestoreGroup;
        this.onDeleteGroup = onDeleteGroup || (() => {});
        this.onOpenGroup = onOpenGroup || (() => {});
        this.onToggleLockGroup = onToggleLockGroup || (() => {});
        this.onToggleStarGroup = onToggleStarGroup || (() => {});
        this.onMoveGroup = onMoveGroup || (() => {});
        this.onCopyLinks = onCopyLinks || (() => {});
        this.onDedupeGroup = onDedupeGroup || (() => {});
        this.onMoreActions = onMoreActions || (() => {});
    }

    render({ group, viewMode, stats, isLocked, isStarred }) {
        if (!group) {
            this.root.innerHTML = `
                <div class="tablist-panel empty">
                    <div class="tablist-empty">
                        <div class="tablist-empty-title">还没有可展示的标签组</div>
                        <div class="tablist-empty-sub">尝试切换到活跃/回收站视图，或从浏览器读取分组。</div>
                    </div>
                </div>
            `;
            return;
        }

        const formattedTime = DateService.formatDateTime(group.updatedAt);
        const tabCount = group.tabs.length;
        const viewLabel = viewMode === 'active' ? '活跃' : '回收站';
        const actionLabel = viewMode === 'active' ? '移入回收站' : '恢复到列表';
        const lockLabel = isLocked ? '解锁该组' : '锁定该组';
        const starLabel = isStarred ? '取消星标' : '星标该组';
        const isDraggable = viewMode === 'active' && !isLocked;

        this.root.innerHTML = `
            <div class="tablist-header">
                <div class="tablist-stats">当前分类统计： 标签组 (${stats.groupCount}) 标签页 (${stats.tabCount})</div>
                <div class="tablist-views">
                    <button class="tablist-view ${viewMode === 'active' ? 'is-active' : ''}" data-view="active">活跃</button>
                    <button class="tablist-view ${viewMode === 'closed' ? 'is-active' : ''}" data-view="closed">回收站</button>
                </div>
            </div>
            <div class="tablist-panel" data-group-id="${group.id}">
                <div class="tablist-title">
                    <div class="tablist-title-row">
                        <div class="tablist-group-name">${group.title}</div>
                        <button class="tablist-edit">&#9998;</button>
                        <div class="tablist-meta">${tabCount}个标签页 <span>${formattedTime}</span></div>
                    </div>
                    <div class="tablist-actions">
                        <button class="tablist-action ghost" data-action="delete">删除该组</button>
                        <button class="tablist-action ghost" data-action="open">打开该组</button>
                        <button class="tablist-action ghost" data-action="lock">${lockLabel}</button>
                        <button class="tablist-action ghost" data-action="star">${starLabel}</button>
                        <button class="tablist-action ghost" data-action="move">移动到</button>
                        <button class="tablist-action ghost" data-action="copy">复制链接</button>
                        <button class="tablist-action ghost" data-action="dedupe">去重</button>
                        <button class="tablist-action ghost" data-action="more">更多</button>
                        <button class="tablist-action" data-action="archive">${actionLabel}</button>
                    </div>
                </div>
                <div class="tablist-progress">
                    <label class="tablist-progress-label">
                        <input type="checkbox" class="tablist-checkbox" data-select-all="true">
                        <span><span class="tablist-selected-count">0</span> / ${tabCount}</span>
                    </label>
                    <span class="tablist-view-label">${viewLabel}</span>
                </div>
                <div class="tablist-items">
                    ${group.tabs.map((tab, index) => GroupDetail.renderTab(tab, index, group.id, isDraggable)).join('')}
                </div>
            </div>
        `;
        this.bindEvents();
    }

    bindEvents() {
        this.root.querySelectorAll('.tablist-view').forEach((button) => {
            button.addEventListener('click', () => {
                this.onToggleView(button.dataset.view);
            });
        });

        this.root.querySelectorAll('.tablist-action').forEach((button) => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                if (action === 'archive') {
                    if (button.textContent.includes('回收站')) {
                        this.onArchiveGroup();
                    } else {
                        this.onRestoreGroup();
                    }
                }
                if (action === 'delete') {
                    this.onDeleteGroup();
                }
                if (action === 'open') {
                    this.onOpenGroup();
                }
                if (action === 'lock') {
                    this.onToggleLockGroup();
                }
                if (action === 'star') {
                    this.onToggleStarGroup();
                }
                if (action === 'move') {
                    const panel = this.root.querySelector('.tablist-panel');
                    const selectedTabIds = Array.from(
                        this.root.querySelectorAll('.tablist-item .tablist-checkbox:checked')
                    )
                        .map((input) => input.dataset.tabId)
                        .filter(Boolean);
                    this.onMoveGroup({
                        selectedTabIds,
                        sourceGroupId: panel && panel.dataset ? panel.dataset.groupId : undefined
                    });
                }
                if (action === 'copy') {
                    this.onCopyLinks();
                }
                if (action === 'dedupe') {
                    this.onDedupeGroup();
                }
                if (action === 'more') {
                    this.onMoreActions();
                }
            });
        });

        const selectAll = this.root.querySelector('[data-select-all="true"]');
        const moveButton = this.root.querySelector('[data-action="move"]');
        const tabCheckboxes = Array.from(this.root.querySelectorAll('.tablist-item .tablist-checkbox'));
        const selectedCount = this.root.querySelector('.tablist-selected-count');

        const updateSelectionState = () => {
            const total = tabCheckboxes.length;
            const checked = tabCheckboxes.filter((input) => input.checked).length;
            if (selectedCount) {
                selectedCount.textContent = String(checked);
            }
            if (selectAll) {
                selectAll.checked = total > 0 && checked === total;
                selectAll.indeterminate = checked > 0 && checked < total;
            }
            if (moveButton) {
                moveButton.disabled = checked === 0;
            }
        };

        if (selectAll) {
            selectAll.addEventListener('change', () => {
                tabCheckboxes.forEach((input) => {
                    input.checked = selectAll.checked;
                });
                updateSelectionState();
            });
        }

        tabCheckboxes.forEach((input) => {
            input.addEventListener('change', () => {
                updateSelectionState();
            });
        });

        this.root.querySelectorAll('.tablist-item[draggable="true"]').forEach((item) => {
            item.addEventListener('dragstart', (event) => {
                const tabId = item.dataset.tabId;
                const groupId = item.dataset.groupId;
                event.dataTransfer.setData('text/tab-id', tabId);
                event.dataTransfer.setData('text/group-id', groupId);
                event.dataTransfer.effectAllowed = 'move';
                item.classList.add('is-dragging');
            });
            item.addEventListener('dragend', () => {
                item.classList.remove('is-dragging');
            });
        });

        updateSelectionState();
    }

    static renderTab(tab, index, groupId, isDraggable) {
        const title = tab.title || '未命名标签页';
        const iconUrl = tab.favIconUrl || '';
        const isActive = tab.active ? 'is-active' : '';
        return `
            <div class="tablist-item ${isActive}" style="--item-delay: ${index * 30}ms" draggable="${isDraggable}" data-tab-id="${tab.id}" data-group-id="${groupId}">
                <input type="checkbox" class="tablist-checkbox" data-tab-id="${tab.id}">
                <span class="tablist-drag">&#9776;</span>
                <span class="tablist-favicon">
                    ${iconUrl ? `<img src="${iconUrl}" alt="">` : '<span class="tablist-favicon-fallback"></span>'}
                </span>
                <div class="tablist-info">
                    <div class="tablist-title-text">${title}</div>
                    <div class="tablist-url">${tab.url || ''}</div>
                </div>
            </div>
        `;
    }
}

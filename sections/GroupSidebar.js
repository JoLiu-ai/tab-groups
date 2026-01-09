export default class GroupSidebar {
    constructor(root, { onSelectGroup, onSearch, onCreateCategory, onToggleAll, onToggleCategory, onImportClosed, onGroupByDomain, onDropTab, onMergeWindows }) {
        this.root = root;
        this.onSelectGroup = onSelectGroup;
        this.onSearch = onSearch;
        this.onCreateCategory = onCreateCategory;
        this.onToggleAll = onToggleAll || (() => {});
        this.onToggleCategory = onToggleCategory || (() => {});
        this.onImportClosed = onImportClosed || (() => {});
        this.onGroupByDomain = onGroupByDomain || (() => {});
        this.onDropTab = onDropTab || (() => {});
        this.onMergeWindows = onMergeWindows || (() => {});
    }

    render({ groups, categories = [], selectedGroupId, searchTerm, counts, collapsedCategories = new Set(), isCollapsed = false }) {
        const categoryEntries = GroupSidebar.buildCategoryEntries(groups, categories);

        this.root.innerHTML = `
            <div class="sidebar-shell">
                <div class="sidebar-panel">
                    <div class="sidebar-header">
                        <div class="sidebar-title-row">
                            <div class="sidebar-title">标签组列表</div>
                            <span class="sidebar-hint">?</span>
                        </div>
                    </div>
                    <div class="sidebar-summary">
                        <span>分类 (${counts.categoryCount})</span>
                        <span>标签组 (${counts.groupCount})</span>
                        <span>标签页 (${counts.tabCount})</span>
                    </div>
                    <div class="sidebar-actions">
                        <button class="sidebar-action" data-action="toggle-collapse">${isCollapsed ? '全部展开' : '全部折叠'}</button>
                        <button class="sidebar-action primary" data-action="create">创建群组</button>
                    </div>
                    <div class="sidebar-search">
                        <input class="sidebar-search-input" type="search" placeholder="搜索分类/标签组" value="${searchTerm}">
                        <button class="sidebar-search-btn" data-action="search-focus" type="button">搜</button>
                    </div>
                    <div class="sidebar-groups">
                        ${categoryEntries
                            .map(([category, items]) => {
                                const isCollapsed = collapsedCategories.has(category);
                                return `
                                    <div class="sidebar-category ${isCollapsed ? 'is-collapsed' : ''}">
                                        <button class="sidebar-category-toggle" data-category="${category}">
                                            <span class="sidebar-category-caret">${isCollapsed ? '&#9656;' : '&#9662;'}</span>
                                            <span class="sidebar-category-name">${category}</span>
                                        </button>
                                        <div class="sidebar-category-list">
                                            ${items
                                                .map((group) => {
                                                    const isActive = group.id === selectedGroupId;
                                                    return `
                                                        <button class="sidebar-group-item ${isActive ? 'is-active' : ''}" data-group-id="${group.id}">
                                                            <span class="sidebar-group-icon" data-color="${group.color}"></span>
                                                            <span class="sidebar-group-name">${group.title}</span>
                                                            <span class="sidebar-group-count">${group.tabs.length}</span>
                                                            <span class="sidebar-group-edit">&#9998;</span>
                                                        </button>
                                                    `;
                                                })
                                                .join('')}
                                        </div>
                                    </div>
                                `;
                            })
                            .join('')}
                    </div>
                </div>
                <div class="sidebar-tools" aria-label="快捷工具">
                    <button class="sidebar-tool" data-action="toggle-collapse">${isCollapsed ? '展开' : '折叠'}</button>
                    <button class="sidebar-tool" data-action="search-focus">搜索</button>
                    <button class="sidebar-tool" data-action="import">导入</button>
                    <button class="sidebar-tool" data-action="group-domain">域名分组</button>
                    <button class="sidebar-tool" data-action="merge-windows">合并</button>
                    <button class="sidebar-tool" data-action="sort-alpha">名称</button>
                    <button class="sidebar-tool" data-action="sort-time">时间</button>
                </div>
            </div>
        `;
        this.bindEvents();
    }

    bindEvents() {
        const searchInput = this.root.querySelector('.sidebar-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (event) => {
                this.onSearch(event.target.value);
            });
        }

        this.root.querySelectorAll('.sidebar-group-item').forEach((item) => {
            item.addEventListener('click', () => {
                this.onSelectGroup(item.dataset.groupId);
            });
        });

        const handleAction = (action) => {
            if (action === 'create') {
                this.onCreateCategory();
            }
            if (action === 'toggle-collapse') {
                this.onToggleAll();
            }
            if (action === 'import') {
                this.onImportClosed();
            }
            if (action === 'group-domain') {
                this.onGroupByDomain();
            }
            if (action === 'merge-windows') {
                this.onMergeWindows();
            }
            if (action === 'search-focus') {
                if (searchInput) {
                    searchInput.focus();
                }
            }
        };

        this.root.querySelectorAll('.sidebar-action').forEach((button) => {
            button.addEventListener('click', () => {
                handleAction(button.dataset.action);
            });
        });

        this.root.querySelectorAll('.sidebar-tool').forEach((button) => {
            button.addEventListener('click', () => {
                handleAction(button.dataset.action);
            });
        });

        const searchButton = this.root.querySelector('.sidebar-search-btn');
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                handleAction(searchButton.dataset.action);
            });
        }

        this.root.querySelectorAll('.sidebar-category-toggle').forEach((button) => {
            button.addEventListener('click', () => {
                const category = button.dataset.category;
                if (category) {
                    this.onToggleCategory(category);
                }
            });
        });

        this.root.querySelectorAll('.sidebar-group-item').forEach((item) => {
            item.addEventListener('dragover', (event) => {
                event.preventDefault();
                item.classList.add('is-drop-target');
            });
            item.addEventListener('dragleave', () => {
                item.classList.remove('is-drop-target');
            });
            item.addEventListener('drop', (event) => {
                event.preventDefault();
                item.classList.remove('is-drop-target');
                const tabId = event.dataTransfer.getData('text/tab-id');
                const sourceGroupId = event.dataTransfer.getData('text/group-id');
                if (tabId) {
                    this.onDropTab(tabId, item.dataset.groupId, sourceGroupId);
                }
            });
        });
    }

    static buildCategoryEntries(groups, categories) {
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
}

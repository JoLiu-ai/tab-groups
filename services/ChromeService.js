const colorMap = {
    grey: 'slate',
    gray: 'slate',
    blue: 'blue',
    cyan: 'sky',
    green: 'emerald',
    orange: 'amber',
    pink: 'rose',
    purple: 'violet',
    red: 'red',
    yellow: 'yellow'
};

const promiseChrome = (context, fn, ...args) => new Promise((resolve) => fn.call(context, ...args, resolve));
const groupColorPalette = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];

const hashString = (value) => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

const normalizeDomain = (url) => {
    if (!url) {
        return null;
    }
    try {
        const parsed = new URL(url);
        if (!parsed.hostname) {
            return null;
        }
        return parsed.hostname.replace(/^www\./, '');
    } catch (error) {
        return null;
    }
};

export default class ChromeService {
    static matchDomain(hostname, ruleDomain) {
        const normalizedHost = (hostname || '').toLowerCase();
        const normalizedRule = (ruleDomain || '').toLowerCase();
        if (!normalizedHost || !normalizedRule) {
            return false;
        }
        return normalizedHost === normalizedRule || normalizedHost.endsWith(`.${normalizedRule}`);
    }

    static matchRule(tab, rules) {
        const url = tab.url || tab.pendingUrl || '';
        const title = tab.title || '';
        const haystack = `${title} ${url}`.toLowerCase();
        const domain = normalizeDomain(url);

        for (const rule of rules) {
            if (!rule || !rule.pattern || !rule.groupName) {
                continue;
            }
            if (rule.type === 'domain') {
                if (domain && ChromeService.matchDomain(domain, rule.pattern)) {
                    return rule;
                }
                continue;
            }
            if (rule.type === 'keyword') {
                if (haystack.includes(rule.pattern.toLowerCase())) {
                    return rule;
                }
                continue;
            }
            if (rule.type === 'regex') {
                try {
                    const regex = new RegExp(rule.pattern, 'i');
                    if (regex.test(haystack)) {
                        return rule;
                    }
                } catch (error) {
                    continue;
                }
            }
        }
        return null;
    }

    static async getActiveGroups() {
        if (window.chrome && window.chrome.tabGroups && window.chrome.tabs) {
            return ChromeService.fetchChromeGroups();
        }
        return [];
    }

    static async fetchChromeGroups() {
        try {
            const [groupResults, tabResults] = await Promise.all([
                promiseChrome(window.chrome.tabGroups, window.chrome.tabGroups.query, {}),
                promiseChrome(window.chrome.tabs, window.chrome.tabs.query, {})
            ]);
            const tabsByGroup = new Map();
            tabResults.forEach((tab) => {
                if (tab.groupId === -1) {
                    return;
                }
                const current = tabsByGroup.get(tab.groupId) || [];
                current.push({
                    id: tab.id,
                    title: tab.title || tab.pendingUrl || tab.url || 'Untitled',
                    url: tab.url || tab.pendingUrl || '',
                    favIconUrl: tab.favIconUrl || '',
                    active: Boolean(tab.active),
                    pinned: Boolean(tab.pinned),
                    lastAccessed: tab.lastAccessed
                });
                tabsByGroup.set(tab.groupId, current);
            });

            return groupResults.map((group) => {
                const groupTabs = tabsByGroup.get(group.id) || [];
                return {
                    id: group.id,
                    title: group.title || '未命名分组',
                    color: colorMap[group.color] || 'slate',
                    windowId: group.windowId,
                    category: '未分类',
                    updatedAt: Date.now(),
                    tabs: groupTabs
                };
            });
        } catch (error) {
            return [];
        }
    }

    static async getWindowsSummary() {
        if (!window.chrome || !window.chrome.windows || !window.chrome.windows.getAll) {
            return [];
        }
        const windows = await promiseChrome(window.chrome.windows, window.chrome.windows.getAll, {
            populate: false
        });
        return windows
            .filter((item) => item.type === 'normal')
            .map((item) => ({
                id: item.id
            }));
    }

    static async getWindowsByScope(windowScope) {
        if (!window.chrome || !window.chrome.windows || !window.chrome.windows.getAll) {
            return [];
        }
        if (windowScope && windowScope.startsWith('window:')) {
            const windowId = Number(windowScope.split(':')[1]);
            if (Number.isNaN(windowId)) {
                return [];
            }
            const windowInfo = await promiseChrome(window.chrome.windows, window.chrome.windows.get, windowId);
            return windowInfo ? [windowInfo] : [];
        }
        if (windowScope === 'all') {
            const windows = await promiseChrome(window.chrome.windows, window.chrome.windows.getAll, { populate: false });
            return windows.filter((item) => item.type === 'normal');
        }
        const current = await promiseChrome(window.chrome.windows, window.chrome.windows.getCurrent, { populate: false });
        return current ? [current] : [];
    }

    static async moveTabToGroup(tabId, targetGroupId) {
        if (!window.chrome || !window.chrome.tabs || !window.chrome.tabs.group || !window.chrome.tabGroups || !window.chrome.tabGroups.get) {
            return false;
        }
        try {
            const [tab, targetGroup] = await Promise.all([
                promiseChrome(window.chrome.tabs, window.chrome.tabs.get, tabId),
                promiseChrome(window.chrome.tabGroups, window.chrome.tabGroups.get, targetGroupId)
            ]);
            if (tab.windowId !== targetGroup.windowId) {
                await promiseChrome(window.chrome.tabs, window.chrome.tabs.move, tabId, {
                    windowId: targetGroup.windowId,
                    index: -1
                });
            }
            await promiseChrome(window.chrome.tabs, window.chrome.tabs.group, {
                groupId: targetGroupId,
                tabIds: [tabId]
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    static async groupUngroupedTabsByDomain() {
        if (!window.chrome || !window.chrome.tabs || !window.chrome.tabs.query || !window.chrome.tabs.group) {
            return { createdCount: 0 };
        }

        const tabs = await promiseChrome(window.chrome.tabs, window.chrome.tabs.query, { groupId: -1 });
        const groups = new Map();

        tabs.forEach((tab) => {
            const domain = normalizeDomain(tab.url || tab.pendingUrl || '');
            if (!domain) {
                return;
            }
            const key = `${tab.windowId}-${domain}`;
            if (!groups.has(key)) {
                groups.set(key, { domain, tabIds: [], windowId: tab.windowId });
            }
            groups.get(key).tabIds.push(tab.id);
        });

        let createdCount = 0;
        for (const group of groups.values()) {
            if (!group.tabIds.length) {
                continue;
            }
            const groupId = await promiseChrome(window.chrome.tabs, window.chrome.tabs.group, {
                tabIds: group.tabIds
            });
            const color = groupColorPalette[hashString(group.domain) % groupColorPalette.length];
            await promiseChrome(window.chrome.tabGroups, window.chrome.tabGroups.update, groupId, {
                title: group.domain,
                color
            });
            createdCount += 1;
        }

        return { createdCount };
    }

    static async groupUngroupedTabsByRules({ rules, windowScope }) {
        if (!window.chrome || !window.chrome.tabs || !window.chrome.tabs.query || !window.chrome.tabs.group) {
            return { createdCount: 0, movedTabs: 0 };
        }
        if (!rules.length) {
            return { createdCount: 0, movedTabs: 0 };
        }

        const windows = await ChromeService.getWindowsByScope(windowScope);
        let createdCount = 0;
        let movedTabs = 0;

        for (const windowInfo of windows) {
            const windowId = windowInfo.id;
            const tabs = await promiseChrome(window.chrome.tabs, window.chrome.tabs.query, {
                windowId
            });
            if (!tabs.length) {
                continue;
            }

            const groups = await promiseChrome(window.chrome.tabGroups, window.chrome.tabGroups.query, { windowId });
            const existingGroups = new Map();
            groups.forEach((group) => {
                if (group.title) {
                    existingGroups.set(group.title.toLowerCase(), group.id);
                }
            });

            const tabsByGroupName = new Map();
            tabs.forEach((tab) => {
                const rule = ChromeService.matchRule(tab, rules);
                if (!rule) {
                    return;
                }
                const groupName = rule.groupName;
                const existingGroupId = existingGroups.get(groupName.toLowerCase());
                if (existingGroupId && tab.groupId === existingGroupId) {
                    return;
                }
                if (!tabsByGroupName.has(groupName)) {
                    tabsByGroupName.set(groupName, []);
                }
                tabsByGroupName.get(groupName).push(tab.id);
            });

            for (const [groupName, tabIds] of tabsByGroupName.entries()) {
                if (!tabIds.length) {
                    continue;
                }
                const existingGroupId = existingGroups.get(groupName.toLowerCase());
                if (existingGroupId) {
                    await promiseChrome(window.chrome.tabs, window.chrome.tabs.group, {
                        groupId: existingGroupId,
                        tabIds
                    });
                    movedTabs += tabIds.length;
                    continue;
                }
                const groupId = await promiseChrome(window.chrome.tabs, window.chrome.tabs.group, {
                    tabIds
                });
                const color = groupColorPalette[hashString(groupName) % groupColorPalette.length];
                await promiseChrome(window.chrome.tabGroups, window.chrome.tabGroups.update, groupId, {
                    title: groupName,
                    color
                });
                createdCount += 1;
                movedTabs += tabIds.length;
            }
        }

        return { createdCount, movedTabs };
    }

    static async closeGroupTabs(groupId) {
        if (!window.chrome || !window.chrome.tabs || !window.chrome.tabs.query || !window.chrome.tabs.remove) {
            return false;
        }
        try {
            const tabs = await promiseChrome(window.chrome.tabs, window.chrome.tabs.query, { groupId });
            const tabIds = tabs.map((tab) => tab.id);
            if (!tabIds.length) {
                return false;
            }
            await promiseChrome(window.chrome.tabs, window.chrome.tabs.remove, tabIds);
            return true;
        } catch (error) {
            return false;
        }
    }

    static async focusGroup(groupId) {
        if (!window.chrome || !window.chrome.tabs || !window.chrome.tabs.query) {
            return false;
        }
        try {
            const tabs = await promiseChrome(window.chrome.tabs, window.chrome.tabs.query, { groupId });
            if (!tabs.length) {
                return false;
            }
            const target = tabs[0];
            await promiseChrome(window.chrome.tabs, window.chrome.tabs.update, target.id, { active: true });
            if (Number.isInteger(target.windowId)) {
                await promiseChrome(window.chrome.windows, window.chrome.windows.update, target.windowId, { focused: true });
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    static async createGroupFromSnapshot(group) {
        if (!window.chrome || !window.chrome.tabs || !window.chrome.tabs.create || !window.chrome.tabs.group) {
            return false;
        }
        const urls = (group.tabs || [])
            .map((tab) => tab.url)
            .filter(Boolean);
        if (!urls.length) {
            return false;
        }
        try {
            const createdTabIds = [];
            for (let index = 0; index < urls.length; index += 1) {
                const created = await promiseChrome(window.chrome.tabs, window.chrome.tabs.create, {
                    url: urls[index],
                    active: index === 0
                });
                if (created && created.id) {
                    createdTabIds.push(created.id);
                }
            }
            if (!createdTabIds.length) {
                return false;
            }
            const groupId = await promiseChrome(window.chrome.tabs, window.chrome.tabs.group, {
                tabIds: createdTabIds
            });
            if (window.chrome && window.chrome.tabGroups && window.chrome.tabGroups.update) {
                await promiseChrome(window.chrome.tabGroups, window.chrome.tabGroups.update, groupId, {
                    title: group.title || '',
                    color: group.color || 'blue'
                });
            }
            return true;
        } catch (error) {
            return false;
        }
    }

    static async dedupeGroupTabs(groupId) {
        if (!window.chrome || !window.chrome.tabs || !window.chrome.tabs.query || !window.chrome.tabs.remove) {
            return 0;
        }
        try {
            const tabs = await promiseChrome(window.chrome.tabs, window.chrome.tabs.query, { groupId });
            const seen = new Set();
            const duplicates = [];
            tabs.forEach((tab) => {
                const key = tab.url || tab.pendingUrl || tab.title || '';
                if (!key) {
                    return;
                }
                if (seen.has(key)) {
                    duplicates.push(tab.id);
                    return;
                }
                seen.add(key);
            });
            if (!duplicates.length) {
                return 0;
            }
            await promiseChrome(window.chrome.tabs, window.chrome.tabs.remove, duplicates);
            return duplicates.length;
        } catch (error) {
            return 0;
        }
    }

    static async createNewGroup({ title = '新标签组', color = 'blue' } = {}) {
        if (!window.chrome || !window.chrome.tabs || !window.chrome.tabs.create || !window.chrome.tabs.group) {
            return null;
        }
        try {
            const createdTab = await promiseChrome(window.chrome.tabs, window.chrome.tabs.create, {
                url: 'chrome://newtab/',
                active: true
            });
            if (!createdTab || !createdTab.id) {
                return null;
            }
            const groupId = await promiseChrome(window.chrome.tabs, window.chrome.tabs.group, {
                tabIds: [createdTab.id]
            });
            if (window.chrome && window.chrome.tabGroups && window.chrome.tabGroups.update) {
                await promiseChrome(window.chrome.tabGroups, window.chrome.tabGroups.update, groupId, {
                    title,
                    color
                });
            }
            return groupId;
        } catch (error) {
            return null;
        }
    }

    static async getTabsByIds(tabIds) {
        if (!window.chrome || !window.chrome.tabs || !window.chrome.tabs.get) {
            return [];
        }
        const results = await Promise.all(
            tabIds.map((tabId) => promiseChrome(window.chrome.tabs, window.chrome.tabs.get, tabId))
        );
        return results.filter(Boolean);
    }

    static async createTabsInGroup(urls, groupId, windowId) {
        if (!window.chrome || !window.chrome.tabs || !window.chrome.tabs.create || !window.chrome.tabs.group) {
            return 0;
        }
        const createdIds = [];
        for (let index = 0; index < urls.length; index += 1) {
            const created = await promiseChrome(window.chrome.tabs, window.chrome.tabs.create, {
                url: urls[index],
                windowId,
                active: index === 0
            });
            if (created && created.id) {
                createdIds.push(created.id);
            }
        }
        if (createdIds.length) {
            await promiseChrome(window.chrome.tabs, window.chrome.tabs.group, {
                groupId,
                tabIds: createdIds
            });
        }
        return createdIds.length;
    }

    static async mergeAllWindowsIntoCurrent() {
        if (!window.chrome || !window.chrome.windows || !window.chrome.windows.getAll || !window.chrome.tabs || !window.chrome.tabs.move) {
            return { movedWindows: 0, movedTabs: 0 };
        }

        try {
            const chromeApi = window.chrome;
            const currentWindow = await promiseChrome(chromeApi.windows, chromeApi.windows.getCurrent, {
                populate: true
            });
            const allWindows = await promiseChrome(chromeApi.windows, chromeApi.windows.getAll, {
                populate: true
            });
            const targetWindowId = currentWindow ? currentWindow.id : null;
            if (!targetWindowId) {
                return { movedWindows: 0, movedTabs: 0 };
            }

            const sourceWindows = allWindows.filter(
                (item) => item.id !== targetWindowId && item.type === 'normal'
            );

            let movedTabs = 0;
            let movedWindows = 0;

            for (const sourceWindow of sourceWindows) {
                const tabs = sourceWindow.tabs || [];
                if (!tabs.length) {
                    continue;
                }
                const groups = chromeApi.tabGroups && chromeApi.tabGroups.query
                    ? await promiseChrome(chromeApi.tabGroups, chromeApi.tabGroups.query, { windowId: sourceWindow.id })
                    : [];

                const tabsByGroup = new Map();
                tabs.forEach((tab) => {
                    if (tab.groupId === -1) {
                        return;
                    }
                    if (!tabsByGroup.has(tab.groupId)) {
                        tabsByGroup.set(tab.groupId, []);
                    }
                    tabsByGroup.get(tab.groupId).push(tab.id);
                });

                for (const group of groups) {
                    const tabIds = tabsByGroup.get(group.id) || [];
                    if (!tabIds.length) {
                        continue;
                    }
                    await promiseChrome(chromeApi.tabs, chromeApi.tabs.move, tabIds, {
                        windowId: targetWindowId,
                        index: -1
                    });
                    if (chromeApi.tabs && chromeApi.tabs.group) {
                        const newGroupId = await promiseChrome(chromeApi.tabs, chromeApi.tabs.group, {
                            tabIds,
                            windowId: targetWindowId
                        });
                        await promiseChrome(chromeApi.tabGroups, chromeApi.tabGroups.update, newGroupId, {
                            title: group.title || '',
                            color: group.color || 'blue'
                        });
                    }
                    movedTabs += tabIds.length;
                }

                const ungroupedTabIds = tabs.filter((tab) => tab.groupId === -1).map((tab) => tab.id);
                if (ungroupedTabIds.length) {
                    await promiseChrome(chromeApi.tabs, chromeApi.tabs.move, ungroupedTabIds, {
                        windowId: targetWindowId,
                        index: -1
                    });
                    movedTabs += ungroupedTabIds.length;
                }

                movedWindows += 1;
            }

            return { movedWindows, movedTabs };
        } catch (error) {
            return { movedWindows: 0, movedTabs: 0 };
        }
    }
}

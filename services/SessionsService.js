const mapTab = (tab, fallbackId) => {
    return {
        id: tab.sessionId || fallbackId,
        title: tab.title || tab.pendingUrl || tab.url || '未命名标签页',
        url: tab.url || tab.pendingUrl || '',
        favIconUrl: tab.favIconUrl || '',
        active: false,
        pinned: Boolean(tab.pinned)
    };
};

const promiseChrome = (context, fn, ...args) => new Promise((resolve) => fn.call(context, ...args, resolve));

export default class SessionsService {
    static async getRecentlyClosedGroups({ maxResults = 50 } = {}) {
        if (!window.chrome || !window.chrome.sessions || !window.chrome.sessions.getRecentlyClosed) {
            return [];
        }

        const sessions = await promiseChrome(window.chrome.sessions, window.chrome.sessions.getRecentlyClosed, {
            maxResults
        });

        const groups = [];
        const looseTabs = [];
        let looseLastModified = 0;

        sessions.forEach((session, index) => {
            const lastModified = Number(session.lastModified) || Date.now();
            if (session.window && session.window.tabs && session.window.tabs.length) {
                const tabs = session.window.tabs.map((tab, tabIndex) => mapTab(tab, `session-window-${index}-tab-${tabIndex}`));
                groups.push({
                    id: `session-window-${session.sessionId || index}`,
                    title: `最近关闭窗口 ${index + 1}`,
                    color: 'slate',
                    category: '历史',
                    updatedAt: lastModified,
                    tabs
                });
                return;
            }

            if (session.tab) {
                looseTabs.push(mapTab(session.tab, `session-tab-${index}`));
                if (lastModified > looseLastModified) {
                    looseLastModified = lastModified;
                }
            }
        });

        if (looseTabs.length) {
            groups.push({
                id: 'session-tabs',
                title: '最近关闭标签',
                color: 'slate',
                category: '历史',
                updatedAt: looseLastModified || Date.now(),
                tabs: looseTabs
            });
        }

        return groups.sort((a, b) => b.updatedAt - a.updatedAt);
    }
}

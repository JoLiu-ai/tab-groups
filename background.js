const EXTENSION_PAGE = chrome.runtime.getURL('index.html');

const queryTabs = () => new Promise((resolve) => {
    chrome.tabs.query({ url: EXTENSION_PAGE }, resolve);
});

const updateTab = (tabId, props) => new Promise((resolve) => {
    chrome.tabs.update(tabId, props, resolve);
});

const updateWindow = (windowId, props) => new Promise((resolve) => {
    chrome.windows.update(windowId, props, resolve);
});

const createTab = (props) => new Promise((resolve) => {
    chrome.tabs.create(props, resolve);
});

const focusOrCreateTab = async () => {
    const tabs = await queryTabs();
    if (tabs.length) {
        const target = tabs[0];
        await updateTab(target.id, { active: true });
        if (Number.isInteger(target.windowId)) {
            await updateWindow(target.windowId, { focused: true });
        }
        return;
    }
    await createTab({ url: EXTENSION_PAGE });
};

chrome.action.onClicked.addListener(() => {
    focusOrCreateTab();
});

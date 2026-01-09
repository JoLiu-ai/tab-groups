const STORAGE_PREFIX = 'cuteTodo_';
const CLOSED_GROUPS_KEY = `${STORAGE_PREFIX}tabGroupsClosed`;
const CATEGORIES_KEY = `${STORAGE_PREFIX}tabGroupCategories`;
const CATEGORY_MAP_KEY = `${STORAGE_PREFIX}tabGroupCategoryMap`;
const LOCKED_KEY = `${STORAGE_PREFIX}tabGroupLocked`;
const STARRED_KEY = `${STORAGE_PREFIX}tabGroupStarred`;
const DOMAIN_RULES_KEY = `${STORAGE_PREFIX}tabGroupDomainRules`;
const DOMAIN_SCOPE_KEY = `${STORAGE_PREFIX}tabGroupDomainScope`;

export default class StorageService {
    static getClosedGroups() {
        return StorageService.getJson(CLOSED_GROUPS_KEY, []);
    }

    static saveClosedGroups(groups) {
        StorageService.setJson(CLOSED_GROUPS_KEY, groups);
    }

    static getCategories() {
        const value = StorageService.getJson(CATEGORIES_KEY, []);
        return Array.isArray(value) ? value : [];
    }

    static saveCategories(categories) {
        StorageService.setJson(CATEGORIES_KEY, categories);
    }

    static getCategoryMap() {
        return StorageService.getJson(CATEGORY_MAP_KEY, {});
    }

    static saveCategoryMap(map) {
        StorageService.setJson(CATEGORY_MAP_KEY, map);
    }

    static getLockedSignatures() {
        return StorageService.getJson(LOCKED_KEY, []);
    }

    static saveLockedSignatures(signatures) {
        StorageService.setJson(LOCKED_KEY, signatures);
    }

    static getStarredSignatures() {
        return StorageService.getJson(STARRED_KEY, []);
    }

    static saveStarredSignatures(signatures) {
        StorageService.setJson(STARRED_KEY, signatures);
    }

    static getDomainRules() {
        const value = StorageService.getJson(DOMAIN_RULES_KEY, []);
        return Array.isArray(value) ? value : [];
    }

    static saveDomainRules(rules) {
        StorageService.setJson(DOMAIN_RULES_KEY, rules);
    }

    static getDomainScope() {
        return StorageService.getJson(DOMAIN_SCOPE_KEY, 'current');
    }

    static saveDomainScope(scope) {
        StorageService.setJson(DOMAIN_SCOPE_KEY, scope);
    }

    static getJson(key, fallback) {
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) {
                return fallback;
            }
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    }

    static setJson(key, value) {
        window.localStorage.setItem(key, JSON.stringify(value));
    }
}

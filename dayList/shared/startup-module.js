const STARTUP_MODULE_STORAGE_KEY = 'daylist-startup-module-v1'
const DEFAULT_STARTUP_MODULE = 'schedule'
const MODULE_PAGE_URLS = {
	schedule: '/pages/schedule/index',
	cycle: '/pages/cycle/index'
}

export function normalizeStartupModule(moduleName) {
	return Object.prototype.hasOwnProperty.call(MODULE_PAGE_URLS, moduleName) ? moduleName : DEFAULT_STARTUP_MODULE
}

export function getStartupModule() {
	return normalizeStartupModule(uni.getStorageSync(STARTUP_MODULE_STORAGE_KEY))
}

export function saveStartupModule(moduleName) {
	const normalized = normalizeStartupModule(moduleName)
	uni.setStorageSync(STARTUP_MODULE_STORAGE_KEY, normalized)
	return normalized
}

export function startupModuleUrl(moduleName) {
	return MODULE_PAGE_URLS[normalizeStartupModule(moduleName)]
}

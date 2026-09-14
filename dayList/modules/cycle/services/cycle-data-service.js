const CYCLE_STORAGE_KEY = 'daylist-cycle-items-v1'
const VIEW_MODES = ['week', 'month']
const INTERVAL_UNITS = ['day', 'month']

function cycleError(code, message) {
	const error = new Error(`${code}: ${message}`)
	error.errCode = code
	return error
}

function requireId(id) {
	if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw cycleError('INVALID_CYCLE_ID', '周期项目标识无效')
	return id
}

function requireTitle(input) {
	const title = typeof input === 'string' ? input.trim() : ''
	if (!title) throw cycleError('INVALID_TITLE', '请输入项目名称')
	if (title.length > 60) throw cycleError('INVALID_TITLE', '项目名称不能超过 60 个字符')
	return title
}

function normalizeIcon(input) {
	const icon = typeof input === 'string' ? input.trim() : ''
	return icon ? Array.from(icon).slice(0, 2).join('') : '↻'
}

function requireViewMode(input) {
	if (!VIEW_MODES.includes(input)) throw cycleError('INVALID_VIEW_MODE', '请选择周视图或月视图')
	return input
}

function normalizeIntervalValue(input) {
	if (input === '' || input === null || typeof input === 'undefined') return null
	const value = Number(input)
	if (!Number.isInteger(value) || value < 1 || value > 999) throw cycleError('INVALID_INTERVAL', '计划周期需为 1 至 999 的整数')
	return value
}

function normalizeCompletions(input) {
	return Array.isArray(input)
		? [...new Set(input.filter((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)))].sort()
		: []
}

function normalizeCycle(input) {
	if (!input || typeof input !== 'object' || typeof input._id !== 'string') return null
	const legacyFrequency = ['daily', 'weekly', 'monthly'].includes(input.frequency) ? input.frequency : ''
	const viewMode = VIEW_MODES.includes(input.view_mode) ? input.view_mode : (legacyFrequency === 'monthly' ? 'month' : 'week')
	const intervalUnit = INTERVAL_UNITS.includes(input.interval_unit) ? input.interval_unit : (legacyFrequency === 'monthly' ? 'month' : 'day')
	let intervalValue = null
	if (Number.isInteger(Number(input.interval_value)) && Number(input.interval_value) >= 1 && Number(input.interval_value) <= 999) intervalValue = Number(input.interval_value)
	else if (legacyFrequency === 'daily') intervalValue = 1
	else if (legacyFrequency === 'weekly') intervalValue = 7
	else if (legacyFrequency === 'monthly') intervalValue = 1
	return {
		_id: input._id,
		title: typeof input.title === 'string' ? input.title : '',
		icon: normalizeIcon(input.icon),
		view_mode: viewMode,
		interval_value: intervalValue,
		interval_unit: intervalUnit,
		completions: normalizeCompletions(input.completions),
		archived: input.archived === true,
		archived_at: Number(input.archived_at) || 0,
		created_at: Number(input.created_at) || Date.now(),
		updated_at: Number(input.updated_at) || Date.now()
	}
}

function cloneCycle(cycle) { return { ...cycle, completions: [...cycle.completions] } }
function cloneCycles(cycles) { return cycles.map(cloneCycle) }

function readCycles() {
	const stored = uni.getStorageSync(CYCLE_STORAGE_KEY)
	return Array.isArray(stored) ? stored.map(normalizeCycle).filter(Boolean) : []
}

function writeCycles(cycles) { uni.setStorageSync(CYCLE_STORAGE_KEY, cloneCycles(cycles)) }

function updateCycle(idInput, updater) {
	const id = requireId(idInput)
	const cycles = readCycles()
	const index = cycles.findIndex((cycle) => cycle._id === id)
	if (index < 0) throw cycleError('CYCLE_NOT_FOUND', '周期项目不存在')
	cycles[index] = normalizeCycle(updater(cloneCycle(cycles[index])))
	writeCycles(cycles)
	return cloneCycle(cycles[index])
}

function normalizedSettings(payload) {
	const intervalUnit = INTERVAL_UNITS.includes(payload.intervalUnit) ? payload.intervalUnit : 'day'
	return {
		title: requireTitle(payload.title),
		icon: normalizeIcon(payload.icon),
		view_mode: requireViewMode(payload.viewMode),
		interval_value: normalizeIntervalValue(payload.intervalValue),
		interval_unit: intervalUnit
	}
}

export const cycleDataService = {
	async listCycles() { return { cycles: cloneCycles(readCycles()) } },

	async getCycle(payload = {}) {
		const id = requireId(payload.id)
		const cycle = readCycles().find((item) => item._id === id)
		if (!cycle) throw cycleError('CYCLE_NOT_FOUND', '周期项目不存在')
		return { cycle: cloneCycle(cycle) }
	},

	async createCycle(payload = {}) {
		const now = Date.now()
		const settings = normalizedSettings(payload)
		const cycles = readCycles()
		cycles.push({
			_id: `cycle_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
			...settings,
			completions: [], archived: false, archived_at: 0, created_at: now, updated_at: now
		})
		writeCycles(cycles)
		return { created: true }
	},

	async updateCycle(payload = {}) {
		const settings = normalizedSettings(payload)
		updateCycle(payload.id, (cycle) => ({ ...cycle, ...settings, updated_at: Date.now() }))
		return { updated: true }
	},

	async toggleCompletion(payload = {}) {
		const date = typeof payload.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(payload.date) ? payload.date : ''
		if (!date) throw cycleError('INVALID_DATE', '打卡日期无效')
		updateCycle(payload.id, (cycle) => {
			if (cycle.archived) throw cycleError('CYCLE_ARCHIVED', '已停用的周期项目不能打卡')
			const completed = cycle.completions.includes(date)
			return { ...cycle, completions: completed ? cycle.completions.filter((value) => value !== date) : [...cycle.completions, date].sort(), updated_at: Date.now() }
		})
		return { updated: true }
	},

	async archiveCycle(payload = {}) {
		updateCycle(payload.id, (cycle) => ({ ...cycle, archived: true, archived_at: Date.now(), updated_at: Date.now() }))
		return { archived: true }
	},

	async restoreCycle(payload = {}) {
		updateCycle(payload.id, (cycle) => ({ ...cycle, archived: false, archived_at: 0, updated_at: Date.now() }))
		return { restored: true }
	},

	async deleteCycle(payload = {}) {
		const id = requireId(payload.id)
		const cycles = readCycles()
		const index = cycles.findIndex((cycle) => cycle._id === id)
		if (index < 0) throw cycleError('CYCLE_NOT_FOUND', '周期项目不存在')
		if (!cycles[index].archived) throw cycleError('CYCLE_NOT_ARCHIVED', '请先停用周期项目再永久删除')
		cycles.splice(index, 1)
		writeCycles(cycles)
		return { removed: true }
	}
}

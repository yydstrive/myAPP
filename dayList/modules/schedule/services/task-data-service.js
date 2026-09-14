import { REMOTE_SYNC_ENABLED } from '../../../config/data-source.js'

const LOCAL_TASKS_STORAGE_KEY = 'daylist-local-tasks-v1'
const LEGACY_TASK_CACHE_KEY = 'daylist-task-cache-v1'

const cloneTasks = (tasks) => tasks.map((task) => ({ ...task }))

function appError(code, message) {
	const error = new Error(`${code}: ${message}`)
	error.errCode = code
	return error
}

function requireTaskId(id) {
	if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw appError('INVALID_TASK_ID', '任务标识无效')
	return id
}

function requireTitle(titleInput) {
	const title = typeof titleInput === 'string' ? titleInput.trim() : ''
	if (!title) throw appError('INVALID_TITLE', '请输入任务内容')
	if (title.length > 120) throw appError('INVALID_TITLE', '任务内容不能超过 120 个字符')
	return title
}

function requireDate(dateInput) {
	if (typeof dateInput !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) throw appError('INVALID_DATE', '日期格式无效')
	const [year, month, day] = dateInput.split('-').map(Number)
	const parsed = new Date(Date.UTC(year, month - 1, day))
	if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
		throw appError('INVALID_DATE', '日期不存在')
	}
	if (year < 2000 || year > 2099) throw appError('INVALID_DATE', '日期超出可选范围')
	return dateInput
}

function requirePriority(priorityInput) {
	const priority = priorityInput || 'medium'
	if (!['low', 'medium', 'high'].includes(priority)) throw appError('INVALID_PRIORITY', '任务优先级无效')
	return priority
}

function normalizeStoredTasks(value) {
	return Array.isArray(value) ? value.filter((task) => task && typeof task === 'object' && typeof task._id === 'string') : []
}

function readLocalTasks() {
	const stored = uni.getStorageSync(LOCAL_TASKS_STORAGE_KEY)
	if (Array.isArray(stored)) return normalizeStoredTasks(stored)

	// 第一次启用本地模式时，仅迁移本设备上已有的任务缓存，不访问云端。
	const cached = normalizeStoredTasks(uni.getStorageSync(LEGACY_TASK_CACHE_KEY))
	uni.setStorageSync(LOCAL_TASKS_STORAGE_KEY, cached)
	return cached
}

function writeLocalTasks(tasks) {
	uni.setStorageSync(LOCAL_TASKS_STORAGE_KEY, cloneTasks(tasks))
}

function createLocalId() {
	return `local_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function updateLocalTask(idInput, updater) {
	const id = requireTaskId(idInput)
	const tasks = readLocalTasks()
	const index = tasks.findIndex((task) => task._id === id)
	if (index < 0) throw appError('TASK_NOT_FOUND', '任务不存在')
	tasks[index] = updater({ ...tasks[index] })
	writeLocalTasks(tasks)
	return tasks[index]
}

export const localTaskService = {
	async bootstrapSession() {
		return { secretEnabled: false, initialized: true, authenticated: true, tasks: cloneTasks(readLocalTasks()) }
	},

	async getStatus() {
		return { initialized: true, secretEnabled: false, dataSource: 'local' }
	},

	async initialize() {
		return { initialized: true }
	},

	async verifySecret() {
		return { valid: true }
	},

	async listTasks() {
		return { tasks: cloneTasks(readLocalTasks()) }
	},

	async createTask(payload = {}) {
		const now = Date.now()
		const id = createLocalId()
		const tasks = readLocalTasks()
		tasks.push({
			_id: id,
			title: requireTitle(payload.title),
			task_date: requireDate(payload.taskDate),
			priority: requirePriority(payload.priority),
			completed: false,
			completed_at: 0,
			deleted: false,
			deleted_at: 0,
			created_at: now,
			updated_at: now
		})
		writeLocalTasks(tasks)
		return { id }
	},

	async setCompleted(payload = {}) {
		const completed = payload.completed === true
		updateLocalTask(payload.id, (task) => ({
			...task,
			completed,
			completed_at: completed ? Date.now() : 0,
			updated_at: Date.now()
		}))
		return { updated: true }
	},

	async renameTask(payload = {}) {
		const title = requireTitle(payload.title)
		updateLocalTask(payload.id, (task) => ({ ...task, title, updated_at: Date.now() }))
		return { updated: true }
	},

	async moveToTrash(payload = {}) {
		updateLocalTask(payload.id, (task) => ({ ...task, deleted: true, deleted_at: Date.now(), updated_at: Date.now() }))
		return { deleted: true }
	},

	async restoreTask(payload = {}) {
		updateLocalTask(payload.id, (task) => ({ ...task, deleted: false, deleted_at: 0, updated_at: Date.now() }))
		return { restored: true }
	},

	async deleteForever(payload = {}) {
		const id = requireTaskId(payload.id)
		const tasks = readLocalTasks()
		const index = tasks.findIndex((task) => task._id === id)
		if (index < 0) throw appError('TASK_NOT_FOUND', '任务不存在')
		if (tasks[index].deleted !== true) throw appError('NOT_IN_TRASH', '只能永久删除回收站中的任务')
		tasks.splice(index, 1)
		writeLocalTasks(tasks)
		return { removed: true }
	}
}

export function createRemoteTaskService() {
	return uniCloud.importObject('task-service', { customUI: true })
}

export function createTaskService() {
	return REMOTE_SYNC_ENABLED ? createRemoteTaskService() : localTaskService
}

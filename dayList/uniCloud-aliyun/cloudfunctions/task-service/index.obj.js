const crypto = require('crypto')
const { SYNC_SECRET_ENABLED } = require('./config')

const db = uniCloud.database()
const tasks = db.collection('daylist-tasks')
const settings = db.collection('daylist-settings')
const SECURITY_DOCUMENT_ID = 'sync-security'

function appError(code, message) {
	const error = new Error(`${code}: ${message}`)
	error.errCode = code
	return error
}

function normalizeSecret(secret) {
	return typeof secret === 'string' ? secret.trim() : ''
}

function deriveSecret(secret, salt) {
	return crypto.scryptSync(secret, salt, 64).toString('hex')
}

function safeEqualHex(left, right) {
	try {
		const leftBuffer = Buffer.from(left, 'hex')
		const rightBuffer = Buffer.from(right, 'hex')
		return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
	} catch (error) {
		return false
	}
}

async function getSecuritySetting() {
	const result = await settings.doc(SECURITY_DOCUMENT_ID).get()
	return result.data && result.data[0] ? result.data[0] : null
}

async function requireSecret(secretInput, securityInput) {
	if (!SYNC_SECRET_ENABLED) return
	const secret = normalizeSecret(secretInput)
	if (!secret) throw appError('INVALID_SECRET', '同步口令不正确')
	const security = securityInput || await getSecuritySetting()
	if (!security) throw appError('NOT_INITIALIZED', '同步口令尚未初始化')
	const now = Date.now()
	if ((security.locked_until || 0) > now) throw appError('ACCESS_LOCKED', '输错次数过多，请稍后再试')
	const candidate = deriveSecret(secret, security.salt)
	if (!safeEqualHex(candidate, security.secret_hash)) {
		const failedAttempts = (security.failed_attempts || 0) + 1
		const shouldLock = failedAttempts >= 5
		await settings.doc(SECURITY_DOCUMENT_ID).update({
			failed_attempts: shouldLock ? 0 : failedAttempts,
			locked_until: shouldLock ? now + 10 * 60 * 1000 : 0,
			updated_at: now
		})
		if (shouldLock) throw appError('ACCESS_LOCKED', '输错次数过多，请稍后再试')
		throw appError('INVALID_SECRET', '同步口令不正确')
	}
	if (security.failed_attempts || security.locked_until) {
		await settings.doc(SECURITY_DOCUMENT_ID).update({ failed_attempts: 0, locked_until: 0, updated_at: now })
	}
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

module.exports = {
	async bootstrapSession(payload = {}) {
		const security = await getSecuritySetting()
		if (SYNC_SECRET_ENABLED) {
			if (!security) return { secretEnabled: true, initialized: false, authenticated: false, tasks: [] }
			if (!normalizeSecret(payload.secret)) return { secretEnabled: true, initialized: true, authenticated: false, tasks: [] }
			await requireSecret(payload.secret, security)
		}
		const result = await tasks.orderBy('task_date', 'asc').orderBy('created_at', 'asc').limit(500).get()
		return {
			secretEnabled: SYNC_SECRET_ENABLED,
			initialized: Boolean(security),
			authenticated: true,
			tasks: result.data || []
		}
	},

	async getStatus() {
		return { initialized: Boolean(await getSecuritySetting()), secretEnabled: SYNC_SECRET_ENABLED }
	},

	async initialize(payload = {}) {
		const existing = await getSecuritySetting()
		if (existing) return { initialized: true }
		const secret = normalizeSecret(payload.secret)
		if (!/^\d{3,32}$/.test(secret)) throw appError('WEAK_SECRET', '同步口令需为至少 3 位纯数字')
		const salt = crypto.randomBytes(24).toString('hex')
		await settings.doc(SECURITY_DOCUMENT_ID).set({
			salt,
			secret_hash: deriveSecret(secret, salt),
			failed_attempts: 0,
			locked_until: 0,
			created_at: Date.now(),
			updated_at: Date.now()
		})
		return { initialized: true }
	},

	async verifySecret(payload = {}) {
		await requireSecret(payload.secret)
		return { valid: true }
	},

	async listTasks(payload = {}) {
		await requireSecret(payload.secret)
		const result = await tasks.orderBy('task_date', 'asc').orderBy('created_at', 'asc').limit(500).get()
		return { tasks: result.data || [] }
	},

	async createTask(payload = {}) {
		await requireSecret(payload.secret)
		const now = Date.now()
		const result = await tasks.add({
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
		return { id: result.id }
	},

	async setCompleted(payload = {}) {
		await requireSecret(payload.secret)
		const completed = payload.completed === true
		await tasks.doc(requireTaskId(payload.id)).update({
			completed,
			completed_at: completed ? Date.now() : 0,
			updated_at: Date.now()
		})
		return { updated: true }
	},

	async renameTask(payload = {}) {
		await requireSecret(payload.secret)
		await tasks.doc(requireTaskId(payload.id)).update({
			title: requireTitle(payload.title),
			updated_at: Date.now()
		})
		return { updated: true }
	},

	async moveToTrash(payload = {}) {
		await requireSecret(payload.secret)
		await tasks.doc(requireTaskId(payload.id)).update({ deleted: true, deleted_at: Date.now(), updated_at: Date.now() })
		return { deleted: true }
	},

	async restoreTask(payload = {}) {
		await requireSecret(payload.secret)
		await tasks.doc(requireTaskId(payload.id)).update({ deleted: false, deleted_at: 0, updated_at: Date.now() })
		return { restored: true }
	},

	async deleteForever(payload = {}) {
		await requireSecret(payload.secret)
		const id = requireTaskId(payload.id)
		const record = await tasks.doc(id).get()
		if (!record.data || !record.data[0] || record.data[0].deleted !== true) {
			throw appError('NOT_IN_TRASH', '只能永久删除回收站中的任务')
		}
		await tasks.doc(id).remove()
		return { removed: true }
	}
}

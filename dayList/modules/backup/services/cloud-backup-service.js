const SYNC_CODE_STORAGE_KEY = 'daylist-cloud-backup-sync-code-v1'
const SYNC_CODE_CONFIGURED_STORAGE_KEY = 'daylist-cloud-backup-sync-code-configured-v1'
const BACKUP_STATE_STORAGE_KEY = 'daylist-cloud-backup-state-v1'
const BACKUP_ATTEMPTS_STORAGE_KEY = 'daylist-cloud-backup-attempts-v1'
const RESTORE_JOURNAL_STORAGE_KEY = 'daylist-cloud-backup-restore-journal-v1'

const TASKS_STORAGE_KEY = 'daylist-local-tasks-v1'
const LEGACY_TASKS_STORAGE_KEY = 'daylist-task-cache-v1'
const CYCLES_STORAGE_KEY = 'daylist-cycle-items-v1'
const WEEKLY_HISTORY_STORAGE_KEY = 'daylist-weekly-metric-history-v1'
const STARTUP_MODULE_STORAGE_KEY = 'daylist-startup-module-v1'
const CARD_ROW_HEIGHTS_STORAGE_KEY = 'daylist-card-row-heights-v1'

const SNAPSHOT_SCHEMA_VERSION = 1
const MAX_LOCAL_ATTEMPT_RECORDS = 60
const RETRY_DELAY_MS = 24 * 60 * 60 * 1000
const MAX_MONTHLY_ATTEMPTS = 3

export const BACKUP_STATUS_SUCCESS = 'success'
export const BACKUP_STATUS_FAILED = 'failed'
export const BACKUP_STATUS_RESOURCE_LIMIT = 'resource_limit'

let scheduledBackupPromise = null

function clone(value) {
	if (value === undefined) return undefined
	return JSON.parse(JSON.stringify(value))
}

function pad(value) { return String(value).padStart(2, '0') }
function monthPeriod(date = new Date()) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}` }
function scheduledTimeFor(date = new Date()) { return new Date(date.getFullYear(), date.getMonth(), 3, 8, 0, 0, 0).getTime() }

function backupError(code, message, extra = {}) {
	const error = new Error(`${code}: ${message}`)
	error.errCode = code
	Object.assign(error, extra)
	return error
}

function validSyncCode(value) { return /^\d{4}$/.test(String(value || '')) }

function createOperationId(type) {
	return `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`
}

function readBackupSyncCode() {
	if (uni.getStorageSync(SYNC_CODE_CONFIGURED_STORAGE_KEY) !== true) return ''
	const stored = String(uni.getStorageSync(SYNC_CODE_STORAGE_KEY) || '')
	return validSyncCode(stored) ? stored : ''
}

export function saveBackupSyncCode(value) {
	const code = String(value || '').replace(/\D/g, '').slice(0, 4)
	if (!validSyncCode(code)) throw backupError('INVALID_SYNC_CODE', '同步码必须为4位数字')
	uni.setStorageSync(SYNC_CODE_STORAGE_KEY, code)
	uni.setStorageSync(SYNC_CODE_CONFIGURED_STORAGE_KEY, true)
	return code
}

function readBackupState() {
	const stored = uni.getStorageSync(BACKUP_STATE_STORAGE_KEY)
	return stored && typeof stored === 'object' && !Array.isArray(stored)
		? { lastSuccessByCode: {}, schedule: {}, ...stored }
		: { lastSuccessByCode: {}, schedule: {} }
}

function writeBackupState(state) { uni.setStorageSync(BACKUP_STATE_STORAGE_KEY, clone(state)) }

function readLocalAttempts() {
	const stored = uni.getStorageSync(BACKUP_ATTEMPTS_STORAGE_KEY)
	return Array.isArray(stored) ? stored.filter((item) => item && typeof item === 'object') : []
}

function appendLocalAttempt(record) {
	const records = [record, ...readLocalAttempts()].slice(0, MAX_LOCAL_ATTEMPT_RECORDS)
	uni.setStorageSync(BACKUP_ATTEMPTS_STORAGE_KEY, records)
}

export function getLocalBackupAttempts(syncCode = readBackupSyncCode()) {
	return readLocalAttempts().filter((item) => item.syncCode === syncCode).map((item) => ({ ...item, selectable: false }))
}

export function getBackupOverview() {
	const syncCode = readBackupSyncCode()
	const state = readBackupState()
	return { syncCode, lastSuccessAt: Number(state.lastSuccessByCode && state.lastSuccessByCode[syncCode]) || 0 }
}

function snapshotArray(storageKey, fallbackKey = '') {
	const stored = uni.getStorageSync(storageKey)
	if (Array.isArray(stored)) return clone(stored)
	if (fallbackKey) {
		const fallback = uni.getStorageSync(fallbackKey)
		if (Array.isArray(fallback)) return clone(fallback)
	}
	return []
}

function captureSnapshot() {
	const capturedAt = Date.now()
	const tasks = snapshotArray(TASKS_STORAGE_KEY, LEGACY_TASKS_STORAGE_KEY)
	const cycles = snapshotArray(CYCLES_STORAGE_KEY)
	const weeklyHistory = snapshotArray(WEEKLY_HISTORY_STORAGE_KEY)
	return {
		schemaVersion: SNAPSHOT_SCHEMA_VERSION,
		capturedAt,
		data: {
			tasks,
			cycles,
			weeklyHistory,
			preferences: {
				startupModule: clone(uni.getStorageSync(STARTUP_MODULE_STORAGE_KEY)),
				cardRowHeights: clone(uni.getStorageSync(CARD_ROW_HEIGHTS_STORAGE_KEY))
			}
		},
		counts: { tasks: tasks.length, cycles: cycles.length, weeklyHistory: weeklyHistory.length }
	}
}

function remoteBackupService() {
	if (typeof uniCloud === 'undefined' || !uniCloud.importObject) throw backupError('CLOUD_UNAVAILABLE', '当前环境不支持云端快照')
	return uniCloud.importObject('backup-service', { customUI: true })
}

function errorText(error) {
	return String(error && (error.errCode || error.code || error.errMsg || error.message) || '')
}

export function classifyBackupError(error) {
	const text = errorText(error)
	const resourcePattern = /(quota|resource.?exhaust|over.?limit|limit.?exceed|rate.?limit|too.?many.?requests|\b429\b|insufficient|gb.?s|资源不足|资源.*超|配额|超限|欠费|停服)/i
	return resourcePattern.test(text)
		? { status: BACKUP_STATUS_RESOURCE_LIMIT, statusText: '云资源不足', message: '云资源不足，请等待资源额度恢复' }
		: { status: BACKUP_STATUS_FAILED, statusText: '快照失败', message: text ? String(text).replace(/^[A-Z0-9_-]+:\s*/i, '').slice(0, 80) : '云端快照失败' }
}

function rememberSuccess(syncCode, createdAt) {
	const state = readBackupState()
	state.lastSuccessByCode = { ...(state.lastSuccessByCode || {}), [syncCode]: Number(createdAt) || Date.now() }
	writeBackupState(state)
}

async function performSnapshot(type, operationId = createOperationId(type)) {
	const syncCode = readBackupSyncCode()
	if (!syncCode) throw backupError('SYNC_CODE_REQUIRED', '请先由超级管理员设置4位同步码')
	const snapshot = captureSnapshot()
	try {
		const result = await remoteBackupService().createSnapshot({ syncCode, type, operationId, payload: snapshot })
		if (!result || !result.snapshot || !result.snapshot.id) throw backupError('INVALID_CLOUD_RESPONSE', '云端未返回有效快照凭据')
		rememberSuccess(syncCode, result.snapshot.createdAt)
		return {
			id: result.snapshot.id,
			executedAt: Number(result.snapshot.createdAt) || snapshot.capturedAt,
			capturedAt: Number(result.snapshot.capturedAt) || snapshot.capturedAt,
			type: result.snapshot.type || type,
			status: BACKUP_STATUS_SUCCESS,
			statusText: '快照成功',
			counts: result.snapshot.counts || snapshot.counts,
			selectable: true
		}
	} catch (error) {
		const classified = classifyBackupError(error)
		appendLocalAttempt({
			id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			syncCode,
			executedAt: Date.now(),
			type,
			status: classified.status,
			statusText: classified.statusText,
			message: classified.message,
			selectable: false
		})
		throw backupError('SNAPSHOT_UPLOAD_FAILED', classified.message, { backupStatus: classified.status, originalError: error })
	}
}

export async function createManualSnapshot() { return performSnapshot('manual') }

async function executeScheduledBackup(now) {
	const date = new Date(now)
	if (now < scheduledTimeFor(date)) return { skipped: true, reason: 'not_due' }

	const syncCode = readBackupSyncCode()
	if (!syncCode) return { skipped: true, reason: 'sync_code_required' }
	const period = monthPeriod(date)
	const state = readBackupState()
	let schedule = state.schedule && state.schedule.period === period && state.schedule.syncCode === syncCode
		? { ...state.schedule }
		: { period, syncCode, operationId: createOperationId(`monthly_${period}`), attempts: 0, nextRetryAt: 0, completed: false, abandoned: false }
	if (!schedule.operationId) schedule.operationId = createOperationId(`monthly_${period}`)

	if (schedule.completed || schedule.abandoned) return { skipped: true, reason: schedule.completed ? 'completed' : 'abandoned' }
	if (schedule.nextRetryAt && now < schedule.nextRetryAt) return { skipped: true, reason: 'waiting_retry' }
	if (schedule.attempts >= MAX_MONTHLY_ATTEMPTS) return { skipped: true, reason: 'abandoned' }

	schedule.attempts += 1
	schedule.lastAttemptAt = now
	state.schedule = schedule
	writeBackupState(state)

	try {
		const snapshot = await performSnapshot('monthly', schedule.operationId)
		const latest = readBackupState()
		latest.schedule = { ...schedule, completed: true, abandoned: false, nextRetryAt: 0, lastSuccessAt: snapshot.executedAt }
		writeBackupState(latest)
		return { skipped: false, success: true, snapshot }
	} catch (error) {
		const latest = readBackupState()
		const exhausted = schedule.attempts >= MAX_MONTHLY_ATTEMPTS
		latest.schedule = { ...schedule, completed: false, abandoned: exhausted, nextRetryAt: exhausted ? 0 : now + RETRY_DELAY_MS }
		writeBackupState(latest)
		return { skipped: false, success: false, abandoned: exhausted, status: error.backupStatus || BACKUP_STATUS_FAILED }
	}
}

export function runScheduledBackup(now = Date.now()) {
	if (scheduledBackupPromise) return scheduledBackupPromise
	scheduledBackupPromise = executeScheduledBackup(now).finally(() => { scheduledBackupPromise = null })
	return scheduledBackupPromise
}

function normalizeCloudSnapshot(item) {
	return {
		id: String(item.id || ''),
		executedAt: Number(item.createdAt) || 0,
		capturedAt: Number(item.capturedAt) || 0,
		type: item.type === 'manual' ? 'manual' : 'monthly',
		status: BACKUP_STATUS_SUCCESS,
		statusText: '快照成功',
		counts: item.counts && typeof item.counts === 'object' ? item.counts : {},
		selectable: true
	}
}

export async function fetchCloudSnapshotHistory() {
	const syncCode = readBackupSyncCode()
	if (!syncCode) throw backupError('SYNC_CODE_REQUIRED', '请先由超级管理员设置4位同步码')
	const result = await remoteBackupService().listSnapshots({ syncCode })
	const snapshots = Array.isArray(result && result.snapshots) ? result.snapshots.map(normalizeCloudSnapshot).filter((item) => item.id) : []
	if (snapshots.length) rememberSuccess(syncCode, snapshots[0].executedAt)
	return snapshots
}

function storageEntry(key) {
	let keys = []
	try { const info = uni.getStorageInfoSync(); keys = Array.isArray(info && info.keys) ? info.keys : [] } catch (error) {}
	return { exists: keys.includes(key), value: clone(uni.getStorageSync(key)) }
}

function writeStorageEntry(key, entry) {
	if (entry && entry.exists) uni.setStorageSync(key, clone(entry.value))
	else uni.removeStorageSync(key)
}

function restorePreviousEntries(entries) {
	Object.keys(entries || {}).forEach((key) => writeStorageEntry(key, entries[key]))
}

export function recoverInterruptedRestore() {
	const journal = uni.getStorageSync(RESTORE_JOURNAL_STORAGE_KEY)
	if (!journal || typeof journal !== 'object' || !journal.previous) return false
	restorePreviousEntries(journal.previous)
	uni.removeStorageSync(RESTORE_JOURNAL_STORAGE_KEY)
	return true
}

function validateRestorePayload(payload) {
	if (!payload || payload.schemaVersion !== SNAPSHOT_SCHEMA_VERSION || !payload.data || typeof payload.data !== 'object') {
		throw backupError('INVALID_SNAPSHOT', '快照格式无效或版本不受支持')
	}
	if (!Array.isArray(payload.data.tasks) || !Array.isArray(payload.data.cycles) || !Array.isArray(payload.data.weeklyHistory)) {
		throw backupError('INVALID_SNAPSHOT', '快照数据不完整')
	}
	const data = clone(payload.data)
	if (!data.preferences || typeof data.preferences !== 'object' || Array.isArray(data.preferences)) data.preferences = {}
	return data
}

function applyRestoreData(data) {
	const previous = {
		[TASKS_STORAGE_KEY]: storageEntry(TASKS_STORAGE_KEY),
		[LEGACY_TASKS_STORAGE_KEY]: storageEntry(LEGACY_TASKS_STORAGE_KEY),
		[CYCLES_STORAGE_KEY]: storageEntry(CYCLES_STORAGE_KEY),
		[WEEKLY_HISTORY_STORAGE_KEY]: storageEntry(WEEKLY_HISTORY_STORAGE_KEY),
		[STARTUP_MODULE_STORAGE_KEY]: storageEntry(STARTUP_MODULE_STORAGE_KEY),
		[CARD_ROW_HEIGHTS_STORAGE_KEY]: storageEntry(CARD_ROW_HEIGHTS_STORAGE_KEY)
	}
	uni.setStorageSync(RESTORE_JOURNAL_STORAGE_KEY, { createdAt: Date.now(), previous })
	try {
		uni.setStorageSync(TASKS_STORAGE_KEY, clone(data.tasks))
		uni.setStorageSync(LEGACY_TASKS_STORAGE_KEY, clone(data.tasks))
		uni.setStorageSync(CYCLES_STORAGE_KEY, clone(data.cycles))
		uni.setStorageSync(WEEKLY_HISTORY_STORAGE_KEY, clone(data.weeklyHistory))
		if (data.preferences.startupModule) uni.setStorageSync(STARTUP_MODULE_STORAGE_KEY, clone(data.preferences.startupModule))
		else uni.removeStorageSync(STARTUP_MODULE_STORAGE_KEY)
		if (data.preferences.cardRowHeights && typeof data.preferences.cardRowHeights === 'object') uni.setStorageSync(CARD_ROW_HEIGHTS_STORAGE_KEY, clone(data.preferences.cardRowHeights))
		else uni.removeStorageSync(CARD_ROW_HEIGHTS_STORAGE_KEY)
		if (!Array.isArray(uni.getStorageSync(TASKS_STORAGE_KEY)) || !Array.isArray(uni.getStorageSync(CYCLES_STORAGE_KEY))) {
			throw backupError('RESTORE_WRITE_FAILED', '恢复数据写入后校验失败')
		}
		uni.removeStorageSync(RESTORE_JOURNAL_STORAGE_KEY)
	} catch (error) {
		restorePreviousEntries(previous)
		uni.removeStorageSync(RESTORE_JOURNAL_STORAGE_KEY)
		throw error
	}
}

export async function restoreCloudSnapshot(snapshotId) {
	const syncCode = readBackupSyncCode()
	if (!syncCode) throw backupError('SYNC_CODE_REQUIRED', '请先由超级管理员设置4位同步码')
	const result = await remoteBackupService().getSnapshot({ syncCode, snapshotId })
	const data = validateRestorePayload(result && result.payload)
	applyRestoreData(data)
	return { counts: { tasks: data.tasks.length, cycles: data.cycles.length, weeklyHistory: data.weeklyHistory.length } }
}

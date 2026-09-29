const crypto = require('crypto')

const db = uniCloud.database()
const command = db.command
const snapshots = db.collection('daylist-backup-snapshots')
const MAX_SUCCESSFUL_SNAPSHOTS = 12
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024

function appError(code, message) {
	const error = new Error(`${code}: ${message}`)
	error.errCode = code
	return error
}

function requireSyncCode(input) {
	const code = typeof input === 'string' ? input.trim() : ''
	if (!/^\d{4}$/.test(code)) throw appError('INVALID_SYNC_CODE', '同步码必须为4位数字')
	return code
}

function syncCodeHash(code) { return crypto.createHash('sha256').update(`daylist-backup-v1:${code}`).digest('hex') }
function contentHash(value) { return crypto.createHash('sha256').update(value).digest('hex') }

function requireSnapshotType(input) {
	if (!['monthly', 'manual'].includes(input)) throw appError('INVALID_SNAPSHOT_TYPE', '快照类型无效')
	return input
}

function requireOperationId(input) {
	const value = typeof input === 'string' ? input.trim() : ''
	if (!/^[A-Za-z0-9_-]{8,100}$/.test(value)) throw appError('INVALID_OPERATION_ID', '快照操作标识无效')
	return value
}

function normalizePayload(input) {
	if (!input || typeof input !== 'object' || input.schemaVersion !== 1 || !input.data || typeof input.data !== 'object') {
		throw appError('INVALID_SNAPSHOT', '快照格式无效')
	}
	if (!Array.isArray(input.data.tasks) || !Array.isArray(input.data.cycles) || !Array.isArray(input.data.weeklyHistory)) {
		throw appError('INVALID_SNAPSHOT', '快照数据不完整')
	}
	return input
}

function snapshotMetadata(record) {
	return {
		id: record._id,
		type: record.snapshot_type,
		capturedAt: record.captured_at,
		createdAt: record.created_at,
		counts: {
			tasks: Number(record.task_count) || 0,
			cycles: Number(record.cycle_count) || 0,
			weeklyHistory: Number(record.weekly_history_count) || 0
		}
	}
}

async function removeSnapshotsBeyondRetention(codeHash, protectedSnapshotId) {
	while (true) {
		const result = await snapshots.where({ sync_code_hash: codeHash }).orderBy('created_at', 'desc').limit(100).get()
		const records = result.data || []
		const keepIds = []
		if (protectedSnapshotId) keepIds.push(protectedSnapshotId)
		for (const record of records) {
			if (keepIds.length >= MAX_SUCCESSFUL_SNAPSHOTS) break
			if (!keepIds.includes(record._id)) keepIds.push(record._id)
		}
		const staleIds = records.filter((item) => !keepIds.includes(item._id)).map((item) => item._id)
		if (!staleIds.length) return
		await snapshots.where({ _id: command.in(staleIds) }).remove()
	}
}

module.exports = {
	async createSnapshot(payload = {}) {
		const codeHash = syncCodeHash(requireSyncCode(payload.syncCode))
		const snapshotType = requireSnapshotType(payload.type)
		const operationId = requireOperationId(payload.operationId)
		const snapshotPayload = normalizePayload(payload.payload)
		const payloadJson = JSON.stringify(snapshotPayload)
		const payloadBytes = Buffer.byteLength(payloadJson, 'utf8')
		if (payloadBytes > MAX_PAYLOAD_BYTES) throw appError('SNAPSHOT_TOO_LARGE', '快照数据超过单次云端备份上限')

		const payloadHash = contentHash(payloadJson)
		const snapshotId = contentHash(`${codeHash}:${operationId}`)
		const existing = await snapshots.doc(snapshotId).get()
		if (existing.data && existing.data[0]) {
			await removeSnapshotsBeyondRetention(codeHash, snapshotId)
			return { snapshot: snapshotMetadata(existing.data[0]), duplicate: true }
		}

		const now = Date.now()
		const record = {
			sync_code_hash: codeHash,
			snapshot_type: snapshotType,
			schema_version: 1,
			captured_at: Number(snapshotPayload.capturedAt) || now,
			created_at: now,
			payload_hash: payloadHash,
			payload_bytes: payloadBytes,
			payload_json: payloadJson,
			task_count: snapshotPayload.data.tasks.length,
			cycle_count: snapshotPayload.data.cycles.length,
			weekly_history_count: snapshotPayload.data.weeklyHistory.length
		}
		await snapshots.doc(snapshotId).set(record)
		await removeSnapshotsBeyondRetention(codeHash, snapshotId)
		return { snapshot: snapshotMetadata({ _id: snapshotId, ...record }), duplicate: false }
	},

	async listSnapshots(payload = {}) {
		const codeHash = syncCodeHash(requireSyncCode(payload.syncCode))
		const result = await snapshots.where({ sync_code_hash: codeHash }).orderBy('created_at', 'desc').limit(MAX_SUCCESSFUL_SNAPSHOTS).get()
		return { snapshots: (result.data || []).map(snapshotMetadata) }
	},

	async getSnapshot(payload = {}) {
		const codeHash = syncCodeHash(requireSyncCode(payload.syncCode))
		const snapshotId = typeof payload.snapshotId === 'string' && /^[a-f0-9]{64}$/.test(payload.snapshotId) ? payload.snapshotId : ''
		if (!snapshotId) throw appError('INVALID_SNAPSHOT_ID', '快照标识无效')
		const result = await snapshots.doc(snapshotId).get()
		const record = result.data && result.data[0]
		if (!record || record.sync_code_hash !== codeHash) throw appError('SNAPSHOT_NOT_FOUND', '没有找到对应快照')
		if (contentHash(record.payload_json) !== record.payload_hash) throw appError('SNAPSHOT_CORRUPTED', '云端快照完整性校验失败')
		let parsed
		try { parsed = JSON.parse(record.payload_json) }
		catch (error) { throw appError('SNAPSHOT_CORRUPTED', '云端快照无法解析') }
		return { snapshot: snapshotMetadata(record), payload: parsed }
	}
}

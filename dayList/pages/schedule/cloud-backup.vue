<template>
	<view class="backup-page">
		<view class="page-card">
			<view class="topbar">
				<button class="back-button css-back-button" aria-label="返回" @tap="goBack"><view class="css-back-arrow"></view></button>
				<view class="title-wrap">
					<text class="page-title">云端快照</text>
					<text class="page-subtitle">本地使用 · 云端备份</text>
				</view>
				<view class="topbar-space"></view>
			</view>

			<view v-if="!authorized" class="auth-card">
				<view class="auth-icon"><view class="cloud-mark"></view></view>
				<text class="auth-title">超级管理员验证</text>
				<text class="auth-copy">验证后才能查看快照状态、同步码及恢复数据。</text>
				<input v-model="adminPassword" class="password-input" password inputmode="numeric" maxlength="4" placeholder="请输入超级管理员密码" @input="sanitizePassword" @confirm="verifyAdmin" />
				<text v-if="authError" class="error-text">{{ authError }}</text>
				<button class="primary-button" @tap="verifyAdmin">验证并进入</button>
				<view class="last-success">
					<text class="last-success-text">上次云端快照同步成功：{{ lastSuccessText }}</text>
				</view>
			</view>

			<template v-else>
				<view class="sync-card">
					<view class="section-heading">
						<view><text class="section-title">同步码</text><text class="section-note">在新手机输入同一同步码即可拉取快照</text></view>
						<button class="text-button" :class="{ save: editingSyncCode }" @tap="toggleSyncCodeEdit">{{ syncCodeActionText }}</button>
					</view>
					<view v-if="!editingSyncCode && syncCode" class="sync-code-display">
						<text v-for="(digit, index) in syncCodeDigits" :key="index" class="code-digit">{{ digit }}</text>
					</view>
					<view v-else-if="!editingSyncCode" class="sync-code-empty">尚未设置同步码</view>
					<input v-else v-model="syncCodeDraft" class="sync-code-input" type="number" inputmode="numeric" maxlength="4" focus placeholder="4位数字" @input="sanitizeSyncCode" @confirm="toggleSyncCodeEdit" />
					<text v-if="syncCodeError" class="error-text sync-error">{{ syncCodeError }}</text>
				</view>

				<view class="action-grid">
					<button class="action-button action-upload" :class="{ disabled: !syncCode }" :loading="busyAction === 'manual'" :disabled="!!busyAction || !syncCode" @tap="confirmManualSnapshot">
						<view class="action-icon upload-icon"><view></view></view><text>手动快照</text>
					</button>
					<button class="action-button action-pull" :class="{ disabled: !syncCode }" :loading="busyAction === 'pull'" :disabled="!!busyAction || !syncCode" @tap="confirmPullHistory">
						<view class="action-icon pull-icon"><view></view></view><text>拉取历史快照</text>
					</button>
					<button class="action-button action-restore" :class="{ disabled: !selectedSnapshot }" :loading="busyAction === 'restore'" :disabled="!!busyAction || !selectedSnapshot" @tap="confirmRestore">
						<view class="action-icon restore-icon"><view></view></view><text>恢复数据</text>
					</button>
				</view>

				<view class="history-card">
					<view class="history-header">
						<view><text class="section-title">快照记录</text><text class="section-note">云端近12次成功记录及本机失败记录</text></view>
						<text class="history-count">{{ displayHistory.length }} 条</text>
					</view>
					<view v-if="displayHistory.length" class="history-list">
						<view v-for="item in displayHistory" :key="item.id" class="history-row" :class="{ selectable: item.selectable, selected: selectedSnapshotId === item.id }" @tap="selectSnapshot(item)">
							<view class="radio" :class="{ checked: selectedSnapshotId === item.id, disabled: !item.selectable }"><view></view></view>
							<view class="history-main">
								<text class="history-time">{{ formatDateTime(item.executedAt) }}</text>
								<text class="history-type">{{ typeText(item.type) }}{{ item.message ? ' · ' + item.message : '' }}</text>
							</view>
							<text class="status-pill" :class="`status-${item.status}`">{{ item.statusText }}</text>
						</view>
					</view>
					<view v-else class="history-empty">
						<text>尚未拉取云端历史快照</text>
						<text class="empty-note">本机发生的快照失败记录也会显示在这里</text>
					</view>
				</view>

				<view class="schedule-note">
					<text class="schedule-title">自动快照规则</text>
					<text>每月3日 08:00 后首次启动或回到前台时执行。失败后每隔1天重试，连续失败3次后跳过本月。</text>
				</view>
			</template>
		</view>
	</view>
</template>

<script>
	import {
		createManualSnapshot,
		fetchCloudSnapshotHistory,
		getBackupOverview,
		getLocalBackupAttempts,
		restoreCloudSnapshot,
		saveBackupSyncCode
	} from '../../modules/backup/services/cloud-backup-service.js'

	const SUPER_ADMIN_PASSWORD = '6787'

	export default {
		data() {
			return {
				authorized: false,
				adminPassword: '',
				authError: '',
				syncCode: '',
				syncCodeDraft: '',
				editingSyncCode: false,
				syncCodeError: '',
				lastSuccessAt: 0,
				cloudHistory: [],
				localHistory: [],
				selectedSnapshotId: '',
				busyAction: ''
			}
		},
		computed: {
			lastSuccessText() {
				return this.lastSuccessAt ? this.formatDateTime(this.lastSuccessAt) : '暂无成功记录'
			},
			syncCodeDigits() { return String(this.syncCode || '').slice(0, 4).split('') },
			syncCodeActionText() { return this.editingSyncCode ? '保存' : (this.syncCode ? '修改' : '设置') },
			displayHistory() {
				return [...this.cloudHistory, ...this.localHistory].sort((a, b) => Number(b.executedAt) - Number(a.executedAt))
			},
			selectedSnapshot() {
				return this.cloudHistory.find((item) => item.id === this.selectedSnapshotId && item.selectable) || null
			}
		},
		onLoad() { this.refreshOverview() },
		methods: {
			goBack() {
				const pages = getCurrentPages()
				if (pages.length > 1) uni.navigateBack()
				else uni.reLaunch({ url: '/pages/schedule/index' })
			},
			refreshOverview() {
				const overview = getBackupOverview()
				this.syncCode = overview.syncCode
				this.syncCodeDraft = overview.syncCode
				this.lastSuccessAt = overview.lastSuccessAt
				if (this.authorized) this.localHistory = getLocalBackupAttempts(overview.syncCode)
			},
			sanitizePassword(event) {
				this.adminPassword = String(event.detail.value || '').replace(/\D/g, '').slice(0, 4)
				this.authError = ''
			},
			verifyAdmin() {
				if (this.adminPassword !== SUPER_ADMIN_PASSWORD) {
					this.authError = '超级管理员密码不正确'
					return
				}
				this.authorized = true
				this.adminPassword = ''
				this.refreshOverview()
			},
			sanitizeSyncCode(event) {
				this.syncCodeDraft = String(event.detail.value || '').replace(/\D/g, '').slice(0, 4)
				this.syncCodeError = ''
			},
			toggleSyncCodeEdit() {
				if (!this.editingSyncCode) {
					this.syncCodeDraft = this.syncCode
					this.syncCodeError = ''
					this.editingSyncCode = true
					return
				}
				try {
					this.syncCode = saveBackupSyncCode(this.syncCodeDraft)
					this.editingSyncCode = false
					this.cloudHistory = []
					this.selectedSnapshotId = ''
					this.refreshOverview()
					uni.showToast({ title: '同步码已保存', icon: 'success' })
				} catch (error) {
					this.syncCodeError = '同步码必须是4位数字'
				}
			},
			confirmDialog(title, content, confirmText = '再次确认', confirmColor = '#6f46e8') {
				return new Promise((resolve) => {
					uni.showModal({ title, content, confirmText, confirmColor, cancelText: '取消', success: ({ confirm }) => resolve(!!confirm), fail: () => resolve(false) })
				})
			},
			async confirmManualSnapshot() {
				if (this.busyAction) return
				const confirmed = await this.confirmDialog('创建手动快照？', `将使用同步码 ${this.syncCode} 把当前本地数据保存为一份不可变云端快照，并计入云端近12次记录。`, '确认快照')
				if (!confirmed) return
				this.busyAction = 'manual'
				try {
					const snapshot = await createManualSnapshot()
					this.cloudHistory = [snapshot, ...this.cloudHistory.filter((item) => item.id !== snapshot.id)].slice(0, 12)
					this.lastSuccessAt = snapshot.executedAt
					this.localHistory = getLocalBackupAttempts(this.syncCode)
					uni.showToast({ title: '快照成功', icon: 'success' })
				} catch (error) {
					this.localHistory = getLocalBackupAttempts(this.syncCode)
					uni.showToast({ title: this.errorMessage(error, '快照失败'), icon: 'none', duration: 2600 })
				} finally { this.busyAction = '' }
			},
			async confirmPullHistory() {
				if (this.busyAction) return
				const confirmed = await this.confirmDialog('拉取历史快照？', `将使用同步码 ${this.syncCode} 从云端读取近12次快照成功记录。`, '确认拉取')
				if (!confirmed) return
				this.busyAction = 'pull'
				try {
					this.cloudHistory = await fetchCloudSnapshotHistory()
					this.localHistory = getLocalBackupAttempts(this.syncCode)
					this.selectedSnapshotId = this.cloudHistory.some((item) => item.id === this.selectedSnapshotId) ? this.selectedSnapshotId : ''
					this.refreshOverview()
					uni.showToast({ title: `已拉取${this.cloudHistory.length}条`, icon: 'none' })
				} catch (error) {
					uni.showToast({ title: this.errorMessage(error, '拉取失败'), icon: 'none', duration: 2600 })
				} finally { this.busyAction = '' }
			},
			selectSnapshot(item) {
				if (!item.selectable) return
				this.selectedSnapshotId = this.selectedSnapshotId === item.id ? '' : item.id
			},
			async confirmRestore() {
				const snapshot = this.selectedSnapshot
				if (!snapshot || this.busyAction) return
				const time = this.formatDateTime(snapshot.executedAt)
				const confirmed = await this.confirmDialog('恢复历史快照？', `正在恢复 ${time} 的数据。恢复会用该快照替换当前日程、周期和每周统计，本地部分数据可能丢失，请再次确认是否继续。`, '确认恢复', '#e6525c')
				if (!confirmed) return
				this.busyAction = 'restore'
				try {
					await restoreCloudSnapshot(snapshot.id)
					uni.showToast({ title: '恢复成功', icon: 'success', duration: 1200 })
					setTimeout(() => uni.reLaunch({ url: '/pages/schedule/index' }), 900)
				} catch (error) {
					this.busyAction = ''
					uni.showToast({ title: this.errorMessage(error, '恢复失败'), icon: 'none', duration: 2800 })
				}
			},
			formatDateTime(timestamp) {
				const date = new Date(Number(timestamp))
				if (!Number.isFinite(date.getTime())) return '时间未知'
				const pad = (value) => String(value).padStart(2, '0')
				return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`
			},
			typeText(type) { return type === 'manual' ? '手动快照' : '月度快照' },
			errorMessage(error, fallback) {
				const message = String(error && (error.errMsg || error.message) || '')
				if (/资源不足|quota|over.?limit|resource.?exhaust/i.test(message)) return '云资源不足'
				const cleaned = message.replace(/^[A-Z0-9_-]+:\s*/i, '')
				return cleaned && cleaned.length <= 32 ? cleaned : fallback
			}
		}
	}
</script>

<style>
	.backup-page { min-height:100vh; background:radial-gradient(circle at 91% 2%,rgba(107,73,224,.15),transparent 23%),radial-gradient(circle at 4% 44%,rgba(62,160,232,.08),transparent 20%),linear-gradient(180deg,#fbfaff,#f6f7fc); color:#252634; }
	.page-card { width:100%; max-width:430px; min-height:100vh; margin:0 auto; padding:calc(var(--status-bar-height,0px) + 24rpx) 24rpx calc(50rpx + env(safe-area-inset-bottom)); }
	.topbar { display:flex; min-height:90rpx; align-items:center; margin-bottom:25rpx; }
	.back-button { display:flex; width:68rpx; height:68rpx; margin:0; padding:0 0 10rpx; align-items:center; justify-content:center; border-radius:50%; background:rgba(255,255,255,.78); box-shadow:0 8rpx 22rpx rgba(65,52,104,.06); color:#252632; font-size:58rpx; font-weight:260; line-height:58rpx; }
	.title-wrap { display:flex; min-width:0; flex:1; align-items:center; flex-direction:column; }
	.page-title { font-size:34rpx; font-weight:730; } .page-subtitle { margin-top:3rpx; color:#9292a0; font-size:24rpx; }
	.topbar-space { width:68rpx; }
	.auth-card,.sync-card,.history-card,.schedule-note { border:1rpx solid rgba(91,74,143,.13); border-radius:28rpx; background:rgba(255,255,255,.92); box-shadow:0 15rpx 42rpx rgba(68,51,108,.065); }
	.auth-card { display:flex; margin-top:65rpx; padding:40rpx 29rpx 29rpx; align-items:center; flex-direction:column; }
	.auth-icon { display:flex; width:96rpx; height:96rpx; margin-bottom:22rpx; align-items:center; justify-content:center; border-radius:31rpx; background:linear-gradient(145deg,#8156f0,#6036d8); box-shadow:0 15rpx 32rpx rgba(96,54,216,.22); }
	.cloud-mark { position:relative; width:50rpx; height:28rpx; border:6rpx solid #fff; border-top:0; border-radius:0 0 20rpx 20rpx; }
	.cloud-mark::before { content:''; position:absolute; left:1rpx; top:-18rpx; width:26rpx; height:26rpx; border:6rpx solid #fff; border-right-color:transparent; border-bottom-color:transparent; border-radius:50%; transform:rotate(22deg); }
	.cloud-mark::after { content:''; position:absolute; right:-2rpx; top:-12rpx; width:20rpx; height:20rpx; border:6rpx solid #fff; border-left-color:transparent; border-bottom-color:transparent; border-radius:50%; transform:rotate(-18deg); }
	.auth-title { font-size:33rpx; font-weight:720; } .auth-copy { margin:11rpx 5rpx 27rpx; color:#77788a; font-size:24rpx; line-height:1.6; text-align:center; }
	.password-input,.sync-code-input { width:100%; height:84rpx; padding:0 22rpx; border:2rpx solid rgba(100,77,165,.16); border-radius:19rpx; background:#f8f7fb; color:#292a37; font-size:27rpx; text-align:center; }
	.error-text { display:block; width:100%; margin:12rpx 3rpx 0; color:#df414b; font-size:24rpx; text-align:left; }
	.primary-button { display:flex; width:100%; height:84rpx; margin:19rpx 0 0; align-items:center; justify-content:center; border-radius:21rpx; background:linear-gradient(145deg,#8257f3,#6037d9); box-shadow:0 13rpx 30rpx rgba(96,55,217,.2); color:#fff; font-size:27rpx; font-weight:650; }
	.last-success { display:flex; width:100%; margin-top:27rpx; padding-top:23rpx; justify-content:center; border-top:1rpx solid #eeecf3; }
	.last-success-text { color:#252634; font-size:27rpx; font-weight:500; line-height:1.55; text-align:center; }
	.sync-card { padding:27rpx 25rpx 26rpx; }
	.section-heading,.history-header { display:flex; align-items:flex-start; justify-content:space-between; gap:15rpx; }
	.section-heading>view,.history-header>view { display:flex; min-width:0; flex-direction:column; }
	.section-title { color:#292a38; font-size:29rpx; font-weight:720; } .section-note { margin-top:6rpx; color:#8b8c9c; font-size:24rpx; line-height:1.45; }
	.text-button { min-width:86rpx; height:55rpx; margin:0; padding:0 17rpx; border-radius:15rpx; background:#f0ebff; color:#6b43dd; font-size:24rpx; line-height:55rpx; }
	.text-button.save { background:#6f46e8; color:#fff; }
	.sync-code-display { display:flex; margin-top:24rpx; justify-content:center; gap:15rpx; }
	.code-digit { display:flex; width:70rpx; height:82rpx; align-items:center; justify-content:center; border:1rpx solid rgba(111,70,232,.17); border-radius:18rpx; background:linear-gradient(145deg,#faf8ff,#f0ebff); color:#5632c2; font-size:38rpx; font-weight:730; }
	.sync-code-empty { display:flex; height:82rpx; margin-top:24rpx; align-items:center; justify-content:center; border:1rpx dashed rgba(111,70,232,.22); border-radius:18rpx; background:#faf9fd; color:#9898a7; font-size:24rpx; }
	.sync-code-input { margin-top:22rpx; letter-spacing:18rpx; text-indent:18rpx; font-size:35rpx; font-weight:700; }
	.sync-error { margin-top:11rpx; }
	.action-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:13rpx; margin:21rpx 0; }
	.action-button { display:flex; min-height:126rpx; margin:0; padding:18rpx 7rpx 14rpx; align-items:center; justify-content:center; flex-direction:column; border:1rpx solid rgba(96,75,147,.11); border-radius:23rpx; background:rgba(255,255,255,.92); box-shadow:0 10rpx 28rpx rgba(65,50,104,.05); color:#3b3c4a; font-size:24rpx; line-height:1.25; }
	.action-button[disabled],.action-button.disabled { opacity:.48; }
	.action-icon { position:relative; width:51rpx; height:44rpx; margin-bottom:10rpx; color:#6f46e8; }
	.upload-icon::before,.pull-icon::before,.restore-icon::before { content:''; position:absolute; left:7rpx; bottom:2rpx; width:35rpx; height:23rpx; border:4rpx solid currentColor; border-top:0; border-radius:0 0 8rpx 8rpx; }
	.upload-icon view,.pull-icon view { position:absolute; left:23rpx; top:2rpx; width:5rpx; height:27rpx; border-radius:3rpx; background:currentColor; }
	.upload-icon view::before,.pull-icon view::before { content:''; position:absolute; left:-6rpx; top:0; width:12rpx; height:12rpx; border-top:5rpx solid currentColor; border-left:5rpx solid currentColor; transform:rotate(45deg); }
	.pull-icon { color:#278ebf; } .pull-icon view { transform:rotate(180deg); }
	.restore-icon { color:#e56d2a; }
	.restore-icon view { position:absolute; left:16rpx; top:4rpx; width:24rpx; height:24rpx; border:5rpx solid currentColor; border-left-color:transparent; border-radius:50%; }
	.restore-icon view::after { content:''; position:absolute; left:-6rpx; top:-5rpx; width:9rpx; height:9rpx; border-left:4rpx solid currentColor; border-bottom:4rpx solid currentColor; transform:rotate(12deg); }
	.history-card { padding:26rpx 22rpx 22rpx; }
	.history-count { flex:0 0 auto; padding:8rpx 13rpx; border-radius:15rpx; background:#f1eef8; color:#77748a; font-size:24rpx; }
	.history-list { margin-top:21rpx; overflow:hidden; border:1rpx solid #eeecf3; border-radius:19rpx; }
	.history-row { display:flex; min-height:91rpx; padding:16rpx 14rpx; align-items:center; border-bottom:1rpx solid #eeecf3; background:#fff; gap:13rpx; }
	.history-row:last-child { border-bottom:0; } .history-row.selectable:active,.history-row.selected { background:#faf8ff; }
	.radio { display:flex; flex:0 0 auto; width:31rpx; height:31rpx; align-items:center; justify-content:center; border:3rpx solid #bab8c5; border-radius:50%; }
	.radio.checked { border-color:#6f46e8; } .radio.checked view { width:17rpx; height:17rpx; border-radius:50%; background:#6f46e8; }
	.radio.disabled { border-color:#dddce3; background:#f3f2f5; }
	.history-main { display:flex; min-width:0; flex:1; flex-direction:column; }
	.history-time { color:#343543; font-size:24rpx; font-weight:650; } .history-type { margin-top:5rpx; overflow:hidden; color:#8a8b9a; font-size:24rpx; line-height:1.4; text-overflow:ellipsis; white-space:nowrap; }
	.status-pill { flex:0 0 auto; padding:7rpx 10rpx; border-radius:13rpx; font-size:24rpx; font-weight:650; }
	.status-success { background:#e6f7eb; color:#239849; } .status-failed { background:#ffeaec; color:#d74650; } .status-resource_limit { background:#fff0dc; color:#d46b19; }
	.history-empty { display:flex; min-height:245rpx; margin-top:20rpx; align-items:center; justify-content:center; flex-direction:column; border-radius:20rpx; background:#faf9fc; color:#797a8c; font-size:24rpx; }
	.empty-note { margin-top:7rpx; color:#aaa9b5; font-size:24rpx; }
	.schedule-note { display:flex; margin-top:21rpx; padding:22rpx 24rpx; flex-direction:column; background:rgba(244,241,255,.88); box-shadow:none; color:#747486; font-size:24rpx; line-height:1.6; }
	.schedule-title { margin-bottom:5rpx; color:#5a3fc0; font-size:24rpx; font-weight:680; }
	@media (min-width:700px) { .backup-page { padding:35px 0; } .page-card { min-height:calc(100vh - 70px); border-radius:30px; background:rgba(250,249,253,.72); box-shadow:0 24px 80px rgba(54,42,92,.12); } }
</style>

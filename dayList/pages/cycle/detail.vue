<template>
	<view class="detail-shell">
		<view class="detail-content">
			<view class="detail-header">
				<button class="detail-back" aria-label="返回" @tap="goBack">‹</button>
				<view v-if="cycle" class="detail-heading"><view class="detail-icon">{{ cycle.icon }}</view><text class="detail-title">{{ cycle.title }}</text></view>
				<view v-else class="detail-heading"><text class="detail-title">周期详情</text></view>
				<view v-if="cycle && !cycle.archived" class="detail-actions">
					<button class="detail-more" :disabled="mutationBusy" aria-label="停用周期项目" @tap="confirmArchive"><view></view><view></view><view></view></button>
					<button class="detail-edit" :disabled="mutationBusy" aria-label="修改周期项目" @tap="openProjectEditor"><view class="detail-edit-glyph"><view></view></view></button>
				</view>
				<view v-else class="header-spacer"></view>
			</view>

			<view v-if="loading" class="detail-loading"><view class="loading-dot"></view><text>读取中…</text></view>
			<view v-else-if="error" class="detail-error" @tap="loadCycle"><text>{{ error }}</text><text>点击重试</text></view>
			<template v-else-if="cycle">
				<view v-if="cycle.checkin_description" class="detail-description-card"><text class="detail-description-label">打卡说明</text><text class="detail-description-text">{{ cycle.checkin_description }}</text></view>
				<view class="detail-stats-card">
					<view class="detail-stat-side"><text>上次打卡</text><text>{{ formatFullDate(lastDate) }}</text></view>
					<view class="detail-days-stat">
						<template v-if="lastDate"><view><text class="detail-days-number">{{ daysAgo }}</text><text class="detail-days-unit">天前</text></view><text>距今天</text></template>
						<template v-else><text class="detail-no-record">还未打卡</text><text>距今天</text></template>
					</view>
					<view class="detail-stat-side right" :class="{ due: nextDateDue }"><text>预计下次</text><text>{{ nextDateText }}</text></view>
				</view>

				<view class="detail-calendar-card">
					<view class="calendar-header">
						<button class="month-button" aria-label="上个月" @tap="changeMonth(-1)"><view class="month-chevron left"></view></button>
						<text>{{ calendarTitle }}</text>
						<button class="month-button" aria-label="下个月" @tap="changeMonth(1)"><view class="month-chevron right"></view></button>
					</view>
					<view class="calendar-weekdays"><text v-for="weekday in weekdays" :key="weekday">{{ weekday }}</text></view>
					<view class="calendar-grid">
						<view v-for="day in calendarDays" :key="day.key" class="calendar-day" :class="{ muted: !day.currentMonth, today: day.value === currentDate, completed: cycle.completions.includes(day.value), future: day.value > currentDate && !cycle.completions.includes(day.value) }" @tap="openCheckinEditor(day.value)"><text>{{ day.day }}</text></view>
					</view>
					<view class="calendar-legend"><view></view><text>已打卡日期</text></view>
				</view>

				<view class="history-heading">
					<view><text class="history-title">打卡记录</text><text class="history-count">共 {{ historyRows.length }} 次</text></view>
					<view class="average-pill"><text>平均间隔</text><text>{{ averageIntervalText }}</text></view>
				</view>
				<view v-if="historyRows.length === 0" class="history-empty"><view class="empty-check"></view><text>还没有打卡记录</text><text>回到周期主页即可快速打卡</text></view>
				<view v-else class="history-list">
					<view v-for="row in historyRows" :key="row.date" class="history-row">
						<view class="history-line"><view class="history-dot"></view></view>
						<view class="history-copy">
							<text class="history-date">{{ formatFullDate(row.date) }}</text>
							<text v-if="row.note" class="history-note">{{ row.note }}</text>
						</view>
						<text class="history-gap">{{ row.interval === null ? '首次打卡' : `距上次 ${row.interval} 天` }}</text>
					</view>
				</view>
			</template>
		</view>
		<cycle-project-editor :visible="projectEditorOpen" :cycle="cycle" :busy="mutationBusy" @close="closeProjectEditor" @save="saveProjectEditor" />
		<cycle-checkin-editor :visible="checkinEditorOpen" :date="checkinEditorDate" :note="checkinEditorNote" :completed="selectedDateCompleted" :allow-remove="true" :busy="checkinMutationBusy" @close="closeCheckinEditor" @save="saveSelectedCompletion" @remove="confirmRemoveCompletion" />
	</view>
</template>

<script>
	import { cycleDataService } from '../../modules/cycle/services/cycle-data-service.js'
	import CycleCheckinEditor from '../../modules/cycle/components/CycleCheckinEditor.vue'
	import CycleProjectEditor from '../../modules/cycle/components/CycleProjectEditor.vue'
	import { daysBetween, expectedNextDate, formatFullDate, isExpectedDateDue, lastCompletion, localDateString, monthDaysFor, parseLocalDate } from '../../modules/cycle/utils/cycle-date.js'
	import { queueCycleFeedback, showCancelCheckinConfirm, showCycleFeedback } from '../../modules/cycle/utils/cycle-feedback.js'

	export default {
		components: { CycleCheckinEditor, CycleProjectEditor },
		data() {
			return { cycleId: '', cycle: null, loading: true, mutationBusy: false, error: '', currentDate: localDateString(), calendarCursor: localDateString(), weekdays: ['一', '二', '三', '四', '五', '六', '日'], hasLoaded: false, projectEditorOpen: false, checkinEditorOpen: false, checkinEditorDate: '', checkinEditorNote: '', checkinMutationBusy: false }
		},
		computed: {
			lastDate() { return lastCompletion(this.cycle) },
			daysAgo() { return this.lastDate ? daysBetween(this.lastDate, this.currentDate) : '' },
			nextDateDue() { return isExpectedDateDue(this.cycle, this.currentDate) },
			nextDateText() {
				if (!this.cycle.interval_value) return '未设置'
				const next = expectedNextDate(this.cycle)
				return next ? formatFullDate(next) : '打卡后计算'
			},
			calendarTitle() { const date = parseLocalDate(this.calendarCursor); return `${date.getFullYear()}年 ${date.getMonth() + 1}月` },
			calendarDays() { return monthDaysFor(this.calendarCursor, true) },
			selectedDateCompleted() { return Boolean(this.cycle && this.cycle.completions.includes(this.checkinEditorDate)) },
			historyRows() {
				if (!this.cycle) return []
				const ascending = [...this.cycle.completions].sort()
				return ascending.map((date, index) => ({ date, interval: index ? daysBetween(ascending[index - 1], date) : null, note: this.cycle.completion_notes[date] || '' })).reverse()
			},
			averageIntervalText() {
				if (!this.cycle || this.cycle.completions.length < 2) return '暂无'
				const dates = [...this.cycle.completions].sort()
				const total = dates.slice(1).reduce((sum, date, index) => sum + daysBetween(dates[index], date), 0)
				const average = total / (dates.length - 1)
				return `${Number.isInteger(average) ? average : average.toFixed(1)} 天`
			}
		},
		onLoad(options) {
			this.cycleId = options && typeof options.id === 'string' ? decodeURIComponent(options.id) : ''
			this.loadCycle()
		},
		onShow() { this.currentDate = localDateString(); if (this.hasLoaded) this.loadCycle() },
		onBackPress(event) {
			if (event && event.from === 'navigateBack') return false
			if (this.projectEditorOpen) { this.projectEditorOpen = false; return true }
			if (this.checkinEditorOpen) { this.checkinEditorOpen = false; return true }
			if (this.previousPageIsCycleHome()) return false
			uni.reLaunch({ url: '/pages/cycle/index' })
			return true
		},
		methods: {
			formatFullDate,
			openProjectEditor() { if (this.cycle && !this.cycle.archived && !this.mutationBusy) this.projectEditorOpen = true },
			closeProjectEditor() { if (!this.mutationBusy) this.projectEditorOpen = false },
			async saveProjectEditor(payload) {
				if (!this.cycle || this.cycle.archived || this.mutationBusy) return
				this.mutationBusy = true
				try {
					await cycleDataService.updateCycle({ id: this.cycle._id, ...payload })
					const result = await cycleDataService.getCycle({ id: this.cycle._id })
					this.cycle = result.cycle; this.projectEditorOpen = false; showCycleFeedback('修改成功')
				} catch (error) { showCycleFeedback(this.errorMessage(error, '修改失败')) }
				finally { this.mutationBusy = false }
			},
			openCheckinEditor(date) {
				if (!this.cycle || this.cycle.archived || this.checkinMutationBusy) return
				const completed = this.cycle.completions.includes(date)
				if (date > this.currentDate && !completed) { showCycleFeedback('未来日期不能补签'); return }
				if (!completed && date < this.currentDate) {
					uni.showModal({
						title: '确认补签？',
						content: `正在补签“${this.cycle.title}”的${formatFullDate(date)}打卡记录，是否确认？`,
						confirmText: '确认补签',
						confirmColor: '#7046e8',
						success: ({ confirm }) => { if (confirm) this.backfillCompletion(date) }
					})
					return
				}
				this.showCheckinEditor(date)
			},
			async backfillCompletion(date) {
				if (!this.cycle || this.cycle.archived || this.cycle.completions.includes(date) || this.checkinMutationBusy) return
				this.checkinMutationBusy = true
				try {
					await cycleDataService.saveCompletion({ id: this.cycle._id, date, note: '' })
					const result = await cycleDataService.getCycle({ id: this.cycle._id }); this.cycle = result.cycle; showCycleFeedback('补签成功')
				} catch (error) { showCycleFeedback(this.errorMessage(error, '补签失败')) }
				finally { this.checkinMutationBusy = false }
			},
			showCheckinEditor(date) {
				this.checkinEditorDate = date; this.checkinEditorNote = this.cycle.completion_notes[date] || ''; this.checkinEditorOpen = true
			},
			closeCheckinEditor() { if (!this.checkinMutationBusy) this.checkinEditorOpen = false },
			async saveSelectedCompletion(note) {
				if (!this.cycle || !this.checkinEditorDate || this.checkinMutationBusy) return
				const wasCompleted = this.selectedDateCompleted
				this.checkinMutationBusy = true
				try {
					await cycleDataService.saveCompletion({ id: this.cycle._id, date: this.checkinEditorDate, note })
					const result = await cycleDataService.getCycle({ id: this.cycle._id }); this.cycle = result.cycle; this.checkinEditorOpen = false; showCycleFeedback(wasCompleted ? '备注已保存' : '补签成功')
				} catch (error) { showCycleFeedback(this.errorMessage(error, wasCompleted ? '备注保存失败' : '补签失败')) }
				finally { this.checkinMutationBusy = false }
			},
			confirmRemoveCompletion() {
				if (!this.selectedDateCompleted || this.checkinMutationBusy) return
				this.checkinEditorOpen = false
				this.$nextTick(() => showCancelCheckinConfirm(formatFullDate(this.checkinEditorDate), () => this.removeSelectedCompletion()))
			},
			async removeSelectedCompletion() {
				if (!this.cycle || !this.checkinEditorDate || this.checkinMutationBusy) return
				this.checkinMutationBusy = true
				try {
					await cycleDataService.removeCompletion({ id: this.cycle._id, date: this.checkinEditorDate })
					const result = await cycleDataService.getCycle({ id: this.cycle._id }); this.cycle = result.cycle; this.checkinEditorOpen = false; showCycleFeedback('已取消打卡')
				} catch (error) { showCycleFeedback(this.errorMessage(error, '取消打卡失败')) }
				finally { this.checkinMutationBusy = false }
			},
			confirmArchive() {
				if (!this.cycle || this.mutationBusy) return
				uni.showModal({ title: '停用周期项目？', content: `“${this.cycle.title}”的打卡记录会保留，可随时恢复。`, confirmText: '停用', confirmColor: '#7046e8', success: ({ confirm }) => { if (confirm) this.archiveCycle() } })
			},
			async archiveCycle() {
				if (!this.cycle || this.mutationBusy) return
				this.mutationBusy = true
				try { await cycleDataService.archiveCycle({ id: this.cycle._id }); queueCycleFeedback('已停用'); this.goBack() }
				catch (error) { showCycleFeedback(this.errorMessage(error, '停用失败')) }
				finally { this.mutationBusy = false }
			},
			async loadCycle() {
				this.loading = true; this.error = ''
				try {
					const result = await cycleDataService.getCycle({ id: this.cycleId })
					this.cycle = result.cycle; this.hasLoaded = true
				} catch (error) { this.error = this.errorMessage(error, '周期详情读取失败') }
				finally { this.loading = false }
			},
			changeMonth(amount) { const date = parseLocalDate(this.calendarCursor); date.setDate(1); date.setMonth(date.getMonth() + amount); this.calendarCursor = localDateString(date) },
			errorMessage(error, fallback) { const message = error && (error.errMsg || error.message); if (!message) return fallback; const clean = String(message).replace(/^[A-Z_]+:\s*/, ''); return clean.length > 45 ? fallback : clean },
			previousPageIsCycleHome() {
				const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : []
				const previousPage = pages.length > 1 ? pages[pages.length - 2] : null
				return Boolean(previousPage && String(previousPage.route || '').replace(/^\/+/, '') === 'pages/cycle/index')
			},
			goBack() {
				if (this.previousPageIsCycleHome()) uni.navigateBack()
				else uni.reLaunch({ url: '/pages/cycle/index' })
			}
		}
	}
</script>

<style>
	.detail-shell { min-height:100vh; background:radial-gradient(circle at 92% 3%,rgba(115,72,232,.13),transparent 21%),radial-gradient(circle at 5% 55%,rgba(242,151,73,.07),transparent 18%),linear-gradient(180deg,#fbfaff 0%,#f7f8fc 100%); }
	.detail-content { width:100%; max-width:430px; min-height:100vh; margin:0 auto; padding:calc(var(--status-bar-height,0px) + 30rpx) 24rpx 60rpx; }
	.detail-header { display:flex; align-items:center; min-height:90rpx; margin-bottom:24rpx; }.detail-back { display:flex; flex:0 0 70rpx; align-items:center; justify-content:center; width:70rpx; height:70rpx; margin:0 80rpx 0 0; padding:0 0 9rpx; border:0 !important; border-radius:50%; background:rgba(255,255,255,.8) !important; box-shadow:0 8rpx 22rpx rgba(77,65,120,.05); color:#252632; font-size:61rpx; font-weight:260; line-height:58rpx; }.detail-back::after { border:0 !important; }.detail-heading { display:flex; min-width:0; flex:1; align-items:center; justify-content:center; gap:11rpx; }.detail-icon { display:flex; flex:0 0 48rpx; align-items:center; justify-content:center; width:48rpx; height:48rpx; border-radius:15rpx; background:#eee9fb; color:#7046e8; font-size:24rpx; }.detail-title { overflow:hidden; max-width:410rpx; color:#292a38; font-size:32rpx; font-weight:730; text-overflow:ellipsis; white-space:nowrap; }.header-spacer { flex:0 0 150rpx; width:150rpx; }.detail-actions { display:flex; flex:0 0 150rpx; gap:10rpx; }.detail-edit,.detail-more { display:flex; flex:0 0 70rpx; align-items:center; justify-content:center; width:70rpx; height:70rpx; margin:0; padding:0; border:1rpx solid rgba(85,73,130,.12) !important; border-radius:50%; background:rgba(255,255,255,.8) !important; box-shadow:0 8rpx 22rpx rgba(77,65,120,.05); }.detail-edit::after,.detail-more::after { border:0 !important; }.detail-edit-glyph { position:relative; width:32rpx; height:9rpx; border-radius:4rpx; background:#171824; transform:rotate(-44deg); }.detail-edit-glyph::before { position:absolute; top:0; left:-8rpx; border-top:4.5rpx solid transparent; border-right:9rpx solid #171824; border-bottom:4.5rpx solid transparent; content:''; }.detail-edit-glyph::after { position:absolute; top:0; right:-6rpx; width:5rpx; height:9rpx; border-left:3rpx solid rgba(255,255,255,.9); border-radius:1rpx 4rpx 4rpx 1rpx; background:#171824; content:''; }.detail-more { gap:5rpx; }.detail-more>view { width:6rpx; height:6rpx; border-radius:50%; background:#777687; }
	.detail-loading { display:flex; align-items:center; justify-content:center; min-height:400rpx; gap:15rpx; color:#858697; font-size:23rpx; }.loading-dot { width:25rpx; height:25rpx; border:4rpx solid rgba(111,70,232,.2); border-top-color:#6f46e8; border-radius:50%; animation:spin .8s linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }.detail-error { display:flex; align-items:center; justify-content:space-between; padding:20rpx 22rpx; border-radius:18rpx; background:#fff1f2; color:#ca424a; font-size:21rpx; }
	.detail-description-card { display:flex; align-items:flex-start; margin-bottom:20rpx; padding:20rpx 22rpx; border:1rpx solid rgba(91,76,133,.1); border-radius:23rpx; background:rgba(255,255,255,.91); box-shadow:0 10rpx 28rpx rgba(58,51,93,.05); }.detail-description-label { flex:0 0 auto; margin-right:16rpx; color:#9897a7; font-size:24rpx; font-weight:650; line-height:36rpx; white-space:nowrap; }.detail-description-text { min-width:0; flex:1; color:#4e4f5e; font-size:24rpx; line-height:36rpx; overflow-wrap:anywhere; white-space:normal; }
	.detail-stats-card { display:grid; grid-template-columns:1fr 140rpx 1fr; align-items:center; min-height:148rpx; margin-bottom:20rpx; padding:20rpx 22rpx; border:1rpx solid rgba(91,76,133,.1); border-radius:27rpx; background:rgba(255,255,255,.91); box-shadow:0 10rpx 28rpx rgba(58,51,93,.05); }.detail-stat-side { display:flex; min-width:0; flex-direction:column; }.detail-stat-side.right { text-align:right; }.detail-stat-side text:first-child { margin-bottom:8rpx; color:#9897a7; font-size:24rpx; }.detail-stat-side text:last-child { color:#4e4f5e; font-size:24rpx; line-height:34rpx; }.detail-days-stat { display:flex; align-items:center; flex-direction:column; justify-content:center; border-right:1rpx solid #e7e3ee; border-left:1rpx solid #e7e3ee; color:#9a99a9; font-size:17rpx; }.detail-days-stat>view { display:flex; align-items:baseline; }.detail-days-number { color:#7046e8; font-size:45rpx; font-weight:790; line-height:50rpx; }.detail-days-unit { margin-left:4rpx; color:#7046e8; font-size:19rpx; font-weight:650; }.detail-no-record { color:#777687; font-size:21rpx; font-weight:650; line-height:50rpx; }
	.detail-stat-side.right.due { margin:-9rpx -10rpx -9rpx 0; padding:9rpx 10rpx; border-radius:17rpx; background:linear-gradient(100deg,rgba(255,244,226,.18),rgba(255,230,194,.82)); box-shadow:inset -4rpx 0 0 #ef5f16; }.detail-stat-side.right.due text:first-child { color:#ef5f16; font-weight:700; }.detail-stat-side.right.due text:last-child { color:#ef5f16; font-weight:780; }
	.detail-calendar-card { margin-bottom:28rpx; padding:24rpx 22rpx 20rpx; border:1rpx solid rgba(91,76,133,.1); border-radius:28rpx; background:rgba(255,255,255,.92); box-shadow:0 10rpx 28rpx rgba(58,51,93,.05); }.calendar-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:18rpx; }.calendar-header>text { color:#353643; font-size:25rpx; font-weight:700; }.month-button { display:flex; align-items:center; justify-content:center; width:56rpx; height:56rpx; margin:0; padding:0; border:0 !important; border-radius:17rpx; background:#f4f2f8 !important; }.month-button::after { border:0 !important; }.month-chevron { width:13rpx; height:13rpx; border-top:3rpx solid #737282; border-right:3rpx solid #737282; }.month-chevron.left { transform:rotate(-135deg); }.month-chevron.right { transform:rotate(45deg); }.calendar-weekdays,.calendar-grid { display:grid; grid-template-columns:repeat(7,1fr); }.calendar-weekdays { margin-bottom:7rpx; color:#aaa8b5; font-size:17rpx; text-align:center; }.calendar-day { position:relative; display:flex; align-items:center; justify-content:center; height:67rpx; color:#575866; font-size:20rpx; cursor:pointer; }.calendar-day>text { display:flex; align-items:center; justify-content:center; width:48rpx; height:48rpx; border:4rpx solid transparent; border-radius:50%; }.calendar-day:active { opacity:.66; }.calendar-day.future { color:#c9c7cf; }.calendar-day.muted { color:#c2c0ca; }.calendar-day.today>text { background:#eee9fb; color:#7046e8; font-weight:700; }.calendar-day.completed>text { border-color:#7046e8; background:transparent; color:#6037d9; font-weight:700; }.calendar-legend { display:flex; align-items:center; justify-content:center; gap:8rpx; margin-top:11rpx; color:#9695a5; font-size:17rpx; }.calendar-legend view { width:17rpx; height:17rpx; border:3rpx solid #7046e8; border-radius:50%; }
	.history-heading { display:flex; align-items:center; justify-content:space-between; margin:0 4rpx 15rpx; }.history-heading>view:first-child { display:flex; align-items:baseline; gap:11rpx; }.history-title { color:#343543; font-size:28rpx; font-weight:720; }.history-count { color:#9a99aa; font-size:18rpx; }.average-pill { display:flex; align-items:baseline; gap:7rpx; padding:11rpx 15rpx; border-radius:16rpx; background:#eee9fb; color:#77738a; font-size:16rpx; }.average-pill text:last-child { color:#7046e8; font-size:20rpx; font-weight:720; }
	.history-list { overflow:hidden; padding:7rpx 20rpx; border:1rpx solid rgba(91,76,133,.1); border-radius:25rpx; background:rgba(255,255,255,.91); }.history-row { display:flex; align-items:center; }.history-line { position:relative; display:flex; min-height:66rpx; align-self:stretch; flex:0 0 34rpx; justify-content:center; }.history-line::before { position:absolute; top:0; bottom:0; left:50%; width:2rpx; background:#e5e0f1; content:''; transform:translateX(-50%); }.history-row:first-child .history-line::before { top:50%; }.history-row:last-child .history-line::before { bottom:50%; }.history-row:only-child .history-line::before { display:none; }.history-dot { position:absolute; z-index:2; top:50%; width:15rpx; height:15rpx; border:4rpx solid #dcd3f7; border-radius:50%; background:#7046e8; transform:translateY(-50%); }.history-copy { display:flex; min-width:0; flex:1; flex-direction:column; padding:14rpx 0; }.history-date { color:#3e3f4d; font-size:27rpx; font-weight:630; }.history-note { margin-top:5rpx; color:#676879; font-size:24rpx; line-height:34rpx; overflow-wrap:anywhere; }.history-gap { flex:0 0 auto; margin-left:16rpx; color:#8b899a; font-size:24rpx; white-space:nowrap; }.history-empty { display:flex; align-items:center; flex-direction:column; justify-content:center; min-height:260rpx; border:1rpx solid rgba(91,76,133,.1); border-radius:25rpx; background:rgba(255,255,255,.75); color:#9695a5; text-align:center; }.history-empty>text:nth-child(2) { margin:15rpx 0 6rpx; color:#4d4e5c; font-size:24rpx; font-weight:650; }.history-empty>text:last-child { font-size:24rpx; }.empty-check { width:38rpx; height:38rpx; border:5rpx solid #cfc9df; border-radius:50%; }
	.detail-title,.history-title { font-size:31rpx; }.detail-days-stat,.calendar-weekdays,.calendar-day,.history-count,.average-pill { font-size:18rpx; }.history-date { font-size:27rpx; }.history-note,.history-gap { font-size:24rpx; }.detail-stat-side text:first-child,.detail-stat-side text:last-child { font-size:24rpx; line-height:34rpx; }.detail-days-number { font-size:31rpx; line-height:38rpx; }.detail-days-unit { font-size:24rpx; line-height:34rpx; }.detail-no-record { font-size:24rpx; line-height:36rpx; }.calendar-header>text,.average-pill text:last-child { font-size:24rpx; }
	@media (min-width:700px) { .detail-shell { padding:35px 0; }.detail-content { min-height:calc(100vh - 70px); border-radius:30px; background:rgba(250,249,253,.72); box-shadow:0 24px 80px rgba(54,42,92,.12); } }
</style>

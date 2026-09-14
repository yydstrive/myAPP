<template>
	<view class="cycle-page-shell">
		<view class="cycle-page-content">
			<view v-if="viewMode === 'active'" class="cycle-topbar">
				<view class="cycle-date-heading">
					<text>{{ headerDate }}</text><text class="cycle-date-dot">·</text><text class="cycle-weekday-heading">{{ headerWeekday }}</text>
				</view>
				<view class="cycle-top-actions">
					<button class="cycle-icon-button" aria-label="查看已停用" @tap="toggleViewMode"><view class="cycle-disabled-glyph"><view></view></view></button>
					<button class="cycle-icon-button cycle-add-button" aria-label="新增周期项目" @tap="openCreateEditor"><view class="cycle-add-plus"></view></button>
				</view>
			</view>

			<view v-else class="cycle-subbar">
				<button class="cycle-back-button" aria-label="返回进行中" @tap="toggleViewMode">‹</button>
				<view><text class="cycle-subbar-title">已停用</text><text class="cycle-subbar-copy">可恢复或永久删除</text></view>
			</view>

			<template v-if="viewMode === 'active'">
				<view v-if="loading" class="cycle-loading"><view class="cycle-loading-dot"></view><text>读取中…</text></view>
				<view v-else-if="activeCycles.length === 0" class="cycle-empty">
					<view class="cycle-empty-mark"><view class="cycle-mobius-icon"><view class="cycle-mobius-loop left"></view><view class="cycle-mobius-loop right"></view><view class="cycle-mobius-twist"></view></view></view>
					<text class="cycle-empty-title">还未创建周期项目</text>
					<text class="cycle-empty-copy">点击右上角的加号，建立第一个周期</text>
				</view>
				<view v-else class="cycle-list">
					<view v-for="cycle in activeCycles" :key="cycle._id" class="cycle-card">
						<view class="cycle-card-header">
							<view class="cycle-name-area" role="button" :aria-label="`查看${cycle.title}详情`" @tap="openDetail(cycle)">
								<view class="cycle-project-icon">{{ cycle.icon }}</view>
								<view class="cycle-title-copy"><text class="cycle-item-title">{{ cycle.title }}</text></view>
								<view class="cycle-chevron"></view>
							</view>
						</view>

						<view class="cycle-card-main">
							<view class="cycle-calendar-wrap">
								<view v-if="cycle.view_mode === 'week'" class="cycle-week-grid">
									<view v-for="day in currentWeekDays" :key="day.value" class="cycle-week-day" :class="{ today: day.value === currentDate, completed: cycle.completions.includes(day.value), editable: day.value === currentDate && cycle.completions.includes(day.value) }" @tap="openTodayNote(cycle, day.value)">
										<text class="cycle-weekday">周{{ day.weekday }}</text><view class="cycle-day-circle"><text>{{ day.dateLabel }}</text></view>
									</view>
								</view>
								<view v-else class="cycle-month-preview">
									<view class="cycle-month-grid">
										<view v-for="day in currentMonthDays" :key="day.key" class="cycle-month-day" :class="{ blank: day.blank, today: day.value === currentDate, completed: !day.blank && cycle.completions.includes(day.value), editable: !day.blank && day.value === currentDate && cycle.completions.includes(day.value) }" @tap="openTodayNote(cycle, day.value)"><text v-if="!day.blank">{{ day.day }}</text></view>
									</view>
								</view>
							</view>
							<button class="cycle-check-button" :class="{ completed: isCompletedToday(cycle) }" :disabled="mutationBusy" @tap="toggleCompletion(cycle)">
								<view class="cycle-check-icon"><view v-if="isCompletedToday(cycle)"></view><text v-else>＋</text></view>
								<text>{{ isCompletedToday(cycle) ? '已打卡' : '打卡' }}</text>
							</button>
						</view>

						<view class="cycle-stats">
							<view class="cycle-stat-side"><text>上次打卡</text><text>{{ formatFullDate(lastDate(cycle)) }}</text></view>
							<view class="cycle-days-stat">
								<template v-if="lastDate(cycle)"><view><text class="cycle-days-number">{{ daysAgo(cycle) }}</text><text class="cycle-days-unit">天前</text></view><text>距今天</text></template>
								<template v-else><text class="cycle-no-record">还未打卡</text><text>距今天</text></template>
							</view>
							<view class="cycle-stat-side right"><text>预计下次</text><text>{{ nextDateText(cycle) }}</text></view>
						</view>
					</view>
				</view>
			</template>

			<template v-else>
				<view v-if="loading" class="cycle-loading"><view class="cycle-loading-dot"></view><text>读取中…</text></view>
				<view v-else-if="archivedCycles.length === 0" class="cycle-empty cycle-archive-empty">
					<view class="cycle-empty-mark"><view class="cycle-disabled-glyph large"><view></view></view></view>
					<text class="cycle-empty-title">没有已停用项目</text>
					<text class="cycle-empty-copy">停用的周期项目会保留在这里</text>
				</view>
				<view v-else class="cycle-archive-list">
					<view v-for="cycle in archivedCycles" :key="cycle._id" class="cycle-archive-item">
						<view class="cycle-project-icon small">{{ cycle.icon }}</view>
						<view class="cycle-archive-copy"><text>{{ cycle.title }}</text><text>{{ viewLabel(cycle) }} · {{ intervalLabel(cycle) }}</text></view>
						<button class="cycle-restore" :disabled="mutationBusy" @tap="restoreCycle(cycle)">恢复</button>
						<button class="cycle-destroy" :disabled="mutationBusy" @tap="confirmDelete(cycle)">永久删除</button>
					</view>
				</view>
			</template>
		</view>

		<cycle-project-editor :visible="editorOpen" :busy="mutationBusy" @close="closeEditor" @save="saveEditor" />
		<cycle-checkin-editor :visible="noteEditorOpen" :date="noteEditorDate" :note="noteEditorNote" :completed="true" :busy="noteMutationBusy" @close="closeNoteEditor" @save="saveTodayNote" />

		<app-bottom-nav active="cycle" />
	</view>
</template>

<script>
	import AppBottomNav from '../../shared/components/AppBottomNav.vue'
	import CycleCheckinEditor from '../../modules/cycle/components/CycleCheckinEditor.vue'
	import CycleProjectEditor from '../../modules/cycle/components/CycleProjectEditor.vue'
	import { cycleDataService } from '../../modules/cycle/services/cycle-data-service.js'
	import { daysBetween, expectedNextDate, formatFullDate, intervalLabel, lastCompletion, localDateString, monthDaysFor, parseLocalDate, weekDaysFor } from '../../modules/cycle/utils/cycle-date.js'
	import { consumeCycleFeedback, showCancelCheckinConfirm, showCycleFeedback } from '../../modules/cycle/utils/cycle-feedback.js'

	export default {
		components: { AppBottomNav, CycleCheckinEditor, CycleProjectEditor },
		data() {
			return {
				cycles: [], loading: true, mutationBusy: false, viewMode: 'active', currentDate: localDateString(), editorOpen: false,
				noteEditorOpen: false, noteEditorCycleId: '', noteEditorDate: '', noteEditorNote: '', noteMutationBusy: false
			}
		},
		computed: {
			headerDate() { const date = parseLocalDate(this.currentDate); return `${date.getMonth() + 1}月${date.getDate()}日` },
			headerWeekday() { return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][parseLocalDate(this.currentDate).getDay()] },
			currentWeekDays() { return weekDaysFor(this.currentDate) },
			currentMonthDays() { return monthDaysFor(this.currentDate) },
			activeCycles() { return this.cycles.filter((cycle) => !cycle.archived).sort((a, b) => (a.created_at || 0) - (b.created_at || 0)) },
			archivedCycles() { return this.cycles.filter((cycle) => cycle.archived).sort((a, b) => (b.archived_at || 0) - (a.archived_at || 0)) },
		},
		onLoad() { this.loadCycles() },
		onShow() { this.currentDate = localDateString(); if (!this.loading) this.loadCycles(); consumeCycleFeedback() },
		onBackPress() {
			if (this.noteEditorOpen) { this.closeNoteEditor(); return true }
			if (this.editorOpen) { this.closeEditor(); return true }
			if (this.viewMode !== 'active') { this.viewMode = 'active'; return true }
			return false
		},
		methods: {
			formatFullDate,
			intervalLabel,
			async loadCycles() {
				this.loading = true
				try { const result = await cycleDataService.listCycles(); this.cycles = result.cycles }
				catch (error) { showCycleFeedback(this.errorMessage(error, '读取周期项目失败')) }
				finally { this.loading = false }
			},
			viewLabel(cycle) { return cycle.view_mode === 'month' ? '月视图' : '周视图' },
			lastDate(cycle) { return lastCompletion(cycle) },
			daysAgo(cycle) { const last = this.lastDate(cycle); return last ? daysBetween(last, this.currentDate) : '' },
			nextDateText(cycle) {
				if (!cycle.interval_value) return '未设置'
				const next = expectedNextDate(cycle)
				return next ? formatFullDate(next) : '打卡后计算'
			},
			isCompletedToday(cycle) { return cycle.completions.includes(this.currentDate) },
			openTodayNote(cycle, date) {
				if (!cycle || date !== this.currentDate || !cycle.completions.includes(date)) return
				this.noteEditorCycleId = cycle._id; this.noteEditorDate = date; this.noteEditorNote = cycle.completion_notes[date] || ''; this.noteEditorOpen = true
			},
			closeNoteEditor() { if (!this.noteMutationBusy) this.noteEditorOpen = false },
			async saveTodayNote(note) {
				if (this.noteMutationBusy || !this.noteEditorCycleId || this.noteEditorDate !== this.currentDate) return
				this.noteMutationBusy = true
				try {
					await cycleDataService.saveCompletion({ id: this.noteEditorCycleId, date: this.noteEditorDate, note })
					const result = await cycleDataService.listCycles(); this.cycles = result.cycles; this.noteEditorOpen = false; showCycleFeedback('备注已保存')
				} catch (error) { showCycleFeedback(this.errorMessage(error, '备注保存失败')) }
				finally { this.noteMutationBusy = false }
			},
			async toggleCompletion(cycle) {
				if (this.mutationBusy) return
				if (this.isCompletedToday(cycle)) {
					showCancelCheckinConfirm(formatFullDate(this.currentDate), () => this.mutate('removeCompletion', { id: cycle._id, date: this.currentDate }, '已取消今日打卡'))
					return
				}
				await this.mutate('toggleCompletion', { id: cycle._id, date: this.currentDate }, '打卡成功')
			},
			toggleViewMode() { this.viewMode = this.viewMode === 'active' ? 'archived' : 'active' },
			openCreateEditor() { this.editorOpen = true },
			closeEditor() { if (!this.mutationBusy) this.editorOpen = false },
			async saveEditor(payload) {
				if (this.mutationBusy) return
				const ok = await this.mutate('createCycle', payload, '创建成功')
				if (ok) this.editorOpen = false
			},
			openDetail(cycle) { uni.navigateTo({ url: `/pages/cycle/detail?id=${encodeURIComponent(cycle._id)}` }) },
			async restoreCycle(cycle) { await this.mutate('restoreCycle', { id: cycle._id }, '恢复成功') },
			confirmDelete(cycle) {
				uni.showModal({ title: '永久删除周期项目？', content: `“${cycle.title}”及全部打卡记录将无法恢复。`, confirmText: '永久删除', confirmColor: '#e94b55', success: ({ confirm }) => { if (confirm) this.mutate('deleteCycle', { id: cycle._id }, '已永久删除') } })
			},
			async mutate(method, payload, successTitle) {
				if (this.mutationBusy) return false
				this.mutationBusy = true
				try { await cycleDataService[method](payload); const result = await cycleDataService.listCycles(); this.cycles = result.cycles; showCycleFeedback(successTitle); return true }
				catch (error) { showCycleFeedback(this.errorMessage(error, '操作失败')); return false }
				finally { this.mutationBusy = false }
			},
			errorMessage(error, fallback) { const message = error && (error.errMsg || error.message); if (!message) return fallback; const clean = String(message).replace(/^[A-Z_]+:\s*/, ''); return clean.length > 45 ? fallback : clean }
		}
	}
</script>

<style>
	.cycle-page-shell { min-height:100vh; background:radial-gradient(circle at 92% 3%,rgba(115,72,232,.13),transparent 21%),radial-gradient(circle at 5% 38%,rgba(242,151,73,.08),transparent 20%),linear-gradient(180deg,#fbfaff 0%,#f7f8fc 100%); }
	.cycle-page-content { width:100%; max-width:430px; min-height:100vh; margin:0 auto; padding:calc(var(--status-bar-height,0px) + 30rpx) 24rpx calc(176rpx + env(safe-area-inset-bottom)); }
	.cycle-topbar { display:flex; align-items:center; justify-content:space-between; min-height:90rpx; margin-bottom:30rpx; }
	.cycle-date-heading { display:flex; align-items:center; gap:11rpx; color:#292a38; font-size:31rpx; font-weight:650; letter-spacing:.5rpx; line-height:46rpx; }.cycle-date-dot { color:#77798b; }.cycle-weekday-heading { color:#45465a; }
	.cycle-top-actions { display:flex; gap:13rpx; }.cycle-icon-button { display:flex; align-items:center; justify-content:center; width:72rpx; height:72rpx; margin:0; padding:0; border:1rpx solid rgba(85,73,130,.12); border-radius:50%; background:rgba(255,255,255,.82) !important; box-shadow:0 8rpx 22rpx rgba(77,65,120,.06); }.cycle-icon-button::after { border:0 !important; }.cycle-add-button { border-color:#7046e8; background:#7046e8 !important; }
	.cycle-add-plus { position:relative; width:28rpx; height:28rpx; }.cycle-add-plus::before,.cycle-add-plus::after { position:absolute; top:12rpx; left:0; width:28rpx; height:4rpx; border-radius:4rpx; background:#fff; content:''; }.cycle-add-plus::after { transform:rotate(90deg); }
	.cycle-disabled-glyph { position:relative; width:32rpx; height:26rpx; border:4rpx solid #454553; border-top:0; border-radius:3rpx 3rpx 7rpx 7rpx; }.cycle-disabled-glyph::before { position:absolute; top:-8rpx; left:-6rpx; width:36rpx; height:6rpx; border-radius:5rpx; background:#454553; content:''; }.cycle-disabled-glyph::after { position:absolute; top:4rpx; left:8rpx; width:4rpx; height:10rpx; border-radius:3rpx; background:#454553; box-shadow:8rpx 0 0 #454553; content:''; }.cycle-disabled-glyph view { position:absolute; top:-14rpx; left:7rpx; width:11rpx; height:7rpx; border:4rpx solid #454553; border-bottom:0; border-radius:6rpx 6rpx 0 0; }.cycle-disabled-glyph.large { transform:scale(1.2); }
	.cycle-list { display:flex; flex-direction:column; gap:20rpx; }.cycle-card { overflow:hidden; border:1rpx solid rgba(91,76,133,.1); border-radius:28rpx; background:rgba(255,255,255,.92); box-shadow:0 11rpx 30rpx rgba(58,51,93,.055); }.cycle-card-header { display:flex; align-items:center; min-height:94rpx; padding:19rpx 21rpx 13rpx; }.cycle-name-area { display:flex; min-width:0; flex:1; align-items:center; }.cycle-project-icon { display:flex; flex:0 0 60rpx; align-items:center; justify-content:center; width:60rpx; height:60rpx; margin-right:16rpx; border-radius:19rpx; background:linear-gradient(145deg,#eee9ff,#f5f2ff); color:#7046e8; font-size:29rpx; }.cycle-project-icon.small { flex-basis:54rpx; width:54rpx; height:54rpx; margin-right:14rpx; border-radius:16rpx; font-size:25rpx; }.cycle-title-copy { display:flex; min-width:0; flex:1; flex-direction:column; }.cycle-item-title { overflow:hidden; color:#2e2f3d; font-size:27rpx; font-weight:700; line-height:37rpx; text-overflow:ellipsis; white-space:nowrap; }.cycle-chevron { width:12rpx; height:12rpx; margin:0 5rpx 0 12rpx; border-top:3rpx solid #aaa8b4; border-right:3rpx solid #aaa8b4; transform:rotate(45deg); }
	.cycle-card-main { display:flex; align-items:center; gap:17rpx; padding:7rpx 20rpx 20rpx; }.cycle-calendar-wrap { min-width:0; flex:1; }.cycle-week-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:0; }.cycle-week-day { display:flex; min-width:0; align-items:center; flex-direction:column; color:#9998a8; }.cycle-weekday { margin-bottom:6rpx; font-size:17rpx; }.cycle-day-circle { display:flex; align-items:center; justify-content:center; width:46rpx; height:46rpx; border:3rpx solid transparent; border-radius:50%; color:#555665; font-size:16rpx; }.cycle-week-day.today { color:#7046e8; }.cycle-week-day.today .cycle-day-circle { color:#7046e8; }.cycle-week-day.completed .cycle-day-circle { border-color:#7046e8; color:#6037d9; font-weight:700; }
	.cycle-month-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:0; }.cycle-month-day { display:flex; min-width:0; align-items:center; justify-content:center; height:37rpx; color:#717181; font-size:15rpx; }.cycle-month-day>text { display:flex; align-items:center; justify-content:center; width:31rpx; height:31rpx; border:3rpx solid transparent; border-radius:50%; }.cycle-month-day.blank { visibility:hidden; }.cycle-month-day.today { color:#7046e8; font-weight:700; }.cycle-month-day.completed { color:#6037d9; font-weight:700; }.cycle-month-day.completed>text { border-color:#7046e8; }
	.cycle-week-day.editable,.cycle-month-day.editable { cursor:pointer; }.cycle-week-day.editable:active,.cycle-month-day.editable:active { opacity:.65; }
	.cycle-check-button { display:flex; flex:0 0 92rpx; align-items:center; flex-direction:column; justify-content:center; width:92rpx; height:104rpx; margin:0; padding:0; border:0 !important; border-radius:24rpx; background:linear-gradient(145deg,#8257f3,#6037d9) !important; box-shadow:0 11rpx 25rpx rgba(96,55,217,.2) !important; color:#fff; font-size:19rpx; font-weight:650; line-height:29rpx; }.cycle-check-button::after { border:0 !important; }.cycle-check-button.completed { background:linear-gradient(145deg,#55bc72,#36a355) !important; box-shadow:0 11rpx 25rpx rgba(45,151,75,.18) !important; }.cycle-check-icon { display:flex; align-items:center; justify-content:center; width:39rpx; height:39rpx; margin-bottom:4rpx; border:3rpx solid rgba(255,255,255,.82); border-radius:50%; }.cycle-check-icon text { margin-top:-3rpx; font-size:28rpx; font-weight:350; }.cycle-check-icon view { width:11rpx; height:20rpx; margin-top:-5rpx; border-right:4rpx solid #fff; border-bottom:4rpx solid #fff; transform:rotate(45deg); }
	.cycle-stats { display:grid; grid-template-columns:1fr 118rpx 1fr; align-items:center; min-height:117rpx; padding:16rpx 21rpx; border-top:1rpx solid rgba(78,72,105,.075); background:rgba(248,247,252,.63); }.cycle-stat-side { display:flex; min-width:0; flex-direction:column; }.cycle-stat-side.right { text-align:right; }.cycle-stat-side text:first-child { margin-bottom:7rpx; color:#9897a7; font-size:17rpx; }.cycle-stat-side text:last-child { color:#555665; font-size:18rpx; line-height:27rpx; }.cycle-days-stat { display:flex; align-items:center; flex-direction:column; justify-content:center; border-right:1rpx solid #e7e3ee; border-left:1rpx solid #e7e3ee; color:#9a99a9; font-size:16rpx; }.cycle-days-stat>view { display:flex; align-items:baseline; }.cycle-days-number { color:#7046e8; font-size:39rpx; font-weight:780; line-height:42rpx; }.cycle-days-unit { margin-left:3rpx; color:#7046e8; font-size:18rpx; font-weight:650; }.cycle-no-record { color:#777687; font-size:20rpx; font-weight:650; line-height:42rpx; }
	.cycle-loading,.cycle-empty { display:flex; align-items:center; flex-direction:column; justify-content:center; min-height:470rpx; color:#9695a5; text-align:center; }.cycle-loading { flex-direction:row; gap:14rpx; font-size:22rpx; }.cycle-loading-dot { width:25rpx; height:25rpx; border:4rpx solid rgba(111,70,232,.2); border-top-color:#6f46e8; border-radius:50%; animation:cycle-spin .8s linear infinite; }@keyframes cycle-spin { to { transform:rotate(360deg); } }.cycle-empty-mark { display:flex; align-items:center; justify-content:center; width:92rpx; height:92rpx; margin-bottom:22rpx; border-radius:29rpx; background:#eee9fb; }.cycle-mobius-icon { position:relative; width:56rpx; height:40rpx; color:#7046e8; }.cycle-mobius-loop { position:absolute; top:5rpx; z-index:1; box-sizing:border-box; width:33rpx; height:33rpx; border:7rpx solid currentColor; }.cycle-mobius-loop.left { left:0; border-radius:21rpx 21rpx 5rpx 21rpx; transform:rotate(-45deg); }.cycle-mobius-loop.right { right:0; border-radius:21rpx 21rpx 21rpx 5rpx; opacity:.48; transform:rotate(45deg); }.cycle-mobius-twist { position:absolute; z-index:2; top:12rpx; left:19rpx; width:18rpx; height:18rpx; }.cycle-mobius-twist::before,.cycle-mobius-twist::after { position:absolute; top:7rpx; left:0; width:18rpx; height:7rpx; border-radius:7rpx; background:currentColor; content:''; transform-origin:center; }.cycle-mobius-twist::before { opacity:.42; transform:rotate(42deg); }.cycle-mobius-twist::after { transform:rotate(-42deg); }.cycle-empty-title { color:#3b3c49; font-size:27rpx; font-weight:680; }.cycle-empty-copy { margin-top:9rpx; font-size:20rpx; }
	.cycle-subbar { display:flex; align-items:center; min-height:105rpx; margin-bottom:25rpx; }.cycle-back-button { display:flex; align-items:center; justify-content:center; width:70rpx; height:70rpx; margin:0 21rpx 0 0; padding:0 0 9rpx; border:0 !important; border-radius:50%; background:rgba(255,255,255,.76) !important; color:#252632; font-size:61rpx; font-weight:260; line-height:58rpx; }.cycle-back-button::after { border:0 !important; }.cycle-subbar>view { display:flex; flex-direction:column; }.cycle-subbar-title { color:#292a38; font-size:34rpx; font-weight:730; }.cycle-subbar-copy { color:#9291a2; font-size:19rpx; }.cycle-archive-empty { min-height:560rpx; }
	.cycle-archive-list { overflow:hidden; border:1rpx solid rgba(91,76,133,.11); border-radius:26rpx; background:rgba(255,255,255,.91); }.cycle-archive-item { display:flex; align-items:center; min-height:108rpx; padding:18rpx; border-bottom:1rpx solid rgba(78,72,105,.08); }.cycle-archive-item:last-child { border-bottom:0; }.cycle-archive-copy { display:flex; min-width:0; flex:1; flex-direction:column; }.cycle-archive-copy text:first-child { overflow:hidden; color:#343543; font-size:24rpx; text-overflow:ellipsis; white-space:nowrap; }.cycle-archive-copy text:last-child { margin-top:4rpx; color:#9291a2; font-size:18rpx; }.cycle-restore,.cycle-destroy { height:58rpx; margin:0 0 0 10rpx; padding:0 14rpx; border:0 !important; border-radius:14rpx; font-size:19rpx; line-height:58rpx; }.cycle-restore { background:#eee9fb !important; color:#7046e8 !important; }.cycle-destroy { background:#fff0f1 !important; color:#df414b !important; }.cycle-restore::after,.cycle-destroy::after { border:0 !important; }
	.cycle-item-title { font-size:31rpx; line-height:42rpx; }.cycle-weekday,.cycle-day-circle,.cycle-month-day { font-size:18rpx; }.cycle-day-circle { width:54rpx; height:54rpx; }.cycle-month-day { height:43rpx; }.cycle-month-day>text { width:37rpx; height:37rpx; }.cycle-check-button { font-size:18rpx; }.cycle-days-stat { font-size:18rpx; }.cycle-stat-side text:first-child,.cycle-stat-side text:last-child { font-size:24rpx; line-height:34rpx; }.cycle-days-number { font-size:31rpx; line-height:38rpx; }.cycle-days-unit { font-size:24rpx; line-height:34rpx; }.cycle-no-record { font-size:24rpx; line-height:36rpx; }
	@media (min-width:700px) { .cycle-page-shell { padding:35px 0; }.cycle-page-content { min-height:calc(100vh - 70px); border-radius:30px; background:rgba(250,249,253,.72); box-shadow:0 24px 80px rgba(54,42,92,.12); } }
</style>

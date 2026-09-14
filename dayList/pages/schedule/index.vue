<template>
	<view class="page-shell" :class="{ 'startup-redirecting': startupRedirecting }">
		<view v-if="!startupRedirecting && accessState !== 'ready'" class="access-page">
			<view class="access-brand">
				<view class="brand-mark"><view class="brand-check"></view></view>
				<text class="brand-title">日程清单</text>
				<text class="brand-subtitle">只安排到某一天，简单完成每件事</text>
			</view>

			<view v-if="accessState === 'loading'" class="access-card access-loading">
				<view class="loading-dot"></view><text>正在连接个人数据空间…</text>
			</view>

			<view v-else-if="accessState === 'setup'" class="access-card">
				<text class="access-title">设置同步口令</text>
				<text class="access-copy">首次设置后，在手机和电脑输入同一口令即可同步。它不是账号登录，之后会自动进入。</text>
				<input v-model="secretInput" class="access-input" password inputmode="numeric" maxlength="32" placeholder="至少 3 位数字，建议 6 位以上" @input="sanitizeSecretInput" />
				<input v-model="secretConfirm" class="access-input" password inputmode="numeric" maxlength="32" placeholder="再次输入数字口令" @input="sanitizeSecretConfirm" @confirm="submitSecret" />
				<text v-if="accessError" class="access-error">{{ accessError }}</text>
				<button class="primary-button" :loading="accessBusy" :disabled="accessBusy" @tap="submitSecret">保存并进入</button>
				<text class="access-note">服务端只保存不可逆摘要；连续输错 5 次会锁定 10 分钟。</text>
			</view>

			<view v-else-if="accessState === 'unlock'" class="access-card">
				<text class="access-title">输入同步口令</text>
				<text class="access-copy">这是本设备首次访问。验证成功后会保存在本机，无需每次输入。</text>
				<input v-model="secretInput" class="access-input" password inputmode="numeric" maxlength="32" placeholder="数字同步口令" @input="sanitizeSecretInput" @confirm="submitSecret" />
				<text v-if="accessError" class="access-error">{{ accessError }}</text>
				<button class="primary-button" :loading="accessBusy" :disabled="accessBusy" @tap="submitSecret">验证并进入</button>
			</view>

			<view v-else class="access-card">
				<text class="access-title">暂时无法连接</text>
				<text class="access-copy">{{ accessError || '请确认 task-service 云对象已经上传到当前 uniCloud 服务空间。' }}</text>
				<button class="primary-button" @tap="bootstrap">重新连接</button>
			</view>
		</view>

		<template v-else-if="!startupRedirecting">
			<view class="page-content">
				<view v-if="viewMode === 'list'" class="topbar">
					<view class="date-heading">
						<text>{{ headerDate }}</text><text class="date-dot">·</text><text class="weekday">{{ headerWeekday }}</text>
					</view>
					<view class="top-actions">
						<button class="icon-button" aria-label="搜索" @tap="openSearch"><view class="search-glyph"></view></button>
						<button class="icon-button" aria-label="回收站" @tap="openTrash">
							<view class="trash-glyph"><view></view></view>
						</button>
						<button class="icon-button layout-toggle" :class="{ active: layoutEditing }" :aria-label="layoutEditing ? '保存卡片高度' : '调整卡片高度'" @tap="toggleLayoutEditing">
							<view v-if="layoutEditing" class="layout-save-glyph"></view>
							<view v-else class="layout-edit-glyph"><view></view></view>
						</button>
					</view>
				</view>

				<view v-else-if="viewMode === 'search'" class="subbar searchbar">
					<button class="back-button" @tap="closeSubView">‹</button>
					<view class="search-box">
						<view class="search-glyph small"></view>
						<input v-model="searchQuery" class="search-input" focus maxlength="80" placeholder="搜索任务" />
						<button v-if="searchQuery" class="clear-button" @tap="searchQuery = ''">×</button>
					</view>
				</view>

				<view v-else class="subbar">
					<button class="back-button" @tap="closeSubView">‹</button>
					<text class="subbar-title">回收站</text><view class="subbar-spacer"></view>
				</view>

				<template v-if="viewMode !== 'trash'">
					<view v-if="viewMode === 'list'" class="summary-grid">
						<view class="summary-card purple-summary">
							<view class="summary-ring"><view class="mini-clipboard"><view></view></view></view>
							<view class="summary-copy">
								<text class="summary-label">今日任务</text>
								<view><text class="summary-number">{{ todayCompletedCount }}</text><text class="summary-total">/{{ todayTasks.length }}</text></view>
								<text class="summary-caption">已逾期 {{ overdueTasks.length }} 项</text>
							</view>
						</view>
						<view class="summary-card orange-summary weekly-summary-card" role="button" aria-label="查看每周逾期历史" @tap.stop="openWeeklyHistory">
							<view class="weekly-clock-icon">
								<view class="weekly-clock-face">
									<view class="weekly-clock-hour"></view><view class="weekly-clock-minute"></view><view class="weekly-clock-center"></view>
								</view>
							</view>
							<view class="summary-copy">
								<text class="summary-label">本周逾期值</text>
								<view><text class="summary-number orange-number">{{ weeklyOverdueScore }}</text><text class="summary-total"> 天</text></view>
								<text class="summary-caption">按时完成已抵扣 {{ weeklyReward }} 天</text>
							</view>
						</view>
					</view>

					<view v-if="viewMode === 'list'" class="add-card">
						<button class="date-picker-button" :class="{ selected: selectedDate }" aria-label="选择任务日期" @tap.stop="openCalendar">
							<view class="calendar-glyph"></view><text>{{ selectedDateLabel }}</text>
						</button>
						<input v-model="newTaskTitle" class="task-input" maxlength="120" placeholder=" 添加任务" confirm-type="done" @confirm="createTask" />
						<button class="add-button" :class="{ disabled: !canCreateTask || loadingTasks }" :disabled="!canCreateTask || mutationBusy || loadingTasks" aria-label="添加任务" @tap="createTask"><view class="add-plus-glyph"></view></button>
					</view>

					<view v-if="calendarOpen" class="calendar-mask" @tap="closeCalendar">
						<view class="calendar-panel" @tap.stop>
							<view class="calendar-header">
								<button class="month-button" aria-label="上个月" @tap="changeCalendarMonth(-1)"><view class="month-chevron left"></view></button>
								<text class="calendar-title">{{ calendarTitle }}</text>
								<button class="month-button" aria-label="下个月" @tap="changeCalendarMonth(1)"><view class="month-chevron right"></view></button>
							</view>
							<view class="calendar-weekdays">
								<text v-for="weekday in calendarWeekdays" :key="weekday">{{ weekday }}</text>
							</view>
							<view class="calendar-days">
								<button v-for="day in calendarDays" :key="day.value" class="calendar-day" :class="{ muted: !day.currentMonth, today: day.value === currentDate, selected: day.value === calendarSelectedValue }" @tap="selectCalendarDate(day.value)">
									<text>{{ day.day }}</text>
								</button>
							</view>
							<view class="priority-card">
								<text class="priority-title">任务优先级</text>
								<view class="priority-options">
									<button v-for="option in priorityOptions" :key="option.value" class="priority-option" :class="[`priority-${option.value}`, { selected: calendarPriorityDraft === option.value }]" :aria-label="`${option.label}优先级`" @tap="togglePriorityDraft(option.value)">{{ option.label }}</button>
								</view>
							</view>
							<view class="calendar-footer">
								<button class="calendar-cancel" @tap="closeCalendar">取消</button>
								<button class="calendar-today" @tap="selectCalendarDate(currentDate)">选择今天</button>
							</view>
						</view>
					</view>

					<view v-if="weeklyHistoryOpen" class="weekly-history-mask" @tap="closeWeeklyHistory">
							<view class="weekly-history-panel" @tap.stop>
								<view class="weekly-history-header">
									<view class="weekly-history-heading"><view class="history-clock-glyph"><view></view></view><text>每周逾期值概览</text></view>
								</view>
								<view class="current-week-card">
									<view class="current-week-copy"><text>本周逾期值</text><view><text class="current-week-score">{{ weeklyOverdueScore }}</text><text class="current-week-unit"> 天</text></view><text class="current-week-compare">{{ currentWeekComparisonText }}</text></view>
									<view class="comparison-pill" :class="`comparison-${currentWeekComparison.tone}`"><text>{{ currentWeekComparison.symbol }}</text><text>{{ currentWeekComparison.rateText }}</text></view>
								</view>
								<view v-if="weeklyTrendItems.length" class="weekly-trend">
									<view v-for="item in weeklyTrendItems" :key="item.weekStart" class="trend-item">
										<text class="trend-value">{{ item.score }}</text>
										<view class="trend-track"><view class="trend-bar" :class="`trend-${item.tone}`" :style="{ height: `${item.height}rpx` }"></view></view>
										<text class="trend-label">{{ item.label }}</text>
									</view>
								</view>
								<view class="history-divider"></view>
								<text class="history-title">历史记录</text>
								<scroll-view v-if="weeklyHistoryRows.length" scroll-y class="history-list" :show-scrollbar="false">
									<view v-for="row in weeklyHistoryRows" :key="row.weekStart" class="history-row">
										<view class="history-period"><text class="history-week-label">{{ row.label }}</text><text class="history-date-range">{{ row.range }}</text></view>
										<text class="history-score">{{ row.score }} 天</text>
										<text class="history-change" :class="`change-${row.comparison.tone}`">{{ row.comparison.fullText }}</text>
									</view>
								</scroll-view>
								<view v-else class="history-empty">暂无已结束周记录</view>
								<button class="weekly-history-confirm" @tap="closeWeeklyHistory">关闭</button>
						</view>
					</view>

					<view v-if="viewMode === 'search'" class="search-result-heading">
						<text v-if="searchQuery">找到 {{ filteredActiveTasks.length }} 项任务</text><text v-else>输入关键词搜索任务</text>
					</view>

					<view v-if="loadingTasks" class="list-loading"><view class="loading-dot"></view><text>同步中…</text></view>
					<view v-else-if="viewMode === 'search' && searchQuery && filteredActiveTasks.length === 0" class="empty-state compact-empty">
						<view class="empty-search"></view><text class="empty-title">没有匹配的任务</text><text class="empty-copy">换一个关键词试试</text>
					</view>
					<task-list-rows v-else-if="viewMode === 'search' && searchQuery" :tasks="filteredActiveTasks" :today="currentDate" @toggle="toggleTask" @remove="moveToTrash" @rename="renameTask" />
					<view v-else-if="viewMode === 'list'" class="task-grid" :class="{ editing: layoutEditing }">
						<view class="task-row-shell">
							<view class="task-card-row">
								<task-card title="未完成" tone="red" icon="hourglass" :card-height="cardRowHeights.top" :tasks="displayOverdueTasks" :today="currentDate" @toggle="toggleTask" @remove="moveToTrash" @open="openCategory('overdue')" />
								<task-card title="今天" tone="blue" icon="sun" :card-height="cardRowHeights.top" :tasks="displayTodayTasks" :today="currentDate" @toggle="toggleTask" @remove="moveToTrash" @open="openCategory('today')" />
							</view>
							<view v-if="layoutEditing" class="row-resizer">
								<view class="resize-touch" aria-label="调整第一排卡片高度" @touchstart.stop="startRowResize('top', $event)" @touchmove.stop.prevent="onRowResize" @touchend.stop="endRowResize" @touchcancel.stop="endRowResize" @mousedown.stop.prevent="startRowResize('top', $event)">
									<view class="resize-grip"><view></view></view>
								</view>
								<view class="resize-line"></view>
							</view>
						</view>
						<view class="task-row-shell">
							<view class="task-card-row">
								<task-card title="已完成" tone="green" icon="check" :card-height="cardRowHeights.bottom" :tasks="displayCompletedTasks" :today="currentDate" @toggle="toggleTask" @remove="moveToTrash" @open="openCategory('completed')" />
								<task-card title="未来" tone="purple" icon="calendar" :card-height="cardRowHeights.bottom" :tasks="displayFutureTasks" :today="currentDate" @toggle="toggleTask" @remove="moveToTrash" @open="openCategory('future')" />
							</view>
							<view v-if="layoutEditing" class="row-resizer">
								<view class="resize-touch" aria-label="调整第二排卡片高度" @touchstart.stop="startRowResize('bottom', $event)" @touchmove.stop.prevent="onRowResize" @touchend.stop="endRowResize" @touchcancel.stop="endRowResize" @mousedown.stop.prevent="startRowResize('bottom', $event)">
									<view class="resize-grip"><view></view></view>
								</view>
								<view class="resize-line"></view>
							</view>
						</view>
					</view>
				</template>

				<template v-else>
					<view class="trash-tip">删除的任务会保留在这里，可恢复或永久删除。</view>
					<view v-if="loadingTasks" class="list-loading"><view class="loading-dot"></view><text>同步中…</text></view>
					<view v-else-if="trashTasks.length === 0" class="empty-state trash-empty">
						<view class="large-trash-glyph"><view></view></view><text class="empty-title">回收站是空的</text><text class="empty-copy">删除的任务会移动到这里</text>
					</view>
					<view v-else class="trash-list">
						<view v-for="task in trashTasks" :key="task._id" class="trash-item">
							<view class="trash-item-copy"><text class="trash-title">{{ task.title }}</text><text class="trash-date">原定 {{ formatFullDate(task.task_date) }}</text></view>
							<button class="restore-button" :disabled="mutationBusy" @tap="restoreTask(task)">恢复</button>
							<button class="destroy-button" :disabled="mutationBusy" @tap="confirmPermanentDelete(task)">永久删除</button>
						</view>
					</view>
				</template>

				<view v-if="syncError && accessState === 'ready'" class="sync-error" @tap="loadTasks">
					<text>{{ syncError }}</text><text class="retry-text">点击重试</text>
				</view>
			</view>
		</template>
		<app-bottom-nav v-if="!startupRedirecting" active="schedule" />
	</view>
</template>

<script>
	import TaskCard from '../../modules/schedule/components/TaskCard.vue'
	import TaskListRows from '../../modules/schedule/components/TaskListRows.vue'
	import AppBottomNav from '../../shared/components/AppBottomNav.vue'
	import { createTaskService } from '../../modules/schedule/services/task-data-service.js'
	import { showFeedback } from '../../shared/feedback.js'
	import { startupModuleUrl } from '../../shared/startup-module.js'

	const SECRET_STORAGE_KEY = 'daylist-sync-secret-v1'
	const CARD_ROW_HEIGHTS_STORAGE_KEY = 'daylist-card-row-heights-v1'
	const WEEKLY_HISTORY_STORAGE_KEY = 'daylist-weekly-metric-history-v1'
	const DEFAULT_CARD_ROW_HEIGHT = 420
	const MIN_CARD_ROW_HEIGHT = 260
	const pad = (value) => String(value).padStart(2, '0')
	const localDateString = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
	const parseDate = (value) => {
		const [year, month, day] = String(value).split('-').map(Number)
		return new Date(year, month - 1, day, 12, 0, 0)
	}
	const daysBetween = (earlier, later) => Math.max(0, Math.round((parseDate(later) - parseDate(earlier)) / 86400000))
	const addDateDays = (value, amount) => {
		const date = parseDate(value)
		date.setDate(date.getDate() + amount)
		return localDateString(date)
	}
	const metricWeekStart = (dateInput = new Date()) => {
		const date = new Date(dateInput)
		const mondayOffset = (date.getDay() + 6) % 7
		const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - mondayOffset, 0, 1, 0, 0)
		if (date < start) start.setDate(start.getDate() - 7)
		return localDateString(start)
	}

	export default {
		components: { TaskCard, TaskListRows, AppBottomNav },
		data() {
			const app = typeof getApp === 'function' ? getApp() : null
			const startupModule = app && app.globalData ? app.globalData.startupRedirectModule : ''
			return {
				startupRedirecting: Boolean(startupModule && startupModule !== 'schedule'), accessState: 'loading', accessBusy: false, accessError: '', secretInput: '', secretConfirm: '', secret: '', secretGateEnabled: true, taskService: null,
				tasks: [], loadingTasks: false, mutationBusy: false, syncError: '', viewMode: 'list', searchQuery: '', newTaskTitle: '', selectedDate: '', selectedPriority: 'medium',
				currentDate: localDateString(), calendarOpen: false, calendarCursor: localDateString(), calendarPriorityDraft: 'medium', calendarWeekdays: ['一', '二', '三', '四', '五', '六', '日'],
				priorityOptions: [{ value: 'low', label: '低' }, { value: 'high', label: '高' }],
				metricNow: Date.now(), metricTimerId: null, metricWeekKey: '', weeklyHistoryOpen: false, weeklyHistoryRecords: [],
				layoutEditing: false, cardRowHeights: { top: DEFAULT_CARD_ROW_HEIGHT, bottom: DEFAULT_CARD_ROW_HEIGHT },
				resizingRow: '', resizeStartY: 0, resizeStartHeight: DEFAULT_CARD_ROW_HEIGHT, resizeViewportWidth: 375, lastTouchResizeAt: 0
			}
		},
		computed: {
			headerDate() { const date = parseDate(this.currentDate); return `${date.getMonth() + 1}月${date.getDate()}日` },
			headerWeekday() { return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][parseDate(this.currentDate).getDay()] },
			selectedDateLabel() { if (!this.selectedDate || this.selectedDate === this.currentDate) return '今天'; const date = parseDate(this.selectedDate); return `${date.getMonth() + 1}/${date.getDate()}` },
			calendarTitle() { const date = parseDate(this.calendarCursor); return `${date.getFullYear()}年 ${date.getMonth() + 1}月` },
			calendarSelectedValue() { return this.selectedDate || this.currentDate },
			calendarDays() {
				const cursor = parseDate(this.calendarCursor)
				const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1, 12, 0, 0)
				const mondayOffset = (first.getDay() + 6) % 7
				const start = new Date(first)
				start.setDate(first.getDate() - mondayOffset)
				return Array.from({ length: 42 }, (_, index) => {
					const date = new Date(start)
					date.setDate(start.getDate() + index)
					return { value: localDateString(date), day: date.getDate(), currentMonth: date.getMonth() === cursor.getMonth() }
				})
			},
			canCreateTask() { return this.newTaskTitle.trim().length > 0 },
			activeTasks() { return this.tasks.filter((task) => !task.deleted) },
			trashTasks() { return this.tasks.filter((task) => task.deleted).sort((a, b) => (b.deleted_at || 0) - (a.deleted_at || 0)) },
			filteredActiveTasks() {
				const keyword = this.searchQuery.trim().toLocaleLowerCase()
				const tasks = keyword ? this.activeTasks.filter((task) => task.title.toLocaleLowerCase().includes(keyword)) : this.activeTasks
				return tasks.slice().sort(this.sortByDateThenPriorityThenCreated)
			},
			overdueTasks() { return this.activeTasks.filter((task) => !task.completed && task.task_date < this.currentDate).sort(this.sortByDateThenPriorityThenCreated) },
			todayTasks() { return this.activeTasks.filter((task) => task.task_date === this.currentDate) },
			todayCompletedCount() {
				return this.activeTasks.filter((task) => {
					if (!task.completed || !task.completed_at) return false
					return localDateString(new Date(task.completed_at)) === this.currentDate
				}).length
			},
			weeklyMetric() {
				const now = new Date(this.metricNow)
				const mondayOffset = (now.getDay() + 6) % 7
				const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset, 0, 1, 0, 0)
				if (now < weekStart) weekStart.setDate(weekStart.getDate() - 7)
				const weekStartDate = localDateString(weekStart)
				const today = localDateString(now)
				let penalty = 0
				let reward = 0
				this.activeTasks.forEach((task) => {
					if (task.completed) {
						if (!task.completed_at || task.completed_at < weekStart.getTime()) return
						const completedDate = localDateString(new Date(task.completed_at))
						if (completedDate < task.task_date) {
							reward += 1
							return
						}
						if (completedDate === task.task_date) {
							reward += 0.5
							return
						}
						penalty += task.task_date < weekStartDate
							? daysBetween(weekStartDate, completedDate) + 1
							: daysBetween(task.task_date, completedDate)
						return
					}
					if (task.task_date >= today) return
					penalty += task.task_date < weekStartDate
						? daysBetween(weekStartDate, today) + 1
						: daysBetween(task.task_date, today)
				})
				return { penalty, reward, score: Math.max(0, penalty - reward) }
			},
			weeklyOverdueScore() { return this.weeklyMetric.score },
			weeklyReward() { return this.weeklyMetric.reward },
			currentMetricWeekStart() { return metricWeekStart(new Date(this.metricNow)) },
			completedWeeklyRecords() { return this.weeklyHistoryRecords.slice().sort((a, b) => b.weekStart.localeCompare(a.weekStart)) },
			currentWeekComparison() {
				const previousStart = addDateDays(this.currentMetricWeekStart, -7)
				const previous = this.completedWeeklyRecords.find((record) => record.weekStart === previousStart)
				return this.describeComparison(this.weeklyOverdueScore, previous ? previous.score : null)
			},
			currentWeekComparisonText() {
				const comparison = this.currentWeekComparison
				if (!comparison.hasPrevious) return '暂无上周完整记录'
				if (comparison.tone === 'neutral') return '与上周持平'
				return `较上周${comparison.tone === 'decrease' ? '减少' : '增加'} ${comparison.deltaText} 天`
			},
			weeklyHistoryRows() {
				const previousStart = addDateDays(this.currentMetricWeekStart, -7)
				return this.completedWeeklyRecords.map((record) => {
					const olderStart = addDateDays(record.weekStart, -7)
					const older = this.weeklyHistoryRecords.find((item) => item.weekStart === olderStart)
					return {
						...record,
						label: record.weekStart === previousStart ? '上周' : '',
						range: this.formatWeekRange(record.weekStart),
						comparison: this.describeComparison(record.score, older ? older.score : null)
					}
				})
			},
			weeklyTrendItems() {
				const current = {
					weekStart: this.currentMetricWeekStart,
					label: '本周',
					score: this.weeklyOverdueScore,
					tone: this.currentWeekComparison.tone
				}
				const history = this.weeklyHistoryRows.slice(0, 3).map((row) => ({
					weekStart: row.weekStart,
					label: row.label || this.formatShortWeekRange(row.weekStart),
					score: row.score,
					tone: row.comparison.tone
				}))
				const items = [current, ...history]
				const maximum = Math.max(1, ...items.map((item) => Number(item.score) || 0))
				return items.map((item) => ({ ...item, height: Math.max(15, Math.round((Number(item.score) || 0) / maximum * 78)) }))
			},
			displayOverdueTasks() { return this.filteredActiveTasks.filter((task) => !task.completed && task.task_date < this.currentDate).sort(this.sortByDateThenPriorityThenCreated) },
			displayTodayTasks() { return this.filteredActiveTasks.filter((task) => !task.completed && task.task_date === this.currentDate).sort(this.sortByPriorityThenNewest) },
			displayCompletedTasks() { return this.filteredActiveTasks.filter((task) => task.completed).sort(this.sortCompletedTasks) },
			displayFutureTasks() { return this.filteredActiveTasks.filter((task) => !task.completed && task.task_date > this.currentDate).sort(this.sortByDateThenPriorityThenCreated) }
		},
		onLoad() {
			const app = typeof getApp === 'function' ? getApp() : null
			const startupModule = app && app.globalData ? app.globalData.startupRedirectModule : ''
			if (startupModule && startupModule !== 'schedule') {
				app.globalData.startupRedirectModule = ''
				uni.reLaunch({
					url: startupModuleUrl(startupModule),
					fail: () => { this.startupRedirecting = false; this.initializeSchedulePage() }
				})
				return
			}
			this.startupRedirecting = false
			this.initializeSchedulePage()
		},
		onShow() {
			const today = localDateString()
			if (today !== this.currentDate) this.currentDate = today
			if (this.accessState === 'ready') this.loadTasks()
		},
		onBackPress() {
			if (this.calendarOpen) { this.closeCalendar(); return true }
			if (this.weeklyHistoryOpen) { this.closeWeeklyHistory(); return true }
			if (this.viewMode !== 'list') { this.closeSubView(); return true }
			if (this.layoutEditing) { this.endRowResize(); this.layoutEditing = false; return true }
			return false
		},
		onUnload() { this.endRowResize(); this.stopMetricClock() },
		beforeUnmount() { this.endRowResize(); this.stopMetricClock() },
		methods: {
			initializeSchedulePage() { this.restoreCardRowHeights(); this.restoreWeeklyMetricHistory(); this.startMetricClock(); this.bootstrap() },
			formatMetricNumber(value) {
				const number = Number(value) || 0
				return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, '')
			},
			formatWeekRange(weekStart) {
				const start = parseDate(weekStart)
				const end = parseDate(addDateDays(weekStart, 6))
				return `${start.getMonth() + 1}/${start.getDate()}–${end.getMonth() + 1}/${end.getDate()}`
			},
			formatShortWeekRange(weekStart) { return this.formatWeekRange(weekStart) },
			describeComparison(currentInput, previousInput) {
				const current = Number(currentInput) || 0
				if (previousInput === null || previousInput === undefined) {
					return { hasPrevious: false, tone: 'neutral', symbol: '—', deltaText: '0', rateText: '暂无对比', fullText: '—' }
				}
				const previous = Number(previousInput) || 0
				const delta = current - previous
				if (delta === 0) return { hasPrevious: true, tone: 'neutral', symbol: '—', deltaText: '0', rateText: '持平', fullText: '— 持平' }
				const tone = delta < 0 ? 'decrease' : 'increase'
				const symbol = delta < 0 ? '↓' : '↑'
				const deltaText = this.formatMetricNumber(Math.abs(delta))
				const action = delta < 0 ? '减少' : '增加'
				if (previous === 0) return { hasPrevious: true, tone, symbol, deltaText, rateText: `${action} · 新增`, fullText: `${symbol} ${deltaText} 天 · 新增` }
				const rate = Math.abs(delta) / previous * 100
				const rateValue = Number.isInteger(rate) ? String(rate) : rate.toFixed(1).replace(/\.0$/, '')
				return { hasPrevious: true, tone, symbol, deltaText, rateText: `${action} ${rateValue}%`, fullText: `${symbol} ${deltaText} 天 · ${action} ${rateValue}%` }
			},
			restoreWeeklyMetricHistory() {
				const saved = uni.getStorageSync(WEEKLY_HISTORY_STORAGE_KEY)
				this.weeklyHistoryRecords = Array.isArray(saved)
					? saved.filter((record) => record && /^\d{4}-\d{2}-\d{2}$/.test(record.weekStart) && Number.isFinite(Number(record.score)))
					: []
			},
			calculateCompletedWeekMetric(weekStart) {
				const weekEnd = addDateDays(weekStart, 6)
				let penalty = 0
				let reward = 0
				this.activeTasks.forEach((task) => {
					const createdDate = task.created_at ? localDateString(new Date(task.created_at)) : task.task_date
					if (createdDate > weekEnd) return
					const completedDate = task.completed_at ? localDateString(new Date(task.completed_at)) : ''
					if (completedDate && completedDate < weekStart) return
					if (completedDate && completedDate <= weekEnd) {
						if (completedDate < task.task_date) reward += 1
						else if (completedDate === task.task_date) reward += 0.5
						else penalty += task.task_date < weekStart ? daysBetween(weekStart, completedDate) + 1 : daysBetween(task.task_date, completedDate)
						return
					}
					if (task.task_date > weekEnd) return
					penalty += task.task_date < weekStart ? 7 : daysBetween(task.task_date, weekEnd)
				})
				return { penalty, reward, score: Math.max(0, penalty - reward) }
			},
			syncWeeklyMetricHistory() {
				const currentStart = metricWeekStart(new Date(this.metricNow))
				const lastCompletedStart = addDateDays(currentStart, -7)
				const recordsByWeek = new Map(this.weeklyHistoryRecords.map((record) => [record.weekStart, record]))
				let earliest = this.weeklyHistoryRecords.reduce((value, record) => !value || record.weekStart < value ? record.weekStart : value, '')
				this.activeTasks.forEach((task) => {
					const created = task.created_at ? new Date(task.created_at) : parseDate(task.task_date)
					const candidate = metricWeekStart(created)
					if (!earliest || candidate < earliest) earliest = candidate
				})
				if (!earliest || earliest > lastCompletedStart) return
				let cursor = earliest
				let guard = 0
				while (cursor <= lastCompletedStart && guard < 260) {
					if (!recordsByWeek.has(cursor)) {
						const metric = this.calculateCompletedWeekMetric(cursor)
						recordsByWeek.set(cursor, { weekStart: cursor, ...metric, capturedAt: Date.now() })
					}
					cursor = addDateDays(cursor, 7)
					guard += 1
				}
				this.weeklyHistoryRecords = Array.from(recordsByWeek.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart))
				uni.setStorageSync(WEEKLY_HISTORY_STORAGE_KEY, this.weeklyHistoryRecords)
			},
			normalizeCardRowHeight(value) {
				const height = Number(value)
				if (!Number.isFinite(height)) return DEFAULT_CARD_ROW_HEIGHT
				return Math.max(MIN_CARD_ROW_HEIGHT, Math.round(height))
			},
			restoreCardRowHeights() {
				const saved = uni.getStorageSync(CARD_ROW_HEIGHTS_STORAGE_KEY)
				if (!saved || typeof saved !== 'object') return
				this.cardRowHeights = {
					top: this.normalizeCardRowHeight(saved.top),
					bottom: this.normalizeCardRowHeight(saved.bottom)
				}
			},
			toggleLayoutEditing() {
				if (!this.layoutEditing) {
					this.layoutEditing = true
					return
				}
				this.endRowResize()
				uni.setStorageSync(CARD_ROW_HEIGHTS_STORAGE_KEY, { ...this.cardRowHeights })
				this.layoutEditing = false
				showFeedback('卡片高度已保存')
			},
			resizeEventPoint(event) {
				if (event.touches && event.touches[0]) return event.touches[0]
				if (typeof event.clientY === 'number') return event
				return null
			},
			startRowResize(row, event) {
				if (!this.layoutEditing) return
				if (event.type === 'mousedown' && Date.now() - this.lastTouchResizeAt < 800) return
				if (event.type === 'touchstart') this.lastTouchResizeAt = Date.now()
				const point = this.resizeEventPoint(event)
				if (!point) return
				this.resizingRow = row
				this.resizeStartY = point.clientY
				this.resizeStartHeight = this.cardRowHeights[row]
				const systemInfo = uni.getSystemInfoSync()
				this.resizeViewportWidth = systemInfo.windowWidth || 375
				// #ifdef H5
				if (event.type === 'mousedown') {
					document.addEventListener('mousemove', this.onRowResize, { passive: false })
					document.addEventListener('mouseup', this.endRowResize)
				}
				// #endif
			},
			onRowResize(event) {
				if (!this.resizingRow) return
				const point = this.resizeEventPoint(event)
				if (!point) return
				if (event.cancelable) event.preventDefault()
				const deltaRpx = (point.clientY - this.resizeStartY) * 750 / this.resizeViewportWidth
				const height = this.normalizeCardRowHeight(this.resizeStartHeight + deltaRpx)
				this.cardRowHeights = { ...this.cardRowHeights, [this.resizingRow]: height }
			},
			endRowResize() {
				this.resizingRow = ''
				// #ifdef H5
				document.removeEventListener('mousemove', this.onRowResize)
					document.removeEventListener('mouseup', this.endRowResize)
				// #endif
			},
			startMetricClock() {
				this.stopMetricClock()
				this.metricNow = Date.now()
				this.metricWeekKey = metricWeekStart(new Date(this.metricNow))
				this.metricTimerId = setInterval(() => {
					this.metricNow = Date.now()
					const today = localDateString()
					if (today !== this.currentDate) this.currentDate = today
					const weekKey = metricWeekStart(new Date(this.metricNow))
					if (weekKey !== this.metricWeekKey) {
						this.metricWeekKey = weekKey
						this.syncWeeklyMetricHistory()
					}
				}, 15000)
			},
			stopMetricClock() {
				if (!this.metricTimerId) return
				clearInterval(this.metricTimerId)
				this.metricTimerId = null
			},
			priorityRank(task) {
				if (task && task.priority === 'high') return 0
				if (task && task.priority === 'low') return 2
				return 1
			},
			comparePriority(a, b) { return this.priorityRank(a) - this.priorityRank(b) },
			sortByDateThenPriorityThenCreated(a, b) {
				return a.task_date.localeCompare(b.task_date) || this.comparePriority(a, b) || (a.created_at || 0) - (b.created_at || 0)
			},
			sortByPriorityThenNewest(a, b) { return this.comparePriority(a, b) || (b.created_at || 0) - (a.created_at || 0) },
			sortCompletedTasks(a, b) {
				const aDay = a.completed_at ? localDateString(new Date(a.completed_at)) : ''
				const bDay = b.completed_at ? localDateString(new Date(b.completed_at)) : ''
				return bDay.localeCompare(aDay) || this.comparePriority(a, b) || (b.completed_at || 0) - (a.completed_at || 0)
			},
			getService() { if (!this.taskService) this.taskService = createTaskService(); return this.taskService },
			async bootstrap() {
				this.accessState = 'loading'; this.accessError = ''
				const cachedSecret = uni.getStorageSync(SECRET_STORAGE_KEY)
				try {
					const session = await this.getService().bootstrapSession({ secret: cachedSecret || '' })
					this.secretGateEnabled = session.secretEnabled !== false
					if (!this.secretGateEnabled) {
						this.secret = ''
						this.accessState = 'ready'
						this.acceptTasks(session.tasks)
						return
					}
					if (!session.initialized) return void (this.accessState = 'setup')
					if (!cachedSecret || !session.authenticated) return void (this.accessState = 'unlock')
					this.secret = cachedSecret
					this.accessState = 'ready'
					this.acceptTasks(session.tasks)
				} catch (error) {
					if (cachedSecret && this.isSecretError(error)) {
						uni.removeStorageSync(SECRET_STORAGE_KEY)
						this.secretInput = ''
						this.accessState = 'unlock'
						this.accessError = this.friendlyError(error, '本机保存的同步口令已失效，请重新输入。')
						return
					}
					this.accessState = 'error'; this.accessError = this.friendlyError(error, '无法连接 uniCloud，请先上传云对象和数据库 Schema。')
				}
			},
			async submitSecret() {
				if (this.accessBusy) return
				const secret = this.secretInput.trim(); this.accessError = ''
				if (!/^\d{3,32}$/.test(secret)) return void (this.accessError = '同步口令需为至少 3 位纯数字。')
				if (this.accessState === 'setup' && secret !== this.secretConfirm.trim()) return void (this.accessError = '两次输入的同步口令不一致。')
				this.accessBusy = true
				try {
					if (this.accessState === 'setup') await this.getService().initialize({ secret })
					await this.verifyAndEnter(secret)
				} catch (error) { this.accessError = this.friendlyError(error, '同步口令验证失败。') }
				finally { this.accessBusy = false }
			},
			async verifyAndEnter(secret, silent = false) {
				try {
					await this.getService().verifySecret({ secret })
					this.secret = secret; uni.setStorageSync(SECRET_STORAGE_KEY, secret); this.secretInput = ''; this.secretConfirm = ''; this.accessState = 'ready'
					await this.loadTasks()
				} catch (error) {
					if (silent) { uni.removeStorageSync(SECRET_STORAGE_KEY); this.secretInput = '' }
					this.accessState = 'unlock'
					throw error
				}
			},
			async loadTasks() {
				if ((this.secretGateEnabled && !this.secret) || this.loadingTasks) return
				this.loadingTasks = true; this.syncError = ''
				try {
					const result = await this.getService().listTasks({ secret: this.secret })
					this.acceptTasks(result.tasks)
				} catch (error) {
					const cached = uni.getStorageSync('daylist-task-cache-v1'); if (Array.isArray(cached) && !this.tasks.length) this.tasks = cached
					this.syncError = this.friendlyError(error, '同步失败，当前显示最近一次缓存。')
				} finally { this.loadingTasks = false }
			},
			acceptTasks(tasks) {
				this.tasks = Array.isArray(tasks) ? tasks : []
				uni.setStorageSync('daylist-task-cache-v1', this.tasks)
				this.syncWeeklyMetricHistory()
			},
			isSecretError(error) {
				const message = error && (error.errMsg || error.message || error.errCode) || ''
				return String(message).includes('INVALID_SECRET') || String(message).includes('ACCESS_LOCKED') || String(message).includes('同步口令')
			},
			openCalendar() {
				this.weeklyHistoryOpen = false
				const date = parseDate(this.selectedDate || this.currentDate)
				this.calendarCursor = localDateString(new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0))
				this.calendarPriorityDraft = this.selectedPriority
				this.calendarOpen = true
			},
			openWeeklyHistory() {
				this.calendarOpen = false
				this.syncWeeklyMetricHistory()
				this.weeklyHistoryOpen = true
			},
			closeWeeklyHistory() { this.weeklyHistoryOpen = false },
			togglePriorityDraft(priority) {
				this.calendarPriorityDraft = this.calendarPriorityDraft === priority ? 'medium' : priority
			},
			closeCalendar() { this.calendarOpen = false },
			changeCalendarMonth(offset) {
				const date = parseDate(this.calendarCursor)
				this.calendarCursor = localDateString(new Date(date.getFullYear(), date.getMonth() + offset, 1, 12, 0, 0))
			},
			selectCalendarDate(value) { this.selectedDate = value; this.selectedPriority = this.calendarPriorityDraft; this.calendarOpen = false },
			sanitizeSecretInput(event) { this.secretInput = String(event.detail.value || '').replace(/\D/g, '').slice(0, 32) },
			sanitizeSecretConfirm(event) { this.secretConfirm = String(event.detail.value || '').replace(/\D/g, '').slice(0, 32) },
			async createTask() {
				const title = this.newTaskTitle.trim(); if (!title || this.mutationBusy || this.loadingTasks) return
				this.mutationBusy = true
				try {
					await this.getService().createTask({ secret: this.secret, title, taskDate: this.selectedDate || this.currentDate, priority: this.selectedPriority })
					this.newTaskTitle = ''; this.selectedDate = ''; this.selectedPriority = 'medium'; await this.loadTasks()
				} catch (error) { showFeedback(this.friendlyError(error, '添加失败')) }
				finally { this.mutationBusy = false }
			},
			async toggleTask(task) { await this.mutate('setCompleted', { id: task._id, completed: !task.completed }, '更新失败') },
			async renameTask({ task, title }) { await this.mutate('renameTask', { id: task._id, title }, '修改失败') },
			async moveToTrash(task) { const ok = await this.mutate('moveToTrash', { id: task._id }, '删除失败'); if (ok) showFeedback('已移入回收站') },
			async restoreTask(task) { const ok = await this.mutate('restoreTask', { id: task._id }, '恢复失败'); if (ok) showFeedback('恢复成功') },
			confirmPermanentDelete(task) {
				uni.showModal({ title: '永久删除任务？', content: `“${task.title}”删除后无法恢复。`, confirmText: '永久删除', confirmColor: '#e94b55', success: ({ confirm }) => { if (confirm) this.permanentDelete(task) } })
			},
			async permanentDelete(task) { const ok = await this.mutate('deleteForever', { id: task._id }, '永久删除失败'); if (ok) showFeedback('已永久删除') },
			async mutate(method, payload, fallback) {
				if (this.mutationBusy || this.loadingTasks) return false
				this.mutationBusy = true
				try { await this.getService()[method]({ secret: this.secret, ...payload }); await this.loadTasks(); return true }
				catch (error) { showFeedback(this.friendlyError(error, fallback)); return false }
				finally { this.mutationBusy = false }
			},
			openSearch() { this.searchQuery = ''; this.viewMode = 'search' },
			openCategory(category) { uni.navigateTo({ url: `/pages/schedule/task-list?category=${category}` }) },
			openTrash() { this.viewMode = 'trash' },
			closeSubView() { this.viewMode = 'list'; this.searchQuery = '' },
			formatFullDate(value) { const date = parseDate(value); return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日` },
			friendlyError(error, fallback) {
				const message = error && (error.errMsg || error.message)
				if (!message) return fallback
				if (message.includes('同步口令不正确') || message.includes('INVALID_SECRET')) return '同步口令不正确。'
				if (message.includes('ACCESS_LOCKED')) return '输错次数过多，请 10 分钟后再试。'
				if (message.includes('未初始化')) return '同步口令尚未初始化。'
				if (message.includes('network') || message.includes('Network')) return '网络连接失败，请检查网络。'
				return message.length > 45 ? fallback : message
			}
		}
	}
</script>

<style>
	.page-shell { min-height: 100vh; background: radial-gradient(circle at 92% 3%, rgba(115,72,232,.13), transparent 21%), radial-gradient(circle at 8% 34%, rgba(95,124,248,.08), transparent 18%), linear-gradient(180deg,#fbfaff 0%,#f7f8fc 100%); }
	.page-shell.startup-redirecting { background:radial-gradient(circle at 92% 3%,rgba(115,72,232,.13),transparent 21%),radial-gradient(circle at 5% 38%,rgba(242,151,73,.08),transparent 20%),linear-gradient(180deg,#fbfaff 0%,#f7f8fc 100%); }
	.page-content,.access-page { width: 100%; max-width: 430px; min-height: 100vh; margin: 0 auto; padding: calc(var(--status-bar-height, 0px) + 30rpx) 24rpx calc(176rpx + env(safe-area-inset-bottom)); }
	.topbar,.subbar { display:flex; align-items:center; justify-content:space-between; min-height:90rpx; margin-bottom:20rpx; }
	.date-heading { display:flex; align-items:center; gap:11rpx; font-size:31rpx; font-weight:650; letter-spacing:.5rpx; }
	.date-dot { color:#77798b; } .weekday { color:#45465a; } .top-actions { display:flex; gap:12rpx; }
	.icon-button { position:relative; display:flex; align-items:center; justify-content:center; width:76rpx; height:76rpx; margin:0; padding:0; border:1rpx solid rgba(85,73,130,.12); border-radius:50%; background:rgba(255,255,255,.7); box-shadow:0 8rpx 22rpx rgba(77,65,120,.05); }
	.icon-button::after { border:0 !important; }
	.search-glyph { position:relative; width:27rpx; height:27rpx; border:5rpx solid #171824; border-radius:50%; }
	.search-glyph::after { content:''; position:absolute; width:18rpx; height:5rpx; right:-15rpx; bottom:-8rpx; border-radius:4rpx; background:#171824; transform:rotate(46deg); }
	.icon-button>.search-glyph { transform:translate(-5rpx,-5rpx); }
	.search-glyph.small { width:21rpx; height:21rpx; border-width:4rpx; } .search-glyph.small::after { width:14rpx; height:4rpx; right:-12rpx; bottom:-7rpx; }
	.trash-glyph,.large-trash-glyph { position:relative; width:28rpx; height:31rpx; border:4rpx solid #171824; border-top:none; border-radius:3rpx 3rpx 7rpx 7rpx; }
	.trash-glyph::before,.large-trash-glyph::before { content:''; position:absolute; left:-6rpx; top:-8rpx; width:33rpx; height:4rpx; border-radius:3rpx; background:#171824; }
	.trash-glyph::after,.large-trash-glyph::after { content:''; position:absolute; left:7rpx; top:-14rpx; width:12rpx; height:5rpx; border:4rpx solid #171824; border-bottom:none; border-radius:5rpx 5rpx 0 0; }
	.trash-glyph>view,.large-trash-glyph>view { position:absolute; left:10rpx; top:7rpx; width:4rpx; height:14rpx; border-radius:3rpx; background:#171824; }
	.icon-button>.trash-glyph { transform:translate(1rpx,6rpx); }
	.layout-toggle.active { border-color:rgba(111,70,232,.22); background:rgba(241,236,255,.92); color:#6f46e8; }
	.layout-edit-glyph { position:relative; width:32rpx; height:9rpx; border-radius:4rpx; background:#171824; transform:rotate(-44deg); }
	.layout-edit-glyph::before { content:''; position:absolute; left:-8rpx; top:0; border-top:4.5rpx solid transparent; border-bottom:4.5rpx solid transparent; border-right:9rpx solid #171824; }
	.layout-edit-glyph::after { content:''; position:absolute; right:-6rpx; top:0; width:5rpx; height:9rpx; border-left:3rpx solid rgba(255,255,255,.9); border-radius:1rpx 4rpx 4rpx 1rpx; background:#171824; }
	.layout-save-glyph { box-sizing:border-box; width:16rpx; height:29rpx; margin-top:-7rpx; border-right:6rpx solid currentColor; border-bottom:6rpx solid currentColor; transform:rotate(45deg); }
	.summary-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18rpx; margin-bottom:22rpx; }
	.summary-card { display:flex; align-items:center; min-height:164rpx; padding:24rpx 20rpx; border:1rpx solid rgba(111,70,232,.25); border-radius:27rpx; background:linear-gradient(135deg,rgba(250,248,255,.95),rgba(239,232,255,.85)); box-shadow:0 10rpx 28rpx rgba(96,68,161,.06); }
	.orange-summary { border-color:rgba(244,123,36,.25); background:linear-gradient(135deg,rgba(255,252,247,.98),rgba(255,239,224,.85)); }
	.weekly-summary-card { cursor:pointer; transition:transform .16s ease,box-shadow .16s ease; }
	.weekly-summary-card:active { transform:scale(.985); box-shadow:0 6rpx 18rpx rgba(96,68,161,.08); }
	.summary-ring { position:relative; flex:0 0 auto; width:76rpx; height:76rpx; margin-right:17rpx; border:11rpx solid rgba(111,70,232,.17); border-top-color:#6f46e8; border-right-color:#6f46e8; border-radius:50%; }
	.mini-clipboard { position:absolute; left:17rpx; top:16rpx; width:23rpx; height:28rpx; border-radius:5rpx; background:#6f46e8; }
	.mini-clipboard::before { content:''; position:absolute; left:6rpx; top:-5rpx; width:11rpx; height:8rpx; border-radius:5rpx; background:#6f46e8; }
	.mini-clipboard>view { width:10rpx; height:3rpx; margin:10rpx auto 0; border-radius:2rpx; background:#fff; box-shadow:0 7rpx 0 #fff; }
	.weekly-clock-icon { display:flex; flex:0 0 auto; align-items:center; justify-content:center; width:76rpx; height:76rpx; margin-right:17rpx; border-radius:50%; background:rgba(244,123,36,.13); }
	.weekly-clock-face { position:relative; width:43rpx; height:43rpx; border:5rpx solid #f47b24; border-radius:50%; }
	.weekly-clock-hour,.weekly-clock-minute { position:absolute; z-index:1; left:18rpx; bottom:18rpx; width:4rpx; border-radius:4rpx; background:#f47b24; transform-origin:50% 100%; }
	.weekly-clock-hour { height:12rpx; transform:rotate(0deg); } .weekly-clock-minute { height:15rpx; transform:rotate(125deg); }
	.weekly-clock-center { position:absolute; z-index:2; left:16rpx; top:16rpx; width:7rpx; height:7rpx; border-radius:50%; background:#f47b24; }
	.summary-copy { display:flex; min-width:0; flex-direction:column; } .summary-label { margin-bottom:2rpx; color:#30313f; font-size:24rpx; font-weight:620; }
	.summary-number { color:#10111b; font-size:49rpx; font-weight:720; line-height:1.1; } .summary-total { color:#30313f; font-size:25rpx; } .orange-number { color:#ef5f16; } .summary-caption { margin-top:6rpx; color:#727388; font-size:20rpx; }
	.add-card { display:flex; align-items:center; height:110rpx; margin-bottom:25rpx; padding:12rpx 13rpx 12rpx 16rpx; border:2rpx solid rgba(111,70,232,.2); border-radius:27rpx; background:rgba(255,255,255,.9); box-shadow:0 14rpx 34rpx rgba(82,57,146,.07); }
	.date-picker-button { display:flex; align-items:center; justify-content:center; min-width:74rpx; height:72rpx; margin:0; padding:0 13rpx; border:0 !important; border-radius:18rpx; outline:none; background:#f1ecff !important; box-shadow:none !important; color:#7254bd; font-size:20rpx; line-height:1; }
	.date-picker-button.selected { background:#e9e0ff !important; color:#6f46e8; }
	.date-picker-button::after,.calendar-day::after { border:0 !important; }
	.calendar-glyph { position:relative; width:31rpx; height:29rpx; margin-right:7rpx; border:4rpx solid currentColor; border-radius:5rpx; }
	.calendar-glyph::before { content:''; position:absolute; left:-4rpx; top:5rpx; width:31rpx; height:4rpx; background:currentColor; }
	.calendar-glyph::after { content:''; position:absolute; left:5rpx; top:-8rpx; width:4rpx; height:8rpx; border-radius:3rpx; background:currentColor; box-shadow:13rpx 0 0 currentColor; }
	.task-input { min-width:0; flex:1; height:72rpx; padding:0 12rpx; color:#252636; font-size:29rpx; }
	.add-button { display:flex; align-items:center; justify-content:center; width:76rpx; height:76rpx; margin:0; padding:0; border-radius:50%; background:linear-gradient(145deg,#7445ed,#5529cb); box-shadow:0 10rpx 23rpx rgba(83,40,196,.32); color:#fff !important; line-height:1; }
	.add-plus-glyph { position:relative; width:34rpx; height:34rpx; pointer-events:none; }
	.add-plus-glyph::before,.add-plus-glyph::after { content:''; position:absolute; left:50%; top:50%; border-radius:5rpx; background:#fff; transform:translate(-50%,-50%); }
	.add-plus-glyph::before { width:34rpx; height:5rpx; }
	.add-plus-glyph::after { width:5rpx; height:34rpx; }
	.add-button.disabled { opacity:.62; box-shadow:none; }
	.calendar-mask { position:fixed; z-index:100; inset:0; display:flex; align-items:center; justify-content:center; padding:30rpx; background:rgba(28,24,43,.35); backdrop-filter:blur(7rpx); }
	.calendar-panel { width:100%; max-width:650rpx; padding:27rpx 24rpx 24rpx; border:1rpx solid rgba(111,70,232,.16); border-radius:34rpx; background:#fff; box-shadow:0 30rpx 90rpx rgba(39,27,76,.22); }
	.calendar-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20rpx; }
	.calendar-title { color:#252633; font-size:31rpx; font-weight:720; }
	.month-button { display:flex; align-items:center; justify-content:center; width:68rpx; height:68rpx; margin:0; padding:0; border:0 !important; border-radius:50%; background:#f5f1ff !important; box-shadow:none !important; color:#6f46e8; line-height:1; }
	.month-button::after { border:0 !important; }
	.month-chevron { box-sizing:border-box; width:17rpx; height:17rpx; border-top:5rpx solid currentColor; border-right:5rpx solid currentColor; }
	.month-chevron.left { transform:translateX(3rpx) rotate(-135deg); }
	.month-chevron.right { transform:translateX(-3rpx) rotate(45deg); }
	.calendar-weekdays,.calendar-days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); }
	.calendar-weekdays { margin-bottom:7rpx; } .calendar-weekdays text { color:#9999a8; font-size:21rpx; line-height:47rpx; text-align:center; }
	.calendar-day { display:flex; position:relative; align-items:center; justify-content:center; width:62rpx; height:62rpx; margin:3rpx auto; padding:0; border:0 !important; border-radius:50%; outline:none; background:transparent !important; box-shadow:none; color:#2d2e3a; font-size:24rpx; line-height:62rpx; }
	.calendar-day.muted { color:#c8c7cf; } .calendar-day.today { color:#6f46e8; font-weight:720; }
	.calendar-day.today::after { content:''; position:absolute; left:50%; bottom:5rpx; width:6rpx; height:6rpx; border-radius:50%; background:#7a4ced; transform:translateX(-50%); }
	.calendar-day.selected { background:linear-gradient(145deg,#8356f2,#6338da) !important; box-shadow:0 7rpx 18rpx rgba(99,56,218,.24); color:#fff; font-weight:700; }
	.calendar-day.selected::after { display:none; }
	.priority-card { display:flex; align-items:center; justify-content:space-between; gap:18rpx; margin-top:18rpx; padding:16rpx 17rpx; border-radius:19rpx; background:#faf8ff; box-shadow:inset 0 0 0 1rpx rgba(111,70,232,.1); }
	.priority-title { color:#353543; font-size:22rpx; font-weight:650; }
	.priority-options { display:flex; flex:0 0 auto; gap:8rpx; }
	.priority-option { display:flex; align-items:center; justify-content:center; width:58rpx; height:48rpx; margin:0; padding:0; border:2rpx solid transparent !important; border-radius:12rpx; background:#f0eef5 !important; box-shadow:none !important; color:#777887; font-size:24rpx; line-height:1; }
	.priority-option::after { border:0 !important; }
	.priority-option.priority-low.selected { border-color:#f2bc7e !important; background:#fff0dd !important; color:#df7b25; font-weight:700; }
	.priority-option.priority-high.selected { border-color:#f2a1a7 !important; background:#ffe7e9 !important; color:#df3541; font-weight:700; }
	.calendar-footer { display:flex; justify-content:flex-end; gap:15rpx; margin-top:21rpx; padding-top:20rpx; border-top:1rpx solid #efedf5; }
	.calendar-cancel,.calendar-today { height:66rpx; margin:0; padding:0 25rpx; border:0 !important; border-radius:18rpx; outline:none; box-shadow:none !important; font-size:23rpx; line-height:66rpx; }
	.calendar-cancel::after,.calendar-today::after { border:0 !important; }
	.calendar-cancel { background:#f4f3f7; color:#777889; } .calendar-today { background:#efe9ff; color:#6f46e8; font-weight:650; }
	.weekly-history-mask { position:fixed; z-index:110; inset:0; display:flex; align-items:center; justify-content:center; padding:30rpx; background:rgba(28,24,43,.38); backdrop-filter:blur(7rpx); }
	.weekly-history-panel { box-sizing:border-box; display:flex; width:100%; max-width:650rpx; max-height:calc(100vh - 60rpx); padding:27rpx 25rpx 24rpx; overflow:hidden; flex-direction:column; border:1rpx solid rgba(111,70,232,.13); border-radius:34rpx; background:#fff; box-shadow:0 30rpx 90rpx rgba(39,27,76,.24); }
	.weekly-history-header { display:flex; flex:0 0 auto; align-items:center; justify-content:center; margin-bottom:19rpx; }
	.weekly-history-heading { display:flex; align-items:center; gap:14rpx; color:#252633; font-size:30rpx; font-weight:720; }
	.history-clock-glyph { display:flex; position:relative; align-items:center; justify-content:center; width:58rpx; height:58rpx; border-radius:50%; background:#ffead9; color:#f36c1e; }
	.history-clock-glyph::before { content:''; box-sizing:border-box; width:31rpx; height:31rpx; border:4rpx solid currentColor; border-radius:50%; }
	.history-clock-glyph::after { content:''; position:absolute; left:28rpx; top:17rpx; width:4rpx; height:14rpx; border-radius:4rpx; background:currentColor; transform-origin:50% 12rpx; transform:rotate(0deg); }
	.history-clock-glyph view { position:absolute; left:28rpx; top:28rpx; width:13rpx; height:4rpx; border-radius:4rpx; background:currentColor; transform:rotate(35deg); transform-origin:0 50%; }
	.current-week-card { display:flex; flex:0 0 auto; align-items:center; justify-content:space-between; gap:16rpx; padding:21rpx 22rpx; border-radius:22rpx; background:linear-gradient(135deg,#fff8f1,#fff0e5); }
	.current-week-copy { display:flex; min-width:0; flex-direction:column; color:#cc4d13; font-size:22rpx; font-weight:650; }
	.current-week-score { font-size:50rpx; font-weight:750; line-height:1.15; }
	.current-week-unit { color:#363744; font-size:24rpx; font-weight:500; }
	.current-week-compare { margin-top:4rpx; color:#747587; font-size:19rpx; font-weight:400; }
	.comparison-pill { display:flex; flex:0 0 auto; align-items:center; gap:7rpx; padding:10rpx 14rpx; border-radius:24rpx; font-size:20rpx; font-weight:680; white-space:nowrap; }
	.comparison-pill>text:first-child { font-size:28rpx; line-height:1; }
	.comparison-decrease { background:#ddf7e5; color:#159541; }
	.comparison-increase { background:#ffe3e5; color:#dc3541; }
	.comparison-neutral { background:#efeff3; color:#777887; }
	.weekly-trend { display:grid; flex:0 0 auto; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10rpx; min-height:157rpx; margin-top:17rpx; padding:0 4rpx; }
	.trend-item { display:flex; min-width:0; align-items:center; justify-content:flex-end; flex-direction:column; }
	.trend-value { margin-bottom:4rpx; color:#343543; font-size:18rpx; }
	.trend-track { display:flex; height:78rpx; align-items:flex-end; justify-content:center; }
	.trend-bar { width:48rpx; min-height:15rpx; border-radius:9rpx 9rpx 5rpx 5rpx; background:#b7b2c5; }
	.trend-decrease { background:linear-gradient(180deg,#64d580,#42ba65); }
	.trend-increase { background:linear-gradient(180deg,#ff746b,#e94b55); }
	.trend-neutral { background:linear-gradient(180deg,#c8c5d1,#aaa6b7); }
	.trend-label { width:100%; margin-top:7rpx; overflow:hidden; color:#68697b; font-size:16rpx; text-align:center; text-overflow:ellipsis; white-space:nowrap; }
	.history-divider { flex:0 0 auto; height:1rpx; margin:16rpx 0 17rpx; background:#efedf4; }
	.history-title { flex:0 0 auto; margin-bottom:12rpx; color:#292a38; font-size:26rpx; font-weight:720; }
	.history-list { width:100%; max-height:315rpx; min-height:0; flex:1 1 auto; overflow-y:auto; border:1rpx solid rgba(91,76,133,.1); border-radius:18rpx; }
	.history-row { display:grid; min-height:72rpx; align-items:center; grid-template-columns:minmax(0,1.25fr) 67rpx minmax(0,1.4fr); column-gap:9rpx; padding:12rpx 14rpx; border-bottom:1rpx solid #efedf4; }
	.history-row:first-child { background:#faf8ff; }
	.history-row:last-child { border-bottom:0; }
	.history-period { display:flex; min-width:0; flex-direction:column; }
	.history-week-label { color:#30313f; font-size:20rpx; font-weight:680; }
	.history-date-range { color:#77788a; font-size:16rpx; white-space:nowrap; }
	.history-score { color:#262733; font-size:20rpx; font-weight:680; white-space:nowrap; }
	.history-change { overflow:hidden; font-size:16rpx; font-weight:650; text-align:right; text-overflow:ellipsis; white-space:nowrap; }
	.change-decrease { color:#159541; } .change-increase { color:#dc3541; } .change-neutral { color:#8b8c9a; }
	.history-empty { display:flex; min-height:115rpx; flex:1 1 auto; align-items:center; justify-content:center; border-radius:18rpx; background:#faf9fc; color:#9999a8; font-size:20rpx; }
	.weekly-history-confirm { flex:0 0 auto; height:66rpx; margin:20rpx 0 0; padding:0; border:0 !important; border-radius:18rpx; background:#eee8ff !important; box-shadow:none !important; color:#6740d7; font-size:23rpx; font-weight:680; line-height:66rpx; }
	.weekly-history-confirm::after { border:0 !important; }
	.task-grid { display:flex; flex-direction:column; gap:18rpx; }
	.task-grid.editing { gap:40rpx; padding-bottom:24rpx; }
	.task-row-shell { position:relative; }
	.task-card-row { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-items:stretch; gap:18rpx; }
	.row-resizer { position:absolute; z-index:20; left:0; right:0; bottom:-22rpx; display:flex; align-items:center; height:44rpx; pointer-events:none; }
	.resize-touch { display:flex; flex:0 0 58rpx; align-items:center; justify-content:flex-start; width:58rpx; height:44rpx; touch-action:none; user-select:none; pointer-events:auto; }
	.resize-grip { display:flex; align-items:center; justify-content:center; width:42rpx; height:27rpx; border:1rpx solid rgba(111,70,232,.2); border-radius:9rpx; background:#f1ecff; box-shadow:0 4rpx 12rpx rgba(85,54,164,.13); color:#7050ce; }
	.resize-grip view { width:19rpx; height:2rpx; border-radius:2rpx; background:currentColor; box-shadow:0 -6rpx 0 currentColor,0 6rpx 0 currentColor; }
	.resize-line { min-width:0; height:2rpx; flex:1; background:linear-gradient(90deg,rgba(111,70,232,.38),rgba(111,70,232,.08)); pointer-events:none; }
	.subbar { justify-content:flex-start; } .back-button { width:70rpx; height:70rpx; margin:0 15rpx 0 0; padding:0 0 10rpx; border-radius:50%; background:rgba(255,255,255,.74); color:#252632; font-size:61rpx; font-weight:260; line-height:58rpx; }
	.subbar-title { flex:1; font-size:34rpx; font-weight:720; text-align:center; } .subbar-spacer { width:85rpx; } .searchbar { gap:3rpx; }
	.search-box { display:flex; align-items:center; min-width:0; flex:1; height:76rpx; padding:0 20rpx 0 25rpx; border:1rpx solid rgba(111,70,232,.18); border-radius:25rpx; background:rgba(255,255,255,.86); }
	.search-input { min-width:0; flex:1; height:70rpx; margin-left:22rpx; font-size:28rpx; } .clear-button { width:45rpx; height:45rpx; margin:0; padding:0 0 4rpx; border-radius:50%; background:#eeedf4; color:#707184; font-size:35rpx; line-height:39rpx; }
	.search-result-heading { margin:7rpx 3rpx 20rpx; color:#77788b; font-size:23rpx; }
	.empty-state { display:flex; align-items:center; flex-direction:column; justify-content:center; padding:70rpx 30rpx; color:#8d8e9f; text-align:center; } .first-empty { margin-top:12rpx; } .compact-empty { min-height:420rpx; } .trash-empty { min-height:650rpx; }
	.empty-check { display:flex; align-items:center; justify-content:center; width:105rpx; height:105rpx; margin-bottom:27rpx; border-radius:50%; background:linear-gradient(145deg,#8559f3,#6037d9); box-shadow:0 17rpx 35rpx rgba(96,55,217,.22); color:#fff; font-size:62rpx; }
	.empty-title { margin-bottom:11rpx; color:#3a3b4a; font-size:30rpx; font-weight:650; } .empty-copy { font-size:23rpx; }
	.empty-search { position:relative; width:60rpx; height:60rpx; margin:0 0 30rpx; border:8rpx solid #c7c3d8; border-radius:50%; } .empty-search::after { content:''; position:absolute; right:-31rpx; bottom:-17rpx; width:38rpx; height:8rpx; border-radius:8rpx; background:#c7c3d8; transform:rotate(46deg); }
	.trash-tip { margin:0 0 20rpx; padding:20rpx 23rpx; border-radius:19rpx; background:rgba(111,70,232,.07); color:#67687a; font-size:22rpx; line-height:1.55; }
	.large-trash-glyph { width:64rpx; height:70rpx; margin:0 0 38rpx; border-width:7rpx; border-color:#c7c3d8; } .large-trash-glyph::before { left:-11rpx; top:-15rpx; width:75rpx; height:7rpx; background:#c7c3d8; }
	.large-trash-glyph::after { left:16rpx; top:-27rpx; width:26rpx; height:11rpx; border-width:7rpx; border-color:#c7c3d8; } .large-trash-glyph>view { left:25rpx; top:18rpx; width:7rpx; height:32rpx; background:#c7c3d8; }
	.trash-list { display:flex; flex-direction:column; gap:15rpx; } .trash-item { display:flex; align-items:center; padding:23rpx 20rpx; border:1rpx solid rgba(88,73,132,.11); border-radius:22rpx; background:rgba(255,255,255,.87); box-shadow:0 9rpx 25rpx rgba(64,56,91,.045); }
	.trash-item-copy { display:flex; min-width:0; flex:1; flex-direction:column; } .trash-title { margin-bottom:7rpx; color:#363744; font-size:26rpx; overflow-wrap:anywhere; } .trash-date { color:#9696a5; font-size:20rpx; }
	.restore-button,.destroy-button { height:56rpx; margin:0 0 0 10rpx; padding:0 15rpx; border-radius:15rpx; font-size:20rpx; line-height:56rpx; } .restore-button { background:rgba(57,173,84,.1); color:#289b42; } .destroy-button { background:rgba(239,75,84,.09); color:#dd3d47; }
	.list-loading { display:flex; align-items:center; justify-content:center; min-height:180rpx; gap:15rpx; color:#868698; font-size:23rpx; } .loading-dot { width:25rpx; height:25rpx; border:4rpx solid rgba(111,70,232,.2); border-top-color:#6f46e8; border-radius:50%; animation:spin .8s linear infinite; }
	@keyframes spin { to { transform:rotate(360deg); } } .sync-error { display:flex; align-items:center; justify-content:space-between; margin-top:18rpx; padding:18rpx 21rpx; border-radius:17rpx; background:#fff1f2; color:#ca424a; font-size:21rpx; } .retry-text { margin-left:16rpx; font-weight:650; }
	.access-page { display:flex; align-items:center; flex-direction:column; justify-content:center; padding-bottom:100rpx; } .access-brand { display:flex; align-items:center; flex-direction:column; margin-bottom:43rpx; text-align:center; }
	.brand-mark { position:relative; width:105rpx; height:105rpx; margin-bottom:22rpx; border-radius:32rpx; background:linear-gradient(145deg,#875bf4,#5d35d7); box-shadow:0 20rpx 45rpx rgba(95,53,216,.24); }
	.brand-check { position:absolute; left:29rpx; top:29rpx; width:48rpx; height:28rpx; border-left:9rpx solid #fff; border-bottom:9rpx solid #fff; transform:rotate(-45deg); }
	.brand-title { color:#252632; font-size:42rpx; font-weight:750; } .brand-subtitle { margin-top:10rpx; color:#818294; font-size:23rpx; }
	.access-card { width:100%; padding:34rpx 29rpx; border:1rpx solid rgba(111,70,232,.14); border-radius:28rpx; background:rgba(255,255,255,.9); box-shadow:0 18rpx 45rpx rgba(69,51,111,.075); }
	.access-loading { display:flex; align-items:center; justify-content:center; gap:17rpx; color:#717285; font-size:25rpx; } .access-title { display:block; margin-bottom:13rpx; color:#292a37; font-size:34rpx; font-weight:720; }
	.access-copy { display:block; margin-bottom:27rpx; color:#747588; font-size:23rpx; line-height:1.65; } .access-input { height:83rpx; margin-bottom:17rpx; padding:0 22rpx; border:1rpx solid rgba(93,80,137,.15); border-radius:19rpx; background:#f8f7fb; color:#292a37; font-size:26rpx; }
	.access-error { display:block; margin:-3rpx 3rpx 17rpx; color:#df414b; font-size:21rpx; } .primary-button { display:flex; align-items:center; justify-content:center; height:84rpx; margin-top:8rpx; border-radius:21rpx; background:linear-gradient(145deg,#8257f3,#6037d9); box-shadow:0 13rpx 30rpx rgba(96,55,217,.22); color:#fff; font-size:27rpx; font-weight:650; }
	.primary-button[disabled] { opacity:.58; } .access-note { display:block; margin-top:22rpx; color:#9999a7; font-size:19rpx; line-height:1.5; text-align:center; }
	@media (min-width:700px) { .page-shell { padding:35px 0; } .page-content,.access-page { min-height:calc(100vh - 70px); border-radius:30px; background:rgba(250,249,253,.72); box-shadow:0 24px 80px rgba(54,42,92,.12); } }
</style>

<template>
	<view class="page-shell">
		<view v-if="accessState !== 'ready'" class="access-page">
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

		<template v-else>
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
						<view class="summary-card orange-summary">
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
						<button class="date-picker-button" :class="{ selected: selectedDate }" aria-label="选择任务日期" @tap="openCalendar">
							<view class="calendar-glyph"></view><text>{{ selectedDateLabel }}</text>
						</button>
						<input v-model="newTaskTitle" class="task-input" maxlength="120" placeholder="添加任务…" confirm-type="done" @confirm="createTask" />
						<button class="add-button" :class="{ disabled: !canCreateTask || loadingTasks }" :disabled="!canCreateTask || mutationBusy || loadingTasks" @tap="createTask"><text>+</text></button>
					</view>

					<view v-if="calendarOpen" class="calendar-mask" @tap="closeCalendar">
						<view class="calendar-panel" @tap.stop>
							<view class="calendar-header">
								<button class="month-button" aria-label="上个月" @tap="changeCalendarMonth(-1)">‹</button>
								<text class="calendar-title">{{ calendarTitle }}</text>
								<button class="month-button" aria-label="下个月" @tap="changeCalendarMonth(1)">›</button>
							</view>
							<view class="calendar-weekdays">
								<text v-for="weekday in calendarWeekdays" :key="weekday">{{ weekday }}</text>
							</view>
							<view class="calendar-days">
								<button v-for="day in calendarDays" :key="day.value" class="calendar-day" :class="{ muted: !day.currentMonth, today: day.value === currentDate, selected: day.value === calendarSelectedValue }" @tap="selectCalendarDate(day.value)">
									<text>{{ day.day }}</text>
								</button>
							</view>
							<view class="calendar-footer">
								<button class="calendar-cancel" @tap="closeCalendar">取消</button>
								<button class="calendar-today" @tap="selectCalendarDate(currentDate)">选择今天</button>
							</view>
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
					<view v-else-if="viewMode === 'list'" class="task-grid">
						<task-card title="未完成" tone="red" icon="hourglass" :tasks="displayOverdueTasks" :today="currentDate" @toggle="toggleTask" @remove="moveToTrash" @open="openCategory('overdue')" />
						<task-card title="今天" tone="blue" icon="sun" :tasks="displayTodayTasks" :today="currentDate" @toggle="toggleTask" @remove="moveToTrash" @open="openCategory('today')" />
						<task-card title="已完成" tone="green" icon="check" :tasks="displayCompletedTasks" :today="currentDate" @toggle="toggleTask" @remove="moveToTrash" @open="openCategory('completed')" />
						<task-card title="未来" tone="purple" icon="calendar" :tasks="displayFutureTasks" :today="currentDate" @toggle="toggleTask" @remove="moveToTrash" @open="openCategory('future')" />
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
	</view>
</template>

<script>
	import TaskCard from '../../components/TaskCard.vue'
	import TaskListRows from '../../components/TaskListRows.vue'

	const SECRET_STORAGE_KEY = 'daylist-sync-secret-v1'
	const pad = (value) => String(value).padStart(2, '0')
	const localDateString = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
	const parseDate = (value) => {
		const [year, month, day] = String(value).split('-').map(Number)
		return new Date(year, month - 1, day, 12, 0, 0)
	}
	const daysBetween = (earlier, later) => Math.max(0, Math.round((parseDate(later) - parseDate(earlier)) / 86400000))

	export default {
		components: { TaskCard, TaskListRows },
		data() {
			return {
				accessState: 'loading', accessBusy: false, accessError: '', secretInput: '', secretConfirm: '', secret: '', secretGateEnabled: true, taskService: null,
				tasks: [], loadingTasks: false, mutationBusy: false, syncError: '', viewMode: 'list', searchQuery: '', newTaskTitle: '', selectedDate: '',
				currentDate: localDateString(), calendarOpen: false, calendarCursor: localDateString(), calendarWeekdays: ['一', '二', '三', '四', '五', '六', '日'],
				metricNow: Date.now(), metricTimerId: null
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
			filteredActiveTasks() { const keyword = this.searchQuery.trim().toLocaleLowerCase(); return keyword ? this.activeTasks.filter((task) => task.title.toLocaleLowerCase().includes(keyword)) : this.activeTasks },
			overdueTasks() { return this.activeTasks.filter((task) => !task.completed && task.task_date < this.currentDate).sort(this.sortByDateThenCreated) },
			todayTasks() { return this.activeTasks.filter((task) => task.task_date === this.currentDate) },
			todayCompletedCount() { return this.todayTasks.filter((task) => task.completed).length },
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
			displayOverdueTasks() { return this.filteredActiveTasks.filter((task) => !task.completed && task.task_date < this.currentDate).sort(this.sortByDateThenCreated) },
			displayTodayTasks() { return this.filteredActiveTasks.filter((task) => !task.completed && task.task_date === this.currentDate).sort((a, b) => (b.created_at || 0) - (a.created_at || 0)) },
			displayCompletedTasks() { return this.filteredActiveTasks.filter((task) => task.completed).sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0)) },
			displayFutureTasks() { return this.filteredActiveTasks.filter((task) => !task.completed && task.task_date > this.currentDate).sort(this.sortByDateThenCreated) }
		},
		onLoad() { this.startMetricClock(); this.bootstrap() },
		onShow() {
			const today = localDateString()
			if (today !== this.currentDate) this.currentDate = today
			if (this.accessState === 'ready') this.loadTasks()
		},
		onUnload() { this.stopMetricClock() },
		beforeUnmount() { this.stopMetricClock() },
		onPullDownRefresh() {
			if (this.accessState !== 'ready') return uni.stopPullDownRefresh()
			this.loadTasks().finally(() => uni.stopPullDownRefresh())
		},
		methods: {
			startMetricClock() {
				this.stopMetricClock()
				this.metricNow = Date.now()
				this.metricTimerId = setInterval(() => {
					this.metricNow = Date.now()
					const today = localDateString()
					if (today !== this.currentDate) this.currentDate = today
				}, 15000)
			},
			stopMetricClock() {
				if (!this.metricTimerId) return
				clearInterval(this.metricTimerId)
				this.metricTimerId = null
			},
			sortByDateThenCreated(a, b) { return a.task_date.localeCompare(b.task_date) || (a.created_at || 0) - (b.created_at || 0) },
			getService() { if (!this.taskService) this.taskService = uniCloud.importObject('task-service', { customUI: true }); return this.taskService },
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
			},
			isSecretError(error) {
				const message = error && (error.errMsg || error.message || error.errCode) || ''
				return String(message).includes('INVALID_SECRET') || String(message).includes('ACCESS_LOCKED') || String(message).includes('同步口令')
			},
			openCalendar() {
				const date = parseDate(this.selectedDate || this.currentDate)
				this.calendarCursor = localDateString(new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0))
				this.calendarOpen = true
			},
			closeCalendar() { this.calendarOpen = false },
			changeCalendarMonth(offset) {
				const date = parseDate(this.calendarCursor)
				this.calendarCursor = localDateString(new Date(date.getFullYear(), date.getMonth() + offset, 1, 12, 0, 0))
			},
			selectCalendarDate(value) { this.selectedDate = value; this.calendarOpen = false },
			sanitizeSecretInput(event) { this.secretInput = String(event.detail.value || '').replace(/\D/g, '').slice(0, 32) },
			sanitizeSecretConfirm(event) { this.secretConfirm = String(event.detail.value || '').replace(/\D/g, '').slice(0, 32) },
			async createTask() {
				const title = this.newTaskTitle.trim(); if (!title || this.mutationBusy || this.loadingTasks) return
				this.mutationBusy = true
				try {
					await this.getService().createTask({ secret: this.secret, title, taskDate: this.selectedDate || this.currentDate })
					this.newTaskTitle = ''; this.selectedDate = ''; await this.loadTasks(); uni.showToast({ title: '已添加', icon: 'success' })
				} catch (error) { uni.showToast({ title: this.friendlyError(error, '添加失败'), icon: 'none' }) }
				finally { this.mutationBusy = false }
			},
			async toggleTask(task) { await this.mutate('setCompleted', { id: task._id, completed: !task.completed }, '更新失败') },
			async renameTask({ task, title }) { await this.mutate('renameTask', { id: task._id, title }, '修改失败') },
			async moveToTrash(task) { const ok = await this.mutate('moveToTrash', { id: task._id }, '删除失败'); if (ok) uni.showToast({ title: '已移入回收站', icon: 'none' }) },
			async restoreTask(task) { const ok = await this.mutate('restoreTask', { id: task._id }, '恢复失败'); if (ok) uni.showToast({ title: '已恢复', icon: 'success' }) },
			confirmPermanentDelete(task) {
				uni.showModal({ title: '永久删除任务？', content: `“${task.title}”删除后无法恢复。`, confirmText: '永久删除', confirmColor: '#e94b55', success: ({ confirm }) => { if (confirm) this.permanentDelete(task) } })
			},
			async permanentDelete(task) { const ok = await this.mutate('deleteForever', { id: task._id }, '永久删除失败'); if (ok) uni.showToast({ title: '已永久删除', icon: 'none' }) },
			async mutate(method, payload, fallback) {
				if (this.mutationBusy || this.loadingTasks) return false
				this.mutationBusy = true
				try { await this.getService()[method]({ secret: this.secret, ...payload }); await this.loadTasks(); return true }
				catch (error) { uni.showToast({ title: this.friendlyError(error, fallback), icon: 'none' }); return false }
				finally { this.mutationBusy = false }
			},
			openSearch() { this.searchQuery = ''; this.viewMode = 'search' },
			openCategory(category) { uni.navigateTo({ url: `/pages/task-list/task-list?category=${category}` }) },
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
	.page-content,.access-page { width: 100%; max-width: 430px; min-height: 100vh; margin: 0 auto; padding: calc(var(--status-bar-height, 0px) + 30rpx) 24rpx 54rpx; }
	.topbar,.subbar { display:flex; align-items:center; justify-content:space-between; min-height:90rpx; margin-bottom:20rpx; }
	.date-heading { display:flex; align-items:center; gap:11rpx; font-size:31rpx; font-weight:650; letter-spacing:.5rpx; }
	.date-dot { color:#77798b; } .weekday { color:#45465a; } .top-actions { display:flex; gap:16rpx; }
	.icon-button { position:relative; display:flex; align-items:center; justify-content:center; width:76rpx; height:76rpx; margin:0; padding:0; border:1rpx solid rgba(85,73,130,.12); border-radius:50%; background:rgba(255,255,255,.7); box-shadow:0 8rpx 22rpx rgba(77,65,120,.05); }
	.search-glyph { position:relative; width:27rpx; height:27rpx; border:5rpx solid #171824; border-radius:50%; }
	.search-glyph::after { content:''; position:absolute; width:18rpx; height:5rpx; right:-15rpx; bottom:-8rpx; border-radius:4rpx; background:#171824; transform:rotate(46deg); }
	.icon-button>.search-glyph { transform:translate(-5rpx,-5rpx); }
	.search-glyph.small { width:21rpx; height:21rpx; border-width:4rpx; } .search-glyph.small::after { width:14rpx; height:4rpx; right:-12rpx; bottom:-7rpx; }
	.trash-glyph,.large-trash-glyph { position:relative; width:28rpx; height:31rpx; border:4rpx solid #171824; border-top:none; border-radius:3rpx 3rpx 7rpx 7rpx; }
	.trash-glyph::before,.large-trash-glyph::before { content:''; position:absolute; left:-6rpx; top:-8rpx; width:33rpx; height:4rpx; border-radius:3rpx; background:#171824; }
	.trash-glyph::after,.large-trash-glyph::after { content:''; position:absolute; left:7rpx; top:-14rpx; width:12rpx; height:5rpx; border:4rpx solid #171824; border-bottom:none; border-radius:5rpx 5rpx 0 0; }
	.trash-glyph>view,.large-trash-glyph>view { position:absolute; left:10rpx; top:7rpx; width:4rpx; height:14rpx; border-radius:3rpx; background:#171824; }
	.icon-button>.trash-glyph { transform:translate(1rpx,6rpx); }
	.summary-grid,.task-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18rpx; } .summary-grid { margin-bottom:22rpx; }
	.summary-card { display:flex; align-items:center; min-height:164rpx; padding:24rpx 20rpx; border:1rpx solid rgba(111,70,232,.25); border-radius:27rpx; background:linear-gradient(135deg,rgba(250,248,255,.95),rgba(239,232,255,.85)); box-shadow:0 10rpx 28rpx rgba(96,68,161,.06); }
	.orange-summary { border-color:rgba(244,123,36,.25); background:linear-gradient(135deg,rgba(255,252,247,.98),rgba(255,239,224,.85)); }
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
	.add-button text { display:block; color:#fff !important; font-size:58rpx; font-weight:260; line-height:66rpx; transform:translateY(-2rpx); }
	.add-button.disabled { opacity:.62; box-shadow:none; }
	.calendar-mask { position:fixed; z-index:100; inset:0; display:flex; align-items:center; justify-content:center; padding:30rpx; background:rgba(28,24,43,.35); backdrop-filter:blur(7rpx); }
	.calendar-panel { width:100%; max-width:650rpx; padding:27rpx 24rpx 24rpx; border:1rpx solid rgba(111,70,232,.16); border-radius:34rpx; background:#fff; box-shadow:0 30rpx 90rpx rgba(39,27,76,.22); }
	.calendar-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:20rpx; }
	.calendar-title { color:#252633; font-size:31rpx; font-weight:720; }
	.month-button { display:flex; align-items:center; justify-content:center; width:68rpx; height:68rpx; margin:0; padding:0 0 8rpx; border-radius:50%; background:#f5f1ff; color:#6f46e8; font-size:53rpx; font-weight:300; line-height:58rpx; }
	.calendar-weekdays,.calendar-days { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); }
	.calendar-weekdays { margin-bottom:7rpx; } .calendar-weekdays text { color:#9999a8; font-size:21rpx; line-height:47rpx; text-align:center; }
	.calendar-day { display:flex; position:relative; align-items:center; justify-content:center; width:62rpx; height:62rpx; margin:3rpx auto; padding:0; border:0 !important; border-radius:50%; outline:none; background:transparent !important; box-shadow:none; color:#2d2e3a; font-size:24rpx; line-height:62rpx; }
	.calendar-day.muted { color:#c8c7cf; } .calendar-day.today { color:#6f46e8; font-weight:720; }
	.calendar-day.today::after { content:''; position:absolute; left:50%; bottom:5rpx; width:6rpx; height:6rpx; border-radius:50%; background:#7a4ced; transform:translateX(-50%); }
	.calendar-day.selected { background:linear-gradient(145deg,#8356f2,#6338da) !important; box-shadow:0 7rpx 18rpx rgba(99,56,218,.24); color:#fff; font-weight:700; }
	.calendar-day.selected::after { display:none; }
	.calendar-footer { display:flex; justify-content:flex-end; gap:15rpx; margin-top:21rpx; padding-top:20rpx; border-top:1rpx solid #efedf5; }
	.calendar-cancel,.calendar-today { height:66rpx; margin:0; padding:0 25rpx; border:0 !important; border-radius:18rpx; outline:none; box-shadow:none !important; font-size:23rpx; line-height:66rpx; }
	.calendar-cancel::after,.calendar-today::after { border:0 !important; }
	.calendar-cancel { background:#f4f3f7; color:#777889; } .calendar-today { background:#efe9ff; color:#6f46e8; font-weight:650; }
	.task-grid { align-items:stretch; }
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

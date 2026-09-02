<template>
	<view class="detail-shell">
		<view class="detail-content">
			<view class="detail-header">
				<button class="detail-back" aria-label="返回" @tap="goBack">‹</button>
				<view class="detail-heading">
					<text class="detail-title">{{ pageTitle }}</text>
					<text class="detail-count">{{ displayTasks.length }} 项</text>
				</view>
				<view class="header-spacer"></view>
			</view>

			<view v-if="loading" class="detail-loading"><view class="loading-dot"></view><text>同步中…</text></view>
			<view v-else-if="error" class="detail-error" @tap="loadTasks"><text>{{ error }}</text><text>点击重试</text></view>
			<view v-else-if="displayTasks.length === 0" class="detail-empty">
				<view class="empty-mark">✓</view>
				<text class="empty-title">{{ emptyTitle }}</text>
				<text class="empty-copy">返回首页可继续添加或调整任务</text>
			</view>
			<task-list-rows v-else :tasks="displayTasks" :today="currentDate" @toggle="toggleTask" @remove="moveToTrash" @rename="renameTask" />
		</view>
	</view>
</template>

<script>
	import TaskListRows from '../../components/TaskListRows.vue'

	const SECRET_STORAGE_KEY = 'daylist-sync-secret-v1'
	const pad = (value) => String(value).padStart(2, '0')
	const localDateString = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
	const categoryInfo = {
		overdue: { title: '未完成任务', empty: '没有逾期任务' },
		today: { title: '今天的任务', empty: '今天没有待完成任务' },
		completed: { title: '已完成任务', empty: '还没有已完成任务' },
		future: { title: '未来任务', empty: '没有未来任务' }
	}

	export default {
		components: { TaskListRows },
		data() {
			return {
				category: 'today', tasks: [], currentDate: localDateString(), secret: '', secretGateEnabled: true,
				taskService: null, loading: false, mutationBusy: false, error: '', hasLoaded: false
			}
		},
		computed: {
			pageTitle() { return categoryInfo[this.category].title },
			emptyTitle() { return categoryInfo[this.category].empty },
			activeTasks() { return this.tasks.filter((task) => !task.deleted) },
			displayTasks() {
				const tasks = this.activeTasks.filter((task) => {
					if (this.category === 'overdue') return !task.completed && task.task_date < this.currentDate
					if (this.category === 'today') return !task.completed && task.task_date === this.currentDate
					if (this.category === 'completed') return task.completed
					return !task.completed && task.task_date > this.currentDate
				})
				if (this.category === 'completed') return tasks.sort((a, b) => (b.completed_at || 0) - (a.completed_at || 0))
				if (this.category === 'today') return tasks.sort((a, b) => (b.created_at || 0) - (a.created_at || 0))
				return tasks.sort((a, b) => a.task_date.localeCompare(b.task_date) || (a.created_at || 0) - (b.created_at || 0))
			}
		},
		onLoad(options) {
			if (options && categoryInfo[options.category]) this.category = options.category
			this.loadSession()
		},
		onShow() {
			this.currentDate = localDateString()
			if (this.hasLoaded) this.loadTasks()
		},
		onPullDownRefresh() { this.loadTasks().finally(() => uni.stopPullDownRefresh()) },
		methods: {
			getService() {
				if (!this.taskService) this.taskService = uniCloud.importObject('task-service', { customUI: true })
				return this.taskService
			},
			acceptTasks(tasks) {
				this.tasks = Array.isArray(tasks) ? tasks : []
				uni.setStorageSync('daylist-task-cache-v1', this.tasks)
			},
			async loadSession() {
				if (this.loading) return
				this.loading = true; this.error = ''
				const cachedSecret = uni.getStorageSync(SECRET_STORAGE_KEY)
				try {
					const session = await this.getService().bootstrapSession({ secret: cachedSecret || '' })
					this.secretGateEnabled = session.secretEnabled !== false
					if (this.secretGateEnabled && !session.authenticated) {
						uni.showModal({ title: '需要同步口令', content: '请返回首页验证同步口令后再打开任务列表。', showCancel: false, success: () => this.goBack() })
						return
					}
					this.secret = this.secretGateEnabled ? cachedSecret : ''
					this.acceptTasks(session.tasks)
					this.hasLoaded = true
				} catch (error) {
					const cached = uni.getStorageSync('daylist-task-cache-v1')
					if (Array.isArray(cached)) this.tasks = cached
					this.error = this.friendlyError(error, '任务加载失败。')
				} finally { this.loading = false }
			},
			async loadTasks() {
				if (this.loading || (this.secretGateEnabled && !this.secret)) return
				this.loading = true; this.error = ''
				try {
					const result = await this.getService().listTasks({ secret: this.secret })
					this.acceptTasks(result.tasks)
				} catch (error) { this.error = this.friendlyError(error, '任务同步失败。') }
				finally { this.loading = false }
			},
			async toggleTask(task) { await this.mutate('setCompleted', { id: task._id, completed: !task.completed }, '更新失败') },
			async renameTask({ task, title }) { await this.mutate('renameTask', { id: task._id, title }, '修改失败') },
			async moveToTrash(task) {
				const ok = await this.mutate('moveToTrash', { id: task._id }, '删除失败')
				if (ok) uni.showToast({ title: '已移入回收站', icon: 'none' })
			},
			async mutate(method, payload, fallback) {
				if (this.mutationBusy || this.loading) return false
				this.mutationBusy = true
				try {
					await this.getService()[method]({ secret: this.secret, ...payload })
					await this.loadTasks()
					return true
				} catch (error) {
					uni.showToast({ title: this.friendlyError(error, fallback), icon: 'none' })
					return false
				} finally { this.mutationBusy = false }
			},
			friendlyError(error, fallback) {
				const message = error && (error.errMsg || error.message)
				if (!message) return fallback
				if (message.includes('INVALID_SECRET') || message.includes('同步口令不正确')) return '同步口令不正确。'
				if (message.includes('network') || message.includes('Network')) return '网络连接失败，请检查网络。'
				return message.length > 45 ? fallback : message
			},
			goBack() { uni.navigateBack() }
		}
	}
</script>

<style>
	.detail-shell { min-height:100vh; background:radial-gradient(circle at 92% 3%,rgba(115,72,232,.13),transparent 21%),linear-gradient(180deg,#fbfaff 0%,#f7f8fc 100%); }
	.detail-content { width:100%; max-width:430px; min-height:100vh; margin:0 auto; padding:calc(var(--status-bar-height,0px) + 30rpx) 24rpx 54rpx; }
	.detail-header { display:flex; align-items:center; min-height:90rpx; margin-bottom:24rpx; }
	.detail-back { display:flex; align-items:center; justify-content:center; width:70rpx; height:70rpx; margin:0; padding:0 0 9rpx; border:0 !important; border-radius:50%; background:rgba(255,255,255,.76) !important; box-shadow:0 8rpx 22rpx rgba(77,65,120,.05); color:#252632; font-size:61rpx; font-weight:260; line-height:58rpx; }
	.detail-back::after { border:0 !important; }
	.detail-heading { display:flex; min-width:0; flex:1; align-items:baseline; justify-content:center; gap:13rpx; }
	.detail-title { color:#292a38; font-size:34rpx; font-weight:730; } .detail-count { color:#89899a; font-size:21rpx; }
	.header-spacer { width:70rpx; }
	.detail-loading { display:flex; align-items:center; justify-content:center; min-height:400rpx; gap:15rpx; color:#858697; font-size:23rpx; }
	.loading-dot { width:25rpx; height:25rpx; border:4rpx solid rgba(111,70,232,.2); border-top-color:#6f46e8; border-radius:50%; animation:spin .8s linear infinite; }
	@keyframes spin { to { transform:rotate(360deg); } }
	.detail-error { display:flex; align-items:center; justify-content:space-between; padding:20rpx 22rpx; border-radius:18rpx; background:#fff1f2; color:#ca424a; font-size:21rpx; }
	.detail-empty { display:flex; align-items:center; flex-direction:column; justify-content:center; min-height:580rpx; color:#8d8e9f; text-align:center; }
	.empty-mark { display:flex; align-items:center; justify-content:center; width:88rpx; height:88rpx; margin-bottom:24rpx; border-radius:50%; background:#eee9fb; color:#7146df; font-size:48rpx; }
	.empty-title { margin-bottom:10rpx; color:#3a3b4a; font-size:29rpx; font-weight:650; } .empty-copy { font-size:21rpx; }
	@media (min-width:700px) { .detail-shell { padding:35px 0; } .detail-content { min-height:calc(100vh - 70px); border-radius:30px; background:rgba(250,249,253,.72); box-shadow:0 24px 80px rgba(54,42,92,.12); } }
</style>

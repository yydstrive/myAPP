<template>
	<view class="task-card" :class="`tone-${tone}`">
		<view class="card-heading">
			<view class="card-icon" :class="`icon-${icon}`">
				<text v-if="icon === 'hourglass'">⌛</text>
				<text v-else-if="icon === 'sun'">☀</text>
				<text v-else-if="icon === 'check'">✓</text>
				<text v-else>▤</text>
			</view>
			<text class="card-title">{{ title }}</text>
			<text class="card-count">{{ tasks.length }}</text>
			<text class="card-chevron">›</text>
		</view>
		<view v-if="tasks.length" class="card-tasks">
			<view v-for="task in tasks" :key="task._id" class="task-swipe">
				<button class="swipe-delete" :class="{ visible: openTaskId === task._id }" aria-label="删除任务" @tap="removeTask(task)">删除</button>
				<view class="task-row" :class="{ revealed: openTaskId === task._id }" @touchstart="onTouchStart(task, $event)" @touchend="onTouchEnd(task, $event)">
					<view class="task-checkbox-anchor">
						<button class="task-checkbox" :class="{ checked: task.completed }" :aria-label="task.completed ? '标记为未完成' : '标记为已完成'" @tap="$emit('toggle', task)">
							<text v-if="task.completed">✓</text>
						</button>
					</view>
					<view class="task-copy">
						<text class="task-title" :class="{ completed: task.completed }">{{ task.title }}</text>
						<text v-if="tone === 'red'" class="task-meta overdue-meta">逾期 {{ overdueDays(task) }} 天</text>
						<text v-else-if="tone === 'purple' || tone === 'green'" class="task-meta">{{ formatShortDate(task.task_date) }}</text>
					</view>
				</view>
			</view>
		</view>
		<view v-else class="card-empty">暂无任务</view>
	</view>
</template>

<script>
	const parseDate = (value) => {
		const [year, month, day] = String(value).split('-').map(Number)
		return new Date(year, month - 1, day, 12, 0, 0)
	}

	export default {
		name: 'TaskCard',
		props: {
			title: { type: String, required: true },
			tone: { type: String, required: true },
			icon: { type: String, required: true },
			tasks: { type: Array, default: () => [] },
			today: { type: String, required: true }
		},
		emits: ['toggle', 'remove'],
		data() {
			return { openTaskId: '', touchStartX: 0, touchStartY: 0 }
		},
		methods: {
			onTouchStart(task, event) {
				const touch = event.touches && event.touches[0]
				if (!touch) return
				this.touchStartX = touch.clientX
				this.touchStartY = touch.clientY
				if (this.openTaskId && this.openTaskId !== task._id) this.openTaskId = ''
			},
			onTouchEnd(task, event) {
				const touch = event.changedTouches && event.changedTouches[0]
				if (!touch) return
				const offsetX = touch.clientX - this.touchStartX
				const offsetY = touch.clientY - this.touchStartY
				if (Math.abs(offsetX) < Math.abs(offsetY) || Math.abs(offsetX) < 28) return
				if (offsetX < 0) this.openTaskId = task._id
				if (offsetX > 0) this.openTaskId = ''
			},
			removeTask(task) {
				this.openTaskId = ''
				this.$emit('remove', task)
			},
			formatShortDate(value) {
				const date = parseDate(value)
				const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
				return `${weekday} ${date.getMonth() + 1}/${date.getDate()}`
			},
			overdueDays(task) {
				return Math.max(0, Math.round((parseDate(this.today) - parseDate(task.task_date)) / 86400000))
			}
		}
	}
</script>

<style>
	.task-card { position:relative; min-height:340rpx; padding:23rpx 20rpx 20rpx; overflow:hidden; border:1rpx solid; border-radius:27rpx; box-shadow:0 12rpx 30rpx rgba(58,51,93,.065); }
	.task-card::after { content:''; position:absolute; right:-35rpx; bottom:-42rpx; width:135rpx; height:135rpx; border-radius:50%; opacity:.25; pointer-events:none; }
	.tone-red { border-color:rgba(255,87,96,.26); background:linear-gradient(145deg,rgba(255,253,253,.98),rgba(255,246,246,.94)); }
	.tone-blue { border-color:rgba(68,126,247,.23); background:linear-gradient(145deg,rgba(253,254,255,.98),rgba(244,248,255,.94)); }
	.tone-green { border-color:rgba(57,183,83,.24); background:linear-gradient(145deg,rgba(253,255,253,.98),rgba(243,252,245,.94)); }
	.tone-purple { border-color:rgba(123,76,237,.24); background:linear-gradient(145deg,rgba(255,254,255,.98),rgba(247,243,255,.95)); }
	.tone-red::after { background:#ffd9dc; } .tone-blue::after { background:#dce9ff; } .tone-green::after { background:#d6f3dc; } .tone-purple::after { background:#e5dbff; }
	.card-heading { display:flex; position:relative; z-index:1; align-items:center; min-width:0; margin-bottom:17rpx; }
	.card-icon { display:flex; flex:0 0 52rpx; align-items:center; justify-content:center; width:52rpx; height:52rpx; margin-right:10rpx; border-radius:50%; font-size:28rpx; font-weight:750; }
	.tone-red .card-icon { background:rgba(239,75,84,.12); color:#ef4b54; } .tone-blue .card-icon { background:rgba(61,112,242,.1); color:#3d70f2; }
	.tone-green .card-icon { background:rgba(57,173,84,.11); color:#39ad54; } .tone-purple .card-icon { background:rgba(111,70,232,.11); color:#6f46e8; }
	.card-icon.icon-sun { background:rgba(255,184,43,.17); color:#f2ab16; }
	.card-title { min-width:0; flex:1; font-size:31rpx; font-weight:720; } .tone-red .card-title { color:#f0353f; } .tone-blue .card-title { color:#3473f2; } .tone-green .card-title { color:#31ae4d; } .tone-purple .card-title { color:#7044dc; }
	.card-count { min-width:43rpx; height:43rpx; padding:0 8rpx; border-radius:14rpx; background:rgba(255,255,255,.78); color:inherit; font-size:23rpx; line-height:43rpx; text-align:center; }
	.card-chevron { width:24rpx; margin-left:5rpx; color:currentColor; font-size:42rpx; font-weight:300; line-height:43rpx; text-align:right; }
	.card-tasks { position:relative; z-index:1; }
	.task-swipe { position:relative; min-width:0; overflow:hidden; border-bottom:1rpx solid rgba(78,72,105,.075); } .task-swipe:last-child { border-bottom:none; }
	.task-row { display:flex; position:relative; z-index:2; align-items:flex-start; min-width:0; padding:16rpx 0; transition:transform .22s ease; }
	.task-row.revealed { transform:translateX(-94rpx); }
	.tone-red .task-row { background:#fff8f8; } .tone-blue .task-row { background:#f8fbff; } .tone-green .task-row { background:#f8fdf9; } .tone-purple .task-row { background:#faf8ff; }
	.swipe-delete { position:absolute; z-index:1; right:0; top:0; display:flex; align-items:center; justify-content:center; width:88rpx; height:100%; margin:0; padding:0; border:0 !important; border-radius:12rpx; background:#ef4b54 !important; box-shadow:none !important; color:#fff !important; font-size:21rpx; line-height:1; opacity:0; transition:opacity .16s ease; }
	.swipe-delete.visible { opacity:1; }
	.swipe-delete::after,.task-checkbox::after { border:0 !important; }
	.task-checkbox-anchor { display:flex; flex:0 0 39rpx; align-items:center; justify-content:center; width:39rpx; height:35rpx; margin-right:13rpx; }
	.task-checkbox { display:flex; align-items:center; justify-content:center; width:35rpx; height:35rpx; margin:0; padding:0; border:4rpx solid currentColor !important; border-radius:8rpx; background:rgba(255,255,255,.72) !important; box-shadow:none !important; color:#8b8da0; font-size:23rpx; line-height:1; }
	.tone-red .task-checkbox { color:#ef4b54; } .tone-blue .task-checkbox { color:#3d70f2; } .tone-green .task-checkbox { color:#39ad54; } .tone-purple .task-checkbox { color:#6f46e8; }
	.task-checkbox.checked { background:currentColor !important; } .task-checkbox.checked text { color:#fff; }
	.task-copy { display:flex; min-width:0; flex:1; flex-direction:column; }
	.task-title { display:block; width:100%; color:#292a38; font-size:24rpx; line-height:35rpx; overflow-wrap:anywhere; word-break:break-word; }
	.task-title.completed { color:#9293a2; text-decoration:line-through; }
	.task-meta { margin-top:5rpx; color:#8b8c9d; font-size:18rpx; } .overdue-meta { color:#ef4b54; }
	.card-empty { position:relative; z-index:1; display:flex; align-items:center; justify-content:center; min-height:205rpx; color:#aaaaba; font-size:22rpx; text-align:center; }
</style>

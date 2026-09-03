<template>
	<view class="task-card" :class="`tone-${tone}`" :style="{ height: `${cardHeight}rpx` }">
		<view class="card-heading">
			<view class="card-icon" :class="`icon-${icon}`">
				<text v-if="icon === 'hourglass'">⌛</text>
				<view v-else-if="icon === 'sun'" class="today-sun-glyph">
					<view v-for="ray in 8" :key="ray" class="today-sun-ray" :class="`ray-${ray}`"><view></view></view>
					<view class="today-sun-core"></view>
				</view>
				<view v-else-if="icon === 'check'" class="completed-check-glyph"></view>
				<view v-else class="future-calendar-glyph">
					<view class="future-calendar-ring ring-left"></view>
					<view class="future-calendar-ring ring-right"></view>
					<view class="future-calendar-bar"></view>
					<view class="future-calendar-dots"><view></view><view></view><view></view><view></view></view>
				</view>
			</view>
			<text class="card-title">{{ title }}</text>
			<text class="card-count">{{ tasks.length }}</text>
			<button class="card-open-button" :aria-label="`查看全部${title}任务`" @tap="$emit('open')">›</button>
		</view>
		<scroll-view v-if="tasks.length" scroll-y class="card-tasks" :show-scrollbar="false">
			<view v-for="task in tasks" :key="task._id" class="task-swipe">
				<button class="swipe-delete" :class="{ visible: openTaskId === task._id }" aria-label="删除任务" @tap="removeTask(task)">删除</button>
				<view class="task-row" :class="{ revealed: openTaskId === task._id }" @touchstart="onTouchStart(task, $event)" @touchend="onTouchEnd(task, $event)">
					<view class="task-checkbox-anchor">
						<button class="task-checkbox" :class="{ checked: task.completed }" :aria-label="task.completed ? '标记为未完成' : '标记为已完成'" @tap="$emit('toggle', task)">
							<view v-if="task.completed" class="task-check-glyph"></view>
						</button>
					</view>
					<view class="task-copy">
						<view class="task-title-wrap">
							<text class="task-title" :class="{ completed: task.completed }">{{ task.title }}</text>
						</view>
						<view class="task-meta-row">
							<text class="task-meta">{{ formatTaskDate(task.task_date, today) }}</text>
							<text v-if="tone === 'red'" class="overdue-badge">逾期 {{ overdueDays(task) }} 天</text>
						</view>
					</view>
				</view>
			</view>
		</scroll-view>
		<view v-else class="card-empty">暂无任务</view>
	</view>
</template>

<script>
	import { formatTaskDate } from '../utils/task-date.js'

	export default {
		name: 'TaskCard',
		props: {
			title: { type: String, required: true },
			tone: { type: String, required: true },
			icon: { type: String, required: true },
			cardHeight: { type: Number, default: 420 },
			tasks: { type: Array, default: () => [] },
			today: { type: String, required: true }
		},
		emits: ['toggle', 'remove', 'open'],
		data() {
			return { openTaskId: '', touchStartX: 0, touchStartY: 0 }
		},
		methods: {
			formatTaskDate,
			overdueDays(task) {
				const due = new Date(`${task.task_date}T12:00:00`)
				const today = new Date(`${this.today}T12:00:00`)
				return Math.max(1, Math.round((today - due) / 86400000))
			},
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
			}
		}
	}
</script>

<style>
	.task-card { display:flex; position:relative; height:420rpx; padding:23rpx 20rpx 20rpx; overflow:hidden; flex-direction:column; border:1rpx solid; border-radius:27rpx; box-shadow:0 12rpx 30rpx rgba(58,51,93,.065); }
	.task-card::after { content:''; position:absolute; right:-35rpx; bottom:-42rpx; width:135rpx; height:135rpx; border-radius:50%; opacity:.25; pointer-events:none; }
	.tone-red { border-color:rgba(255,87,96,.26); background:linear-gradient(145deg,rgba(255,253,253,.98),rgba(255,246,246,.94)); }
	.tone-blue { border-color:rgba(68,126,247,.23); background:linear-gradient(145deg,rgba(253,254,255,.98),rgba(244,248,255,.94)); }
	.tone-green { border-color:rgba(57,183,83,.24); background:linear-gradient(145deg,rgba(253,255,253,.98),rgba(243,252,245,.94)); }
	.tone-purple { border-color:rgba(123,76,237,.24); background:linear-gradient(145deg,rgba(255,254,255,.98),rgba(247,243,255,.95)); }
	.tone-red::after { background:#ffd9dc; } .tone-blue::after { background:#dce9ff; } .tone-green::after { background:#d6f3dc; } .tone-purple::after { background:#e5dbff; }
	.card-heading { display:flex; position:relative; z-index:1; flex:0 0 auto; align-items:center; min-width:0; margin-bottom:17rpx; }
	.card-icon { display:flex; flex:0 0 52rpx; align-items:center; justify-content:center; width:52rpx; height:52rpx; margin-right:10rpx; border-radius:50%; font-size:28rpx; font-weight:750; }
	.tone-red .card-icon { background:rgba(239,75,84,.12); color:#ef4b54; } .tone-blue .card-icon { background:rgba(61,112,242,.1); color:#3d70f2; }
	.tone-green .card-icon { background:rgba(57,173,84,.11); color:#39ad54; } .tone-purple .card-icon { background:rgba(111,70,232,.11); color:#6f46e8; }
	.card-icon.icon-sun { background:rgba(255,184,43,.17); color:#f2ab16; }
	.completed-check-glyph { box-sizing:border-box; width:13rpx; height:23rpx; margin-top:-5rpx; border-right:5rpx solid currentColor; border-bottom:5rpx solid currentColor; transform:rotate(45deg); }
	.today-sun-glyph { position:relative; width:37rpx; height:37rpx; }
	.today-sun-core { position:absolute; z-index:2; left:11rpx; top:11rpx; width:15rpx; height:15rpx; border-radius:50%; background:#f5b51b; box-shadow:0 0 6rpx rgba(245,181,27,.3); }
	.today-sun-ray { position:absolute; z-index:1; inset:0; transform-origin:center; }
	.today-sun-ray view { position:absolute; right:0; top:17rpx; width:6rpx; height:3rpx; border-radius:3rpx; background:#f5b51b; }
	.today-sun-ray.ray-1 { transform:rotate(0deg); } .today-sun-ray.ray-2 { transform:rotate(45deg); } .today-sun-ray.ray-3 { transform:rotate(90deg); } .today-sun-ray.ray-4 { transform:rotate(135deg); }
	.today-sun-ray.ray-5 { transform:rotate(180deg); } .today-sun-ray.ray-6 { transform:rotate(225deg); } .today-sun-ray.ray-7 { transform:rotate(270deg); } .today-sun-ray.ray-8 { transform:rotate(315deg); }
	.future-calendar-glyph { position:relative; width:30rpx; height:29rpx; overflow:visible; border:3rpx solid #7044dc; border-radius:5rpx; background:rgba(255,255,255,.58); }
	.future-calendar-ring { position:absolute; z-index:3; top:-7rpx; width:3rpx; height:10rpx; border-radius:3rpx; background:#7044dc; }
	.future-calendar-ring.ring-left { left:6rpx; } .future-calendar-ring.ring-right { right:6rpx; }
	.future-calendar-bar { position:absolute; left:0; right:0; top:6rpx; height:3rpx; background:#7044dc; }
	.future-calendar-dots { display:grid; position:absolute; left:5rpx; right:5rpx; bottom:4rpx; grid-template-columns:repeat(2,4rpx); justify-content:space-between; row-gap:3rpx; }
	.future-calendar-dots view { width:4rpx; height:4rpx; border-radius:1rpx; background:#7044dc; }
	.card-title { min-width:0; flex:1; font-size:31rpx; font-weight:720; } .tone-red .card-title { color:#f0353f; } .tone-blue .card-title { color:#3473f2; } .tone-green .card-title { color:#31ae4d; } .tone-purple .card-title { color:#7044dc; }
	.card-count { min-width:43rpx; height:43rpx; padding:0 8rpx; border-radius:14rpx; background:rgba(255,255,255,.78); color:inherit; font-size:23rpx; line-height:43rpx; text-align:center; }
	.card-open-button { display:flex; flex:0 0 29rpx; align-items:center; justify-content:flex-end; width:29rpx; height:48rpx; margin:0 0 0 3rpx; padding:0; border:0 !important; background:transparent !important; box-shadow:none !important; color:currentColor; font-size:42rpx; font-weight:300; line-height:43rpx; }
	.card-open-button::after { border:0 !important; }
	.card-tasks { position:relative; z-index:1; width:100%; height:0; min-height:0; flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; }
	.card-tasks::-webkit-scrollbar { display:none; width:0; height:0; }
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
	.task-checkbox.checked { background:currentColor !important; }
	.task-check-glyph { box-sizing:border-box; width:9rpx; height:17rpx; margin-top:-4rpx; border-right:4rpx solid #fff; border-bottom:4rpx solid #fff; transform:rotate(45deg); pointer-events:none; }
	.task-copy { display:flex; min-width:0; flex:1; flex-direction:column; }
	.task-title-wrap { position:relative; min-width:0; }
	.task-title { display:-webkit-box; width:100%; overflow:hidden; color:#292a38; font-size:24rpx; line-height:35rpx; overflow-wrap:anywhere; word-break:break-word; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
	.task-title.completed { color:#9293a2; text-decoration:line-through; }
	.task-meta-row { display:flex; min-width:0; align-items:center; justify-content:space-between; gap:8rpx; margin-top:5rpx; }
	.task-meta { min-width:0; color:#8b8c9d; font-size:18rpx; line-height:27rpx; }
	.overdue-badge { flex:0 0 auto; padding:2rpx 7rpx; border:2rpx solid #f2a1a7; border-radius:10rpx; background:#ffe7e9; box-shadow:0 3rpx 0 rgba(207,53,65,.12); color:#df3541; font-size:16rpx; font-weight:650; line-height:23rpx; white-space:nowrap; }
	.tone-red .task-meta { color:#e95a62; } .tone-blue .task-meta { color:#557bd7; } .tone-green .task-meta { color:#54a867; } .tone-purple .task-meta { color:#8065c7; }
	.card-empty { position:relative; z-index:1; display:flex; min-height:0; flex:1; align-items:center; justify-content:center; color:#aaaaba; font-size:22rpx; text-align:center; }
</style>

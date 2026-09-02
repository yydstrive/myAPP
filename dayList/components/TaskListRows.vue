<template>
	<view class="full-task-list">
		<view v-for="task in tasks" :key="task._id" class="list-swipe">
			<button class="list-delete" :class="{ visible: openTaskId === task._id }" aria-label="删除任务" @tap="removeTask(task)">删除</button>
			<view class="list-row" :class="[{ revealed: openTaskId === task._id }, `tone-${taskTone(task)}`]" @touchstart="onTouchStart(task, $event)" @touchend="onTouchEnd(task, $event)">
				<view class="list-checkbox-anchor">
					<button class="list-checkbox" :class="{ checked: task.completed }" :aria-label="task.completed ? '标记为未完成' : '标记为已完成'" @tap="$emit('toggle', task)">
						<text v-if="task.completed">✓</text>
					</button>
				</view>
				<view class="list-copy">
					<text class="list-title" :class="{ completed: task.completed }">{{ task.title }}</text>
					<view class="list-meta">
						<text>{{ formatTaskDate(task.task_date, today) }}</text>
						<text class="actual-date">实际完成日期：{{ formatCompletedDate(task.completed_at) }}</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
	import { formatCompletedDate, formatTaskDate } from '../utils/task-date.js'

	export default {
		name: 'TaskListRows',
		props: {
			tasks: { type: Array, default: () => [] },
			today: { type: String, required: true }
		},
		emits: ['toggle', 'remove'],
		data() {
			return { openTaskId: '', touchStartX: 0, touchStartY: 0 }
		},
		methods: {
			formatTaskDate,
			formatCompletedDate,
			taskTone(task) {
				if (task.completed) return 'green'
				if (task.task_date < this.today) return 'red'
				if (task.task_date === this.today) return 'blue'
				return 'purple'
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
	.full-task-list { overflow:hidden; border:1rpx solid rgba(91,76,133,.12); border-radius:26rpx; background:rgba(255,255,255,.91); box-shadow:0 12rpx 32rpx rgba(58,51,93,.055); }
	.list-swipe { position:relative; overflow:hidden; border-bottom:1rpx solid rgba(78,72,105,.085); } .list-swipe:last-child { border-bottom:none; }
	.list-row { display:flex; position:relative; z-index:2; align-items:flex-start; min-height:108rpx; padding:22rpx 22rpx; background:#fff; transition:transform .22s ease; }
	.list-row.revealed { transform:translateX(-118rpx); }
	.list-delete { position:absolute; z-index:1; top:0; right:0; display:flex; align-items:center; justify-content:center; width:112rpx; height:100%; margin:0; padding:0; border:0 !important; border-radius:0; background:#ef4b54 !important; box-shadow:none !important; color:#fff !important; font-size:24rpx; line-height:1; opacity:0; transition:opacity .16s ease; }
	.list-delete.visible { opacity:1; } .list-delete::after,.list-checkbox::after { border:0 !important; }
	.list-checkbox-anchor { display:flex; flex:0 0 42rpx; align-items:center; justify-content:center; width:42rpx; height:38rpx; margin-right:18rpx; }
	.list-checkbox { display:flex; align-items:center; justify-content:center; width:38rpx; height:38rpx; margin:0; padding:0; border:4rpx solid currentColor !important; border-radius:9rpx; background:#fff !important; box-shadow:none !important; font-size:24rpx; line-height:1; }
	.tone-red .list-checkbox { color:#ef4b54; } .tone-blue .list-checkbox { color:#3d70f2; } .tone-green .list-checkbox { color:#39ad54; } .tone-purple .list-checkbox { color:#6f46e8; }
	.list-checkbox.checked { background:currentColor !important; } .list-checkbox.checked text { color:#fff; }
	.list-copy { display:flex; min-width:0; flex:1; flex-direction:column; }
	.list-title { display:block; width:100%; color:#292a38; font-size:27rpx; line-height:38rpx; overflow-wrap:anywhere; word-break:break-word; }
	.list-title.completed { color:#8e8f9e; text-decoration:line-through; }
	.list-meta { display:flex; align-items:center; justify-content:flex-start; gap:44rpx; margin-top:8rpx; color:#8a8b9b; font-size:19rpx; line-height:29rpx; }
	.actual-date { flex:0 0 auto; text-align:left; }
</style>

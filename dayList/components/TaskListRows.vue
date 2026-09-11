<template>
	<view class="task-list-shell">
		<view class="full-task-list">
			<view v-for="task in tasks" :key="task._id" class="list-swipe">
				<button class="list-delete" :class="{ visible: openTaskId === task._id }" aria-label="删除任务" @tap.stop="removeTask(task)">删除</button>
				<view class="list-row" :class="[{ revealed: openTaskId === task._id }, `tone-${taskTone(task)}`]" @touchstart="onTouchStart(task, $event)" @touchmove="onTouchMove($event)" @touchend="onTouchEnd(task, $event)">
					<view class="list-checkbox-anchor">
						<button class="list-checkbox" :class="{ checked: task.completed }" :aria-label="task.completed ? '标记为未完成' : '标记为已完成'" @tap.stop="$emit('toggle', task)">
							<view v-if="task.completed" class="list-check-glyph"></view>
						</button>
					</view>
					<view class="list-copy" @tap.stop="startEdit(task)">
						<text class="list-title" :class="{ completed: task.completed }">{{ task.title }}</text>
						<view class="list-meta">
							<text>{{ formatTaskDate(task.task_date, today) }}</text>
							<text class="actual-date">实际完成日期：{{ formatCompletedDate(task.completed_at) }}</text>
							<text v-if="taskPriority(task) !== 'medium'" class="list-priority-badge" :class="`priority-${taskPriority(task)}`">{{ taskPriority(task) === 'high' ? '高' : '低' }}</text>
						</view>
					</view>
				</view>
			</view>
		</view>

		<view v-if="editingTask" class="edit-mask" @tap="cancelEdit">
			<view class="edit-dialog" @tap.stop>
				<text class="edit-title">修改任务内容</text>
				<input v-model="editTitle" class="edit-input" :focus="Boolean(editingTask)" maxlength="120" confirm-type="done" placeholder="请输入任务内容" @confirm="saveEdit" />
				<view class="edit-actions">
					<button class="edit-cancel" @tap="cancelEdit">取消</button>
					<button class="edit-save" :disabled="!editTitle.trim()" @tap="saveEdit">保存</button>
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
		emits: ['toggle', 'remove', 'rename'],
		data() {
			return { openTaskId: '', touchStartX: 0, touchStartY: 0, gestureBlockUntil: 0, editingTask: null, editTitle: '' }
		},
		methods: {
			formatTaskDate,
			formatCompletedDate,
			taskPriority(task) {
				return task && (task.priority === 'low' || task.priority === 'high') ? task.priority : 'medium'
			},
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
				this.gestureBlockUntil = 0
				if (this.openTaskId && this.openTaskId !== task._id) this.openTaskId = ''
			},
			onTouchMove(event) {
				const touch = event.touches && event.touches[0]
				if (!touch) return
				const offsetX = touch.clientX - this.touchStartX
				const offsetY = touch.clientY - this.touchStartY
				if (Math.abs(offsetX) > 10 || Math.abs(offsetY) > 10) this.gestureBlockUntil = Date.now() + 800
			},
			onTouchEnd(task, event) {
				const touch = event.changedTouches && event.changedTouches[0]
				if (!touch) return
				const offsetX = touch.clientX - this.touchStartX
				const offsetY = touch.clientY - this.touchStartY
				if (Math.abs(offsetX) < Math.abs(offsetY) || Math.abs(offsetX) < 28) return
				this.gestureBlockUntil = Date.now() + 800
				if (offsetX < 0) this.openTaskId = task._id
				if (offsetX > 0) this.openTaskId = ''
			},
			startEdit(task) {
				if (Date.now() < this.gestureBlockUntil) return
				if (this.openTaskId === task._id) {
					this.openTaskId = ''
					return
				}
				this.openTaskId = ''
				this.editingTask = task
				this.editTitle = task.title
			},
			cancelEdit() {
				this.editingTask = null
				this.editTitle = ''
			},
			saveEdit() {
				if (!this.editingTask) return
				const title = this.editTitle.trim()
				if (!title) return uni.showToast({ title: '请输入任务内容', icon: 'none' })
				if (title !== this.editingTask.title) this.$emit('rename', { task: this.editingTask, title })
				this.cancelEdit()
			},
			removeTask(task) {
				this.openTaskId = ''
				this.$emit('remove', task)
			}
		}
	}
</script>

<style>
	.task-list-shell { position:relative; }
	.full-task-list { overflow:hidden; border:1rpx solid rgba(91,76,133,.12); border-radius:26rpx; background:rgba(255,255,255,.91); box-shadow:0 12rpx 32rpx rgba(58,51,93,.055); }
	.list-swipe { position:relative; overflow:hidden; border-bottom:1rpx solid rgba(78,72,105,.085); } .list-swipe:last-child { border-bottom:none; }
	.list-row { display:flex; position:relative; z-index:2; align-items:flex-start; min-height:108rpx; padding:22rpx 22rpx; background:#fff; transition:transform .22s ease; }
	.list-row.revealed { transform:translateX(-118rpx); }
	.list-delete { position:absolute; z-index:1; top:0; right:0; display:flex; align-items:center; justify-content:center; width:112rpx; height:100%; margin:0; padding:0; border:0 !important; border-radius:0; background:#ef4b54 !important; box-shadow:none !important; color:#fff !important; font-size:24rpx; line-height:1; opacity:0; transition:opacity .16s ease; }
	.list-delete.visible { opacity:1; } .list-delete::after,.list-checkbox::after { border:0 !important; }
	.list-checkbox-anchor { display:flex; flex:0 0 42rpx; align-items:center; justify-content:center; width:42rpx; height:38rpx; margin-right:18rpx; }
	.list-checkbox { display:flex; align-items:center; justify-content:center; width:38rpx; height:38rpx; margin:0; padding:0; border:4rpx solid currentColor !important; border-radius:9rpx; background:#fff !important; box-shadow:none !important; font-size:24rpx; line-height:1; }
	.tone-red .list-checkbox { color:#ef4b54; } .tone-blue .list-checkbox { color:#3d70f2; } .tone-green .list-checkbox { color:#39ad54; } .tone-purple .list-checkbox { color:#6f46e8; }
	.list-checkbox.checked { background:currentColor !important; }
	.list-check-glyph { box-sizing:border-box; width:10rpx; height:19rpx; margin-top:-4rpx; border-right:4rpx solid #fff; border-bottom:4rpx solid #fff; transform:rotate(45deg); pointer-events:none; }
	.list-copy { display:flex; min-width:0; flex:1; flex-direction:column; }
	.list-title { display:block; width:100%; color:#292a38; font-size:27rpx; line-height:38rpx; overflow-wrap:anywhere; word-break:break-word; }
	.list-title.completed { color:#8e8f9e; text-decoration:line-through; }
	.list-meta { display:flex; align-items:center; justify-content:flex-start; gap:44rpx; margin-top:8rpx; color:#8a8b9b; font-size:19rpx; line-height:29rpx; }
	.actual-date { flex:0 0 auto; text-align:left; }
	.list-priority-badge { flex:0 0 auto; margin-left:auto; padding:2rpx 8rpx; border:2rpx solid; border-radius:10rpx; font-size:16rpx; font-weight:650; line-height:23rpx; white-space:nowrap; }
	.list-priority-badge.priority-low { border-color:#f2bc7e; background:#fff0dd; box-shadow:0 3rpx 0 rgba(207,123,37,.11); color:#df7b25; }
	.list-priority-badge.priority-high { border-color:#f2a1a7; background:#ffe7e9; box-shadow:0 3rpx 0 rgba(207,53,65,.12); color:#df3541; }
	.edit-mask { position:fixed; z-index:1000; inset:0; display:flex; align-items:center; justify-content:center; padding:36rpx; background:rgba(28,25,42,.38); }
	.edit-dialog { width:100%; max-width:650rpx; padding:30rpx 28rpx 24rpx; border:1rpx solid rgba(111,70,232,.16); border-radius:28rpx; background:#fff; box-shadow:0 24rpx 70rpx rgba(35,27,65,.2); }
	.edit-title { display:block; margin-bottom:22rpx; color:#292a38; font-size:29rpx; font-weight:700; }
	.edit-input { box-sizing:border-box; width:100%; height:82rpx; padding:0 20rpx; border:2rpx solid #d8cdf7; border-radius:18rpx; background:#faf8ff; color:#292a38; font-size:25rpx; }
	.edit-actions { display:flex; justify-content:flex-end; gap:18rpx; margin-top:24rpx; }
	.edit-cancel,.edit-save { width:150rpx; height:68rpx; margin:0; padding:0; border:0 !important; border-radius:17rpx; font-size:23rpx; line-height:68rpx; }
	.edit-cancel { background:#f2f1f6 !important; color:#666778 !important; }
	.edit-save { background:#7046e8 !important; color:#fff !important; }
	.edit-save[disabled] { opacity:.45; }
	.edit-cancel::after,.edit-save::after { border:0 !important; }
</style>

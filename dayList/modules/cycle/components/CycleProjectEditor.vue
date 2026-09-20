<template>
	<view v-if="visible" class="cycle-editor-mask" @tap="close">
		<view class="cycle-editor" @tap.stop>
			<view class="cycle-editor-header"><text>{{ editing ? '修改周期项目' : '新增周期项目' }}</text><button aria-label="关闭" @tap="close">×</button></view>
			<text class="cycle-field-label">项目名称</text>
			<input v-model="editorTitle" class="cycle-editor-input" maxlength="60" placeholder="例如：充电、洗头等" />
			<text class="cycle-field-label">打卡说明</text>
			<input v-model="editorDescription" class="cycle-editor-input" maxlength="120" placeholder="选填，可在此处写入打卡方式、步骤或说明" />
			<text class="cycle-field-label">小图标</text>
			<view class="cycle-icon-presets">
				<button v-for="preset in iconPresets" :key="preset.label" class="cycle-icon-preset" :class="{ selected: editorIcon === preset.icon }" :aria-label="`${editorIcon === preset.icon ? '取消选择' : '选择'}${preset.label}图标`" @tap="toggleIconPreset(preset.icon)">
					<text class="cycle-icon-preset-symbol">{{ preset.icon }}</text><text>{{ preset.label }}</text>
				</button>
			</view>
			<text class="cycle-field-label">主页样式</text>
			<view class="cycle-segment-options">
				<button :class="{ selected: editorViewMode === 'week' }" @tap="editorViewMode = 'week'">周视图</button>
				<button :class="{ selected: editorViewMode === 'month' }" @tap="editorViewMode = 'month'">月视图</button>
			</view>
			<view class="cycle-plan-heading"><text class="cycle-field-label">设定周期间隔</text></view>
			<view class="cycle-plan-row">
				<input v-model="editorIntervalValue" class="cycle-editor-input cycle-plan-input" type="number" maxlength="3" placeholder="选填" @input="sanitizeInterval" />
				<view class="cycle-unit-options">
					<button :class="{ selected: editorIntervalUnit === 'day' }" @tap="editorIntervalUnit = 'day'">天</button>
					<button :class="{ selected: editorIntervalUnit === 'month' }" @tap="editorIntervalUnit = 'month'">月</button>
				</view>
			</view>
			<text class="cycle-plan-note">设置后，将按上次打卡时间预计下一次日期</text>
			<view class="cycle-editor-actions"><button class="cycle-editor-cancel" :disabled="busy" @tap="close">取消</button><button class="cycle-editor-save" :disabled="!canSave || busy" @tap="save">{{ editing ? '保存修改' : '创建' }}</button></view>
		</view>
	</view>
</template>

<script>
	export default {
		name: 'CycleProjectEditor',
		props: {
			visible: { type: Boolean, default: false },
			cycle: { type: Object, default: null },
			busy: { type: Boolean, default: false }
		},
		data() {
			return {
				editorTitle: '', editorDescription: '', editorIcon: '', editorViewMode: 'week', editorIntervalValue: '', editorIntervalUnit: 'day',
				iconPresets: [
					{ label: '煤气灶', icon: '🔥' }, { label: '电池', icon: '🔋' }, { label: '内裤', icon: '🩲' }, { label: '洗头', icon: '🧴' }, { label: '袜子', icon: '🧦' },
					{ label: '鼠标', icon: '🖱️' }, { label: '汽车', icon: '🚗' }, { label: '爱心', icon: '❤️' }, { label: '玫瑰花', icon: '🌹' }, { label: '身份认证', icon: '🪪' }
				]
			}
		},
		computed: {
			editing() { return Boolean(this.cycle && this.cycle._id) },
			canSave() {
				if (!this.editorTitle.trim()) return false
				if (!this.editorIntervalValue) return true
				const value = Number(this.editorIntervalValue)
				return Number.isInteger(value) && value >= 1 && value <= 999
			}
		},
		watch: {
			visible: { immediate: true, handler(value) { if (value) this.loadDraft() } },
			cycle: { deep: true, handler() { if (this.visible) this.loadDraft() } }
		},
		methods: {
			loadDraft() {
				const cycle = this.cycle
				this.editorTitle = cycle ? cycle.title || '' : ''
				this.editorDescription = cycle ? cycle.checkin_description || '' : ''
				this.editorIcon = cycle ? cycle.icon || '' : ''
				this.editorViewMode = cycle && cycle.view_mode === 'month' ? 'month' : 'week'
				this.editorIntervalValue = cycle && cycle.interval_value ? String(cycle.interval_value) : ''
				this.editorIntervalUnit = cycle && cycle.interval_unit === 'month' ? 'month' : 'day'
			},
			close() { if (!this.busy) this.$emit('close') },
			toggleIconPreset(icon) { this.editorIcon = this.editorIcon === icon ? '' : icon },
			sanitizeInterval(event) { this.editorIntervalValue = String(event.detail.value || '').replace(/\D/g, '').slice(0, 3) },
			save() {
				if (!this.canSave || this.busy) return
				this.$emit('save', { title: this.editorTitle.trim(), description: this.editorDescription.trim(), icon: this.editorIcon, viewMode: this.editorViewMode, intervalValue: this.editorIntervalValue, intervalUnit: this.editorIntervalUnit })
			}
		}
	}
</script>

<style>
	.cycle-editor-mask { position:fixed; z-index:1000; inset:0; display:flex; align-items:flex-end; justify-content:center; padding:30rpx 24rpx calc(30rpx + env(safe-area-inset-bottom)); background:rgba(28,25,42,.42); }
	.cycle-editor { overflow-y:auto; width:100%; max-width:430px; max-height:calc(100vh - 90rpx - env(safe-area-inset-bottom)); padding:28rpx 27rpx 25rpx; border:1rpx solid rgba(111,70,232,.15); border-radius:31rpx; background:#fff; box-shadow:0 26rpx 80rpx rgba(35,27,65,.23); }
	.cycle-editor-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:22rpx; }.cycle-editor-header>text { color:#292a38; font-size:29rpx; font-weight:730; }.cycle-editor-header button { width:55rpx; height:55rpx; margin:0; padding:0 0 5rpx; border:0 !important; border-radius:50%; background:#f2f0f7 !important; color:#777687; font-size:38rpx; line-height:52rpx; }.cycle-editor-header button::after { border:0 !important; }
	.cycle-editor-input { box-sizing:border-box; width:100%; height:78rpx; margin-bottom:22rpx; padding:0 20rpx; border:2rpx solid #ddd5f5; border-radius:18rpx; background:#faf8ff; color:#292a38; font-size:24rpx; }.cycle-field-label { display:block; margin:0 0 10rpx 2rpx; color:#575767; font-size:24rpx; font-weight:650; }.cycle-icon-presets { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8rpx; margin-bottom:22rpx; }.cycle-icon-preset { display:flex; min-width:0; height:94rpx; align-items:center; flex-direction:column; justify-content:center; gap:2rpx; margin:0; padding:0; border:2rpx solid transparent !important; border-radius:15rpx; background:#f3f1f7 !important; color:#777687; font-size:24rpx; line-height:29rpx; white-space:nowrap; }.cycle-icon-preset::after { border:0 !important; }.cycle-icon-preset.selected { border-color:rgba(111,70,232,.32) !important; background:#eee9fb !important; color:#6037d9; font-weight:650; }.cycle-icon-preset-symbol { font-size:31rpx; line-height:36rpx; }
	.cycle-segment-options,.cycle-unit-options { display:flex; gap:8rpx; padding:7rpx; border-radius:19rpx; background:#f3f1f7; }.cycle-segment-options { margin-bottom:23rpx; }.cycle-segment-options button,.cycle-unit-options button { flex:1; height:60rpx; margin:0; padding:0; border:0 !important; border-radius:14rpx; background:transparent !important; color:#858494; font-size:24rpx; line-height:60rpx; }.cycle-segment-options button.selected,.cycle-unit-options button.selected { background:#fff !important; box-shadow:0 6rpx 16rpx rgba(54,42,92,.09) !important; color:#7046e8; font-weight:680; }.cycle-segment-options button::after,.cycle-unit-options button::after { border:0 !important; }
	.cycle-plan-heading { display:flex; align-items:center; }.cycle-plan-row { display:flex; align-items:center; gap:12rpx; }.cycle-plan-input { flex:0 0 150rpx; width:150rpx; min-width:0; margin:0; text-align:center; }.cycle-unit-options { min-width:0; flex:1; }.cycle-plan-note { display:block; margin:9rpx 2rpx 0; color:#a09ead; font-size:24rpx; }
	.cycle-editor-actions { display:flex; gap:14rpx; margin-top:27rpx; }.cycle-editor-cancel,.cycle-editor-save { flex:1; height:72rpx; margin:0; padding:0; border:0 !important; border-radius:18rpx; font-size:24rpx; line-height:72rpx; }.cycle-editor-cancel { background:#f1f0f5 !important; color:#686878 !important; }.cycle-editor-save { background:#7046e8 !important; color:#fff !important; }.cycle-editor-save[disabled] { opacity:.43; }.cycle-editor-cancel::after,.cycle-editor-save::after { border:0 !important; }
	@media (min-width:700px) { .cycle-editor-mask { align-items:center; } }
</style>

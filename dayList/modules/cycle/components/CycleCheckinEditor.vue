<template>
	<view v-if="visible" class="checkin-editor-mask" @tap="close">
		<view class="checkin-editor" @tap.stop>
			<view class="checkin-editor-header">
				<view><text class="checkin-editor-title">{{ completed ? '打卡备注' : '补签' }}</text><text class="checkin-editor-date">{{ fullDate }}</text></view>
				<button aria-label="关闭" @tap="close">×</button>
			</view>
			<view class="checkin-note-field">
				<textarea v-model="draftNote" maxlength="200" auto-height placeholder="写下这次打卡的备注（选填）" :disabled="busy"></textarea>
				<text>{{ draftNote.length }}/200</text>
			</view>
			<view class="checkin-editor-actions">
				<button class="checkin-cancel" :disabled="busy" @tap="close">取消</button>
				<button class="checkin-save" :disabled="busy" @tap="save">{{ completed ? '保存备注' : '确认补签' }}</button>
			</view>
			<button v-if="completed && allowRemove" class="checkin-remove" :disabled="busy" @tap="remove">取消打卡</button>
		</view>
	</view>
</template>

<script>
	export default {
		name: 'CycleCheckinEditor',
		props: {
			visible: { type: Boolean, default: false },
			date: { type: String, default: '' },
			note: { type: String, default: '' },
			completed: { type: Boolean, default: false },
			allowRemove: { type: Boolean, default: false },
			busy: { type: Boolean, default: false }
		},
		data() { return { draftNote: '' } },
		computed: {
			fullDate() {
				const [year, month, day] = String(this.date).split('-').map(Number)
				return year && month && day ? `${year}年${month}月${day}日` : ''
			}
		},
		watch: {
			visible: { immediate: true, handler(value) { if (value) this.draftNote = this.note || '' } },
			note(value) { if (this.visible) this.draftNote = value || '' }
		},
		methods: {
			close() { if (!this.busy) this.$emit('close') },
			save() { if (!this.busy) this.$emit('save', this.draftNote.trim()) },
			remove() { if (!this.busy) this.$emit('remove') }
		}
	}
</script>

<style>
	.checkin-editor-mask { position:fixed; z-index:1100; inset:0; display:flex; align-items:flex-end; justify-content:center; padding:30rpx 24rpx calc(30rpx + env(safe-area-inset-bottom)); background:rgba(28,25,42,.42); }
	.checkin-editor { width:100%; max-width:430px; padding:28rpx 27rpx 24rpx; border:1rpx solid rgba(111,70,232,.15); border-radius:31rpx; background:#fff; box-shadow:0 26rpx 80rpx rgba(35,27,65,.23); }
	.checkin-editor-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:21rpx; }.checkin-editor-header>view { display:flex; flex-direction:column; }.checkin-editor-title { color:#292a38; font-size:29rpx; font-weight:730; }.checkin-editor-date { margin-top:5rpx; color:#858494; font-size:20rpx; }.checkin-editor-header button { width:55rpx; height:55rpx; margin:0; padding:0 0 5rpx; border:0 !important; border-radius:50%; background:#f2f0f7 !important; color:#777687; font-size:38rpx; line-height:52rpx; }.checkin-editor-header button::after { border:0 !important; }
	.checkin-note-field { position:relative; padding:18rpx 18rpx 39rpx; border:2rpx solid #ddd5f5; border-radius:19rpx; background:#faf8ff; }.checkin-note-field textarea { box-sizing:border-box; width:100%; min-height:145rpx; max-height:290rpx; color:#292a38; font-size:24rpx; line-height:36rpx; }.checkin-note-field>text { position:absolute; right:16rpx; bottom:11rpx; color:#aaa8b5; font-size:17rpx; }
	.checkin-editor-actions { display:flex; gap:14rpx; margin-top:23rpx; }.checkin-cancel,.checkin-save { flex:1; height:72rpx; margin:0; padding:0; border:0 !important; border-radius:18rpx; font-size:23rpx; line-height:72rpx; }.checkin-cancel { background:#f1f0f5 !important; color:#686878 !important; }.checkin-save { background:#7046e8 !important; color:#fff !important; }.checkin-cancel::after,.checkin-save::after,.checkin-remove::after { border:0 !important; }
	.checkin-remove { height:58rpx; margin:15rpx auto 0; padding:0 22rpx; border:0 !important; background:transparent !important; color:#b28f94; font-size:24rpx; font-weight:400; line-height:58rpx; text-decoration:underline; text-decoration-color:rgba(178,143,148,.4); }
	@media (min-width:700px) { .checkin-editor-mask { align-items:center; } }
</style>

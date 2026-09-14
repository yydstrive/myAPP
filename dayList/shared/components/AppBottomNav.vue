<template>
	<view class="bottom-nav-wrap">
		<view class="bottom-nav">
			<button class="nav-item" :class="{ active: active === 'schedule' }" aria-label="切换到日程" @tap="switchModule('schedule')">
				<view class="nav-icon schedule-icon">
					<view class="schedule-line schedule-line-one"></view>
					<view class="schedule-line schedule-line-two"></view>
				</view>
				<text>日程</text>
			</button>
			<button class="nav-item" :class="{ active: active === 'cycle' }" aria-label="切换到周期" @tap="switchModule('cycle')">
				<view class="nav-icon cycle-icon">
					<view class="mobius-loop mobius-loop-left"></view>
					<view class="mobius-loop mobius-loop-right"></view>
					<view class="mobius-twist"></view>
				</view>
				<text>周期</text>
			</button>
		</view>
	</view>
</template>

<script>
	export default {
		name: 'AppBottomNav',
		props: { active: { type: String, required: true } },
		methods: {
			switchModule(moduleName) {
				if (moduleName === this.active) return
				const url = moduleName === 'cycle' ? '/pages/cycle/index' : '/pages/schedule/index'
				uni.redirectTo({ url })
			}
		}
	}
</script>

<style>
	.bottom-nav-wrap { position:fixed; z-index:880; right:0; bottom:0; left:0; padding:12rpx 24rpx calc(12rpx + env(safe-area-inset-bottom)); pointer-events:none; }
	.bottom-nav { display:flex; width:100%; max-width:382px; height:108rpx; margin:0 auto; padding:9rpx; border:1rpx solid rgba(90,73,139,.14); border-radius:31rpx; background:rgba(255,255,255,.94); box-shadow:0 16rpx 46rpx rgba(48,38,82,.16); backdrop-filter:blur(20px); pointer-events:auto; }
	.nav-item { display:flex; flex:1; align-items:center; justify-content:center; gap:12rpx; height:90rpx; margin:0; padding:0; border:0 !important; border-radius:24rpx; background:transparent !important; box-shadow:none !important; color:#9291a2; font-size:23rpx; font-weight:650; line-height:90rpx; transition:background .18s ease,color .18s ease; }
	.nav-item::after { border:0 !important; }
	.nav-item.active { background:linear-gradient(135deg,#eee9ff,#f3efff) !important; color:#6f46e8; }
	.nav-icon { position:relative; flex:0 0 18px; width:18px; height:18px; color:currentColor; font-size:0; line-height:0; }
	.schedule-icon { border:2px solid currentColor; border-radius:4px; }
	.schedule-icon::before { position:absolute; top:3px; right:0; left:0; height:2px; background:currentColor; content:''; opacity:.9; }
	.schedule-icon::after { position:absolute; top:-4px; left:3px; width:2px; height:5px; border-radius:2px; background:currentColor; box-shadow:8px 0 0 currentColor; content:''; }
	.schedule-line { position:absolute; left:50%; width:8px; height:2px; border-radius:2px; background:currentColor; transform:translateX(-50%); }
	.schedule-line-one { top:7px; }
	.schedule-line-two { top:11px; }
	.cycle-icon { flex-basis:24px; width:24px; height:18px; }
	.mobius-loop { position:absolute; top:2px; z-index:1; box-sizing:border-box; width:14px; height:14px; border:3px solid currentColor; }
	.mobius-loop-left { left:0; border-radius:9px 9px 2px 9px; transform:rotate(-45deg); }
	.mobius-loop-right { right:0; border-radius:9px 9px 9px 2px; opacity:.48; transform:rotate(45deg); }
	.mobius-twist { position:absolute; z-index:2; top:5px; left:8px; width:8px; height:8px; }
	.mobius-twist::before,.mobius-twist::after { position:absolute; top:3px; left:0; width:8px; height:3px; border-radius:3px; background:currentColor; content:''; transform-origin:center; }
	.mobius-twist::before { opacity:.42; transform:rotate(42deg); }
	.mobius-twist::after { transform:rotate(-42deg); }
</style>

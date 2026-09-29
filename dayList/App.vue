<script>
	import { getStartupModule } from './shared/startup-module.js'
	import { recoverInterruptedRestore, runScheduledBackup } from './modules/backup/services/cloud-backup-service.js'

	export default {
		globalData: { startupRedirectModule: '' },
		onLaunch(options) {
			try { recoverInterruptedRestore() } catch (error) {}
			const startupModule = getStartupModule()
			if (startupModule === 'schedule') return

			const launchPath = String(options && options.path || '').replace(/^\/+/, '')
			if (launchPath && launchPath !== 'pages/schedule/index') return
			this.globalData.startupRedirectModule = startupModule
		},
		onShow() {
			// 月度快照完全静默执行；失败状态只在管理员详情页中展示。
			// #ifdef APP-PLUS
			runScheduledBackup().catch(() => {})
			// #endif
		}
	}
</script>

<style>
	page {
		min-height: 100%;
		background: #f8f7fc;
		color: #1f2030;
		font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
	}

	view,
	text,
	input,
	button {
		box-sizing: border-box;
	}

	button::after {
		border: none;
	}

	.css-back-button {
		position: relative !important;
		padding: 0 !important;
		font-size: 0 !important;
		line-height: 1 !important;
	}

	.css-back-arrow {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 18rpx;
		height: 18rpx;
		border-left: 5rpx solid #252632;
		border-bottom: 5rpx solid #252632;
		transform: translate(-35%, -50%) rotate(45deg);
		pointer-events: none;
	}
</style>

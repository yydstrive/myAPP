<script>
	import { getStartupModule } from './shared/startup-module.js'

	export default {
		globalData: { startupRedirectModule: '' },
		onLaunch(options) {
			const startupModule = getStartupModule()
			if (startupModule === 'schedule') return

			const launchPath = String(options && options.path || '').replace(/^\/+/, '')
			if (launchPath && launchPath !== 'pages/schedule/index') return
			this.globalData.startupRedirectModule = startupModule
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
</style>

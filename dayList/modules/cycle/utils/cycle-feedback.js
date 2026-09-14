let hideTimer = null
const PENDING_FEEDBACK_KEY = 'daylist-cycle-pending-feedback-v1'

export function showCycleFeedback(title, options = {}) {
	if (hideTimer) {
		clearTimeout(hideTimer)
		hideTimer = null
	}
	uni.hideToast()
	const requestedDuration = Number(options.duration)
	const duration = Number.isFinite(requestedDuration) && requestedDuration > 0 ? requestedDuration : 1800
	uni.showToast({
		title,
		icon: 'none',
		duration,
		mask: false,
		...options
	})
	hideTimer = setTimeout(() => {
		uni.hideToast()
		hideTimer = null
	}, duration + 100)
}

export function queueCycleFeedback(title) {
	uni.setStorageSync(PENDING_FEEDBACK_KEY, String(title || ''))
}

export function consumeCycleFeedback() {
	const title = uni.getStorageSync(PENDING_FEEDBACK_KEY)
	if (!title) return false
	uni.removeStorageSync(PENDING_FEEDBACK_KEY)
	setTimeout(() => showCycleFeedback(String(title)), 120)
	return true
}

export function showFeedback(title, options = {}) {
	uni.showToast({
		title,
		icon: 'none',
		duration: 1800,
		mask: false,
		...options
	})
}

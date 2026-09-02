export function parseTaskDate(value) {
	const [year, month, day] = String(value).split('-').map(Number)
	return new Date(year, month - 1, day, 12, 0, 0)
}

export function formatTaskDate(value, todayValue) {
	const date = parseTaskDate(value)
	const today = parseTaskDate(todayValue)
	const offset = Math.round((date - today) / 86400000)
	let label = ''

	if (offset === 0) label = '今天'
	else if (offset === 1) label = '明天'
	else if (offset === 2) label = '后天'
	else {
		const daysUntilNextMonday = today.getDay() === 1 ? 7 : (8 - today.getDay()) % 7
		const nextMonday = new Date(today)
		nextMonday.setDate(today.getDate() + daysUntilNextMonday)
		const nextSunday = new Date(nextMonday)
		nextSunday.setDate(nextMonday.getDate() + 6)
		if (date >= nextMonday && date <= nextSunday) label = '下周'
		else label = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
	}

	return `${label} · ${date.getMonth() + 1}/${date.getDate()}`
}

export function formatCompletedDate(timestamp) {
	if (!timestamp) return '未完成'
	const date = new Date(timestamp)
	return `${date.getMonth() + 1}/${date.getDate()}`
}

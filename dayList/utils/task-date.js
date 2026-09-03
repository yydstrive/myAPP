export function parseTaskDate(value) {
	const [year, month, day] = String(value).split('-').map(Number)
	return new Date(year, month - 1, day, 12, 0, 0)
}

export function formatTaskDate(value, todayValue) {
	const date = parseTaskDate(value)
	const today = parseTaskDate(todayValue)
	const dateDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
	const todayDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
	const offset = Math.round((dateDay - todayDay) / 86400000)
	let label = ''

	if (offset === -1) label = '昨天'
	else if (offset === 0) label = '今天'
	else if (offset === 1) label = '明天'
	else {
		const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay()
		const thisMonday = new Date(today)
		thisMonday.setDate(today.getDate() + mondayOffset)
		const thisMondayDay = Date.UTC(thisMonday.getFullYear(), thisMonday.getMonth(), thisMonday.getDate())
		const weekOffset = Math.floor((dateDay - thisMondayDay) / (7 * 86400000))
		const monthOffset = (date.getFullYear() - today.getFullYear()) * 12 + date.getMonth() - today.getMonth()

		if (weekOffset === 0) label = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]
		else if (weekOffset === -1) label = '上周'
		else if (weekOffset === 1) label = '下周'
		else if (monthOffset === -1) label = '上月'
		else if (monthOffset === 1) label = '下月'
		else label = '更远'
	}

	return `${label} · ${date.getMonth() + 1}/${date.getDate()}`
}

export function formatCompletedDate(timestamp) {
	if (!timestamp) return '-'
	const date = new Date(timestamp)
	return `${date.getMonth() + 1}/${date.getDate()}`
}

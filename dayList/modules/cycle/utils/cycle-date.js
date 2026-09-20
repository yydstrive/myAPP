const pad = (value) => String(value).padStart(2, '0')

export const localDateString = (date = new Date()) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const parseLocalDate = (value) => {
	const [year, month, day] = String(value).split('-').map(Number)
	return new Date(year, month - 1, day, 12, 0, 0)
}

export const addDays = (value, amount) => {
	const date = parseLocalDate(value)
	date.setDate(date.getDate() + Number(amount || 0))
	return localDateString(date)
}

export const addMonths = (value, amount) => {
	const date = parseLocalDate(value)
	const desiredDay = date.getDate()
	date.setDate(1)
	date.setMonth(date.getMonth() + Number(amount || 0))
	const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
	date.setDate(Math.min(desiredDay, lastDay))
	return localDateString(date)
}

export const daysBetween = (earlier, later) => Math.max(0, Math.round((parseLocalDate(later) - parseLocalDate(earlier)) / 86400000))

export const formatFullDate = (value) => {
	if (!value) return '暂无记录'
	const date = parseLocalDate(value)
	return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export const lastCompletion = (cycle) => {
	const values = cycle && Array.isArray(cycle.completions) ? cycle.completions : []
	return values.length ? values[values.length - 1] : ''
}

export const expectedNextDate = (cycle) => {
	const last = lastCompletion(cycle)
	if (!last || !cycle || !cycle.interval_value) return ''
	return cycle.interval_unit === 'month' ? addMonths(last, cycle.interval_value) : addDays(last, cycle.interval_value)
}

export const isExpectedDateDue = (cycle, currentDate = localDateString()) => {
	const next = expectedNextDate(cycle)
	return Boolean(next && currentDate && next <= currentDate)
}

export const weekDaysFor = (value) => {
	const date = parseLocalDate(value)
	const mondayOffset = (date.getDay() + 6) % 7
	const monday = new Date(date)
	monday.setDate(date.getDate() - mondayOffset)
	return Array.from({ length: 7 }, (_, index) => {
		const item = new Date(monday)
		item.setDate(monday.getDate() + index)
		return { value: localDateString(item), weekday: ['一', '二', '三', '四', '五', '六', '日'][index], dateLabel: `${item.getMonth() + 1}/${item.getDate()}` }
	})
}

export const monthDaysFor = (value, includeAdjacent = false) => {
	const cursor = parseLocalDate(value)
	const year = cursor.getFullYear()
	const month = cursor.getMonth()
	const first = new Date(year, month, 1, 12, 0, 0)
	const dayCount = new Date(year, month + 1, 0).getDate()
	if (!includeAdjacent) {
		const leading = (first.getDay() + 6) % 7
		return [
			...Array.from({ length: leading }, (_, index) => ({ key: `blank-start-${index}`, blank: true })),
			...Array.from({ length: dayCount }, (_, index) => {
				const date = new Date(year, month, index + 1, 12, 0, 0)
				return { key: localDateString(date), value: localDateString(date), day: index + 1, currentMonth: true, blank: false }
			})
		]
	}
	const mondayOffset = (first.getDay() + 6) % 7
	const start = new Date(first)
	start.setDate(first.getDate() - mondayOffset)
	return Array.from({ length: 42 }, (_, index) => {
		const date = new Date(start)
		date.setDate(start.getDate() + index)
		return { key: localDateString(date), value: localDateString(date), day: date.getDate(), currentMonth: date.getMonth() === month, blank: false }
	})
}

export const intervalLabel = (cycle) => cycle && cycle.interval_value ? `每 ${cycle.interval_value} ${cycle.interval_unit === 'month' ? '个月' : '天'}` : '未设置计划周期'

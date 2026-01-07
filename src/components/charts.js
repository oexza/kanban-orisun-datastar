import { jsx as _jsx, jsxs as _jsxs } from "hono/jsx/jsx-runtime";
function getMaxValue(data) {
    let max = 1;
    for (const item of data) {
        if (item.value > max) {
            max = item.value;
        }
    }
    return max;
}
function getTotalValue(data) {
    let total = 0;
    for (const item of data) {
        total += item.value;
    }
    return total;
}
function getStartValue(data, currentIndex, totalValue) {
    if (totalValue === 0) {
        return 0;
    }
    let sum = 0;
    for (let i = 0; i < currentIndex; i++) {
        sum += data[i].value;
    }
    return sum / totalValue;
}
function getEndValue(data, currentIndex, totalValue) {
    if (totalValue === 0) {
        return 0;
    }
    let sum = 0;
    for (let i = 0; i <= currentIndex; i++) {
        sum += data[i].value;
    }
    return sum / totalValue;
}
export function BarChart({ data, colors, title, }) {
    const maxValue = getMaxValue(data);
    return (_jsx("div", { class: "card bg-base-100 shadow-lg", children: _jsxs("div", { class: "card-body p-4", children: [_jsx("h3", { class: "card-title text-sm text-base-content mb-4", children: title }), _jsx("div", { class: "grid gap-4", style: `grid-template-columns: repeat(${data.length}, 1fr);`, children: data.map((item, i) => (_jsx(BarChartItem, { item: item, color: colors[i % colors.length], maxValue: maxValue }))) })] }) }));
}
function BarChartItem({ item, color, maxValue, }) {
    return (_jsxs("div", { class: "flex flex-col items-center gap-2", children: [_jsx("div", { class: "w-full flex flex-col justify-end", style: "height: 150px;", children: maxValue > 0 && (_jsx("div", { class: "w-full rounded-t transition-all duration-500 ease-out", style: `height: ${(item.value * 100) / maxValue}%; background-color: ${color};`, children: _jsx("div", { class: "text-xs text-white font-semibold text-center pt-1", children: item.value }) })) }), _jsx("div", { class: "text-xs text-base-content text-center font-medium pt-3", children: item.label })] }));
}
export function PieChart({ data, colors, title, }) {
    const totalValue = getTotalValue(data);
    return (_jsx("div", { class: "card bg-base-100 shadow-lg", children: _jsxs("div", { class: "card-body p-4 flex flex-col items-center", children: [_jsx("h3", { class: "card-title text-sm text-base-content mb-2 w-full", children: title }), _jsx("table", { class: "charts-css pie mx-auto mb-3", style: "height: 120px; width: 120px; --labels-size: 0;", children: _jsx("tbody", { children: data.map((item, i) => (_jsx(PieChartSlice, { item: item, index: i, allData: data, colors: colors, totalValue: totalValue }))) }) }), _jsx("div", { class: "flex flex-col gap-1 w-full", children: data.map((item, i) => (_jsx(PieChartLegendItem, { item: item, color: colors[i % colors.length], totalValue: totalValue }))) })] }) }));
}
function PieChartSlice({ item, index, allData, colors, totalValue, }) {
    const startValue = getStartValue(allData, index, totalValue);
    const endValue = getEndValue(allData, index, totalValue);
    const color = colors[index % colors.length];
    return (_jsx("tr", { children: _jsx("td", { style: `--start: ${startValue}; --end: ${endValue}; --color: ${color};` }) }));
}
function PieChartLegendItem({ item, color, totalValue, }) {
    const percentage = totalValue > 0 ? ((item.value / totalValue) * 100).toFixed(0) : 0;
    return (_jsxs("div", { class: "flex items-center gap-2 justify-between", children: [_jsxs("div", { class: "flex items-center gap-2", children: [_jsx("div", { class: "w-2.5 h-2.5 rounded-sm flex-shrink-0", style: `background-color: ${color};` }), _jsx("span", { class: "text-xs text-base-content", children: item.label })] }), _jsxs("span", { class: "text-xs font-semibold text-base-content", children: [percentage, "%"] })] }));
}

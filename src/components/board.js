import { jsx as _jsx, jsxs as _jsxs } from "hono/jsx/jsx-runtime";
import { BasePage } from "./layout";
import { BarChart, PieChart } from "./charts";
import { CardList } from "./cards";
import { AddCardModal, EditCardModal, AddCommentModal } from "./modals";
const PASTEL_COLORS = ["#fbbf24", "#f472b6", "#a78bfa", "#60a5fa"];
function getChartData(board) {
    return board.lists.map((list) => ({
        label: list.title,
        value: list.cards.length,
    }));
}
export function BoardPage({ board, users, tags, }) {
    return (_jsx(BasePage, { title: `${board.title} | Kanban Board`, children: _jsx(Board, { board: board, users: users, tags: tags }) }));
}
export function Board({ board, users, tags, }) {
    return (_jsx("div", { id: "board-app", class: "min-h-screen bg-base-200", children: _jsx("div", { class: "min-h-screen bg-base-300 text-base-content p-4 md:p-8", children: _jsxs("main", { class: "w-full p-8 space-y-10 rounded-[2.5rem] bg-base-100 dark:bg-base-200 shadow-xl", children: [_jsx("div", { class: "breadcrumbs text-sm", children: _jsxs("ul", { children: [_jsx("li", { children: _jsx("a", { href: "/", class: "link link-hover", children: "Boards" }) }), _jsx("li", { children: _jsx("span", { class: "text-base-content/60", children: board.title }) })] }) }), _jsx(BoardContent, { board: board, users: users }), _jsx(AddCardModal, { boardId: board.id, users: users, tags: tags }), _jsx(EditCardModal, { boardId: board.id, users: users, tags: tags }), _jsx(AddCommentModal, { boardId: board.id, users: users })] }) }) }));
}
function BoardOverview({ board }) {
    const chartData = getChartData(board);
    return (_jsxs("section", { class: "bg-base-200 dark:bg-base-300 shadow-xl rounded-3xl p-8 space-y-6", children: [_jsxs("div", { class: "space-y-3", children: [_jsx("div", { class: "badge badge-secondary badge-outline", children: "Board overview" }), _jsx("h1", { class: "text-4xl font-black text-primary", children: board.title }), board.description && (_jsx("p", { class: "text-base text-base-content/60 max-w-2xl", children: board.description }))] }), _jsxs("div", { class: "grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-6 max-w-[1190px] mx-auto items-start", children: [_jsx(BarChart, { data: chartData, colors: PASTEL_COLORS, title: "Cards per List" }), _jsx(PieChart, { data: chartData, colors: PASTEL_COLORS, title: "Distribution" })] })] }));
}
export function BoardContent({ board, users, }) {
    return (_jsxs("div", { id: "boardContent", class: "space-y-8", children: [_jsx(BoardOverview, { board: board }), _jsx("div", { class: "card-actions", children: _jsx("button", { class: "btn btn-primary", onclick: "addCardModal.showModal()", children: "Add Card" }) }), _jsx(BoardCardsSection, { board: board, users: users })] }));
}
export function BoardCardsSection({ board, users, }) {
    return (_jsx("section", { id: "boardCardsSection", class: "flex gap-7 overflow-x-auto pb-8", children: board.lists.length === 0 ? (_jsx("div", { class: "card bg-base-200 dark:bg-base-300 shadow-xl w-full max-w-md mx-auto", children: _jsxs("div", { class: "card-body items-center text-center", children: [_jsx("h2", { class: "card-title text-secondary", children: "No lists yet" }), _jsx("p", { class: "text-base-content/60", children: "Add a list to begin organizing work on this board." })] }) })) : (board.lists.map((list) => (_jsx(CardList, { list: list, boardId: board.id, users: users })))) }));
}

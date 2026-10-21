export const dashboardColumns = 12;
export const dashboardRows = 8;
export const widgetSizes: Record<WidgetId, { w: number; h: number }> = {
  overview: { w: 6, h: 2 }, tasks: { w: 6, h: 4 }, calendar: { w: 6, h: 3 },
  weather: { w: 6, h: 3 }, apple: { w: 6, h: 3 }, habits: { w: 6, h: 3 },
};

export type WidgetId = "overview" | "tasks" | "calendar" | "weather" | "apple" | "habits";
export type WidgetColor = "mint" | "blue" | "lavender" | "peach" | "butter" | "white";
export type WidgetView = "standard" | "compact" | "focus";
export type WidgetLayout = { id: WidgetId; x: number; y: number; w: number; h: number; color: WidgetColor; view: WidgetView };

export const widgetTitles: Record<WidgetId, string> = {
  overview: "Tagesüberblick",
  tasks: "Aufgaben",
  calendar: "Kalender",
  weather: "Wetter",
  apple: "Apple Kalender",
  habits: "Gewohnheiten",
};

export const defaultDashboardLayout: WidgetLayout[] = [
  { id: "overview", x: 0, y: 0, ...widgetSizes.overview, color: "mint", view: "standard" },
  { id: "tasks", x: 6, y: 0, ...widgetSizes.tasks, color: "blue", view: "standard" },
  { id: "calendar", x: 0, y: 2, ...widgetSizes.calendar, color: "lavender", view: "standard" },
  { id: "weather", x: 0, y: 5, ...widgetSizes.weather, color: "butter", view: "standard" },
];

export function isValidWidgetLayout(value: unknown): value is WidgetLayout[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) return false;
  const validIds = new Set<string>(Object.keys(widgetTitles));
  const validColors = new Set<WidgetColor>(["mint", "blue", "lavender", "peach", "butter", "white"]);
  const validViews = new Set<WidgetView>(["standard", "compact", "focus"]);
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || !validIds.has(row.id) || seen.has(row.id)) return false;
    if (![row.x, row.y, row.w, row.h].every(n => Number.isInteger(n))) return false;
    const candidate = row as unknown as WidgetLayout;
    if (candidate.x < 0 || candidate.y < 0 || candidate.w < 2 || candidate.h < 2 || candidate.x + candidate.w > dashboardColumns || candidate.y + candidate.h > dashboardRows) return false;
    if (!validColors.has(candidate.color) || !validViews.has(candidate.view)) return false;
    seen.add(candidate.id);
  }
  for (let i=0;i<value.length;i++) for (let j=i+1;j<value.length;j++) if (overlaps(value[i] as WidgetLayout,value[j] as WidgetLayout)) return false;
  return true;
}
function overlaps(a: WidgetLayout, b: WidgetLayout) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }


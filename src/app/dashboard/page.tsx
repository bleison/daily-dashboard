import { requireUser } from "@/lib/auth";
import DashboardCanvas from "./dashboard-canvas";
import { isValidWidgetLayout, type WidgetLayout } from "./layout-model";

export const dynamic="force-dynamic";
export default async function Dashboard(){
  const {supabase}=await requireUser();
  const [itemsResult,layoutResult,eventsResult]=await Promise.all([
    supabase.from("life_items").select("id,title,kind,completed_at,created_at,due_at,priority").order("created_at",{ascending:false}).limit(50),
    supabase.from("dashboard_layouts").select("layout").maybeSingle(),
    supabase.from("calendar_events").select("id,title,starts_at,ends_at").gte("starts_at",new Date().toISOString()).order("starts_at",{ascending:true}).limit(30),
  ]);
  const saved=layoutResult.data?.layout;
  const layout:WidgetLayout[]|null=isValidWidgetLayout(saved)?saved:null;
  return <DashboardCanvas items={itemsResult.data??[]} events={eventsResult.data??[]} savedLayout={layout} />;
}

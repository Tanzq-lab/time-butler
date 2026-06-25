import { TimePlanningWorkspace } from "@/components/containers/time-planning-workspace";
import { MainLayout } from "@/components/template/main-layout";

export function TimePlanningPage() {
  return (
    <MainLayout>
      <div className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 md:py-10 max-w-7xl mx-auto h-full">
        <TimePlanningWorkspace />
      </div>
    </MainLayout>
  );
}

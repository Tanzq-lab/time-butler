import { TimePlanningWorkspace } from "@/components/containers/time-planning-workspace";
import { MainLayout } from "@/components/template/main-layout";

export function TimePlanningPage() {
  return (
    <MainLayout>
      <div className="mx-auto h-full max-w-7xl px-4 py-6 sm:px-6 md:px-8 md:py-8 lg:px-10">
        <TimePlanningWorkspace />
      </div>
    </MainLayout>
  );
}

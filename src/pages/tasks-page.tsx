import { MainLayout } from "@/components/template/main-layout";
import { TasksList } from "@/components/containers/tasks-list";

export function TasksPage() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <TasksList />
      </div>
    </MainLayout>
  );
}

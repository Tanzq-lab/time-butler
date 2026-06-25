import { NotesWorkspace } from "@/components/containers/notes-workspace";
import { MainLayout } from "@/components/template/main-layout";

export function NotesPage() {
  return (
    <MainLayout>
      <div className="px-4 sm:px-6 md:px-8 lg:px-12 xl:px-16 py-6 md:py-10 max-w-7xl mx-auto h-full">
        <NotesWorkspace />
      </div>
    </MainLayout>
  );
}

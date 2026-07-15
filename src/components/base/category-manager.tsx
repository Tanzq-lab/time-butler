import { useReducer } from "react";
import { Plus, Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { useCategoriesStore } from "@/features/categories/use-categories-store";
import type { Category } from "@/lib/db/types";

interface CategoryManagerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (category: Category) => void;
}

interface UIState {
  editingId: number | null;
  editName: string;
  isAddingNew: boolean;
  newName: string;
  deleteConfirmId: number | null;
}

type UIAction =
  | { type: "START_EDIT"; id: number; name: string }
  | { type: "SET_EDIT_NAME"; name: string }
  | { type: "END_EDIT" }
  | { type: "START_ADD" }
  | { type: "SET_NEW_NAME"; name: string }
  | { type: "CANCEL_ADD" }
  | { type: "FINISH_ADD" }
  | { type: "CONFIRM_DELETE"; id: number }
  | { type: "CANCEL_DELETE" };

const INITIAL_UI: UIState = {
  editingId: null,
  editName: "",
  isAddingNew: false,
  newName: "",
  deleteConfirmId: null,
};

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case "START_EDIT":
      return { ...state, editingId: action.id, editName: action.name };
    case "SET_EDIT_NAME":
      return { ...state, editName: action.name };
    case "END_EDIT":
      return { ...state, editingId: null, editName: "" };
    case "START_ADD":
      return { ...state, isAddingNew: true };
    case "SET_NEW_NAME":
      return { ...state, newName: action.name };
    case "CANCEL_ADD":
      return { ...state, isAddingNew: false, newName: "" };
    case "FINISH_ADD":
      return { ...INITIAL_UI };
    case "CONFIRM_DELETE":
      return { ...state, deleteConfirmId: action.id };
    case "CANCEL_DELETE":
      return { ...state, deleteConfirmId: null };
  }
}

export function CategoryManager({
  open,
  onClose,
  onSelect,
}: CategoryManagerProps) {
  const categories = useCategoriesStore((s) => s.categories);
  const addCategory = useCategoriesStore((s) => s.addCategory);
  const updateCategory = useCategoriesStore((s) => s.updateCategory);
  const deleteCategory = useCategoriesStore((s) => s.deleteCategory);

  const [ui, dispatch] = useReducer(uiReducer, INITIAL_UI);

  const handleDelete = async (id: number) => {
    await deleteCategory(id);
    dispatch({ type: "CANCEL_DELETE" });
  };

  const handleSaveEdit = async (id: number, currentColor: string) => {
    if (!ui.editName.trim()) return;
    await updateCategory(id, ui.editName.trim(), currentColor);
    dispatch({ type: "END_EDIT" });
  };

  const handleAddNew = async () => {
    if (!ui.newName.trim()) return;
    const category = await addCategory(ui.newName.trim());
    onSelect(category);
    dispatch({ type: "FINISH_ADD" });
    onClose();
  };

  return (
    <ModalOverlay open={open} onClose={onClose} maxWidth="max-w-lg" showCloseButton ariaLabel="分类管理">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-sahara-border/20">
          <h2 className="text-lg font-semibold text-sahara-text">
            {ui.isAddingNew
              ? "新建分类"
              : ui.editingId
                ? "编辑分类"
                : "分类"}
          </h2>
        </div>

        {ui.isAddingNew ? (
          /* Add New Form */
          <div className="px-6 py-5 space-y-4">
            <input
              type="text"
              name="new-category-name"
              autoComplete="off"
              aria-label="分类名称"
              placeholder="分类名称…"
              value={ui.newName}
              onChange={(e) => dispatch({ type: "SET_NEW_NAME", name: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && handleAddNew()}
              className="h-10 w-full rounded-md border border-sahara-border bg-sahara-surface px-3 text-sm outline-none focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
            />
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                size="md"
                fullWidth
                onClick={() => dispatch({ type: "CANCEL_ADD" })}
              >
                取消
              </Button>
              <Button
                variant="solid"
                intent="green"
                size="md"
                fullWidth
                onClick={handleAddNew}
                disabled={!ui.newName.trim()}
                className="gap-2"
              >
                <Plus className="size-4" /> 创建分类
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Categories List */}
            <div className="px-6 py-4 max-h-72 overflow-y-auto">
              {categories.length === 0 && (
                <p className="text-center text-sm text-sahara-text-muted py-6">
                  还没有分类
                </p>
              )}
              {categories.map((category) => (
                <div key={category.id}>
                  {ui.editingId === category.id ? (
                    /* Edit Inline Form */
                    <div className="mb-2 flex items-center gap-3 rounded-md bg-sahara-card px-4 py-3">
                      <input
                        type="text"
                        name={`category-name-${category.id}`}
                        autoComplete="off"
                        aria-label={`编辑分类名称：${category.name}`}
                        value={ui.editName}
                        onChange={(e) => dispatch({ type: "SET_EDIT_NAME", name: e.target.value })}
                        onKeyDown={(e) =>
                          e.key === "Enter" &&
                          handleSaveEdit(category.id, category.color)
                        }
                        className="h-9 flex-1 rounded-md border border-sahara-border px-3 text-sm outline-none focus:border-sahara-text focus:ring-2 focus:ring-sahara-focus/20"
                      />
                      <Button
                        variant="solid"
                        intent="green"
                        size="icon-sm"
                        shape="rounded-lg"
                        onClick={() =>
                          handleSaveEdit(category.id, category.color)
                        }
                        aria-label={`保存分类：${category.name}`}
                      >
                        <Check className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    /* Display Row */
                    <div className="group mb-1 flex items-center justify-between rounded-md px-4 py-3 transition-colors hover:bg-sahara-card">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-3 rounded-full shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-base font-medium text-sahara-text">
                          {category.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {ui.deleteConfirmId === category.id ? (
                          <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded-lg">
                            <span className="text-sm font-semibold text-red-600 dark:text-red-400 whitespace-nowrap">
                              删除？
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDelete(category.id)}
                              className="text-sm cursor-pointer font-bold text-white px-1.5 py-0.5 rounded bg-red-600 hover:bg-red-700 transition-colors"
                            >
                              确认
                            </button>
                            <button
                              type="button"
                              onClick={() => dispatch({ type: "CANCEL_DELETE" })}
                              className="text-sm cursor-pointer font-medium text-sahara-text-muted hover:text-sahara-text px-1.5 py-0.5 rounded hover:bg-sahara-border/20 transition-colors"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                dispatch({ type: "START_EDIT", id: category.id, name: category.name });
                              }}
                              aria-label={`编辑分类：${category.name}`}
                              className="text-sahara-text-muted opacity-100 hover:text-sahara-text-secondary md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => dispatch({ type: "CONFIRM_DELETE", id: category.id })}
                              aria-label={`删除分类：${category.name}`}
                              className="text-sahara-text-muted opacity-100 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6">
              <Button
                variant="solid"
                intent="green"
                fullWidth
                onClick={() => dispatch({ type: "START_ADD" })}
                className="gap-2 bg-green-500/90 hover:bg-green-500"
              >
                <Plus className="size-4" />
                添加新分类
              </Button>
            </div>
          </>
        )}
      </div>
    </ModalOverlay>
  );
}

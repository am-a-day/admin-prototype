import { CatalogSidebar } from "@/components/layout/catalog-sidebar";
import { PageTitle } from "@/components/workspace/page-title";
import { Field, FormTextArea, SectionCard } from "@/components/workspace/section-card";
import { getDish } from "@/data/mock-data";
import { cn } from "@/lib/utils";

type CatalogWorkspaceProps = {
  selectedDishId: string;
};

export function CatalogWorkspace({ selectedDishId }: CatalogWorkspaceProps) {
  const selectedDish = getDish(selectedDishId);

  return (
    <>
      <CatalogSidebar
        title="Каталог"
        description="Разделы, позиции и быстрые действия."
      />
      <main className="min-w-0 flex-1 overflow-y-auto bg-white p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <PageTitle
            title="Каталог"
            description="Разделы, позиции и карточки меню."
            showContentLanguage
          />
          <div className="overflow-hidden rounded-[28px] border border-border bg-white">
            <div className="flex">
              <div
                className={cn(
                  "flex h-48 w-56 shrink-0 items-center justify-center bg-gradient-to-br text-7xl",
                  selectedDish.accent,
                )}
              >
                {selectedDish.emoji}
              </div>
              <div className="flex flex-1 flex-col justify-center p-7">
                <div className="text-xs font-black uppercase tracking-wide text-blue-600">
                  {selectedDish.category}
                </div>
                <h1 className="mt-1 text-3xl font-black">{selectedDish.name}</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{selectedDish.description}</p>
              </div>
            </div>
          </div>
          <SectionCard>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Название" value={selectedDish.name} />
              <Field label="Раздел" value={selectedDish.category} />
              <Field label="Цена" value={selectedDish.price} />
              <Field label="Вес / объем" value={selectedDish.weight} />
              <div className="col-span-2">
                <FormTextArea label="Описание" value={selectedDish.description} />
              </div>
            </div>
          </SectionCard>
        </div>
      </main>
    </>
  );
}

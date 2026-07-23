import { useEffect, useState } from "react";
import { Search, UtensilsCrossed } from "lucide-react";
import type { MockAccount } from "@/contexts/mock-auth-context";
import { categories, dishes } from "@/data/mock-data";
import { LANGUAGES } from "@/data/languages";

export function PublicMenuPage({ account }: { account: MockAccount | null }) {
  const snapshot = account?.workspace.publishedSnapshot;
  const [language, setLanguage] = useState(
    snapshot?.publishedLanguages[0] ?? account?.workspace.primaryLanguage ?? "ru",
  );

  useEffect(() => {
    if (snapshot && !snapshot.publishedLanguages.includes(language)) {
      setLanguage(snapshot.publishedLanguages[0] ?? account?.workspace.primaryLanguage ?? "ru");
    }
  }, [account?.workspace.primaryLanguage, language, snapshot]);

  if (!account || !snapshot) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f7f6f2] px-6 text-center">
        <div>
          <div className="text-[18px] font-semibold text-[#292524]">Меню пока не опубликовано</div>
          <p className="mt-2 text-[14px] text-[#79716b]">Ссылка станет доступна после первой публикации.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#292524]">
      <div className="mx-auto min-h-screen w-full max-w-[720px] bg-white">
        <header className="border-b border-[#e7e5e4] px-5 pb-5 pt-8 sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-[24px] font-bold">
                {snapshot.localizedNames[language] || snapshot.name}
              </h1>
              <p className="mt-1 text-[13px] text-[#79716b]">Онлайн-меню</p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#292524] text-white">
              <UtensilsCrossed size={18} />
            </div>
          </div>
          <div className="mt-5 flex h-10 items-center rounded-[10px] bg-[#f5f5f4] px-3 text-[#a6a09b]">
            <Search size={15} />
            <span className="ml-2 text-[13px]">Поиск по меню</span>
          </div>
          {snapshot.publishedLanguages.length > 1 && (
            <div className="mt-3 flex items-center gap-1" aria-label="Языки витрины">
              {snapshot.publishedLanguages.map((code) => {
                const languageOption = LANGUAGES.find((item) => item.code === code);
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLanguage(code)}
                    className={
                      code === language
                        ? "rounded-[6px] bg-[#292524] px-2 py-1 text-[11px] font-semibold text-white"
                        : "rounded-[6px] bg-[#f5f5f4] px-2 py-1 text-[11px] font-semibold text-[#79716b]"
                    }
                  >
                    {languageOption?.short ?? code.toUpperCase()}
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <div className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b border-[#e7e5e4] bg-white px-5 py-3 sm:px-8">
          {categories.map((category, index) => (
            <span
              key={category.id}
              className={index === 0
                ? "shrink-0 rounded-full bg-[#292524] px-3 py-1.5 text-[12px] font-semibold text-white"
                : "shrink-0 rounded-full bg-[#f5f5f4] px-3 py-1.5 text-[12px] font-medium text-[#57534d]"}
            >
              {category.name}
            </span>
          ))}
        </div>

        <div className="px-5 py-6 sm:px-8">
          {categories.map((category) => {
            const categoryDishes = dishes.filter((dish) => dish.category === category.name);
            if (categoryDishes.length === 0) return null;
            return (
              <section key={category.id} className="mb-8">
                <h2 className="mb-3 text-[18px] font-semibold">{category.name}</h2>
                <div className="divide-y divide-[#e7e5e4]">
                  {categoryDishes.map((dish) => (
                    <article key={dish.id} className="flex items-center gap-4 py-3">
                      <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br ${dish.accent} text-[26px]`}>
                        {dish.emoji}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[14px] font-semibold">{dish.name}</h3>
                        <p className="mt-1 text-[13px] font-medium text-[#57534d]">{dish.price}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}

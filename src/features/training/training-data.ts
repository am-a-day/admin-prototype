import { catalogItems, formatPrice } from "@/data/catalog";

export type TrainingTab = "trainer" | "menu" | "progress";

export type TrainingDish = {
  id: string;
  title: string;
  sectionId: string;
  sectionName: string;
  photoUrl: string;
  priceLabel: string;
  weightLabel: string | null;
};

export type QuizAnswer = {
  id: string;
  label: string;
};

export type QuizQuestion = {
  id: string;
  prompt: string;
  mediaUrl: string;
  mediaAlt: string;
  answers: QuizAnswer[];
  correctAnswerId: string;
  feedback: {
    correctAnswer: string;
    sectionName: string;
  };
  source: TrainingDish;
};

const REAL_PHOTO_PATTERN = /^https?:\/\//i;

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function uniqueByTitle(items: TrainingDish[]) {
  const seen = new Set<string>();
  const result: TrainingDish[] = [];
  for (const item of items) {
    const key = item.title.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

const activeItems = catalogItems
  .filter((item) => item.status === "active" && item.thumbnailUrl && REAL_PHOTO_PATTERN.test(item.thumbnailUrl))
  .map<TrainingDish>((item) => ({
    id: item.id,
    title: item.title,
    sectionId: item.sectionId,
    sectionName: item.sectionName,
    photoUrl: item.thumbnailUrl ?? "",
    priceLabel: formatPrice(item.priceWithSale ?? item.price),
    weightLabel: item.weightLabel,
  }));

const itemsBySection = activeItems.reduce<Record<string, TrainingDish[]>>((acc, item) => {
  acc[item.sectionId] = [...(acc[item.sectionId] ?? []), item];
  return acc;
}, {});

export const trainingCatalogItems = activeItems.filter((item) => uniqueByTitle(itemsBySection[item.sectionId] ?? []).length >= 4);

export function createRecognizeDishQuestions(total = 10): QuizQuestion[] {
  const selectedItems = uniqueByTitle(shuffle(trainingCatalogItems)).slice(0, total);

  return selectedItems.map((item, index) => {
    const sectionItems = uniqueByTitle(
      itemsBySection[item.sectionId].filter((candidate) => candidate.title.trim().toLowerCase() !== item.title.trim().toLowerCase()),
    );
    const distractors = shuffle(sectionItems).slice(0, 3);
    const correctAnswer = { id: item.id, label: item.title };
    const distractorAnswers = distractors.map((candidate) => ({ id: candidate.id, label: candidate.title }));
    const correctIndex = index % 4;
    const answers = [...distractorAnswers];
    answers.splice(correctIndex, 0, correctAnswer);

    return {
      id: `recognize-dish-${item.id}-${index}`,
      prompt: "Выберите название блюда по фотографии",
      mediaUrl: item.photoUrl,
      mediaAlt: item.title,
      answers,
      correctAnswerId: item.id,
      feedback: {
        correctAnswer: item.title,
        sectionName: item.sectionName,
      },
      source: item,
    };
  });
}

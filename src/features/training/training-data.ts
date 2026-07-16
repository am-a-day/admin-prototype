import { catalogItems, catalogSections, formatPrice } from "@/data/catalog";

export type TrainingTab = "cards" | "trainer" | "check" | "progress";
export type TrainingRouteTab = TrainingTab | "menu";
export type TrainingActiveSession = "cards" | "practice" | "check";
export type FlashcardDeckType = "photo-name" | "position-section";
export type TrainingQuestionTopic = "photo-name" | "position-section";
export type TrainingQuestionFormat = "multiple-choice" | "typed-answer";
export type KnowledgeCheckTopic = TrainingQuestionTopic | "mixed";
export type KnowledgeCheckFormat = TrainingQuestionFormat | "mixed";

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
  exerciseId: "recognize-dish" | "section-location";
  exerciseTitle: string;
  topic: TrainingQuestionTopic;
  format: TrainingQuestionFormat;
  entityId: string;
  prompt: string;
  primaryText?: string;
  primaryLabel?: string;
  mediaUrl?: string;
  mediaAlt?: string;
  answers: QuizAnswer[];
  correctAnswerId: string;
  correctAnswer: string;
  acceptedAnswers: string[];
  feedback: {
    correctAnswer: string;
    details?: { label: string; value: string }[];
  };
  source: TrainingDish;
};

export type TrainingSectionOption = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
};

export type Flashcard = {
  id: string;
  deckType: FlashcardDeckType;
  entityId: string;
  front: {
    title?: string;
    prompt: string;
    imageUrl?: string;
  };
  back: {
    title: string;
    subtitle?: string;
    imageUrl?: string;
  };
  metadata?: string[];
  sectionId: string;
  sectionName: string;
  sectionPath: string;
};

const REAL_PHOTO_PATTERN = /^https?:\/\//i;
const DEFAULT_PHOTO_PATTERN = /\/no-image\./i;
const VIRTUAL_SECTION_NAMES = new Set([
  "все позиции",
  "популярное",
  "без фото",
  "стоп-лист",
  "стоп лист",
]);

function hasRealPhoto(photoUrl: string | null | undefined) {
  return Boolean(photoUrl && REAL_PHOTO_PATTERN.test(photoUrl) && !DEFAULT_PHOTO_PATTERN.test(photoUrl));
}

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

function uniqueByName<T extends { name: string }>(items: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = item.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

const sectionsById = new Map(catalogSections.map((section) => [section.id, section]));

function isRealSection(sectionId: string, sectionName: string) {
  return Boolean(sectionsById.get(sectionId) && !VIRTUAL_SECTION_NAMES.has(sectionName.trim().toLowerCase()));
}

function getSectionPath(sectionId: string) {
  const names: string[] = [];
  let current = sectionsById.get(sectionId);
  const visited = new Set<string>();

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? sectionsById.get(current.parentId) : undefined;
  }

  return names.join(" → ");
}

const catalogTrainingItems = catalogItems
  .filter((item) => item.status === "active" && isRealSection(item.sectionId, item.sectionName))
  .map<TrainingDish>((item) => ({
    id: item.id,
    title: item.title,
    sectionId: item.sectionId,
    sectionName: item.sectionName,
    photoUrl: item.thumbnailUrl ?? "",
    priceLabel: formatPrice(item.priceWithSale ?? item.price),
    weightLabel: item.weightLabel,
  }));

const activeItems = catalogTrainingItems.filter((item) => hasRealPhoto(item.photoUrl));

const itemsBySection = activeItems.reduce<Record<string, TrainingDish[]>>((acc, item) => {
  acc[item.sectionId] = [...(acc[item.sectionId] ?? []), item];
  return acc;
}, {});

export const trainingCatalogItems = activeItems.filter((item) => uniqueByTitle(itemsBySection[item.sectionId] ?? []).length >= 4);

const sectionLocationItemsBySection = catalogTrainingItems.reduce<Record<string, TrainingDish[]>>((acc, item) => {
  acc[item.sectionId] = [...(acc[item.sectionId] ?? []), item];
  return acc;
}, {});

export const trainingSectionOptions: TrainingSectionOption[] = uniqueByName(
  Object.entries(sectionLocationItemsBySection)
    .map(([sectionId, items]) => {
      const section = sectionsById.get(sectionId);
      const firstItem = items[0];
      if (!section || !firstItem) return null;
      return {
        id: section.id,
        name: firstItem.sectionName,
        path: getSectionPath(section.id) || firstItem.sectionName,
        parentId: section.parentId,
      };
    })
    .filter((section): section is TrainingSectionOption => Boolean(section)),
);

export const sectionLocationItems = catalogTrainingItems.filter(
  (item) => trainingSectionOptions.some((section) => section.id === item.sectionId) && trainingSectionOptions.length >= 4,
);

export const photoNameCardItems = activeItems;

function createSectionAnswers(item: TrainingDish, index: number): QuizAnswer[] {
  const correctSection = trainingSectionOptions.find((section) => section.id === item.sectionId);
  if (!correctSection) return [];

  const sameLevelSections = trainingSectionOptions.filter(
    (section) => section.id !== item.sectionId && section.parentId === correctSection.parentId,
  );
  const fallbackSections = trainingSectionOptions.filter((section) => section.id !== item.sectionId);
  const distractors = uniqueByName(shuffle(sameLevelSections)).slice(0, 3);
  const missingCount = 3 - distractors.length;
  const fallbackDistractors = uniqueByName(
    shuffle(
      fallbackSections.filter(
        (section) => !distractors.some((candidate) => candidate.name.trim().toLowerCase() === section.name.trim().toLowerCase()),
      ),
    ),
  ).slice(0, missingCount);

  const correctAnswer = { id: correctSection.id, label: correctSection.name };
  const distractorAnswers = [
    ...distractors.map((section) => ({ id: section.id, label: section.name })),
    ...fallbackDistractors.map((section) => ({ id: section.id, label: section.name })),
  ];
  const answers = distractorAnswers.slice(0, 3);
  answers.splice(index % 4, 0, correctAnswer);

  return answers;
}

function matchesSection(item: TrainingDish, sectionId: string) {
  return sectionId === "all" || item.sectionId === sectionId;
}

function takeUniqueQuestions(questions: QuizQuestion[], total: number) {
  const seen = new Set<string>();
  const result: QuizQuestion[] = [];
  for (const question of questions) {
    const key = `${question.topic}:${question.entityId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(question);
    if (result.length >= total) break;
  }
  return result;
}

export function getFlashcardDeckCount(deckType: FlashcardDeckType, sectionId = "all") {
  const source = deckType === "photo-name" ? photoNameCardItems : sectionLocationItems;
  return source.filter((item) => matchesSection(item, sectionId)).length;
}

export function createFlashcards(deckType: FlashcardDeckType, sectionId = "all", limit = 20): Flashcard[] {
  const source = deckType === "photo-name" ? photoNameCardItems : sectionLocationItems;
  const selectedItems = shuffle(uniqueByTitle(source.filter((item) => matchesSection(item, sectionId)))).slice(0, limit);

  return selectedItems.map((item) => {
    const section = trainingSectionOptions.find((option) => option.id === item.sectionId);
    const sectionPath = section?.path ?? item.sectionName;

    if (deckType === "photo-name") {
      return {
        id: `card-photo-name-${item.id}`,
        deckType,
        entityId: item.id,
        front: {
          prompt: "Как называется это блюдо?",
          imageUrl: item.photoUrl,
        },
        back: {
          title: item.title,
          subtitle: [item.sectionName, item.weightLabel].filter(Boolean).join(" · "),
        },
        metadata: item.weightLabel ? [item.weightLabel] : undefined,
        sectionId: item.sectionId,
        sectionName: item.sectionName,
        sectionPath,
      };
    }

    return {
      id: `card-position-section-${item.id}`,
      deckType,
      entityId: item.id,
      front: {
        title: item.title,
        prompt: "В каком разделе находится эта позиция?",
      },
      back: {
        title: sectionPath,
        subtitle: item.sectionName,
        imageUrl: hasRealPhoto(item.photoUrl) ? item.photoUrl : undefined,
      },
      sectionId: item.sectionId,
      sectionName: item.sectionName,
      sectionPath,
    };
  });
}

export function createRecognizeDishQuestions(
  total = 10,
  sectionId = "all",
  format: TrainingQuestionFormat = "multiple-choice",
): QuizQuestion[] {
  const selectedItems = uniqueByTitle(shuffle(trainingCatalogItems.filter((item) => matchesSection(item, sectionId)))).slice(0, total);

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
      exerciseId: "recognize-dish",
      exerciseTitle: "Узнай блюдо",
      topic: "photo-name",
      format,
      entityId: item.id,
      prompt: format === "typed-answer" ? "Введите название блюда по фотографии" : "Выберите название блюда по фотографии",
      mediaUrl: item.photoUrl,
      mediaAlt: item.title,
      answers,
      correctAnswerId: item.id,
      correctAnswer: item.title,
      acceptedAnswers: [item.title],
      feedback: {
        correctAnswer: item.title,
        details: [{ label: "Раздел", value: item.sectionName }],
      },
      source: item,
    };
  });
}

export function createSectionLocationQuestions(
  total = 10,
  sectionId = "all",
  format: TrainingQuestionFormat = "multiple-choice",
): QuizQuestion[] {
  const selectedItems = uniqueByTitle(shuffle(sectionLocationItems.filter((item) => matchesSection(item, sectionId)))).slice(0, total);

  return selectedItems
    .map<QuizQuestion | null>((item, index) => {
      const answers = createSectionAnswers(item, index);
      if (answers.length < 4) return null;
      const section = trainingSectionOptions.find((option) => option.id === item.sectionId);

      return {
        id: `section-location-${item.id}-${index}`,
        exerciseId: "section-location",
        exerciseTitle: "Где находится?",
        topic: "position-section",
        format,
        entityId: item.id,
        prompt: format === "typed-answer" ? "Введите раздел, в котором находится позиция" : "В каком разделе находится эта позиция?",
        primaryLabel: "Позиция",
        primaryText: item.title,
        answers,
        correctAnswerId: item.sectionId,
        correctAnswer: item.sectionName,
        acceptedAnswers: uniqueByName([
          { name: item.sectionName },
          { name: section?.name ?? item.sectionName },
          { name: section?.path ?? item.sectionName },
        ]).map((answer) => answer.name),
        feedback: {
          correctAnswer: item.sectionName,
          details: [{ label: "Позиция", value: item.title }],
        },
        source: item,
      } satisfies QuizQuestion;
    })
    .filter((question): question is QuizQuestion => Boolean(question));
}

export function createKnowledgeCheckQuestions({
  sectionId = "all",
  topic = "mixed",
  format = "mixed",
  total = 20,
}: {
  sectionId?: string;
  topic?: KnowledgeCheckTopic;
  format?: KnowledgeCheckFormat;
  total?: number;
}) {
  const topics: TrainingQuestionTopic[] = topic === "mixed" ? ["photo-name", "position-section"] : [topic];
  const formats: TrainingQuestionFormat[] = format === "mixed" ? ["multiple-choice", "typed-answer"] : [format];
  const candidates: QuizQuestion[] = [];

  for (let index = 0; candidates.length < total && index < total * 4; index += 1) {
    const currentTopic = topics[index % topics.length];
    const currentFormat = formats[Math.floor(index / topics.length) % formats.length];
    const batchSize = Math.max(1, total);
    const batch =
      currentTopic === "photo-name"
        ? createRecognizeDishQuestions(batchSize, sectionId, currentFormat)
        : createSectionLocationQuestions(batchSize, sectionId, currentFormat);
    candidates.push(...batch);
  }

  return takeUniqueQuestions(shuffle(candidates), total);
}

import { RecommendationsContextWorkspace } from "@/features/storefront/catalog";
import type { RecommendationTexts, UpsellSurface } from "@/data/mock-data";

type UpsellWorkspaceProps = {
  selectedDishId: string;
  setSelectedDishId: (id: string) => void;
  recommendationTexts: RecommendationTexts;
  setRecommendationText: (key: keyof RecommendationTexts, value: string) => void;
  setUpsellSurface: (surface: UpsellSurface) => void;
  setUpsellFocused: (focused: boolean) => void;
  onOpenPosition?: (id: string) => void;
};

export function UpsellWorkspace(props: UpsellWorkspaceProps) {
  return (
    <RecommendationsContextWorkspace
      selectedDishId={props.selectedDishId}
      setSelectedDishId={props.setSelectedDishId}
      setUpsellSurface={props.setUpsellSurface}
      setUpsellFocused={props.setUpsellFocused}
    />
  );
}

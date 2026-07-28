export type CardWithCollectionInfo = {
  cardImageId: string;
  cardSetId: string;
  cardName: string;
  cardColor: string | null;
  cardType: string;
  rarity: string | null;
  cardCost: string | null;
  cardPower: string | null;
  counterAmount: string | null;
  setId: string;
  localImagePath: string | null;
  isParallel: boolean;
  sourceType: string;
  quantity: number;
  wantsTrade: boolean;
  allocatedInDecks: number;
};

export type FilterOptions = {
  sets: { id: string; name: string }[];
  colors: { value: string; label: string }[];
  rarities: string[];
  types: string[];
};

export type DraftFilters = {
  color: string;
  rarity: string;
  type: string;
  set: string;
  costMin: string;
  costMax: string;
  powerMin: string;
  powerMax: string;
  inDeck: boolean;
  counter: boolean;
};

export type Tab = "all" | "grouped" | "owned" | "duplicates" | "wantsTrade";

export type ScanCandidate = {
  cardImageId: string;
  cardSetId: string;
  cardName: string;
  matchedByCode: boolean;
  localImagePath: string | null;
};

import type { ConceptId } from "@/lib/levels/schema";

export type ConceptCard = {
  id: ConceptId;
  title: string;
  body: string;
};

export const conceptCards: readonly ConceptCard[] = [
  {
    id: "sequence",
    title: "Sequence",
    body: "Commands run one after another, from top to bottom. Put the steps in the order the grid needs.",
  },
  {
    id: "turn",
    title: "Turning",
    body: "Facing matters. turn_left and turn_right change the way forward before the next move.",
  },
  {
    id: "pick-put",
    title: "Pick and put",
    body: "pick_item lifts the top item on the tile into your hands. Carry it to the place the goal asks for.",
  },
  {
    id: "stack",
    title: "Stacks",
    body: "Items on a tile are a stack. The last item is on top, and each pick takes that top item.",
  },
  {
    id: "variable",
    title: "Variables",
    body: "A name can hold a value. The last value that name holds when the program ends is what the level checks.",
  },
  {
    id: "sensor",
    title: "Sensors",
    body: "A sensor answers a yes-or-no question about the world. Read it before you choose the next move.",
  },
];

export function conceptCardFor(id: ConceptId): ConceptCard | undefined {
  return conceptCards.find((card) => card.id === id);
}

import type { ApiFunctionDescriptor } from "../world-type";

function command(name: string, doc: string): ApiFunctionDescriptor {
  return { name, params: [], returns: "none", doc, mutates: true };
}

export const ADVENTURE_API: readonly ApiFunctionDescriptor[] = [
  command("move", "Step one tile forward."),
  command("turn_left", "Turn to the left."),
  command("turn_right", "Turn to the right."),
  command("pick_item", "Pick up the top item on this tile."),
  command("put_item", "Put the top held item on this tile."),
];

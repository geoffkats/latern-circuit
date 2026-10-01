import type { ApiFunctionDescriptor } from "../world-type";

function command(name: string, doc: string): ApiFunctionDescriptor {
  return { name, params: [], returns: "none", doc, mutates: true };
}

function sensor(name: string, doc: string): ApiFunctionDescriptor {
  return { name, params: [], returns: "bool", doc, mutates: false };
}

export const ROBOT_API: readonly ApiFunctionDescriptor[] = [
  command("move", "Step one tile forward."),
  command("turn_left", "Turn to the left."),
  command("turn_right", "Turn to the right."),
  command("pick_item", "Pick up the top item on this tile."),
  command("put_item", "Put the top held item on this tile."),
  sensor("front_is_clear", "True when the tile ahead is on the grid and not blocked."),
  sensor("left_is_clear", "True when the tile to the left is on the grid and not blocked."),
  sensor("right_is_clear", "True when the tile to the right is on the grid and not blocked."),
  sensor("item_here", "True when this tile has an item."),
  sensor("facing_north", "True when facing north."),
  sensor("facing_east", "True when facing east."),
  sensor("facing_south", "True when facing south."),
  sensor("facing_west", "True when facing west."),
];

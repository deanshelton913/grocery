export interface Item {
  id: string;
  name: string;
  category: string;
  price: number;
  qty: number;
  status: "pending" | "used" | "partial" | "wasted";
}

export interface Trip {
  id: string;
  store: string;
  date: string;
  fees: number;
  items: Item[];
}

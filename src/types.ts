export interface Item {
  id: string;
  name: string;
  location: string;
  collected: boolean;
  rarity?: string;
  uuid?: string;
  description?: string;
  act?: number; // Act 1, 2, or 3
}

export interface Build {
  id: string;
  name: string;
  items: Item[];
  createdAt: number;
}


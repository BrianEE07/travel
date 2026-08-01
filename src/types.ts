export interface ExternalAction {
  label: string;
  url: string;
  kind: 'map' | 'official' | 'link';
}

export interface LinkPreview {
  title: string;
  description: string;
  image: string;
}

export interface EntityDetail {
  label: string;
  value: string;
  valueHtml: string;
}

export interface Entity {
  id: string;
  title: string;
  type: 'stay' | 'food' | 'place' | 'transport';
  summary: string;
  details: EntityDetail[];
  actions: ExternalAction[];
  preview?: LinkPreview | null;
}

export interface TimelineItem {
  time: string;
  group: string;
  text: string;
  textHtml: string;
}

export interface DayNote {
  text: string;
  textHtml: string;
}

export interface TripDay {
  date: string;
  weekday: string;
  area: string;
  stay: string;
  stayEntityId: string;
  summaryNote: string;
  detailed: boolean;
  timeline: TimelineItem[];
  notes: DayNote[];
}

export interface Trip {
  schemaVersion: number;
  slug: string;
  title: string;
  start: string;
  end: string;
  publishThrough: string;
  status: string;
  noindex: boolean;
  updatedAt: string;
  sourceHash: string;
  locations: string[];
  days: TripDay[];
  entities: Entity[];
}

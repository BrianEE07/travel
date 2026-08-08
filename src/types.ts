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

export interface RichText {
  text: string;
  html: string;
}

interface BaseEntity {
  id: string;
  title: string;
  type: 'stay' | 'food' | 'place' | 'transport';
  area: RichText;
  summary: RichText;
  actions: ExternalAction[];
  preview?: LinkPreview | null;
}

export interface StayEntity extends BaseEntity {
  type: 'stay';
  checkIn: RichText;
  checkOut: RichText;
  room: RichText;
  price: RichText;
  access: RichText;
  contact: RichText;
  policy: RichText;
}

export interface FoodEntity extends BaseEntity {
  type: 'food';
  hours: RichText;
  reservation: RichText;
  reservationTime: RichText;
  party: RichText;
  why: RichText;
  risk: RichText;
  backup: RichText;
}

export interface PlaceEntity extends BaseEntity {
  type: 'place';
  hours: RichText;
  why: RichText;
  bestFor: RichText;
  nearby: RichText;
  risk: RichText;
}

export interface TransportEntity extends BaseEntity {
  type: 'transport';
  operator: RichText;
  time: RichText;
  route: RichText;
  plan: RichText;
  duration: RichText;
  decision: RichText;
  buffer: RichText;
  price?: RichText;
}

export type Entity = StayEntity | FoodEntity | PlaceEntity | TransportEntity;

export interface TripOverview {
  date: string;
  places: string[];
  people: string;
  transports: RichText[];
  stays: RichText[];
  status: string;
}

export interface TimelineItem {
  time: string;
  kind: 'move' | 'food' | 'place' | 'shopping' | 'activity' | 'rest' | 'buffer';
  text: string;
  textHtml: string;
}

export interface TripDay {
  date: string;
  weekday: string;
  area: string;
  stay: string;
  stayEntityId: string;
  itineraryNote: string;
  publish: 'full' | 'summary';
  summary: string;
  detailed: boolean;
  timeline: TimelineItem[];
  notes: RichText[];
}

export interface Trip {
  schemaVersion: 2;
  slug: string;
  title: string;
  kicker: string;
  summary: string;
  intro: string;
  code: string;
  coverImage: string;
  coverAlt: string;
  briefingImage: string;
  start: string;
  end: string;
  status: 'draft' | 'active' | 'archived';
  noindex: boolean;
  updatedAt: string;
  sourceHash: string;
  locations: string[];
  overview: TripOverview;
  days: TripDay[];
  entities: Entity[];
}

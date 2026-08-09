export const ENTITY_TAG_LABELS: Record<'food' | 'place', Record<string, string>> = {
  food: {
    breakfast: '早餐',
    lunch: '午餐',
    dinner: '晚餐',
    cafe: '咖啡',
    snack: '點心',
    souvenir: '伴手禮',
    backup: '備案',
  },
  place: {
    shrine: '神社',
    museum: '文化',
    shopping: '購物',
    nature: '自然',
    view: '景觀',
    station: '車站',
    service: '服務',
    backup: '備案',
  },
};

export function entityTagLabel(type: 'food' | 'place', tag: string) {
  return ENTITY_TAG_LABELS[type][tag] ?? tag;
}

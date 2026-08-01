import type { Trip } from '../types';

const modules = import.meta.glob('./trips/*.json', { eager: true, import: 'default' });

export const trips = Object.values(modules) as Trip[];
export const activeTrip = trips.find((trip) => trip.status === 'active') ?? trips[0];

if (!activeTrip) throw new Error('No trip data found. Run npm run sync first.');

import { createContext } from 'svelte';
import type { Studio } from './studio.svelte';

/** Shares the Studio instance with every component under KinetiCanvasStudio */
export const [getStudio, setStudio] = createContext<Studio>();

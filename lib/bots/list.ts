import { BOTS_MAX, type Bot, type BotLevel } from "./levels";

type WithBots = { bots: readonly Bot[] };

export function addBot<T extends WithBots>(settings: T, level: BotLevel): T {
  if (settings.bots.length >= BOTS_MAX) {
    return settings;
  }
  return { ...settings, bots: [...settings.bots, { level }] };
}

export function removeBot<T extends WithBots>(settings: T, index: number): T {
  return { ...settings, bots: settings.bots.filter((_, at) => at !== index) };
}

export function setBotLevel<T extends WithBots>(settings: T, index: number, level: BotLevel): T {
  return {
    ...settings,
    bots: settings.bots.map((bot, at) => (at === index ? { level } : bot)),
  };
}

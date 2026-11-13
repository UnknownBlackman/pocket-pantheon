/**
 * What villagers say. Short, warm lines picked for a moment (a "bark"), and
 * one-line narration for things the whole village does. Pure: the caller
 * passes a random source so tests stay deterministic.
 */

export type BarkKind =
  | 'pray-together'
  | 'pray'
  | 'awe'
  | 'kneel'
  | 'climb'
  | 'ride'
  | 'fall'
  | 'hop-down'
  | 'hide'
  | 'found'
  | 'wave'
  | 'cheer'
  | 'panic'
  | 'starving'
  | 'hungry'
  | 'tired'
  | 'farm'
  | 'rest'
  | 'shrine'
  | 'blessed'
  | 'rain'
  | 'sheltered'
  | 'calm'
  | 'swat'
  | 'newborn'
  | 'mourn'
  | 'limp'
  | 'play'
  | 'dusk'
  | 'lifted'
  | 'waiting';

const LINES: Record<BarkKind, readonly string[]> = {
  'pray-together': ['Pray with me!', 'Kneel, friends!', 'Let us give thanks.'],
  pray: ['Hear us, great one.', 'Thank you for the harvest.', 'Watch over us.'],
  awe: ['The god\'s shadow!', 'Look up!', 'Is that... a hand?'],
  kneel: ['We kneel before you!', 'Great one!'],
  climb: ['May I climb up?', 'Up I go!', 'A ride!'],
  ride: ['Wheee!', 'So high!', 'I can see my hut!'],
  fall: ['Ow!', 'Aaah!', 'My leg!'],
  'hop-down': ['Down I go.', 'Thank you!'],
  hide: ['Hide!', 'Shh, behind the hand!', 'It won\'t find us here.'],
  found: ['You found us!', 'Again! Again!', 'Ha! Caught!'],
  wave: ['Look, the god waves!', 'Hello up there!', 'Wave back, everyone!'],
  cheer: ['Hooray!', 'Glory!', 'Huzzah!'],
  panic: ['Run!', 'The storm!', 'Help us!'],
  starving: ['I\'m starving...', 'So hungry...', 'Food, please...'],
  hungry: ['My belly rumbles.', 'Time to tend the field.'],
  tired: ['I need a rest.', 'So sleepy...'],
  farm: ['To work!', 'Good soil.', 'The crops look fine.'],
  rest: ['Just a short nap.', 'Home at last.'],
  shrine: ['I\'ll pray a while.', 'To the shrine.'],
  blessed: ['I feel strong!', 'Blessed!', 'Thank you, great one!'],
  rain: ['Rain! Thank you!', 'The fields drink!', 'Bless this rain!'],
  sheltered: ['We\'re safe!', 'A golden roof!', 'The god protects us!'],
  calm: ['The sky clears!', 'The storm is gone!', 'Sunshine!'],
  swat: ['Begone, cloud!', 'It\'s scattering!'],
  newborn: ['Welcome, little one!', 'A new child!'],
  mourn: ['Farewell, friend...', 'Rest well.', 'We will remember.'],
  limp: ['Ouch, my leg.', 'Easy does it...'],
  play: ['Catch me!', 'You\'re it!', 'Tee-hee!'],
  dusk: ['Gather round!', 'What a day.', 'To the fire!'],
  lifted: ['Whoa!', 'Put me down gently!', 'Where are we going?'],
  waiting: ['What should I do?', 'Give us a sign...'],
};

export type BarkMood = 'calm' | 'joy' | 'sad' | 'alarm';

const MOODS: Partial<Record<BarkKind, BarkMood>> = {
  awe: 'joy',
  kneel: 'joy',
  ride: 'joy',
  climb: 'joy',
  found: 'joy',
  wave: 'joy',
  cheer: 'joy',
  blessed: 'joy',
  rain: 'joy',
  sheltered: 'joy',
  calm: 'joy',
  newborn: 'joy',
  play: 'joy',
  lifted: 'alarm',
  fall: 'alarm',
  panic: 'alarm',
  swat: 'alarm',
  starving: 'sad',
  mourn: 'sad',
  limp: 'sad',
  waiting: 'sad',
};

/** The feeling behind a line, which sets its bubble's look. */
export function moodFor(kind: BarkKind): BarkMood {
  return MOODS[kind] ?? 'calm';
}

/** A line for the moment; `pick` is a random source in [0, 1). */
export function barkLine(kind: BarkKind, pick: () => number): string {
  const lines = LINES[kind];
  return lines[Math.floor(pick() * lines.length) % lines.length];
}

export type NarrationKind =
  | 'pray-group'
  | 'eclipse'
  | 'riders'
  | 'hiders'
  | 'storm-weakens'
  | 'harvest'
  | 'coming-of-age'
  | 'dusk';

/** One-line narration; `names` are the villagers involved. */
export function narration(kind: NarrationKind, names: readonly string[] = []): string {
  const who = joinNames(names);
  switch (kind) {
    case 'pray-group':
      return `${who} kneel in prayer at the shrine.`;
    case 'eclipse':
      return 'Your hand darkens the sky. The village kneels.';
    case 'riders':
      return `${who} ${names.length === 1 ? 'climbs' : 'climb'} onto your palm.`;
    case 'hiders':
      return `${who} ${names.length === 1 ? 'hides' : 'hide'} behind your hand.`;
    case 'storm-weakens':
      return 'The storm weakens.';
    case 'harvest':
      return `${who} ${names.length === 1 ? 'brings' : 'bring'} in the harvest.`;
    case 'coming-of-age':
      return `${who} ${names.length === 1 ? 'comes' : 'come'} of age.`;
    case 'dusk':
      return 'Dusk falls. The village gathers at the fire.';
  }
}

export function joinNames(names: readonly string[]): string {
  if (names.length === 0) return 'The villagers';
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

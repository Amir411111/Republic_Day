import type { L10n } from '../game/types';

// All interface text lives here. Kazakh strings need a check by a native speaker.
export const STRINGS = {
  appTitle: { kk: 'Тарих Guessr', ru: 'Тарих Guessr', en: 'Tarih Guessr' },
  tagline: {
    kk: 'Суретке қарап, оқиғаның жылы мен орнын табыңыз',
    ru: 'Посмотрите на фото и угадайте год и место события',
    en: 'Look at the picture, guess the year and the place',
  },
  chooseSet: { kk: 'Жинақ', ru: 'Набор', en: 'Set' },
  packKz: { kk: 'Қазақстан', ru: 'Казахстан', en: 'Kazakhstan' },
  packSemey: { kk: 'Семей', ru: 'Семей', en: 'Semey' },
  modeDaily: { kk: 'Күннің ойыны', ru: 'Игра дня', en: 'Daily game' },
  modeRandom: { kk: 'Еркін ойын', ru: 'Свободная игра', en: 'Free play' },
  modeTraining: { kk: 'Қателерді қайталау', ru: 'Повторить ошибки', en: 'Review mistakes' },
  trainingEmpty: {
    kk: 'Қайталайтын қате әлі жоқ',
    ru: 'Пока нет ошибок для повторения',
    en: 'No mistakes to review yet',
  },
  noCards: {
    kk: 'Бұл жинақта тексерілген карточка әлі жоқ',
    ru: 'В этом наборе пока нет проверенных карточек',
    en: 'This set has no verified cards yet',
  },
  draftWarning: {
    kk: 'Әзірлеу режимі: тексерілмеген карточкалар да көрсетіледі',
    ru: 'Режим разработки: показываются и непроверенные карточки',
    en: 'Dev mode: unverified cards are shown too',
  },
  round: { kk: 'Раунд {n} / {total}', ru: 'Раунд {n} из {total}', en: 'Round {n} of {total}' },
  whatYear: { kk: 'Қай жыл?', ru: 'Какой год?', en: 'What year?' },
  where: { kk: 'Қай жерде?', ru: 'Где это?', en: 'Where?' },
  tapMap: {
    kk: 'Картаны басып, нүкте қойыңыз',
    ru: 'Нажмите на карту, чтобы поставить точку',
    en: 'Tap the map to place a pin',
  },
  reset: { kk: 'Тазалау', ru: 'Сбросить', en: 'Reset' },
  submit: { kk: 'Жауап беру', ru: 'Ответить', en: 'Submit' },
  needPlace: {
    kk: 'Алдымен картадан орынды белгілеңіз',
    ru: 'Сначала отметьте место на карте',
    en: 'Place a pin on the map first',
  },
  correct: { kk: 'Дұрыс жауап', ru: 'Правильный ответ', en: 'Correct answer' },
  yourGuess: { kk: 'Сіздің жауабыңыз', ru: 'Ваш ответ', en: 'Your guess' },
  yearsOff: { kk: 'Жыл айырмасы: {n}', ru: 'Разница в годах: {n}', en: 'Years off: {n}' },
  kmOff: { kk: 'Қашықтық: {n} км', ru: 'Расстояние: {n} км', en: 'Distance: {n} km' },
  yearPoints: { kk: 'Жыл үшін: {n}', ru: 'За год: {n}', en: 'Year: {n}' },
  placePoints: { kk: 'Орын үшін: {n}', ru: 'За место: {n}', en: 'Place: {n}' },
  clue: { kk: 'Қалай табуға болады', ru: 'Как можно было догадаться', en: 'How to tell' },
  sources: { kk: 'Дереккөздер', ru: 'Источники', en: 'Sources' },
  imageBy: { kk: 'Сурет', ru: 'Изображение', en: 'Image' },
  next: { kk: 'Келесі', ru: 'Дальше', en: 'Next' },
  toResults: { kk: 'Нәтижеге өту', ru: 'К итогам', en: 'See results' },
  results: { kk: 'Нәтиже', ru: 'Итоги', en: 'Results' },
  total: { kk: 'Барлығы', ru: 'Итого', en: 'Total' },
  share: { kk: 'Бөлісу', ru: 'Поделиться', en: 'Share' },
  copied: { kk: 'Көшірілді', ru: 'Скопировано', en: 'Copied' },
  playAgain: { kk: 'Тағы ойнау', ru: 'Сыграть ещё', en: 'Play again' },
  home: { kk: 'Басты бет', ru: 'На главную', en: 'Home' },
} satisfies Record<string, L10n>;

export type StringKey = keyof typeof STRINGS;

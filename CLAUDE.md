# Тарих Guessr

Веб-игра для Republic Day Hackathon (трек 1 «Тарих тірілді»): игрок видит историческое фото, угадывает год (ползунок 1400–2025) и место на карте Казахстана, получает разбор события. 5 раундов, до 100 очков за год и до 100 за место, максимум 1000.

## Стек
- Vite + React 18 + TypeScript, карта на react-leaflet 4 (тайлы OpenStreetMap)
- Карточки в `content/cards.json`, картинки в `content/images/` (Vite отдаёт `content/` как статику, путь в карточке: `images/<file>`)
- Прогресс в localStorage, без базы данных
- Деплой: Vercel, ИИ-гид в `api/guide`, ключ только в переменных окружения Vercel

## Команды
- `npm run dev`: локальный сервер (в dev видны непроверенные карточки; на проде добавьте `?dev=1`)
- `npm run build`: проверка типов + сборка. Запускать после каждого изменения.
- `python3 scripts/validate.py`: проверка карточек (`--draft` пропускает пустой `verified_by`)
- `python3 scripts/fetch_commons.py "File:Name.jpg"`: скачать фото с Wikimedia Commons и получить блок `image_credit`

## Папки и владельцы
| Папка | Владелец |
|---|---|
| `src/game/`, `src/i18n/`, `src/App.tsx`, `src/main.tsx` | Участник 1 |
| `src/map/`, `src/progress/`, `src/styles/` | Участник 2 |
| `content/`, `scripts/` | Участник 3 |
| `api/`, `pitch/`, настройки деплоя | Участник 4 |

Не меняй чужие папки. Нужно что-то у соседа — напиши ему.

## Правила
- Все тексты интерфейса только через `src/i18n/strings.ts` (ключ → kk/ru/en), никаких строк прямо в компонентах.
- Формат карточки — тип `Card` в `src/game/types.ts` и `content/schema.json`. Не меняем без общего согласия.
- Карточка без `sources`, `image_credit` или `verified_by` в прод-игру не попадает.
- Никогда не придумывай даты, факты и источники. Не уверен — оставь TODO.
- Только настоящие фото/картины/документы со свободной лицензией, без ИИ-картинок, без подписи с годом на изображении.
- Интерфейс крупный (кнопки от 48px), сначала мобильная версия.

## Формат карточки
```json
{
  "id": "example-semey",
  "pack": ["kz", "semey"],
  "year": 1900,
  "lat": 50.41,
  "lng": 80.23,
  "place": { "kk": "Семей", "ru": "Семей", "en": "Semey" },
  "image": "images/example-semey.jpg",
  "image_credit": { "author": "…", "license": "Public domain / CC BY-SA 4.0", "source_url": "https://commons.wikimedia.org/wiki/File:…" },
  "title": { "kk": "…", "ru": "…", "en": "…" },
  "explanation": { "kk": "2–3 сөйлем", "ru": "2–3 предложения", "en": "…" },
  "clue": { "kk": "…", "ru": "По каким деталям догадаться", "en": "…" },
  "sources": ["https://…"],
  "difficulty": 2,
  "verified_by": "имя проверившего"
}
```

## Где что лежит
- `src/game/scoring.ts`: очки. Год: `round(100 * exp(-|Δ| / 25))`, место: `round(100 * exp(-км / 400))`
- `src/game/pick.ts`: игра дня (сид = дата + набор, у всех одинаковые 5 карточек) и случайный выбор
- `src/map/distance.ts`: `distanceKm` (гаверсинус)
- `src/progress/storage.ts`: результаты по карточкам, список ошибок (< 100 из 200) для режима повторения

# Тарих Guessr

Веб-игра для Republic Day Hackathon (трек 1 «Тарих тірілді»): игрок видит историческое фото, угадывает год (ползунок 1400–2025) и место на карте Казахстана, получает разбор события. 5 раундов, до 100 очков за год и до 100 за место, максимум 1000.

## Стек
- Vite 6 + React 18 + TypeScript, Tailwind CSS 4, framer-motion, иконки lucide-react
- Карты: MapLibre GL через react-map-gl (спутник Esri + рельеф AWS Terrain, без ключей; квест — тайлы OpenStreetMap). Воркер MapLibre подключается в `src/map/styles.ts`
- Дизайн: тёмная тема, золотой акцент, шрифты Spectral (заголовки) и Golos Text. Цвета — токены в `src/styles/app.css`, компоненты в `src/ui/`
- Карточки в `content/cards.json`, картинки в `content/images/` (Vite отдаёт `content/` как статику, путь в карточке: `images/<file>`)
- События карты истории и режимов «Ханы и битвы» / «Вид со спутника» в `content/events.json` (`era` — id эпохи из `content/periods.json`, `approx: true` — место примерное, год до н.э. — отрицательный, такие события только на карте)
- Эпохи и их контуры: `content/periods.json`, `content/geo/eras/*.geojson`; граница и области: `content/geo/`; заметки по областям: `content/regions.json`
- Памятники Костанайской области с data.egov.kz: `content/monuments-kostanay.json` (`python3 scripts/import_monuments.py`)
- Прогресс в localStorage, без базы данных
- Деплой: Vercel, ИИ-гид в `api/guide.ts` (Claude API, модель `claude-opus-5-5`), ключ `ANTHROPIC_API_KEY` только в переменных окружения Vercel. Без ключа гид отвечает поиском по базе игры прямо в браузере (`src/guide/`)
- Квест по Семею: маршрут в `content/quest-semey.json`, экран в `src/quest/`

## Команды
- `npm run dev`: локальный сервер (в dev видны непроверенные карточки; на проде добавьте `?dev=1`)
- `npm run build`: проверка типов + сборка. Запускать после каждого изменения.
- `python3 scripts/validate.py`: проверка карточек и событий (`--draft` пропускает пустой `verified_by`)
- `python3 scripts/fetch_commons.py "File:Name.jpg"`: скачать фото с Wikimedia Commons и получить блок `image_credit`

## Папки и владельцы
| Папка | Владелец |
|---|---|
| `src/game/`, `src/i18n/`, `src/landing/`, `src/App.tsx`, `src/main.tsx` | Участник 1 |
| `src/map/`, `src/atlas/`, `src/ui/`, `src/progress/`, `src/styles/` | Участник 2 |
| `content/`, `scripts/` | Участник 3 |
| `api/`, `pitch/`, настройки деплоя | Участник 4 |

Не меняй чужие папки. Нужно что-то у соседа — напиши ему.

## Правила
- Все тексты интерфейса только через `src/i18n/strings.ts` (ключ → kk/ru/en), никаких строк прямо в компонентах.
- Формат карточки — тип `Card` в `src/game/types.ts` и `content/schema.json`. Не меняем без общего согласия.
- Карточка без `sources`, `image_credit` или `verified_by` в прод-игру не попадает.
- Никогда не придумывай даты, факты и источники. Не уверен — оставь TODO.
- Только настоящие фото/картины/документы со свободной лицензией, без ИИ-картинок, без подписи с годом на изображении.
- Интерфейс крупный (кнопки от 48px), сначала мобильная версия. Стили — классы Tailwind и токены темы, без новых цветов «на глаз».

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

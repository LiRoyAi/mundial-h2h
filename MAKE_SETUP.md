# Make.com — Mundial H2H Scenariusze Setup

## Wymagania przed startem

### 1. Połączenia (Connections) — skonfiguruj raz
W Make → Connections → Create new:
- **Facebook Pages** — połącz konto FB z dostępem do strony
- **Instagram for Business** — połącz IG Business podłączony do FB Page

### 2. Pobierz ID strony Facebook i ID konta Instagram
- Strona FB: Settings → Page Info → Page ID (np. `123456789`)
- Konto IG: [Graph API Explorer](https://developers.facebook.com/tools/explorer/) → `/me/accounts` → znajdź `instagram_business_account.id`

### 3. Endpoint matches (nowy — musi być deploy na Vercel)
```
https://mundial.liroy.pl/api/mundial/matches
```
Zwraca tablicę obiektów:
```json
[{ "id":"mex-rsa", "t1":{"name":"Meksyk","flag":"🇲🇽"}, "t2":{"name":"RPA","flag":"🇿🇦"},
   "deadline":"2026-06-11T19:00:00Z", "youtube_pl":"https://...", "result":null }]
```

---

## SCENARIUSZ 1 — "Mundial: 24h przed meczem"

### Opis
Co godzinę sprawdza czy jakiś mecz ma deadline za ~24h. Jeśli tak — publuuje post z share-card.

### Moduły do dodania (w kolejności):

**1. Schedule trigger**
- `Run scenario` → Every hour

**2. HTTP → Make a request**
- URL: `https://mundial.liroy.pl/api/mundial/matches`
- Method: GET
- Parse response: Yes → jako JSON

**3. JSON → Parse JSON**
- JSON string: output z modułu 2 (body)

**4. Iterator** (Tools → Iterator)
- Array: `{{3.array}}` (output z Parse JSON)

**5. Filter — "24h przed meczem"**
- Label: `Za 23-25h`
- Condition: `{{formatDate(parseDate(4.deadline; "YYYY-MM-DD'T'HH:mm:ssZ"); "X")}}` `greater than` `{{formatDate(addHours(now; 23); "X")}}`
- AND: `{{formatDate(parseDate(4.deadline; "YYYY-MM-DD'T'HH:mm:ssZ"); "X")}}` `less than` `{{formatDate(addHours(now; 25); "X")}}`

**6. HTTP → Make a request (pobierz share-card)**
- URL: `https://mundial.liroy.pl/api/mundial/share-card?type=pick&nick=&score=&t1={{encodeURL(4.t1.name)}}&t2={{encodeURL(4.t2.name)}}&f1={{encodeURL(4.t1.flag)}}&f2={{encodeURL(4.t2.flag)}}`
- Method: GET
- Response type: `Binary`

**7. Facebook Pages → Create a Page Photo**
- Connection: [twoje połączenie FB]
- Page ID: [ID twojej strony]
- Photo source: `{{6.body}}` (binary z kroku 6)
- Message:
```
🏆 JUTRO GRAJĄ! {{4.t1.flag}} {{4.t1.name}} vs {{4.t2.name}} {{4.t2.flag}}

Znasz historię tych starć?
👉 H2H Archive: {{4.youtube_pl}}

Typuj wynik przed meczem!
🔗 mundial.liroy.pl
```

**8. Instagram for Business → Create a Photo Post**
- Connection: [twoje połączenie IG]
- Instagram Account ID: [ID konta IG]
- Image URL: `https://mundial.liroy.pl/api/mundial/share-card?type=pick&t1={{encodeURL(4.t1.name)}}&t2={{encodeURL(4.t2.name)}}&f1={{encodeURL(4.t1.flag)}}&f2={{encodeURL(4.t2.flag)}}`
- Caption: (ten sam tekst co FB powyżej)

### Harmonogram
- Interval: 1 hour
- Strefa: Europe/Warsaw

---

## SCENARIUSZ 2 — "Mundial: 2h przed meczem"

### Opis
Co 15 minut sprawdza czy jakiś mecz zaczyna się za ~2h. Post "ostatnia szansa na typ".

### Moduły:

**1. Schedule trigger**
- Every 15 minutes

**2-4. HTTP + JSON Parse + Iterator** — identyczne jak w Scenariuszu 1

**5. Filter — "Za 1h45m–2h15m"**
- `deadline` greater than `{{formatDate(addMinutes(now; 105); "X")}}`
- AND `deadline` less than `{{formatDate(addMinutes(now; 135); "X")}}`

**6. HTTP share-card** — identyczny URL jak Scenariusz 1

**7. Facebook Pages → Create Page Photo**
- Message:
```
⚽ ZA 2H GWIZDEK! {{4.t1.flag}} {{4.t1.name}} vs {{4.t2.name}} {{4.t2.flag}}

Ostatnia szansa na typ! ⏰
🔗 mundial.liroy.pl

H2H historia: {{4.youtube_pl}}
```

**8. Instagram → Create Photo Post**
- Image URL: (jak wyżej)
- Caption: (ten sam tekst)

---

## SCENARIUSZ 3 — "Mundial: Po wpisaniu wyniku" (Webhook)

### Opis
Wyzwalany przez POST z result/route.ts po wpisaniu wyniku. Publuuje wynik na FB i IG.

### Krok 0 — Utwórz webhook w Make
1. Utwórz nowy scenariusz
2. Jako trigger wybierz **Webhooks → Custom webhook**
3. Kliknij **Add** → nazwij `mundial-result` → **Save**
4. Skopiuj wygenerowany URL (np. `https://hook.eu2.make.com/xxxxxx`)
5. Wklej go do `/Users/l/Desktop/mundial-h2h/.env.local`:
   ```
   MAKE_WEBHOOK_RESULT=https://hook.eu2.make.com/xxxxxx
   ```
6. Wklej go też jako zmienną środowiskową na Vercel (Settings → Environment Variables)

### Moduły:

**1. Webhooks → Custom webhook**
- Kliknij **Redetermine data structure** → wyślij testowy POST:
```bash
curl -X POST https://hook.eu2.make.com/TWOJ_URL \
  -H "Content-Type: application/json" \
  -d '{"matchId":"test-123","result":"2:1","t1":"Meksyk","t2":"RPA","f1":"🇲🇽","f2":"🇿🇦"}'
```
- Make wykryje strukturę automatycznie

**2. HTTP → Make a request (share-card)**
- URL: `https://mundial.liroy.pl/api/mundial/share-card?type=pick&t1={{encodeURL(1.t1)}}&t2={{encodeURL(1.t2)}}&f1={{encodeURL(1.f1)}}&f2={{encodeURL(1.f2)}}&score={{encodeURL(1.result)}}`
- Method: GET
- Response type: `Binary`

**3. Facebook Pages → Create Page Photo**
- Photo source: `{{2.body}}`
- Message:
```
✅ WYNIK: {{1.f1}} {{1.t1}} {{1.result}} {{1.t2}} {{1.f2}}

Kto trafił typ? Sprawdź ranking!
🔗 mundial.liroy.pl
```

**4. Instagram for Business → Create Photo Post**
- Image URL: (ten sam URL co krok 2)
- Caption: (ten sam tekst co FB)

---

## Kolejność wdrożenia

1. Deploy nowego kodu na Vercel (`git push`) — pojawi się endpoint `/api/mundial/matches`
2. Zweryfikuj: `curl https://mundial.liroy.pl/api/mundial/matches | head -c 500`
3. W Make utwórz połączenia FB + IG (Connections)
4. Utwórz Scenariusz 3 (webhook) → skopiuj URL → dodaj do Vercel env vars → redeploy
5. Utwórz Scenariusz 1 i 2
6. Włącz wszystkie 3 scenariusze (toggle ON)
7. Przetestuj Scenariusz 3 ręcznie:
```bash
curl -X POST https://mundial.liroy.pl/api/mundial/result \
  -H "Content-Type: application/json" \
  -d '{"matchId":"mex-rsa","result":"2:1","adminKey":"mundial2026admin"}'
```

---

## Zmienne środowiskowe (Vercel)

| Zmienna | Wartość |
|---------|---------|
| `MAKE_WEBHOOK_RESULT` | URL z kroku 0 Scenariusza 3 |
| `ADMIN_KEY` | `mundial2026admin` |

Dodaj przez: Vercel Dashboard → Project → Settings → Environment Variables → redeploy.

---

## Share-card URL encoding — uwagi

- Flagi emoji (np. 🇲🇽) działają przez `encodeURL()` w Make — Make sam URL-encoduje unicode
- Polskie znaki (ą, ę, ó) też — Make obsługuje UTF-8
- Jeśli PNG nie ładuje się na IG: sprawdź czy `https://mundial.liroy.pl/api/mundial/share-card?type=pick&t1=Meksyk&t2=RPA&f1=🇲🇽&f2=🇿🇦` zwraca Content-Type: image/png

---

## Testowanie share-card URL

```bash
# Test bezpośredni:
curl -I "https://mundial.liroy.pl/api/mundial/share-card?type=pick&t1=Meksyk&t2=RPA&f1=%F0%9F%87%B2%F0%9F%87%BD&f2=%F0%9F%87%BF%F0%9F%87%A6"
# Oczekiwane: Content-Type: image/png

# Pobierz PNG:
curl -o test-card.png "https://mundial.liroy.pl/api/mundial/share-card?type=pick&t1=Meksyk&t2=RPA&f1=%F0%9F%87%B2%F0%9F%87%BD&f2=%F0%9F%87%BF%F0%9F%87%A6"
open test-card.png
```

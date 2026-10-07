# GitHub Custom Comment Hint

## Summary

Dodaj przyciski z własnym tekstem nad edytorem komentarzy w PR-ach i Issues GitHuba. Współdziel layouty między repozytoriami, dopisuj lub zastępuj tekst i cofaj ostatnie wstawienie. Ustawienia pozostają lokalne.

## Description

Często używane treści komentarzy możesz wstawiać jednym kliknięciem. GitHub
Custom Comment Hint dodaje konfigurowalne przyciski nad zakładkami Write/Preview
w głównym edytorze nowego komentarza w PR-ach i Issues na github.com.

- Twórz nazwane layouty i używaj ich w wielu repozytoriach.
- Łącz layouty w wybranej kolejności w siatce z trzema kolumnami.
- Zastępuj szkic dokładną treścią lub dopisuj tekst na końcu.
- Cofaj ostatnie wstawienie wraz z poprzednim zaznaczeniem kursora.
- Używaj emoji, Unicode i tekstów wielowierszowych w jasnym i ciemnym motywie.
- Edytuj layouty, przypisania i JSON we wspólnym szkicu ustawień.
- Importuj i eksportuj konfigurację jako JSON w UTF-8.
- Wybieraj repozytoria z lokalnych podpowiedzi lub wpisuj je ręcznie. Opcjonalnie
  zaimportuj repozytoria GitHuba z historii zachowanej w Firefoksie.
- Korzystaj z interfejsu PL/EN oraz obsługi przycisków z klawiatury.

## Getting started

Kliknij ikonę rozszerzenia, aby otworzyć ustawienia. W Przypisaniach dodaj
właściciela i nazwę repozytorium, przypisz co najmniej jeden layout i kliknij
Zapisz. Otwórz PR lub Issue, gdzie Twoje konto GitHuba może komentować.
Przyciski pojawią się nad Write/Preview w głównym edytorze Add a comment.

Layouty `ci` i `codex` są przykładami, które możesz edytować. `/ci-now` oraz
`@codex review` to zwykłe wstawiane teksty; ich działanie po opublikowaniu
zależy od integracji w repozytorium. Rozszerzenie nie zapewnia usługi CI ani
konta Codex. Nowa instalacja nie ma przypisanych repozytoriów.

Przyciski wstawiają tekst. Publikujesz go przyciskiem Comment GitHuba.
Ręczna edycja lub wysłanie komentarza usuwa możliwość cofnięcia.
Rozszerzenie pomija edycję istniejących komentarzy i komentarze do kodu.

## Permissions and privacy

Ustawienia i zapamiętane nazwy właścicieli/repozytoriów pozostają w lokalnym
storage rozszerzenia w Firefoksie. Dodatek nie wykonuje żądań sieciowych i nie
ma telemetrii, tokenów, zdalnego kodu ani serwera. Dostęp do GitHuba umożliwia
dodanie przycisków i zapamiętywanie odwiedzonych repozytoriów. Opcjonalny dostęp
do historii jest wymagany dopiero po kliknięciu Importuj historię GitHuba.
Możesz odmówić i nadal ustawiać repozytoria ręcznie. Wizyty z okien prywatnych
nie są dodawane do podpowiedzi repozytoriów.

Wymagany jest Firefox Desktop 140 lub nowszy. Ta wersja obsługuje github.com;
nie obsługuje hostów GitHub Enterprise ani Firefoksa dla Androida.

GitHub Custom Comment Hint to niezależne rozszerzenie, które nie jest powiązane
z GitHubem, Mozillą ani OpenAI i nie jest przez te firmy rekomendowane.

## Release notes — 1.0.0

Pierwsza przygotowana wersja publiczna: współdzielone layouty, uporządkowane
przypisania do repozytoriów, dopisywanie/zastępowanie tekstu, cofanie ostatniego
wstawienia, ustawienia PL/EN, import/eksport JSON, lokalne podpowiedzi
repozytoriów i opcjonalny import historii GitHuba.

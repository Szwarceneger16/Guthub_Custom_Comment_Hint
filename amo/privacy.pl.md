# Polityka prywatności

GitHub Custom Comment Hint nie przesyła danych do serwerów i nie ma analityki,
telemetrii, tokenów GitHuba, zdalnego kodu ani usług zewnętrznych. Konfiguracja
jest zapisywana w lokalnym storage rozszerzenia w profilu Firefoksa. Import
i eksport plików odbywają się wyłącznie na polecenie użytkownika.

Na github.com dodatek odczytuje URL, aby dopasować repozytorium, i sprawdza
strukturę strony, aby znaleźć główny edytor nowego komentarza. Po kliknięciu
przycisku wstawia skonfigurowany tekst do pola komentarza. Poprzedni tekst
i zaznaczenie dla funkcji Cofnij pozostają wyłącznie w pamięci; nie są zapisywane
w konfiguracji ani logowane. Komentarz wysyła użytkownik przyciskiem GitHuba,
a to wysłanie podlega zasadom GitHuba.

Wymagane uprawnienia to lokalny `storage` i dostęp do `https://github.com/*`.
Inne hosty i subdomeny nie są objęte uprawnieniami. Dodatek zapamiętuje nazwy
właścicieli i repozytoriów odwiedzanych na GitHubie, również na stronach plików,
Actions, PR i Issues. Nie korzysta z listy otwartych kart i nie zapisuje wizyt
z okien prywatnych. Katalog zawiera tylko pary owner/repo; nie zawiera pełnych
URL-i, tytułów, dat odwiedzin ani treści komentarzy.

Opcjonalne uprawnienie `history` jest wymagane dopiero po kliknięciu Importuj
historię GitHuba w Przypisaniach. Firefoks przyznaje dostęp do historii całej
przeglądarki, ale dodatek wyszukuje jedynie zachowane wpisy `https://github.com/`,
sprawdza dokładny host i odrzuca trasy, które nie wskazują repozytorium.
Każde kliknięcie wykonuje jeden import. Nie ma ciągłego nasłuchiwania historii.
Zgoda pozostaje do jej cofnięcia w uprawnieniach dodatku. Dodatek nie odczytuje
ciasteczek i nie zmienia historii. Odmowa nie blokuje ręcznej konfiguracji.

Import i czyszczenie podpowiedzi nie zmieniają szkicu ani przypisań konfiguracji.
Wyczyść zapamiętane repozytoria usuwa lokalny katalog; przypisania pozostają,
a kolejne wizyty lub import mogą ponownie dodać podpowiedzi. Eksport JSON zawiera
tylko konfigurację. Deklaracja `data_collection_permissions.required: ["none"]`
oznacza, że przetwarzanie opisane powyżej pozostaje lokalne i dane nie są wysyłane
poza przeglądarkę. Usunięcie dodatku usuwa jego lokalny storage przez Firefoksa;
wyeksportowane pliki pozostają w miejscu, w którym użytkownik je zapisał.

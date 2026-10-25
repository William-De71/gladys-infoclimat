# Infoclimat

## Überblick

Diese Integration bringt die Wetterstationen von [Infoclimat](https://www.infoclimat.fr) in Gladys. Infoclimat ist ein französischer gemeinnütziger Verein: Seine Mitglieder teilen die Messwerte ihrer eigenen Stationen (das **StatIC**-Netz, rund 900 täglich meldende Stationen, vor allem in Frankreich, einige in Belgien, der Schweiz, Spanien und Italien), dazu kommen offizielle Stationen. Du verfolgst bis zu drei Stationen: die nächste StatIC-Station eines Hauses in Gladys oder eine über ihre Kennung gewählte Station.

Jede Station wird zu einem Gerät mit den Werten, die sie tatsächlich liefert: Temperatur, Luftfeuchtigkeit, Luftdruck auf Meereshöhe, Taupunkt, mittlerer Wind, Böen, Windrichtung, Regen der letzten Stunde, Regen des Tages und bei manchen Stationen Schneehöhe und Sichtweite. Szenen können reagieren, wenn an einer Station Regen beginnt oder aufhört, wenn eine Station verstummt oder wenn Infoclimat deinen Schlüssel ablehnt. Drei Dashboard-Widgets zeigen die letzte Messung, die letzten 24 Stunden eines Werts und die Stationen nebeneinander.

![Die drei Widgets: die letzte Messung einer Station, ihre Temperatur der letzten 24 Stunden und die verfolgten Stationen nebeneinander (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-infoclimat/main/docs/assets/widgets.de.png)

Transport: Cloud. Alle 10 Minuten fragt die Integration Infoclimat mit deinem Schlüssel nach den Messwerten deiner Stationen, in einer einzigen Anfrage. Der Standort deines Hauses verlässt Gladys nie: Die nächste Station wird in der öffentlichen Stationsliste gesucht, innerhalb der Integration.

**Noch nicht mit einem echten Infoclimat-Schlüssel getestet**: Die Anfragen folgen der Open-Data-API von Infoclimat und ihren echten Antworten ohne Schlüssel; bitte melde, was du beobachtest.

## Voraussetzungen

- Gladys Assistant **5.3.0** oder neuer (Hausauswahl, Widgets und Szenen von Integrationen).
- Ein kostenloser **Infoclimat-Open-Data-Schlüssel**: Beantrage ihn auf [der Open-Data-Seite von Infoclimat](https://www.infoclimat.fr/opendata/).
- Um die nächste Station eines Hauses zu verfolgen: der Standort des Hauses in Gladys (Einstellungen → Häuser).

Die Daten sind für eine private, nicht kommerzielle Nutzung kostenlos. Viele StatIC-Stationen stehen unter der Lizenz CC BY-NC (nicht kommerziell): Die Widgets nennen Infoclimat und die Lizenz jeder Station; behalte diese Angabe, wenn du sie teilst.

## Konfiguration

| Feld                                       | Standard    | Bedeutung                                                                             |
| ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------- |
| Open-Data-Schlüssel                        | —           | Pflichtfeld, geheim, nie wieder angezeigt und nie in die Logs geschrieben             |
| Station 1, 2, 3: Haus                      | —           | Die nächste StatIC-Station dieses Hauses, die in den letzten 24 Stunden gemeldet hat  |
| Station 1, 2, 3: Oder eine Stationskennung | —           | `000P2`, `STATIC0095` oder eine offizielle Station; hat Vorrang vor dem Haus          |
| Abfrageintervall                           | 10 Min.     | 10, 15, 30 oder 60 Minuten; alle Stationen in einer Anfrage                           |
| Sprache der Texte                          | automatisch | Gerätenamen und Szenentexte; automatisch folgt dem letzten Widget, sonst der Zeitzone |

Die Kennung einer Station steht am Ende der Adresse ihrer Seite auf infoclimat.fr: `https://www.infoclimat.fr/observations-meteo/temps-reel/besancon/000P2.html` → `000P2`. Nutze [die Stationskarte](https://www.infoclimat.fr/stations-meteo/), um eine zu finden. Offizielle Stationen (synoptische Stationen von Météo-France) stehen nicht in der öffentlichen Liste, können aber über ihre Kennung eingegeben werden.

Die nächste Station eines Hauses bleibt erhalten, solange sie meldet. Bleibt sie 24 Stunden stumm, wird die nächstgelegene gewählt und ein neues Gerät angeboten.

Konfigurationsschaltflächen: **Jetzt lesen** ermittelt die Stationen und liest sie sofort (nie zweimal innerhalb von 2 Minuten); **Diagnose** schreibt den Zustand der Integration in ihre Logs, ohne den Schlüssel.

## Nutzung

### Geräte

Öffne nach der ersten Abfrage **Entdecken** und füge die gewünschten Stationen hinzu. Jedes Gerät hat nur die Funktionen der Werte, die seine Station liefert:

| Funktion                          | Kategorie / Typ                    | Einheit |
| --------------------------------- | ---------------------------------- | ------- |
| Temperatur                        | `temperature-sensor` / `decimal`   | °C      |
| Luftfeuchtigkeit                  | `humidity-sensor` / `decimal`      | %       |
| Luftdruck (Meereshöhe)            | `pressure-sensor` / `decimal`      | hPa     |
| Taupunkt                          | `temperature-sensor` / `probe`     | °C      |
| Mittlere Windgeschwindigkeit, Böe | `speed-sensor` / `decimal`         | km/h    |
| Windrichtung                      | `angle-sensor` / `integer`         | °       |
| Regen der letzten Stunde          | `precipitation-sensor` / `decimal` | mm/h    |
| Regen heute (seit 0 Uhr UTC)      | `precipitation-sensor` / `decimal` | mm/Tag  |
| Schneehöhe, Sichtweite            | `distance-sensor` / `decimal`      | cm, m   |

Eine einmal gelieferte Funktion bleibt: Eine leere Messung entfernt sie nie. Liefert eine Station einen neuen Wert, fügt **Aktualisieren** im Tab Entdecken ihn hinzu. Der Taupunkt ist eine Temperatur vom Typ `probe`: Er zählt nie zur Temperatur eines Raums. Der Regen des Tages ist der von Infoclimat, wenn die Station ihn liefert, sonst die Summe der vollen Stunden seit 0 Uhr UTC. Die Sonneneinstrahlung (W/m²) hat keine Einheit in Gladys: Sie wird in den Widgets gezeigt und an die Szenen übergeben.

### Dashboard-Widgets

- **Infoclimat-Station**: die letzte Messung einer Station, bis zu sechs Kacheln (Temperatur, Luftfeuchtigkeit, Wind und Richtung, Böen, Luftdruck, Regen heute), die übrigen Werte im Text und die Quellenangabe Infoclimat.
- **Infoclimat, letzte 24 Std.**: ein Wert über die letzten 24 Stunden (Temperatur mit Taupunkt, Luftfeuchtigkeit, Luftdruck, Wind mit Böen oder Regen), Tiefst- und Höchstwert markiert.
- **Infoclimat-Stationen**: die verfolgten Stationen nebeneinander; eine stumme Station wird markiert.

Es gibt keine Aktualisieren-Schaltfläche: Infoclimat wird von Freiwilligen betrieben, und die Integration fragt nie öfter als ihr Timer.

### Szenen

Auslöser (ein Ereignis pro Änderung, nie bei der ersten Messung einer Station):

- **Regen beginnt**: Der Regen der letzten Stunde an einer Station steigt über 0.
- **Regen hört auf**: Er fällt auf 0 zurück, also bis zu eine Stunde nach dem letzten Tropfen.
- **Station stumm**: Eine Station hat seit 90 Minuten keine Messung geliefert. **Station wieder da**: Sie meldet sich wieder.
- **Schlüssel abgelehnt**: Infoclimat lehnt den Schlüssel ab, einmal, bis er wieder funktioniert.

Jeder Stationsauslöser kann auf eine Station gefiltert werden und liefert die Station, ihren Namen, die Temperatur, den Regen der Stunde und des Tages, die Zeit der Messung und ihr Alter in Minuten. Die Regenauslöser brauchen eine Station, die Regen misst.

Aktion **Station lesen**: die letzte Messung (Temperatur, Luftfeuchtigkeit, Luftdruck, Taupunkt, Wind, Böen, Richtung, Regen, Einstrahlung, Zeit, Alter) und ein Satz für eine Nachricht. Sie sendet nie eine Anfrage: Sie antwortet mit der letzten Messung.

Beispiele:

- Wenn an „Infoclimat Chenecey-Buillon“ Regen beginnt → das Dachfenster schließen und „Es regnet an der Station: {{triggerEvent.data.rain_1h}} mm in der letzten Stunde“ senden.
- Jeden Morgen um 7 Uhr → eine Station lesen → die Zusammenfassung als Nachricht senden.
- Wenn der Schlüssel abgelehnt wird → den Administrator benachrichtigen (der Schlüssel kann an eine geänderte IP-Adresse gebunden sein).

Die Werte selbst (Temperatur, Böen …) sind Gerätefunktionen: „Böen über 60 km/h“ oder „Temperatur unter 0 °C“ sind Geräteauslöser von Gladys.

## Fehlerbehebung

- **„Infoclimat lehnt den Schlüssel ab“**: Prüfe den Schlüssel auf der Open-Data-Seite von Infoclimat. Ein Schlüssel kann an die öffentliche IP-Adresse gebunden sein, von der er genutzt wurde: Mit einer dynamischen IP-Adresse kann er nach einem Adresswechsel aufhören zu funktionieren. Beantrage bei Infoclimat einen neuen Schlüssel, füge ihn ein, und die Integration versucht es sofort erneut; sonst alle 6 Stunden.
- **Kein Gerät im Tab Entdecken**: Eine Station wird nach ihrer ersten Messung angeboten, innerhalb von 10 Minuten; drücke **Jetzt lesen**. Prüfe die Kennung oder ob das Haus einen Standort hat.
- **„keine Messung in den letzten 24 Stunden“**: Die Station ist stumm oder die Kennung falsch; wähle eine andere.
- **Ein Wert fehlt**: Die Station misst ihn nicht oder hat ihn zuletzt nicht gesendet; die Funktion behält ihren letzten Wert.
- **Infoclimat ist nicht erreichbar**: Die Integration wartet nach jedem Fehler länger (bis zu einer Stunde), nach „zu viele Anfragen“ eine Stunde.
- Die Vorhersagen von Infoclimat sind nicht Teil dieser Version (anderer Schlüssel, andere API).
- Um ein Problem zu melden, eröffne ein Issue auf [GitHub](https://github.com/William-De71/gladys-infoclimat/issues) mit den Versionen von Gladys und der Integration und dem Ergebnis von **Diagnose** (in den Logs der Integration). Füge nie deinen Schlüssel ein.

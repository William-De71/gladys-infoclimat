# Infoclimat

## Présentation

Cette intégration amène dans Gladys les stations météo d’[Infoclimat](https://www.infoclimat.fr). Infoclimat est une association loi 1901 : ses membres partagent les relevés de leurs propres stations (le réseau **StatIC**, environ 900 stations qui émettent chaque jour, surtout en France, quelques-unes en Belgique, en Suisse, en Espagne, en Italie), à côté de stations officielles. Vous suivez jusqu’à trois stations : la station StatIC la plus proche d’une maison de Gladys, ou une station choisie par son identifiant.

Chaque station devient un appareil avec les mesures qu’elle fournit réellement : température, humidité, pression au niveau de la mer, point de rosée, vent moyen, rafales, direction du vent, pluie de la dernière heure, pluie du jour et, pour certaines stations, neige au sol et visibilité. Les scènes peuvent réagir quand la pluie commence ou s’arrête à une station, quand une station devient muette, ou quand Infoclimat refuse votre clé. Trois widgets de tableau de bord affichent le dernier relevé, les dernières 24 heures d’une mesure et les stations côte à côte.

![Les trois widgets : le dernier relevé d’une station, sa température sur les dernières 24 heures et les stations suivies côte à côte (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-infoclimat/main/docs/assets/widgets.fr.png)

Transport : cloud. Toutes les 10 minutes, l’intégration demande à Infoclimat les relevés de vos stations, en une seule requête, avec votre clé. La position de votre maison ne quitte jamais Gladys : la station la plus proche est cherchée dans la liste publique des stations, à l’intérieur de l’intégration.

**Pas encore testée avec une vraie clé Infoclimat** : les requêtes suivent l’API open data d’Infoclimat et ses vraies réponses sans clé ; merci de signaler ce que vous observez.

## Prérequis

- Gladys Assistant **5.2.0** ou plus récent (sélecteur de maison, widgets et scènes des intégrations).
- Une **clé open data Infoclimat** gratuite : demandez-la sur [la page open data d’Infoclimat](https://www.infoclimat.fr/opendata/).
- Pour suivre la station la plus proche d’une maison : la position de la maison renseignée dans Gladys (Paramètres → Maisons).

Les données sont gratuites pour un usage personnel, non commercial. Beaucoup de stations StatIC sont publiées sous licence CC BY-NC (pas d’usage commercial) : les widgets créditent Infoclimat et la licence de chaque station ; gardez ce crédit si vous les partagez.

## Configuration

| Champ                                          | Par défaut  | Rôle                                                                                          |
| ---------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| Clé open data                                  | —           | Obligatoire, secrète, jamais réaffichée ni écrite dans les journaux                           |
| Station 1, 2, 3 : Maison                       | —           | La station StatIC la plus proche de cette maison ayant émis dans les dernières 24 heures      |
| Station 1, 2, 3 : Ou un identifiant de station | —           | `000P2`, `STATIC0095` ou une station officielle ; prioritaire sur la maison                   |
| Intervalle de lecture                          | 10 min      | 10, 15, 30 ou 60 minutes ; toutes les stations en une requête                                 |
| Langue des textes                              | automatique | Noms des appareils et textes des scènes ; automatique suit le dernier widget, sinon le fuseau |

L’identifiant d’une station figure à la fin de l’adresse de sa page sur infoclimat.fr : `https://www.infoclimat.fr/observations-meteo/temps-reel/besancon/000P2.html` → `000P2`. Utilisez [la carte des stations](https://www.infoclimat.fr/stations-meteo/) pour en trouver une. Les stations officielles (stations synoptiques de Météo-France) ne sont pas dans la liste publique mais peuvent être saisies par leur identifiant.

La station la plus proche d’une maison est conservée tant qu’elle émet. Quand elle reste muette 24 heures, la suivante est choisie et un nouvel appareil est proposé.

Boutons de configuration : **Lire maintenant** trouve les stations et les lit tout de suite (jamais deux fois en 2 minutes) ; **Diagnostic** écrit l’état de l’intégration dans ses journaux, sans la clé.

## Utilisation

### Appareils

Après la première lecture, ouvrez **Découvrir** et ajoutez les stations voulues. Chaque appareil n’a que les fonctionnalités des mesures fournies par sa station :

| Fonctionnalité                 | Catégorie / type                   | Unité |
| ------------------------------ | ---------------------------------- | ----- |
| Température                    | `temperature-sensor` / `decimal`   | °C    |
| Humidité                       | `humidity-sensor` / `decimal`      | %     |
| Pression (niveau de la mer)    | `pressure-sensor` / `decimal`      | hPa   |
| Point de rosée                 | `temperature-sensor` / `probe`     | °C    |
| Vent moyen, rafale             | `speed-sensor` / `decimal`         | km/h  |
| Direction du vent              | `angle-sensor` / `integer`         | °     |
| Pluie de la dernière heure     | `precipitation-sensor` / `decimal` | mm/h  |
| Pluie du jour (depuis 0 h UTC) | `precipitation-sensor` / `decimal` | mm/j  |
| Neige au sol, visibilité       | `distance-sensor` / `decimal`      | cm, m |

Une fonctionnalité apparue reste : un relevé vide ne la retire jamais. Quand une station fournit une nouvelle mesure, **Mettre à jour** dans l’onglet Découvrir l’ajoute. Le point de rosée est une température de type `probe` : il ne compte jamais dans la température d’une pièce. La pluie du jour est celle d’Infoclimat quand la station la fournit, sinon la somme des heures pleines depuis 0 h UTC. Le rayonnement solaire (W/m²) n’a pas d’unité dans Gladys : il est affiché dans les widgets et transmis aux scènes.

### Widgets de tableau de bord

- **Station Infoclimat** : le dernier relevé d’une station, jusqu’à six tuiles (température, humidité, vent et sa direction, rafales, pression, pluie du jour), les autres mesures dans le texte, et le crédit d’Infoclimat.
- **Infoclimat, dernières 24 h** : une mesure sur les dernières 24 heures (température avec le point de rosée, humidité, pression, vent avec les rafales, ou pluie), ses valeurs minimale et maximale marquées.
- **Stations Infoclimat** : les stations suivies côte à côte ; une station muette est signalée.

Il n’y a pas de bouton de rafraîchissement : Infoclimat fonctionne grâce à des bénévoles, et l’intégration ne l’interroge jamais plus souvent que son minuteur.

### Scènes

Déclencheurs (un événement par changement, jamais à la première lecture d’une station) :

- **Début de pluie** : la pluie de la dernière heure d’une station dépasse 0.
- **Fin de pluie** : elle retombe à 0, donc jusqu’à une heure après la dernière goutte.
- **Station muette** : une station n’a donné aucun relevé depuis 90 minutes. **Station revenue** : elle émet de nouveau.
- **Clé refusée** : Infoclimat refuse la clé, une fois jusqu’à ce qu’elle remarche.

Chaque déclencheur de station peut être filtré sur une station et transmet la station, son nom, la température, la pluie de l’heure et du jour, l’heure du relevé et son âge en minutes. Les déclencheurs de pluie demandent une station qui mesure la pluie.

Action **Lire une station** : le dernier relevé (température, humidité, pression, point de rosée, vent, rafales, direction, pluie, rayonnement, heure, âge) et une phrase prête à envoyer. Elle n’envoie jamais de requête : elle répond avec le dernier relevé.

Exemples :

- Quand la pluie commence à « Infoclimat Chenecey-Buillon » → fermer le velux et envoyer « Il pleut à la station : {{triggerEvent.data.rain_1h}} mm sur la dernière heure ».
- Chaque matin à 7 h → lire une station → envoyer le résumé par message.
- Quand la clé est refusée → prévenir l’administrateur (la clé peut être liée à une adresse IP qui a changé).

Les valeurs elles-mêmes (température, rafales…) sont des fonctionnalités d’appareil : « rafales au-dessus de 60 km/h » ou « température sous 0 °C » sont des déclencheurs d’appareil de Gladys.

## Dépannage

- **« Infoclimat refuse la clé »** : vérifiez la clé sur la page open data d’Infoclimat. Une clé peut être liée à l’adresse IP publique qui l’a utilisée : avec une adresse IP dynamique, elle peut cesser de fonctionner après un changement d’adresse. Demandez une nouvelle clé à Infoclimat, collez-la, et l’intégration réessaie aussitôt ; sinon elle réessaie toutes les 6 heures.
- **Aucun appareil dans l’onglet Découvrir** : une station est proposée après sa première lecture, dans les 10 minutes ; appuyez sur **Lire maintenant**. Vérifiez l’identifiant, ou que la maison a une position.
- **« aucun relevé dans les dernières 24 heures »** : la station est muette ou l’identifiant est faux ; choisissez-en une autre.
- **Une valeur manque** : la station ne la mesure pas, ou ne l’a pas envoyée récemment ; la fonctionnalité garde sa dernière valeur.
- **Infoclimat est injoignable** : l’intégration attend plus longtemps après chaque échec (jusqu’à une heure), et une heure après un « trop de requêtes ».
- Les prévisions d’Infoclimat ne font pas partie de cette version (autre clé, autre API).
- Pour signaler un problème, ouvrez un ticket sur [GitHub](https://github.com/William-De71/gladys-infoclimat/issues) avec les versions de Gladys et de l’intégration, et le résultat de **Diagnostic** (dans les journaux de l’intégration). Ne collez jamais votre clé.

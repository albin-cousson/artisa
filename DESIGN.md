---
name: Artisa
description: L'instrument de démarchage qui révèle les artisans sans site web, commune par commune.
colors:
  terracotta: "oklch(0.55 0.14 40)"
  terracotta-strong: "oklch(0.48 0.15 40)"
  terracotta-hover: "oklch(0.42 0.15 38)"
  terracotta-wash: "oklch(0.95 0.03 45)"
  slate-blue: "oklch(0.47 0.13 255)"
  slate-blue-light: "oklch(0.70 0.11 250)"
  ink: "oklch(0.24 0.02 40)"
  muted: "oklch(0.50 0.015 40)"
  bg: "oklch(1 0 0)"
  surface: "oklch(0.975 0.006 60)"
  border: "oklch(0.92 0.008 50)"
  success-wash: "oklch(0.94 0.03 155)"
  success-ink: "oklch(0.40 0.10 155)"
  danger: "oklch(0.53 0.18 27)"
  ink-dark: "oklch(0.94 0.006 60)"
  muted-dark: "oklch(0.68 0.012 50)"
  bg-dark: "oklch(0.18 0.006 50)"
  surface-dark: "oklch(0.22 0.008 50)"
  border-dark: "oklch(0.30 0.008 50)"
  terracotta-dark: "oklch(0.72 0.13 45)"
typography:
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.005em"
  data:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, monospace"
    fontSize: "0.9375rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.terracotta-strong}"
    textColor: "{colors.bg}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.terracotta-hover}"
    textColor: "{colors.bg}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  card-artisan:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px 14px"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  badge-called:
    backgroundColor: "{colors.success-wash}"
    textColor: "{colors.success-ink}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: Artisa

## 1. Overview

**Creative North Star: "L'établi de l'artisan"**

Artisa est un établi : un plan de travail net et blanc sur lequel un outil de démarchage pose, un par un, des prospects prêts à appeler. La terracotta — la couleur de la tuile, de la brique, de la terre cuite du bâti français — signe la marque sans jamais tomber dans le folklore : c'est le métier qui affleure, pas un décor régional. Tout le reste est silence : blanc pur, encre chaude, une seule couleur de signal. On vient chercher un numéro et on repart.

Le système sert la tâche, il ne se montre pas. Densité maîtrisée plutôt que remplissage ; chaque élément porte une information ou une action, jamais de la décoration. Les **données actionnables** (numéros de téléphone, codes postaux, codes INSEE, population) sont en **Geist Mono** à chiffres tabulaires — elles se lisent comme les chiffres d'un instrument de mesure, alignées, sans ambiguïté, prêtes à être composées sur un clavier de téléphone.

Ce système rejette explicitement l'esthétique de l'**annuaire type Pages Jaunes** : pas de jaune criard, pas d'encarts, pas de listes bruyantes, pas de hiérarchie confuse. Les prospects sont des fiches propres et calmes, pas un bottin publicitaire.

**Key Characteristics:**
- Blanc pur comme plan de travail ; la couleur vit dans la marque, pas dans le fond.
- Terracotta = signature « métier », employée avec parcimonie (≤ 10 % de l'écran).
- Geist Mono pour toute donnée qu'on lit pour agir (téléphone, codes, population).
- Plat par défaut ; l'ombre est réservée à ce qui flotte (panneau, modales).
- Restreint : une couleur de marque, un bleu de signal, un vert d'état. Jamais plus.

## 2. Colors

Une palette restreinte : neutres chauds, une seule couleur de marque (terracotta), un bleu de signal pour l'info, un vert discret pour l'état « fait ». Le fond ne porte jamais la chaleur — c'est la terracotta qui la porte.

### Primary
- **Terracotta** (`oklch(0.55 0.14 40)`) : la couleur de marque. Icônes, bordures actives, point de commune sélectionné, petits accents. La signature « terre cuite / métier ».
- **Terracotta forte** (`oklch(0.48 0.15 40)`) : le fond des boutons primaires. Descendue à L 0.48 exprès pour tenir le **texte blanc à ≥ 4.5:1** (le fill à L 0.55 ne passait pas en petit texte).
- **Terracotta survol** (`oklch(0.42 0.15 38)`) : état hover/active du bouton primaire.
- **Terracotta lavée** (`oklch(0.95 0.03 45)`) : fond très pâle pour zones sélectionnées, surbrillance douce, puce de marque.

### Secondary
- **Bleu ardoise** (`oklch(0.47 0.13 255)`) : la couleur de signal. Liens, info, actions secondaires (« Voir la fiche Google »). Lisible sur blanc (~5:1). Assez distincte de la terracotta (hue 255 vs 40) pour ne jamais se confondre avec la marque.
- **Bleu ardoise clair** (`oklch(0.70 0.11 250)`) : la version dark-mode des liens.

### Tertiary
- **Vert d'état** — fond `oklch(0.94 0.03 155)`, encre `oklch(0.40 0.10 155)` : uniquement la puce « Déjà appelé ». Un vert calme, jamais éclatant. Employé en pastille pâle + texte vert foncé, jamais en texte vert sur blanc (contraste insuffisant).
- **Rouge d'erreur** (`oklch(0.53 0.18 27)`) : messages d'erreur uniquement. Rare.

### Neutral
- **Encre** (`oklch(0.24 0.02 40)`) : texte principal. Très légèrement chaude (hue 40) pour s'accorder à la marque. ~13:1 sur blanc.
- **Muted** (`oklch(0.50 0.015 40)`) : texte secondaire (code postal, population, libellés). ~4.6:1 sur blanc — **remplace le `text-black/50` actuel qui était limite en lisibilité.**
- **Fond** (`oklch(1 0 0)`) : blanc pur. Pas 0.99, pas de chroma caché. Le plan de travail.
- **Surface** (`oklch(0.975 0.006 60)`) : blanc à peine tiédi vers la marque, pour cartes/panneaux/champs qui doivent se détacher du fond.
- **Bordure** (`oklch(0.92 0.008 50)`) : filets, séparateurs, contours de carte. 1px, jamais plus.

### Dark mode
- **Fond** `oklch(0.18 0.006 50)` · **Surface** `oklch(0.22 0.008 50)` · **Bordure** `oklch(0.30 0.008 50)` — noir chaud très légèrement tuilé, jamais pur, pour le confort d'une session prolongée le soir.
- **Encre** `oklch(0.94 0.006 60)` · **Muted** `oklch(0.68 0.012 50)`.
- **Terracotta dark** `oklch(0.72 0.13 45)` : en dark mode, le bouton primaire s'éclaircit et prend un **texte encre foncé** (le fill sombre + texte blanc ne passe pas le contraste). Pattern dark-mode classique : accent clair, texte sombre.

### Named Rules
**La règle « Une seule voix ».** La terracotta occupe ≤ 10 % de n'importe quel écran. Sa rareté est ce qui la rend crédible ; noyée, elle devient décoration.

**La règle « La carte porte la couleur ».** Le fond de l'app est blanc pur. La densité chromatique vient de la carte MapLibre et des points de commune, pas de l'UI autour.

## 3. Typography

**Display / UI Font:** Geist (avec `ui-sans-serif, system-ui, sans-serif`)
**Data Font:** Geist Mono (avec `ui-monospace, SFMono-Regular, monospace`)

**Character:** Une seule famille sans-serif moderne et neutre en plusieurs graisses pour toute l'interface, doublée de sa variante monospace pour les données. Pas de second sans-serif « pour faire joli » : le contraste typographique vient de l'axe sans / mono, pas de deux grotesques presque identiques. Geist Mono en **chiffres tabulaires** (`font-variant-numeric: tabular-nums`) aligne verticalement les numéros de téléphone et les nombres.

### Hierarchy
- **Headline** (600, 1.25rem / 20px, LH 1.2, LS -0.01em) : nom de commune en tête de panneau, titres de modale.
- **Title** (600, 1rem / 16px, LH 1.3) : libellés de section, en-têtes de bloc.
- **Body** (400, 0.9375rem / 15px, LH 1.55) : texte courant, descriptions. Longueur de ligne plafonnée à ~65ch dans les blocs de prose.
- **Label** (500, 0.75rem / 12px, LS 0.005em) : méta discrète (code postal, « hab. », statut). **Pas** en majuscules tracées façon eyebrow.
- **Data** (Geist Mono, 500, 0.9375rem / 15px, tabular-nums) : numéros de téléphone, code postal, code INSEE, population. Tout ce qu'on lit pour agir.

### Named Rules
**La règle « Mono = actionnable ».** Si un nombre sert à agir (composer, identifier, comparer), il est en Geist Mono tabulaire. Si c'est de la prose, c'est en Geist sans. On ne mélange jamais les deux dans un même rôle.

**La règle « Pas d'eyebrow ».** Aucune micro-étiquette en majuscules tracées au-dessus des sections. C'est un outil, pas une landing ; les libellés sont en casse normale, sobres.

## 4. Elevation

Système **plat par défaut**. La profondeur se lit d'abord par la **bordure 1px** et la **surface** légèrement tiédie, pas par l'ombre. Les cartes d'artisan, les champs et les sections reposent à plat sur le blanc, séparés par des filets.

L'ombre est réservée à ce qui **flotte réellement au-dessus de la carte** : le `ArtisanPanel`, les modales (login, bienvenue, aide clé API), les dropdowns. Là, l'ombre est une vraie information de profondeur (« ceci est au premier plan »), pas une décoration.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 8px 32px -8px oklch(0.24 0.02 40 / 0.18), 0 2px 8px -2px oklch(0.24 0.02 40 / 0.12)`) : panneau latéral, modales. Ombre douce et large, teintée encre (jamais noir pur).
- **Popover** (`box-shadow: 0 4px 16px -4px oklch(0.24 0.02 40 / 0.16)`) : dropdowns, menus (menu « Mes artisans », menu compte).

### Named Rules
**La règle « Plat au repos ».** Les surfaces sont plates tant qu'elles ne flottent pas. Une carte d'artisan n'a pas d'ombre : elle a une bordure. L'ombre signale exclusivement le survol de la carte MapLibre par une couche d'UI.

## 5. Components

### Buttons
- **Shape:** coins doux 8px (`rounded.md`). Jamais d'arrondi complet sur un bouton texte (réservé aux pastilles).
- **Primary:** fond `terracotta-strong` (`oklch(0.48 0.15 40)`), texte blanc, padding 10px 16px, poids 500. Réservé à **l'action principale d'un écran** (S'inscrire, Se connecter, l'action d'engagement). Un seul primaire visible à la fois.
- **Hover / Focus:** fond → `terracotta-hover` ; anneau de focus `outline: 2px solid oklch(0.47 0.13 255); outline-offset: 2px` (bleu ardoise, jamais supprimé). Transition `background 150ms ease-out`.
- **Secondary:** fond `surface`, texte `ink`, bordure 1px `border`. Actions non-primaires (Fermer, Annuler).
- **Ghost:** transparent, texte `ink`, `hover:bg oklch(0.24 0.02 40 / 0.05)`. Boutons d'icône, « Fermer » du panneau, actions discrètes.
- **Dark mode:** le primaire passe en `terracotta-dark` (`oklch(0.72 0.13 45)`) **avec texte encre foncé**.

### Cards / Containers (fiche artisan — composant signature)
- **Corner Style:** 12px (`rounded.lg`).
- **Background:** `bg` (blanc) en clair, `surface-dark` en sombre.
- **Border:** 1px `border`. **Pas d'ombre** (voir Elevation).
- **Internal Padding:** 12–14px.
- **Contenu:** nom d'artisan en **Title** ; téléphone et « Voir la fiche Google » en dessous, le téléphone en **Data (mono)** cliquable (`tel:`), le lien Google en **bleu ardoise** ; la case « Déjà appelé » en bas.
- **État « appelé »:** quand coché, la carte se teinte de `success-wash` très léger et la pastille **badge-called** apparaît. Le prospect traité recule visuellement sans disparaître.

### Inputs / Fields (formulaires auth + clé Google)
- **Style:** fond `bg`, bordure 1px `border`, coins 8px, padding 10px 12px, texte `ink`, placeholder en `muted` (≥ 4.5:1, jamais un gris pâle décoratif).
- **Focus:** bordure → `slate-blue` + anneau `0 0 0 3px oklch(0.47 0.13 255 / 0.15)`. Jamais de `outline: none` nu.
- **Error:** bordure `danger` + message court en `danger` sous le champ.
- **Label:** en **Label**, au-dessus du champ, `muted` ; la clé Google porte un lien d'aide discret vers `ApiKeyHelpModal`.

### Navigation (AuthHeader)
- **Style:** barre haute, fond `bg`, filet bas 1px `border`. Logotype/nom à gauche en **Title**, actions compte à droite.
- **États:** liens en `ink`, hover `hover:bg oklch(0.24 0.02 40 / 0.05)` arrondi 8px ; menus déroulants en ombre **Popover**.

### Panel (ArtisanPanel — composant signature)
- Panneau latéral droit, largeur max `28rem` (`max-w-md`), pleine hauteur, fond `bg`, filet gauche 1px, ombre **Overlay**.
- En-tête sticky : nom de commune (**Headline**) + méta code postal / population en **Data mono** `muted`, bouton **Fermer** en ghost.
- Corps : liste de fiches artisan espacées de 12px.
- **États de chargement / vide / erreur soignés** (voir Do's) : jamais une simple ligne grise.

## 6. Do's and Don'ts

### Do:
- **Do** garder le fond en blanc pur `oklch(1 0 0)` ; laisser la terracotta et la carte porter la couleur.
- **Do** mettre en **Geist Mono tabulaire** tout nombre actionnable : téléphone, code postal, code INSEE, population.
- **Do** limiter la terracotta à ≤ 10 % de l'écran (règle « Une seule voix »).
- **Do** utiliser `muted` (`oklch(0.50 0.015 40)`, ~4.6:1) pour le texte secondaire — **remplacer les `text-black/50`, `text-black/60`, `text-white/50` actuels** qui frôlent l'illisible.
- **Do** réserver l'ombre aux couches flottantes (panneau, modales, popovers) ; tout le reste est plat + bordure 1px.
- **Do** soigner les états du panneau : « Recherche en cours… » avec un skeleton ou un spinner terracotta, l'état vide avec une phrase utile + une action, l'erreur avec un bouton « Réessayer ».
- **Do** garder un anneau de focus visible (bleu ardoise) sur tout élément interactif.

### Don't:
- **Don't** ressembler à un **annuaire type Pages Jaunes** : pas de jaune, pas d'encarts publicitaires, pas de listes denses et bruyantes, pas de hiérarchie confuse. C'est l'anti-référence n°1.
- **Don't** teinter le fond en crème/sable « pour faire chaud » : la chaleur passe par la terracotta, pas par le bg (le réflexe IA à éviter).
- **Don't** ajouter une seconde police sans-serif ni un dégradé de texte (`background-clip: text`).
- **Don't** poser une bordure colorée `border-left` > 1px comme accent sur les cartes ou alertes.
- **Don't** empiler des cartes dans des cartes ; la fiche artisan ne contient pas de sous-carte.
- **Don't** mettre une micro-étiquette en majuscules tracées (eyebrow) au-dessus des sections.
- **Don't** utiliser du texte gris sur fond coloré (terracotta, bleu) : texte **blanc** sur les fills saturés, toujours.
- **Don't** laisser un `outline: none` sans remplacement sur un champ ou un bouton.

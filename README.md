# Analyseur de Sentiment Contextuel

Un outil avancé d'analyse de sentiment en français qui prend en compte le contexte, la structure et l'évolution du sentiment dans un texte.

## 📋 Sommaire

- [Présentation](#présentation)
- [Fonctionnalités](#fonctionnalités)
- [Architecture](#architecture)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Structure du Dictionnaire](#structure-du-dictionnaire)
- [Classes et Méthodes](#classes-et-méthodes)
- [Interface Web](#interface-web)
- [Exemples](#exemples)
- [Extension et Personnalisation](#extension-et-personnalisation)
- [Résolution de Problèmes](#résolution-de-problèmes)
- [Licence](#licence)

## 🔍 Présentation

L'Analyseur de Sentiment Contextuel est un outil conçu pour évaluer le sentiment exprimé dans un texte en français, en allant au-delà d'une simple analyse par mots-clés. Il prend en compte le contexte des mots, la structure du texte, les transitions, et l'évolution du sentiment du début à la fin.

## ✨ Fonctionnalités

- **Analyse basique** : Détection des mots positifs, négatifs et neutres
- **Analyse contextuelle** : Évaluation du contexte autour de chaque mot
- **Gestion des modificateurs** : Prise en compte des intensificateurs et négations
- **Reconnaissance des émojis** : Analyse des émojis et leur impact sur le sentiment
- **Analyse structurelle** : Division du texte en segments (début, milieu, fin)
- **Détection des transitions** : Repérage de mots comme "mais", "cependant" et analyse de l'impact
- **Analyse de la progression** : Évaluation de l'évolution du sentiment au fil du texte
- **Identification des modèles narratifs** : Détection des schémas comme la "rédemption" ou la "chute"
- **Interface web intuitive** : Visualisation des résultats et des détails de l'analyse
- **API accessible** : Intégration facile dans d'autres applications

## 🏗️ Architecture

Le projet est organisé selon une architecture modulaire avec trois composants principaux :

1. **SentimentAnalyzer** : Analyse basique au niveau des mots et expressions
2. **ContextualAnalyzer** : Analyse avancée prenant en compte la structure et le contexte
3. **SentimentEvaluator** : Évaluation et comparaison des performances des analyseurs

Toutes les configurations sont externalisées dans un dictionnaire JSON pour faciliter les ajustements et extensions.

## 🚀 Installation

### Prérequis

- Node.js (v14 ou supérieur)
- npm ou yarn

### Étapes d'installation

1. Clonez le dépôt :
   ```bash
   git clone https://github.com/votre-nom/analyseur-sentiment-contextuel.git
   cd analyseur-sentiment-contextuel
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Assurez-vous que le dictionnaire est présent :
   ```
   /data/sentiment-dictionary.json
   ```

4. Lancez le serveur :
   ```bash
   npm start
   ```

L'application sera accessible à l'adresse http://localhost:3000

## 💻 Utilisation

### Via l'interface web

1. Accédez à l'URL du serveur dans votre navigateur
2. Saisissez ou collez le texte à analyser dans le champ
3. Cliquez sur "Analyser le sentiment"
4. Consultez les résultats et les détails de l'analyse

### Via l'API

```javascript
const { analyzer, contextualAnalyzer } = require('./src/analyzer');

// Analyse basique
const resultBasic = analyzer.analyze("Ce produit est vraiment excellent, je le recommande !");
console.log(resultBasic.score, resultBasic.sentiment);

// Analyse contextuelle
const resultContextual = contextualAnalyzer.analyze("J'étais déçu au début, mais finalement le produit s'est révélé excellent.");
console.log(resultContextual.contextualScore, resultContextual.contextualSentiment, resultContextual.trends);
```

## 📝 Structure du Dictionnaire

Le dictionnaire de sentiment (`sentiment-dictionary.json`) est le cœur du système. Sa structure est la suivante :

```json
{
  "positiveWords": {
    "excellent": 0.9,
    "bon": 0.7,
    // autres mots positifs avec leur score (0.5 à 1.0)
  },
  "neutralWords": {
    "produit": 0.5,
    // autres mots neutres avec leur score (généralement 0.5)
  },
  "negativeWords": {
    "mauvais": 0.3,
    "terrible": 0.1,
    // autres mots négatifs avec leur score (0.0 à 0.5)
  },
  "compounds": {
    "modifierPrefixes": {
      "très": 1.8,
      "peu": 0.5,
      "pas": -1.0,
      // autres modificateurs avec leur facteur
    },
    "idioms": {
      "pas mal": 0.6,
      // expressions idiomatiques avec leur score
    },
    "negationWords": [
      "ne", "pas", "sans", "jamais",
      // autres mots de négation
    ]
  },
  "emojiSentiments": {
    "😊": 0.9,
    "👍": 0.8,
    "😢": 0.2,
    // autres émojis avec leur score
  },
  "config": {
    "negationWindow": 5,
    "contextWindow": 3,
    "segmentCount": 3,
    "minSegmentSize": 3,
    "positionWeights": {
      "beginning": 0.7,
      "middle": 1.0,
      "end": 1.5
    },
    "transitionMarkers": [
      { "word": "mais", "weight": 0.7 },
      { "word": "cependant", "weight": 0.7 },
      // autres marqueurs de transition
    ],
    "narrativePatterns": {
      "redemption": 0.2,
      "downfall": -0.15,
      "consistency": 0.05,
      "mixed": -0.05
    },
    "analysisWeights": {
      "progression": 0.25,
      "conclusion": 0.25,
      "intensity": 0.15,
      "transitions": 0.20,
      "baseline": 0.15
    }
  }
}
```

## 🧩 Classes et Méthodes

### SentimentAnalyzer

- **constructor(dictionary)** : Initialise l'analyseur avec un dictionnaire
- **analyze(text)** : Analyse le sentiment de base d'un texte
- **_getContextWords(words, position, windowSize)** : Récupère les mots contextuels autour d'un mot
- **_analyzeWordContext(contextWords, centralWord, centralScore)** : Analyse l'impact du contexte
- **_getSentimentFromScore(score)** : Convertit un score numérique en description textuelle

### ContextualAnalyzer

- **constructor(baseAnalyzer, dictionary)** : Initialise l'analyseur contextuel
- **analyze(text)** : Analyse contextuelle complète d'un texte
- **_splitIntoSentences(text)** : Divise le texte en phrases
- **_segmentText(sentences)** : Divise le texte en segments (début, milieu, fin)
- **_analyzeSegments(segments)** : Analyse chaque segment individuellement
- **_analyzeProgression(segmentAnalysis)** : Évalue l'évolution du sentiment
- **_analyzeConclusion(segments)** : Évalue l'impact de la conclusion
- **_analyzeIntensity(baseResult)** : Analyse la variance et l'intensité des sentiments
- **_analyzeTransitions(text, baseResult)** : Détecte et analyse les transitions
- **_identifyNarrativePattern(progressionFactor)** : Identifie le modèle narratif
- **_calculateContextualScore(...)** : Calcule le score contextuel final
- **_analyzeTrends(segmentAnalysis, progressionFactor)** : Analyse les tendances d'évolution

### SentimentEvaluator

- **constructor(analyzer, contextualAnalyzer)** : Initialise l'évaluateur
- **evaluate(testCases)** : Évalue les performances sur un ensemble de tests
- **compareAnalyzers(text)** : Compare les analyses basique et contextuelle

## 🌐 Interface Web

L'interface web offre une visualisation claire des résultats d'analyse :

- Score global et classification du sentiment
- Barre de visualisation colorée du score
- Niveau de confiance de l'analyse
- Liste des mots identifiés avec leur score
- Expressions idiomatiques détectées
- Modificateurs et leur impact
- Détails sur les tendances et l'évolution du sentiment

## 📋 Exemples

### Exemple 1 : Sentiment positif simple

```javascript
const text = "Ce produit est vraiment excellent, je le recommande !";
const result = contextualAnalyzer.analyze(text);
// result.contextualScore ≈ 0.85
// result.contextualSentiment = "très positif"
```

### Exemple 2 : Évolution du sentiment (rédemption)

```javascript
const text = "J'étais très déçu au début, mais après plusieurs utilisations, j'ai finalement été impressionné par les performances du produit.";
const result = contextualAnalyzer.analyze(text);
// result.contextualScore ≈ 0.65
// result.contextualSentiment = "plutôt positif"
// result.trends.trend = "nette amélioration"
// result.contextFactors.narrative.pattern = "redemption"
```

### Exemple 3 : Négation et nuances

```javascript
const text = "Ce n'est pas un mauvais produit, mais ce n'est pas non plus extraordinaire.";
const result = contextualAnalyzer.analyze(text);
// result.contextualScore ≈ 0.53
// result.contextualSentiment = "légèrement positif"
```

## 🔧 Extension et Personnalisation

### Ajout de mots au dictionnaire

Éditez le fichier `data/sentiment-dictionary.json` pour ajouter de nouveaux mots :

```json
"positiveWords": {
  "excellent": 0.9,
  "magnifique": 0.85,
  "votre-nouveau-mot": 0.75
}
```

### Ajustement des paramètres d'analyse

Modifiez la section `config` du dictionnaire :

```json
"config": {
  "negationWindow": 4,  // Réduire la portée des négations
  "contextWindow": 5,   // Augmenter la fenêtre de contexte
  // autres paramètres...
}
```

### Ajout de nouvelles fonctionnalités

Pour ajouter de nouvelles fonctionnalités, étendez les classes existantes :

```javascript
class EnhancedContextualAnalyzer extends ContextualAnalyzer {
  constructor(baseAnalyzer, dictionary) {
    super(baseAnalyzer, dictionary);
    // Nouvelles propriétés
  }
  
  // Nouvelles méthodes
  analyzeTopics(text) {
    // Implémentation...
  }
}
```

## 🔍 Résolution de Problèmes

### Le dictionnaire ne se charge pas

Vérifiez :
- Le chemin du dictionnaire (`dictionaryPath`)
- La syntaxe JSON (validez avec un outil en ligne)
- Les permissions de lecture du fichier

### Erreurs dans l'analyse des modificateurs

Si des modificateurs comme "pas" ou "très" ne fonctionnent pas correctement :
- Vérifiez leur définition dans `modifierPrefixes`
- Assurez-vous que les mots cibles sont dans le dictionnaire
- Inspectez les détails retournés par l'analyse

### Score de sentiment incorrect

Si l'analyse produit un score qui ne correspond pas à vos attentes :
- Examinez les mots identifiés et leurs scores individuels
- Vérifiez si des mots importants manquent dans le dictionnaire
- Ajustez les poids et paramètres dans la configuration

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.

---

Développé avec ❤️ pour comprendre les nuances du langage humain.

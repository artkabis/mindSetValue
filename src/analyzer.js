// src/analyzer.js
const fs = require("fs");
const path = require("path");

// Définir le chemin du dictionnaire
const dictionaryPath = path.join(
  __dirname,
  "../data/sentiment-dictionary.json"
);

/**
 * Analyseur de sentiment de base
 * Évalue les mots, expressions et modificateurs dans un texte
 */
class SentimentAnalyzer {
  constructor(dictionary) {
    // Listes de mots
    this.positiveWords = dictionary.positiveWords || {};
    this.neutralWords = dictionary.neutralWords || {};
    this.negativeWords = dictionary.negativeWords || {};

    // Composés
    this.modifierPrefixes = dictionary.compounds?.modifierPrefixes || {};
    this.idioms = dictionary.compounds?.idioms || {};
    this.idiomPatterns = dictionary.compounds?.idiomPatterns || {}; // Nouveau: patterns d'idiomes
    this.negationWords = dictionary.compounds?.negationWords || [];

    // Émojis
    this.emojiSentiments = dictionary.emojiSentiments || {};

    // Configuration
    const config = dictionary.config || {};
    this.config = {
      negationWindow: config.negationWindow || 5,
      contextWindow: config.contextWindow || 3,
      idiomDetectionRadius: config.idiomDetectionRadius || 5, // Nouveau: rayon de détection pour idiomes
    };
  }

  analyze(text) {
    if (!text || typeof text !== "string") {
      return {
        score: 0.5,
        sentiment: "neutre",
        confidence: 0,
        details: { words: [], modifiers: [], idioms: [], emojis: [] },
      };
    }

    // Extraction des émojis avant normalisation
    const emojiPattern = /[\p{Emoji}]/gu;
    const emojis = text.match(emojiPattern) || [];

    // Normalisation du texte
    const normalizedText = text
      .toLowerCase()
      .replace(/[.,!?;:(){}\[\]\/\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const details = {
      words: [],
      modifiers: [],
      idioms: [],
      emojis: [],
    };

    let totalScore = 0;
    let wordCount = 0;
    let confidence = 0;

    // Analyse des expressions idiomatiques avec méthode avancée si disponible
    let detectedIdioms = [];
    if (this.idiomPatterns && Object.keys(this.idiomPatterns).length > 0) {
      // Utiliser la nouvelle méthode de détection avancée
      detectedIdioms = this._detectIdioms(normalizedText);
    } else {
      // Utiliser la méthode simple originale
      for (const [idiom, score] of Object.entries(this.idioms)) {
        if (normalizedText.includes(idiom)) {
          detectedIdioms.push({ phrase: idiom, score });
        }
      }
    }

    // Traiter les idiomes détectés
    for (const idiom of detectedIdioms) {
      details.idioms.push(idiom);
      totalScore += idiom.score;
      wordCount += 1;
      confidence += 0.8;
    }

    // Analyse des émojis
    for (const emoji of emojis) {
      if (this.emojiSentiments[emoji] !== undefined) {
        const score = this.emojiSentiments[emoji];
        details.emojis.push({ emoji, score });
        totalScore += score;
        wordCount += 1;
        confidence += 0.7;
      }
    }

    // Diviser le texte en mots
    const words = normalizedText.split(" ");

    // Suivre l'état de négation
    let negationActive = false;
    let negationDistance = 0;

    // Parcourir les mots et calculer le score
    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Vérifier si c'est un mot de négation
      if (this.negationWords.includes(word)) {
        negationActive = true;
        negationDistance = 0;
        details.modifiers.push({
          phrase: word,
          type: "negation",
          scope: "starts",
        });
        continue;
      }

      // Incrémenter la distance depuis la négation
      if (negationActive) {
        negationDistance++;
        if (negationDistance > this.config.negationWindow) {
          negationActive = false;
          details.modifiers.push({
            phrase: words[i - this.config.negationWindow],
            type: "negation",
            scope: "ends",
          });
        }
      }

      // Récupération du score du mot
      let wordScore = null;
      if (this.positiveWords[word] !== undefined) {
        wordScore = this.positiveWords[word];
      } else if (this.negativeWords[word] !== undefined) {
        wordScore = this.negativeWords[word];
      } else if (this.neutralWords[word] !== undefined) {
        wordScore = this.neutralWords[word];
      }

      if (wordScore !== null) {
        let score = wordScore;
        let modifier = 1;

        // Vérification des modificateurs précédents
        if (i > 0) {
          const previousWord = words[i - 1];

          // Modificateurs d'un seul mot
          if (this.modifierPrefixes[previousWord] !== undefined) {
            modifier = this.modifierPrefixes[previousWord];
            details.modifiers.push({
              phrase: previousWord,
              target: word,
              modification: modifier,
            });
          }

          // Modificateurs de deux mots
          if (i > 1) {
            const twoWordModifier = `${words[i - 2]} ${previousWord}`;
            if (this.modifierPrefixes[twoWordModifier] !== undefined) {
              modifier = this.modifierPrefixes[twoWordModifier];
              details.modifiers.push({
                phrase: twoWordModifier,
                target: word,
                modification: modifier,
              });
            }
          }
        }

        // Application du modificateur de négation
        if (negationActive) {
          // Inversion plus nuancée du sentiment en fonction de la distance
          const negationPower =
            1 - negationDistance / this.config.negationWindow;
          score = 0.5 + (0.5 - score) * negationPower;
        }

        // Application du modificateur
        if (modifier < 0) {
          // Inversion du sentiment
          score = 1 - score;
          if (score === 0.5) score = 0.4;
        } else if (modifier !== 1) {
          // Intensification
          if (score > 0.5) {
            score = Math.min(1, 0.5 + (score - 0.5) * modifier);
          } else if (score < 0.5) {
            score = Math.max(0, 0.5 - (0.5 - score) * modifier);
          }
        }

        // Analyse du contexte autour du mot
        const contextWords = this._getContextWords(
          words,
          i,
          this.config.contextWindow
        );
        const contextScore = this._analyzeWordContext(
          contextWords,
          word,
          score
        );

        details.words.push({
          word,
          originalScore: wordScore,
          modifiedScore: score,
          contextScore: contextScore,
          negated: negationActive,
        });

        totalScore += contextScore;
        wordCount += 1;
        confidence += 0.5;
      }
    }

    // Calcul du score final
    let finalScore = 0.5; // Par défaut neutre
    if (wordCount > 0) {
      finalScore = totalScore / wordCount;
      confidence = Math.min(1, confidence / (wordCount * 0.8));
    } else {
      confidence = 0;
    }

    // Détermination du sentiment
    let sentiment = this._getSentimentFromScore(finalScore);

    return {
      score: parseFloat(finalScore.toFixed(2)),
      sentiment,
      confidence: parseFloat(confidence.toFixed(2)),
      details,
    };
  }

  /**
   * Détecte les expressions idiomatiques dans un texte en tenant compte des conjugaisons
   * et des différentes formes possibles
   * @private
   */
  _detectIdioms(text) {
    const words = text.split(" ");
    const detectedIdioms = [];
    const radius = this.config.idiomDetectionRadius;
    
    // Créer un dictionnaire des formes d'idiomes possibles
    const idiomKeywords = {};
    
    // Parcourir tous les idiomes pour extraire des mots-clés significatifs
    for (const [idiom, score] of Object.entries(this.idioms)) {
      // Extraire les mots de l'idiome
      const idiomWords = idiom.split(" ");
      
      // Pour les idiomes qui commencent par un verbe courant (être, avoir),
      // considérer les mots suivants comme plus significatifs
      if (idiomWords.length >= 2 && 
          (idiomWords[0] === "être" || idiomWords[0] === "avoir" || 
           idiomWords[0] === "se" || idiomWords[0] === "faire")) {
        // Utiliser le reste de l'expression comme mot-clé
        const keyword = idiomWords.slice(1).join(" ");
        if (keyword.length > 2) { // Ignorer les mots-clés trop courts
          if (!idiomKeywords[keyword]) {
            idiomKeywords[keyword] = [];
          }
          idiomKeywords[keyword].push({ fullIdiom: idiom, score });
        }
      } else {
        // Sinon, utiliser l'idiome complet
        if (!idiomKeywords[idiom]) {
          idiomKeywords[idiom] = [];
        }
        idiomKeywords[idiom].push({ fullIdiom: idiom, score });
      }
    }
    
    // Parcourir le texte pour rechercher les idiomes potentiels
    for (let i = 0; i < words.length; i++) {
      // Vérifier si des mots-clés commencent à cette position
      for (const [keyword, idiomInfos] of Object.entries(idiomKeywords)) {
        const keywordWords = keyword.split(" ");
        
        // Vérifier si le mot-clé correspond à cette position dans le texte
        let matchesKeyword = true;
        for (let j = 0; j < keywordWords.length && i + j < words.length; j++) {
          if (words[i + j] !== keywordWords[j]) {
            matchesKeyword = false;
            break;
          }
        }
        
        if (matchesKeyword) {
          // Vérifier si un verbe d'idiome ou un pronom est présent avant
          // dans la fenêtre de détection
          for (const { fullIdiom, score } of idiomInfos) {
            const idiomParts = fullIdiom.split(" ");
            const firstWord = idiomParts[0];
            
            // Vérifier si c'est un idiome avec un verbe courant au début
            if (firstWord === "être" || firstWord === "avoir" || 
                firstWord === "se" || firstWord === "faire") {
              let verbFound = false;
              
              // Rechercher en arrière pour trouver un verbe ou pronom correspondant
              for (let k = Math.max(0, i - radius); k < i; k++) {
                const candidateWord = words[k];
                
                // Rechercher les formes conjuguées du verbe
                if (firstWord === "être" && this.idiomPatterns["être"]) {
                  if (this.idiomPatterns["être"].includes(candidateWord)) {
                    verbFound = true;
                    break;
                  }
                } 
                else if (firstWord === "avoir" && this.idiomPatterns["avoir"]) {
                  if (this.idiomPatterns["avoir"].includes(candidateWord)) {
                    verbFound = true;
                    break;
                  }
                }
                else if (firstWord === "se" && this.idiomPatterns["se faire"]) {
                  // Rechercher des formes comme "me fais", "se fait", etc.
                  if (this.idiomPatterns["se faire"].includes(candidateWord)) {
                    verbFound = true;
                    break;
                  }
                  
                  // Vérifier si un pronom réfléchi se trouve à proximité
                  if (this.idiomPatterns["pronouns"] && 
                      this.idiomPatterns["pronouns"].includes(candidateWord)) {
                    // Rechercher "faire" après le pronom
                    if (k + 1 < i && words[k + 1].startsWith("fai")) {
                      verbFound = true;
                      break;
                    }
                  }
                }
                else if (firstWord === "faire" && candidateWord.startsWith("fai")) {
                  verbFound = true;
                  break;
                }
                
                // Vérifier également si un pronom se trouve à proximité
                if (this.idiomPatterns["pronouns"] && 
                    this.idiomPatterns["pronouns"].includes(candidateWord)) {
                  // Si on trouve un pronom, le verbe est probablement juste après
                  if (k + 1 < i) {
                    const nextWord = words[k + 1];
                    if ((firstWord === "être" && nextWord.startsWith("s")) ||
                        (firstWord === "avoir" && nextWord.startsWith("a")) ||
                        (firstWord === "faire" && nextWord.startsWith("fai"))) {
                      verbFound = true;
                      break;
                    }
                  }
                }
              }
              
              // Si un verbe ou pronom approprié a été trouvé, enregistrer l'idiome
              if (verbFound) {
                detectedIdioms.push({
                  phrase: fullIdiom,
                  score: score,
                  position: { start: i, end: i + keywordWords.length - 1 }
                });
              }
            } else {
              // Pour les idiomes qui ne commencent pas par un verbe courant,
              // les enregistrer directement
              detectedIdioms.push({
                phrase: fullIdiom,
                score: score,
                position: { start: i, end: i + keywordWords.length - 1 }
              });
            }
          }
        }
      }
    }
    
    return detectedIdioms;
  }

  /**
   * Obtient les mots contextuels autour d'un mot spécifique
   * @private
   */
  _getContextWords(words, position, windowSize) {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(words.length, position + windowSize + 1);
    return words.slice(start, end).filter((_, i) => start + i !== position);
  }

  /**
   * Analyse l'impact du contexte sur le score d'un mot
   * @private
   */
  _analyzeWordContext(contextWords, centralWord, centralScore) {
    if (contextWords.length === 0) {
      return centralScore;
    }

    let contextualModifier = 0;
    let relevantContextCount = 0;

    for (const word of contextWords) {
      let wordScore = null;

      if (this.positiveWords[word] !== undefined) {
        wordScore = this.positiveWords[word];
      } else if (this.negativeWords[word] !== undefined) {
        wordScore = this.negativeWords[word];
      } else if (this.neutralWords[word] !== undefined) {
        wordScore = this.neutralWords[word];
      }

      if (wordScore !== null) {
        // Influence contextuelle (20% d'influence par mot de contexte)
        contextualModifier += (wordScore - 0.5) * 0.2;
        relevantContextCount++;
      }
    }

    if (relevantContextCount === 0) {
      return centralScore;
    }

    // Calculer le score influencé par le contexte
    let contextualScore = centralScore;

    if (contextualModifier > 0 && centralScore > 0.5) {
      // Renforcer le sentiment positif
      contextualScore = Math.min(1, centralScore + contextualModifier * 0.5);
    } else if (contextualModifier < 0 && centralScore < 0.5) {
      // Renforcer le sentiment négatif
      contextualScore = Math.max(0, centralScore + contextualModifier * 0.5);
    } else if (contextualModifier > 0 && centralScore < 0.5) {
      // Nuancer le sentiment négatif
      contextualScore = Math.min(0.5, centralScore + contextualModifier * 0.3);
    } else if (contextualModifier < 0 && centralScore > 0.5) {
      // Nuancer le sentiment positif
      contextualScore = Math.max(0.5, centralScore + contextualModifier * 0.3);
    }

    return contextualScore;
  }

  /**
   * Convertit un score numérique en sentiment textuel
   * @private
   */
  _getSentimentFromScore(score) {
    if (score >= 0.85) return "très positif";
    if (score >= 0.7) return "positif";
    if (score >= 0.6) return "plutôt positif";
    if (score >= 0.55) return "légèrement positif";
    if (score >= 0.45 && score < 0.55) return "neutre";
    if (score >= 0.4) return "légèrement négatif";
    if (score >= 0.3) return "plutôt négatif";
    if (score >= 0.15) return "négatif";
    return "très négatif";
  }
}

/**
 * Classe pour tester et évaluer les performances de l'analyseur
 */
class SentimentEvaluator {
  constructor(analyzer, contextualAnalyzer) {
    this.analyzer = analyzer;
    this.contextualAnalyzer = contextualAnalyzer;
  }

  /**
   * Évalue l'analyseur sur un ensemble de textes avec des sentiments attendus
   * @param {Array} testCases - Tableau d'objets {text, expectedSentiment}
   * @returns {Object} Résultats d'évaluation
   */
  evaluate(testCases) {
    const results = {
      total: testCases.length,
      correct: 0,
      contextualCorrect: 0,
      accuracy: 0,
      contextualAccuracy: 0,
      details: [],
    };

    for (const testCase of testCases) {
      const basicAnalysis = this.analyzer.analyze(testCase.text);
      const contextualAnalysis = this.contextualAnalyzer.analyze(testCase.text);

      const isBasicCorrect =
        basicAnalysis.sentiment === testCase.expectedSentiment;
      const isContextualCorrect =
        contextualAnalysis.contextualSentiment === testCase.expectedSentiment;

      if (isBasicCorrect) results.correct++;
      if (isContextualCorrect) results.contextualCorrect++;

      results.details.push({
        text: testCase.text,
        expected: testCase.expectedSentiment,
        basicResult: {
          sentiment: basicAnalysis.sentiment,
          score: basicAnalysis.score,
          correct: isBasicCorrect,
        },
        contextualResult: {
          sentiment: contextualAnalysis.contextualSentiment,
          score: contextualAnalysis.contextualScore,
          correct: isContextualCorrect,
        },
      });
    }

    results.accuracy = results.total > 0 ? results.correct / results.total : 0;
    results.contextualAccuracy =
      results.total > 0 ? results.contextualCorrect / results.total : 0;

    return results;
  }

  /**
   * Compare les deux analyseurs sur un texte donné
   * @param {string} text - Le texte à analyser
   * @returns {Object} Comparaison détaillée
   */
  compareAnalyzers(text) {
    const basicAnalysis = this.analyzer.analyze(text);
    const contextualAnalysis = this.contextualAnalyzer.analyze(text);

    // Différence entre les scores
    const scoreDifference =
      contextualAnalysis.contextualScore - basicAnalysis.score;

    // Description de la différence
    let differenceDescription = "";
    if (Math.abs(scoreDifference) < 0.05) {
      differenceDescription =
        "Les deux analyseurs produisent des résultats similaires pour ce texte.";
    } else if (scoreDifference > 0) {
      differenceDescription = `L'analyse contextuelle produit un score plus positif (+ ${(
        scoreDifference * 100
      ).toFixed(1)}%).`;
    } else {
      differenceDescription = `L'analyse contextuelle produit un score plus négatif (- ${(
        Math.abs(scoreDifference) * 100
      ).toFixed(1)}%).`;
    }

    // Facteurs qui ont eu le plus d'impact
    const impactFactors = [];
    if (contextualAnalysis.contextFactors) {
      const factors = contextualAnalysis.contextFactors;

      if (factors.progression && Math.abs(factors.progression.impact) > 0.05) {
        impactFactors.push({
          name: "Progression",
          impact: factors.progression.impact,
          description: `Évolution de ${(
            factors.progression.progression * 100
          ).toFixed(1)}% entre le début et la fin`,
        });
      }

      if (factors.conclusion && Math.abs(factors.conclusion.impact) > 0.05) {
        impactFactors.push({
          name: "Conclusion",
          impact: factors.conclusion.impact,
          description: `La conclusion a un impact de ${(
            factors.conclusion.impact * 100
          ).toFixed(1)}%`,
        });
      }

      if (factors.transitions && Math.abs(factors.transitions.impact) > 0.05) {
        impactFactors.push({
          name: "Transitions",
          impact: factors.transitions.impact,
          description: `Les transitions ont un impact de ${(
            factors.transitions.impact * 100
          ).toFixed(1)}%`,
        });
      }

      if (factors.narrative && Math.abs(factors.narrative.impact) > 0.05) {
        impactFactors.push({
          name: "Structure narrative",
          impact: factors.narrative.impact,
          description: factors.narrative.description,
        });
      }
    }

    // Trier par impact absolu décroissant
    impactFactors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    return {
      basicAnalysis,
      contextualAnalysis,
      comparison: {
        scoreDifference: parseFloat(scoreDifference.toFixed(2)),
        sentimentChange:
          basicAnalysis.sentiment !== contextualAnalysis.contextualSentiment,
        description: differenceDescription,
        impactFactors,
      },
    };
  }
}

/**
 * Analyseur contextuel avancé
 * Comprend la structure du texte, les transitions et l'évolution du sentiment
 */
class ContextualAnalyzer {
  constructor(baseAnalyzer, dictionary) {
    // L'analyseur de base qui fournit les scores par mot/expression
    this.baseAnalyzer = baseAnalyzer;

    // Utiliser un objet vide si dictionary n'est pas défini
    const dict = dictionary || {};

    // Récupérer la configuration du dictionnaire
    const config = dict.config || {};

    // Poids d'analyse
    this.weights = config.analysisWeights || {
      progression: 0.25,
      conclusion: 0.25,
      intensity: 0.15,
      transitions: 0.2,
      baseline: 0.15,
    };

    // Configuration des segments
    this.config = {
      segmentCount: config.segmentCount || 3,
      minSegmentSize: config.minSegmentSize || 3,
      positionWeights: config.positionWeights || {
        beginning: 0.7,
        middle: 1.0,
        end: 1.5,
      },
    };

    // Marqueurs de transition
    this.transitionMarkers = config.transitionMarkers || [
      { word: "mais", weight: 0.7 },
      { word: "cependant", weight: 0.7 },
      // Autres marqueurs par défaut si nécessaire
    ];

    // Modèles narratifs
    this.narrativePatterns = config.narrativePatterns || {
      redemption: 0.2,
      downfall: -0.15,
      consistency: 0.05,
      mixed: -0.05,
    };
  }

  /**
   * Analyse un texte avec prise en compte du contexte et de la progression
   */
  analyze(text) {
    // Obtenir l'analyse de base
    const baseResult = this.baseAnalyzer.analyze(text);

    // Préparer les résultats enrichis
    const enhancedResult = {
      ...baseResult,
      baseScore: baseResult.score,
      contextualScore: baseResult.score, // Initialisé avec le score de base
      contextFactors: {},
    };

    // Si le texte est vide ou trop court, retourner l'analyse de base
    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return enhancedResult;
    }

    // Diviser le texte en phrases et segments
    const sentences = this._splitIntoSentences(text);
    const segments = this._segmentText(sentences);

    // 1. Analyser les segments et leur progression
    const segmentAnalysis = this._analyzeSegments(segments);
    enhancedResult.contextFactors.segments = segmentAnalysis;

    // 2. Analyser la progression du sentiment
    const progressionFactor = this._analyzeProgression(segmentAnalysis);
    enhancedResult.contextFactors.progression = progressionFactor;

    // 3. Déterminer l'importance de la conclusion
    const conclusionFactor = this._analyzeConclusion(segments);
    enhancedResult.contextFactors.conclusion = conclusionFactor;

    // 4. Analyser l'intensité des sentiments
    const intensityFactor = this._analyzeIntensity(baseResult);
    enhancedResult.contextFactors.intensity = intensityFactor;

    // 5. Détecter les transitions importantes
    const transitionFactor = this._analyzeTransitions(text, baseResult);
    enhancedResult.contextFactors.transitions = transitionFactor;

    // 6. Identifier le modèle narratif global
    const narrativePattern = this._identifyNarrativePattern(progressionFactor);
    enhancedResult.contextFactors.narrative = narrativePattern;

    // Calculer le score contextuel final
    const contextualScore = this._calculateContextualScore(
      baseResult.score,
      progressionFactor,
      conclusionFactor,
      intensityFactor,
      transitionFactor,
      narrativePattern
    );

    // S'assurer que le score reste dans l'intervalle [0, 1]
    enhancedResult.contextualScore = Math.max(0, Math.min(1, contextualScore));

    // Déterminer le sentiment en fonction du score contextuel
    enhancedResult.contextualSentiment = this._getSentimentFromScore(
      enhancedResult.contextualScore
    );

    // Analyser les tendances et l'évolution du sentiment
    enhancedResult.trends = this._analyzeTrends(
      segmentAnalysis,
      progressionFactor
    );

    return enhancedResult;
  }

  /**
   * Divise un texte en phrases
   * @private
   */
  _splitIntoSentences(text) {
    // Regex améliorée pour la détection des phrases
    return text
      .split(/[.!?]+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length > 0);
  }

  /**
   * Segmente le texte en début, milieu et fin
   * @private
   */
  _segmentText(sentences) {
    if (sentences.length <= 1) {
      return [{ type: "singleSentence", content: sentences.join(" ") }];
    }

    const segments = [];

    // Début (environ 25% du texte)
    const beginningSize = Math.max(1, Math.floor(sentences.length * 0.25));
    segments.push({
      type: "beginning",
      content: sentences.slice(0, beginningSize).join(" "),
    });

    // Milieu (environ 50% du texte)
    const middleStart = beginningSize;
    const middleEnd =
      sentences.length - Math.max(1, Math.floor(sentences.length * 0.25));
    if (middleEnd > middleStart) {
      segments.push({
        type: "middle",
        content: sentences.slice(middleStart, middleEnd).join(" "),
      });
    }

    // Fin (environ 25% du texte)
    segments.push({
      type: "end",
      content: sentences.slice(middleEnd).join(" "),
    });

    return segments;
  }

  /**
   * Analyse chaque segment du texte
   * @private
   */
  _analyzeSegments(segments) {
    const segmentScores = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;

    for (const segment of segments) {
      // Analyser le segment
      const segmentAnalysis = this.baseAnalyzer.analyze(segment.content);

      // Déterminer le poids du segment en fonction de sa position
      const positionWeight = this.config.positionWeights[segment.type] || 1.0;

      // Calculer le poids effectif (selon la taille et l'importance)
      const words = segment.content.split(" ").filter((w) => w.length > 0);
      const sizeWeight = Math.min(1, words.length / this.config.minSegmentSize);
      const effectiveWeight = positionWeight * sizeWeight;

      // Stocker les informations du segment
      segmentScores.push({
        type: segment.type,
        content: segment.content,
        score: segmentAnalysis.score,
        confidence: segmentAnalysis.confidence,
        weight: effectiveWeight,
        wordCount: words.length,
      });

      // Calculer le score pondéré total
      totalWeightedScore += segmentAnalysis.score * effectiveWeight;
      totalWeight += effectiveWeight;
    }

    return {
      segments: segmentScores,
      weightedScore: totalWeight > 0 ? totalWeightedScore / totalWeight : 0.5,
      totalWeight,
    };
  }

  /**
   * Analyse la progression du sentiment entre les segments
   * @private
   */
  _analyzeProgression(segmentAnalysis) {
    const segments = segmentAnalysis.segments;

    // Si pas assez de segments pour mesurer une progression
    if (segments.length <= 1) {
      return {
        progression: 0,
        impact: 0,
      };
    }

    // Identifier les segments de début et de fin
    const beginningSegments = segments.filter((s) => s.type === "beginning");
    const endSegments = segments.filter((s) => s.type === "end");

    // S'il manque l'un des types de segment, utiliser le premier et le dernier
    const firstSegment =
      beginningSegments.length > 0 ? beginningSegments[0] : segments[0];
    const lastSegment =
      endSegments.length > 0 ? endSegments[0] : segments[segments.length - 1];

    // Calculer la progression
    const progression = lastSegment.score - firstSegment.score;

    // Déterminer l'impact de la progression sur le score final
    let impact = 0;

    // Une forte progression positive a un impact positif plus important
    if (progression > 0.3) {
      impact = progression * 0.5; // Bonus important pour une forte amélioration
    }
    // Une forte progression négative a un impact négatif
    else if (progression < -0.3) {
      impact = progression * 0.4; // Pénalité pour une forte détérioration
    }
    // Une progression modérée a un impact moins important
    else {
      impact = progression * 0.2;
    }

    return {
      startScore: firstSegment.score,
      endScore: lastSegment.score,
      progression: parseFloat(progression.toFixed(2)),
      impact: parseFloat(impact.toFixed(2)),
    };
  }
  /**
   * Évalue l'importance de la conclusion (dernier segment)
   * @private
   */
  _analyzeConclusion(segments) {
    // Identifier le segment de conclusion
    const conclusionSegments = segments.filter((s) => s.type === "end");

    // Si pas de segment de conclusion, retourner un impact neutre
    if (conclusionSegments.length === 0) {
      return { impact: 0 };
    }

    const conclusion = conclusionSegments[0];
    const conclusionAnalysis = this.baseAnalyzer.analyze(conclusion.content);

    // Calculer la moyenne des autres segments
    const otherSegments = segments.filter((s) => s.type !== "end");
    let otherSegmentsScore = 0.5;

    if (otherSegments.length > 0) {
      const totalScore = otherSegments.reduce((sum, segment) => {
        const analysis = this.baseAnalyzer.analyze(segment.content);
        return sum + analysis.score;
      }, 0);

      otherSegmentsScore = totalScore / otherSegments.length;
    }

    // Impact de la conclusion en fonction de sa différence avec le reste du texte
    const difference = conclusionAnalysis.score - otherSegmentsScore;

    // Plus l'écart est important, plus l'impact l'est aussi
    // Les conclusions positives ont plus d'impact que les négatives
    let impact = 0;

    if (difference > 0.3) {
      // Conclusion beaucoup plus positive
      impact = difference * 0.7;
    } else if (difference > 0.1) {
      // Conclusion modérément plus positive
      impact = difference * 0.5;
    } else if (difference < -0.3) {
      // Conclusion beaucoup plus négative
      impact = difference * 0.5;
    } else if (difference < -0.1) {
      // Conclusion modérément plus négative
      impact = difference * 0.3;
    } else {
      // Différence minime
      impact = difference * 0.1;
    }

    return {
      score: conclusionAnalysis.score,
      difference: parseFloat(difference.toFixed(2)),
      impact: parseFloat(impact.toFixed(2)),
    };
  }

  /**
   * Analyse l'intensité/la variance des sentiments exprimés
   * @private
   */
  _analyzeIntensity(baseResult) {
    // Collecter les scores de tous les mots trouvés
    const wordScores = baseResult.details.words.map(
      (word) => word.modifiedScore
    );

    if (wordScores.length < 2) {
      return { intensity: 0, impact: 0 };
    }

    // Calculer l'écart-type des scores pour mesurer la dispersion
    const mean =
      wordScores.reduce((sum, score) => sum + score, 0) / wordScores.length;
    const squaredDiffs = wordScores.map((score) => Math.pow(score - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, diff) => sum + diff, 0) / wordScores.length;
    const stdDev = Math.sqrt(variance);

    // Calculer également les valeurs extrêmes
    const minScore = Math.min(...wordScores);
    const maxScore = Math.max(...wordScores);
    const range = maxScore - minScore;

    // L'intensité est basée sur l'écart-type et l'étendue
    const intensity = (stdDev * 2 + range * 0.5) / 2.5;

    // Impact de l'intensité sur le score global
    // Une forte intensité amplifie légèrement le sentiment dominant
    let impact = 0;

    if (baseResult.score > 0.6) {
      // Sentiment globalement positif - l'intensité amplifie
      impact = intensity * 0.15;
    } else if (baseResult.score < 0.4) {
      // Sentiment globalement négatif - l'intensité amplifie
      impact = -intensity * 0.15;
    } else {
      // Sentiment neutre - l'intensité réduit légèrement
      impact = (0.5 - baseResult.score) * intensity * 0.1;
    }

    return {
      stdDev: parseFloat(stdDev.toFixed(2)),
      range: parseFloat(range.toFixed(2)),
      intensity: parseFloat(intensity.toFixed(2)),
      impact: parseFloat(impact.toFixed(2)),
    };
  }

  /**
   * Analyse les transitions importantes dans le texte
   * @private
   */
  _analyzeTransitions(text, baseResult) {
    const lowerText = text.toLowerCase();
    const detectedTransitions = [];

    // Rechercher les marqueurs de transition
    for (const marker of this.transitionMarkers) {
      const regex = new RegExp(`\\b${marker.word}\\b`, "g");
      const matches = lowerText.match(regex);

      if (matches && matches.length > 0) {
        detectedTransitions.push({
          marker: marker.word,
          weight: marker.weight,
          count: matches.length,
        });
      }
    }

    // Si aucune transition n'est trouvée, retourner un impact neutre
    if (detectedTransitions.length === 0) {
      return { found: false, impact: 0 };
    }

    // Trier les transitions par poids
    detectedTransitions.sort((a, b) => b.weight - a.weight);

    // Analyser l'impact de la transition la plus forte
    const strongestTransition = detectedTransitions[0];

    // Analyser le texte avant et après la transition
    const parts = lowerText.split(strongestTransition.marker);

    // S'assurer qu'il y a du contenu avant et après
    if (
      parts.length < 2 ||
      parts[0].trim().length === 0 ||
      parts[1].trim().length === 0
    ) {
      return {
        found: true,
        marker: strongestTransition.marker,
        impact: strongestTransition.weight * 0.05, // Impact minimal
      };
    }

    const beforeTransition = parts[0];
    // Joindre toutes les parties restantes (au cas où le marqueur apparaît plusieurs fois)
    const afterTransition = parts.slice(1).join(strongestTransition.marker);

    const beforeAnalysis = this.baseAnalyzer.analyze(beforeTransition);
    const afterAnalysis = this.baseAnalyzer.analyze(afterTransition);

    // Calculer l'impact en fonction du changement de sentiment
    const sentimentShift = afterAnalysis.score - beforeAnalysis.score;

    // L'impact est proportionnel au poids du marqueur et à l'ampleur du changement
    const rawImpact = sentimentShift * strongestTransition.weight;

    // Ajuster l'impact en fonction de la proportion de texte après la transition
    const afterRatio =
      afterTransition.length /
      (beforeTransition.length + afterTransition.length);
    const weightedImpact = rawImpact * Math.min(1, afterRatio * 2);

    return {
      found: true,
      marker: strongestTransition.marker,
      weight: strongestTransition.weight,
      beforeScore: beforeAnalysis.score,
      afterScore: afterAnalysis.score,
      shift: parseFloat(sentimentShift.toFixed(2)),
      impact: parseFloat(weightedImpact.toFixed(2)),
    };
  }

  /**
   * Identifie le modèle narratif du texte
   * @private
   */
  _identifyNarrativePattern(progressionFactor) {
    const progression = progressionFactor.progression;
    const progressionAbs = Math.abs(progression);
    let pattern = null;
    let impact = 0;

    // Rédemption : forte progression positive
    if (progression > 0.25) {
      pattern = "redemption";
      impact = this.narrativePatterns.redemption * (progressionAbs / 0.5);
    }
    // Chute : forte progression négative
    else if (progression < -0.25) {
      pattern = "downfall";
      impact = this.narrativePatterns.downfall * (progressionAbs / 0.5);
    }
    // Sentiment cohérent
    else if (progressionAbs < 0.1) {
      pattern = "consistency";
      impact = this.narrativePatterns.consistency;
    }
    // Sentiment mitigé
    else {
      pattern = "mixed";
      impact = this.narrativePatterns.mixed;
    }

    return {
      pattern,
      impact: parseFloat(impact.toFixed(2)),
      description: this._getPatternDescription(pattern),
    };
  }

  /**
   * Fournit une description textuelle du modèle narratif
   * @private
   */
  _getPatternDescription(pattern) {
    switch (pattern) {
      case "redemption":
        return "Évolution positive: le texte commence négativement et évolue vers une conclusion plus positive";
      case "downfall":
        return "Dégradation: le texte commence positivement et évolue vers une conclusion plus négative";
      case "consistency":
        return "Cohérence: le texte maintient un sentiment relativement constant";
      case "mixed":
        return "Sentiment mitigé: le texte présente des variations de sentiment sans tendance forte";
      default:
        return "Indéterminé";
    }
  }
  
  /**
   * Calcule le score contextuel final
   * @private
   */
  _calculateContextualScore(
    baseScore,
    progressionFactor,
    conclusionFactor,
    intensityFactor,
    transitionFactor,
    narrativePattern
  ) {
    // Extraire les impacts de chaque facteur
    const progressionImpact = progressionFactor.impact || 0;
    const conclusionImpact = conclusionFactor.impact || 0;
    const intensityImpact = intensityFactor.impact || 0;
    const transitionImpact = transitionFactor.impact || 0;
    const narrativeImpact = narrativePattern.impact || 0;

    // Appliquer les poids à chaque composante
    const weightedBaseScore = baseScore * this.weights.baseline;
    const weightedProgression = progressionImpact * this.weights.progression;
    const weightedConclusion = conclusionImpact * this.weights.conclusion;
    const weightedIntensity = intensityImpact * this.weights.intensity;
    const weightedTransition = transitionImpact * this.weights.transitions;

    // Calculer le score contextuel ajusté
    const contextualScore =
      baseScore +
      weightedProgression +
      weightedConclusion +
      weightedIntensity +
      weightedTransition +
      narrativeImpact;

    // S'assurer que le score reste dans l'intervalle [0, 1]
    return Math.max(0, Math.min(1, contextualScore));
  }

  /**
   * Convertit un score numérique en sentiment textuel
   * @private
   */
  _getSentimentFromScore(score) {
    if (score >= 0.85) return "très positif";
    if (score >= 0.7) return "positif";
    if (score >= 0.6) return "plutôt positif";
    if (score >= 0.55) return "légèrement positif";
    if (score >= 0.45 && score < 0.55) return "neutre";
    if (score >= 0.4) return "légèrement négatif";
    if (score >= 0.3) return "plutôt négatif";
    if (score >= 0.15) return "négatif";
    return "très négatif";
  }

  /**
   * Analyser les tendances et l'évolution du sentiment
   * @private
   */
  _analyzeTrends(segmentAnalysis, progressionFactor) {
    const segments = segmentAnalysis.segments;

    // Si pas assez de segments pour établir une tendance
    if (segments.length <= 1) {
      return {
        trend: "stable",
        evolution: 0,
        description: "Texte trop court pour déterminer une évolution",
      };
    }

    const evolution = progressionFactor.progression;

    // Déterminer la tendance textuelle
    let trend = "stable";
    if (evolution > 0.2) trend = "nette amélioration";
    else if (evolution > 0.1) trend = "amélioration";
    else if (evolution > 0.05) trend = "légère amélioration";
    else if (evolution < -0.2) trend = "nette dégradation";
    else if (evolution < -0.1) trend = "dégradation";
    else if (evolution < -0.05) trend = "légère dégradation";

    // Construire une description plus détaillée
    let description = "";

    if (Math.abs(evolution) < 0.05) {
      description = "Le sentiment reste stable tout au long du texte.";
    } else if (evolution > 0) {
      description = `Le texte évolue vers un sentiment plus positif (+ ${(
        evolution * 100
      ).toFixed(0)}%). `;

      if (progressionFactor.startScore < 0.4) {
        description += "Il commence négativement mais s'améliore par la suite.";
      } else if (progressionFactor.startScore < 0.55) {
        description += "Il démarre sur un ton neutre et évolue positivement.";
      } else {
        description += "Il est positif dès le début et renforce ce sentiment.";
      }
    } else {
      description = `Le texte évolue vers un sentiment plus négatif (- ${(
        Math.abs(evolution) * 100
      ).toFixed(0)}%). `;

      if (progressionFactor.startScore > 0.6) {
        description += "Il commence positivement mais se dégrade par la suite.";
      } else if (progressionFactor.startScore > 0.45) {
        description += "Il démarre sur un ton neutre et évolue négativement.";
      } else {
        description += "Il est négatif dès le début et renforce ce sentiment.";
      }
    }

    return {
      trend,
      evolution: parseFloat(evolution.toFixed(2)),
      startingPoint: parseFloat(progressionFactor.startScore.toFixed(2)),
      endingPoint: parseFloat(progressionFactor.endScore.toFixed(2)),
      description,
    };
  }
}

// Définir les variables d'exportation en dehors des blocs, avec valeurs par défaut
let analyzer = null;
let contextualAnalyzer = null;
let evaluator = null;

// Charger le dictionnaire et créer l'analyseur
try {
  const sentimentDictionary = JSON.parse(
    fs.readFileSync(dictionaryPath, "utf8")
  );

  analyzer = new SentimentAnalyzer(sentimentDictionary);
  contextualAnalyzer = new ContextualAnalyzer(
    analyzer,
    sentimentDictionary
  );
  evaluator = new SentimentEvaluator(analyzer, contextualAnalyzer);

} catch (error) {
  console.error(
    "Erreur lors du chargement du dictionnaire de sentiment:",
    error
  );
  console.error("Chemin du fichier:", dictionaryPath);

  // Créer un dictionnaire vide en cas d'erreur
  const emptyDict = {
    positiveWords: {},
    neutralWords: {},
    negativeWords: {},
    compounds: {
      modifierPrefixes: {},
      idioms: {},
      idiomPatterns: {}, // Ajout du nouvel élément
      negationWords: [],
    },
    emojiSentiments: {},
    config: {
      idiomDetectionRadius: 5
    },
  };

  // Créer des instances avec le dictionnaire vide
  analyzer = new SentimentAnalyzer(emptyDict);
  contextualAnalyzer = new ContextualAnalyzer(analyzer, emptyDict);
  evaluator = new SentimentEvaluator(analyzer, contextualAnalyzer);
}

// Exporter les classes et les instances (toujours exécuté, peu importe si une erreur s'est produite)
module.exports = {
  SentimentAnalyzer,
  ContextualAnalyzer,
  SentimentEvaluator,
  analyzer,
  contextualAnalyzer,
  evaluator,
};
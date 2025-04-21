const fs = require('fs');
const path = require('path');

// Chargement du dictionnaire depuis le fichier JSON
const dictionaryPath = path.join(__dirname, './data/sentiment-dictionary.json');
const sentimentDictionary = JSON.parse(fs.readFileSync(dictionaryPath, 'utf8'));

class SentimentAnalyzer {
  constructor(dictionary) {
    this.positiveWords = dictionary.positiveWords || {};
    this.neutralWords = dictionary.neutralWords || {};
    this.negativeWords = dictionary.negativeWords || {};
    this.modifierPrefixes = dictionary.compounds?.modifierPrefixes || {};
    this.idioms = dictionary.compounds?.idioms || {};
  }

  analyze(text) {
    if (!text || typeof text !== 'string') {
      return {
        score: 0.5,
        sentiment: "neutre",
        confidence: 0,
        details: { words: [], modifiers: [], idioms: [] }
      };
    }

    // Normalisation du texte
    const normalizedText = text.toLowerCase()
      .replace(/[.,!?;:(){}\[\]\/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    const details = {
      words: [],
      modifiers: [],
      idioms: []
    };

    let totalScore = 0;
    let wordCount = 0;
    let confidence = 0;

    // Analyse des expressions idiomatiques
    for (const [idiom, score] of Object.entries(this.idioms)) {
      if (normalizedText.includes(idiom)) {
        details.idioms.push({ phrase: idiom, score });
        totalScore += score;
        wordCount += 1;
        confidence += 0.8;
      }
    }

    // Diviser le texte en mots
    const words = normalizedText.split(' ');
    
    // Parcourir les mots et calculer le score
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
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
              modification: modifier 
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
                modification: modifier 
              });
            }
          }
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
        
        details.words.push({ 
          word, 
          originalScore: wordScore, 
          modifiedScore: score 
        });
        
        totalScore += score;
        wordCount += 1;
        confidence += 0.5;
      }
    }
    
    // Calcul du score final
    // Donner plus de poids aux expressions idiomatiques
    const idiomWeight = 1.5;
    let idiomScoreTotal = 0;
    let idiomCount = 0;
    
    for (const item of details.idioms) {
      idiomScoreTotal += item.score;
      idiomCount += 1;
    }
    
    // Calcul du score final pondéré
    let finalScore = 0.5; // Par défaut neutre
    if (wordCount > 0 || idiomCount > 0) {
      const totalWeightedScore = totalScore + (idiomScoreTotal * idiomWeight);
      const totalWeightedCount = wordCount + (idiomCount * idiomWeight);
      
      finalScore = totalWeightedScore / totalWeightedCount;
      confidence = Math.min(1, (confidence + (idiomCount * 0.8)) / ((wordCount * 0.8) + (idiomCount * 0.8)));
    } else {
      confidence = 0;
    }
    
    // Détermination du sentiment
    let sentiment = "neutre";
    if (finalScore >= 0.7) sentiment = "positif";
    else if (finalScore >= 0.55) sentiment = "légèrement positif";
    else if (finalScore <= 0.3) sentiment = "négatif";
    else if (finalScore <= 0.45) sentiment = "légèrement négatif";
    
    return {
      score: parseFloat(finalScore.toFixed(2)),
      sentiment,
      confidence: parseFloat(confidence.toFixed(2)),
      details
    };
  }
}

// Création d'une instance de l'analyseur
const analyzer = new SentimentAnalyzer(sentimentDictionary);

// Exporter la classe et l'instance
module.exports = { SentimentAnalyzer, analyzer };
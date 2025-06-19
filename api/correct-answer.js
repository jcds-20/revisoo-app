 // api/correct-answer.js
// Cette fonction corrige les réponses courtes via l'API OpenAI.

// La clé API OpenAI est récupérée depuis les variables d'environnement de Vercel.
// ASSUREZ-VOUS QUE LA VARIABLE D'ENVIRONNEMENT OPENAI_API_KEY EST CONFIGURÉE SUR VERCEL POUR CE PROJET.
const OpenAI = require('openai');

module.exports = async (req, res) => {
    // Configuration des en-têtes CORS pour permettre les requêtes depuis votre frontend (revisoo.com)
    // Pour la production, il est plus sûr de spécifier l'URL exacte de votre frontend: 'https://revisoo.com'
    res.setHeader('Access-Control-Allow-Origin', 'https://revisoo.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Gérer les requêtes "preflight" OPTIONS (envoyées automatiquement par le navigateur avant la requête réelle)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // S'assurer que seule la méthode POST est autorisée pour la logique principale
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    // Vérifier si la clé API OpenAI est configurée sur Vercel
    if (!openaiApiKey) {
        console.error("ERREUR: OPENAI_API_KEY n'est pas configurée dans les variables d'environnement Vercel.");
        res.status(500).json({ error: "La clé API OpenAI n'est pas configurée sur le serveur." });
        return;
    }

    const openai = new OpenAI({
        apiKey: openaiApiKey,
    });

    try {
        // Récupère les données envoyées par votre frontend : la question, la réponse de l'élève et la bonne réponse attendue
        const { question, userAnswer, correctAnswer } = req.body;

        // Validation basique des données reçues
        if (!question || !userAnswer || !correctAnswer) {
            res.status(400).json({ error: 'Question, réponse de l\'utilisateur et bonne réponse sont requises pour la correction.' });
            return;
        }

        // Le "prompt" pour l'IA, lui demandant de corriger la réponse et de donner un feedback
        const userPrompt = `La question est : "${question}". La bonne réponse attendue est : "${correctAnswer}". L'utilisateur a répondu : "${userAnswer}".
                            Évaluez la réponse de l'utilisateur.
                            Si la réponse est correcte (même si la formulation est différente mais le sens est le même), dites "Correct !" et un bref feedback positif.
                            Si la réponse est incorrecte, dites "Incorrect." et donnez un feedback concis expliquant pourquoi ou quelle était la bonne réponse.
                            Terminez votre réponse par "(Correct: true)" si c'est correct ou "(Correct: false)" si c'est incorrect.
                            Répondez en français.`;

        // Appel à l'API OpenAI pour obtenir la correction
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Utilisation du modèle gpt-4o-mini
            messages: [
                { role: "system", content: "Vous êtes un correcteur d'évaluation juste et précis. Votre réponse doit être concise et terminer par (Correct: true) ou (Correct: false)." },
                { role: "user", content: userPrompt }
            ],
            max_tokens: 150 // Limite la longueur de la réponse de l'IA
        });

        // Renvoie la réponse d'OpenAI (contenant la correction) au frontend
        res.status(200).json(completion);

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API OpenAI pour la correction:', error);
        // Gestion des erreurs OpenAI et renvoi au frontend
        if (error.response) {
            res.status(error.response.status).json({ error: error.response.data });
        } else {
            res.status(500).json({ error: 'Une erreur interne est survenue lors de la communication avec OpenAI pour la correction.' });
        }
    }
};

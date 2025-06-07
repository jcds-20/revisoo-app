 // api/correct-answer.js
// Cette fonction corrige les réponses courtes via l'API OpenAI.

// La clé API OpenAI est récupérée depuis les variables d'environnement de Vercel.
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

module.exports = async (req, res) => {
    // Vérifie si la clé API OpenAI est configurée
    if (!OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY n'est pas configurée dans les variables d'environnement Vercel.");
        return res.status(500).json({ error: "Configuration du serveur manquante: Clé API OpenAI." });
    }

    // Seules les requêtes POST sont autorisées
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Méthode non autorisée. Seul POST est accepté.' });
    }

    try {
        // Récupère les données nécessaires à la correction depuis le frontend
        const { question, userAnswer, correctAnswer } = req.body;

        // Validation basique
        if (!question || !userAnswer || !correctAnswer) {
            return res.status(400).json({ error: 'Payload invalide. Les champs question, userAnswer et correctAnswer sont requis.' });
        }

        const systemPrompt = "Vous êtes un correcteur d'évaluation juste et précis. Votre réponse doit être concise et terminer par (Correct: true) ou (Correct: false).";
        const userPrompt = `Considérez la question suivante : "${question}". La réponse attendue est : "${correctAnswer}". L'utilisateur a répondu : "${userAnswer}".
                            Évaluez la réponse de l'utilisateur. Si la réponse est correcte (même si la formulation est différente mais le sens est le même), dites "Correct !" et un bref feedback positif.
                            Si la réponse est incorrecte, dites "Incorrect." et donnez un feedback concis expliquant pourquoi ou quelle était la bonne réponse.
                            Indiquez si la réponse est correcte ou non en ajoutant à la fin de votre feedback un booléen sous cette forme (Correct: true) ou (Correct: false).`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ];

        // Appel sécurisé à l'API OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}` // Utilisation sécurisée de la clé
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages,
                max_tokens: 200
            })
        });

        // Gère les erreurs de la réponse OpenAI
        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            console.error("Erreur de l'API OpenAI (correction):", errorData);
            return res.status(openaiResponse.status).json({
                error: `Erreur de l'API OpenAI: ${errorData.error ? errorData.error.message : openaiResponse.statusText}`
            });
        }

        // Renvoie la réponse d'OpenAI au frontend
        const data = await openaiResponse.json();
        res.status(200).json(data);

    } catch (error) {
        console.error("Erreur lors du traitement de la requête de correction Vercel:", error);
        res.status(500).json({ error: 'Une erreur interne est survenue sur le serveur lors de la correction.' });
    }
};

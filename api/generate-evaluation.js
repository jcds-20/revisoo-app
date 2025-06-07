 // api/generate-evaluation.js
// Cette fonction génère des évaluations via l'API OpenAI.

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
        // Récupère les données envoyées par votre frontend
        const { model, messages, max_tokens } = req.body;

        // Validation basique des données reçues
        if (!model || !messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Payload invalide. Les champs model et messages sont requis.' });
        }

        // Appel sécurisé à l'API OpenAI
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}` // Utilisation sécurisée de la clé
            },
            body: JSON.stringify({
                model,
                messages,
                max_tokens
            })
        });

        // Gère les erreurs de la réponse OpenAI
        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            console.error("Erreur de l'API OpenAI (génération):", errorData);
            return res.status(openaiResponse.status).json({
                error: `Erreur de l'API OpenAI: ${errorData.error ? errorData.error.message : openaiResponse.statusText}`
            });
        }

        // Renvoie la réponse d'OpenAI au frontend
        const data = await openaiResponse.json();
        res.status(200).json(data);

    } catch (error) {
        console.error("Erreur lors du traitement de la requête de génération Vercel:", error);
        res.status(500).json({ error: 'Une erreur interne est survenue sur le serveur lors de la génération.' });
    }
};

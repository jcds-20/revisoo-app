 // api/generate-evaluation.js
const OpenAI = require('openai');

module.exports = async (req, res) => {
    // IMPORTANT: Ceci gère les en-têtes CORS.
    // Pour un développement ou des démos, '*' est acceptable.
    // Pour la production, il est plus sûr de spécifier l'URL exacte de votre frontend Vercel:
    // res.setHeader('Access-Control-Allow-Origin', 'https://revisoo-app.vercel.app');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Permet les requêtes depuis n'importe quelle origine
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Autorise les méthodes POST et OPTIONS
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Autorise les en-têtes Content-Type et Authorization

    // Gérer les requêtes "preflight" OPTIONS (envoyées automatiquement par le navigateur avant la requête réelle)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Assurez-vous que la méthode est POST pour la logique principale
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    // Vérification de la clé API OpenAI (récupérée de Vercel Environment Variables)
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
        console.error("OPENAI_API_KEY n'est pas configurée dans les variables d'environnement Vercel.");
        res.status(500).json({ error: "La clé API OpenAI n'est pas configurée sur le serveur." });
        return;
    }

    const openai = new OpenAI({
        apiKey: openaiApiKey,
    });

    try {
        const { model, messages, max_tokens } = req.body;

        if (!model || !messages) {
            res.status(400).json({ error: 'Modèle et messages sont requis.' });
            return;
        }

        const completion = await openai.chat.completions.create({
            model: model,
            messages: messages,
            max_tokens: max_tokens || 2000, // Utilisez max_tokens fourni ou une valeur par défaut
            response_format: { type: "json_object" } // Assurez-vous que le modèle retourne du JSON
        });

        // La réponse complète d'OpenAI est renvoyée au frontend
        res.status(200).json(completion);

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API OpenAI:', error);
        if (error.response) {
            console.error('Statut de l\'erreur OpenAI:', error.response.status);
            console.error('Données de l\'erreur OpenAI:', error.response.data);
            res.status(error.response.status).json({ error: error.response.data });
        } else {
            res.status(500).json({ error: 'Une erreur interne est survenue lors de la communication avec OpenAI.' });
        }
    }
};

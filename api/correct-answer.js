 // api/correct-answer.js
const OpenAI = require('openai');

module.exports = async (req, res) => {
    // IMPORTANT: Ceci gère les en-têtes CORS.
    // Pour un développement ou des démos, '*' est acceptable.
    // Pour la production, il est plus sûr de spécifier l'URL exacte de votre frontend Vercel:
    // res.setHeader('Access-Control-Allow-Origin', 'https://revisoo-app.vercel.app');
    res.setHeader('Access-Control-Allow-Origin', '*'); // Permet les requêtes depuis n'importe quelle origine
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS'); // Autorise les méthodes POST et OPTIONS
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Autorise les en-têtes Content-Type et Authorization

    // Gérer les requêtes "preflight" OPTIONS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Assurez-vous que la méthode est POST
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

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
        const { question, userAnswer, correctAnswer } = req.body;

        if (!question || !userAnswer || !correctAnswer) {
            res.status(400).json({ error: 'Question, réponse de l\'utilisateur et bonne réponse sont requises.' });
            return;
        }

        const prompt = `La question est : "${question}". La bonne réponse attendue est : "${correctAnswer}". La réponse de l'utilisateur est : "${userAnswer}".
        Indiquez si la réponse de l'utilisateur est correcte ou non, et fournissez un bref feedback.
        Terminez votre réponse par "(Correct: true)" si c'est correct ou "(Correct: false)" si c'est incorrect.
        Exemple correct: "Votre réponse est parfaitement juste. (Correct: true)"
        Exemple incorrect: "Votre réponse est incomplète. La bonne réponse est... (Correct: false)"
        `;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Utilisation de gpt-4o-mini pour la correction
            messages: [
                { role: "system", content: "Vous êtes un correcteur d'évaluation." },
                { role: "user", content: prompt }
            ],
            max_tokens: 150
        });

        // La réponse complète d'OpenAI est renvoyée au frontend
        res.status(200).json(completion);

    } catch (error) {
        console.error('Erreur lors de l\'appel à l\'API OpenAI pour la correction:', error);
        if (error.response) {
            console.error('Statut de l\'erreur OpenAI:', error.response.status);
            console.error('Données de l\'erreur OpenAI:', error.response.data);
            res.status(error.response.status).json({ error: error.response.data });
        } else {
            res.status(500).json({ error: 'Une erreur interne est survenue lors de la communication avec OpenAI pour la correction.' });
        }
    }
};
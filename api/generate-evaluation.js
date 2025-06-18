 // api/generate-evaluation.js
const OpenAI = require('openai');

module.exports = async (req, res) => {
    // Configuration des en-têtes CORS pour permettre les requêtes depuis revisoo.com
    res.setHeader('Access-Control-Allow-Origin', 'https://revisoo.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Gérer la requête OPTIONS (pré-vérification CORS)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // S'assurer que seule la méthode POST est autorisée
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    // Vérifier si la clé API OpenAI est configurée
    if (!openaiApiKey) {
        console.error("ERREUR: OPENAI_API_KEY n'est pas configurée dans les variables d'environnement Vercel.");
        res.status(500).json({ error: "La clé API OpenAI n'est pas configurée sur le serveur." });
        return;
    }

    const openai = new OpenAI({
        apiKey: openaiApiKey,
    });

    try {
        const { model, messages, max_tokens } = req.body;

        // Vérifier si le modèle et les messages sont présents dans la requête
        if (!model || !messages) {
            res.status(400).json({ error: 'Modèle et messages sont requis.' });
            return;
        }

        // Appel à l'API OpenAI
        const completion = await openai.chat.completions.create({
            model: model,
            messages: messages,
            max_tokens: max_tokens || 2000,
            response_format: { type: "json_object" } // Demande à OpenAI de renvoyer un objet JSON
        });

        // Tenter d'extraire le contenu du message
        let rawContent = null;
        if (completion && completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
            rawContent = completion.choices[0].message.content;
            console.log('Contenu message d\'OpenAI (rawContent):', rawContent); // Garde ce log crucial pour débogage futur
        } else {
            console.warn('Format de réponse inattendu de l\'API OpenAI (structure).');
            res.status(500).json({ error: 'Format de réponse inattendu de l\'API OpenAI (structure).', completion: completion });
            return;
        }

        // Tenter de parser le contenu JSON
        try {
            // Nettoyer le contenu si OpenAI ajoute des balises comme ```json
            const cleanContent = rawContent.replace(/```json\s*|```/g, '').trim();
            const parsedApiResponse = JSON.parse(cleanContent);
            
            // --- CORRECTION MAJEURE ICI : Cherche d'abord 'questions', puis 'evaluation' ---
            let evaluationData = parsedApiResponse.questions || parsedApiResponse.evaluation;

            if (!evaluationData) {
                console.error('ERREUR: La réponse parsée ne contient ni la clé "questions" ni la clé "evaluation".', parsedApiResponse);
                res.status(500).json({ error: "La réponse de l'IA n'a pas la structure attendue (ni 'questions' ni 'evaluation' trouvée)." });
                return;
            }

            // Maintenant, validation sur le tableau extrait
            if (!Array.isArray(evaluationData) || evaluationData.length === 0 || 
                !evaluationData[0] || !evaluationData[0].question || !evaluationData[0].type) {
                console.error('ERREUR: Le tableau "questions" ou "evaluation" ne correspond pas au format d\'évaluation attendu. Structure:', evaluationData);
                res.status(500).json({ error: "Le tableau d'évaluation de l'IA ne correspond pas au format attendu.", evaluationData: evaluationData });
                return;
            }
            // --- FIN DE LA CORRECTION ---

            // Réponse finale au frontend avec le tableau d'évaluation directement
            // Le frontend attend un objet completion avec un champ message.content qui est une chaîne JSON.
            // Donc, nous ré-stringifions le tableau evaluationData.
            res.status(200).json({ choices: [{ message: { content: JSON.stringify(evaluationData) } }] });

        } catch (parseError) {
            console.error('ERREUR DE PARSING JSON:', parseError.message);
            console.error('Contenu qui a échoué au parsing (rawContent):', rawContent);
            res.status(500).json({ error: "Erreur lors de l'analyse de la réponse JSON de l'IA: " + parseError.message });
        }

    } catch (error) {
        console.error('ERREUR GÉNÉRALE DANS LA FONCTION SERVERLESS:', error);
        if (error.response) {
            console.error('Statut de l\'erreur OpenAI:', error.response.status);
            console.error('Données de l\'erreur OpenAI:', error.response.data);
            res.status(error.response.status).json({ error: error.response.data });
        } else {
            res.status(500).json({ error: 'Une erreur interne est survenue lors de la communication avec OpenAI: ' + error.message });
        }
    }
};


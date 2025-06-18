 // api/generate-evaluation.js
const OpenAI = require('openai');

module.exports = async (req, res) => {
    // Configuration des en-têtes CORS pour permettre les requêtes depuis revisoo.com
    res.setHeader('Access-Control-Allow-Origin', 'https://revisoo.com'); // Spécifie l'origine permise
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    console.log('--- Début de l\'exécution de la fonction generate-evaluation.js ---'); // Log au tout début

    // Gérer la requête OPTIONS (pré-vérification CORS)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        console.log('Requête OPTIONS traitée.');
        console.log('--- Fin de l\'exécution OPTIONS ---');
        return;
    }

    // S'assurer que seule la méthode POST est autorisée
    if (req.method !== 'POST') {
        console.log('Méthode non autorisée:', req.method);
        res.status(405).json({ error: 'Method Not Allowed' });
        console.log('--- Fin de l\'exécution (méthode non autorisée) ---');
        return;
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;

    // Vérifier si la clé API OpenAI est configurée
    if (!openaiApiKey) {
        console.error("ERREUR CRITIQUE: OPENAI_API_KEY n'est pas configurée dans les variables d'environnement Vercel.");
        res.status(500).json({ error: "La clé API OpenAI n'est pas configurée sur le serveur." });
        console.log('--- Fin de l\'exécution (clé API manquante) ---');
        return;
    }

    const openai = new OpenAI({
        apiKey: openaiApiKey,
    });

    try {
        const { model, messages, max_tokens } = req.body;

        // Vérifier si le modèle et les messages sont présents dans la requête
        if (!model || !messages) {
            console.log('ERREUR: Données manquantes dans le corps de la requête. Corps reçu:', req.body);
            res.status(400).json({ error: 'Modèle et messages sont requis.' });
            console.log('--- Fin de l\'exécution (données manquantes) ---');
            return;
        }

        console.log('Payload envoyé à OpenAI:', JSON.stringify({ model, messages, max_tokens }, null, 2));

        // Appel à l'API OpenAI
        const completion = await openai.chat.completions.create({
            model: model,
            messages: messages,
            max_tokens: max_tokens || 2000,
            response_format: { type: "json_object" } // Demande à OpenAI de renvoyer un objet JSON
        });

        // Log la réponse brute d'OpenAI avant de la traiter
        console.log('Réponse brute complète d\'OpenAI (completion object):', JSON.stringify(completion, null, 2));

        // Tenter d'extraire le contenu du message
        let rawContent = null;
        if (completion && completion.choices && completion.choices.length > 0 && completion.choices[0].message) {
            rawContent = completion.choices[0].message.content;
            console.log('Contenu message d\'OpenAI (rawContent):', rawContent); // Log le contenu spécifique du message
        } else {
            console.warn('ATTENTION: Le format de réponse d\'OpenAI n\'est pas celui attendu dans completion.choices[0].message. completion:', completion);
            res.status(500).json({ error: 'Format de réponse inattendu de l\'API OpenAI (structure).', completion: completion });
            console.log('--- Fin de l\'exécution (format de réponse inattendu de l\'API OpenAI - structure) ---');
            return;
        }

        // Tenter de parser le contenu JSON
        try {
            // Nettoyer le contenu si OpenAI ajoute des balises comme ```json
            const cleanContent = rawContent.replace(/```json\s*|```/g, '').trim();
            console.log('Contenu nettoyé avant parsing:', cleanContent); // Log le contenu après nettoyage

            const parsedContent = JSON.parse(cleanContent);
            
            console.log('Contenu JSON parsé:', JSON.stringify(parsedContent, null, 2));

            // Vérifier si le JSON parsé est un tableau valide d'évaluations
            if (!Array.isArray(parsedContent) || parsedContent.length === 0 || 
                !parsedContent[0] || !parsedContent[0].question || !parsedContent[0].type) { // Ajout de !parsedContent[0] pour plus de robustesse
                console.error('ERREUR: Le JSON parsé ne correspond pas au format d\'évaluation attendu. Structure:', parsedContent);
                res.status(500).json({ error: "Le JSON parsé ne correspond pas au format d'évaluation attendu.", parsedContent: parsedContent });
                console.log('--- Fin de l\'exécution (JSON parsé incorrect) ---');
                return;
            }

            // Réponse finale au frontend avec l'objet completion original
            res.status(200).json(completion);
            console.log('--- Fin de l\'exécution (succès) ---');

        } catch (parseError) {
            console.error('ERREUR DE PARSING JSON:', parseError.message);
            console.error('Contenu qui a échoué au parsing (rawContent):', rawContent); // Affiche le contenu qui a causé l'erreur
            console.error('Contenu nettoyé qui a échoué au parsing:', cleanContent); // Affiche le contenu nettoyé
            res.status(500).json({ error: "Erreur lors de l'analyse de la réponse JSON de l'IA: " + parseError.message });
            console.log('--- Fin de l\'exécution (erreur de parsing JSON) ---');
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
        console.log('--- Fin de l\'exécution (erreur générale) ---');
    }
};
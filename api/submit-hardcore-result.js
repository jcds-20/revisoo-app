 // api/hardcore-questions.js
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
    if (req.method !== 'GET') { // La page hardcore_test.html fait une requête GET
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const today = new Date().toISOString().split('T')[0]; // Format 'YYYY-MM-DD'

    try {
        // 1. Vérifier si l'évaluation Hardcore du jour existe déjà dans Supabase
        let { data: dailyEval, error: fetchError } = await supabase
            .from('daily_hardcore_evals')
            .select('*')
            .eq('date', today)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 est "no rows found"
            console.error("Erreur Supabase lors de la vérification de l'évaluation quotidienne :", fetchError.message);
            return res.status(500).json({ error: 'Erreur lors de la récupération de l\'évaluation quotidienne.' });
        }

        if (!dailyEval) {
            console.log("Aucune évaluation quotidienne trouvée pour aujourd'hui. Génération d'une nouvelle.");
            // 2. Si non, générer l'évaluation avec OpenAI
            const prompt = `Génère 10 questions de QCM avec 4 options (A, B, C, D) et la bonne réponse, sur des sujets de culture générale variés et difficiles (hardcore), sans répétition. Le format JSON doit être un tableau d'objets. Chaque objet doit avoir: "question", "options" (tableau de strings), "correctAnswer" (la lettre A, B, C ou D), "question_number" (1 à 10). Ne donne aucune introduction ou explication, juste le JSON.`;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini", // Utilise gpt-4o-mini pour la rapidité et le coût
                messages: [
                    { role: "system", content: "Tu es un générateur de questions d'évaluation hardcore. Réponds uniquement avec un tableau d'objets JSON." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                max_tokens: 1500 // Ajuste si nécessaire pour 10 questions
            });

            let generatedQuestions;
            try {
                // Nettoyer et parser la réponse de l'IA
                const rawContent = completion.choices[0].message.content;
                const cleanContent = rawContent.replace(/```json\s*|```/g, '').trim();
                const parsedContent = JSON.parse(cleanContent);
                // L'IA pourrait renvoyer un objet { questions: [...] } ou directement le tableau [...]
                generatedQuestions = parsedContent.questions || parsedContent;

                if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0 || 
                    !generatedQuestions[0].question || !generatedQuestions[0].options || !generatedQuestions[0].correctAnswer) {
                    throw new Error("Le format des questions générées par l'IA est incorrect.");
                }
            } catch (parseError) {
                console.error("Erreur de parsing de la réponse OpenAI :", parseError);
                return res.status(500).json({ error: "Erreur de format de la réponse de l'IA. Impossible de générer les questions." });
            }

            // 3. Enregistrer l'évaluation dans Supabase
            const { data: newEval, error: insertError } = await supabase
                .from('daily_hardcore_evals')
                .insert([{
                    date: today,
                    questions_content: generatedQuestions // Stocke le JSON des questions
                }])
                .select();

            if (insertError) {
                console.error("Erreur Supabase lors de l'insertion de la nouvelle évaluation :", insertError.message);
                // Gérer le cas de "duplicate key" si deux requêtes arrivent en même temps
                if (insertError.code === '23505') { // Code d'erreur pour violation de contrainte unique
                    // Si une autre requête a déjà inséré l'évaluation, on la récupère
                    const { data: existingDailyEval, error: reFetchError } = await supabase
                        .from('daily_hardcore_evals')
                        .select('*')
                        .eq('date', today)
                        .single();
                    if (reFetchError) throw reFetchError; // Si même le re-fetch échoue
                    dailyEval = existingDailyEval;
                } else {
                    return res.status(500).json({ error: 'Échec de l\'enregistrement de l\'évaluation quotidienne.' });
                }
            } else {
                dailyEval = newEval[0];
            }
        }

        // 4. Retourner les questions au frontend
        res.status(200).json({ questions: dailyEval.questions_content });

    } catch (error) {
        console.error("Erreur générale dans hardcore-questions.js :", error.message);
        res.status(500).json({ error: 'Erreur interne du serveur lors de la récupération/génération des questions Hardcore.' });
    }
}
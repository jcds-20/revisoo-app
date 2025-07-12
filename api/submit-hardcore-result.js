// api/submit-hardcore-result.js
const { createClient } = require('@supabase/supabase-js'); // CHANGEMENT ICI

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) { // CHANGEMENT ICI (export default devient module.exports)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, score, totalQuestions, answers, success } = req.body;

  if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID is missing.' });
  }

  const today = new Date().toISOString().split('T')[0]; // Format 'YYYY-MM-DD'

  const { data: currentEval, error: evalError } = await supabase
    .from('daily_hardcore_evals')
    .select('id')
    .eq('date', today)
    .single();

  if (evalError || !currentEval) {
      console.error("Impossible de trouver l'évaluation quotidienne pour aujourd'hui :", evalError ? evalError.message : "Évaluation non trouvée.");
      return res.status(404).json({ error: 'L\'évaluation quotidienne pour aujourd\'hui n\'est pas disponible pour enregistrer les résultats.' });
  }

  const evalId = currentEval.id;

  try {
    const { data, error } = await supabase
      .from('user_hardcore_attempts')
      .insert([
        {
          user_id: userId,
          eval_id: evalId,
          attempt_date: today,
          score: score,
          results_details: answers,
          completed_at: new Date().toISOString(),
          successful_completion: success
        }
      ])
      .select();

    if (error) {
      console.error("Erreur Supabase lors de l'insertion des résultats :", error.message);
      if (error.code === '23505') {
        return res.status(409).json({ error: 'Vous avez déjà soumis un résultat pour l\'évaluation Hardcore d\'aujourd\'hui.' });
      }
      return res.status(500).json({ error: 'Échec de l\'enregistrement des résultats.' });
    }

    res.status(200).json({ message: 'Résultats enregistrés avec succès !', data });
  } catch (insertError) {
    console.error("Erreur inattendue lors de l'enregistrement des résultats :", insertError.message);
    res.status(500).json({ error: 'Erreur interne du serveur lors de l\'enregistrement des résultats.' });
  }
};
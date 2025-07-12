 // api/submit-hardcore-result.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Utilisez cette clé si l'insertion bypass les RLS pour admin-like
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { userId, score, totalQuestions, answers, success } = req.body;
  const today = new Date().toISOString().split('T')[0]; // Format 'YYYY-MM-DD'

  // Récupérer l'ID de l'évaluation quotidienne actuelle pour la lier
  const { data: currentEval, error: evalError } = await supabase
    .from('daily_hardcore_evals')
    .select('id')
    .eq('date', today)
    .single();

  if (evalError || !currentEval) {
      console.error("Impossible de trouver l'évaluation quotidienne pour aujourd'hui :", evalError);
      return res.status(500).json({ error: 'Impossible de lier les résultats à l\'évaluation du jour.' });
  }

  const evalId = currentEval.id;

  try {
    // Insérer la tentative de l'utilisateur
    const { data, error } = await supabase
      .from('user_hardcore_attempts')
      .insert([
        {
          user_id: userId,
          eval_id: evalId,
          attempt_date: today,
          score: score,
          results_details: answers, // Stocke les détails des réponses
          completed_at: new Date().toISOString(),
          successful_completion: success // Ajoute cette colonne pour suivre si le défi a été terminé
        }
      ])
      .select(); // Pour récupérer les données insérées si besoin

    if (error) {
      console.error("Erreur Supabase lors de l'insertion des résultats :", error);
      return res.status(500).json({ error: 'Échec de l\'enregistrement des résultats.' });
    }

    res.status(200).json({ message: 'Résultats enregistrés avec succès !', data });
  } catch (insertError) {
    console.error("Erreur inattendue lors de l'enregistrement des résultats :", insertError);
    res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
}
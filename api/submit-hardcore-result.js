 // api/submit-hardcore-result.js
import { createClient } from '@supabase/supabase-js';

// Initialise le client Supabase avec tes clés d'environnement.
// Assure-toi que ces variables sont configurées dans ton projet Vercel.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Utilisez cette clé si l'insertion doit bypasser les RLS ou si c'est une fonction admin-like
  // Si tu gères les RLS pour que l'utilisateur insère via sa propre auth,
  // tu n'utiliserais pas SUPABASE_SERVICE_ROLE_KEY ici pour l'insertion directe,
  // mais plutôt le token de l'utilisateur passé depuis le frontend.
  // Cependant, pour simplifier la gestion des tentatives uniques par jour côté backend,
  // la clé de service est souvent utilisée dans les fonctions API.
);

export default async function handler(req, res) {
  // S'assurer que seule la méthode POST est autorisée
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Récupère les données envoyées par la page hardcore_test.html
  const { userId, score, totalQuestions, answers, success } = req.body;

  // Si userId n'est pas fourni (par exemple, si l'utilisateur n'est pas connecté), retourne une erreur
  if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User ID is missing.' });
  }

  const today = new Date().toISOString().split('T')[0]; // Format 'YYYY-MM-DD'

  // Récupérer l'ID de l'évaluation quotidienne actuelle pour la lier aux résultats.
  // C'est important pour que l'on sache à quelle évaluation spécifique cette tentative correspond.
  const { data: currentEval, error: evalError } = await supabase
    .from('daily_hardcore_evals')
    .select('id')
    .eq('date', today)
    .single();

  if (evalError || !currentEval) {
      console.error("Impossible de trouver l'évaluation quotidienne pour aujourd'hui :", evalError ? evalError.message : "Évaluation non trouvée.");
      // Retourne un statut 404 car l'évaluation quotidienne n'est pas disponible pour y lier le résultat
      return res.status(404).json({ error: 'L\'évaluation quotidienne pour aujourd\'hui n\'est pas disponible pour enregistrer les résultats.' });
  }

  const evalId = currentEval.id;

  try {
    // Insérer la tentative de l'utilisateur dans la table user_hardcore_attempts
    const { data, error } = await supabase
      .from('user_hardcore_attempts')
      .insert([
        {
          user_id: userId,            // L'ID de l'utilisateur (doit correspondre à auth.uid() si RLS s'applique)
          eval_id: evalId,            // L'ID de l'évaluation quotidienne à laquelle l'utilisateur a participé
          attempt_date: today,        // La date de la tentative
          score: score,               // Le score obtenu par l'utilisateur
          results_details: answers,   // Les détails des questions et réponses de l'utilisateur (JSONB)
          completed_at: new Date().toISOString(), // Horodatage de fin de l'évaluation
          successful_completion: success // Indique si l'évaluation a été terminée (true) ou abandonnée/perdue (false)
        }
      ])
      .select(); // Retourne les données insérées

    if (error) {
      console.error("Erreur Supabase lors de l'insertion des résultats :", error.message);
      // Gérer spécifiquement l'erreur si l'utilisateur a déjà tenté l'évaluation aujourd'hui
      if (error.code === '23505') { // Code d'erreur pour violation de contrainte unique (ex: si on avait une contrainte user_id + attempt_date unique)
        return res.status(409).json({ error: 'Vous avez déjà soumis un résultat pour l\'évaluation Hardcore d\'aujourd\'hui.' });
      }
      return res.status(500).json({ error: 'Échec de l\'enregistrement des résultats.' });
    }

    // Réponse de succès
    res.status(200).json({ message: 'Résultats enregistrés avec succès !', data });
  } catch (insertError) {
    console.error("Erreur inattendue lors de l'enregistrement des résultats :", insertError.message);
    res.status(500).json({ error: 'Erreur interne du serveur lors de l\'enregistrement des résultats.' });
  }
}
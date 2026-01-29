import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL e/ou Anon Key não configurados. O contador de uso não funcionará.');
}

const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const COUNTER_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Obtém o contador atual de uso
 */
export const getUsageCounter = async (): Promise<number> => {
  if (!supabase) return 0;

  try {
    const { data, error } = await supabase
      .from('usage_counter')
      .select('count')
      .eq('id', COUNTER_ID)
      .single();

    if (error) {
      console.error('Erro ao obter contador:', error);
      return 0;
    }

    return data?.count || 0;
  } catch (error) {
    console.error('Erro ao obter contador:', error);
    return 0;
  }
};

/**
 * Incrementa o contador de uso
 */
export const incrementUsageCounter = async (): Promise<number> => {
  if (!supabase) return 0;

  try {
    // Usar a função SQL para incrementar atomicamente
    const { data, error } = await supabase.rpc('increment_usage_counter');

    if (error) {
      console.error('Erro ao incrementar contador:', error);
      // Fallback: tentar incrementar manualmente
      return await incrementCounterFallback();
    }

    return data || 0;
  } catch (error) {
    console.error('Erro ao incrementar contador:', error);
    return await incrementCounterFallback();
  }
};

/**
 * Fallback para incrementar o contador manualmente
 */
const incrementCounterFallback = async (): Promise<number> => {
  if (!supabase) return 0;

  try {
    // Obter o valor atual
    const { data: currentData, error: getError } = await supabase
      .from('usage_counter')
      .select('count')
      .eq('id', COUNTER_ID)
      .single();

    if (getError) {
      console.error('Erro ao obter contador para incremento:', getError);
      return 0;
    }

    const newCount = (currentData?.count || 0) + 1;

    // Atualizar o valor
    const { data: updateData, error: updateError } = await supabase
      .from('usage_counter')
      .update({ count: newCount, updated_at: new Date().toISOString() })
      .eq('id', COUNTER_ID)
      .select()
      .single();

    if (updateError) {
      console.error('Erro ao atualizar contador:', updateError);
      return 0;
    }

    return updateData?.count || 0;
  } catch (error) {
    console.error('Erro no fallback de incremento:', error);
    return 0;
  }
};

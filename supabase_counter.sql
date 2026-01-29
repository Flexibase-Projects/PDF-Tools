-- Criar tabela para contador de uso
CREATE TABLE IF NOT EXISTS usage_counter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inserir registro inicial se não existir
INSERT INTO usage_counter (id, count)
VALUES ('00000000-0000-0000-0000-000000000001', 0)
ON CONFLICT (id) DO NOTHING;

-- Criar função para incrementar o contador
CREATE OR REPLACE FUNCTION increment_usage_counter()
RETURNS BIGINT AS $$
DECLARE
  current_count BIGINT;
BEGIN
  UPDATE usage_counter
  SET count = count + 1,
      updated_at = NOW()
  WHERE id = '00000000-0000-0000-0000-000000000001'
  RETURNING count INTO current_count;
  
  RETURN current_count;
END;
$$ LANGUAGE plpgsql;

-- Criar função para obter o contador atual
CREATE OR REPLACE FUNCTION get_usage_counter()
RETURNS BIGINT AS $$
DECLARE
  current_count BIGINT;
BEGIN
  SELECT count INTO current_count
  FROM usage_counter
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  RETURN COALESCE(current_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (Row Level Security) se necessário
ALTER TABLE usage_counter ENABLE ROW LEVEL SECURITY;

-- Criar política para permitir leitura pública
CREATE POLICY "Allow public read access"
ON usage_counter
FOR SELECT
USING (true);

-- Criar política para permitir incremento (via função)
CREATE POLICY "Allow public increment via function"
ON usage_counter
FOR UPDATE
USING (true)
WITH CHECK (true);

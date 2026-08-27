CREATE POLICY "congregacoes_read_ativas" ON public.congregacoes
FOR SELECT TO authenticated
USING (status = 'ativa');
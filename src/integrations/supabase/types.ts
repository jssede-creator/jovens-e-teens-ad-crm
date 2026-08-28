export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      arquivos: {
        Row: {
          caminho: string
          created_at: string
          enviado_por: string | null
          enviado_por_nome: string | null
          id: string
          nome: string
          pasta_id: string | null
          tamanho: number
          tipo: string | null
        }
        Insert: {
          caminho: string
          created_at?: string
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          nome: string
          pasta_id?: string | null
          tamanho?: number
          tipo?: string | null
        }
        Update: {
          caminho?: string
          created_at?: string
          enviado_por?: string | null
          enviado_por_nome?: string | null
          id?: string
          nome?: string
          pasta_id?: string | null
          tamanho?: number
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arquivos_pasta_id_fkey"
            columns: ["pasta_id"]
            isOneToOne: false
            referencedRelation: "arquivos_pastas"
            referencedColumns: ["id"]
          },
        ]
      }
      arquivos_pastas: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          nome: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          nome: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      auditoria: {
        Row: {
          acao: string
          created_at: string
          detalhe: string | null
          entidade: string
          entidade_id: string | null
          id: string
          user_id: string | null
          user_nome: string
        }
        Insert: {
          acao: string
          created_at?: string
          detalhe?: string | null
          entidade: string
          entidade_id?: string | null
          id?: string
          user_id?: string | null
          user_nome?: string
        }
        Update: {
          acao?: string
          created_at?: string
          detalhe?: string | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          user_id?: string | null
          user_nome?: string
        }
        Relationships: []
      }
      cadastros: {
        Row: {
          cep: string
          cidade: string
          compartilhou_dados_complementares: boolean
          complemento: string | null
          congregacao_id: string | null
          cpf: string
          curso: string | null
          data_cadastro: string
          data_nascimento: string
          email: string
          endereco: string
          escolaridade: string | null
          estado_civil: string | null
          id: string
          lgpd_aceito: boolean
          local_estudo: string | null
          mora_com_pais: boolean | null
          nome_completo: string
          numero: string | null
          ponto_referencia: string | null
          renda_familiar: string | null
          renda_mensal: string | null
          rg: string
          telefone: string
          trabalha_atualmente: boolean | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cep: string
          cidade: string
          compartilhou_dados_complementares?: boolean
          complemento?: string | null
          congregacao_id?: string | null
          cpf: string
          curso?: string | null
          data_cadastro?: string
          data_nascimento: string
          email: string
          endereco: string
          escolaridade?: string | null
          estado_civil?: string | null
          id?: string
          lgpd_aceito: boolean
          local_estudo?: string | null
          mora_com_pais?: boolean | null
          nome_completo: string
          numero?: string | null
          ponto_referencia?: string | null
          renda_familiar?: string | null
          renda_mensal?: string | null
          rg: string
          telefone: string
          trabalha_atualmente?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cep?: string
          cidade?: string
          compartilhou_dados_complementares?: boolean
          complemento?: string | null
          congregacao_id?: string | null
          cpf?: string
          curso?: string | null
          data_cadastro?: string
          data_nascimento?: string
          email?: string
          endereco?: string
          escolaridade?: string | null
          estado_civil?: string | null
          id?: string
          lgpd_aceito?: boolean
          local_estudo?: string | null
          mora_com_pais?: boolean | null
          nome_completo?: string
          numero?: string | null
          ponto_referencia?: string | null
          renda_familiar?: string | null
          renda_mensal?: string | null
          rg?: string
          telefone?: string
          trabalha_atualmente?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadastros_congregacao_id_fkey"
            columns: ["congregacao_id"]
            isOneToOne: false
            referencedRelation: "congregacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      composicao_familiar: {
        Row: {
          cadastro_id: string
          created_at: string
          id: string
          idade: number | null
          nome_completo: string
          ocupacao: string | null
          parentesco: string | null
        }
        Insert: {
          cadastro_id: string
          created_at?: string
          id?: string
          idade?: number | null
          nome_completo: string
          ocupacao?: string | null
          parentesco?: string | null
        }
        Update: {
          cadastro_id?: string
          created_at?: string
          id?: string
          idade?: number | null
          nome_completo?: string
          ocupacao?: string | null
          parentesco?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "composicao_familiar_cadastro_id_fkey"
            columns: ["cadastro_id"]
            isOneToOne: false
            referencedRelation: "cadastros"
            referencedColumns: ["id"]
          },
        ]
      }
      congregacoes: {
        Row: {
          bairro: string
          cep: string
          cidade: string
          created_at: string
          endereco: string
          estado: string
          id: string
          nome: string
          numero: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bairro: string
          cep: string
          cidade: string
          created_at?: string
          endereco: string
          estado: string
          id?: string
          nome: string
          numero?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bairro?: string
          cep?: string
          cidade?: string
          created_at?: string
          endereco?: string
          estado?: string
          id?: string
          nome?: string
          numero?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      ebd_aulas: {
        Row: {
          created_at: string
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
          nome: string
          turma_id: string
        }
        Insert: {
          created_at?: string
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
          nome: string
          turma_id: string
        }
        Update: {
          created_at?: string
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
          nome?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_aulas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_frequencia: {
        Row: {
          cadastro_id: string
          created_at: string
          data: string
          id: string
          presente: boolean
          turma_id: string
        }
        Insert: {
          cadastro_id: string
          created_at?: string
          data: string
          id?: string
          presente: boolean
          turma_id: string
        }
        Update: {
          cadastro_id?: string
          created_at?: string
          data?: string
          id?: string
          presente?: boolean
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_frequencia_cadastro_id_fkey"
            columns: ["cadastro_id"]
            isOneToOne: false
            referencedRelation: "cadastros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_frequencia_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_matriculas: {
        Row: {
          cadastro_id: string
          created_at: string
          id: string
          turma_id: string
        }
        Insert: {
          cadastro_id: string
          created_at?: string
          id?: string
          turma_id: string
        }
        Update: {
          cadastro_id?: string
          created_at?: string
          id?: string
          turma_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_matriculas_cadastro_id_fkey"
            columns: ["cadastro_id"]
            isOneToOne: false
            referencedRelation: "cadastros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ebd_matriculas_turma_id_fkey"
            columns: ["turma_id"]
            isOneToOne: false
            referencedRelation: "ebd_turmas"
            referencedColumns: ["id"]
          },
        ]
      }
      ebd_turmas: {
        Row: {
          congregacao_id: string
          created_at: string
          id: string
          idade_max: number
          idade_min: number
          nome: string
        }
        Insert: {
          congregacao_id: string
          created_at?: string
          id?: string
          idade_max: number
          idade_min: number
          nome: string
        }
        Update: {
          congregacao_id?: string
          created_at?: string
          id?: string
          idade_max?: number
          idade_min?: number
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "ebd_turmas_congregacao_id_fkey"
            columns: ["congregacao_id"]
            isOneToOne: false
            referencedRelation: "congregacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_inscricoes: {
        Row: {
          created_at: string
          email: string
          evento_id: string
          id: string
          nome: string
          observacao: string | null
          status: string
          user_id: string
          codigo: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          confirmado_por_nome: string | null
          pagamento: string
        }
        Insert: {
          created_at?: string
          email: string
          evento_id: string
          id?: string
          nome: string
          observacao?: string | null
          status?: string
          user_id: string
          codigo?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          confirmado_por_nome?: string | null
          pagamento?: string
        }
        Update: {
          created_at?: string
          email?: string
          evento_id?: string
          id?: string
          nome?: string
          observacao?: string | null
          status?: string
          user_id?: string
          codigo?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          confirmado_por_nome?: string | null
          pagamento?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_inscricoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          categoria: string
          congregacao_id: string | null
          created_at: string
          criado_por: string | null
          data: string
          descricao: string | null
          hora_fim: string
          hora_inicio: string
          id: string
          local: string
          status: string
          taxa: number | null
          titulo: string
          updated_at: string
          vagas: number | null
        }
        Insert: {
          categoria?: string
          congregacao_id?: string | null
          created_at?: string
          criado_por?: string | null
          data: string
          descricao?: string | null
          hora_fim: string
          hora_inicio: string
          id?: string
          local: string
          status?: string
          taxa?: number | null
          titulo: string
          updated_at?: string
          vagas?: number | null
        }
        Update: {
          categoria?: string
          congregacao_id?: string | null
          created_at?: string
          criado_por?: string | null
          data?: string
          descricao?: string | null
          hora_fim?: string
          hora_inicio?: string
          id?: string
          local?: string
          status?: string
          taxa?: number | null
          titulo?: string
          updated_at?: string
          vagas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "eventos_congregacao_id_fkey"
            columns: ["congregacao_id"]
            isOneToOne: false
            referencedRelation: "congregacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      module_access: {
        Row: {
          granted_at: string
          granted_by: string | null
          module_key: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          module_key: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          module_key?: string
          user_id?: string
        }
        Relationships: []
      }
      papo_reto_agendamentos: {
        Row: {
          assunto: string
          created_at: string
          data: string
          hora_fim: string
          hora_inicio: string
          horario_id: string | null
          id: string
          mensagem: string | null
          resposta: string | null
          solicitante_email: string
          solicitante_nome: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assunto: string
          created_at?: string
          data: string
          hora_fim: string
          hora_inicio: string
          horario_id?: string | null
          id?: string
          mensagem?: string | null
          resposta?: string | null
          solicitante_email: string
          solicitante_nome: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assunto?: string
          created_at?: string
          data?: string
          hora_fim?: string
          hora_inicio?: string
          horario_id?: string | null
          id?: string
          mensagem?: string | null
          resposta?: string | null
          solicitante_email?: string
          solicitante_nome?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "papo_reto_agendamentos_horario_id_fkey"
            columns: ["horario_id"]
            isOneToOne: false
            referencedRelation: "papo_reto_horarios"
            referencedColumns: ["id"]
          },
        ]
      }
      papo_reto_horarios: {
        Row: {
          created_at: string
          criado_por: string | null
          data: string
          hora_fim: string
          hora_inicio: string
          id: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data: string
          hora_fim: string
          hora_inicio: string
          id?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data?: string
          hora_fim?: string
          hora_inicio?: string
          id?: string
        }
        Relationships: []
      }
      projeto_tarefas: {
        Row: {
          created_at: string
          descricao: string | null
          fase: string
          fim: string | null
          id: string
          inicio: string | null
          numero: number
          ordem: number
          prioridade: string
          projeto_id: string
          responsavel_id: string | null
          responsavel_nome: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          fase: string
          fim?: string | null
          id?: string
          inicio?: string | null
          numero?: number
          ordem?: number
          prioridade?: string
          projeto_id: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          fase?: string
          fim?: string | null
          id?: string
          inicio?: string | null
          numero?: number
          ordem?: number
          prioridade?: string
          projeto_id?: string
          responsavel_id?: string | null
          responsavel_nome?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projeto_tarefas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          ordem: number
          prazo: string | null
          responsavel: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          ordem?: number
          prazo?: string | null
          responsavel?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          ordem?: number
          prazo?: string | null
          responsavel?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      eventos_inscritos: {
        Args: Record<PropertyKey, never>
        Returns: {
          evento_id: string
          inscritos: number
        }[]
      }
      has_module_access: {
        Args: { _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const

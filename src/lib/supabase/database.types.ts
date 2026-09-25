export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_jobs: {
        Row: {
          agent_key: string
          attempts: number
          brand_id: string | null
          code: string
          completed_at: string | null
          created_at: string
          dedupe_key: string | null
          error: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          mission_id: string | null
          opportunity_id: string | null
          parent_job_id: string | null
          payload: Json
          priority: number
          requested_by: string | null
          requested_by_actor: Database["public"]["Enums"]["actor_type"]
          result_summary: string | null
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_key: string
          attempts?: number
          brand_id?: string | null
          code?: string
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          mission_id?: string | null
          opportunity_id?: string | null
          parent_job_id?: string | null
          payload?: Json
          priority?: number
          requested_by?: string | null
          requested_by_actor?: Database["public"]["Enums"]["actor_type"]
          result_summary?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_key?: string
          attempts?: number
          brand_id?: string | null
          code?: string
          completed_at?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          mission_id?: string | null
          opportunity_id?: string | null
          parent_job_id?: string | null
          payload?: Json
          priority?: number
          requested_by?: string | null
          requested_by_actor?: Database["public"]["Enums"]["actor_type"]
          result_summary?: string | null
          scheduled_at?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "research_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_parent_job_id_fkey"
            columns: ["parent_job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_outputs: {
        Row: {
          agent_key: string
          brand_id: string | null
          created_at: string
          data: Json
          id: string
          job_id: string
          opportunity_id: string | null
          output_type: string
          run_id: string
          schema_version: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_key: string
          brand_id?: string | null
          created_at?: string
          data: Json
          id?: string
          job_id: string
          opportunity_id?: string | null
          output_type: string
          run_id: string
          schema_version: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_key?: string
          brand_id?: string | null
          created_at?: string
          data?: Json
          id?: string
          job_id?: string
          opportunity_id?: string | null
          output_type?: string
          run_id?: string
          schema_version?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_outputs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outputs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outputs_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outputs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_outputs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          agent_key: string
          attempt: number
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error: string | null
          estimated_cost_usd: number
          id: string
          input: Json
          input_tokens: number | null
          job_id: string
          model: string
          output_tokens: number | null
          prompt_version: string
          provider: string
          raw_output: string | null
          schema_version: string
          sources: Json
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          temperature: number | null
          updated_at: string
          usage_is_estimated: boolean
          validation_errors: Json | null
          validation_retries: number
          workspace_id: string
        }
        Insert: {
          agent_key: string
          attempt?: number
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          estimated_cost_usd?: number
          id?: string
          input?: Json
          input_tokens?: number | null
          job_id: string
          model: string
          output_tokens?: number | null
          prompt_version: string
          provider: string
          raw_output?: string | null
          schema_version: string
          sources?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          temperature?: number | null
          updated_at?: string
          usage_is_estimated?: boolean
          validation_errors?: Json | null
          validation_retries?: number
          workspace_id: string
        }
        Update: {
          agent_key?: string
          attempt?: number
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error?: string | null
          estimated_cost_usd?: number
          id?: string
          input?: Json
          input_tokens?: number | null
          job_id?: string
          model?: string
          output_tokens?: number | null
          prompt_version?: string
          provider?: string
          raw_output?: string | null
          schema_version?: string
          sources?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          temperature?: number | null
          updated_at?: string
          usage_is_estimated?: boolean
          validation_errors?: Json | null
          validation_retries?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          created_at: string
          daily_cost_limit_usd: number
          daily_run_limit: number
          description: string
          enabled: boolean
          id: string
          key: string
          max_output_tokens: number | null
          model: string | null
          name: string
          phase: number
          provider: string | null
          temperature: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          daily_cost_limit_usd?: number
          daily_run_limit?: number
          description?: string
          enabled?: boolean
          id?: string
          key: string
          max_output_tokens?: number | null
          model?: string | null
          name: string
          phase?: number
          provider?: string | null
          temperature?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          daily_cost_limit_usd?: number
          daily_run_limit?: number
          description?: string
          enabled?: boolean
          id?: string
          key?: string
          max_output_tokens?: number | null
          model?: string | null
          name?: string
          phase?: number
          provider?: string | null
          temperature?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          gate_id: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          gate_id: string
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          gate_id?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_comments_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: false
            referencedRelation: "approval_gates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_comments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_gates: {
        Row: {
          brand_id: string | null
          code: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          gate_type: Database["public"]["Enums"]["approval_gate_type"]
          id: string
          job_id: string | null
          payload: Json
          requested_by: string | null
          requested_by_actor: Database["public"]["Enums"]["actor_type"]
          status: Database["public"]["Enums"]["approval_status"]
          subject_id: string
          subject_type: string
          summary: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id?: string | null
          code?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          gate_type: Database["public"]["Enums"]["approval_gate_type"]
          id?: string
          job_id?: string | null
          payload?: Json
          requested_by?: string | null
          requested_by_actor?: Database["public"]["Enums"]["actor_type"]
          status?: Database["public"]["Enums"]["approval_status"]
          subject_id: string
          subject_type: string
          summary?: string | null
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string | null
          code?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_reason?: string | null
          gate_type?: Database["public"]["Enums"]["approval_gate_type"]
          id?: string
          job_id?: string | null
          payload?: Json
          requested_by?: string | null
          requested_by_actor?: Database["public"]["Enums"]["actor_type"]
          status?: Database["public"]["Enums"]["approval_status"]
          subject_id?: string
          subject_type?: string
          summary?: string | null
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_gates_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_gates_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_gates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_gates_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_gates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          agent_key: string | null
          brand_id: string | null
          created_at: string
          id: string
          metadata: Json
          subject_id: string | null
          subject_type: string | null
          summary: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          agent_key?: string | null
          brand_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          subject_id?: string | null
          subject_type?: string | null
          summary: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          agent_key?: string | null
          brand_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          subject_id?: string | null
          subject_type?: string | null
          summary?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_brand_fk"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_decisions: {
        Row: {
          brand_id: string
          created_at: string
          decided_by: string | null
          decision: string
          experiment_id: string | null
          id: string
          reason: string
          source: Database["public"]["Enums"]["actor_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          decided_by?: string | null
          decision: string
          experiment_id?: string | null
          id?: string
          reason: string
          source?: Database["public"]["Enums"]["actor_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          decided_by?: string | null
          decision?: string
          experiment_id?: string | null
          id?: string
          reason?: string
          source?: Database["public"]["Enums"]["actor_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_decisions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_decisions_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_decisions_experiment_fk"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_decisions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_identity: {
        Row: {
          agent_run_id: string | null
          anti_positioning: string[]
          archetype: string | null
          audience: string
          brand_id: string
          brand_story: string | null
          colors: Json
          created_at: string
          emotional_appeal: string | null
          expansion_paths: string[]
          fonts: Json
          id: string
          is_demo: boolean
          logo_file_id: string | null
          positioning: string
          product_collection_ideas: string[]
          selected_direction: string | null
          status: string
          tagline: string | null
          tagline_candidates: string[]
          tone_of_voice: string | null
          updated_at: string
          version: number
          visual_directions: Json
          visual_territory: string | null
          workspace_id: string
        }
        Insert: {
          agent_run_id?: string | null
          anti_positioning?: string[]
          archetype?: string | null
          audience: string
          brand_id: string
          brand_story?: string | null
          colors?: Json
          created_at?: string
          emotional_appeal?: string | null
          expansion_paths?: string[]
          fonts?: Json
          id?: string
          is_demo?: boolean
          logo_file_id?: string | null
          positioning: string
          product_collection_ideas?: string[]
          selected_direction?: string | null
          status?: string
          tagline?: string | null
          tagline_candidates?: string[]
          tone_of_voice?: string | null
          updated_at?: string
          version?: number
          visual_directions?: Json
          visual_territory?: string | null
          workspace_id: string
        }
        Update: {
          agent_run_id?: string | null
          anti_positioning?: string[]
          archetype?: string | null
          audience?: string
          brand_id?: string
          brand_story?: string | null
          colors?: Json
          created_at?: string
          emotional_appeal?: string | null
          expansion_paths?: string[]
          fonts?: Json
          id?: string
          is_demo?: boolean
          logo_file_id?: string | null
          positioning?: string
          product_collection_ideas?: string[]
          selected_direction?: string | null
          status?: string
          tagline?: string | null
          tagline_candidates?: string[]
          tone_of_voice?: string | null
          updated_at?: string
          version?: number
          visual_directions?: Json
          visual_territory?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_identity_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_identity_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_identity_logo_file_id_fkey"
            columns: ["logo_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_identity_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_names: {
        Row: {
          agent_run_id: string | null
          brand_id: string
          collision_notes: string | null
          created_at: string
          expansion_potential: number | null
          id: string
          is_demo: boolean
          memorability: number | null
          name: string
          pronunciation_risk: Database["public"]["Enums"]["risk_level"]
          rationale: string
          spelling_risk: Database["public"]["Enums"]["risk_level"]
          status: Database["public"]["Enums"]["name_status"]
          trademark_notes: string | null
          trademark_risk: Database["public"]["Enums"]["risk_level"]
          updated_at: string
          visual_potential: number | null
          workspace_id: string
        }
        Insert: {
          agent_run_id?: string | null
          brand_id: string
          collision_notes?: string | null
          created_at?: string
          expansion_potential?: number | null
          id?: string
          is_demo?: boolean
          memorability?: number | null
          name: string
          pronunciation_risk?: Database["public"]["Enums"]["risk_level"]
          rationale?: string
          spelling_risk?: Database["public"]["Enums"]["risk_level"]
          status?: Database["public"]["Enums"]["name_status"]
          trademark_notes?: string | null
          trademark_risk?: Database["public"]["Enums"]["risk_level"]
          updated_at?: string
          visual_potential?: number | null
          workspace_id: string
        }
        Update: {
          agent_run_id?: string | null
          brand_id?: string
          collision_notes?: string | null
          created_at?: string
          expansion_potential?: number | null
          id?: string
          is_demo?: boolean
          memorability?: number | null
          name?: string
          pronunciation_risk?: Database["public"]["Enums"]["risk_level"]
          rationale?: string
          spelling_risk?: Database["public"]["Enums"]["risk_level"]
          status?: Database["public"]["Enums"]["name_status"]
          trademark_notes?: string | null
          trademark_risk?: Database["public"]["Enums"]["risk_level"]
          updated_at?: string
          visual_potential?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_names_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_names_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_names_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_products: {
        Row: {
          brand_id: string
          code: string
          collection_id: string | null
          compare_at_price: number | null
          created_at: string
          description: string | null
          design_id: string | null
          economics: Json
          id: string
          is_demo: boolean
          pricing_model_id: string | null
          promo_ends_at: string | null
          promo_price: number | null
          provider_product_id: string
          recommendation: string | null
          recommendation_reason: string | null
          retail_price: number
          slug: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          code?: string
          collection_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          design_id?: string | null
          economics?: Json
          id?: string
          is_demo?: boolean
          pricing_model_id?: string | null
          promo_ends_at?: string | null
          promo_price?: number | null
          provider_product_id: string
          recommendation?: string | null
          recommendation_reason?: string | null
          retail_price: number
          slug: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          code?: string
          collection_id?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          design_id?: string | null
          economics?: Json
          id?: string
          is_demo?: boolean
          pricing_model_id?: string | null
          promo_ends_at?: string | null
          promo_price?: number | null
          provider_product_id?: string
          recommendation?: string | null
          recommendation_reason?: string | null
          retail_price?: number
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_products_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "design_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_products_pricing_model_id_fkey"
            columns: ["pricing_model_id"]
            isOneToOne: false
            referencedRelation: "pricing_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_products_provider_product_id_fkey"
            columns: ["provider_product_id"]
            isOneToOne: false
            referencedRelation: "provider_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_stage_history: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          brand_id: string
          created_at: string
          from_stage: Database["public"]["Enums"]["brand_stage"] | null
          id: string
          reason: string | null
          to_stage: Database["public"]["Enums"]["brand_stage"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          brand_id: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["brand_stage"] | null
          id?: string
          reason?: string | null
          to_stage: Database["public"]["Enums"]["brand_stage"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          brand_id?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["brand_stage"] | null
          id?: string
          reason?: string | null
          to_stage?: Database["public"]["Enums"]["brand_stage"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_stage_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_stage_history_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_stage_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          audience: string | null
          code: string
          created_at: string
          created_by: string | null
          domain: string | null
          hypotheses: Json
          id: string
          is_demo: boolean
          niche: string
          official_name: string | null
          opportunity_id: string | null
          opportunity_thesis: string | null
          positioning: string | null
          research_summary: string | null
          risk_summary: string | null
          stage: Database["public"]["Enums"]["brand_stage"]
          sub_niche: string | null
          tagline: string | null
          trademark_notes: string | null
          updated_at: string
          voice: string | null
          working_title: string
          workspace_id: string
        }
        Insert: {
          audience?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          domain?: string | null
          hypotheses?: Json
          id?: string
          is_demo?: boolean
          niche: string
          official_name?: string | null
          opportunity_id?: string | null
          opportunity_thesis?: string | null
          positioning?: string | null
          research_summary?: string | null
          risk_summary?: string | null
          stage?: Database["public"]["Enums"]["brand_stage"]
          sub_niche?: string | null
          tagline?: string | null
          trademark_notes?: string | null
          updated_at?: string
          voice?: string | null
          working_title: string
          workspace_id: string
        }
        Update: {
          audience?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          domain?: string | null
          hypotheses?: Json
          id?: string
          is_demo?: boolean
          niche?: string
          official_name?: string | null
          opportunity_id?: string | null
          opportunity_thesis?: string | null
          positioning?: string | null
          research_summary?: string | null
          risk_summary?: string | null
          stage?: Database["public"]["Enums"]["brand_stage"]
          sub_niche?: string | null
          tagline?: string | null
          trademark_notes?: string | null
          updated_at?: string
          voice?: string | null
          working_title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          brand_product_id: string
          bundle_id: string
          created_at: string
          id: string
          quantity: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_product_id: string
          bundle_id: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_product_id?: string
          bundle_id?: string
          created_at?: string
          id?: string
          quantity?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_brand_product_id_fkey"
            columns: ["brand_product_id"]
            isOneToOne: false
            referencedRelation: "brand_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          brand_id: string
          bundle_price: number
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          bundle_price: number
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          bundle_price?: number
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          agent_run_id: string | null
          approved_budget_usd: number | null
          audience: string | null
          brand_id: string
          code: string
          created_at: string
          end_date: string | null
          id: string
          is_demo: boolean
          is_paid: boolean
          name: string
          objective: string | null
          platform: string
          proposed_budget_usd: number | null
          start_date: string | null
          status: string
          strategy: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_run_id?: string | null
          approved_budget_usd?: number | null
          audience?: string | null
          brand_id: string
          code?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_demo?: boolean
          is_paid?: boolean
          name: string
          objective?: string | null
          platform: string
          proposed_budget_usd?: number | null
          start_date?: string | null
          status?: string
          strategy?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_run_id?: string | null
          approved_budget_usd?: number | null
          audience?: string | null
          brand_id?: string
          code?: string
          created_at?: string
          end_date?: string | null
          id?: string
          is_demo?: boolean
          is_paid?: boolean
          name?: string
          objective?: string | null
          platform?: string
          proposed_budget_usd?: number | null
          start_date?: string | null
          status?: string
          strategy?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          id: string
          is_demo: boolean
          name: string
          slug: string
          sort_order: number
          status: string
          theme: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
          slug: string
          sort_order?: number
          status?: string
          theme?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          theme?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collections_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_issues: {
        Row: {
          action_required: string
          category: string
          created_at: string
          detected_issue: string
          evidence: string | null
          explanation: string
          id: string
          matched_term: string | null
          review_id: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          action_required: string
          category: string
          created_at?: string
          detected_issue: string
          evidence?: string | null
          explanation: string
          id?: string
          matched_term?: string | null
          review_id: string
          risk_level: Database["public"]["Enums"]["risk_level"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          action_required?: string
          category?: string
          created_at?: string
          detected_issue?: string
          evidence?: string | null
          explanation?: string
          id?: string
          matched_term?: string | null
          review_id?: string
          risk_level?: Database["public"]["Enums"]["risk_level"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_issues_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "compliance_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_issues_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_reviews: {
        Row: {
          agent_run_id: string | null
          brand_id: string | null
          created_at: string
          design_id: string | null
          disclaimer: string
          human_override: boolean
          id: string
          overridden_at: string | null
          overridden_by: string | null
          override_notes: string | null
          risk_level: Database["public"]["Enums"]["risk_level"]
          screening_method: string
          status: Database["public"]["Enums"]["compliance_status"]
          subject_id: string
          subject_type: string
          summary: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_run_id?: string | null
          brand_id?: string | null
          created_at?: string
          design_id?: string | null
          disclaimer?: string
          human_override?: boolean
          id?: string
          overridden_at?: string | null
          overridden_by?: string | null
          override_notes?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          screening_method?: string
          status?: Database["public"]["Enums"]["compliance_status"]
          subject_id: string
          subject_type: string
          summary?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_run_id?: string | null
          brand_id?: string | null
          created_at?: string
          design_id?: string | null
          disclaimer?: string
          human_override?: boolean
          id?: string
          overridden_at?: string | null
          overridden_by?: string | null
          override_notes?: string | null
          risk_level?: Database["public"]["Enums"]["risk_level"]
          screening_method?: string
          status?: Database["public"]["Enums"]["compliance_status"]
          subject_id?: string
          subject_type?: string
          summary?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_reviews_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_reviews_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_reviews_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "design_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_reviews_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_reviews_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          body: string
          brand_id: string
          campaign_id: string | null
          content_type: string
          created_at: string
          day_offset: number | null
          id: string
          platform: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body: string
          brand_id: string
          campaign_id?: string | null
          content_type: string
          created_at?: string
          day_offset?: number | null
          id?: string
          platform: string
          status?: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string
          brand_id?: string
          campaign_id?: string | null
          content_type?: string
          created_at?: string
          day_offset?: number | null
          id?: string
          platform?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      decision_rule_sets: {
        Row: {
          clone_min_ctr: number
          created_at: string
          id: string
          is_default: boolean
          iterate_min_ctr: number
          kill_max_contribution_margin: number
          kill_max_conversion_rate: number
          kill_max_ctr: number
          min_ad_spend_usd: number
          min_days_running: number
          min_impressions: number
          min_lift_for_winner: number
          min_purchases: number
          min_sessions: number
          name: string
          scale_min_contribution_margin: number
          scale_min_conversion_rate: number
          scale_min_roas: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          clone_min_ctr?: number
          created_at?: string
          id?: string
          is_default?: boolean
          iterate_min_ctr?: number
          kill_max_contribution_margin?: number
          kill_max_conversion_rate?: number
          kill_max_ctr?: number
          min_ad_spend_usd?: number
          min_days_running?: number
          min_impressions?: number
          min_lift_for_winner?: number
          min_purchases?: number
          min_sessions?: number
          name: string
          scale_min_contribution_margin?: number
          scale_min_conversion_rate?: number
          scale_min_roas?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          clone_min_ctr?: number
          created_at?: string
          id?: string
          is_default?: boolean
          iterate_min_ctr?: number
          kill_max_contribution_margin?: number
          kill_max_conversion_rate?: number
          kill_max_ctr?: number
          min_ad_spend_usd?: number
          min_days_running?: number
          min_impressions?: number
          min_lift_for_winner?: number
          min_purchases?: number
          min_sessions?: number
          name?: string
          scale_min_contribution_margin?: number
          scale_min_conversion_rate?: number
          scale_min_roas?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "decision_rule_sets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      design_assets: {
        Row: {
          created_at: string
          created_by: string | null
          design_id: string
          file_id: string | null
          id: string
          kind: string
          prompt: string | null
          provider: string | null
          revision: number
          source: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          design_id: string
          file_id?: string | null
          id?: string
          kind: string
          prompt?: string | null
          provider?: string | null
          revision?: number
          source?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          design_id?: string
          file_id?: string | null
          id?: string
          kind?: string
          prompt?: string | null
          provider?: string | null
          revision?: number
          source?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_assets_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "design_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_assets_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      design_concepts: {
        Row: {
          agent_run_id: string | null
          back_placement: string | null
          brand_id: string
          code: string
          collection_id: string | null
          colors: string[]
          compliance_status: Database["public"]["Enums"]["compliance_status"]
          concept: string
          created_at: string
          current_revision: number
          embroidery_suitability: number | null
          front_placement: string | null
          generation_prompt: string | null
          id: string
          illustration_notes: string | null
          is_demo: boolean
          liquid_3d_suitability: number | null
          mockup_prompt: string | null
          parent_design_id: string | null
          preferred_products: string[]
          printing_method: string | null
          sleeve_placement: string | null
          status: Database["public"]["Enums"]["design_status"]
          target_buyer: string | null
          title: string
          typography: string | null
          updated_at: string
          visual_direction: string | null
          workspace_id: string
        }
        Insert: {
          agent_run_id?: string | null
          back_placement?: string | null
          brand_id: string
          code?: string
          collection_id?: string | null
          colors?: string[]
          compliance_status?: Database["public"]["Enums"]["compliance_status"]
          concept: string
          created_at?: string
          current_revision?: number
          embroidery_suitability?: number | null
          front_placement?: string | null
          generation_prompt?: string | null
          id?: string
          illustration_notes?: string | null
          is_demo?: boolean
          liquid_3d_suitability?: number | null
          mockup_prompt?: string | null
          parent_design_id?: string | null
          preferred_products?: string[]
          printing_method?: string | null
          sleeve_placement?: string | null
          status?: Database["public"]["Enums"]["design_status"]
          target_buyer?: string | null
          title: string
          typography?: string | null
          updated_at?: string
          visual_direction?: string | null
          workspace_id: string
        }
        Update: {
          agent_run_id?: string | null
          back_placement?: string | null
          brand_id?: string
          code?: string
          collection_id?: string | null
          colors?: string[]
          compliance_status?: Database["public"]["Enums"]["compliance_status"]
          concept?: string
          created_at?: string
          current_revision?: number
          embroidery_suitability?: number | null
          front_placement?: string | null
          generation_prompt?: string | null
          id?: string
          illustration_notes?: string | null
          is_demo?: boolean
          liquid_3d_suitability?: number | null
          mockup_prompt?: string | null
          parent_design_id?: string | null
          preferred_products?: string[]
          printing_method?: string | null
          sleeve_placement?: string | null
          status?: Database["public"]["Enums"]["design_status"]
          target_buyer?: string | null
          title?: string
          typography?: string | null
          updated_at?: string
          visual_direction?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_concepts_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_concepts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_concepts_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_concepts_parent_design_id_fkey"
            columns: ["parent_design_id"]
            isOneToOne: false
            referencedRelation: "design_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_concepts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      design_revisions: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          change_notes: string | null
          created_at: string
          design_id: string
          id: string
          revision_number: number
          snapshot: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          change_notes?: string | null
          created_at?: string
          design_id: string
          id?: string
          revision_number: number
          snapshot: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          change_notes?: string | null
          created_at?: string
          design_id?: string
          id?: string
          revision_number?: number
          snapshot?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_revisions_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_revisions_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "design_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_revisions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          availability: Database["public"]["Enums"]["availability_status"]
          brand_id: string
          brand_name_id: string | null
          check_method: string | null
          checked_at: string | null
          created_at: string
          domain: string
          id: string
          notes: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability_status"]
          brand_id: string
          brand_name_id?: string | null
          check_method?: string | null
          checked_at?: string | null
          created_at?: string
          domain: string
          id?: string
          notes?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability_status"]
          brand_id?: string
          brand_name_id?: string | null
          check_method?: string | null
          checked_at?: string | null
          created_at?: string
          domain?: string
          id?: string
          notes?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_brand_name_id_fkey"
            columns: ["brand_name_id"]
            isOneToOne: false
            referencedRelation: "brand_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "domains_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_metrics: {
        Row: {
          ad_spend: number
          add_to_carts: number
          checkouts: number
          clicks: number
          cogs: number
          created_at: string
          discounts: number
          experiment_id: string
          fulfillment_cost: number
          gross_revenue: number
          id: string
          import_batch_id: string | null
          impressions: number
          is_demo: boolean
          metric_date: string
          product_views: number
          purchases: number
          refunds: number
          repeat_buyers: number
          sessions: number
          shipping_subsidy: number
          source: string
          updated_at: string
          variant_id: string
          workspace_id: string
        }
        Insert: {
          ad_spend?: number
          add_to_carts?: number
          checkouts?: number
          clicks?: number
          cogs?: number
          created_at?: string
          discounts?: number
          experiment_id: string
          fulfillment_cost?: number
          gross_revenue?: number
          id?: string
          import_batch_id?: string | null
          impressions?: number
          is_demo?: boolean
          metric_date: string
          product_views?: number
          purchases?: number
          refunds?: number
          repeat_buyers?: number
          sessions?: number
          shipping_subsidy?: number
          source?: string
          updated_at?: string
          variant_id: string
          workspace_id: string
        }
        Update: {
          ad_spend?: number
          add_to_carts?: number
          checkouts?: number
          clicks?: number
          cogs?: number
          created_at?: string
          discounts?: number
          experiment_id?: string
          fulfillment_cost?: number
          gross_revenue?: number
          id?: string
          import_batch_id?: string | null
          impressions?: number
          is_demo?: boolean
          metric_date?: string
          product_views?: number
          purchases?: number
          refunds?: number
          repeat_buyers?: number
          sessions?: number
          shipping_subsidy?: number
          source?: string
          updated_at?: string
          variant_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_metrics_batch_fk"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_metrics_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_metrics_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "experiment_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      experiment_variants: {
        Row: {
          created_at: string
          description: string | null
          experiment_id: string
          id: string
          is_control: boolean
          key: string
          name: string
          reference_id: string | null
          reference_type: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          experiment_id: string
          id?: string
          is_control?: boolean
          key: string
          name: string
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          experiment_id?: string
          id?: string
          is_control?: boolean
          key?: string
          name?: string
          reference_id?: string | null
          reference_type?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiment_variants_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiment_variants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      experiments: {
        Row: {
          brand_id: string
          campaign_id: string | null
          code: string
          created_at: string
          created_by: string | null
          decided_at: string | null
          decision: string | null
          decision_details: Json
          decision_reasons: Json
          decision_rule_set_id: string | null
          end_date: string | null
          experiment_type: string
          hypothesis: string
          id: string
          is_demo: boolean
          minimum_sample: number
          name: string
          overridden_at: string | null
          overridden_by: string | null
          override_decision: string | null
          override_reason: string | null
          primary_metric: string
          start_date: string | null
          status: string
          updated_at: string
          winning_variant_id: string | null
          workspace_id: string
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decision?: string | null
          decision_details?: Json
          decision_reasons?: Json
          decision_rule_set_id?: string | null
          end_date?: string | null
          experiment_type: string
          hypothesis: string
          id?: string
          is_demo?: boolean
          minimum_sample?: number
          name: string
          overridden_at?: string | null
          overridden_by?: string | null
          override_decision?: string | null
          override_reason?: string | null
          primary_metric: string
          start_date?: string | null
          status?: string
          updated_at?: string
          winning_variant_id?: string | null
          workspace_id: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          decided_at?: string | null
          decision?: string | null
          decision_details?: Json
          decision_reasons?: Json
          decision_rule_set_id?: string | null
          end_date?: string | null
          experiment_type?: string
          hypothesis?: string
          id?: string
          is_demo?: boolean
          minimum_sample?: number
          name?: string
          overridden_at?: string | null
          overridden_by?: string | null
          override_decision?: string | null
          override_reason?: string | null
          primary_metric?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          winning_variant_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "experiments_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_decision_rule_set_id_fkey"
            columns: ["decision_rule_set_id"]
            isOneToOne: false
            referencedRelation: "decision_rule_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_winner_fk"
            columns: ["winning_variant_id"]
            isOneToOne: false
            referencedRelation: "experiment_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experiments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          brand_id: string | null
          bucket: string
          created_at: string
          id: string
          kind: string
          mime_type: string
          name: string
          path: string
          size_bytes: number
          updated_at: string
          uploaded_by: string | null
          uploaded_by_actor: Database["public"]["Enums"]["actor_type"]
          workspace_id: string
        }
        Insert: {
          brand_id?: string | null
          bucket?: string
          created_at?: string
          id?: string
          kind?: string
          mime_type: string
          name: string
          path: string
          size_bytes: number
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_actor?: Database["public"]["Enums"]["actor_type"]
          workspace_id: string
        }
        Update: {
          brand_id?: string | null
          bucket?: string
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string
          name?: string
          path?: string
          size_bytes?: number
          updated_at?: string
          uploaded_by?: string | null
          uploaded_by_actor?: Database["public"]["Enums"]["actor_type"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_brand_fk"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_metrics: {
        Row: {
          ad_spend: number
          brand_id: string
          cogs: number
          contribution_profit: number
          created_at: string
          decoration_cost: number
          discounts: number
          fulfillment_fees: number
          gross_profit: number
          id: string
          is_demo: boolean
          metric_date: string
          net_sales: number
          orders: number
          payment_processing: number
          platform_fees: number
          refund_reserve: number
          refunds: number
          revenue: number
          sessions: number
          shipping_cost: number
          shipping_paid: number
          shipping_subsidy: number
          source: string
          units: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_spend?: number
          brand_id: string
          cogs?: number
          contribution_profit?: number
          created_at?: string
          decoration_cost?: number
          discounts?: number
          fulfillment_fees?: number
          gross_profit?: number
          id?: string
          is_demo?: boolean
          metric_date: string
          net_sales?: number
          orders?: number
          payment_processing?: number
          platform_fees?: number
          refund_reserve?: number
          refunds?: number
          revenue?: number
          sessions?: number
          shipping_cost?: number
          shipping_paid?: number
          shipping_subsidy?: number
          source?: string
          units?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_spend?: number
          brand_id?: string
          cogs?: number
          contribution_profit?: number
          created_at?: string
          decoration_cost?: number
          discounts?: number
          fulfillment_fees?: number
          gross_profit?: number
          id?: string
          is_demo?: boolean
          metric_date?: string
          net_sales?: number
          orders?: number
          payment_processing?: number
          platform_fees?: number
          refund_reserve?: number
          refunds?: number
          revenue?: number
          sessions?: number
          shipping_cost?: number
          shipping_paid?: number
          shipping_subsidy?: number
          source?: string
          units?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_metrics_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_metrics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fulfillment_providers: {
        Row: {
          adapter: string
          config: Json
          created_at: string
          id: string
          key: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          adapter: string
          config?: Json
          created_at?: string
          id?: string
          key: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          adapter?: string
          config?: Json
          created_at?: string
          id?: string
          key?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulfillment_providers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      id_counters: {
        Row: {
          last_value: number
          prefix: string
          workspace_id: string
        }
        Insert: {
          last_value?: number
          prefix: string
          workspace_id: string
        }
        Update: {
          last_value?: number
          prefix?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "id_counters_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          brand_id: string | null
          created_at: string
          created_by: string | null
          error_rows: number
          errors: Json
          filename: string
          id: string
          imported_rows: number
          kind: string
          mapping: Json
          status: string
          total_rows: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          error_rows?: number
          errors?: Json
          filename: string
          id?: string
          imported_rows?: number
          kind: string
          mapping?: Json
          status?: string
          total_rows?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          created_by?: string | null
          error_rows?: number
          errors?: Json
          filename?: string
          id?: string
          imported_rows?: number
          kind?: string
          mapping?: Json
          status?: string
          total_rows?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      insights: {
        Row: {
          body: string
          brand_id: string | null
          brand_product_id: string | null
          claim_type: string
          code: string
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          created_by: string | null
          design_id: string | null
          evidence_summary: string | null
          experiment_id: string | null
          id: string
          is_demo: boolean
          sample_size: number | null
          source: Database["public"]["Enums"]["actor_type"]
          status: string
          tags: string[]
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body: string
          brand_id?: string | null
          brand_product_id?: string | null
          claim_type?: string
          code?: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          created_by?: string | null
          design_id?: string | null
          evidence_summary?: string | null
          experiment_id?: string | null
          id?: string
          is_demo?: boolean
          sample_size?: number | null
          source?: Database["public"]["Enums"]["actor_type"]
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string
          brand_id?: string | null
          brand_product_id?: string | null
          claim_type?: string
          code?: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          created_by?: string | null
          design_id?: string | null
          evidence_summary?: string | null
          experiment_id?: string | null
          id?: string
          is_demo?: boolean
          sample_size?: number | null
          source?: Database["public"]["Enums"]["actor_type"]
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_brand_product_id_fkey"
            columns: ["brand_product_id"]
            isOneToOne: false
            referencedRelation: "brand_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "design_concepts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_experiment_id_fkey"
            columns: ["experiment_id"]
            isOneToOne: false
            referencedRelation: "experiments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insights_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          author_id: string | null
          body: string
          brand_id: string | null
          created_at: string
          id: string
          subject_id: string | null
          subject_type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          brand_id?: string | null
          created_at?: string
          id?: string
          subject_id?: string | null
          subject_type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          brand_id?: string | null
          created_at?: string
          id?: string
          subject_id?: string | null
          subject_type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_brand_fk"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          brand_id: string | null
          created_at: string
          id: string
          link: string | null
          read_at: string | null
          severity: string
          title: string
          type: string
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string | null
          brand_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          title: string
          type: string
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string | null
          brand_id?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read_at?: string | null
          severity?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_brand_fk"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunities: {
        Row: {
          audience: string | null
          biggest_risk: string | null
          brand_id: string | null
          code: string
          confidence: Database["public"]["Enums"]["confidence_level"] | null
          created_at: string
          created_by: string | null
          cultural_risk_notes: string | null
          geographic_notes: string | null
          hypothesis: string | null
          id: string
          ip_risk_notes: string | null
          is_demo: boolean
          mission_id: string | null
          niche: string
          niche_key: string
          recommended_brand_angle: string | null
          recommended_customer: string | null
          recommended_first_products: string[]
          recommended_test_strategy: string | null
          rejected_reason: string | null
          research_mode: string | null
          researched_at: string | null
          seasonality: string | null
          status: Database["public"]["Enums"]["opportunity_status"]
          strongest_evidence: string[]
          strongest_risks: string[]
          strongest_signal: string | null
          suggested_sub_niches: string[]
          summary: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          audience?: string | null
          biggest_risk?: string | null
          brand_id?: string | null
          code?: string
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          created_by?: string | null
          cultural_risk_notes?: string | null
          geographic_notes?: string | null
          hypothesis?: string | null
          id?: string
          ip_risk_notes?: string | null
          is_demo?: boolean
          mission_id?: string | null
          niche: string
          niche_key: string
          recommended_brand_angle?: string | null
          recommended_customer?: string | null
          recommended_first_products?: string[]
          recommended_test_strategy?: string | null
          rejected_reason?: string | null
          research_mode?: string | null
          researched_at?: string | null
          seasonality?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          strongest_evidence?: string[]
          strongest_risks?: string[]
          strongest_signal?: string | null
          suggested_sub_niches?: string[]
          summary?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          audience?: string | null
          biggest_risk?: string | null
          brand_id?: string | null
          code?: string
          confidence?: Database["public"]["Enums"]["confidence_level"] | null
          created_at?: string
          created_by?: string | null
          cultural_risk_notes?: string | null
          geographic_notes?: string | null
          hypothesis?: string | null
          id?: string
          ip_risk_notes?: string | null
          is_demo?: boolean
          mission_id?: string | null
          niche?: string
          niche_key?: string
          recommended_brand_angle?: string | null
          recommended_customer?: string | null
          recommended_first_products?: string[]
          recommended_test_strategy?: string | null
          rejected_reason?: string | null
          research_mode?: string | null
          researched_at?: string | null
          seasonality?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          strongest_evidence?: string[]
          strongest_risks?: string[]
          strongest_signal?: string | null
          suggested_sub_niches?: string[]
          summary?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunities_brand_fk"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "research_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_scores: {
        Row: {
          created_at: string
          dimension: string
          evidence_kind: Database["public"]["Enums"]["evidence_kind"]
          explanation: string
          id: string
          opportunity_id: string
          score: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          dimension: string
          evidence_kind?: Database["public"]["Enums"]["evidence_kind"]
          explanation: string
          id?: string
          opportunity_id: string
          score: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          dimension?: string
          evidence_kind?: Database["public"]["Enums"]["evidence_kind"]
          explanation?: string
          id?: string
          opportunity_id?: string
          score?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_scores_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "opportunity_scores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_import: {
        Row: {
          ad_attribution: number
          brand_id: string
          brand_product_id: string | null
          channel: string | null
          cogs: number
          created_at: string
          decoration_cost: number
          discount: number
          external_order_id: string
          fulfillment_fee: number
          id: string
          import_batch_id: string | null
          is_demo: boolean
          order_date: string
          payment_processing: number
          platform_fee: number
          product_title: string | null
          quantity: number
          refunds: number
          revenue: number
          shipping_cost: number
          shipping_paid: number
          sku: string | null
          store_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ad_attribution?: number
          brand_id: string
          brand_product_id?: string | null
          channel?: string | null
          cogs?: number
          created_at?: string
          decoration_cost?: number
          discount?: number
          external_order_id: string
          fulfillment_fee?: number
          id?: string
          import_batch_id?: string | null
          is_demo?: boolean
          order_date: string
          payment_processing?: number
          platform_fee?: number
          product_title?: string | null
          quantity?: number
          refunds?: number
          revenue?: number
          shipping_cost?: number
          shipping_paid?: number
          sku?: string | null
          store_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ad_attribution?: number
          brand_id?: string
          brand_product_id?: string | null
          channel?: string | null
          cogs?: number
          created_at?: string
          decoration_cost?: number
          discount?: number
          external_order_id?: string
          fulfillment_fee?: number
          id?: string
          import_batch_id?: string | null
          is_demo?: boolean
          order_date?: string
          payment_processing?: number
          platform_fee?: number
          product_title?: string | null
          quantity?: number
          refunds?: number
          revenue?: number
          shipping_cost?: number
          shipping_paid?: number
          sku?: string | null
          store_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_import_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_import_brand_product_id_fkey"
            columns: ["brand_product_id"]
            isOneToOne: false
            referencedRelation: "brand_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_import_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_import_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_import_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_models: {
        Row: {
          brand_id: string | null
          created_at: string
          free_shipping_threshold: number | null
          id: string
          is_default: boolean
          min_gross_margin: number
          name: string
          payment_processing_fixed: number
          payment_processing_pct: number
          platform_fee_pct: number
          quantity_discounts: Json
          refund_reserve_pct: number
          shipping_charged: number
          target_cac: number
          target_contribution_margin: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          free_shipping_threshold?: number | null
          id?: string
          is_default?: boolean
          min_gross_margin?: number
          name: string
          payment_processing_fixed?: number
          payment_processing_pct?: number
          platform_fee_pct?: number
          quantity_discounts?: Json
          refund_reserve_pct?: number
          shipping_charged?: number
          target_cac?: number
          target_contribution_margin?: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          free_shipping_threshold?: number | null
          id?: string
          is_default?: boolean
          min_gross_margin?: number
          name?: string
          payment_processing_fixed?: number
          payment_processing_pct?: number
          platform_fee_pct?: number
          quantity_discounts?: Json
          refund_reserve_pct?: number
          shipping_charged?: number
          target_cac?: number
          target_contribution_margin?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pricing_models_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          available: boolean
          blank_cost_override: number | null
          color: string | null
          created_at: string
          id: string
          provider_product_id: string
          size: string | null
          updated_at: string
          variant_sku: string
          workspace_id: string
        }
        Insert: {
          available?: boolean
          blank_cost_override?: number | null
          color?: string | null
          created_at?: string
          id?: string
          provider_product_id: string
          size?: string | null
          updated_at?: string
          variant_sku: string
          workspace_id: string
        }
        Update: {
          available?: boolean
          blank_cost_override?: number | null
          color?: string | null
          created_at?: string
          id?: string
          provider_product_id?: string
          size?: string | null
          updated_at?: string
          variant_sku?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_provider_product_id_fkey"
            columns: ["provider_product_id"]
            isOneToOne: false
            referencedRelation: "provider_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_credentials: {
        Row: {
          ciphertext: string
          created_at: string
          created_by: string | null
          hint: string | null
          id: string
          label: string
          provider_key: string
          provider_kind: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          ciphertext: string
          created_at?: string
          created_by?: string | null
          hint?: string | null
          id?: string
          label: string
          provider_key: string
          provider_kind: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          ciphertext?: string
          created_at?: string
          created_by?: string | null
          hint?: string | null
          id?: string
          label?: string
          provider_key?: string
          provider_kind?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_credentials_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_credentials_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_products: {
        Row: {
          active: boolean
          available_colors: string[]
          available_sizes: string[]
          blank_brand: string | null
          blank_cost: number
          blank_name: string
          created_at: string
          decoration_cost: number
          decoration_method: string
          fulfillment_fee: number
          id: string
          inventory_mode: string
          is_demo: boolean
          metadata: Json
          product_images: string[]
          product_type: string
          production_sla_days: number | null
          provider_id: string
          provider_sku: string
          shipping_estimate_domestic: number | null
          shipping_estimate_international: number | null
          source: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          available_colors?: string[]
          available_sizes?: string[]
          blank_brand?: string | null
          blank_cost: number
          blank_name: string
          created_at?: string
          decoration_cost?: number
          decoration_method?: string
          fulfillment_fee?: number
          id?: string
          inventory_mode?: string
          is_demo?: boolean
          metadata?: Json
          product_images?: string[]
          product_type: string
          production_sla_days?: number | null
          provider_id: string
          provider_sku: string
          shipping_estimate_domestic?: number | null
          shipping_estimate_international?: number | null
          source?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          available_colors?: string[]
          available_sizes?: string[]
          blank_brand?: string | null
          blank_cost?: number
          blank_name?: string
          created_at?: string
          decoration_cost?: number
          decoration_method?: string
          fulfillment_fee?: number
          id?: string
          inventory_mode?: string
          is_demo?: boolean
          metadata?: Json
          product_images?: string[]
          product_type?: string
          production_sla_days?: number | null
          provider_id?: string
          provider_sku?: string
          shipping_estimate_domestic?: number | null
          shipping_estimate_international?: number | null
          source?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_products_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "fulfillment_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      research_missions: {
        Row: {
          brand_id: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_demo: boolean
          job_id: string | null
          max_candidates: number
          mission_type: string
          opportunities_found: number
          prompt: string
          research_depth: number
          status: Database["public"]["Enums"]["mission_status"]
          title: string
          trend_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          job_id?: string | null
          max_candidates?: number
          mission_type?: string
          opportunities_found?: number
          prompt: string
          research_depth?: number
          status?: Database["public"]["Enums"]["mission_status"]
          title: string
          trend_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_demo?: boolean
          job_id?: string | null
          max_candidates?: number
          mission_type?: string
          opportunities_found?: number
          prompt?: string
          research_depth?: number
          status?: Database["public"]["Enums"]["mission_status"]
          title?: string
          trend_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_missions_brand_fk"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_missions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_missions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "agent_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_missions_trend_fk"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "trends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_missions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      research_reports: {
        Row: {
          agent_run_id: string | null
          brand_id: string | null
          created_at: string
          id: string
          is_demo: boolean
          mission_id: string | null
          opportunity_id: string | null
          report_type: string
          research_mode: string
          snapshot: Json
          summary: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          agent_run_id?: string | null
          brand_id?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          mission_id?: string | null
          opportunity_id?: string | null
          report_type?: string
          research_mode?: string
          snapshot?: Json
          summary: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          agent_run_id?: string | null
          brand_id?: string | null
          created_at?: string
          id?: string
          is_demo?: boolean
          mission_id?: string | null
          opportunity_id?: string | null
          report_type?: string
          research_mode?: string
          snapshot?: Json
          summary?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_reports_brand_fk"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_reports_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "research_missions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_reports_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_reports_run_fk"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      research_sources: {
        Row: {
          brand_id: string | null
          claim: string
          confidence: Database["public"]["Enums"]["confidence_level"]
          created_at: string
          evidence_kind: Database["public"]["Enums"]["evidence_kind"]
          id: string
          is_demo: boolean
          opportunity_id: string | null
          published_at: string | null
          publisher: string | null
          quote_snippet: string | null
          report_id: string | null
          retrieved_at: string | null
          source_title: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          source_url: string | null
          trend_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id?: string | null
          claim: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          evidence_kind: Database["public"]["Enums"]["evidence_kind"]
          id?: string
          is_demo?: boolean
          opportunity_id?: string | null
          published_at?: string | null
          publisher?: string | null
          quote_snippet?: string | null
          report_id?: string | null
          retrieved_at?: string | null
          source_title?: string | null
          source_type: Database["public"]["Enums"]["source_type"]
          source_url?: string | null
          trend_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string | null
          claim?: string
          confidence?: Database["public"]["Enums"]["confidence_level"]
          created_at?: string
          evidence_kind?: Database["public"]["Enums"]["evidence_kind"]
          id?: string
          is_demo?: boolean
          opportunity_id?: string | null
          published_at?: string | null
          publisher?: string | null
          quote_snippet?: string | null
          report_id?: string | null
          retrieved_at?: string | null
          source_title?: string | null
          source_type?: Database["public"]["Enums"]["source_type"]
          source_url?: string | null
          trend_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "research_sources_brand_fk"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_sources_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_sources_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "research_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_sources_trend_fk"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "trends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "research_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      social_handles: {
        Row: {
          availability: Database["public"]["Enums"]["availability_status"]
          brand_id: string
          brand_name_id: string | null
          checked_at: string | null
          created_at: string
          handle: string
          id: string
          notes: string | null
          platform: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          availability?: Database["public"]["Enums"]["availability_status"]
          brand_id: string
          brand_name_id?: string | null
          checked_at?: string | null
          created_at?: string
          handle: string
          id?: string
          notes?: string | null
          platform: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          availability?: Database["public"]["Enums"]["availability_status"]
          brand_id?: string
          brand_name_id?: string | null
          checked_at?: string | null
          created_at?: string
          handle?: string
          id?: string
          notes?: string | null
          platform?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_handles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_handles_brand_name_id_fkey"
            columns: ["brand_name_id"]
            isOneToOne: false
            referencedRelation: "brand_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_handles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      store_collections: {
        Row: {
          collection_id: string | null
          created_at: string
          description: string | null
          id: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          store_id: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          collection_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          store_id: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          collection_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          store_id?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_collections_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_collections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_collections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      store_pages: {
        Row: {
          created_at: string
          id: string
          is_placeholder: boolean
          page_type: string
          sections: Json
          seo_description: string | null
          seo_title: string | null
          slug: string
          store_id: string
          title: string
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_placeholder?: boolean
          page_type: string
          sections?: Json
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          store_id: string
          title: string
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_placeholder?: boolean
          page_type?: string
          sections?: Json
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          store_id?: string
          title?: string
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_pages_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_pages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      store_products: {
        Row: {
          badges: string[]
          brand_product_id: string
          bullet_points: string[]
          compare_at_price: number | null
          created_at: string
          cross_sell_product_ids: string[]
          description: string
          id: string
          price: number
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          store_collection_id: string | null
          store_id: string
          title: string
          updated_at: string
          upsell_product_ids: string[]
          workspace_id: string
        }
        Insert: {
          badges?: string[]
          brand_product_id: string
          bullet_points?: string[]
          compare_at_price?: number | null
          created_at?: string
          cross_sell_product_ids?: string[]
          description?: string
          id?: string
          price: number
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          store_collection_id?: string | null
          store_id: string
          title: string
          updated_at?: string
          upsell_product_ids?: string[]
          workspace_id: string
        }
        Update: {
          badges?: string[]
          brand_product_id?: string
          bullet_points?: string[]
          compare_at_price?: number | null
          created_at?: string
          cross_sell_product_ids?: string[]
          description?: string
          id?: string
          price?: number
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          store_collection_id?: string | null
          store_id?: string
          title?: string
          updated_at?: string
          upsell_product_ids?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_products_brand_product_id_fkey"
            columns: ["brand_product_id"]
            isOneToOne: false
            referencedRelation: "brand_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_collection_id_fkey"
            columns: ["store_collection_id"]
            isOneToOne: false
            referencedRelation: "store_collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          agent_run_id: string | null
          announcement: string | null
          brand_id: string
          cart_strategy: Json
          code: string
          created_at: string
          domain: string | null
          email_capture: Json
          external_id: string | null
          id: string
          is_demo: boolean
          launch_approved_at: string | null
          name: string
          navigation: Json
          provider: string
          seo_description: string | null
          seo_title: string | null
          status: string
          theme: Json
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          agent_run_id?: string | null
          announcement?: string | null
          brand_id: string
          cart_strategy?: Json
          code?: string
          created_at?: string
          domain?: string | null
          email_capture?: Json
          external_id?: string | null
          id?: string
          is_demo?: boolean
          launch_approved_at?: string | null
          name: string
          navigation?: Json
          provider?: string
          seo_description?: string | null
          seo_title?: string | null
          status?: string
          theme?: Json
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          agent_run_id?: string | null
          announcement?: string | null
          brand_id?: string
          cart_strategy?: Json
          code?: string
          created_at?: string
          domain?: string | null
          email_capture?: Json
          external_id?: string | null
          id?: string
          is_demo?: boolean
          launch_approved_at?: string | null
          name?: string
          navigation?: Json
          provider?: string
          seo_description?: string | null
          seo_title?: string | null
          status?: string
          theme?: Json
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      trend_opportunities: {
        Row: {
          created_at: string
          id: string
          opportunity_id: string
          trend_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          opportunity_id: string
          trend_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          opportunity_id?: string
          trend_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trend_opportunities_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_opportunities_trend_id_fkey"
            columns: ["trend_id"]
            isOneToOne: false
            referencedRelation: "trends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trend_opportunities_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      trends: {
        Row: {
          agent_run_id: string | null
          category: string
          code: string
          created_at: string
          detected_at: string
          estimated_lifespan: string
          id: string
          is_demo: boolean
          name: string
          pod_relevance: number | null
          recommended_action: string | null
          research_mode: string
          status: string
          summary: string | null
          updated_at: string
          velocity: string
          workspace_id: string
        }
        Insert: {
          agent_run_id?: string | null
          category: string
          code?: string
          created_at?: string
          detected_at?: string
          estimated_lifespan?: string
          id?: string
          is_demo?: boolean
          name: string
          pod_relevance?: number | null
          recommended_action?: string | null
          research_mode?: string
          status?: string
          summary?: string | null
          updated_at?: string
          velocity?: string
          workspace_id: string
        }
        Update: {
          agent_run_id?: string | null
          category?: string
          code?: string
          created_at?: string
          detected_at?: string
          estimated_lifespan?: string
          id?: string
          is_demo?: boolean
          name?: string
          pod_relevance?: number | null
          recommended_action?: string | null
          research_mode?: string
          status?: string
          summary?: string | null
          updated_at?: string
          velocity?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trends_agent_run_id_fkey"
            columns: ["agent_run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trends_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          ai_default_model: string | null
          ai_provider: string | null
          created_at: string
          created_by: string | null
          daily_ai_budget_usd: number
          id: string
          max_candidates: number
          max_research_depth: number
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          ai_default_model?: string | null
          ai_provider?: string | null
          created_at?: string
          created_by?: string | null
          daily_ai_budget_usd?: number
          id?: string
          max_candidates?: number
          max_research_depth?: number
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          ai_default_model?: string | null
          ai_provider?: string | null
          created_at?: string
          created_by?: string | null
          daily_ai_budget_usd?: number
          id?: string
          max_candidates?: number
          max_research_depth?: number
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      brand_stage_transition_kind: {
        Args: {
          from_stage: Database["public"]["Enums"]["brand_stage"]
          to_stage: Database["public"]["Enums"]["brand_stage"]
        }
        Returns: string
      }
      claim_agent_job: {
        Args: { target_job?: string; target_workspace?: string; worker: string }
        Returns: {
          agent_key: string
          attempts: number
          brand_id: string | null
          code: string
          completed_at: string | null
          created_at: string
          dedupe_key: string | null
          error: string | null
          id: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          mission_id: string | null
          opportunity_id: string | null
          parent_job_id: string | null
          payload: Json
          priority: number
          requested_by: string | null
          requested_by_actor: Database["public"]["Enums"]["actor_type"]
          result_summary: string | null
          scheduled_at: string
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          type: string
          updated_at: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "agent_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      consume_rate_limit: {
        Args: { bucket: string; max_hits: number; window_seconds: number }
        Returns: boolean
      }
      create_workspace: {
        Args: { p_name: string; p_slug: string }
        Returns: {
          ai_default_model: string | null
          ai_provider: string | null
          created_at: string
          created_by: string | null
          daily_ai_budget_usd: number
          id: string
          max_candidates: number
          max_research_depth: number
          name: string
          slug: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      decide_approval_gate: {
        Args: {
          p_decision: Database["public"]["Enums"]["approval_status"]
          p_gate_id: string
          p_reason?: string
        }
        Returns: {
          brand_id: string | null
          code: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_reason: string | null
          gate_type: Database["public"]["Enums"]["approval_gate_type"]
          id: string
          job_id: string | null
          payload: Json
          requested_by: string | null
          requested_by_actor: Database["public"]["Enums"]["actor_type"]
          status: Database["public"]["Enums"]["approval_status"]
          subject_id: string
          subject_type: string
          summary: string | null
          title: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "approval_gates"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      format_code: { Args: { n: number; prefix: string }; Returns: string }
      gate_min_role: {
        Args: { g: Database["public"]["Enums"]["approval_gate_type"] }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
      gate_move_brand: {
        Args: {
          p_brand: string
          p_reason: string
          p_to: Database["public"]["Enums"]["brand_stage"]
        }
        Returns: undefined
      }
      has_workspace_role: {
        Args: {
          min_role: Database["public"]["Enums"]["workspace_role"]
          ws: string
        }
        Returns: boolean
      }
      in_gate_context: { Args: never; Returns: boolean }
      is_workspace_member: { Args: { ws: string }; Returns: boolean }
      next_code: { Args: { code_prefix: string; ws: string }; Returns: string }
      recover_stale_agent_jobs: {
        Args: { stale_after_seconds?: number }
        Returns: number
      }
      search_workspace: {
        Args: { p_query: string; p_workspace: string }
        Returns: {
          brand_id: string
          code: string
          id: string
          kind: string
          subtitle: string
          title: string
        }[]
      }
      storage_workspace_id: { Args: { object_name: string }; Returns: string }
      workspace_role_rank: {
        Args: { r: Database["public"]["Enums"]["workspace_role"] }
        Returns: number
      }
    }
    Enums: {
      actor_type: "human" | "agent" | "system"
      approval_gate_type:
        | "opportunity_approval"
        | "brand_name_final"
        | "brand_identity_final"
        | "design_production"
        | "compliance_override"
        | "product_assortment"
        | "store_launch"
        | "paid_campaign_spend"
        | "scale_approval"
        | "provider_credentials"
        | "destructive_action"
      approval_status:
        | "pending"
        | "approved"
        | "rejected"
        | "revision_requested"
        | "cancelled"
      availability_status:
        | "unknown"
        | "unverified"
        | "likely_available"
        | "taken"
        | "error"
      brand_stage:
        | "idea"
        | "researching"
        | "candidate"
        | "approved"
        | "branding"
        | "creative"
        | "product_selection"
        | "store_build"
        | "launch_ready"
        | "testing"
        | "iterating"
        | "scaling"
        | "paused"
        | "killed"
        | "archived"
      compliance_status:
        | "not_reviewed"
        | "pending"
        | "clear"
        | "flagged"
        | "overridden"
        | "rejected"
      confidence_level: "low" | "medium" | "high"
      design_status:
        | "idea"
        | "brief"
        | "generating"
        | "review"
        | "revision"
        | "approved"
        | "production_ready"
        | "retired"
      evidence_kind:
        | "measured_fact"
        | "observed_signal"
        | "inferred_conclusion"
        | "assumption"
      job_status:
        | "queued"
        | "running"
        | "waiting_for_approval"
        | "completed"
        | "failed"
        | "cancelled"
      mission_status:
        | "draft"
        | "queued"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      name_status:
        | "hypothesis"
        | "proposed"
        | "shortlisted"
        | "rejected"
        | "final"
      opportunity_status:
        | "inbox"
        | "researching"
        | "candidate"
        | "approved"
        | "rejected"
        | "archived"
      risk_level: "none" | "low" | "medium" | "high" | "critical"
      run_status: "running" | "succeeded" | "failed"
      source_type:
        | "web"
        | "search_engine"
        | "marketplace"
        | "social"
        | "reddit"
        | "search_trends"
        | "ecommerce_data"
        | "manual"
        | "internal"
        | "none"
      workspace_role: "owner" | "admin" | "editor" | "viewer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      actor_type: ["human", "agent", "system"],
      approval_gate_type: [
        "opportunity_approval",
        "brand_name_final",
        "brand_identity_final",
        "design_production",
        "compliance_override",
        "product_assortment",
        "store_launch",
        "paid_campaign_spend",
        "scale_approval",
        "provider_credentials",
        "destructive_action",
      ],
      approval_status: [
        "pending",
        "approved",
        "rejected",
        "revision_requested",
        "cancelled",
      ],
      availability_status: [
        "unknown",
        "unverified",
        "likely_available",
        "taken",
        "error",
      ],
      brand_stage: [
        "idea",
        "researching",
        "candidate",
        "approved",
        "branding",
        "creative",
        "product_selection",
        "store_build",
        "launch_ready",
        "testing",
        "iterating",
        "scaling",
        "paused",
        "killed",
        "archived",
      ],
      compliance_status: [
        "not_reviewed",
        "pending",
        "clear",
        "flagged",
        "overridden",
        "rejected",
      ],
      confidence_level: ["low", "medium", "high"],
      design_status: [
        "idea",
        "brief",
        "generating",
        "review",
        "revision",
        "approved",
        "production_ready",
        "retired",
      ],
      evidence_kind: [
        "measured_fact",
        "observed_signal",
        "inferred_conclusion",
        "assumption",
      ],
      job_status: [
        "queued",
        "running",
        "waiting_for_approval",
        "completed",
        "failed",
        "cancelled",
      ],
      mission_status: [
        "draft",
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      name_status: [
        "hypothesis",
        "proposed",
        "shortlisted",
        "rejected",
        "final",
      ],
      opportunity_status: [
        "inbox",
        "researching",
        "candidate",
        "approved",
        "rejected",
        "archived",
      ],
      risk_level: ["none", "low", "medium", "high", "critical"],
      run_status: ["running", "succeeded", "failed"],
      source_type: [
        "web",
        "search_engine",
        "marketplace",
        "social",
        "reddit",
        "search_trends",
        "ecommerce_data",
        "manual",
        "internal",
        "none",
      ],
      workspace_role: ["owner", "admin", "editor", "viewer"],
    },
  },
} as const


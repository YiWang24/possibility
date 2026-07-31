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
      app_event_user_aliases: {
        Row: {
          created_at: string
          new_user_id: string
          old_user_id: string
        }
        Insert: {
          created_at?: string
          new_user_id: string
          old_user_id: string
        }
        Update: {
          created_at?: string
          new_user_id?: string
          old_user_id?: string
        }
        Relationships: []
      }
      app_events: {
        Row: {
          app_version: string | null
          created_at: string
          event: string
          event_id: string
          id: number
          props: Json
          session_id: string | null
          source: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          event: string
          event_id?: string
          id?: number
          props?: Json
          session_id?: string | null
          source: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          event?: string
          event_id?: string
          id?: number
          props?: Json
          session_id?: string | null
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      assessment_runs: {
        Row: {
          answers: Json
          assessment_kind: string
          completed_at: string
          created_at: string
          id: string
          result_tags: string[]
          schema_version: number
          scores: Json
          user_id: string
        }
        Insert: {
          answers?: Json
          assessment_kind: string
          completed_at?: string
          created_at?: string
          id?: string
          result_tags?: string[]
          schema_version?: number
          scores?: Json
          user_id: string
        }
        Update: {
          answers?: Json
          assessment_kind?: string
          completed_at?: string
          created_at?: string
          id?: string
          result_tags?: string[]
          schema_version?: number
          scores?: Json
          user_id?: string
        }
        Relationships: []
      }
      bounties: {
        Row: {
          created_at: string
          detail: string
          id: number
          question: string
          responses: string
          reward: string
          status: string
          tags: string[]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string
          id?: number
          question: string
          responses: string
          reward: string
          status?: string
          tags?: string[]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string
          id?: number
          question?: string
          responses?: string
          reward?: string
          status?: string
          tags?: string[]
          user_id?: string | null
        }
        Relationships: []
      }
      bounty_responses: {
        Row: {
          bounty_id: number
          created_at: string
          id: number
          message: string
          user_id: string
        }
        Insert: {
          bounty_id: number
          created_at?: string
          id?: number
          message?: string
          user_id: string
        }
        Update: {
          bounty_id?: number
          created_at?: string
          id?: number
          message?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bounty_responses_bounty_id_fkey"
            columns: ["bounty_id"]
            isOneToOne: false
            referencedRelation: "bounties"
            referencedColumns: ["id"]
          },
        ]
      }
      card_game_actions: {
        Row: {
          action_type: string
          card_keys: string[]
          created_at: string
          decision_source: string | null
          id: number
          pressure_after: number | null
          pressure_before: number | null
          reason_abandon: string | null
          reason_cannot_accept: string | null
          scenario_key: string | null
          sequence: number
          session_id: string
        }
        Insert: {
          action_type: string
          card_keys?: string[]
          created_at?: string
          decision_source?: string | null
          id?: never
          pressure_after?: number | null
          pressure_before?: number | null
          reason_abandon?: string | null
          reason_cannot_accept?: string | null
          scenario_key?: string | null
          sequence: number
          session_id: string
        }
        Update: {
          action_type?: string
          card_keys?: string[]
          created_at?: string
          decision_source?: string | null
          id?: never
          pressure_after?: number | null
          pressure_before?: number | null
          reason_abandon?: string | null
          reason_cannot_accept?: string | null
          scenario_key?: string | null
          sequence?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_game_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "card_game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      card_game_catalog_versions: {
        Row: {
          analysis_key: string
          catalog: Json
          catalog_schema_version: number
          content_hash: string | null
          created_at: string
          created_by: string | null
          engine_key: string
          game_id: string
          id: string
          is_current: boolean
          published_at: string | null
          status: string
          version: number
        }
        Insert: {
          analysis_key?: string
          catalog: Json
          catalog_schema_version?: number
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          engine_key?: string
          game_id: string
          id?: string
          is_current?: boolean
          published_at?: string | null
          status?: string
          version: number
        }
        Update: {
          analysis_key?: string
          catalog?: Json
          catalog_schema_version?: number
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          engine_key?: string
          game_id?: string
          id?: string
          is_current?: boolean
          published_at?: string | null
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_game_catalog_versions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "card_games"
            referencedColumns: ["id"]
          },
        ]
      }
      card_game_results: {
        Row: {
          accepted: Json
          created_at: string
          final_cards: Json
          id: number
          kind: string
          rounds: number
          traded: Json
          user_id: string
        }
        Insert: {
          accepted?: Json
          created_at?: string
          final_cards: Json
          id?: number
          kind: string
          rounds?: number
          traded?: Json
          user_id: string
        }
        Update: {
          accepted?: Json
          created_at?: string
          final_cards?: Json
          id?: number
          kind?: string
          rounds?: number
          traded?: Json
          user_id?: string
        }
        Relationships: []
      }
      card_game_runs: {
        Row: {
          ai_snapshot: Json
          analysis_key: string
          analysis_schema_version: number
          completed_at: string
          discarded_card_keys: string[]
          display_snapshot: Json
          final_card_keys: string[]
          game_id: string
          game_version_id: string
          id: string
          initial_card_keys: string[]
          metrics: Json
          session_id: string
          user_id: string
        }
        Insert: {
          ai_snapshot: Json
          analysis_key: string
          analysis_schema_version: number
          completed_at?: string
          discarded_card_keys: string[]
          display_snapshot: Json
          final_card_keys: string[]
          game_id: string
          game_version_id: string
          id?: string
          initial_card_keys: string[]
          metrics: Json
          session_id: string
          user_id: string
        }
        Update: {
          ai_snapshot?: Json
          analysis_key?: string
          analysis_schema_version?: number
          completed_at?: string
          discarded_card_keys?: string[]
          display_snapshot?: Json
          final_card_keys?: string[]
          game_id?: string
          game_version_id?: string
          id?: string
          initial_card_keys?: string[]
          metrics?: Json
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_game_runs_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "card_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_game_runs_game_version_id_game_id_fkey"
            columns: ["game_version_id", "game_id"]
            isOneToOne: false
            referencedRelation: "card_game_catalog_versions"
            referencedColumns: ["id", "game_id"]
          },
          {
            foreignKeyName: "card_game_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "card_game_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      card_game_sessions: {
        Row: {
          accept_count: number
          client_session_id: string
          completed_at: string | null
          current_scenario_key: string | null
          game_id: string
          game_version_id: string
          held_card_keys: string[]
          id: string
          last_action_seq: number
          phase: string
          pressure: number
          round_count: number
          seed: number
          seen_scenario_keys: string[]
          selected_card_keys: string[]
          started_at: string
          state_version: number
          status: string
          trade_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          accept_count?: number
          client_session_id: string
          completed_at?: string | null
          current_scenario_key?: string | null
          game_id: string
          game_version_id: string
          held_card_keys?: string[]
          id: string
          last_action_seq?: number
          phase?: string
          pressure?: number
          round_count?: number
          seed: number
          seen_scenario_keys?: string[]
          selected_card_keys?: string[]
          started_at?: string
          state_version?: number
          status?: string
          trade_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          accept_count?: number
          client_session_id?: string
          completed_at?: string | null
          current_scenario_key?: string | null
          game_id?: string
          game_version_id?: string
          held_card_keys?: string[]
          id?: string
          last_action_seq?: number
          phase?: string
          pressure?: number
          round_count?: number
          seed?: number
          seen_scenario_keys?: string[]
          selected_card_keys?: string[]
          started_at?: string
          state_version?: number
          status?: string
          trade_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_game_sessions_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "card_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_game_sessions_game_version_id_game_id_fkey"
            columns: ["game_version_id", "game_id"]
            isOneToOne: false
            referencedRelation: "card_game_catalog_versions"
            referencedColumns: ["id", "game_id"]
          },
        ]
      }
      card_games: {
        Row: {
          created_at: string
          game_key: string
          id: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_key: string
          id?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_key?: string
          id?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          crossroads: Json | null
          id: string
          status: string
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crossroads?: Json | null
          id?: string
          status?: string
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          crossroads?: Json | null
          id?: string
          status?: string
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      diary_entries: {
        Row: {
          analysis: Json
          analysis_model: string | null
          analysis_provider: string | null
          analyzed_at: string | null
          attempt_count: number
          audio_bytes: number | null
          audio_deleted_at: string | null
          audio_mime: string | null
          audio_path: string | null
          content_version: number
          created_at: string
          deleted_at: string | null
          duration_ms: number | null
          emotions: string[] | null
          entry_summary: string | null
          entry_uuid: string
          error_code: string | null
          id: number
          keywords: string[] | null
          local_date: string
          prompt_version: string | null
          recorded_at: string
          source: string
          status: string
          timezone: string
          title: string | null
          transcribed_at: string | null
          transcript: string | null
          transcript_edited: string | null
          transcript_language: string | null
          transcript_raw: string | null
          transcription_model: string | null
          transcription_provider: string | null
          updated_at: string
          uploaded_at: string | null
          user_id: string
        }
        Insert: {
          analysis?: Json
          analysis_model?: string | null
          analysis_provider?: string | null
          analyzed_at?: string | null
          attempt_count?: number
          audio_bytes?: number | null
          audio_deleted_at?: string | null
          audio_mime?: string | null
          audio_path?: string | null
          content_version?: number
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          emotions?: string[] | null
          entry_summary?: string | null
          entry_uuid?: string
          error_code?: string | null
          id?: number
          keywords?: string[] | null
          local_date: string
          prompt_version?: string | null
          recorded_at?: string
          source?: string
          status?: string
          timezone?: string
          title?: string | null
          transcribed_at?: string | null
          transcript?: string | null
          transcript_edited?: string | null
          transcript_language?: string | null
          transcript_raw?: string | null
          transcription_model?: string | null
          transcription_provider?: string | null
          updated_at?: string
          uploaded_at?: string | null
          user_id: string
        }
        Update: {
          analysis?: Json
          analysis_model?: string | null
          analysis_provider?: string | null
          analyzed_at?: string | null
          attempt_count?: number
          audio_bytes?: number | null
          audio_deleted_at?: string | null
          audio_mime?: string | null
          audio_path?: string | null
          content_version?: number
          created_at?: string
          deleted_at?: string | null
          duration_ms?: number | null
          emotions?: string[] | null
          entry_summary?: string | null
          entry_uuid?: string
          error_code?: string | null
          id?: number
          keywords?: string[] | null
          local_date?: string
          prompt_version?: string | null
          recorded_at?: string
          source?: string
          status?: string
          timezone?: string
          title?: string | null
          transcribed_at?: string | null
          transcript?: string | null
          transcript_edited?: string | null
          transcript_language?: string | null
          transcript_raw?: string | null
          transcription_model?: string | null
          transcription_provider?: string | null
          updated_at?: string
          uploaded_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      diary_summaries: {
        Row: {
          active_day_count: number
          attempt_count: number
          created_at: string
          data_cutoff_at: string | null
          entry_count: number
          error_code: string | null
          generated_at: string | null
          id: string
          model: string | null
          period_start: string
          period_type: string
          prompt_version: string | null
          provider: string | null
          schema_version: number
          source_fingerprint: string | null
          status: string
          summary: Json
          total_duration_ms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_day_count?: number
          attempt_count?: number
          created_at?: string
          data_cutoff_at?: string | null
          entry_count?: number
          error_code?: string | null
          generated_at?: string | null
          id?: string
          model?: string | null
          period_start: string
          period_type: string
          prompt_version?: string | null
          provider?: string | null
          schema_version?: number
          source_fingerprint?: string | null
          status?: string
          summary?: Json
          total_duration_ms?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_day_count?: number
          attempt_count?: number
          created_at?: string
          data_cutoff_at?: string | null
          entry_count?: number
          error_code?: string | null
          generated_at?: string | null
          id?: string
          model?: string | null
          period_start?: string
          period_type?: string
          prompt_version?: string | null
          provider?: string | null
          schema_version?: number
          source_fingerprint?: string | null
          status?: string
          summary?: Json
          total_duration_ms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      diary_summary_cache: {
        Row: {
          entry_count: number
          period: string
          ref: string
          summary: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          entry_count?: number
          period: string
          ref: string
          summary?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          entry_count?: number
          period?: string
          ref?: string
          summary?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kaleidoscope_draws: {
        Row: {
          created_at: string
          id: number
          mode: string
          traveler_id: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          mode: string
          traveler_id?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          mode?: string
          traveler_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kaleidoscope_draws_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "travelers"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_choice_sets: {
        Row: {
          cards: Json
          constraints: string[]
          created_at: string
          id: number
          previous_choices: string[]
          question: string
          rationale: string
          topic: string | null
          user_id: string
        }
        Insert: {
          cards: Json
          constraints?: string[]
          created_at?: string
          id?: number
          previous_choices?: string[]
          question: string
          rationale?: string
          topic?: string | null
          user_id: string
        }
        Update: {
          cards?: Json
          constraints?: string[]
          created_at?: string
          id?: number
          previous_choices?: string[]
          question?: string
          rationale?: string
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      match_results: {
        Row: {
          created_at: string
          id: number
          matches: Json
          user_id: string
          user_state: Json
        }
        Insert: {
          created_at?: string
          id?: number
          matches: Json
          user_id: string
          user_state: Json
        }
        Update: {
          created_at?: string
          id?: number
          matches?: Json
          user_id?: string
          user_state?: Json
        }
        Relationships: []
      }
      memory_proposals: {
        Row: {
          confidence: number
          created_at: string
          dedupe_key: string
          dimension: string
          expires_at: string
          fact_kind: string
          id: string
          model_name: string | null
          normalized_value: string
          operation: string
          prompt_version: string | null
          rationale_code: string
          reviewed_at: string | null
          schema_version: number
          sensitivity: string
          source_id: string
          source_type: string
          source_version: number
          status: string
          target_fact_id: string | null
          user_id: string
          value: string
        }
        Insert: {
          confidence: number
          created_at?: string
          dedupe_key: string
          dimension: string
          expires_at?: string
          fact_kind?: string
          id?: string
          model_name?: string | null
          normalized_value: string
          operation?: string
          prompt_version?: string | null
          rationale_code?: string
          reviewed_at?: string | null
          schema_version?: number
          sensitivity?: string
          source_id: string
          source_type: string
          source_version?: number
          status?: string
          target_fact_id?: string | null
          user_id: string
          value: string
        }
        Update: {
          confidence?: number
          created_at?: string
          dedupe_key?: string
          dimension?: string
          expires_at?: string
          fact_kind?: string
          id?: string
          model_name?: string | null
          normalized_value?: string
          operation?: string
          prompt_version?: string | null
          rationale_code?: string
          reviewed_at?: string | null
          schema_version?: number
          sensitivity?: string
          source_id?: string
          source_type?: string
          source_version?: number
          status?: string
          target_fact_id?: string | null
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "memory_proposals_target_fact_id_fkey"
            columns: ["target_fact_id"]
            isOneToOne: false
            referencedRelation: "profile_facts"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: number
          meta: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: number
          meta?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: number
          meta?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      persona_jobs: {
        Row: {
          created_at: string
          error: string | null
          id: string
          model_version: string
          persona: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          model_version?: string
          persona?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          model_version?: string
          persona?: Json
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_fact_evidence: {
        Row: {
          confidence: number
          created_at: string
          evidence_role: string
          fact_id: string
          id: string
          observed_at: string
          source_id: string
          source_type: string
          source_version: number
          user_id: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          evidence_role?: string
          fact_id: string
          id?: string
          observed_at?: string
          source_id: string
          source_type: string
          source_version?: number
          user_id: string
        }
        Update: {
          confidence?: number
          created_at?: string
          evidence_role?: string
          fact_id?: string
          id?: string
          observed_at?: string
          source_id?: string
          source_type?: string
          source_version?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_fact_evidence_fact_id_fkey"
            columns: ["fact_id"]
            isOneToOne: false
            referencedRelation: "profile_facts"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_facts: {
        Row: {
          confidence: number
          created_at: string
          dimension: string
          fact_kind: string
          id: string
          last_supported_at: string
          normalized_value: string
          observed_at: string
          sensitivity: string
          source: string
          source_ref: string | null
          status: string
          support_count: number
          updated_at: string
          user_confirmed: boolean
          user_id: string
          valid_from: string | null
          valid_to: string | null
          value: string
          visibility: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          dimension: string
          fact_kind?: string
          id?: string
          last_supported_at?: string
          normalized_value: string
          observed_at?: string
          sensitivity?: string
          source?: string
          source_ref?: string | null
          status?: string
          support_count?: number
          updated_at?: string
          user_confirmed?: boolean
          user_id: string
          valid_from?: string | null
          valid_to?: string | null
          value: string
          visibility?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          dimension?: string
          fact_kind?: string
          id?: string
          last_supported_at?: string
          normalized_value?: string
          observed_at?: string
          sensitivity?: string
          source?: string
          source_ref?: string | null
          status?: string
          support_count?: number
          updated_at?: string
          user_confirmed?: boolean
          user_id?: string
          valid_from?: string | null
          valid_to?: string | null
          value?: string
          visibility?: string
        }
        Relationships: []
      }
      profile_public_drafts: {
        Row: {
          advice: Json
          age: number | null
          avatar_url: string | null
          bio: string
          city: string
          created_at: string
          from_role: string
          hue: number
          id: string
          name: string
          profile_version: number
          quote: string
          result: string
          services: Json
          stage: string
          story_full: string
          story_intro: string
          tags: string[]
          to_role: string
          trajectory: Json
          updated_at: string
        }
        Insert: {
          advice?: Json
          age?: number | null
          avatar_url?: string | null
          bio?: string
          city?: string
          created_at?: string
          from_role?: string
          hue?: number
          id: string
          name?: string
          profile_version?: number
          quote?: string
          result?: string
          services?: Json
          stage?: string
          story_full?: string
          story_intro?: string
          tags?: string[]
          to_role?: string
          trajectory?: Json
          updated_at?: string
        }
        Update: {
          advice?: Json
          age?: number | null
          avatar_url?: string | null
          bio?: string
          city?: string
          created_at?: string
          from_role?: string
          hue?: number
          id?: string
          name?: string
          profile_version?: number
          quote?: string
          result?: string
          services?: Json
          stage?: string
          story_full?: string
          story_intro?: string
          tags?: string[]
          to_role?: string
          trajectory?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          portrait_pct: number
          profile_revision: number
          updated_at: string
          verification_provider: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id: string
          portrait_pct?: number
          profile_revision?: number
          updated_at?: string
          verification_provider?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          portrait_pct?: number
          profile_revision?: number
          updated_at?: string
          verification_provider?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string
          hue: number
          id: string
          is_verified: boolean
          name: string
          published_at: string
          published_facts: Json
          quote: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string
          hue?: number
          id: string
          is_verified?: boolean
          name?: string
          published_at?: string
          published_facts?: Json
          quote?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string
          hue?: number
          id?: string
          is_verified?: boolean
          name?: string
          published_at?: string
          published_facts?: Json
          quote?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      simulations: {
        Row: {
          bottom_line: Json
          carry_cards: string[]
          choice: string
          created_at: string
          id: number
          question: string
          scenarios: Json
          time_horizon: string
          user_id: string
          years: number
        }
        Insert: {
          bottom_line?: Json
          carry_cards?: string[]
          choice: string
          created_at?: string
          id?: number
          question: string
          scenarios: Json
          time_horizon?: string
          user_id: string
          years: number
        }
        Update: {
          bottom_line?: Json
          carry_cards?: string[]
          choice?: string
          created_at?: string
          id?: number
          question?: string
          scenarios?: Json
          time_horizon?: string
          user_id?: string
          years?: number
        }
        Relationships: []
      }
      traveler_details: {
        Row: {
          advice: Json
          age: number | null
          city: string | null
          consulted: number | null
          from_role: string | null
          full_text: string
          intro: string
          response_time: string | null
          result: string | null
          to_role: string | null
          traveler_id: number
          years: string | null
        }
        Insert: {
          advice?: Json
          age?: number | null
          city?: string | null
          consulted?: number | null
          from_role?: string | null
          full_text: string
          intro: string
          response_time?: string | null
          result?: string | null
          to_role?: string | null
          traveler_id: number
          years?: string | null
        }
        Update: {
          advice?: Json
          age?: number | null
          city?: string | null
          consulted?: number | null
          from_role?: string | null
          full_text?: string
          intro?: string
          response_time?: string | null
          result?: string | null
          to_role?: string | null
          traveler_id?: number
          years?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "traveler_details_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: true
            referencedRelation: "travelers"
            referencedColumns: ["id"]
          },
        ]
      }
      traveler_services: {
        Row: {
          description: string
          id: string
          kind: string
          price: number
          tags: string[]
          title: string
          traveler_id: number | null
          unit: string
        }
        Insert: {
          description: string
          id: string
          kind: string
          price: number
          tags?: string[]
          title: string
          traveler_id?: number | null
          unit?: string
        }
        Update: {
          description?: string
          id?: string
          kind?: string
          price?: number
          tags?: string[]
          title?: string
          traveler_id?: number | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "traveler_services_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "travelers"
            referencedColumns: ["id"]
          },
        ]
      }
      travelers: {
        Row: {
          bio: string
          created_at: string
          dims: Json
          hue: number
          id: number
          initial: string
          is_similar: boolean
          name: string
          quote: string
          tags: string[]
          trajectory: Json
        }
        Insert: {
          bio: string
          created_at?: string
          dims?: Json
          hue: number
          id: number
          initial: string
          is_similar?: boolean
          name: string
          quote: string
          tags?: string[]
          trajectory?: Json
        }
        Update: {
          bio?: string
          created_at?: string
          dims?: Json
          hue?: number
          id?: number
          initial?: string
          is_similar?: boolean
          name?: string
          quote?: string
          tags?: string[]
          trajectory?: Json
        }
        Relationships: []
      }
      unlocks: {
        Row: {
          amount: number
          created_at: string
          id: number
          kind: string
          target_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: number
          kind: string
          target_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          kind?: string
          target_id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_insert_app_event: {
        Args: { p_event: string; p_source: string; p_user_id: string }
        Returns: boolean
      }
      clear_profile: {
        Args: { p_expected_revision?: number }
        Returns: {
          portrait_pct: number
          profile_revision: number
        }[]
      }
      complete_card_game_session_v2: {
        Args: {
          p_expected_state_version: number
          p_run: Json
          p_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      confirm_profile_fact: {
        Args: { p_expected_revision?: number; p_fact_id: string }
        Returns: {
          portrait_pct: number
          profile_revision: number
        }[]
      }
      create_card_game_session_v2: {
        Args: {
          p_catalog_version: number
          p_client_session_id: string
          p_game_key: string
          p_seed: number
          p_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      delete_diary_job: { Args: { p_message_id: number }; Returns: boolean }
      delete_profile_dimension: {
        Args: { p_dimension: string; p_expected_revision?: number }
        Returns: {
          portrait_pct: number
          profile_revision: number
        }[]
      }
      enqueue_diary_job: {
        Args: {
          p_delay_seconds?: number
          p_entry_id?: string
          p_job_key: string
          p_period_start?: string
          p_task_type: string
          p_user_id: string
        }
        Returns: number
      }
      merge_anonymous_user: {
        Args: { p_new: string; p_old: string }
        Returns: undefined
      }
      propose_profile_fact: {
        Args: {
          p_confidence: number
          p_dimension: string
          p_fact_kind?: string
          p_model_name?: string
          p_prompt_version?: string
          p_sensitivity?: string
          p_source_id: string
          p_source_type: string
          p_source_version?: number
          p_value: string
        }
        Returns: string
      }
      publish_card_game_catalog_v1: {
        Args: { p_game_key: string; p_version: number }
        Returns: Json
      }
      purge_diary_jobs: { Args: { p_user_id: string }; Returns: number }
      read_diary_jobs: {
        Args: { p_quantity?: number; p_visibility_seconds?: number }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
          vt: string
        }[]
      }
      replace_profile_dimension: {
        Args: {
          p_confidence?: number
          p_dimension: string
          p_expected_revision?: number
          p_portrait_delta?: number
          p_source?: string
          p_source_ref?: string
          p_user_confirmed?: boolean
          p_values: string[]
        }
        Returns: {
          portrait_pct: number
          profile_revision: number
        }[]
      }
      review_profile_proposal: {
        Args: {
          p_accept: boolean
          p_expected_revision?: number
          p_proposal_id: string
        }
        Returns: {
          portrait_pct: number
          profile_revision: number
        }[]
      }
      save_assessment_and_profile: {
        Args: {
          p_answers?: Json
          p_assessment_kind: string
          p_dimension: string
          p_expected_revision?: number
          p_schema_version?: number
          p_scores?: Json
          p_values: string[]
        }
        Returns: {
          assessment_run_id: string
          portrait_pct: number
          profile_revision: number
        }[]
      }
      save_card_game_and_profile: {
        Args: {
          p_accepted: Json
          p_expected_revision?: number
          p_final_cards: Json
          p_kind: string
          p_rounds: number
          p_traded: Json
        }
        Returns: {
          portrait_pct: number
          profile_revision: number
        }[]
      }
      save_public_profile: { Args: { p_profile: Json }; Returns: undefined }
      set_profile_fact_visibility: {
        Args: {
          p_expected_revision?: number
          p_fact_id: string
          p_visibility: string
        }
        Returns: {
          portrait_pct: number
          profile_revision: number
        }[]
      }
      sync_card_game_session_v2: {
        Args: {
          p_actions: Json
          p_expected_state_version: number
          p_session_id: string
          p_state: Json
          p_user_id: string
        }
        Returns: Json
      }
      update_profile_progress: {
        Args: { p_portrait_delta?: number }
        Returns: {
          portrait_pct: number
          profile_revision: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const


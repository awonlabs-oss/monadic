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
      account_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      application_contacts: {
        Row: {
          application_id: string
          contact_id: string
          created_at: string
          id: string
          notes: string | null
          role_in_process: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          application_id: string
          contact_id: string
          created_at?: string
          id?: string
          notes?: string | null
          role_in_process?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          application_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          role_in_process?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_contacts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "application_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_contacts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_contacts_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_feed"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      application_events: {
        Row: {
          application_id: string
          body: string | null
          contact_id: string | null
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          metadata: Json
          occurred_at: string
          outreach_message_id: string | null
          title: string | null
          to_status: string | null
          user_id: string
        }
        Insert: {
          application_id: string
          body?: string | null
          contact_id?: string | null
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          outreach_message_id?: string | null
          title?: string | null
          to_status?: string | null
          user_id: string
        }
        Update: {
          application_id?: string
          body?: string | null
          contact_id?: string | null
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          occurred_at?: string
          outreach_message_id?: string | null
          title?: string | null
          to_status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "application_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_feed"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "application_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_events_outreach_fk"
            columns: ["outreach_message_id"]
            isOneToOne: false
            referencedRelation: "outreach_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          applied_at: string | null
          created_at: string
          id: string
          job_id: string
          next_action: string | null
          next_action_at: string | null
          source: string | null
          status: string
          status_changed_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          created_at?: string
          id?: string
          job_id: string
          next_action?: string | null
          next_action_at?: string | null
          source?: string | null
          status?: string
          status_changed_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_at?: string | null
          created_at?: string
          id?: string
          job_id?: string
          next_action?: string | null
          next_action_at?: string | null
          source?: string | null
          status?: string
          status_changed_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          ats_board_url: string | null
          ats_etag: string | null
          ats_last_modified: string | null
          ats_resolution_error: string | null
          ats_resolution_method: string | null
          ats_resolution_status: string
          ats_resolved_at: string | null
          ats_slug: string | null
          ats_source: Database["public"]["Enums"]["ats_source"] | null
          careers_url: string | null
          created_at: string
          id: string
          name: string
          raw: Json
          slug: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          ats_board_url?: string | null
          ats_etag?: string | null
          ats_last_modified?: string | null
          ats_resolution_error?: string | null
          ats_resolution_method?: string | null
          ats_resolution_status?: string
          ats_resolved_at?: string | null
          ats_slug?: string | null
          ats_source?: Database["public"]["Enums"]["ats_source"] | null
          careers_url?: string | null
          created_at?: string
          id?: string
          name: string
          raw?: Json
          slug: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          ats_board_url?: string | null
          ats_etag?: string | null
          ats_last_modified?: string | null
          ats_resolution_error?: string | null
          ats_resolution_method?: string | null
          ats_resolution_status?: string
          ats_resolved_at?: string | null
          ats_slug?: string | null
          ats_source?: Database["public"]["Enums"]["ats_source"] | null
          careers_url?: string | null
          created_at?: string
          id?: string
          name?: string
          raw?: Json
          slug?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          linkedin_url: string | null
          notes: string | null
          phone: string | null
          provider: string
          provider_confidence: number | null
          provider_record_id: string | null
          raw: Json
          role: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          provider?: string
          provider_confidence?: number | null
          provider_record_id?: string | null
          raw?: Json
          role?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          provider?: string
          provider_confidence?: number | null
          provider_record_id?: string | null
          raw?: Json
          role?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "application_overview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissal_reasons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          is_active: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          is_active?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      ingestion_runs: {
        Row: {
          batch_id: string
          closure_applied: boolean
          company_id: string | null
          created_at: string
          duration_ms: number | null
          error_detail: Json | null
          error_message: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          jobs_closed: number | null
          jobs_created: number | null
          jobs_returned: number | null
          jobs_updated: number | null
          kind: string
          source: Database["public"]["Enums"]["ats_source"] | null
          started_at: string
          status: string
        }
        Insert: {
          batch_id: string
          closure_applied?: boolean
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_detail?: Json | null
          error_message?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          jobs_closed?: number | null
          jobs_created?: number | null
          jobs_returned?: number | null
          jobs_updated?: number | null
          kind?: string
          source?: Database["public"]["Enums"]["ats_source"] | null
          started_at?: string
          status: string
        }
        Update: {
          batch_id?: string
          closure_applied?: boolean
          company_id?: string | null
          created_at?: string
          duration_ms?: number | null
          error_detail?: Json | null
          error_message?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          jobs_closed?: number | null
          jobs_created?: number | null
          jobs_returned?: number | null
          jobs_updated?: number | null
          kind?: string
          source?: Database["public"]["Enums"]["ats_source"] | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "application_overview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "ingestion_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_interactions: {
        Row: {
          created_at: string
          dismissal_note: string | null
          dismissal_reason_code: string | null
          dismissed_at: string | null
          id: string
          job_id: string
          saved_at: string | null
          state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissal_note?: string | null
          dismissal_reason_code?: string | null
          dismissed_at?: string | null
          id?: string
          job_id: string
          saved_at?: string | null
          state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissal_note?: string | null
          dismissal_reason_code?: string | null
          dismissed_at?: string | null
          id?: string
          job_id?: string
          saved_at?: string | null
          state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_interactions_dismissal_reason_code_fkey"
            columns: ["dismissal_reason_code"]
            isOneToOne: false
            referencedRelation: "dismissal_reasons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "job_interactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_interactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_signals: {
        Row: {
          created_at: string
          id: string
          job_id: string
          job_snapshot: Json
          reason_code: string | null
          reason_note: string | null
          signal: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          job_snapshot?: Json
          reason_code?: string | null
          reason_note?: string | null
          signal: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          job_snapshot?: Json
          reason_code?: string | null
          reason_note?: string | null
          signal?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_signals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_signals_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_signals_reason_code_fkey"
            columns: ["reason_code"]
            isOneToOne: false
            referencedRelation: "dismissal_reasons"
            referencedColumns: ["code"]
          },
        ]
      }
      jobs: {
        Row: {
          closed_at: string | null
          comp_currency: string | null
          comp_max: number | null
          comp_min: number | null
          comp_note: string | null
          comp_period: string | null
          comp_source: string
          company_id: string
          content_hash: string | null
          created_at: string
          department: string | null
          description_html: string | null
          description_text: string | null
          employment_type: string | null
          first_seen_at: string
          id: string
          is_open: boolean | null
          last_seen_at: string
          location_city: string | null
          location_country: string | null
          location_raw: string | null
          location_region: string | null
          posted_at: string | null
          raw: Json
          remote_policy: string | null
          role_type: string | null
          search_tsv: unknown
          seniority: string | null
          source: Database["public"]["Enums"]["ats_source"]
          source_job_id: string
          team: string | null
          title: string
          updated_at: string
          url: string | null
          years_max: number | null
          years_min: number | null
          years_source: string
        }
        Insert: {
          closed_at?: string | null
          comp_currency?: string | null
          comp_max?: number | null
          comp_min?: number | null
          comp_note?: string | null
          comp_period?: string | null
          comp_source?: string
          company_id: string
          content_hash?: string | null
          created_at?: string
          department?: string | null
          description_html?: string | null
          description_text?: string | null
          employment_type?: string | null
          first_seen_at?: string
          id?: string
          is_open?: boolean | null
          last_seen_at?: string
          location_city?: string | null
          location_country?: string | null
          location_raw?: string | null
          location_region?: string | null
          posted_at?: string | null
          raw: Json
          remote_policy?: string | null
          role_type?: string | null
          search_tsv?: unknown
          seniority?: string | null
          source: Database["public"]["Enums"]["ats_source"]
          source_job_id: string
          team?: string | null
          title: string
          updated_at?: string
          url?: string | null
          years_max?: number | null
          years_min?: number | null
          years_source?: string
        }
        Update: {
          closed_at?: string | null
          comp_currency?: string | null
          comp_max?: number | null
          comp_min?: number | null
          comp_note?: string | null
          comp_period?: string | null
          comp_source?: string
          company_id?: string
          content_hash?: string | null
          created_at?: string
          department?: string | null
          description_html?: string | null
          description_text?: string | null
          employment_type?: string | null
          first_seen_at?: string
          id?: string
          is_open?: boolean | null
          last_seen_at?: string
          location_city?: string | null
          location_country?: string | null
          location_raw?: string | null
          location_region?: string | null
          posted_at?: string | null
          raw?: Json
          remote_policy?: string | null
          role_type?: string | null
          search_tsv?: unknown
          seniority?: string | null
          source?: Database["public"]["Enums"]["ats_source"]
          source_job_id?: string
          team?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          years_max?: number | null
          years_min?: number | null
          years_source?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "application_overview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_messages: {
        Row: {
          application_id: string | null
          body: string
          bounced_at: string | null
          channel: string
          contact_id: string
          created_at: string
          id: string
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          subject: string | null
          template_id: string | null
          updated_at: string
          user_id: string
          variables_snapshot: Json
        }
        Insert: {
          application_id?: string | null
          body: string
          bounced_at?: string | null
          channel?: string
          contact_id: string
          created_at?: string
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          subject?: string | null
          template_id?: string | null
          updated_at?: string
          user_id: string
          variables_snapshot?: Json
        }
        Update: {
          application_id?: string | null
          body?: string
          bounced_at?: string | null
          channel?: string
          contact_id?: string
          created_at?: string
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          sent_at?: string | null
          subject?: string | null
          template_id?: string | null
          updated_at?: string
          user_id?: string
          variables_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "application_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "job_feed"
            referencedColumns: ["application_id"]
          },
          {
            foreignKeyName: "outreach_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "outreach_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          is_archived: boolean
          name: string
          subject: string | null
          updated_at: string
          user_id: string
          variables: string[]
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          subject?: string | null
          updated_at?: string
          user_id: string
          variables?: string[]
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
          variables?: string[]
        }
        Relationships: []
      }
      profile_education: {
        Row: {
          created_at: string
          degree: string | null
          end_year: number | null
          field: string | null
          id: string
          institution: string
          notes: string | null
          profile_id: string
          raw: Json
          sort_order: number
          source: string
          start_year: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          degree?: string | null
          end_year?: number | null
          field?: string | null
          id?: string
          institution: string
          notes?: string | null
          profile_id: string
          raw?: Json
          sort_order?: number
          source?: string
          start_year?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          degree?: string | null
          end_year?: number | null
          field?: string | null
          id?: string
          institution?: string
          notes?: string | null
          profile_id?: string
          raw?: Json
          sort_order?: number
          source?: string
          start_year?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_education_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_experiences: {
        Row: {
          company_name: string
          created_at: string
          description: string | null
          end_date: string | null
          end_text: string | null
          id: string
          is_current: boolean
          location: string | null
          profile_id: string
          raw: Json
          seniority: string | null
          sort_order: number
          source: string
          start_date: string | null
          start_text: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_name: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          end_text?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          profile_id: string
          raw?: Json
          seniority?: string | null
          sort_order?: number
          source?: string
          start_date?: string | null
          start_text?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          end_text?: string | null
          id?: string
          is_current?: boolean
          location?: string | null
          profile_id?: string
          raw?: Json
          seniority?: string | null
          sort_order?: number
          source?: string
          start_date?: string | null
          start_text?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_experiences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_skills: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          proficiency: string | null
          profile_id: string
          source: string
          updated_at: string
          user_id: string
          years: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          proficiency?: string | null
          profile_id: string
          source?: string
          updated_at?: string
          user_id: string
          years?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          proficiency?: string | null
          profile_id?: string
          source?: string
          updated_at?: string
          user_id?: string
          years?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profile_skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          headline: string | null
          id: string
          links: Json
          location: string | null
          parsed_at: string | null
          parser_version: string | null
          phone: string | null
          raw: Json
          seniority_signal: string | null
          source_file_hash: string | null
          source_file_name: string | null
          source_file_type: string | null
          summary: string | null
          updated_at: string
          user_id: string
          years_experience_total: number | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id?: string
          links?: Json
          location?: string | null
          parsed_at?: string | null
          parser_version?: string | null
          phone?: string | null
          raw?: Json
          seniority_signal?: string | null
          source_file_hash?: string | null
          source_file_name?: string | null
          source_file_type?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
          years_experience_total?: number | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id?: string
          links?: Json
          location?: string | null
          parsed_at?: string | null
          parser_version?: string | null
          phone?: string | null
          raw?: Json
          seniority_signal?: string | null
          source_file_hash?: string | null
          source_file_name?: string | null
          source_file_type?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
          years_experience_total?: number | null
        }
        Relationships: []
      }
      search_criteria: {
        Row: {
          comp_currency: string
          comp_floor: number | null
          comp_period: string
          company_stages: string[]
          created_at: string
          id: string
          include_missing_comp: boolean
          locations: string[]
          notes: string | null
          remote_preference: string | null
          seniority_ceiling: string | null
          target_role_types: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          comp_currency?: string
          comp_floor?: number | null
          comp_period?: string
          company_stages?: string[]
          created_at?: string
          id?: string
          include_missing_comp?: boolean
          locations?: string[]
          notes?: string | null
          remote_preference?: string | null
          seniority_ceiling?: string | null
          target_role_types?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          comp_currency?: string
          comp_floor?: number | null
          comp_period?: string
          company_stages?: string[]
          created_at?: string
          id?: string
          include_missing_comp?: boolean
          locations?: string[]
          notes?: string | null
          remote_preference?: string | null
          seniority_ceiling?: string | null
          target_role_types?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tracked_companies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          priority: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          priority?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          priority?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "application_overview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "tracked_companies_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      application_overview: {
        Row: {
          applied_at: string | null
          comp_currency: string | null
          comp_max: number | null
          comp_min: number | null
          company_id: string | null
          company_name: string | null
          created_at: string | null
          id: string | null
          is_stale: boolean | null
          job_closed_at: string | null
          job_id: string | null
          job_title: string | null
          job_url: string | null
          last_event_at: string | null
          next_action: string | null
          next_action_at: string | null
          next_action_overdue: boolean | null
          source: string | null
          status: string | null
          status_changed_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_feed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_feed: {
        Row: {
          application_id: string | null
          application_status: string | null
          closed_at: string | null
          comp_currency: string | null
          comp_max: number | null
          comp_min: number | null
          comp_note: string | null
          comp_period: string | null
          comp_source: string | null
          company_id: string | null
          company_name: string | null
          company_slug: string | null
          department: string | null
          dismissal_reason_code: string | null
          employment_type: string | null
          first_seen_at: string | null
          id: string | null
          interaction_state: string | null
          is_open: boolean | null
          last_seen_at: string | null
          location_city: string | null
          location_country: string | null
          location_raw: string | null
          location_region: string | null
          posted_at: string | null
          remote_policy: string | null
          role_type: string | null
          seniority: string | null
          source: Database["public"]["Enums"]["ats_source"] | null
          team: string | null
          title: string | null
          url: string | null
          years_max: number | null
          years_min: number | null
          years_source: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_interactions_dismissal_reason_code_fkey"
            columns: ["dismissal_reason_code"]
            isOneToOne: false
            referencedRelation: "dismissal_reasons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "application_overview"
            referencedColumns: ["company_id"]
          },
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_application: {
        Args: { p_job_id: string; p_source?: string }
        Returns: {
          applied_at: string | null
          created_at: string
          id: string
          job_id: string
          next_action: string | null
          next_action_at: string | null
          source: string | null
          status: string
          status_changed_at: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dismiss_job: {
        Args: { p_job_id: string; p_note?: string; p_reason_code: string }
        Returns: {
          created_at: string
          dismissal_note: string | null
          dismissal_reason_code: string | null
          dismissed_at: string | null
          id: string
          job_id: string
          saved_at: string | null
          state: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "job_interactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      job_signal_snapshot: { Args: { p_job_id: string }; Returns: Json }
      log_outreach_sent: {
        Args: {
          p_application_id?: string
          p_body: string
          p_channel?: string
          p_contact_id: string
          p_sent_at?: string
          p_subject?: string
          p_template_id?: string
          p_variables?: Json
        }
        Returns: {
          application_id: string | null
          body: string
          bounced_at: string | null
          channel: string
          contact_id: string
          created_at: string
          id: string
          opened_at: string | null
          replied_at: string | null
          sent_at: string | null
          subject: string | null
          template_id: string | null
          updated_at: string
          user_id: string
          variables_snapshot: Json
        }
        SetofOptions: {
          from: "*"
          to: "outreach_messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      save_job: {
        Args: { p_job_id: string }
        Returns: {
          created_at: string
          dismissal_note: string | null
          dismissal_reason_code: string | null
          dismissed_at: string | null
          id: string
          job_id: string
          saved_at: string | null
          state: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "job_interactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_application_status: {
        Args: {
          p_application_id: string
          p_note?: string
          p_occurred_at?: string
          p_status: string
        }
        Returns: {
          applied_at: string | null
          created_at: string
          id: string
          job_id: string
          next_action: string | null
          next_action_at: string | null
          source: string | null
          status: string
          status_changed_at: string
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "applications"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      ats_source: "greenhouse" | "ashby" | "lever"
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
      ats_source: ["greenhouse", "ashby", "lever"],
    },
  },
} as const

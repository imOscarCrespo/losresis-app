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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      app_versions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_force_update: boolean | null
          min_required_version: string
          platform: string
          update_url: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_force_update?: boolean | null
          min_required_version: string
          platform: string
          update_url?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_force_update?: boolean | null
          min_required_version?: string
          platform?: string
          update_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agenda_events: {
        Row: {
          all_day: boolean
          created_at: string | null
          end_date: string | null
          end_time: string | null
          event_date: string | null
          event_type: string
          id: string
          metadata: Json
          notes: string | null
          source_shift_id: string | null
          start_time: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date?: string | null
          event_type: string
          id?: string
          metadata?: Json
          notes?: string | null
          source_shift_id?: string | null
          start_time?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean
          created_at?: string | null
          end_date?: string | null
          end_time?: string | null
          event_date?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          notes?: string | null
          source_shift_id?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_events_source_shift_id_fkey"
            columns: ["source_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agenda_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      article: {
        Row: {
          body: Json
          cover_image_url: string | null
          created_at: string
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: Json
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: Json
          cover_image_url?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      article_like: {
        Row: {
          article_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          article_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_like_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "article"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_like_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      course_like: {
        Row: {
          course_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_like_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_like_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          course_code: string | null
          course_directors: string | null
          created_at: string
          created_by_id: string | null
          event_dates: string[]
          featured_until: string | null
          hospital_id: string | null
          id: string
          is_featured: boolean
          more_info: string | null
          objectives: string | null
          org_id: string | null
          organization: string | null
          price_text: string | null
          published_at: string | null
          registration_url: string | null
          seats_available: number | null
          speciality_id: string | null
          status: string
          teaching_hours: string | null
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string | null
          visibility_score: number
        }
        Insert: {
          course_code?: string | null
          course_directors?: string | null
          created_at?: string
          created_by_id?: string | null
          event_dates: string[]
          featured_until?: string | null
          hospital_id?: string | null
          id?: string
          is_featured?: boolean
          more_info?: string | null
          objectives?: string | null
          org_id?: string | null
          organization?: string | null
          price_text?: string | null
          published_at?: string | null
          registration_url?: string | null
          seats_available?: number | null
          speciality_id?: string | null
          status?: string
          teaching_hours?: string | null
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          visibility_score?: number
        }
        Update: {
          course_code?: string | null
          course_directors?: string | null
          created_at?: string
          created_by_id?: string | null
          event_dates?: string[]
          featured_until?: string | null
          hospital_id?: string | null
          id?: string
          is_featured?: boolean
          more_info?: string | null
          objectives?: string | null
          org_id?: string | null
          organization?: string | null
          price_text?: string | null
          published_at?: string | null
          registration_url?: string | null
          seats_available?: number | null
          speciality_id?: string | null
          status?: string
          teaching_hours?: string | null
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
          visibility_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_speciality_id_fkey"
            columns: ["speciality_id"]
            isOneToOne: false
            referencedRelation: "specialities"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_advertisement: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean
          placement_scope: string
          position: number
          role_scope: string
          starts_at: string | null
          target_section: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          placement_scope?: string
          position?: number
          role_scope?: string
          starts_at?: string | null
          target_section?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          placement_scope?: string
          position?: number
          role_scope?: string
          starts_at?: string | null
          target_section?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dimension_weights: {
        Row: {
          category: string
          dimension: string
          weight: number
        }
        Insert: {
          category: string
          dimension: string
          weight: number
        }
        Update: {
          category?: string
          dimension?: string
          weight?: number
        }
        Relationships: []
      }
      employer_account: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          is_active: boolean
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          org_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_account_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "employer_org"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_org: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_verified: boolean
          legal_name: string | null
          name: string
          tax_id: string | null
          website: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          legal_name?: string | null
          name: string
          tax_id?: string | null
          website?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          legal_name?: string | null
          name?: string
          tax_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      external_rotation: {
        Row: {
          city: string | null
          country: string | null
          created_at: string
          end_date: string | null
          id: string
          latitude: number
          longitude: number
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          latitude: number
          longitude: number
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          latitude?: number
          longitude?: number
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_rotation_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      external_rotation_question: {
        Row: {
          id: string
          is_active: boolean
          is_optional: boolean
          position: number
          text: string
          type: Database["public"]["Enums"]["review_question_type"]
        }
        Insert: {
          id?: string
          is_active?: boolean
          is_optional?: boolean
          position: number
          text: string
          type?: Database["public"]["Enums"]["review_question_type"]
        }
        Update: {
          id?: string
          is_active?: boolean
          is_optional?: boolean
          position?: number
          text?: string
          type?: Database["public"]["Enums"]["review_question_type"]
        }
        Relationships: []
      }
      external_rotation_review: {
        Row: {
          approved_at: string | null
          city: string | null
          country: string
          created_at: string
          end_date: string | null
          external_hospital_name: string
          free_comment: string | null
          id: string
          is_anonymous: boolean
          is_approved: boolean
          rotation_id: string
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          city?: string | null
          country: string
          created_at?: string
          end_date?: string | null
          external_hospital_name: string
          free_comment?: string | null
          id?: string
          is_anonymous?: boolean
          is_approved?: boolean
          rotation_id: string
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          city?: string | null
          country?: string
          created_at?: string
          end_date?: string | null
          external_hospital_name?: string
          free_comment?: string | null
          id?: string
          is_anonymous?: boolean
          is_approved?: boolean
          rotation_id?: string
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_rotation_review_rotation_id_fkey"
            columns: ["rotation_id"]
            isOneToOne: false
            referencedRelation: "external_rotation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_rotation_review_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      external_rotation_review_answer: {
        Row: {
          question_id: string
          rating_value: number | null
          review_id: string
          text_value: string | null
        }
        Insert: {
          question_id: string
          rating_value?: number | null
          review_id: string
          text_value?: string | null
        }
        Update: {
          question_id?: string
          rating_value?: number | null
          review_id?: string
          text_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_rotation_review_answer_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "external_rotation_question"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_rotation_review_answer_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "external_rotation_review"
            referencedColumns: ["id"]
          },
        ]
      }
      external_rotation_review_image: {
        Row: {
          created_at: string
          id: string
          path: string
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_rotation_review_image_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "external_rotation_review"
            referencedColumns: ["id"]
          },
        ]
      }
      external_rotation_review_thread: {
        Row: {
          review_id: string
          thread_id: string
        }
        Insert: {
          review_id: string
          thread_id: string
        }
        Update: {
          review_id?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_rotation_review_thread_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "external_rotation_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_rotation_review_thread_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "thread"
            referencedColumns: ["id"]
          },
        ]
      }
      forum: {
        Row: {
          city: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          role_scope: string
          scope: Database["public"]["Enums"]["forum_scope"]
          speciality_id: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          role_scope: string
          scope: Database["public"]["Enums"]["forum_scope"]
          speciality_id?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          role_scope?: string
          scope?: Database["public"]["Enums"]["forum_scope"]
          speciality_id?: string | null
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          last_read_at: string | null
          notifications_muted: boolean | null
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          notifications_muted?: boolean | null
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          last_read_at?: string | null
          notifications_muted?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          content: string
          created_at: string | null
          edited_at: string | null
          group_id: string
          id: string
          is_deleted: boolean | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          edited_at?: string | null
          group_id: string
          id?: string
          is_deleted?: boolean | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          edited_at?: string | null
          group_id?: string
          id?: string
          is_deleted?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          city: string | null
          cohort_year: number | null
          created_at: string | null
          created_by_user_id: string | null
          description: string | null
          direct_pair_key: string | null
          hospital_id: string | null
          id: string
          is_active: boolean | null
          kind: string
          member_count: number | null
          name: string
          speciality_id: string | null
          user_type: string
        }
        Insert: {
          city?: string | null
          cohort_year?: number | null
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          direct_pair_key?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean | null
          kind?: string
          member_count?: number | null
          name: string
          speciality_id?: string | null
          user_type: string
        }
        Update: {
          city?: string | null
          cohort_year?: number | null
          created_at?: string | null
          created_by_user_id?: string | null
          description?: string | null
          direct_pair_key?: string | null
          hospital_id?: string | null
          id?: string
          is_active?: boolean | null
          kind?: string
          member_count?: number | null
          name?: string
          speciality_id?: string | null
          user_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_user_id_fkey"
            columns: ["created_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_speciality_id_fkey"
            columns: ["speciality_id"]
            isOneToOne: false
            referencedRelation: "specialities"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_specialities: {
        Row: {
          grade_2019: number | null
          grade_2020: number | null
          grade_2021: number | null
          grade_2022: number | null
          grade_2023: number | null
          grade_2024: number | null
          grade_2025: number | null
          hospital_id: string
          info_note: string | null
          slots: number | null
          speciality_id: string
        }
        Insert: {
          grade_2019?: number | null
          grade_2020?: number | null
          grade_2021?: number | null
          grade_2022?: number | null
          grade_2023?: number | null
          grade_2024?: number | null
          grade_2025?: number | null
          hospital_id: string
          info_note?: string | null
          slots?: number | null
          speciality_id: string
        }
        Update: {
          grade_2019?: number | null
          grade_2020?: number | null
          grade_2021?: number | null
          grade_2022?: number | null
          grade_2023?: number | null
          grade_2024?: number | null
          grade_2025?: number | null
          hospital_id?: string
          info_note?: string | null
          slots?: number | null
          speciality_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_specialities_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_specialities_speciality_id_fkey"
            columns: ["speciality_id"]
            isOneToOne: false
            referencedRelation: "specialities"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_speciality_grades: {
        Row: {
          created_at: string
          grades: number[]
          hospital_id: string
          slots: number
          speciality_id: string
          year: number
        }
        Insert: {
          created_at?: string
          grades: number[]
          hospital_id: string
          slots?: number
          speciality_id: string
          year: number
        }
        Update: {
          created_at?: string
          grades?: number[]
          hospital_id?: string
          slots?: number
          speciality_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hospital_speciality_grades_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospital_speciality_grades_speciality_id_fkey"
            columns: ["speciality_id"]
            isOneToOne: false
            referencedRelation: "specialities"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          city: string
          created_at: string | null
          created_by: string | null
          email_domain: string | null
          id: string
          name: string
          ownership: Database["public"]["Enums"]["ownership_type"]
          region: string
          salary_r1_fixed_eur: number | null
          salary_r2_fixed_eur: number | null
          salary_r3_fixed_eur: number | null
          salary_r4_fixed_eur: number | null
        }
        Insert: {
          city: string
          created_at?: string | null
          created_by?: string | null
          email_domain?: string | null
          id?: string
          name: string
          ownership?: Database["public"]["Enums"]["ownership_type"]
          region: string
          salary_r1_fixed_eur?: number | null
          salary_r2_fixed_eur?: number | null
          salary_r3_fixed_eur?: number | null
          salary_r4_fixed_eur?: number | null
        }
        Update: {
          city?: string
          created_at?: string | null
          created_by?: string | null
          email_domain?: string | null
          id?: string
          name?: string
          ownership?: Database["public"]["Enums"]["ownership_type"]
          region?: string
          salary_r1_fixed_eur?: number | null
          salary_r2_fixed_eur?: number | null
          salary_r3_fixed_eur?: number | null
          salary_r4_fixed_eur?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "hospitals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      housing_ad: {
        Row: {
          available_from: string | null
          available_to: string | null
          city: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string
          hospital_id: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["housing_ad_kind"]
          preferred_contact: string | null
          price_eur: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_from?: string | null
          available_to?: string | null
          city: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description: string
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["housing_ad_kind"]
          preferred_contact?: string | null
          price_eur?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_from?: string | null
          available_to?: string | null
          city?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string
          hospital_id?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["housing_ad_kind"]
          preferred_contact?: string | null
          price_eur?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "housing_ad_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "housing_ad_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      housing_ad_image: {
        Row: {
          ad_id: string
          created_at: string
          id: string
          object_path: string
          position: number
        }
        Insert: {
          ad_id: string
          created_at?: string
          id?: string
          object_path: string
          position?: number
        }
        Update: {
          ad_id?: string
          created_at?: string
          id?: string
          object_path?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "housing_ad_image_ad_id_fkey"
            columns: ["ad_id"]
            isOneToOne: false
            referencedRelation: "housing_ad"
            referencedColumns: ["id"]
          },
        ]
      }
      job: {
        Row: {
          application_email: string | null
          application_phone: string | null
          application_url: string | null
          audience: Database["public"]["Enums"]["job_audience"]
          city: string
          contract_type: Database["public"]["Enums"]["job_contract_type"] | null
          country: string
          created_at: string
          created_by_id: string
          description: string
          expires_at: string | null
          facility_name: string | null
          facility_ownership:
            | Database["public"]["Enums"]["ownership_type"]
            | null
          id: string
          org_id: string
          published_at: string | null
          region: string | null
          salary_max_eur: number | null
          salary_min_eur: number | null
          salary_text: string | null
          speciality_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          work_mode: Database["public"]["Enums"]["work_mode"] | null
        }
        Insert: {
          application_email?: string | null
          application_phone?: string | null
          application_url?: string | null
          audience?: Database["public"]["Enums"]["job_audience"]
          city: string
          contract_type?:
            | Database["public"]["Enums"]["job_contract_type"]
            | null
          country?: string
          created_at?: string
          created_by_id: string
          description: string
          expires_at?: string | null
          facility_name?: string | null
          facility_ownership?:
            | Database["public"]["Enums"]["ownership_type"]
            | null
          id?: string
          org_id: string
          published_at?: string | null
          region?: string | null
          salary_max_eur?: number | null
          salary_min_eur?: number | null
          salary_text?: string | null
          speciality_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          work_mode?: Database["public"]["Enums"]["work_mode"] | null
        }
        Update: {
          application_email?: string | null
          application_phone?: string | null
          application_url?: string | null
          audience?: Database["public"]["Enums"]["job_audience"]
          city?: string
          contract_type?:
            | Database["public"]["Enums"]["job_contract_type"]
            | null
          country?: string
          created_at?: string
          created_by_id?: string
          description?: string
          expires_at?: string | null
          facility_name?: string | null
          facility_ownership?:
            | Database["public"]["Enums"]["ownership_type"]
            | null
          id?: string
          org_id?: string
          published_at?: string | null
          region?: string | null
          salary_max_eur?: number | null
          salary_min_eur?: number | null
          salary_text?: string | null
          speciality_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          work_mode?: Database["public"]["Enums"]["work_mode"] | null
        }
        Relationships: [
          {
            foreignKeyName: "job_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "employer_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "employer_org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_speciality_id_fkey"
            columns: ["speciality_id"]
            isOneToOne: false
            referencedRelation: "specialities"
            referencedColumns: ["id"]
          },
        ]
      }
      libro_book: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          residency_year: number
          section: Database["public"]["Enums"]["libro_section_code"]
          status: Database["public"]["Enums"]["libro_book_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          residency_year: number
          section: Database["public"]["Enums"]["libro_section_code"]
          status?: Database["public"]["Enums"]["libro_book_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          residency_year?: number
          section?: Database["public"]["Enums"]["libro_section_code"]
          status?: Database["public"]["Enums"]["libro_book_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "libro_book_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      libro_entry: {
        Row: {
          count: number
          created_at: string | null
          id: string
          kind: Database["public"]["Enums"]["libro_entry_kind"]
          node_id: string
          notes: string | null
          residency_year: number | null
          section: Database["public"]["Enums"]["libro_section_code"]
        }
        Insert: {
          count: number
          created_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["libro_entry_kind"]
          node_id: string
          notes?: string | null
          residency_year?: number | null
          section: Database["public"]["Enums"]["libro_section_code"]
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["libro_entry_kind"]
          node_id?: string
          notes?: string | null
          residency_year?: number | null
          section?: Database["public"]["Enums"]["libro_section_code"]
        }
        Relationships: [
          {
            foreignKeyName: "libro_entry_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "libro_node"
            referencedColumns: ["id"]
          },
        ]
      }
      libro_event: {
        Row: {
          created_at: string
          entry_id: string
          event_date: string
          hours: number | null
          id: string
          location: string | null
          node_id: string | null
          notes: string | null
          residency_year: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          event_date: string
          hours?: number | null
          id?: string
          location?: string | null
          node_id?: string | null
          notes?: string | null
          residency_year: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          event_date?: string
          hours?: number | null
          id?: string
          location?: string | null
          node_id?: string | null
          notes?: string | null
          residency_year?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "libro_event_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "libro_entry"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_event_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "libro_node"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_event_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      libro_node: {
        Row: {
          book_id: string
          created_at: string | null
          goal: number | null
          id: string
          name: string
          parent_node_id: string | null
          position: number | null
          section: Database["public"]["Enums"]["libro_section_code"] | null
          total_count: number
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string | null
          goal?: number | null
          id?: string
          name: string
          parent_node_id?: string | null
          position?: number | null
          section?: Database["public"]["Enums"]["libro_section_code"] | null
          total_count?: number
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string | null
          goal?: number | null
          id?: string
          name?: string
          parent_node_id?: string | null
          position?: number | null
          section?: Database["public"]["Enums"]["libro_section_code"] | null
          total_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "libro_node_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "libro_book"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_node_parent_node_id_fkey"
            columns: ["parent_node_id"]
            isOneToOne: false
            referencedRelation: "libro_node"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "libro_node_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      libro_section: {
        Row: {
          code: Database["public"]["Enums"]["libro_section_code"]
          display_name: string
        }
        Insert: {
          code: Database["public"]["Enums"]["libro_section_code"]
          display_name: string
        }
        Update: {
          code?: Database["public"]["Enums"]["libro_section_code"]
          display_name?: string
        }
        Relationships: []
      }
      mir_simulator_searches: {
        Row: {
          created_at: string
          grade: number
          id: string
          speciality_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          grade: number
          id?: string
          speciality_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          grade?: number
          id?: string
          speciality_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mir_simulator_searches_speciality_id_fkey"
            columns: ["speciality_id"]
            isOneToOne: false
            referencedRelation: "specialities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mir_simulator_searches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          created_at: string
          id: string
          notification_id: string
          provider_response: Json | null
          push_token_id: string | null
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_id: string
          provider_response?: Json | null
          push_token_id?: string | null
          sent_at?: string | null
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_id?: string
          provider_response?: Json | null
          push_token_id?: string | null
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_push_token_id_fkey"
            columns: ["push_token_id"]
            isOneToOne: false
            referencedRelation: "push_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_types: {
        Row: {
          code: string
          created_at: string
          description: string
        }
        Insert: {
          code: string
          created_at?: string
          description: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_user_id: string | null
          body: string
          created_at: string
          data: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          actor_user_id?: string | null
          body: string
          created_at?: string
          data?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          actor_user_id?: string | null
          body?: string
          created_at?: string
          data?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_type_fkey"
            columns: ["type"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      post: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_post_id: string | null
          thread_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_post_id?: string | null
          thread_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_post_id?: string | null
          thread_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_parent_post_id_fkey"
            columns: ["parent_post_id"]
            isOneToOne: false
            referencedRelation: "post"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "thread"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          app_version: string | null
          created_at: string
          device_name: string | null
          id: string
          is_valid: boolean
          last_seen_at: string
          platform: string
          provider: string
          token: string
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_name?: string | null
          id?: string
          is_valid?: boolean
          last_seen_at?: string
          platform: string
          provider?: string
          token: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_name?: string | null
          id?: string
          is_valid?: boolean
          last_seen_at?: string
          platform?: string
          provider?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      question: {
        Row: {
          id: string
          is_active: boolean
          is_optional: boolean
          position: number
          text: string
          type: Database["public"]["Enums"]["review_question_type"]
        }
        Insert: {
          id?: string
          is_active?: boolean
          is_optional?: boolean
          position: number
          text: string
          type?: Database["public"]["Enums"]["review_question_type"]
        }
        Update: {
          id?: string
          is_active?: boolean
          is_optional?: boolean
          position?: number
          text?: string
          type?: Database["public"]["Enums"]["review_question_type"]
        }
        Relationships: []
      }
      raffle: {
        Row: {
          created_at: string
          draw_at: string | null
          ends_at: string
          id: string
          min_invites: number
          name: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          draw_at?: string | null
          ends_at: string
          id?: string
          min_invites?: number
          name: string
          starts_at: string
        }
        Update: {
          created_at?: string
          draw_at?: string | null
          ends_at?: string
          id?: string
          min_invites?: number
          name?: string
          starts_at?: string
        }
        Relationships: []
      }
      referral: {
        Row: {
          created_at: string
          id: string
          raffle_id: string
          referral_code_used: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          raffle_id: string
          referral_code_used: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          raffle_id?: string
          referral_code_used?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_raffle_id_fkey"
            columns: ["raffle_id"]
            isOneToOne: false
            referencedRelation: "raffle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_referrer_user_id_fkey"
            columns: ["referrer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_monthly_payouts: {
        Row: {
          created_at: string
          friday_guard_count: number
          gross_total_eur: number
          guard_count: number
          has_double_pay: boolean
          holiday_guard_count: number
          has_pending_payment: boolean
          id: string
          pending_payment_description: string | null
          period_month: number
          period_year: number
          saturday_guard_count: number
          sunday_guard_count: number
          strike_count: number
          updated_at: string
          user_id: string
          weekday_guard_count: number
        }
        Insert: {
          created_at?: string
          friday_guard_count?: number
          gross_total_eur: number
          guard_count?: number
          has_double_pay?: boolean
          holiday_guard_count?: number
          has_pending_payment?: boolean
          id?: string
          pending_payment_description?: string | null
          period_month: number
          period_year: number
          saturday_guard_count?: number
          sunday_guard_count?: number
          strike_count?: number
          updated_at?: string
          user_id: string
          weekday_guard_count?: number
        }
        Update: {
          created_at?: string
          friday_guard_count?: number
          gross_total_eur?: number
          guard_count?: number
          has_double_pay?: boolean
          holiday_guard_count?: number
          has_pending_payment?: boolean
          id?: string
          pending_payment_description?: string | null
          period_month?: number
          period_year?: number
          saturday_guard_count?: number
          sunday_guard_count?: number
          strike_count?: number
          updated_at?: string
          user_id?: string
          weekday_guard_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "resident_monthly_payouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      review: {
        Row: {
          approved_at: string
          created_at: string
          free_comment: string | null
          hospital_id: string
          id: string
          is_anonymous: boolean
          is_approved: boolean
          speciality_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string
          created_at?: string
          free_comment?: string | null
          hospital_id: string
          id?: string
          is_anonymous?: boolean
          is_approved?: boolean
          speciality_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string
          created_at?: string
          free_comment?: string | null
          hospital_id?: string
          id?: string
          is_anonymous?: boolean
          is_approved?: boolean
          speciality_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_speciality_id_fkey"
            columns: ["speciality_id"]
            isOneToOne: false
            referencedRelation: "specialities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      review_answer: {
        Row: {
          question_id: string
          rating_value: number | null
          review_id: string
          text_value: string | null
        }
        Insert: {
          question_id: string
          rating_value?: number | null
          review_id: string
          text_value?: string | null
        }
        Update: {
          question_id?: string
          rating_value?: number | null
          review_id?: string
          text_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_answer_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_answer_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "review"
            referencedColumns: ["id"]
          },
        ]
      }
      review_image: {
        Row: {
          created_at: string
          id: string
          path: string
          review_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          review_id: string
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          review_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_image_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "review"
            referencedColumns: ["id"]
          },
        ]
      }
      review_question: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          question_text: string
          speciality_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          question_text: string
          speciality_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          question_text?: string
          speciality_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_question_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_question_speciality_id_fkey"
            columns: ["speciality_id"]
            isOneToOne: false
            referencedRelation: "specialities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_question_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      review_question_answer: {
        Row: {
          answer_text: string
          created_at: string
          id: string
          question_id: string
          user_id: string
        }
        Insert: {
          answer_text: string
          created_at?: string
          id?: string
          question_id: string
          user_id: string
        }
        Update: {
          answer_text?: string
          created_at?: string
          id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_question_answer_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "review_question"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_question_answer_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_purchase_requests: {
        Row: {
          buyer_id: string
          created_at: string
          id: string
          offered_price_eur: number | null
          owner_id: string
          shift_id: string
          status: string
          updated_at: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          id?: string
          offered_price_eur?: number | null
          owner_id: string
          shift_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          id?: string
          offered_price_eur?: number | null
          owner_id?: string
          shift_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_purchase_requests_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_purchase_requests_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_purchase_requests_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          created_at: string
          id: string
          requester_shift_id: string
          status: string
          target_shift_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_shift_id: string
          status?: string
          target_shift_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_shift_id?: string
          status?: string
          target_shift_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_requester_shift_id_fkey"
            columns: ["requester_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_target_shift_id_fkey"
            columns: ["target_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string | null
          date: string
          id: string
          notes: string | null
          price_eur: number | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          price_eur?: number | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          price_eur?: number | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      specialities: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      speciality_dimension_score: {
        Row: {
          dimension: string
          id: string
          ideal_value: number
          speciality_key: string
          speciality_weight: number | null
        }
        Insert: {
          dimension: string
          id?: string
          ideal_value: number
          speciality_key: string
          speciality_weight?: number | null
        }
        Update: {
          dimension?: string
          id?: string
          ideal_value?: number
          speciality_key?: string
          speciality_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "speciality_dimension_score_dimension_fkey"
            columns: ["dimension"]
            isOneToOne: false
            referencedRelation: "dimension_weights"
            referencedColumns: ["dimension"]
          },
          {
            foreignKeyName: "speciality_dimension_score_speciality_key_fkey"
            columns: ["speciality_key"]
            isOneToOne: false
            referencedRelation: "speciality_profile"
            referencedColumns: ["speciality_key"]
          },
        ]
      }
      speciality_profile: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          name: string
          speciality_key: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          id?: string
          name: string
          speciality_key: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          speciality_key?: string
        }
        Relationships: []
      }
      speciality_quiz_answer: {
        Row: {
          created_at: string
          id: string
          question_id: string
          session_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          question_id: string
          session_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          question_id?: string
          session_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "speciality_quiz_answer_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "speciality_quiz_question"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "speciality_quiz_answer_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "speciality_quiz_session"
            referencedColumns: ["id"]
          },
        ]
      }
      speciality_quiz_option: {
        Row: {
          id: string
          label: string
          order_index: number
          question_id: string
          value: number
        }
        Insert: {
          id?: string
          label: string
          order_index: number
          question_id: string
          value: number
        }
        Update: {
          id?: string
          label?: string
          order_index?: number
          question_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "speciality_quiz_option_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "speciality_quiz_question"
            referencedColumns: ["id"]
          },
        ]
      }
      speciality_quiz_question: {
        Row: {
          dimension: string
          id: string
          order_index: number
          question_type: string
          text: string
        }
        Insert: {
          dimension: string
          id?: string
          order_index: number
          question_type?: string
          text: string
        }
        Update: {
          dimension?: string
          id?: string
          order_index?: number
          question_type?: string
          text?: string
        }
        Relationships: []
      }
      speciality_quiz_session: {
        Row: {
          finished_at: string | null
          id: string
          meta: Json | null
          raw_scores: Json | null
          started_at: string
          top_results: Json | null
          user_id: string | null
        }
        Insert: {
          finished_at?: string | null
          id?: string
          meta?: Json | null
          raw_scores?: Json | null
          started_at?: string
          top_results?: Json | null
          user_id?: string | null
        }
        Update: {
          finished_at?: string | null
          id?: string
          meta?: Json | null
          raw_scores?: Json | null
          started_at?: string
          top_results?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "speciality_quiz_session_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      thread: {
        Row: {
          body: string | null
          created_at: string
          forum_id: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          forum_id: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          forum_id?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "forum"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "thread_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_transition_config: {
        Row: {
          created_at: string
          enabled: boolean
          ends_at: string
          key: string
          starts_at: string
          target_resident_year: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          ends_at: string
          key: string
          starts_at: string
          target_resident_year?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          ends_at?: string
          key?: string
          starts_at?: string
          target_resident_year?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_email_review_requests: {
        Row: {
          created_at: string
          id: string
          status: Database["public"]["Enums"]["user_email_review_status"]
          user_id: string
          work_email: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["user_email_review_status"]
          user_id: string
          work_email: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["user_email_review_status"]
          user_id?: string
          work_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_email_review_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_hospital_preferences: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          position: number
          speciality_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          position: number
          speciality_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          position?: number
          speciality_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_hospital_preferences_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_hospital_preferences_speciality_id_fkey"
            columns: ["speciality_id"]
            isOneToOne: false
            referencedRelation: "specialities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_preferences: {
        Row: {
          in_app_enabled: boolean
          notification_type: string
          push_enabled: boolean
          user_id: string
        }
        Insert: {
          in_app_enabled?: boolean
          notification_type: string
          push_enabled?: boolean
          user_id: string
        }
        Update: {
          in_app_enabled?: boolean
          notification_type?: string
          push_enabled?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_notification_preferences_notification_type_fkey"
            columns: ["notification_type"]
            isOneToOne: false
            referencedRelation: "notification_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          city: string | null
          created_at: string
          hospital_id: string | null
          id: string
          is_doctor: boolean | null
          is_resident: boolean | null
          is_student: boolean | null
          is_super_admin: boolean
          name: string | null
          phone: string | null
          resident_state:
            | Database["public"]["Enums"]["resident_lifecycle_state"]
            | null
          resident_transition_expires_at: string | null
          resident_transition_started_at: string | null
          referral_code: string | null
          resident_year: number | null
          speciality_id: string | null
          surname: string | null
          work_email: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          hospital_id?: string | null
          id: string
          is_doctor?: boolean | null
          is_resident?: boolean | null
          is_student?: boolean | null
          is_super_admin?: boolean
          name?: string | null
          phone?: string | null
          resident_state?:
            | Database["public"]["Enums"]["resident_lifecycle_state"]
            | null
          resident_transition_expires_at?: string | null
          resident_transition_started_at?: string | null
          referral_code?: string | null
          resident_year?: number | null
          speciality_id?: string | null
          surname?: string | null
          work_email?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          hospital_id?: string | null
          id?: string
          is_doctor?: boolean | null
          is_resident?: boolean | null
          is_student?: boolean | null
          is_super_admin?: boolean
          name?: string | null
          phone?: string | null
          resident_state?:
            | Database["public"]["Enums"]["resident_lifecycle_state"]
            | null
          resident_transition_expires_at?: string | null
          resident_transition_started_at?: string | null
          referral_code?: string | null
          resident_year?: number | null
          speciality_id?: string | null
          surname?: string | null
          work_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_speciality_id_fkey"
            columns: ["speciality_id"]
            isOneToOne: false
            referencedRelation: "specialities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_top_specialities: {
        Args: { session_uuid: string }
        Returns: {
          rank: number
          score: number
          speciality_key: string
          speciality_name: string
        }[]
      }
      ensure_direct_group: {
        Args: { p_other_user_id: string }
        Returns: {
          group_id: string
          group_name: string
          other_user_id: string
        }[]
      }
      generate_referral_code: { Args: never; Returns: string }
      get_direct_groups: {
        Args: Record<PropertyKey, never>
        Returns: {
          group_id: string
          kind: string
          last_message_at: string
          last_message_preview: string
          notifications_muted: boolean
          other_user_city: string
          other_user_hospital_name: string
          other_user_id: string
          other_user_name: string
          other_user_speciality_name: string
          other_user_surname: string
          unread_count: number
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      forum_scope:
        | "generic"
        | "speciality"
        | "ocio"
        | "clinic_cases"
        | "investigation"
        | "deporte"
        | "padel"
        | "tenis"
        | "futbol"
        | "deporte_otros"
      housing_ad_kind: "offer" | "seek"
      job_audience: "resident" | "doctor" | "both"
      job_contract_type:
        | "permanent"
        | "temporary"
        | "locum"
        | "fellowship"
        | "training"
        | "other"
      job_status: "draft" | "published" | "closed" | "archived"
      libro_book_status: "active" | "archived"
      libro_entry_kind: "counter" | "event"
      libro_section_code:
        | "clinical_practice"
        | "clinical_sessions"
        | "research_work"
        | "congress_attendance"
        | "workshop_attendance"
      ownership_type: "public" | "private" | "concertado" | "mixed" | "unknown"
      resident_lifecycle_state:
        | "active"
        | "pending_corporate_email_seasonal"
        | "locked_missing_corporate_email"
      review_question_type: "rating" | "text"
      user_email_review_status: "PENDING" | "APPROVED" | "REJECTED"
      work_mode: "onsite" | "hybrid" | "remote"
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
      forum_scope: [
        "generic",
        "speciality",
        "ocio",
        "clinic_cases",
        "investigation",
        "deporte",
        "padel",
        "tenis",
        "futbol",
        "deporte_otros",
      ],
      housing_ad_kind: ["offer", "seek"],
      job_audience: ["resident", "doctor", "both"],
      job_contract_type: [
        "permanent",
        "temporary",
        "locum",
        "fellowship",
        "training",
        "other",
      ],
      job_status: ["draft", "published", "closed", "archived"],
      libro_book_status: ["active", "archived"],
      libro_entry_kind: ["counter", "event"],
      libro_section_code: [
        "clinical_practice",
        "clinical_sessions",
        "research_work",
        "congress_attendance",
        "workshop_attendance",
      ],
      ownership_type: ["public", "private", "concertado", "mixed", "unknown"],
      resident_lifecycle_state: [
        "active",
        "pending_corporate_email_seasonal",
        "locked_missing_corporate_email",
      ],
      review_question_type: ["rating", "text"],
      user_email_review_status: ["PENDING", "APPROVED", "REJECTED"],
      work_mode: ["onsite", "hybrid", "remote"],
    },
  },
} as const

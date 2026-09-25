// ==============================================================================
// GESTÃO DE APOSTILAS - MICROLINS POTIRENDABA
// Types: types/database.ts
// Definições de tipos TypeScript alinhados ao schema PostgreSQL do Supabase
// ==============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'admin' | 'operator' | 'viewer';
export type OrderStatus = 'draft' | 'open' | 'archived' | 'editing' | 'cancelled';

export interface Database {
  public: {
    Tables: {
      units: {
        Row: {
          id: string;
          name: string;
          slug: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: UserRole;
          unit_id: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: UserRole;
          unit_id: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: UserRole;
          unit_id?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      unit_settings: {
        Row: {
          id: string;
          unit_id: string;
          default_lesson_from: number;
          default_lesson_to: number;
          ignored_subjects: string[];
          excluded_contract_types: string[];
          default_contract_status: string;
          default_delinquency: string;
          default_physical_delivery: string;
          institutional_blue: string;
          institutional_red: string;
          duplicate_background: string;
          duplicate_text: string;
          extra_blank_rows: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          default_lesson_from?: number;
          default_lesson_to?: number;
          ignored_subjects?: string[];
          excluded_contract_types?: string[];
          default_contract_status?: string;
          default_delinquency?: string;
          default_physical_delivery?: string;
          institutional_blue?: string;
          institutional_red?: string;
          duplicate_background?: string;
          duplicate_text?: string;
          extra_blank_rows?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          default_lesson_from?: number;
          default_lesson_to?: number;
          ignored_subjects?: string[];
          excluded_contract_types?: string[];
          default_contract_status?: string;
          default_delinquency?: string;
          default_physical_delivery?: string;
          institutional_blue?: string;
          institutional_red?: string;
          duplicate_background?: string;
          duplicate_text?: string;
          extra_blank_rows?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      educators: {
        Row: {
          id: string;
          unit_id: string;
          name: string;
          normalized_name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          name: string;
          normalized_name: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          name?: string;
          normalized_name?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          unit_id: string;
          order_number: string;
          sequence_num: number;
          title: string;
          status: OrderStatus;
          archived_at: string | null;
          competence_date: string;
          competence_month: number;
          competence_year: number;
          total_items: number;
          created_by: string | null;
          updated_by: string | null;
          original_order_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          order_number: string;
          sequence_num: number;
          title: string;
          status?: OrderStatus;
          archived_at?: string | null;
          competence_date?: string;
          competence_month: number;
          competence_year: number;
          total_items?: number;
          created_by?: string | null;
          updated_by?: string | null;
          original_order_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          order_number?: string;
          sequence_num?: number;
          title?: string;
          status?: OrderStatus;
          archived_at?: string | null;
          competence_date?: string;
          competence_month?: number;
          competence_year?: number;
          total_items?: number;
          created_by?: string | null;
          updated_by?: string | null;
          original_order_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          student_name: string;
          student_name_normalized: string;
          subject_name: string;
          subject_name_normalized: string;
          raw_subject_name: string | null;
          course_name: string | null;
          educator_name: string | null;
          contract_number: string | null;
          current_lesson: number;
          scheduled_day: string | null;
          scheduled_time: string | null;
          class_schedule: string | null;
          next_subject: string | null;
          phone: string | null;
          delivery_status: string;
          delivery_date: string | null;
          release_status: string;
          duplicate_fingerprint: string;
          is_internal_duplicate: boolean;
          is_historical_duplicate: boolean;
          historical_match_order_title: string | null;
          source_row: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          student_name: string;
          student_name_normalized: string;
          subject_name: string;
          subject_name_normalized: string;
          raw_subject_name?: string | null;
          course_name?: string | null;
          educator_name?: string | null;
          contract_number?: string | null;
          current_lesson?: number;
          scheduled_day?: string | null;
          scheduled_time?: string | null;
          class_schedule?: string | null;
          next_subject?: string | null;
          phone?: string | null;
          delivery_status?: string;
          delivery_date?: string | null;
          release_status?: string;
          duplicate_fingerprint: string;
          is_internal_duplicate?: boolean;
          is_historical_duplicate?: boolean;
          historical_match_order_title?: string | null;
          source_row?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          student_name?: string;
          student_name_normalized?: string;
          subject_name?: string;
          subject_name_normalized?: string;
          raw_subject_name?: string | null;
          course_name?: string | null;
          educator_name?: string | null;
          contract_number?: string | null;
          current_lesson?: number;
          scheduled_day?: string | null;
          scheduled_time?: string | null;
          class_schedule?: string | null;
          next_subject?: string | null;
          phone?: string | null;
          delivery_status?: string;
          delivery_date?: string | null;
          release_status?: string;
          duplicate_fingerprint?: string;
          is_internal_duplicate?: boolean;
          is_historical_duplicate?: boolean;
          historical_match_order_title?: string | null;
          source_row?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      import_files: {
        Row: {
          id: string;
          unit_id: string;
          order_id: string | null;
          filename: string;
          file_type: string;
          file_size_bytes: number;
          storage_path: string | null;
          total_rows: number;
          imported_rows: number;
          filtered_rows: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          order_id?: string | null;
          filename: string;
          file_type: string;
          file_size_bytes: number;
          storage_path?: string | null;
          total_rows?: number;
          imported_rows?: number;
          filtered_rows?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          order_id?: string | null;
          filename?: string;
          file_type?: string;
          file_size_bytes?: number;
          storage_path?: string | null;
          total_rows?: number;
          imported_rows?: number;
          filtered_rows?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          unit_id: string | null;
          user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          metadata: Json;
          ip_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          unit_id?: string | null;
          user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          metadata?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string | null;
          user_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          metadata?: Json;
          ip_address?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_next_order_sequence: {
        Args: { p_unit_id: string };
        Returns: { next_seq: number; next_number: string }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

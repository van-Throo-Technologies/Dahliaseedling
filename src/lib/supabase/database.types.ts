
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "admin_users": {
                  Row: {
                    "granted_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cultivar_references": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"name": string,"normalized_name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name": string,"normalized_name": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"name"?: string,"normalized_name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cultivar_references_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "account_type_label": string | null,"avatar_path": string | null,"bio": string | null,"country_code": string,"created_at": string,"display_name": string,"id": string,"is_suspended": boolean,"region_city": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_type_label"?: string | null,"avatar_path"?: string | null,"bio"?: string | null,"country_code": string,"created_at"?: string,"display_name": string,"id": string,"is_suspended"?: boolean,"region_city"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "account_type_label"?: string | null,"avatar_path"?: string | null,"bio"?: string | null,"country_code"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"is_suspended"?: boolean,"region_city"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"provenance_events": {
                  Row: {
                    "event_type": string,"from_holder_id": string | null,"id": string,"metadata": NonNullable<Json>,"occurred_at": string,"seedling_id": string,"to_holder_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "event_type": string,"from_holder_id"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"seedling_id": string,"to_holder_id"?: string | null
                  }
                  Update: {
                    "event_type"?: string,"from_holder_id"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"seedling_id"?: string,"to_holder_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "provenance_events_from_holder_id_fkey"
      columns: ["from_holder_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provenance_events_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provenance_events_to_holder_id_fkey"
      columns: ["to_holder_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seedling_identifiers": {
                  Row: {
                    "assigned_by": string,"created_at": string,"id": string,"identifier": string,"is_primary_for_user": boolean,"is_retired_alias": boolean,"kind": Database["public"]['Enums']["identifier_kind"],"seedling_id": string,"series_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "assigned_by": string,"created_at"?: string,"id"?: string,"identifier": string,"is_primary_for_user"?: boolean,"is_retired_alias"?: boolean,"kind": Database["public"]['Enums']["identifier_kind"],"seedling_id": string,"series_id"?: string | null
                  }
                  Update: {
                    "assigned_by"?: string,"created_at"?: string,"id"?: string,"identifier"?: string,"is_primary_for_user"?: boolean,"is_retired_alias"?: boolean,"kind"?: Database["public"]['Enums']["identifier_kind"],"seedling_id"?: string,"series_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seedling_identifiers_assigned_by_fkey"
      columns: ["assigned_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seedling_identifiers_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seedling_identifiers_series_id_fkey"
      columns: ["series_id"]
isOneToOne: false
      referencedRelation: "series"
      referencedColumns: ["id"]
    }
                  ]
                },"seedling_parentage": {
                  Row: {
                    "child_seedling_id": string,"created_at": string,"created_by": string,"id": string,"is_unknown": boolean,"notes": string | null,"parent_cultivar_id": string | null,"parent_seedling_id": string | null,"role": Database["public"]['Enums']["parent_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "child_seedling_id": string,"created_at"?: string,"created_by": string,"id"?: string,"is_unknown"?: boolean,"notes"?: string | null,"parent_cultivar_id"?: string | null,"parent_seedling_id"?: string | null,"role": Database["public"]['Enums']["parent_role"]
                  }
                  Update: {
                    "child_seedling_id"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"is_unknown"?: boolean,"notes"?: string | null,"parent_cultivar_id"?: string | null,"parent_seedling_id"?: string | null,"role"?: Database["public"]['Enums']["parent_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "seedling_parentage_child_seedling_id_fkey"
      columns: ["child_seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seedling_parentage_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seedling_parentage_parent_cultivar_id_fkey"
      columns: ["parent_cultivar_id"]
isOneToOne: false
      referencedRelation: "cultivar_references"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seedling_parentage_parent_seedling_id_fkey"
      columns: ["parent_seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    }
                  ]
                },"seedlings": {
                  Row: {
                    "created_at": string,"current_holder_id": string,"deleted_at": string | null,"first_grown_year": number | null,"id": string,"originator_id": string,"updated_at": string,"visibility": Database["public"]['Enums']["seedling_visibility"],"working_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"current_holder_id": string,"deleted_at"?: string | null,"first_grown_year"?: number | null,"id"?: string,"originator_id": string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["seedling_visibility"],"working_name"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"current_holder_id"?: string,"deleted_at"?: string | null,"first_grown_year"?: number | null,"id"?: string,"originator_id"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["seedling_visibility"],"working_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seedlings_current_holder_id_fkey"
      columns: ["current_holder_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seedlings_originator_id_fkey"
      columns: ["originator_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"series": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"name": string,"next_sequence": number,"owner_id": string,"pattern": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name": string,"next_sequence"?: number,"owner_id": string,"pattern": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"name"?: string,"next_sequence"?: number,"owner_id"?: string,"pattern"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "series_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "admin_set_suspended":
{ Args: { "suspended": boolean,"target_profile_id": string }; Returns: {
              "account_type_label": string | null,
"avatar_path": string | null,
"bio": string | null,
"country_code": string,
"created_at": string,
"display_name": string,
"id": string,
"is_suspended": boolean,
"region_city": string | null,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"attach_series_identifier":
{ Args: { "p_seedling_id": string,"p_series_id": string }; Returns: {
              "assigned_by": string,
"created_at": string,
"id": string,
"identifier": string,
"is_primary_for_user": boolean,
"is_retired_alias": boolean,
"kind": Database["public"]['Enums']["identifier_kind"],
"seedling_id": string,
"series_id": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "seedling_identifiers"
        isOneToOne: true
        isSetofReturn: false
      } },
"caller_can_participate":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"create_seedling":
{ Args: { "p_first_grown_year"?: number,"p_series_id"?: string,"p_visibility"?: Database["public"]['Enums']["seedling_visibility"],"p_working_name"?: string }; Returns: {
              "created_at": string,
"current_holder_id": string,
"deleted_at": string | null,
"first_grown_year": number | null,
"id": string,
"originator_id": string,
"updated_at": string,
"visibility": Database["public"]['Enums']["seedling_visibility"],
"working_name": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "seedlings"
        isOneToOne: true
        isSetofReturn: false
      } },
"create_series":
{ Args: { "p_include_year": boolean,"p_name": string }; Returns: {
              "active": boolean,
"created_at": string,
"id": string,
"name": string,
"next_sequence": number,
"owner_id": string,
"pattern": string
            }
                          SetofOptions: {
        from: "*"
        to: "series"
        isOneToOne: true
        isSetofReturn: false
      } },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"next_series_identifier":
{ Args: { "p_first_grown_year": number,"p_series_id": string }; Returns: string
                           },
"resolve_own_identifier":
{ Args: { "p_identifier": string }; Returns: {
              "is_retired_alias": boolean,"seedling_id": string
            }[]
                           },
"set_seedling_parent":
{ Args: { "p_cultivar_name"?: string,"p_kind": string,"p_notes"?: string,"p_parent_seedling_id"?: string,"p_role": Database["public"]['Enums']["parent_role"],"p_seedling_id": string }; Returns: {
              "child_seedling_id": string,
"created_at": string,
"created_by": string,
"id": string,
"is_unknown": boolean,
"notes": string | null,
"parent_cultivar_id": string | null,
"parent_seedling_id": string | null,
"role": Database["public"]['Enums']["parent_role"]
            }
                          SetofOptions: {
        from: "*"
        to: "seedling_parentage"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "identifier_kind": "automatic"|"series"|"originator"|"local"|"working_alias","parent_role": "seed_parent"|"pollen_parent"|"parent_unknown_role","seedling_visibility": "private"|"public"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "identifier_kind": ["automatic", "series", "originator", "local", "working_alias"],"parent_role": ["seed_parent", "pollen_parent", "parent_unknown_role"],"seedling_visibility": ["private", "public"]
          }
        }
} as const

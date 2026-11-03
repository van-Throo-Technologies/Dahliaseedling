
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
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"deleted_at": string | null,"edited_at": string | null,"id": string,"parent_comment_id": string | null,"update_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"parent_comment_id"?: string | null,"update_id": string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"deleted_at"?: string | null,"edited_at"?: string | null,"id"?: string,"parent_comment_id"?: string | null,"update_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_parent_comment_id_fkey"
      columns: ["parent_comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "comments_update_id_fkey"
      columns: ["update_id"]
isOneToOne: false
      referencedRelation: "updates"
      referencedColumns: ["id"]
    }
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
                },"grower_follows": {
                  Row: {
                    "created_at": string,"followed_profile_id": string,"follower_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"followed_profile_id": string,"follower_id": string
                  }
                  Update: {
                    "created_at"?: string,"followed_profile_id"?: string,"follower_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grower_follows_followed_profile_id_fkey"
      columns: ["followed_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "grower_follows_follower_id_fkey"
      columns: ["follower_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"likes": {
                  Row: {
                    "created_at": string,"update_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"update_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"update_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "likes_update_id_fkey"
      columns: ["update_id"]
isOneToOne: false
      referencedRelation: "updates"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "likes_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"media": {
                  Row: {
                    "byte_size": number,"created_at": string,"deleted_at": string | null,"duration_seconds": number | null,"height": number | null,"id": string,"kind": Database["public"]['Enums']["media_kind"],"mime_type": string,"owner_id": string,"public_derivative_path": string | null,"storage_path": string,"visibility": Database["public"]['Enums']["media_visibility"],"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "byte_size": number,"created_at"?: string,"deleted_at"?: string | null,"duration_seconds"?: number | null,"height"?: number | null,"id"?: string,"kind": Database["public"]['Enums']["media_kind"],"mime_type": string,"owner_id": string,"public_derivative_path"?: string | null,"storage_path": string,"visibility"?: Database["public"]['Enums']["media_visibility"],"width"?: number | null
                  }
                  Update: {
                    "byte_size"?: number,"created_at"?: string,"deleted_at"?: string | null,"duration_seconds"?: number | null,"height"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["media_kind"],"mime_type"?: string,"owner_id"?: string,"public_derivative_path"?: string | null,"storage_path"?: string,"visibility"?: Database["public"]['Enums']["media_visibility"],"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"observation_media": {
                  Row: {
                    "media_id": string,"observation_id": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "media_id": string,"observation_id": string,"sort_order"?: number
                  }
                  Update: {
                    "media_id"?: string,"observation_id"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "observation_media_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observation_media_observation_id_fkey"
      columns: ["observation_id"]
isOneToOne: false
      referencedRelation: "observations"
      referencedColumns: ["id"]
    }
                  ]
                },"observations": {
                  Row: {
                    "author_id": string,"created_at": string,"deleted_at": string | null,"id": string,"note": string | null,"observed_at": string,"seedling_id": string,"structured_data": NonNullable<Json>,"updated_at": string,"visibility": Database["public"]['Enums']["observation_visibility"],"voice_transcript": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"note"?: string | null,"observed_at": string,"seedling_id": string,"structured_data"?: NonNullable<Json>,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["observation_visibility"],"voice_transcript"?: string | null
                  }
                  Update: {
                    "author_id"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"note"?: string | null,"observed_at"?: string,"seedling_id"?: string,"structured_data"?: NonNullable<Json>,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["observation_visibility"],"voice_transcript"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "observations_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "observations_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
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
                    "event_type": string,"from_holder_id": string | null,"id": string,"metadata": NonNullable<Json>,"occurred_at": string,"rehome_case_id": string | null,"seedling_id": string,"to_holder_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "event_type": string,"from_holder_id"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"rehome_case_id"?: string | null,"seedling_id": string,"to_holder_id"?: string | null
                  }
                  Update: {
                    "event_type"?: string,"from_holder_id"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"occurred_at"?: string,"rehome_case_id"?: string | null,"seedling_id"?: string,"to_holder_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "provenance_events_from_holder_id_fkey"
      columns: ["from_holder_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "provenance_events_rehome_case_id_fkey"
      columns: ["rehome_case_id"]
isOneToOne: false
      referencedRelation: "rehome_cases"
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
                },"public_derivatives": {
                  Row: {
                    "byte_size": number,"created_at": string,"deleted_at": string | null,"height": number,"id": string,"mime_type": string,"owner_id": string,"source_media_id": string,"storage_path": string,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "byte_size": number,"created_at"?: string,"deleted_at"?: string | null,"height": number,"id"?: string,"mime_type"?: string,"owner_id": string,"source_media_id": string,"storage_path": string,"width": number
                  }
                  Update: {
                    "byte_size"?: number,"created_at"?: string,"deleted_at"?: string | null,"height"?: number,"id"?: string,"mime_type"?: string,"owner_id"?: string,"source_media_id"?: string,"storage_path"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "public_derivatives_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "public_derivatives_source_media_id_fkey"
      columns: ["source_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    }
                  ]
                },"rehome_cases": {
                  Row: {
                    "chosen_recipient_id": string | null,"closed_at": string | null,"created_at": string,"handover_method": string | null,"id": string,"note": string | null,"offering_holder_id": string,"price_text": string | null,"received_at": string | null,"seedling_id": string,"sent_at": string | null,"status": string,"term": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "chosen_recipient_id"?: string | null,"closed_at"?: string | null,"created_at"?: string,"handover_method"?: string | null,"id"?: string,"note"?: string | null,"offering_holder_id": string,"price_text"?: string | null,"received_at"?: string | null,"seedling_id": string,"sent_at"?: string | null,"status"?: string,"term"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "chosen_recipient_id"?: string | null,"closed_at"?: string | null,"created_at"?: string,"handover_method"?: string | null,"id"?: string,"note"?: string | null,"offering_holder_id"?: string,"price_text"?: string | null,"received_at"?: string | null,"seedling_id"?: string,"sent_at"?: string | null,"status"?: string,"term"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rehome_cases_chosen_recipient_id_fkey"
      columns: ["chosen_recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rehome_cases_offering_holder_id_fkey"
      columns: ["offering_holder_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rehome_cases_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    }
                  ]
                },"rehome_interests": {
                  Row: {
                    "created_at": string,"id": string,"interested_user_id": string,"rehome_case_id": string,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"interested_user_id": string,"rehome_case_id": string,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"interested_user_id"?: string,"rehome_case_id"?: string,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "rehome_interests_interested_user_id_fkey"
      columns: ["interested_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rehome_interests_rehome_case_id_fkey"
      columns: ["rehome_case_id"]
isOneToOne: false
      referencedRelation: "rehome_cases"
      referencedColumns: ["id"]
    }
                  ]
                },"saved_seedlings": {
                  Row: {
                    "created_at": string,"seedling_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"seedling_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"seedling_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "saved_seedlings_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "saved_seedlings_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seed_offer_interests": {
                  Row: {
                    "created_at": string,"id": string,"interested_user_id": string,"requested_quantity": string | null,"seed_offer_id": string,"withdrawn_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"interested_user_id": string,"requested_quantity"?: string | null,"seed_offer_id": string,"withdrawn_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"interested_user_id"?: string,"requested_quantity"?: string | null,"seed_offer_id"?: string,"withdrawn_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seed_offer_interests_interested_user_id_fkey"
      columns: ["interested_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_offer_interests_seed_offer_id_fkey"
      columns: ["seed_offer_id"]
isOneToOne: false
      referencedRelation: "seed_offers"
      referencedColumns: ["id"]
    }
                  ]
                },"seed_offer_media": {
                  Row: {
                    "derivative_id": string,"offer_id": string,"role": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "derivative_id": string,"offer_id": string,"role": string,"sort_order"?: number
                  }
                  Update: {
                    "derivative_id"?: string,"offer_id"?: string,"role"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "seed_offer_media_derivative_id_fkey"
      columns: ["derivative_id"]
isOneToOne: false
      referencedRelation: "public_derivatives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_offer_media_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: false
      referencedRelation: "seed_offers"
      referencedColumns: ["id"]
    }
                  ]
                },"seed_offers": {
                  Row: {
                    "closed_at": string | null,"created_at": string,"handover_method": string,"id": string,"is_active": boolean,"material_type": string,"mode": string,"note": string | null,"packet_size": number | null,"price_text": string | null,"seed_source_id": string,"seedhead_count": number | null,"seller_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"created_at"?: string,"handover_method": string,"id"?: string,"is_active"?: boolean,"material_type": string,"mode": string,"note"?: string | null,"packet_size"?: number | null,"price_text"?: string | null,"seed_source_id": string,"seedhead_count"?: number | null,"seller_id": string
                  }
                  Update: {
                    "closed_at"?: string | null,"created_at"?: string,"handover_method"?: string,"id"?: string,"is_active"?: boolean,"material_type"?: string,"mode"?: string,"note"?: string | null,"packet_size"?: number | null,"price_text"?: string | null,"seed_source_id"?: string,"seedhead_count"?: number | null,"seller_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seed_offers_seed_source_id_fkey"
      columns: ["seed_source_id"]
isOneToOne: false
      referencedRelation: "seed_sources"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_offers_seller_id_fkey"
      columns: ["seller_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"seed_sources": {
                  Row: {
                    "actual_parent_media_id": string | null,"collection_year": number | null,"created_at": string,"id": string,"notes": string | null,"owner_id": string,"source_cultivar_id": string | null,"source_seedling_id": string | null,"source_unidentified_id": string | null,"source_unknown_mixed": boolean
                  }
                  ComputedFields: never
                  Insert: {
                    "actual_parent_media_id"?: string | null,"collection_year"?: number | null,"created_at"?: string,"id"?: string,"notes"?: string | null,"owner_id": string,"source_cultivar_id"?: string | null,"source_seedling_id"?: string | null,"source_unidentified_id"?: string | null,"source_unknown_mixed"?: boolean
                  }
                  Update: {
                    "actual_parent_media_id"?: string | null,"collection_year"?: number | null,"created_at"?: string,"id"?: string,"notes"?: string | null,"owner_id"?: string,"source_cultivar_id"?: string | null,"source_seedling_id"?: string | null,"source_unidentified_id"?: string | null,"source_unknown_mixed"?: boolean
                  }
                  Relationships: [
                    {
      foreignKeyName: "seed_sources_actual_parent_media_id_fkey"
      columns: ["actual_parent_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_sources_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_sources_source_cultivar_id_fkey"
      columns: ["source_cultivar_id"]
isOneToOne: false
      referencedRelation: "cultivar_references"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_sources_source_seedling_id_fkey"
      columns: ["source_seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seed_sources_source_unidentified_id_fkey"
      columns: ["source_unidentified_id"]
isOneToOne: false
      referencedRelation: "unidentified_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"seedling_follows": {
                  Row: {
                    "created_at": string,"seedling_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"seedling_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"seedling_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seedling_follows_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seedling_follows_user_id_fkey"
      columns: ["user_id"]
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
                    "child_seedling_id": string,"created_at": string,"created_by": string,"id": string,"is_unknown": boolean,"notes": string | null,"parent_cultivar_id": string | null,"parent_seedling_id": string | null,"parent_unidentified_source_id": string | null,"role": Database["public"]['Enums']["parent_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "child_seedling_id": string,"created_at"?: string,"created_by": string,"id"?: string,"is_unknown"?: boolean,"notes"?: string | null,"parent_cultivar_id"?: string | null,"parent_seedling_id"?: string | null,"parent_unidentified_source_id"?: string | null,"role": Database["public"]['Enums']["parent_role"]
                  }
                  Update: {
                    "child_seedling_id"?: string,"created_at"?: string,"created_by"?: string,"id"?: string,"is_unknown"?: boolean,"notes"?: string | null,"parent_cultivar_id"?: string | null,"parent_seedling_id"?: string | null,"parent_unidentified_source_id"?: string | null,"role"?: Database["public"]['Enums']["parent_role"]
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
    },{
      foreignKeyName: "seedling_parentage_parent_unidentified_source_id_fkey"
      columns: ["parent_unidentified_source_id"]
isOneToOne: false
      referencedRelation: "unidentified_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"seedlings": {
                  Row: {
                    "cover_derivative_id": string | null,"created_at": string,"current_holder_id": string,"deleted_at": string | null,"first_grown_year": number | null,"id": string,"originator_id": string,"updated_at": string,"visibility": Database["public"]['Enums']["seedling_visibility"],"working_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_derivative_id"?: string | null,"created_at"?: string,"current_holder_id": string,"deleted_at"?: string | null,"first_grown_year"?: number | null,"id"?: string,"originator_id": string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["seedling_visibility"],"working_name"?: string | null
                  }
                  Update: {
                    "cover_derivative_id"?: string | null,"created_at"?: string,"current_holder_id"?: string,"deleted_at"?: string | null,"first_grown_year"?: number | null,"id"?: string,"originator_id"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["seedling_visibility"],"working_name"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "seedlings_cover_derivative_id_fkey"
      columns: ["cover_derivative_id"]
isOneToOne: false
      referencedRelation: "public_derivatives"
      referencedColumns: ["id"]
    },{
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
                },"unidentified_source_photos": {
                  Row: {
                    "media_id": string,"sort_order": number,"source_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "media_id": string,"sort_order"?: number,"source_id": string
                  }
                  Update: {
                    "media_id"?: string,"sort_order"?: number,"source_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "unidentified_source_photos_media_id_fkey"
      columns: ["media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "unidentified_source_photos_source_id_fkey"
      columns: ["source_id"]
isOneToOne: false
      referencedRelation: "unidentified_sources"
      referencedColumns: ["id"]
    }
                  ]
                },"unidentified_sources": {
                  Row: {
                    "created_at": string,"created_by": string,"description": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by": string,"description"?: string | null,"id"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string,"description"?: string | null,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "unidentified_sources_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"update_media": {
                  Row: {
                    "derivative_id": string,"sort_order": number,"update_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "derivative_id": string,"sort_order"?: number,"update_id": string
                  }
                  Update: {
                    "derivative_id"?: string,"sort_order"?: number,"update_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "update_media_derivative_id_fkey"
      columns: ["derivative_id"]
isOneToOne: false
      referencedRelation: "public_derivatives"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "update_media_update_id_fkey"
      columns: ["update_id"]
isOneToOne: false
      referencedRelation: "updates"
      referencedColumns: ["id"]
    }
                  ]
                },"updates": {
                  Row: {
                    "author_id": string,"caption": string | null,"client_key": string,"created_at": string,"deleted_at": string | null,"id": string,"observed_at": string,"published_at": string,"seedling_id": string,"source_observation_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"caption"?: string | null,"client_key": string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"observed_at": string,"published_at"?: string,"seedling_id": string,"source_observation_id": string,"updated_at"?: string
                  }
                  Update: {
                    "author_id"?: string,"caption"?: string | null,"client_key"?: string,"created_at"?: string,"deleted_at"?: string | null,"id"?: string,"observed_at"?: string,"published_at"?: string,"seedling_id"?: string,"source_observation_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "updates_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "updates_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "updates_source_observation_id_fkey"
      columns: ["source_observation_id"]
isOneToOne: false
      referencedRelation: "observations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_derivative_is_public":
{ Args: { "p_derivative_id": string }; Returns: boolean
                           },
"_media_object_unregistered":
{ Args: { "p_name": string }; Returns: boolean
                           },
"_public_media_object_is_public":
{ Args: { "p_name": string }; Returns: boolean
                           },
"_public_media_object_unregistered":
{ Args: { "p_name": string }; Returns: boolean
                           },
"_register_media_object":
{ Args: { "p_path": string }; Returns: string
                           },
"_seed_offer_is_public":
{ Args: { "p_offer_id": string }; Returns: boolean
                           },
"_seed_source_is_public":
{ Args: { "p_source_id": string }; Returns: boolean
                           },
"_unidentified_source_is_owned":
{ Args: { "p_source_id": string }; Returns: boolean
                           },
"_unidentified_source_is_public":
{ Args: { "p_source_id": string }; Returns: boolean
                           },
"_update_is_public":
{ Args: { "p_update_id": string }; Returns: boolean
                           },
"add_comment":
{ Args: { "p_body": string,"p_parent_comment_id"?: string,"p_update_id": string }; Returns: string
                           },
"add_unidentified_source_photo":
{ Args: { "p_media_id": string,"p_source_id": string }; Returns: undefined
                           },
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
"cancel_rehome":
{ Args: { "p_case_id": string }; Returns: boolean
                           },
"capture_observation":
{ Args: { "p_new_seedling"?: boolean,"p_note"?: string,"p_observed_at"?: string,"p_paths"?: (string)[],"p_seedling_id"?: string,"p_voice_transcript"?: string }; Returns: {
              "author_id": string,
"created_at": string,
"deleted_at": string | null,
"id": string,
"note": string | null,
"observed_at": string,
"seedling_id": string,
"structured_data": NonNullable<Json>,
"updated_at": string,
"visibility": Database["public"]['Enums']["observation_visibility"],
"voice_transcript": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "observations"
        isOneToOne: true
        isSetofReturn: false
      } },
"choose_rehome_recipient":
{ Args: { "p_case_id": string,"p_recipient_id": string }; Returns: string
                           },
"close_seed_offer":
{ Args: { "p_offer_id": string }; Returns: boolean
                           },
"confirm_rehome_received":
{ Args: { "p_case_id": string }; Returns: string
                           },
"create_seed_source":
{ Args: { "p_collection_year"?: number,"p_cultivar_name"?: string,"p_kind": string,"p_notes"?: string,"p_seedling_id"?: string,"p_unidentified_source_id"?: string }; Returns: string
                           },
"create_seedling":
{ Args: { "p_first_grown_year"?: number,"p_series_id"?: string,"p_visibility"?: Database["public"]['Enums']["seedling_visibility"],"p_working_name"?: string }; Returns: {
              "cover_derivative_id": string | null,
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
"create_unidentified_source":
{ Args: { "p_description": string }; Returns: string
                           },
"decline_rehome":
{ Args: { "p_case_id": string }; Returns: string
                           },
"delete_comment":
{ Args: { "p_comment_id": string }; Returns: undefined
                           },
"delete_observation":
{ Args: { "p_observation_id": string }; Returns: undefined
                           },
"delete_update":
{ Args: { "p_update_id": string }; Returns: undefined
                           },
"edit_comment":
{ Args: { "p_body": string,"p_comment_id": string }; Returns: undefined
                           },
"express_rehome_interest":
{ Args: { "p_case_id": string }; Returns: string
                           },
"express_seed_offer_interest":
{ Args: { "p_offer_id": string,"p_requested_quantity"?: string }; Returns: string
                           },
"get_public_update":
{ Args: { "p_update_id": string }; Returns: {
              "author_has_avatar": boolean,"author_id": string,"author_name": string,"caption": string,"comment_count": number,"like_count": number,"liked_by_me": boolean,"media": Json,"observed_at": string,"published_at": string,"seedling_id": string,"seedling_name": string,"update_id": string
            }[]
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_my_unidentified_sources":
{ Args: Record<PropertyKey, never>; Returns: {
              "description": string,"photo_count": number,"source_id": string
            }[]
                           },
"list_public_updates":
{ Args: { "p_before_id"?: string,"p_before_published"?: string,"p_following_only"?: boolean,"p_limit": number }; Returns: {
              "author_has_avatar": boolean,"author_id": string,"author_name": string,"caption": string,"comment_count": number,"like_count": number,"liked_by_me": boolean,"media": Json,"observed_at": string,"published_at": string,"seedling_id": string,"seedling_name": string,"update_id": string
            }[]
                           },
"list_seedling_updates":
{ Args: { "p_seedling_id": string }; Returns: {
              "author_id": string,"author_name": string,"caption": string,"media": Json,"observed_at": string,"published_at": string,"update_id": string
            }[]
                           },
"list_update_comments":
{ Args: { "p_update_id": string }; Returns: {
              "author_id": string,"author_name": string,"body": string,"comment_id": string,"created_at": string,"edited_at": string,"is_mine": boolean,"is_removed": boolean,"parent_comment_id": string
            }[]
                           },
"mark_rehome_sent":
{ Args: { "p_case_id": string }; Returns: boolean
                           },
"move_observation":
{ Args: { "p_new_seedling"?: boolean,"p_observation_id": string,"p_target_seedling_id"?: string }; Returns: {
              "author_id": string,
"created_at": string,
"deleted_at": string | null,
"id": string,
"note": string | null,
"observed_at": string,
"seedling_id": string,
"structured_data": NonNullable<Json>,
"updated_at": string,
"visibility": Database["public"]['Enums']["observation_visibility"],
"voice_transcript": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "observations"
        isOneToOne: true
        isSetofReturn: false
      } },
"next_series_identifier":
{ Args: { "p_first_grown_year": number,"p_series_id": string }; Returns: string
                           },
"publish_seed_offer":
{ Args: { "p_handover_method"?: string,"p_items"?: Json,"p_material_type": string,"p_mode"?: string,"p_note"?: string,"p_packet_size"?: number,"p_price_text"?: string,"p_seedhead_count"?: number,"p_source_id": string }; Returns: string
                           },
"publish_update":
{ Args: { "p_caption"?: string,"p_client_key": string,"p_items": Json,"p_observation_id": string }; Returns: Json
                           },
"register_source_photo":
{ Args: { "p_path": string }; Returns: string
                           },
"rehome_panel":
{ Args: { "p_seedling_id": string }; Returns: Json
                           },
"reopen_rehome":
{ Args: { "p_case_id": string }; Returns: boolean
                           },
"resolve_own_identifier":
{ Args: { "p_identifier": string }; Returns: {
              "is_retired_alias": boolean,"seedling_id": string
            }[]
                           },
"search_cultivars":
{ Args: { "p_after_id"?: string,"p_after_text"?: string,"p_after_tier"?: number,"p_limit"?: number,"p_query": string }; Returns: {
              "cultivar_id": string,"cultivar_name": string,"match_tier": number,"pollen_parent_count": number,"seed_parent_count": number,"sort_text": string
            }[]
                           },
"search_growers":
{ Args: { "p_after_id"?: string,"p_after_text"?: string,"p_after_tier"?: number,"p_country"?: string,"p_limit"?: number,"p_query": string }; Returns: {
              "account_type_label": string,"country_code": string,"display_name": string,"match_tier": number,"profile_id": string,"sort_text": string
            }[]
                           },
"search_identifier":
{ Args: { "p_query": string }; Returns: string
                           },
"search_seed_offers":
{ Args: { "p_after_id"?: string,"p_after_text"?: string,"p_country"?: string,"p_limit"?: number,"p_query"?: string }; Returns: {
              "handover_method": string,"match_tier": number,"material_type": string,"mode": string,"offer_id": string,"packet_size": number,"photo_path": string,"price_text": string,"seedhead_count": number,"seller_country": string,"seller_name": string,"sort_text": string,"source_cultivar_name": string,"source_description": string,"source_kind": string,"source_seedling_id": string,"source_seedling_name": string
            }[]
                           },
"search_seedlings":
{ Args: { "p_after_id"?: string,"p_after_text"?: string,"p_after_tier"?: number,"p_available"?: boolean,"p_country"?: string,"p_limit"?: number,"p_query": string }; Returns: {
              "holder_country": string,"holder_id": string,"holder_name": string,"match_reason": string,"match_tier": number,"primary_identifier": string,"primary_kind": Database["public"]['Enums']["identifier_kind"],"seedling_id": string,"sort_text": string,"working_name": string
            }[]
                           },
"search_text":
{ Args: { "p_query": string }; Returns: string
                           },
"seedling_cover":
{ Args: { "p_seedling_id": string }; Returns: string
                           },
"set_cultivar_parent_photo":
{ Args: { "p_media_id": string,"p_source_id": string }; Returns: undefined
                           },
"set_grower_follow":
{ Args: { "p_on": boolean,"p_profile_id": string }; Returns: undefined
                           },
"set_like":
{ Args: { "p_on": boolean,"p_update_id": string }; Returns: undefined
                           },
"set_seedling_cover":
{ Args: { "p_derivative_id"?: string,"p_seedling_id": string }; Returns: undefined
                           },
"set_seedling_follow":
{ Args: { "p_on": boolean,"p_seedling_id": string }; Returns: undefined
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
"parent_unidentified_source_id": string | null,
"role": Database["public"]['Enums']["parent_role"]
            }
                          SetofOptions: {
        from: "*"
        to: "seedling_parentage"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_seedling_parent_unidentified":
{ Args: { "p_notes"?: string,"p_role": Database["public"]['Enums']["parent_role"],"p_seedling_id": string,"p_source_id": string }; Returns: {
              "child_seedling_id": string,
"created_at": string,
"created_by": string,
"id": string,
"is_unknown": boolean,
"notes": string | null,
"parent_cultivar_id": string | null,
"parent_seedling_id": string | null,
"parent_unidentified_source_id": string | null,
"role": Database["public"]['Enums']["parent_role"]
            }
                          SetofOptions: {
        from: "*"
        to: "seedling_parentage"
        isOneToOne: true
        isSetofReturn: false
      } },
"set_seedling_save":
{ Args: { "p_on": boolean,"p_seedling_id": string }; Returns: undefined
                           },
"start_rehome":
{ Args: { "p_handover"?: string,"p_make_public"?: boolean,"p_note"?: string,"p_price_text"?: string,"p_seedling_id": string,"p_term": string }; Returns: string
                           },
"withdraw_rehome_interest":
{ Args: { "p_case_id": string }; Returns: boolean
                           },
"withdraw_seed_offer_interest":
{ Args: { "p_offer_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "identifier_kind": "automatic"|"series"|"originator"|"local"|"working_alias","media_kind": "image"|"video","media_visibility": "private"|"public","observation_visibility": "private"|"public","parent_role": "seed_parent"|"pollen_parent"|"parent_unknown_role","seedling_visibility": "private"|"public"
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
            "identifier_kind": ["automatic", "series", "originator", "local", "working_alias"],"media_kind": ["image", "video"],"media_visibility": ["private", "public"],"observation_visibility": ["private", "public"],"parent_role": ["seed_parent", "pollen_parent", "parent_unknown_role"],"seedling_visibility": ["private", "public"]
          }
        }
} as const

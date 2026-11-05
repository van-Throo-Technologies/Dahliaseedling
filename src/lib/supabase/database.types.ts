
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
            "account_erasures": {
                  Row: {
                    "auth_identity_removed_at": string | null,"avatar_removed_at": string | null,"completed_at": string | null,"profile_id": string,"records_erased_at": string,"requested_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_identity_removed_at"?: string | null,"avatar_removed_at"?: string | null,"completed_at"?: string | null,"profile_id": string,"records_erased_at"?: string,"requested_at"?: string
                  }
                  Update: {
                    "auth_identity_removed_at"?: string | null,"avatar_removed_at"?: string | null,"completed_at"?: string | null,"profile_id"?: string,"records_erased_at"?: string,"requested_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "account_erasures_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_actions": {
                  Row: {
                    "action_type": string,"admin_id": string,"created_at": string,"id": string,"reason": string | null,"target_id": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action_type": string,"admin_id": string,"created_at"?: string,"id"?: string,"reason"?: string | null,"target_id": string,"target_type": string
                  }
                  Update: {
                    "action_type"?: string,"admin_id"?: string,"created_at"?: string,"id"?: string,"reason"?: string | null,"target_id"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "admin_actions_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_users": {
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
                },"availability_subscriptions": {
                  Row: {
                    "closed_at": string | null,"created_at": string,"locale": string,"seedling_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "closed_at"?: string | null,"created_at"?: string,"locale"?: string,"seedling_id": string,"user_id": string
                  }
                  Update: {
                    "closed_at"?: string | null,"created_at"?: string,"locale"?: string,"seedling_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_subscriptions_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "availability_subscriptions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"blocks": {
                  Row: {
                    "blocked_id": string,"blocker_id": string,"created_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "blocked_id": string,"blocker_id": string,"created_at"?: string
                  }
                  Update: {
                    "blocked_id"?: string,"blocker_id"?: string,"created_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "blocks_blocked_id_fkey"
      columns: ["blocked_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "blocks_blocker_id_fkey"
      columns: ["blocker_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
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
                },"conversation_reads": {
                  Row: {
                    "conversation_id": string,"read_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "conversation_id": string,"read_at": string,"user_id": string
                  }
                  Update: {
                    "conversation_id"?: string,"read_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversation_reads_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversation_reads_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"conversations": {
                  Row: {
                    "context_type": string,"created_at": string,"id": string,"last_message_at": string | null,"rehome_case_id": string | null,"seed_offer_id": string | null,"seedling_id": string | null,"user_a_id": string,"user_b_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "context_type": string,"created_at"?: string,"id"?: string,"last_message_at"?: string | null,"rehome_case_id"?: string | null,"seed_offer_id"?: string | null,"seedling_id"?: string | null,"user_a_id": string,"user_b_id": string
                  }
                  Update: {
                    "context_type"?: string,"created_at"?: string,"id"?: string,"last_message_at"?: string | null,"rehome_case_id"?: string | null,"seed_offer_id"?: string | null,"seedling_id"?: string | null,"user_a_id"?: string,"user_b_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "conversations_rehome_case_id_fkey"
      columns: ["rehome_case_id"]
isOneToOne: false
      referencedRelation: "rehome_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_seed_offer_id_fkey"
      columns: ["seed_offer_id"]
isOneToOne: false
      referencedRelation: "seed_offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_user_a_id_fkey"
      columns: ["user_a_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "conversations_user_b_id_fkey"
      columns: ["user_b_id"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"email_outbox": {
                  Row: {
                    "attempts": number,"claim_token": string | null,"claimed_until": string | null,"created_at": string,"dedupe_key": string,"id": string,"kind": string,"last_failure": string | null,"locale": string,"next_attempt_at": string,"provider_message_id": string | null,"recipient_id": string,"rehome_case_id": string | null,"seedling_id": string,"sent_at": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"claim_token"?: string | null,"claimed_until"?: string | null,"created_at"?: string,"dedupe_key": string,"id"?: string,"kind": string,"last_failure"?: string | null,"locale"?: string,"next_attempt_at"?: string,"provider_message_id"?: string | null,"recipient_id": string,"rehome_case_id"?: string | null,"seedling_id": string,"sent_at"?: string | null,"status"?: string
                  }
                  Update: {
                    "attempts"?: number,"claim_token"?: string | null,"claimed_until"?: string | null,"created_at"?: string,"dedupe_key"?: string,"id"?: string,"kind"?: string,"last_failure"?: string | null,"locale"?: string,"next_attempt_at"?: string,"provider_message_id"?: string | null,"recipient_id"?: string,"rehome_case_id"?: string | null,"seedling_id"?: string,"sent_at"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "email_outbox_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_outbox_rehome_case_id_fkey"
      columns: ["rehome_case_id"]
isOneToOne: false
      referencedRelation: "rehome_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "email_outbox_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback": {
                  Row: {
                    "app_version": string | null,"author_id": string,"category": string,"client_key": string,"created_at": string,"id": string,"message": string,"page_context": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "app_version"?: string | null,"author_id": string,"category": string,"client_key": string,"created_at"?: string,"id"?: string,"message": string,"page_context"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "app_version"?: string | null,"author_id"?: string,"category"?: string,"client_key"?: string,"created_at"?: string,"id"?: string,"message"?: string,"page_context"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "feedback_author_id_fkey"
      columns: ["author_id"]
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
                },"invitation_completions": {
                  Row: {
                    "completed_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
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
                },"messages": {
                  Row: {
                    "body": string | null,"client_key": string,"conversation_id": string,"created_at": string,"id": string,"photo_media_id": string | null,"sender_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body"?: string | null,"client_key": string,"conversation_id": string,"created_at"?: string,"id"?: string,"photo_media_id"?: string | null,"sender_id": string
                  }
                  Update: {
                    "body"?: string | null,"client_key"?: string,"conversation_id"?: string,"created_at"?: string,"id"?: string,"photo_media_id"?: string | null,"sender_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "messages_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_photo_media_id_fkey"
      columns: ["photo_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "messages_sender_id_fkey"
      columns: ["sender_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "actor_id": string | null,"comment_id": string | null,"conversation_id": string | null,"created_at": string,"dedupe_key": string,"id": string,"read_at": string | null,"recipient_id": string,"rehome_case_id": string | null,"seed_offer_id": string | null,"seedling_id": string | null,"type": string,"update_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_id"?: string | null,"comment_id"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"dedupe_key": string,"id"?: string,"read_at"?: string | null,"recipient_id": string,"rehome_case_id"?: string | null,"seed_offer_id"?: string | null,"seedling_id"?: string | null,"type": string,"update_id"?: string | null
                  }
                  Update: {
                    "actor_id"?: string | null,"comment_id"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"dedupe_key"?: string,"id"?: string,"read_at"?: string | null,"recipient_id"?: string,"rehome_case_id"?: string | null,"seed_offer_id"?: string | null,"seedling_id"?: string | null,"type"?: string,"update_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_actor_id_fkey"
      columns: ["actor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_comment_id_fkey"
      columns: ["comment_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_rehome_case_id_fkey"
      columns: ["rehome_case_id"]
isOneToOne: false
      referencedRelation: "rehome_cases"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_seed_offer_id_fkey"
      columns: ["seed_offer_id"]
isOneToOne: false
      referencedRelation: "seed_offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_seedling_id_fkey"
      columns: ["seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_update_id_fkey"
      columns: ["update_id"]
isOneToOne: false
      referencedRelation: "updates"
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
                },"privacy_requests": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"profile_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind": string,"profile_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"profile_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "privacy_requests_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "account_state": string,"account_type_label": string | null,"avatar_path": string | null,"bio": string | null,"country_code": string,"created_at": string,"display_name": string,"id": string,"is_suspended": boolean,"region_city": string | null,"state_changed_at": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_state"?: string,"account_type_label"?: string | null,"avatar_path"?: string | null,"bio"?: string | null,"country_code": string,"created_at"?: string,"display_name": string,"id": string,"is_suspended"?: boolean,"region_city"?: string | null,"state_changed_at"?: string,"updated_at"?: string
                  }
                  Update: {
                    "account_state"?: string,"account_type_label"?: string | null,"avatar_path"?: string | null,"bio"?: string | null,"country_code"?: string,"created_at"?: string,"display_name"?: string,"id"?: string,"is_suspended"?: boolean,"region_city"?: string | null,"state_changed_at"?: string,"updated_at"?: string
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
                },"rate_counters": {
                  Row: {
                    "action": string,"hits": number,"user_id": string,"window_start": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"hits"?: number,"user_id": string,"window_start": string
                  }
                  Update: {
                    "action"?: string,"hits"?: number,"user_id"?: string,"window_start"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rate_counters_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"rehome_cases": {
                  Row: {
                    "chosen_recipient_id": string | null,"closed_at": string | null,"created_at": string,"handover_method": string | null,"id": string,"note": string | null,"offering_holder_id": string,"price_text": string | null,"received_at": string | null,"seedling_id": string,"sent_at": string | null,"status": string,"term": string | null,"updated_at": string,"_availability_alert": undefined | null
                  }
                  ComputedFields: "_availability_alert"
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
                },"reports": {
                  Row: {
                    "content_snapshot": string | null,"conversation_id": string | null,"created_at": string,"details": string | null,"id": string,"message_photo_media_id": string | null,"reason": string,"reported_user_id": string,"reporter_id": string,"resolved_at": string | null,"reviewed_by": string | null,"status": string,"target_id": string,"target_type": string,"target_update_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "content_snapshot"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"details"?: string | null,"id"?: string,"message_photo_media_id"?: string | null,"reason": string,"reported_user_id": string,"reporter_id": string,"resolved_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"target_id": string,"target_type": string,"target_update_id"?: string | null
                  }
                  Update: {
                    "content_snapshot"?: string | null,"conversation_id"?: string | null,"created_at"?: string,"details"?: string | null,"id"?: string,"message_photo_media_id"?: string | null,"reason"?: string,"reported_user_id"?: string,"reporter_id"?: string,"resolved_at"?: string | null,"reviewed_by"?: string | null,"status"?: string,"target_id"?: string,"target_type"?: string,"target_update_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_conversation_id_fkey"
      columns: ["conversation_id"]
isOneToOne: false
      referencedRelation: "conversations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_message_photo_media_id_fkey"
      columns: ["message_photo_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reported_user_id_fkey"
      columns: ["reported_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reporter_id_fkey"
      columns: ["reporter_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_reviewed_by_fkey"
      columns: ["reviewed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "reports_target_update_id_fkey"
      columns: ["target_update_id"]
isOneToOne: false
      referencedRelation: "updates"
      referencedColumns: ["id"]
    }
                  ]
                },"retention_policies": {
                  Row: {
                    "basis": string | null,"category": string,"retain_days": number | null,"set_at": string | null,"set_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "basis"?: string | null,"category": string,"retain_days"?: number | null,"set_at"?: string | null,"set_by"?: string | null
                  }
                  Update: {
                    "basis"?: string | null,"category"?: string,"retain_days"?: number | null,"set_at"?: string | null,"set_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "retention_policies_set_by_fkey"
      columns: ["set_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"retention_runs": {
                  Row: {
                    "admin_id": string,"applied_at": string,"category": string,"id": string,"rows_cleared": number
                  }
                  ComputedFields: never
                  Insert: {
                    "admin_id": string,"applied_at"?: string,"category": string,"id"?: string,"rows_cleared": number
                  }
                  Update: {
                    "admin_id"?: string,"applied_at"?: string,"category"?: string,"id"?: string,"rows_cleared"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "retention_runs_admin_id_fkey"
      columns: ["admin_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "retention_runs_category_fkey"
      columns: ["category"]
isOneToOne: false
      referencedRelation: "retention_policies"
      referencedColumns: ["category"]
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
                },"seedling_merges": {
                  Row: {
                    "canonical_seedling_id": string,"confirmed_by": string,"id": string,"merged_at": string,"retired_seedling_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "canonical_seedling_id": string,"confirmed_by": string,"id"?: string,"merged_at"?: string,"retired_seedling_id": string
                  }
                  Update: {
                    "canonical_seedling_id"?: string,"confirmed_by"?: string,"id"?: string,"merged_at"?: string,"retired_seedling_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "seedling_merges_canonical_seedling_id_fkey"
      columns: ["canonical_seedling_id"]
isOneToOne: false
      referencedRelation: "seedlings"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seedling_merges_confirmed_by_fkey"
      columns: ["confirmed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "seedling_merges_retired_seedling_id_fkey"
      columns: ["retired_seedling_id"]
isOneToOne: true
      referencedRelation: "seedlings"
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
                    "cover_derivative_id": string | null,"created_at": string,"current_holder_id": string,"deleted_at": string | null,"first_grown_year": number | null,"id": string,"merged_into_id": string | null,"originator_id": string,"updated_at": string,"visibility": Database["public"]['Enums']["seedling_visibility"],"working_name": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_derivative_id"?: string | null,"created_at"?: string,"current_holder_id": string,"deleted_at"?: string | null,"first_grown_year"?: number | null,"id"?: string,"merged_into_id"?: string | null,"originator_id": string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["seedling_visibility"],"working_name"?: string | null
                  }
                  Update: {
                    "cover_derivative_id"?: string | null,"created_at"?: string,"current_holder_id"?: string,"deleted_at"?: string | null,"first_grown_year"?: number | null,"id"?: string,"merged_into_id"?: string | null,"originator_id"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["seedling_visibility"],"working_name"?: string | null
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
      foreignKeyName: "seedlings_merged_into_id_fkey"
      columns: ["merged_into_id"]
isOneToOne: false
      referencedRelation: "seedlings"
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
                },"storage_purge_queue": {
                  Row: {
                    "bucket": string,"id": string,"object_path": string,"owner_id": string,"purged_at": string | null,"queued_at": string,"reason": string,"state": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"id"?: string,"object_path": string,"owner_id": string,"purged_at"?: string | null,"queued_at"?: string,"reason": string,"state"?: string
                  }
                  Update: {
                    "bucket"?: string,"id"?: string,"object_path"?: string,"owner_id"?: string,"purged_at"?: string | null,"queued_at"?: string,"reason"?: string,"state"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "storage_purge_queue_owner_id_fkey"
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
            "_availability_alert":
{ Args: { "p_case": Omit<Database["public"]['Tables']["rehome_cases"]['Row'], Database["public"]['Tables']["rehome_cases"]['ComputedFields']> }; Returns: undefined
                           },
"_blocked_between":
{ Args: { "p_a": string,"p_b": string }; Returns: boolean
                           },
"_derivative_is_public":
{ Args: { "p_derivative_id": string }; Returns: boolean
                           },
"_feedback_context":
{ Args: { "p_raw": string }; Returns: string
                           },
"_guard_seedling_for_new_work":
{ Args: { "p_seedling_id": string }; Returns: undefined
                           },
"_is_conversation_participant":
{ Args: { "p_conversation_id": string }; Returns: boolean
                           },
"_lock_pair":
{ Args: { "p_a": string,"p_b": string }; Returns: undefined
                           },
"_media_object_unregistered":
{ Args: { "p_name": string }; Returns: boolean
                           },
"_message_media_is_readable":
{ Args: { "p_media_id": string }; Returns: boolean
                           },
"_profile_active":
{ Args: { "p_id": string }; Returns: boolean
                           },
"_public_media_object_is_public":
{ Args: { "p_name": string }; Returns: boolean
                           },
"_public_media_object_unregistered":
{ Args: { "p_name": string }; Returns: boolean
                           },
"_rate_limit_consume":
{ Args: { "p_action": string,"p_user": string }; Returns: undefined
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
"_storage_object_referenced":
{ Args: { "p_bucket": string,"p_name": string }; Returns: boolean
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
"account_export_document":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"add_comment":
{ Args: { "p_body": string,"p_parent_comment_id"?: string,"p_update_id": string }; Returns: string
                           },
"add_unidentified_source_photo":
{ Args: { "p_media_id": string,"p_source_id": string }; Returns: undefined
                           },
"admin_list_reports":
{ Args: { "p_limit"?: number,"p_show_all"?: boolean }; Returns: {
              "content_snapshot": string,"created_at": string,"details": string,"id": string,"is_message": boolean,"reason": string,"reported_name": string,"reported_suspended": boolean,"reported_user_id": string,"reporter_name": string,"resolved_at": string,"status": string,"target_id": string,"target_live": boolean,"target_type": string,"target_update_id": string
            }[]
                           },
"admin_remove_content":
{ Args: { "p_reason"?: string,"p_report_id": string }; Returns: undefined
                           },
"admin_set_feedback_status":
{ Args: { "p_feedback_id": string,"p_status": string }; Returns: undefined
                           },
"admin_set_reported_suspension":
{ Args: { "p_reason"?: string,"p_report_id": string,"p_suspended": boolean }; Returns: undefined
                           },
"admin_set_suspended":
{ Args: { "suspended": boolean,"target_profile_id": string }; Returns: {
              "account_state": string,
"account_type_label": string | null,
"avatar_path": string | null,
"bio": string | null,
"country_code": string,
"created_at": string,
"display_name": string,
"id": string,
"is_suspended": boolean,
"region_city": string | null,
"state_changed_at": string,
"updated_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "profiles"
        isOneToOne: true
        isSetofReturn: false
      } },
"admin_suspend_profile":
{ Args: { "p_profile_id": string,"p_reason": string,"p_suspended": boolean }; Returns: undefined
                           },
"apply_retention_period":
{ Args: { "p_category": string }; Returns: number
                           },
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
"block_user":
{ Args: { "p_target": string }; Returns: undefined
                           },
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
"complete_invitation_password":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"confirm_rehome_received":
{ Args: { "p_case_id": string }; Returns: string
                           },
"create_report":
{ Args: { "p_details"?: string,"p_reason": string,"p_target_id": string,"p_target_type": string }; Returns: string
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
"merged_into_id": string | null,
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
"deactivate_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
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
"email_claim_due":
{ Args: { "p_lease_seconds"?: number,"p_limit"?: number }; Returns: {
              "attempts": number,"claim_token": string,"id": string
            }[]
                           },
"email_delivery_context":
{ Args: { "p_claim_token": string,"p_id": string }; Returns: {
              "locale": string,"recipient_email": string,"seedling_id": string,"seedling_name": string,"suppressed_reason": string
            }[]
                           },
"email_record_failed":
{ Args: { "p_claim_token": string,"p_failure": string,"p_id": string }; Returns: undefined
                           },
"email_record_retry":
{ Args: { "p_claim_token": string,"p_failure": string,"p_id": string }; Returns: undefined
                           },
"email_record_sent":
{ Args: { "p_claim_token": string,"p_id": string,"p_provider_message_id": string }; Returns: undefined
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
"held_seedling_candidates":
{ Args: { "p_limit"?: number }; Returns: {
              "created_at": string,"last_capture_at": string,"seedling_id": string,"working_name": string
            }[]
                           },
"invitation_password_pending":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"list_canonical_seedling_updates":
{ Args: { "p_seedling_id": string }; Returns: {
              "author_id": string,"author_name": string,"caption": string,"media": Json,"observed_at": string,"published_at": string,"update_id": string
            }[]
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
"mark_all_notifications_read":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mark_conversation_read":
{ Args: { "p_conversation_id": string }; Returns: undefined
                           },
"mark_notification_read":
{ Args: { "p_notification_id": string }; Returns: undefined
                           },
"mark_rehome_sent":
{ Args: { "p_case_id": string }; Returns: boolean
                           },
"merge_seedlings":
{ Args: { "p_canonical": string,"p_confirmed"?: boolean,"p_duplicate": string }; Returns: string
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
"my_privacy_status":
{ Args: Record<PropertyKey, never>; Returns: {
              "account_state": string,"auth_identity_removed": boolean,"avatar_removed": boolean,"completed": boolean,"erasure_requested_at": string,"media_purge_outstanding": boolean,"state_changed_at": string
            }[]
                           },
"next_series_identifier":
{ Args: { "p_first_grown_year": number,"p_series_id": string }; Returns: string
                           },
"note_my_export":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"publish_seed_offer":
{ Args: { "p_handover_method"?: string,"p_items"?: Json,"p_material_type": string,"p_mode"?: string,"p_note"?: string,"p_packet_size"?: number,"p_price_text"?: string,"p_seedhead_count"?: number,"p_source_id": string }; Returns: string
                           },
"publish_update":
{ Args: { "p_caption"?: string,"p_client_key": string,"p_items": Json,"p_observation_id": string }; Returns: Json
                           },
"record_my_avatar_removed":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"register_message_photo":
{ Args: { "p_path": string }; Returns: string
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
"request_my_erasure":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"resolve_own_identifier":
{ Args: { "p_identifier": string }; Returns: {
              "is_retired_alias": boolean,"seedling_id": string
            }[]
                           },
"resolve_report":
{ Args: { "p_reason"?: string,"p_report_id": string,"p_status": string }; Returns: undefined
                           },
"resolve_retired_identifier":
{ Args: { "p_query": string }; Returns: string
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
"seedling_canonical_id":
{ Args: { "p_seedling_id": string }; Returns: string
                           },
"seedling_cover":
{ Args: { "p_seedling_id": string }; Returns: string
                           },
"send_message":
{ Args: { "p_body"?: string,"p_client_key": string,"p_conversation_id": string,"p_photo_media_id"?: string }; Returns: string
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
"set_retention_period":
{ Args: { "p_basis": string,"p_category": string,"p_days": number }; Returns: undefined
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
"start_direct_conversation":
{ Args: { "p_other": string }; Returns: string
                           },
"start_rehome":
{ Args: { "p_handover"?: string,"p_make_public"?: boolean,"p_note"?: string,"p_price_text"?: string,"p_seedling_id": string,"p_term": string }; Returns: string
                           },
"start_rehome_conversation":
{ Args: { "p_case_id": string,"p_with": string }; Returns: string
                           },
"start_seed_offer_conversation":
{ Args: { "p_offer_id": string,"p_with": string }; Returns: string
                           },
"start_seedling_conversation":
{ Args: { "p_seedling_id": string }; Returns: string
                           },
"storage_orphan_candidates":
{ Args: { "p_limit"?: number }; Returns: {
              "bucket_id": string,"created_at": string,"object_name": string
            }[]
                           },
"storage_purge_eligible":
{ Args: { "p_limit"?: number }; Returns: {
              "bucket": string,"id": string,"object_path": string,"owner_id": string,"queued_at": string
            }[]
                           },
"submit_feedback":
{ Args: { "p_app_version"?: string,"p_category": string,"p_client_key": string,"p_message": string,"p_page_context"?: string }; Returns: string
                           },
"subscribe_availability":
{ Args: { "p_locale"?: string,"p_seedling_id": string }; Returns: undefined
                           },
"unblock_user":
{ Args: { "p_target": string }; Returns: undefined
                           },
"unread_conversation_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"unread_notification_count":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"unsubscribe_availability":
{ Args: { "p_seedling_id": string }; Returns: undefined
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

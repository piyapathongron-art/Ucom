// Generated: mcp__claude_ai_Supabase__generate_typescript_types against
// bihgcdceovfettoxmgme (public schema, shared with DailyGold). Regenerate
// after any migration instead of hand-editing.
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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      categories: {
        Row: {
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      device_units: {
        Row: {
          acquisition: string
          commission: number | null
          consigned_to: string | null
          consignor_name: string | null
          cost: number | null
          created_at: string
          financed_at: string | null
          id: string
          imei: string
          is_imported: boolean
          list_price: number
          model_name: string
          sf_order_id: string | null
          sf_paid_full_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acquisition: string
          commission?: number | null
          consigned_to?: string | null
          consignor_name?: string | null
          cost?: number | null
          created_at?: string
          financed_at?: string | null
          id?: string
          imei: string
          is_imported?: boolean
          list_price: number
          model_name: string
          sf_order_id?: string | null
          sf_paid_full_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acquisition?: string
          commission?: number | null
          consigned_to?: string | null
          consignor_name?: string | null
          cost?: number | null
          created_at?: string
          financed_at?: string | null
          id?: string
          imei?: string
          is_imported?: boolean
          list_price?: number
          model_name?: string
          sf_order_id?: string | null
          sf_paid_full_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_units_sf_order_id_fkey"
            columns: ["sf_order_id"]
            isOneToOne: false
            referencedRelation: "sf_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_units_sf_order_id_fkey"
            columns: ["sf_order_id"]
            isOneToOne: false
            referencedRelation: "v_sf_due"
            referencedColumns: ["sf_order_id"]
          },
        ]
      }
      display_settings: {
        Row: {
          gold_bar_buy: string
          gold_bar_mode: string
          gold_bar_sell: string
          gold_buy: string
          gold_sell: string
          id: number
          poll_seconds: number
          promo_images: string[]
          slide_seconds: number
          updated_at: string
        }
        Insert: {
          gold_bar_buy?: string
          gold_bar_mode?: string
          gold_bar_sell?: string
          gold_buy?: string
          gold_sell?: string
          id?: number
          poll_seconds?: number
          promo_images?: string[]
          slide_seconds?: number
          updated_at?: string
        }
        Update: {
          gold_bar_buy?: string
          gold_bar_mode?: string
          gold_bar_sell?: string
          gold_buy?: string
          gold_sell?: string
          id?: number
          poll_seconds?: number
          promo_images?: string[]
          slide_seconds?: number
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          is_imported: boolean
          name: string
          spent_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_imported?: boolean
          name: string
          spent_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_imported?: boolean
          name?: string
          spent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          cost: number
          created_at: string
          id: string
          is_active: boolean
          is_imported: boolean
          name: string
          price: number
          qty: number
          sku: string | null
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_imported?: boolean
          name: string
          price?: number
          qty?: number
          sku?: string | null
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          cost?: number
          created_at?: string
          id?: string
          is_active?: boolean
          is_imported?: boolean
          name?: string
          price?: number
          qty?: number
          sku?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          role: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      repair_jobs: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          customer_name: string
          customer_phone: string | null
          device_desc: string
          id: string
          note: string | null
          part_cost: number | null
          part_paid_at: string | null
          quoted_price: number | null
          received_at: string
          sale_id: string | null
          status: string
          symptom: string | null
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name: string
          customer_phone?: string | null
          device_desc: string
          id?: string
          note?: string | null
          part_cost?: number | null
          part_paid_at?: string | null
          quoted_price?: number | null
          received_at?: string
          sale_id?: string | null
          status?: string
          symptom?: string | null
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string
          customer_phone?: string | null
          device_desc?: string
          id?: string
          note?: string | null
          part_cost?: number | null
          part_paid_at?: string | null
          quoted_price?: number | null
          received_at?: string
          sale_id?: string | null
          status?: string
          symptom?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "repair_jobs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_jobs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repair_jobs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sale_profit"
            referencedColumns: ["sale_id"]
          },
        ]
      }
      sale_items: {
        Row: {
          device_unit_id: string | null
          id: string
          item_discount: number
          item_discount_reason: string | null
          kind: string
          name_snapshot: string
          product_id: string | null
          qty: number
          sale_id: string
          topup_carrier_id: string | null
          unit_cost: number
          unit_price: number
        }
        Insert: {
          device_unit_id?: string | null
          id?: string
          item_discount?: number
          item_discount_reason?: string | null
          kind: string
          name_snapshot: string
          product_id?: string | null
          qty?: number
          sale_id: string
          topup_carrier_id?: string | null
          unit_cost?: number
          unit_price: number
        }
        Update: {
          device_unit_id?: string | null
          id?: string
          item_discount?: number
          item_discount_reason?: string | null
          kind?: string
          name_snapshot?: string
          product_id?: string | null
          qty?: number
          sale_id?: string
          topup_carrier_id?: string | null
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_device_unit_id_fkey"
            columns: ["device_unit_id"]
            isOneToOne: false
            referencedRelation: "device_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_pos_top_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "v_sale_profit"
            referencedColumns: ["sale_id"]
          },
          {
            foreignKeyName: "sale_items_topup_carrier_id_fkey"
            columns: ["topup_carrier_id"]
            isOneToOne: false
            referencedRelation: "topup_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_topup_carrier_id_fkey"
            columns: ["topup_carrier_id"]
            isOneToOne: false
            referencedRelation: "v_pos_topup_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_topup_carrier_id_fkey"
            columns: ["topup_carrier_id"]
            isOneToOne: false
            referencedRelation: "v_topup_wallet_balance"
            referencedColumns: ["carrier_id"]
          },
        ]
      }
      sales: {
        Row: {
          bill_discount: number
          bill_discount_reason: string | null
          client_uuid: string | null
          created_at: string
          created_by: string | null
          id: string
          is_imported: boolean
          note: string | null
          payment_method: string
          receiving_account: string | null
          sold_at: string
        }
        Insert: {
          bill_discount?: number
          bill_discount_reason?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_imported?: boolean
          note?: string | null
          payment_method: string
          receiving_account?: string | null
          sold_at?: string
        }
        Update: {
          bill_discount?: number
          bill_discount_reason?: string | null
          client_uuid?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_imported?: boolean
          note?: string | null
          payment_method?: string
          receiving_account?: string | null
          sold_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sf_orders: {
        Row: {
          created_at: string
          due_date: string | null
          id: string
          note: string | null
          order_no: string
          ordered_at: string
        }
        Insert: {
          created_at?: string
          due_date?: string | null
          id?: string
          note?: string | null
          order_no: string
          ordered_at: string
        }
        Update: {
          created_at?: string
          due_date?: string | null
          id?: string
          note?: string | null
          order_no?: string
          ordered_at?: string
        }
        Relationships: []
      }
      topup_carriers: {
        Row: {
          commission_rate: number
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          commission_rate?: number
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          commission_rate?: number
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      topup_wallet_entries: {
        Row: {
          amount: number
          carrier_id: string
          created_at: string
          id: string
          note: string | null
          occurred_at: string
        }
        Insert: {
          amount: number
          carrier_id: string
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
        }
        Update: {
          amount?: number
          carrier_id?: string
          created_at?: string
          id?: string
          note?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topup_wallet_entries_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "topup_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topup_wallet_entries_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "v_pos_topup_carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topup_wallet_entries_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "v_topup_wallet_balance"
            referencedColumns: ["carrier_id"]
          },
        ]
      }
    }
    Views: {
      v_monthly_report: {
        Row: {
          expense: number | null
          month: string | null
          net_profit: number | null
          repair_profit: number | null
          repair_revenue: number | null
          sale_profit: number | null
          sale_revenue: number | null
          sf_commission: number | null
        }
        Relationships: []
      }
      v_pos_catalog: {
        Row: {
          category_name: string | null
          code: string | null
          id: string | null
          kind: string | null
          name: string | null
          price: number | null
          qty: number | null
        }
        Relationships: []
      }
      v_pos_top_products: {
        Row: {
          category_name: string | null
          code: string | null
          id: string | null
          kind: string | null
          name: string | null
          price: number | null
          qty: number | null
        }
        Relationships: []
      }
      v_pos_topup_carriers: {
        Row: {
          id: string | null
          name: string | null
        }
        Insert: {
          id?: string | null
          name?: string | null
        }
        Update: {
          id?: string | null
          name?: string | null
        }
        Relationships: []
      }
      v_sale_profit: {
        Row: {
          bill_discount: number | null
          gross: number | null
          is_imported: boolean | null
          item_discount: number | null
          net_revenue: number | null
          payment_method: string | null
          profit: number | null
          receiving_account: string | null
          sale_id: string | null
          sold_at: string | null
          total_cost: number | null
        }
        Relationships: []
      }
      v_sf_due: {
        Row: {
          amount_due: number | null
          days_left: number | null
          device_count: number | null
          due_date: string | null
          financed_count: number | null
          order_no: string | null
          ordered_at: string | null
          sf_order_id: string | null
          unfinanced_count: number | null
        }
        Relationships: []
      }
      v_topup_wallet_balance: {
        Row: {
          balance: number | null
          carrier_id: string | null
          commission_rate: number | null
          name: string | null
          spent: number | null
          topped_up: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      pos_is_member: { Args: never; Returns: boolean }
      pos_is_owner: { Args: never; Returns: boolean }
      rpc_close_repair_job: {
        Args: { p_job_id: string; p_sale_payload: Json }
        Returns: string
      }
      rpc_create_repair_job: { Args: { payload: Json }; Returns: string }
      rpc_create_sale: { Args: { payload: Json }; Returns: string }
      rpc_finance_device: {
        Args: { p_commission: number; p_device_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/lib/types/database";

export type SfDueRow = Tables<"v_sf_due">;
export type SfOrderDeviceRow = Tables<"v_sf_order_devices">;
export type SfOrderPayload = {
  id: string;
  order_no: string;
  ordered_at: string;
  note: string | null;
  devices: { id: string; imei: string; model_name: string; list_price: number; sale_price: number | null }[];
};

export function useSfDue(onSuccess: () => Promise<void>) {
  const supabase = createClient();
  const requestRef = useRef(0);

  const [dueList, setDueList] = useState<SfDueRow[]>([]);
  const [devicesByOrder, setDevicesByOrder] = useState<Record<string, SfOrderDeviceRow[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDueList() {
    const requestId = ++requestRef.current;
    setIsLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("v_sf_due")
        .select("*")
        .order("ordered_at", { ascending: false });

      if (fetchError) throw fetchError;
      if (requestId !== requestRef.current) return;
      setDueList(data ?? []);
      setError(null);
    } catch (err) {
      if (requestId !== requestRef.current) return;
      setError(err instanceof Error ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      if (requestId === requestRef.current) setIsLoading(false);
    }
  }

  async function loadDevicesForOrder(orderId: string) {
    try {
      const { data, error: fetchError } = await supabase
        .from("v_sf_order_devices")
        .select("*")
        .eq("sf_order_id", orderId);
      if (fetchError) throw fetchError;
      setDevicesByOrder(prev => ({ ...prev, [orderId]: data ?? [] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "โหลดข้อมูลเครื่องไม่สำเร็จ");
    }
  }

  async function saveOrder(input: SfOrderPayload) {
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc("rpc_update_sf_order", {
        payload: input,
      });
      if (rpcErr) throw rpcErr;
      await Promise.all([loadDueList(), onSuccess()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "แก้ไขไม่สำเร็จ");
      throw err;
    }
  }

  async function deleteOrder(id: string) {
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc("rpc_delete_sf_order", {
        p_id: id,
      });
      if (rpcErr) throw rpcErr;
      await Promise.all([loadDueList(), onSuccess()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
      throw err;
    }
  }

  return {
    dueList,
    devicesByOrder,
    isLoading,
    error,
    setError,
    loadDueList,
    loadDevicesForOrder,
    saveOrder,
    deleteOrder,
  };
}

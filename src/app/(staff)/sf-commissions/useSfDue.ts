import { useState, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { toThaiError } from "@/lib/errors";
import type { SfIntakePayload } from "./SfIntakeDialog";
import type { Tables } from "@/lib/types/database";

export type SfDueRow = Tables<"v_sf_due">;
export type SfOrderDeviceRow = Tables<"v_sf_order_devices">;
export type SfOrderPayload = {
  id: string;
  order_no: string;
  ordered_at: string;
  note: string | null;
  devices: { id: string; imei: string; model_name: string; list_price: number; sale_price: number | null }[];
  removed_device_ids: string[];
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
      setError(toThaiError(err));
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
      setError(toThaiError(err));
    }
  }

  // Each write resolves true on success; on failure it toasts a Thai message and resolves false.
  async function write(call: PromiseLike<{ error: unknown }>, successMessage: string) {
    const { error: rpcErr } = await call;
    if (rpcErr) {
      toast.error(toThaiError(rpcErr), { duration: Infinity });
      return false;
    }
    toast.success(successMessage);
    await Promise.all([loadDueList(), onSuccess()]);
    return true;
  }

  const createOrder = (input: SfIntakePayload) =>
    write(supabase.rpc("rpc_receive_sf_order", {
      payload: { order_no: input.order_no, ordered_at: input.ordered_at || null, note: input.note || null, devices: input.devices },
    }), "รับบิล SF แล้ว");

  const saveOrder = (input: SfOrderPayload) =>
    write(supabase.rpc("rpc_update_sf_order", { payload: input }), "แก้ไขบิล SF แล้ว");

  const deleteOrder = (id: string) =>
    write(supabase.rpc("rpc_delete_sf_order", { p_id: id }), "ลบบิล SF แล้ว");

  return {
    dueList,
    devicesByOrder,
    isLoading,
    error,
    setError,
    loadDueList,
    loadDevicesForOrder,
    createOrder,
    saveOrder,
    deleteOrder,
  };
}

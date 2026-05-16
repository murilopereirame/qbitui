import { useQuery } from "@tanstack/react-query";
import { TransferInfo, QBitAPI } from "@qbitui/core";
import { useSessionStore } from "./useSession";

export function useTransfer() {
  const session = useSessionStore((s) => s.session);

  return useQuery<TransferInfo>({
    queryKey: ["transfer"],
    queryFn: () => {
      if (!session) throw new Error("Not authenticated");
      const api = new QBitAPI(session.host, session.sid);
      return api.getTransferInfo();
    },
    enabled: !!session,
    refetchInterval: 2000,
    staleTime: 1000,
  });
}

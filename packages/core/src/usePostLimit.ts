import { useEffect, useState } from "react";
import { api, configured } from "./index";
export function usePostLimit() {
  const [limit, setLimit] = useState(500);
  useEffect(() => {
    if (!configured) return;
    void api
      .from("platform_settings")
      .select("value")
      .eq("key", "post_max_chars")
      .single()
      .then(({ data }) => {
        if (data && data.value > 0) setLimit(data.value);
      });
  }, []);
  return limit;
}

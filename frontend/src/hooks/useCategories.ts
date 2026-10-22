
import { useQuery } from "@tanstack/react-query";
import { fetchCategories } from "@/services/catalogApi";

export function useCategories() {
  return useQuery({
    queryKey: ["catalog", "categories"],
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: 30_000,
    refetchOnWindowFocus: true,

    retry: (failureCount, error) => {
      if (failureCount >= 2) {
        return false;
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "status" in error
      ) {
        const status = error.status;

        return (
          status === null ||
          (typeof status === "number" && status >= 500)
        );
      }

      return error instanceof TypeError;
    },
  });
}
